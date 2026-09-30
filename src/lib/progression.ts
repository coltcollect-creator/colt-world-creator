import { gameDataStore } from "./gameDataStore";
import { cleanForFirestore, notifyTableChange } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import confetti from "canvas-confetti";
import { toast } from "sonner";

export type LevelMilestone = {
  level: number;
  xp_required: number;
  reward_type: "credits" | "title" | "cosmetic" | "none";
  reward_value: number | string;
  reward_title_text?: string;
  reward_label?: string;
};

export const DEFAULT_LEVELS: LevelMilestone[] = [
  { level: 1, xp_required: 0, reward_type: "none", reward_value: 0, reward_label: "נקודת התחלה" },
  { level: 2, xp_required: 100, reward_type: "credits", reward_value: 10, reward_label: "💎 10 ג'מים" },
  { level: 3, xp_required: 250, reward_type: "credits", reward_value: 15, reward_label: "💎 15 ג'מים" },
  { level: 4, xp_required: 450, reward_type: "title", reward_value: "חוקר יריד", reward_title_text: "חוקר יריד", reward_label: "👑 תואר: חוקר יריד" },
  { level: 5, xp_required: 700, reward_type: "credits", reward_value: 25, reward_label: "💎 25 ג'מים" },
  { level: 6, xp_required: 1050, reward_type: "credits", reward_value: 30, reward_label: "💎 30 ג'מים" },
  { level: 7, xp_required: 1500, reward_type: "credits", reward_value: 40, reward_label: "💎 40 ג'מים" },
  { level: 8, xp_required: 2100, reward_type: "title", reward_value: "צייד קלפים", reward_title_text: "צייד קלפים", reward_label: "👑 תואר: צייד קלפים" },
  { level: 9, xp_required: 2800, reward_type: "credits", reward_value: 50, reward_label: "💎 50 ג'מים" },
  { level: 10, xp_required: 3650, reward_type: "credits", reward_value: 100, reward_label: "💎 100 ג'מים + 🏆 תואר מאסטר" },
  { level: 11, xp_required: 4650, reward_type: "credits", reward_value: 60, reward_label: "💎 60 ג'מים" },
  { level: 12, xp_required: 5800, reward_type: "credits", reward_value: 70, reward_label: "💎 70 ג'מים" },
  { level: 13, xp_required: 7100, reward_type: "title", reward_value: "אביר האספנים", reward_title_text: "אביר האספנים", reward_label: "👑 תואר: אביר האספנים" },
  { level: 14, xp_required: 8600, reward_type: "credits", reward_value: 85, reward_label: "💎 85 ג'מים" },
  { level: 15, xp_required: 10300, reward_type: "credits", reward_value: 120, reward_label: "💎 120 ג'מים" },
  { level: 16, xp_required: 12200, reward_type: "credits", reward_value: 100, reward_label: "💎 100 ג'מים" },
  { level: 17, xp_required: 14300, reward_type: "credits", reward_value: 110, reward_label: "💎 110 ג'מים" },
  { level: 18, xp_required: 16600, reward_type: "title", reward_value: "אגדת COLT", reward_title_text: "אגדת COLT", reward_label: "👑 תואר: אגדת COLT" },
  { level: 19, xp_required: 19100, reward_type: "credits", reward_value: 150, reward_label: "💎 150 ג'מים" },
  { level: 20, xp_required: 22000, reward_type: "credits", reward_value: 250, reward_label: "💎 250 ג'מים + 👑 תואר עליון" },
];

/**
 * Returns current level milestones from game_settings or default baseline.
 */
export function getLevelMilestones(): LevelMilestone[] {
  try {
    const settings = gameDataStore.getById("game_settings", 1) || gameDataStore.getById("game_settings", "1");
    if (settings?.level_rewards && Array.isArray(settings.level_rewards) && settings.level_rewards.length > 0) {
      return [...settings.level_rewards].sort((a, b) => a.level - b.level);
    }
  } catch {}
  return [...DEFAULT_LEVELS].sort((a, b) => a.level - b.level);
}

/**
 * Calculates what level corresponds to the given total XP.
 */
export function calculateLevel(xp: number, customMilestones?: LevelMilestone[]): number {
  const milestones = (customMilestones || getLevelMilestones()).slice().sort((a, b) => a.level - b.level);
  const currentXp = Math.max(0, Number(xp) || 0);
  let lvl = 1;
  for (const m of milestones) {
    if (currentXp >= Number(m.xp_required || 0)) {
      lvl = m.level;
    } else {
      break;
    }
  }
  return lvl;
}

/**
 * Detailed progress information for UI meters, progress bars, and tooltips.
 */
export function getLevelProgress(xp: number, customMilestones?: LevelMilestone[]) {
  const milestones = (customMilestones || getLevelMilestones()).slice().sort((a, b) => a.level - b.level);
  const currentXp = Math.max(0, Number(xp) || 0);

  let currentIdx = 0;
  for (let i = 0; i < milestones.length; i++) {
    if (currentXp >= Number(milestones[i].xp_required || 0)) {
      currentIdx = i;
    } else {
      break;
    }
  }

  const currentMilestone = milestones[currentIdx] || milestones[0] || {
    level: 1,
    xp_required: 0,
    reward_type: "none" as const,
    reward_value: 0,
  };
  const nextMilestone = currentIdx + 1 < milestones.length ? milestones[currentIdx + 1] : null;

  const currentLevel = currentMilestone.level;
  const currentLevelXp = Number(currentMilestone.xp_required || 0);
  const nextLevelXp = nextMilestone ? Number(nextMilestone.xp_required || 0) : currentLevelXp;
  const isMaxLevel = !nextMilestone;

  const xpInCurrentLevel = Math.max(0, currentXp - currentLevelXp);
  const xpNeededForNext = nextMilestone ? Math.max(1, nextLevelXp - currentLevelXp) : 0;
  const remainingXp = nextMilestone ? Math.max(0, nextLevelXp - currentXp) : 0;
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeededForNext) * 100)));

  return {
    currentLevel,
    currentMilestone,
    nextMilestone,
    currentLevelXp,
    nextLevelXp,
    currentXp,
    xpInCurrentLevel,
    xpNeededForNext,
    remainingXp,
    progressPercent,
    isMaxLevel,
  };
}

export type LevelRewardSummary = {
  level: number;
  type: "credits" | "title" | "cosmetic" | "none";
  value: number | string;
  label?: string;
};

/**
 * Checks if a user's XP qualifies them for level up(s), applies rewards,
 * updates profile, syncs with Firestore, and fires celebration events.
 */
export async function checkAndApplyLevelUp(
  userId: string,
  targetXp?: number,
  options?: { silent?: boolean }
): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  rewards: LevelRewardSummary[];
  newCredits: number;
  newXp: number;
}> {
  const prof = gameDataStore.getById("profiles", userId);
  if (!prof) {
    return { leveledUp: false, oldLevel: 1, newLevel: 1, rewards: [], newCredits: 0, newXp: 0 };
  }

  const milestones = getLevelMilestones();
  const currentXp = Math.max(0, targetXp !== undefined ? Number(targetXp) : Number(prof.xp || 0));
  const oldLevel = Number(prof.level || 1);
  const newLevel = calculateLevel(currentXp, milestones);

  let currentCredits = Number(prof.credits || 0);
  const rewardsGranted: LevelRewardSummary[] = [];

  if (newLevel > oldLevel) {
    // Process all level milestones crossed
    for (const m of milestones) {
      if (m.level > oldLevel && m.level <= newLevel) {
        if (m.reward_type === "credits" && Number(m.reward_value) > 0) {
          const gemAmount = Number(m.reward_value);
          currentCredits += gemAmount;
          rewardsGranted.push({
            level: m.level,
            type: "credits",
            value: gemAmount,
            label: m.reward_label || `💎 ${gemAmount} ג'מים`,
          });

          // Log transaction
          const txId = crypto.randomUUID();
          gameDataStore.upsertRow("credit_transactions", {
            id: txId,
            user_id: userId,
            amount: gemAmount,
            balance_before: currentCredits - gemAmount,
            balance_after: currentCredits,
            transaction_type: "level_reward",
            description: `פרס עליית רמה: הגעה לרמה ${m.level}`,
            created_at: new Date().toISOString(),
          });
        } else if (m.reward_type === "title" && m.reward_value) {
          const titleName = String(m.reward_title_text || m.reward_value);
          const slug = titleName.toLowerCase().replace(/\s+/g, "-");
          let existingTitle = gameDataStore.getTable("titles").find((t) => t.name === titleName || t.slug === slug);
          if (!existingTitle) {
            existingTitle = {
              id: `title-${slug}`,
              name: titleName,
              slug,
              description: `תואר כבוד על הגעה לרמה ${m.level}`,
              unlock_rule: "level",
              level_requirement: m.level,
              active: true,
              created_at: new Date().toISOString(),
            };
            gameDataStore.upsertRow("titles", existingTitle);
          }

          const ptId = `${userId}_${existingTitle.id}`;
          gameDataStore.upsertRow("player_titles", {
            id: ptId,
            user_id: userId,
            title_id: existingTitle.id,
            acquired_at: new Date().toISOString(),
          });

          rewardsGranted.push({
            level: m.level,
            type: "title",
            value: titleName,
            label: `👑 תואר: ${titleName}`,
          });
        } else if (m.reward_type === "cosmetic" && m.reward_value) {
          const cosId = String(m.reward_value);
          const pcId = `${userId}_${cosId}`;
          gameDataStore.upsertRow("player_cosmetics", {
            id: pcId,
            user_id: userId,
            cosmetic_id: cosId,
            acquired_at: new Date().toISOString(),
            source: `level_${m.level}`,
          });
          rewardsGranted.push({
            level: m.level,
            type: "cosmetic",
            value: cosId,
            label: `👕 פריט מיוחד לרמה ${m.level}`,
          });
        }
      }
    }

    // Update profile in store
    const updated = gameDataStore.updateRow("profiles", userId, {
      level: newLevel,
      xp: currentXp,
      credits: currentCredits,
    });
    notifyTableChange("profiles", "UPDATE", updated || { ...prof, level: newLevel, xp: currentXp, credits: currentCredits });

    // Sync to Firestore
    try {
      const docRef = doc(db, "profiles", userId);
      setDoc(
        docRef,
        cleanForFirestore({
          level: newLevel,
          xp: currentXp,
          credits: currentCredits,
          updated_at: new Date().toISOString(),
        }),
        { merge: true }
      ).catch(() => {});
    } catch {}

    // Dispatch global events
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("level-up", {
          detail: {
            userId,
            oldLevel,
            newLevel,
            rewards: rewardsGranted,
            newXp: currentXp,
            currentCredits,
          },
        })
      );
      window.dispatchEvent(new CustomEvent("credits-changed"));
      window.dispatchEvent(new CustomEvent("xp-changed", { detail: { xp: currentXp, level: newLevel } }));

      if (!options?.silent) {
        try {
          confetti({
            particleCount: 160,
            spread: 90,
            origin: { x: 0.5, y: 0.4 },
            colors: ["#f59e0b", "#fbbf24", "#e11d48", "#38bdf8", "#a855f7"],
          });
        } catch {}

        const rewardText = rewardsGranted.map((r) => r.label).filter(Boolean).join(" · ");
        toast.success(`🎉 מזל טוב! עלית לרמה ${newLevel}! ⭐`, {
          description: rewardText ? `פרסים שהרווחת: ${rewardText}` : `הגעת לרמה ${newLevel} בעולם של COLT!`,
          duration: 7000,
        });
      }
    }

    return {
      leveledUp: true,
      oldLevel,
      newLevel,
      rewards: rewardsGranted,
      newCredits,
      newXp: currentXp,
    };
  }

  // If level in DB was out of sync (e.g. higher or lower without leveling up now)
  if (oldLevel !== newLevel || prof.xp !== currentXp) {
    const updated = gameDataStore.updateRow("profiles", userId, {
      level: newLevel,
      xp: currentXp,
    });
    notifyTableChange("profiles", "UPDATE", updated || { ...prof, level: newLevel, xp: currentXp });
    try {
      setDoc(
        doc(db, "profiles", userId),
        cleanForFirestore({ level: newLevel, xp: currentXp, updated_at: new Date().toISOString() }),
        { merge: true }
      ).catch(() => {});
    } catch {}
  }

  return {
    leveledUp: false,
    oldLevel,
    newLevel,
    rewards: [],
    newCredits: currentCredits,
    newXp: currentXp,
  };
}

/**
 * Convenience helper to grant XP to a player and trigger level up logic.
 */
export async function addPlayerXp(
  userId: string,
  xpToAdd: number,
  reason?: string
) {
  const prof = gameDataStore.getById("profiles", userId);
  const currentXp = Math.max(0, Number(prof?.xp || 0));
  const newXp = currentXp + Math.max(0, Number(xpToAdd) || 0);

  const res = await checkAndApplyLevelUp(userId, newXp);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("xp-changed", { detail: { xp: newXp, level: res.newLevel, added: xpToAdd, reason } }));
  }

  return res;
}
