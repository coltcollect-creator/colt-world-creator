import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : undefined }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { c } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: convs = [] } = useQuery({
    queryKey: ["my-conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_conversations")
        .select("id, subject, status, unread_user, last_message_at, store_id, npc_id")
        .eq("user_id", user!.id)
        .order("last_message_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: sysMsgs = [] } = useQuery({
    queryKey: ["system-messages", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_notifications")
        .select("id, title, body, link, read, created_at")
        .eq("user_id", user!.id)
        .eq("kind", "system")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const sysUnread = sysMsgs.filter((m) => !m.read).length;

  const activeId = c ?? (sysMsgs.length ? "system" : convs[0]?.id);
  const isSystem = activeId === "system";

  const { data: messages = [] } = useQuery({
    queryKey: ["conv-messages", activeId],
    enabled: !!activeId && !isSystem,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", activeId!)
        .order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!isSystem || !user || !sysUnread) return;
    supabase
      .from("player_notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("kind", "system")
      .eq("read", false)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["system-messages"] });
        qc.invalidateQueries({ queryKey: ["my-unread"] });
      });
  }, [isSystem, user, sysUnread, qc]);

  useEffect(() => {
    if (!activeId || isSystem || !user) return;
    supabase.from("store_conversations").update({ unread_user: 0 }).eq("id", activeId).eq("user_id", user.id).then(() => {
      qc.invalidateQueries({ queryKey: ["my-unread"] });
      qc.invalidateQueries({ queryKey: ["my-conversations"] });
    });
  }, [activeId, isSystem, user, qc, messages.length]);


  const send = async () => {
    if (!user || !activeId || !body.trim()) return;
    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: activeId, sender_id: user.id, sender_role: "user", body: body.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["conv-messages", activeId] });
    qc.invalidateQueries({ queryKey: ["my-conversations"] });
  };

  return (
    <div className="grid gap-3 md:grid-cols-[280px_1fr]">
      <div className="chrome-panel p-3">
        <h2 className="mb-2 text-lg font-bold">{t("msg.title")}</h2>
        <div className="space-y-1">
          {sysMsgs.length > 0 && (
            <button
              onClick={() => navigate({ search: { c: "system" } })}
              className={`w-full rounded-xl px-3 py-2 text-start text-sm ${isSystem ? "bg-primary/15 font-semibold" : "hover:bg-muted"}`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">📢 הודעות מהמערכת</span>
                {sysUnread > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{sysUnread}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">עדכונים רשמיים — ללא מענה</div>
            </button>
          )}
          {convs.map((c2) => (
            <button
              key={c2.id}
              onClick={() => navigate({ search: { c: c2.id } })}
              className={`w-full rounded-xl px-3 py-2 text-start text-sm ${activeId === c2.id ? "bg-primary/15 font-semibold" : "hover:bg-muted"}`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{c2.subject ?? (c2.store_id ? "Store" : "NPC")}</span>
                {c2.unread_user > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">{c2.unread_user}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">{t(`msg.status.${c2.status === "closed" ? "closed" : "open"}` as never)}</div>
            </button>
          ))}
          {!convs.length && !sysMsgs.length && <div className="p-2 text-xs text-muted-foreground">{t("msg.empty")}</div>}
        </div>
      </div>
      <div className="chrome-panel flex min-h-[60vh] flex-col p-3">
        {isSystem ? (
          <div className="flex-1 space-y-2 overflow-y-auto">
            <div className="mb-1 text-xs font-bold text-muted-foreground">📢 הודעות מהמערכת — הודעות אלו הן חד-כיווניות ואין אפשרות להשיב עליהן.</div>
            {sysMsgs.map((m) => (
              <div key={m.id} className="rounded-2xl border-2 border-primary/30 bg-muted/60 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">הודעה מהמערכת</span>
                  <span className="font-black">{m.title}</span>
                </div>
                {m.body && <div className="mt-1 whitespace-pre-wrap">{m.body}</div>}
                {m.link && <a href={m.link} className="mt-1 inline-block text-xs font-bold text-primary underline">צפייה</a>}
                <div className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
            {!sysMsgs.length && <div className="p-2 text-center text-xs text-muted-foreground">—</div>}
          </div>
        ) : activeId ? (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto pb-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === "owner" ? "bg-muted" : "ms-auto bg-primary text-primary-foreground"}`}>
                  {m.body}
                  <div className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</div>
                </div>
              ))}
              {!messages.length && <div className="p-2 text-center text-xs text-muted-foreground">—</div>}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("msg.write")}
                className="flex-1 rounded-full border-2 border-border bg-input px-4 py-2 text-sm"
              />
              <button className="btn-plastic" onClick={send}>{t("play.send")}</button>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">{t("msg.empty")}</div>
        )}

      </div>
    </div>
  );
}
