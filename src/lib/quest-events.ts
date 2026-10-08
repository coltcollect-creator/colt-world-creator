import { supabase } from "@/integrations/supabase/client";
import { addPlayerXp } from "@/lib/progression";

export type QuestProgressEvent = {
  questId: string;
  questName: string;
  currentProgress: number;
  targetAmount: number;
  isCompleted: boolean;
  creditReward: number;
  xpReward: number;
  gemsReward: number;
};

type QuestListener = (event: QuestProgressEvent) => void;
const listeners = new Set<QuestListener>();

export function onQuestProgress(fn: QuestListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const visitedStoresInSession = new Set<string>();

/**
 * Tracks a player quest action and triggers game HUD toasts & DB updates.
 */
export async function trackQuestAction(
  actionKey: string,
  amount = 1,
  meta?: { storeId?: string; npcId?: string; mapId?: string }
) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;

    // Guard unique store visits per session for "visit_stores"
    if (actionKey === "visit_stores" && meta?.storeId) {
      if (visitedStoresInSession.has(meta.storeId)) return;
      visitedStoresInSession.add(meta.storeId);
    }

    // Find active quests matching this action_type or slug/keyword
    const { data: quests = [] } = await supabase
      .from("quests")
      .select("*")
      .eq("active", true);

    const matchingQuests = (quests ?? []).filter((q) => {
      const type = (q.quest_type || "").toLowerCase();
      const action = (q.action_type || "").toLowerCase();
      const slug = (q.slug || "").toLowerCase();
      const name = (q.name || "").toLowerCase();
      const desc = (q.description || "").toLowerCase();

      if (actionKey === "visit_stores" || actionKey === "visit_store") {
        return action === "visit_store" || name.includes("חנות") || name.includes("חנויות") || desc.includes("חנות") || type.includes("store");
      }
      if (actionKey === "visit_npc") {
        return action === "visit_npc" || name.includes("npc") || name.includes("מדריך") || desc.includes("npc");
      }
      if (actionKey === "spin_wheel") {
        return action === "spin_wheel" || name.includes("גלגל") || name.includes("מזל") || desc.includes("גלגל");
      }
      if (actionKey === "open_mystery") {
        return action === "open_mystery" || name.includes("מסתורין") || name.includes("קופסא") || desc.includes("קופס");
      }
      if (actionKey === "send_chat" || actionKey === "chat") {
        return action === "chat" || name.includes("צ'אט") || name.includes("הודעה") || name.includes("שלום") || desc.includes("שוחח") || desc.includes("הודע");
      }
      if (actionKey === "find_clue") {
        return action === "find_clue" || name.includes("רמז") || name.includes("אוצר") || desc.includes("רמז");
      }
      if (actionKey === "login") {
        return (action === "login" || slug.includes("login")) && (name.includes("התחברות") || desc.includes("התחברו") || slug.includes("login"));
      }
      if (actionKey === "purchase") {
        return action === "purchase" || name.includes("קנייה") || name.includes("רכישה") || desc.includes("קנו");
      }
      if (actionKey === "equip") {
        return action === "equip" || name.includes("עיצוב") || name.includes("סגנון") || desc.includes("לבשו");
      }
      return action === actionKey;
    });

    for (const q of matchingQuests) {
      const qId = q.id;
      const target = Number(q.target_amount) || 1;

      // Check localStorage first for instant guard
      const isAlreadySavedCompleted = typeof window !== "undefined" && Boolean(localStorage.getItem(`colt_quest_done_${user.id}_${qId}`));
      if (isAlreadySavedCompleted && q.quest_type !== "daily") {
        continue;
      }

      // Fetch or initialize player progress
      const { data: existingList } = await supabase
        .from("player_quests")
        .select("*")
        .eq("user_id", user.id)
        .eq("quest_id", qId)
        .limit(1);

      const existing = existingList?.[0];
      const prevProg = Number(existing?.progress) || 0;
      if (existing?.claimed_at || existing?.completed_at || (prevProg >= target && q.quest_type !== "daily")) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`colt_quest_done_${user.id}_${qId}`, "1");
        }
        continue; // Already completed & claimed or done
      }

      const isDaily = q.quest_type === "daily" || actionKey === "login" || (q.name || "").includes("יומי") || (q.name || "").includes("התחברות");
      const todayStr = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      let newProg = prevProg;

      if (isDaily && actionKey === "login") {
        // If already recorded today, do nothing!
        if (existing?.period_key === todayStr) {
          continue;
        }
        // If yesterday was the last login date, advance streak
        if (existing?.period_key === yesterday) {
          newProg = Math.min(target, prevProg + 1);
        } else {
          // Missed a day (or first time) -> reset streak to 1
          newProg = 1;
        }
      } else {
        newProg = Math.min(target, prevProg + amount);
      }

      if (newProg === prevProg && existing && existing.period_key === todayStr) {
        continue;
      }

      const isNewlyCompleted = !existing?.completed_at && newProg >= target;
      const creditReward = Number(q.credit_reward ?? q.gems_reward ?? 0);
      const xpReward = Number(q.xp_reward ?? 0);

      await supabase.from("player_quests").upsert({
        id: existing?.id || `${user.id}_${qId}`,
        user_id: user.id,
        quest_id: qId,
        progress: newProg,
        completed_at: isNewlyCompleted ? new Date().toISOString() : (existing?.completed_at || null),
        claimed_at: existing?.claimed_at || null,
        period_key: isDaily ? todayStr : (q.quest_type === "daily" ? todayStr : "once"),
        updated_at: new Date().toISOString(),
      });

      // Notify HUD listeners
      const ev: QuestProgressEvent = {
        questId: qId,
        questName: q.name || "משימה",
        currentProgress: newProg,
        targetAmount: target,
        isCompleted: isNewlyCompleted,
        creditReward,
        xpReward,
        gemsReward: creditReward,
      };

      listeners.forEach((fn) => fn(ev));

      // Dispatch global window event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("quest-updated", { detail: ev }));
      }
    }
  } catch (err) {
    console.warn("Error tracking quest action:", err);
  }
}
