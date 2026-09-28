import { useEffect, useState } from "react";
import { onQuestProgress, type QuestProgressEvent } from "@/lib/quest-events";
import { Sparkles, Trophy, CheckCircle2 } from "lucide-react";

export function QuestProgressToast() {
  const [currentToast, setCurrentToast] = useState<QuestProgressEvent | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    return onQuestProgress((ev) => {
      setCurrentToast(ev);
      if (ev.isCompleted) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 5000);
      }
      setTimeout(() => {
        setCurrentToast((prev) => (prev?.questId === ev.questId ? null : prev));
      }, 3500);
    });
  }, []);

  if (!currentToast && !showCelebration) return null;

  return (
    <div className="pointer-events-none fixed bottom-16 end-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:end-6">
      {/* Grand Completion Banner */}
      {showCelebration && currentToast?.isCompleted && (
        <div className="animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-primary p-4 text-white shadow-2xl ring-4 ring-white/30 backdrop-blur-md">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl animate-bounce">
            🏆
          </div>
          <div className="text-start">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-200">
              <Sparkles className="h-3.5 w-3.5" /> משימה הושלמה בהצלחה!
            </div>
            <div className="text-base font-black leading-tight">{currentToast.questName}</div>
            <div className="mt-1 flex items-center gap-2 text-xs font-bold text-white/90">
              {currentToast.creditReward > 0 && <span>💎 +{currentToast.creditReward} ג'מים</span>}
              {currentToast.xpReward > 0 && <span>⚡ +{currentToast.xpReward} XP</span>}
            </div>
          </div>
        </div>
      )}

      {/* Incremental Progress Card */}
      {currentToast && !currentToast.isCompleted && (
        <div className="animate-in fade-in slide-in-from-end-4 duration-200 flex w-72 items-center gap-3 rounded-2xl border-2 border-primary/40 bg-card/95 p-3 shadow-xl backdrop-blur-md">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>התקדמות משימה</span>
              <span className="text-primary font-black">
                {currentToast.currentProgress} / {currentToast.targetAmount}
              </span>
            </div>
            <div className="truncate text-xs font-bold text-foreground">
              {currentToast.questName}
            </div>
            {/* Progress bar */}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(100, (currentToast.currentProgress / currentToast.targetAmount) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
