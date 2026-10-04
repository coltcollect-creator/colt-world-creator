import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { trackQuestAction } from "@/lib/quest-events";

type Msg = { id: string; user_id: string; message: string; created_at: string; username?: string; level?: number };

export function GlobalChat() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const lastSent = useRef(0);
  const lastDayRef = useRef(new Date().toDateString());

  useEffect(() => {
    let cancelled = false;

    const getTodayMidnightIso = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    };

    (async () => {
      const cutoff = getTodayMidnightIso();
      const { data } = await supabase.from("chat_messages")
        .select("id,user_id,message,created_at")
        .eq("channel", "global")
        .eq("deleted", false)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      const list = (data as Msg[]).reverse();
      // enrich with usernames
      const ids = Array.from(new Set(list.map((m) => m.user_id)));
      if (ids.length) {
        const { data: ps } = await supabase.rpc("get_public_profiles", { _ids: ids });
        const map = new Map((ps ?? []).map((p) => [p.id, p]));
        list.forEach((m) => { const p = map.get(m.user_id); if (p) { m.username = p.username; m.level = p.level; } });
      }
      const seen = new Set<string>();
      const uniqueList = list.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      setMessages(uniqueList);

      // Clean up old messages older than today in background so table stays lean
      supabase.from("chat_messages").delete().lt("created_at", cutoff).then(() => {});
    })();

    // Gentle periodic check every 2 hours for daily chat reset
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const midnightInterval = setInterval(() => {
      const now = new Date();
      const currentDay = now.toDateString();
      if (lastDayRef.current !== currentDay) {
        lastDayRef.current = currentDay;
        setMessages([]);
        const newCutoff = getTodayMidnightIso();
        supabase.from("chat_messages").delete().lt("created_at", newCutoff).then(() => {});
      }
    }, TWO_HOURS_MS);
    const channel = supabase.channel("global-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "channel=eq.global" },
        async (payload) => {
          const m = payload.new as Msg;
          if ((m as any)?.deleted) return;
          const { data: ps } = await supabase.rpc("get_public_profiles", { _ids: [m.user_id] });
          const p = ps?.[0];
          setMessages((prev) => {
            const exists = prev.some((item) => item.id === m.id);
            if (exists) {
              return prev.map((item) =>
                item.id === m.id
                  ? { ...item, username: p?.username ?? item.username, level: p?.level ?? item.level }
                  : item
              );
            }
            return [...prev.slice(-100), { ...m, username: p?.username, level: p?.level }];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: "channel=eq.global" },
        (payload) => {
          const m = payload.new as any;
          if (m?.deleted) {
            setMessages((prev) => prev.filter((item) => item.id !== m.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const oldId = payload.old?.id;
          if (oldId) {
            setMessages((prev) => prev.filter((item) => item.id !== oldId));
          }
        }
      )
      .subscribe();

    const handleCustomTableChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.table === "chat_messages") {
        if (detail.eventType === "DELETE" && detail.old?.id) {
          setMessages((prev) => prev.filter((item) => item.id !== detail.old.id));
        } else if (detail.eventType === "UPDATE" && detail.new?.deleted) {
          setMessages((prev) => prev.filter((item) => item.id !== detail.new.id));
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("colt_table_change", handleCustomTableChange);
    }

    return () => {
      cancelled = true;
      clearInterval(midnightInterval);
      supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("colt_table_change", handleCustomTableChange);
      }
    };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    if (text.length > 300) { toast.error("Message too long (max 300)"); return; }
    if (Date.now() - lastSent.current < 1000) { toast.error("Slow down!"); return; }
    lastSent.current = Date.now();
    const msgText = text.trim();
    setText("");

    // Optimistically show message immediately in chat box
    const optimisticMsg: Msg = {
      id: crypto.randomUUID(),
      user_id: user.id,
      message: msgText,
      created_at: new Date().toISOString(),
      username: profile?.username || "You",
      level: profile?.level || 1,
    };
    setMessages((prev) => [...prev.slice(-100), optimisticMsg]);

    // Dispatch event for floating bubble above character's head
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("colt-chat-bubble", {
        detail: { userId: user.id, message: msgText }
      }));
    }
    trackQuestAction("send_chat", 1);

    const { error } = await supabase.from("chat_messages").insert({
      id: optimisticMsg.id,
      user_id: user.id,
      channel: "global",
      message: msgText,
      deleted: false,
      created_at: optimisticMsg.created_at,
    });
    if (error) {
      toast.error(error.message);
    } else {
      supabase.rpc("progress_quest", { _action_type: "chat_public", _amount: 1 }).then(() => {});
    }
  };

  return (
    <div className="chrome-panel flex h-64 flex-col p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Global chat</div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {messages.map((m, idx) => (
          <div key={m.id || `msg-${idx}`} className="flex gap-2">
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
