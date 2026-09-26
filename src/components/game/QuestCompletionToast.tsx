import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Subscribes to the current user's player_quests and shows celebratory toasts
 * when a quest is completed or claimed.
 */
export function QuestCompletionToast() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seenCompleted = useRef<Set<string>>(new Set());
  const seenClaimed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const notify = async (row: { id: string; quest_id: string; progress: number; completed_at: string | null; claimed_at: string | null }) => {
      const { data: q } = await supabase.from("quests").select("name, credit_reward, xp_reward, target_amount").eq("id", row.quest_id).maybeSingle();
      if (!q) return;
      if (row.completed_at && !row.claimed_at && !seenCompleted.current.has(row.id)) {
        seenCompleted.current.add(row.id);
        confetti({ particleCount: 80, spread: 70, origin: { x: 0.85, y: 0.2 }, colors: ["#f472b6", "#a78bfa", "#38bdf8", "#facc15"] });
        toast.success(`🎉 השלמת משימה: ${q.name}`, {
          description: `לחצו על טאב המשימות לקבלת ${q.credit_reward} 💎 + ${q.xp_reward} XP`,
          duration: 6000,
        });
      }
      if (row.claimed_at && !seenClaimed.current.has(row.id)) {
        seenClaimed.current.add(row.id);
        confetti({ particleCount: 120, spread: 100, origin: { x: 0.85, y: 0.2 }, colors: ["#fde047", "#f59e0b", "#ec4899"] });
        toast.success(`💎 +${q.credit_reward} קרדיטים!`, {
          description: `פרס עבור: ${q.name}`,
          duration: 5000,
        });
        qc.invalidateQueries({ queryKey: ["profile"] });
      }
    };

    // Preload existing state so we don't renotify past events
    supabase.from("player_quests").select("id, quest_id, progress, completed_at, claimed_at").eq("user_id", user.id).then(({ data }) => {
      for (const r of data ?? []) {
        if (r.completed_at) seenCompleted.current.add(r.id);
        if (r.claimed_at) seenClaimed.current.add(r.id);
      }
    });

    const ch = supabase
      .channel(`pq-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_quests", filter: `user_id=eq.${user.id}` }, (payload) => {
        const row = payload.new as { id: string; quest_id: string; progress: number; completed_at: string | null; claimed_at: string | null } | undefined;
        if (row) void notify(row);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return null;
}
