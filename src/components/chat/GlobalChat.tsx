import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type Msg = { id: string; user_id: string; message: string; created_at: string; username?: string; level?: number };

export function GlobalChat() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [lastSent, setLastSent] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("chat_messages")
        .select("id,user_id,message,created_at").eq("channel", "global").eq("deleted", false)
        .order("created_at", { ascending: false }).limit(40);
      if (cancelled || !data) return;
      const list = (data as Msg[]).reverse();
      // enrich with usernames
      const ids = Array.from(new Set(list.map((m) => m.user_id)));
      if (ids.length) {
        const { data: ps } = await supabase.rpc("get_public_profiles", { _ids: ids });
        const map = new Map((ps ?? []).map((p) => [p.id, p]));
        list.forEach((m) => { const p = map.get(m.user_id); if (p) { m.username = p.username; m.level = p.level; } });
      }
      setMessages(list);
    })();
    const channel = supabase.channel("global-chat").on("postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: "channel=eq.global" },
      async (payload) => {
        const m = payload.new as Msg;
        const { data: ps } = await supabase.rpc("get_public_profiles", { _ids: [m.user_id] });
        const p = ps?.[0];
        setMessages((prev) => [...prev.slice(-100), { ...m, username: p?.username, level: p?.level }]);
      }
    ).subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    if (text.length > 300) { toast.error("Message too long (max 300)"); return; }
    if (Date.now() - lastSent < 1000) { toast.error("Slow down!"); return; }
    setLastSent(Date.now());
    const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, channel: "global", message: text.trim() });
    if (error) toast.error(error.message);
    else { setText(""); supabase.rpc("progress_quest", { _action_type: "chat_public", _amount: 1 }).then(() => {}); }

  };

  return (
    <div className="chrome-panel flex h-64 flex-col p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Global chat</div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <span className="text-primary font-semibold">{m.username ?? "…"}</span>
            {typeof m.level === "number" && <span className="rounded bg-muted px-1 text-xs">Lv{m.level}</span>}
            <span>{m.message}</span>
          </div>
        ))}
        {!messages.length && <div className="text-xs text-muted-foreground">Be the first to say hi.</div>}
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={profile?.is_muted ? "You are muted" : "Say something…"}
          disabled={profile?.is_muted}
          maxLength={300}
          className="flex-1 rounded-full border-2 border-border bg-input px-3 py-1 text-sm outline-none focus:border-primary"
        />
        <button className="btn-plastic text-sm">Send</button>
      </form>
    </div>
  );
}
