
-- store_conversations
CREATE TABLE public.store_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  npc_id UUID REFERENCES public.npcs(id) ON DELETE SET NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  unread_owner INTEGER NOT NULL DEFAULT 0,
  unread_user INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_conversations TO authenticated;
GRANT ALL ON public.store_conversations TO service_role;
ALTER TABLE public.store_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user sees own conversations" ON public.store_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "user creates own conversation" ON public.store_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user updates own conversation" ON public.store_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "owner deletes conversations" ON public.store_conversations
  FOR DELETE TO authenticated USING (public.is_owner());

CREATE TRIGGER tg_store_conversations_updated
  BEFORE UPDATE ON public.store_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_store_conv_store ON public.store_conversations(store_id, last_message_at DESC);
CREATE INDEX idx_store_conv_user ON public.store_conversations(user_id, last_message_at DESC);

-- conversation_messages
CREATE TABLE public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.store_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'user',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read messages of own conv or owner" ON public.conversation_messages
  FOR SELECT TO authenticated USING (
    public.is_owner() OR EXISTS (
      SELECT 1 FROM public.store_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "insert messages in own conv or owner" ON public.conversation_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND (
      public.is_owner() OR EXISTS (
        SELECT 1 FROM public.store_conversations c
        WHERE c.id = conversation_id AND c.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "owner deletes messages" ON public.conversation_messages
  FOR DELETE TO authenticated USING (public.is_owner());

CREATE INDEX idx_conv_msg ON public.conversation_messages(conversation_id, created_at);

-- keep conversation last_message_at in sync
CREATE OR REPLACE FUNCTION public.tg_bump_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.store_conversations
     SET last_message_at = now(),
         unread_owner = CASE WHEN NEW.sender_role = 'user' THEN unread_owner + 1 ELSE unread_owner END,
         unread_user  = CASE WHEN NEW.sender_role = 'owner' THEN unread_user + 1 ELSE unread_user END,
         status = CASE WHEN NEW.sender_role = 'user' AND status = 'closed' THEN 'open' ELSE status END
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER tg_conversation_messages_bump
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_conversation();
