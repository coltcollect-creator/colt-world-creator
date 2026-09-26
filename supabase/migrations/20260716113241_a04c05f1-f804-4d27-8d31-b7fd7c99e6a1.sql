ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#c8ecff';

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS sprite_url TEXT,
  ADD COLUMN IF NOT EXISTS sprite_left_url TEXT,
  ADD COLUMN IF NOT EXISTS sprite_right_url TEXT,
  ADD COLUMN IF NOT EXISTS sprite_jump_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT 72;

GRANT INSERT, UPDATE ON public.player_quests TO authenticated;

DROP POLICY IF EXISTS pq_insert_own ON public.player_quests;
CREATE POLICY pq_insert_own ON public.player_quests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS pq_update_own ON public.player_quests;
CREATE POLICY pq_update_own ON public.player_quests FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.progress_quest(_action_type TEXT, _amount INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  q RECORD;
  key TEXT;
  tz TEXT;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT quest_timezone INTO tz FROM public.game_settings WHERE id = 1;
  tz := COALESCE(tz, 'UTC');
  FOR q IN SELECT * FROM public.quests WHERE active AND action_type = _action_type LOOP
    key := CASE q.quest_type
      WHEN 'daily' THEN to_char((now() AT TIME ZONE tz)::date, 'YYYY-MM-DD')
      WHEN 'weekly' THEN to_char(date_trunc('week', (now() AT TIME ZONE tz))::date, 'YYYY-MM-DD') || '-w'
      ELSE 'once'
    END;
    INSERT INTO public.player_quests (user_id, quest_id, progress, period_key, completed_at)
    VALUES (uid, q.id, LEAST(_amount, q.target_amount), key,
            CASE WHEN _amount >= q.target_amount THEN now() ELSE NULL END)
    ON CONFLICT (user_id, quest_id, period_key) DO UPDATE
      SET progress = LEAST(public.player_quests.progress + _amount, q.target_amount),
          completed_at = CASE
            WHEN public.player_quests.progress + _amount >= q.target_amount
                 AND public.player_quests.completed_at IS NULL THEN now()
            ELSE public.player_quests.completed_at
          END,
          updated_at = now();
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.progress_quest(TEXT, INT) TO authenticated;