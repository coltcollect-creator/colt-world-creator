import { useEffect, useState } from "react";
import { getLevelProgress, type LevelRewardSummary } from "@/lib/progression";
import { Award, Sparkles, X, ChevronLeft } from "lucide-react";
import confetti from "canvas-confetti";

type LevelUpEventDetail = {
  userId: string;
  oldLevel: number;
  newLevel: number;
  rewards: LevelRewardSummary[];
  newXp: number;
  currentCredits: number;
};

export function LevelUpCelebration() {
  const [data, setData] = useState<LevelUpEventDetail | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleLevelUp = (e: Event) => {
      const customEvent = e as CustomEvent<LevelUpEventDetail>;
      if (customEvent.detail && customEvent.detail.newLevel > customEvent.detail.oldLevel) {
        setData(customEvent.detail);
        setOpen(true);
        try {
          confetti({
            particleCount: 180,
            spread: 100,
            origin: { x: 0.5, y: 0.35 },
            colors: ["#f59e0b", "#fbbf24", "#e11d48", "#38bdf8", "#a855f7"],
          });
        } catch {}
      }
    };

    window.addEventListener("level-up", handleLevelUp);
    return () => {
      window.removeEventListener("level-up", handleLevelUp);
    };
  }, []);

  if (!open || !data) return null;

  const prog = getLevelProgress(data.newXp);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => setOpen(false)}
    >
      <div
        className="chrome-panel relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-primary/50 bg-gradient-to-b from-card via-card to-background p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient effect */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

        <button
          onClick={() => setOpen(false)}
          className="absolute start-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="סגור"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Badge & Level Icon */}
        <div className="relative mx-auto mt-2 mb-4 grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-tr from-amber-500 via-primary to-yellow-300 p-1 shadow-lg shadow-primary/25 animate-bounce">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-[22px] bg-background">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span className="text-3xl font-black text-foreground">Lv {data.newLevel}</span>
          </div>
        </div>

        <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          🎉 עלית לרמה {data.newLevel}!
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          כל הכבוד! צברת מספיק נקודות ניסיון והתקדמת מרמה <span className="font-bold text-foreground">{data.oldLevel}</span> לרמה <span className="font-bold text-primary">{data.newLevel}</span>!
        </p>

        {/* Rewards earned box */}
        {data.rewards.length > 0 && (
          <div className="my-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-start">
            <div className="flex items-center gap-1.5 text-xs font-black text-primary mb-2">
              <Award className="h-4 w-4" />
              <span>תגמולי עליית רמה שהתווספו לחשבונך:</span>
            </div>
            <div className="space-y-2">
              {data.rewards.map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-background/80 px-3 py-2 text-xs font-bold shadow-sm"
                >
                  <span className="text-foreground">{r.label}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">רמה {r.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* XP Progress towards next level */}
        <div className="mt-4 rounded-2xl bg-muted/40 p-3.5 text-start">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-muted-foreground">סה"כ ניסיון שנצבר:</span>
            <span className="font-black text-foreground font-mono">{data.newXp.toLocaleString()} XP</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-primary transition-all duration-500"
              style={{ width: `${prog.progressPercent}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            {prog.isMaxLevel ? (
              <span className="font-bold text-primary">🏆 הגעת לרמה המקסימלית!</span>
            ) : (
              <>
                <span>עוד <strong className="text-foreground">{prog.remainingXp.toLocaleString()} XP</strong> לרמה {prog.nextMilestone?.level}</span>
                <span className="font-mono">{prog.progressPercent}%</span>
              </>
            )}
          </div>

          {prog.nextMilestone && prog.nextMilestone.reward_label && (
            <div className="mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
              🎁 פרס ברמה הבאה ({prog.nextMilestone.level}): <strong className="text-primary">{prog.nextMilestone.reward_label}</strong>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-plastic mt-5 w-full py-3 text-sm font-black bg-primary text-primary-foreground shadow-lg hover:brightness-110 flex items-center justify-center gap-1.5"
        >
          <span>יש! המשך לשחק</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
