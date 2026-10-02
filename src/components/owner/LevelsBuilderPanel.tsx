import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, Sparkles, Award, Gift, Shield } from "lucide-react";
import { DEFAULT_LEVELS, saveLocalLevelMilestones, type LevelMilestone } from "@/lib/progression";
import { gameDataStore } from "@/lib/gameDataStore";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { cleanForFirestore, notifyTableChange } from "@/integrations/supabase/client";

export type { LevelMilestone };

export function LevelsBuilderPanel() {
  const qc = useQueryClient();
  const [levels, setLevels] = useState<LevelMilestone[]>(DEFAULT_LEVELS);
  const [saving, setSaving] = useState(false);

  // Fetch from DB if stored in game_settings or progression table
  const { data: storedLevels } = useQuery({
    queryKey: ["game-levels-progression"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_settings")
        .select("level_rewards")
        .eq("id", 1)
        .maybeSingle();
      if (data?.level_rewards && Array.isArray(data.level_rewards) && data.level_rewards.length > 0) {
        return data.level_rewards as LevelMilestone[];
      }
      return DEFAULT_LEVELS;
    },
  });

  useEffect(() => {
    if (storedLevels && storedLevels.length > 0) {
      setLevels(storedLevels);
    }
  }, [storedLevels]);

  const addLevel = () => {
    const nextLvl = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1;
    const lastXp = levels.length > 0 ? levels[levels.length - 1].xp_required : 0;
    const newLvl: LevelMilestone = {
      level: nextLvl,
      xp_required: lastXp + 3000,
      reward_type: "credits",
      reward_value: 50,
      reward_label: "💎 50 ג'מים",
    };
    setLevels([...levels, newLvl]);
  };

  const removeLevel = (lvlNum: number) => {
    if (lvlNum === 1) {
      toast.error("אי אפשר למחוק את רמה 1 (רמת בסיס)");
      return;
    }
    setLevels(levels.filter((l) => l.level !== lvlNum));
  };

  const updateLevel = (index: number, patch: Partial<LevelMilestone>) => {
    const next = [...levels];
    next[index] = { ...next[index], ...patch };
    setLevels(next);
  };

  const saveProgression = async () => {
    setSaving(true);
    try {
      // Sort by level
      const sorted = [...levels].sort((a, b) => a.level - b.level);

      // 1. Save locally and dispatch event
      saveLocalLevelMilestones(sorted);

      // 2. Update gameDataStore
      const currentSettings = gameDataStore.getById("game_settings", 1) || gameDataStore.getById("game_settings", "1") || { id: 1 };
      const updatedSettings = { ...currentSettings, level_rewards: sorted };
      gameDataStore.set("game_settings", updatedSettings);

      // 3. Update Firestore
      await setDoc(doc(db, "game_settings", "1"), cleanForFirestore(updatedSettings), { merge: true }).catch(() => {});
      notifyTableChange("game_settings");

      // 4. Update Supabase
      await supabase
        .from("game_settings")
        .update({ level_rewards: sorted })
        .eq("id", 1)
        .catch(() => {});

      toast.success("מערכת הרמות והפרסים נשמרה בהצלחה! 🏆");
      qc.invalidateQueries({ queryKey: ["game-levels-progression"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      window.dispatchEvent(new CustomEvent("colt-levels-updated", { detail: sorted }));
    } catch (err: any) {
      toast.error(err.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-4 text-start">
      <div className="chrome-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-black">
            <Award className="h-5 w-5 text-primary" />
            <span>בניית רמות והתקדמות שחקנים (Level Progression Builder)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            הגדירו עבור כל רמה כמה XP נדרש כדי לעלות אליה ואיזה פרס השחקן מקבל (ג'מים, תואר, סקין וכו').
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addLevel}
            className="btn-plastic flex items-center gap-1 text-xs font-bold py-2 px-3 bg-secondary text-secondary-foreground"
          >
            <Plus className="h-4 w-4" /> הוסף רמה
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={saveProgression}
            className="btn-plastic flex items-center gap-1 text-xs font-black py-2 px-4 bg-primary text-primary-foreground shadow-md hover:brightness-110"
          >
            <Save className="h-4 w-4" /> {saving ? "שומר…" : "שמור הגדרות רמות"}
          </button>
        </div>
      </div>

      <div className="chrome-panel p-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground text-start">
              <th className="p-2 w-16">רמה</th>
              <th className="p-2 w-32">XP נדרש</th>
              <th className="p-2 w-36">סוג פרס</th>
              <th className="p-2">פירוט פרס / תואר</th>
              <th className="p-2 w-20 text-center">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {levels.map((lvl, idx) => (
              <tr key={lvl.level} className="hover:bg-muted/30 transition-colors">
                <td className="p-2 font-black text-sm text-primary">Lv {lvl.level}</td>
                <td className="p-2">
                  <input
                    type="number"
                    value={lvl.xp_required}
                    onChange={(e) => updateLevel(idx, { xp_required: Number(e.target.value) || 0 })}
                    className="w-24 rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                  />
                </td>
                <td className="p-2">
                  <select
                    value={lvl.reward_type}
                    onChange={(e) =>
                      updateLevel(idx, {
                        reward_type: e.target.value as LevelMilestone["reward_type"],
                        reward_value: e.target.value === "credits" ? 25 : e.target.value === "title" ? "תואר חדש" : 0,
                      })
                    }
                    className="w-32 rounded-lg border border-border bg-input px-2 py-1 text-xs font-semibold"
                  >
                    <option value="credits">💎 ג'מים (Credits)</option>
                    <option value="title">👑 תואר (Title)</option>
                    <option value="cosmetic">👕 פריט לבוש / סקין</option>
                    <option value="none">ללא פרס</option>
                  </select>
                </td>
                <td className="p-2">
                  {lvl.reward_type === "credits" ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">כמות ג'מים:</span>
                      <input
                        type="number"
                        value={Number(lvl.reward_value) || 0}
                        onChange={(e) => updateLevel(idx, { reward_value: Number(e.target.value) || 0 })}
                        className="w-20 rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold text-primary"
                      />
                    </div>
                  ) : lvl.reward_type === "title" ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">שם התואר:</span>
                      <input
                        type="text"
                        value={String(lvl.reward_value || "")}
                        onChange={(e) => updateLevel(idx, { reward_value: e.target.value, reward_title_text: e.target.value })}
                        placeholder="לדוגמה: מאסטר אספנים"
                        className="w-48 rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                      />
                    </div>
                  ) : lvl.reward_type === "cosmetic" ? (
                    <input
                      type="text"
                      value={String(lvl.reward_value || "")}
                      onChange={(e) => updateLevel(idx, { reward_value: e.target.value })}
                      placeholder="מזהה פריט קוסמטיקה"
                      className="w-48 rounded-lg border border-border bg-input px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {lvl.level > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLevel(lvl.level)}
                      className="rounded-lg p-1 text-destructive hover:bg-destructive/10"
                      title="מחק רמה"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
