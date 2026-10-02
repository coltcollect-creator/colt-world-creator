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
  { level: 1, xp_required: 0, reward_type: "none", reward_value: 0 },
  { level: 2, xp_required: 100, reward_type: "none", reward_value: 0 },
  { level: 3, xp_required: 250, reward_type: "none", reward_value: 0 },
  { level: 4, xp_required: 450, reward_type: "none", reward_value: 0 },
  { level: 5, xp_required: 700, reward_type: "title", reward_value: "אספן מתקדם", reward_title_text: "אספן מתקדם", reward_label: "👑 תואר: אספן מתקדם" },
  { level: 6, xp_required: 1050, reward_type: "none", reward_value: 0 },
  { level: 7, xp_required: 1500, reward_type: "none", reward_value: 0 },
  { level: 8, xp_required: 2100, reward_type: "title", reward_value: "צייד קלפים", reward_title_text: "צייד קלפים", reward_label: "👑 תואר: צייד קלפים" },
  { level: 9, xp_required: 2800, reward_type: "none", reward_value: 0 },
  { level: 10, xp_required: 3650, reward_type: "title", reward_value: "מאסטר אספנים", reward_title_text: "מאסטר אספנים", reward_label: "👑 תואר: מאסטר אספנים" },
];

const LOCAL_LEVELS_STORAGE_KEY = "colt_admin_level_milestones_v1";

export function formatRewardLabel(m: LevelMilestone): string | undefined {
  if (m.reward_type === "none" || !m.reward_type) {
    return undefined;
  }
  if (m.reward_type === "credits") {
    const val = Number(m.reward_value) || 0;
    return val > 0 ? `💎 ${val} ג'מים` : undefined;
  }
  if (m.reward_type === "title") {
    const t = m.reward_title_text || m.reward_value;
    return t ? `👑 תואר: ${t}` : undefined;
  }
  if (m.reward_type === "cosmetic") {
    return `👕 פריט לבוש ייחודי`;
  }
  return undefined;
}

/**
 * Returns current level milestones from game_settings or default baseline.
 */
export function getLevelMilestones(): LevelMilestone[] {
  try {
    // 1. Check local storage cache
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(LOCAL_LEVELS_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: LevelMilestone) => ({ ...m, reward_label: formatRewardLabel(m) })).sort((a: LevelMilestone, b: LevelMilestone) => a.level - b.level);
        }
      }
    }

    // 2. Check gameDataStore
    const settings =
      gameDataStore.getById("game_settings", 1) ||
      gameDataStore.getById("game_settings", "1") ||
      gameDataStore.getAll("game_settings")?.[0];
    if (settings?.level_rewards && Array.isArray(settings.level_rewards) && settings.level_rewards.length > 0) {
      return [...settings.level_rewards]
        .map((m) => ({ ...m, reward_label: formatRewardLabel(m) }))
        .sort((a, b) => a.level - b.level);
    }
  } catch {}
  return [...DEFAULT_LEVELS].map((m) => ({ ...m, reward_label: formatRewardLabel(m) })).sort((a, b) => a.level - b.level);
}

export function saveLocalLevelMilestones(milestones: LevelMilestone[]) {
  if (typeof window === "undefined") return;
  try {
    const formatted = milestones.map((m) => ({ ...m, reward_label: formatRewardLabel(m) })).sort((a, b) => a.level - b.level);
    localStorage.setItem(LOCAL_LEVELS_STORAGE_KEY, JSON.stringify(formatted));
    window.dispatchEvent(new CustomEvent("colt-levels-updated", { detail: formatted }));
  } catch {}
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

  const rawNext = currentIdx + 1 < milestones.length ? milestones[currentIdx + 1] : null;
  const nextMilestone = rawNext ? { ...rawNext, reward_label: formatRewardLabel(rawNext) } : null;
  const currentMilestone = {
    ...(milestones[currentIdx] || milestones[0] || {
      level: 1,
      xp_required: 0,
      reward_type: "none" as const,
      reward_value: 0,
    }),
    reward_label: formatRewardLabel(milestones[currentIdx] || milestones[0]),
  };

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
