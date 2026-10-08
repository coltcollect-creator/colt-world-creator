import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ARCADE_MINIGAMES, type ArcadeMinigameDef } from "@/lib/npcs-system";
import { CatchCardGameModal } from "@/components/game/minigames/CatchCardGameModal";
import { PackRipPrecisionModal } from "@/components/game/minigames/PackRipPrecisionModal";
import { GradingMasherModal } from "@/components/game/minigames/GradingMasherModal";
import { Trophy, Play, Trash2, RotateCcw, Sparkles, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";

interface GameStatusConfig {
  [gameId: string]: {
    active: boolean;
    name?: string;
  };
}

export function MinigamesAdminPanel() {
  const qc = useQueryClient();
  const [testingGame, setTestingGame] = useState<"catch_card" | "pack_rip" | "grading_masher" | null>(null);
  const [resettingGame, setResettingGame] = useState<string | null>(null);

  // Load minigames active configuration from Firestore
  const { data: gameConfigs = {}, refetch: refetchConfigs } = useQuery<GameStatusConfig>({
    queryKey: ["admin-minigames-status"],
    queryFn: async () => {
      try {
        const snap = await getDoc(doc(db, "system_settings", "minigames_status"));
        if (snap.exists()) {
          return snap.data() as GameStatusConfig;
        }
      } catch (err) {
        console.warn("Could not fetch minigames_status:", err);
      }
      // default: all active
      return {
        catch_card: { active: true },
        pack_rip: { active: true },
        grading_masher: { active: true },
      };
    },
  });

  // Toggle Game Active/Disabled
  const handleToggleActive = async (gameId: string, currentActive: boolean) => {
    try {
      const nextActive = !currentActive;
      const updated = {
        ...gameConfigs,
        [gameId]: { active: nextActive },
      };
      await setDoc(doc(db, "system_settings", "minigames_status"), updated, { merge: true });
      toast.success(nextActive ? "המשחק הוגדר כפעיל לשחקנים!" : "המשחק הושבת זמנית לשחקנים");
      refetchConfigs();
    } catch (err: any) {
      toast.error(err?.message || "שגיאה בעדכון מצב המשחק");
    }
  };

  // Catch Card Leaderboard
  const { data: catchCardScores = [], refetch: refetchCatchScores } = useQuery({
    queryKey: ["admin-scores-catch-card"],
    queryFn: async () => {
      try {
        const snap = await getDocs(collection(db, "minigame_scores_catch_card"));
        const list: Array<{ id: string; username?: string; score: number; updated_at?: string }> = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as any));
        return list.sort((a, b) => (b.score || 0) - (a.score || 0));
      } catch {
        return [];
      }
    },
  });

  // Reset Leaderboard for a game
  const handleResetLeaderboard = async (collectionName: string, gameTitle: string) => {
    const confirmReset = window.confirm(`האם לאפס את טבלת הניקוד הגלובלית של "${gameTitle}"? פעולה זו תמחק את כל שיאי השחקנים.`);
    if (!confirmReset) return;

    setResettingGame(collectionName);
    try {
      const snap = await getDocs(collection(db, collectionName));
      const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      toast.success(`טבלת הניקוד של "${gameTitle}" אופסה בהצלחה! נמחקו ${snap.size} תוצאות.`);
      refetchCatchScores();
    } catch (err: any) {
      toast.error(err?.message || "שגיאה באיפוס טבלת הניקוד");
    } finally {
      setResettingGame(null);
    }
  };

  // Reset All minigame leaderboards
  const handleResetAllLeaderboards = async () => {
    const confirmAll = window.confirm("האם למחוק ולאפס את כל טבלאות הניקוד של כל משחקי הארקייד בעולם?");
    if (!confirmAll) return;

    try {
      const collections = ["minigame_scores_catch_card", "minigame_scores_pack_rip", "minigame_scores_grading"];
      let count = 0;
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        count += snap.size;
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      }
      toast.success(`כל טבלאות הניקוד אופסו בהצלחה! (נמחקו ${count} רשומות)`);
      refetchCatchScores();
    } catch (err: any) {
      toast.error(err?.message || "שגיאה באיפוס טבלאות");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Panel */}
      <div className="chrome-panel p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🕹️</span>
            <h2 className="text-lg font-black text-foreground">ניהול מיני-משחקי ארקייד</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            הגדרת זמינות משחקים לשחקנים, צפייה בשיאים, ואיפוס טבלאות ניקוד גלובליות
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleResetAllLeaderboards}
            variant="outline"
            className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-bold rounded-xl"
          >
            <Trash2 className="w-3.5 h-3.5 ml-1.5" /> איפוס כל טבלאות הניקוד
          </Button>
        </div>
      </div>

      {/* Grid of Minigames */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ARCADE_MINIGAMES.map((game) => {
          const cfg = gameConfigs[game.reference_id];
          const isActive = cfg ? cfg.active !== false : true;

          return (
            <div
              key={game.id}
              className={`chrome-panel p-4 flex flex-col justify-between border-2 transition-all ${
                isActive ? "border-primary/40 bg-card" : "border-muted bg-muted/20 opacity-80"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md"
                      style={{ backgroundColor: `${game.color}25`, border: `1px solid ${game.color}60` }}
                    >
                      {game.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">{game.name}</h3>
                      <span className="text-[10px] text-muted-foreground">{game.shortDesc}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {isActive ? "פעיל" : "מושבת"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {game.description}
                </p>

                {/* Active Toggle Switch */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>זמין למשחק במפה</span>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => handleToggleActive(game.reference_id, isActive)}
                  />
                </div>
              </div>

              {/* Actions & Preview */}
              <div className="pt-4 mt-4 border-t border-border/60 flex items-center gap-2">
                <Button
                  onClick={() => setTestingGame(game.reference_id as any)}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs rounded-xl"
                >
                  <Play className="w-3.5 h-3.5 ml-1.5" /> בדיקה / הפעלה
                </Button>

                {game.reference_id === "catch_card" && (
                  <Button
                    onClick={() => handleResetLeaderboard("minigame_scores_catch_card", game.name)}
                    disabled={resettingGame === "minigame_scores_catch_card"}
                    variant="outline"
                    className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs rounded-xl px-2.5"
                    title="איפוס טבלת ניקוד"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard Management Table */}
      <div className="chrome-panel p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>טבלת שיאים עולמית: תפוס את הקלף (Top Players)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">סה״כ שחקנים רשומים: {catchCardScores.length}</span>
            <Button
              onClick={() => handleResetLeaderboard("minigame_scores_catch_card", "תפוס את הקלף")}
              disabled={catchCardScores.length === 0}
              variant="outline"
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5 ml-1.5" /> איפוס טבלה זו
            </Button>
          </div>
        </div>

        {catchCardScores.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            אין כרגע תוצאות שמורות בטבלה.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="p-2">דירוג</th>
                  <th className="p-2">שם שחקן</th>
                  <th className="p-2">מזהה שחקן</th>
                  <th className="p-2 font-mono">ניקוד</th>
                  <th className="p-2">תאריך עדכון</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {catchCardScores.slice(0, 20).map((scoreItem, idx) => (
                  <tr key={scoreItem.id} className="hover:bg-muted/20">
                    <td className="p-2 font-bold font-mono">
                      {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                    </td>
                    <td className="p-2 font-bold text-foreground">
                      {scoreItem.username || "שחקן"}
                    </td>
                    <td className="p-2 font-mono text-[10px] text-muted-foreground">
                      {scoreItem.id}
                    </td>
                    <td className="p-2 font-mono font-black text-amber-400 text-sm">
                      {scoreItem.score}
                    </td>
                    <td className="p-2 text-[10px] text-muted-foreground font-mono">
                      {scoreItem.updated_at ? new Date(scoreItem.updated_at).toLocaleString("he-IL") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Game Modals for testing */}
      {testingGame === "catch_card" && (
        <CatchCardGameModal onClose={() => setTestingGame(null)} />
      )}
      {testingGame === "pack_rip" && (
        <PackRipPrecisionModal onClose={() => setTestingGame(null)} />
      )}
      {testingGame === "grading_masher" && (
        <GradingMasherModal onClose={() => setTestingGame(null)} />
      )}
    </div>
  );
}
