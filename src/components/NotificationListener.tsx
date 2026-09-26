import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const ICONS: Record<string, string> = {
  auction_outbid: "🔨",
  auction_won: "🏆",
  live_rip_closed: "📦",
  info: "🔔",
};

function show(n: Notification, onSeen: (id: string) => void) {
  toast.custom(
    (id) => (
      <div className="chrome-panel flex w-[340px] max-w-[92vw] items-start gap-3 p-3 text-right" dir="rtl">
        {n.image_url ? (
          <img src={n.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-contain" />
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-muted text-3xl">
            {ICONS[n.kind] ?? ICONS.info}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-black leading-tight">{n.title}</div>
          {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
          {n.link && (
            <a href={n.link} className="mt-1 inline-block text-xs font-bold text-primary underline">
              צפייה
            </a>
          )}
        </div>
        <button
          onClick={() => {
            toast.dismiss(id);
          }}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs"
          aria-label="סגירה"
        >
          ✕
        </button>
      </div>
    ),
    { duration: n.kind === "auction_won" ? 15000 : 9000, position: "top-right" },
  );
  onSeen(n.id);
}

/** Global listener that surfaces player notifications (auction outbid / win) anywhere in the app. */
export function NotificationListener() {
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const markRead = async (id: string) => {
      await supabase.from("player_notifications").update({ read: true }).eq("id", id);
    };

    const handle = (n: Notification) => {
      if (cancelled || seen.current.has(n.id)) return;
      seen.current.add(n.id);
      show(n, markRead);
      refreshProfile();
      qc.invalidateQueries({ queryKey: ["inventory"] });
    };

    // Catch up on anything that arrived while the player was away.
    void (async () => {
      const { data } = await supabase
        .from("player_notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: true })
        .limit(5);
      for (const n of (data ?? []) as unknown as Notification[]) handle(n);
    })();

    const ch = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "player_notifications", filter: `user_id=eq.${user.id}` },
        (payload) => handle(payload.new as unknown as Notification),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user, qc, refreshProfile]);

  return null;
}
