import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  onClose: () => void;
}

interface LevelConfig {
  level: number;
  sweetWidth: number; // percentage width of sweet spot
  speed: number;      // step per 20ms
  indicatorWidthPx: number;
  label: string;
}

const LEVELS: LevelConfig[] = [
  { level: 1, sweetWidth: 16, speed: 2.2, indicatorWidthPx: 18, label: "שלב 1: בוסטר מתחילים (רגוע)" },
  { level: 2, sweetWidth: 12, speed: 2.9, indicatorWidthPx: 15, label: "שלב 2: בוסטר מתקדם (מהיר)" },
  { level: 3, sweetWidth: 9,  speed: 3.7, indicatorWidthPx: 12, label: "שלב 3: בוסטר מומחים (צר ומואץ)" },
  { level: 4, sweetWidth: 6.5, speed: 4.6, indicatorWidthPx: 10, label: "שלב 4: בוסטר מאסטר (חד ביותר)" },
  { level: 5, sweetWidth: 4.2, speed: 5.6, indicatorWidthPx: 8,  label: "שלב 5: בוסטר אגדי (אתגר הדיוק המושלם!)" },
];

export function PackRipPrecisionModal({ onClose }: Props) {
  const { user, profile } = useAuth();
  const [gameState, setGameState] = useState<"ready" | "playing" | "result">("ready");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [indicatorX, setIndicatorX] = useState(0); // 0% to 100%
  const [direction, setDirection] = useState<1 | -1>(1);
  const [outcome, setOutcome] = useState<"clean" | "bad" | null>(null);

  const curCfg = LEVELS[currentLevel - 1] || LEVELS[0];
  const sweetMin = 50 - curCfg.sweetWidth / 2;
  const sweetMax = 50 + curCfg.sweetWidth / 2;

  useEffect(() => {
    if (gameState !== "playing") return;

    const interval = setInterval(() => {
      setIndicatorX((prev) => {
        let next = prev + direction * curCfg.speed;
        if (next >= 96) {
          setDirection(-1);
          return 96;
        }
        if (next <= 4) {
          setDirection(1);
          return 4;
        }
        return next;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [gameState, direction, curCfg.speed]);

  const startLevel = (lvl: number) => {
    setCurrentLevel(lvl);
    setGameState("playing");
    setIndicatorX(lvl % 2 === 0 ? 90 : 10);
    setDirection(lvl % 2 === 0 ? -1 : 1);
    setOutcome(null);
  };

  const handleRip = async () => {
    if (gameState !== "playing") return;
    const isClean = indicatorX >= sweetMin && indicatorX <= sweetMax;
    setOutcome(isClean ? "clean" : "bad");
    setGameState("result");

    if (!user) return;
    try {
      if (isClean) {
        const bonusXp = currentLevel * 50;
        const currentXp = Number(profile?.xp || 0);
        await supabase.from("profiles").update({ xp: currentXp + bonusXp } as never).eq("id", user.id);
        toast.success(`קריעה מושלמת ונקייה! נחשף קלף זהב נדיר! 🌟 +${bonusXp} XP`);
      } else {
        toast.info("קריעה עקומה! נחשף קלף רגיל (Common) 🃏");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const nextLevel = () => {
    if (currentLevel < 5) {
      startLevel(currentLevel + 1);
    } else {
      // Completed all 5!
      startLevel(1);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-950 border-2 border-emerald-500/50 text-white rounded-3xl p-6 select-none" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-xl">
                ✂️
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-emerald-300">
                  קריעת בוסטר (Pack Rip Precision)
                </DialogTitle>
                <p className="text-xs text-muted-foreground">דיוק בלחיצה: עצרו את הסמן במרכז האזור הירוק</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-xl text-xs font-black text-emerald-300">
              <span>שלב {currentLevel}/5</span>
            </div>
          </div>
        </DialogHeader>

        {/* Level Steps Progress Bar */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          {LEVELS.map((lvl) => {
            const isDone = lvl.level < currentLevel;
            const isCurrent = lvl.level === currentLevel;
            return (
              <div
                key={lvl.level}
                className={`flex-1 h-2 rounded-full transition-all ${
                  isDone
                    ? "bg-emerald-400"
                    : isCurrent
                    ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                    : "bg-slate-800"
                }`}
                title={lvl.label}
              />
            );
          })}
        </div>

        {gameState === "ready" ? (
          <div className="py-6 space-y-5 text-center">
            <div className="text-6xl animate-pulse">📦✨</div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-amber-300">{curCfg.label}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                בכל שלב רוחב האזור הירוק קטן, מהירות הסמן גוברת, והרוחב של הסמן מדויק יותר!
                הצליחו בקריעה מושלמת כדי להתקדם בכל 5 השלבים.
              </p>
            </div>
            <Button
              onClick={() => startLevel(1)}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-black px-8 py-3 rounded-2xl text-base shadow-lg shadow-emerald-500/25"
            >
              התחל משלב 1 ✂️
            </Button>
          </div>
        ) : gameState === "playing" ? (
          <div className="space-y-6 py-4">
            <div className="text-center text-xs font-black text-amber-300">
              {curCfg.label}
            </div>

            {/* Booster pack visual */}
            <div className="relative w-64 h-80 mx-auto rounded-2xl bg-gradient-to-b from-purple-700 via-indigo-900 to-slate-900 border-4 border-amber-400/80 shadow-2xl flex flex-col justify-between overflow-hidden">
              {/* Tear line with Sweet Spot at top */}
              <div className="relative w-full h-10 bg-slate-950/80 border-b-2 border-dashed border-amber-400/60 flex items-center">
                {/* Sweet spot area */}
                <div
                  style={{
                    left: `${sweetMin}%`,
                    width: `${curCfg.sweetWidth}%`,
                  }}
                  className="absolute h-full bg-emerald-500/50 border-x-2 border-emerald-400 flex items-center justify-center text-[10px] font-black text-emerald-200"
                >
                  SWEET
                </div>

                {/* Moving Indicator */}
                <div
                  style={{
                    left: `${indicatorX}%`,
                    width: `${curCfg.indicatorWidthPx}px`,
                    transform: "translateX(-50%)",
                  }}
                  className="absolute h-9 bg-white rounded-md shadow-lg shadow-white/80 border border-slate-900 flex items-center justify-center text-[10px] font-black text-slate-950"
                >
                  ▼
                </div>
              </div>

              {/* Booster Artwork */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-2">
                <div className="text-4xl">⚡🐲</div>
                <h4 className="text-base font-black text-amber-300">COLT 2026 EDITION</h4>
                <p className="text-[10px] text-purple-200 font-semibold">
                  שלב {currentLevel} מתוך 5 • מהירות x{curCfg.speed}
                </p>
              </div>

              <div className="p-2 bg-slate-950/80 text-center text-[10px] font-mono text-muted-foreground border-t border-purple-500/30">
                לחצו עכשיו על כפתור הקריעה בדיוק ב-SWEET SPOT!
              </div>
            </div>

            <Button
              onClick={handleRip}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-black font-black py-4 rounded-2xl text-lg shadow-xl shadow-emerald-500/30"
            >
              ✂️ קריעה עכשיו!
            </Button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-5">
            {outcome === "clean" ? (
              <div className="space-y-4">
                <div className="w-24 h-36 mx-auto rounded-xl bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 border-4 border-amber-300 shadow-2xl shadow-amber-400/60 p-2 flex flex-col items-center justify-center text-black font-black animate-bounce">
                  <div className="text-3xl">🌟</div>
                  <div className="text-[11px] mt-1">SECRET RARE</div>
                  <div className="text-[9px] text-amber-900 font-bold">GOLD EDITION</div>
                </div>

                {currentLevel === 5 ? (
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black text-amber-300 flex items-center justify-center gap-2">
                      <Trophy className="w-7 h-7 text-yellow-400" />
                      <span>אלוף הקריעה המושלמת! 🏆</span>
                    </h4>
                    <p className="text-xs text-amber-200 font-bold bg-amber-950/60 p-3 rounded-2xl border border-amber-500/40">
                      וואו! השלמתם את כל 5 שלבי הקריעה בהצלחה מוחלטת! זכיתם בבונוס ענק של 250 XP!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-amber-300">קריעה חלקה ומושלמת! (Clean Tear) 🎉</h4>
                    <p className="text-xs text-emerald-300 font-bold bg-emerald-950/60 p-3 rounded-2xl border border-emerald-500/40">
                      דיוק מושלם! הבוסטר נפתח חלק ונחשף קלף מוזהב נדיר! (+{currentLevel * 50} XP)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-24 h-36 mx-auto rounded-xl bg-slate-800 border-2 border-slate-600 p-2 flex flex-col items-center justify-center text-slate-300 font-bold">
                  <div className="text-3xl">🃏</div>
                  <div className="text-[11px] mt-1">COMMON</div>
                  <div className="text-[9px] text-muted-foreground">רגיל</div>
                </div>
                <h4 className="text-lg font-bold text-rose-400">קריעה עקומה (Bad Rip)</h4>
                <p className="text-xs text-muted-foreground bg-rose-950/30 p-2.5 rounded-xl border border-rose-500/20">
                  הסמן לא נעצר בתוך ה-Sweet Spot והאריזה נקרעה עקום.
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {outcome === "clean" && currentLevel < 5 && (
                <Button
                  onClick={nextLevel}
                  className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl px-5 shadow-lg shadow-amber-400/25"
                >
                  עבור לשלב {currentLevel + 1} ⚡
                </Button>
              )}
              {outcome === "clean" && currentLevel === 5 && (
                <Button
                  onClick={() => startLevel(1)}
                  className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl px-5 shadow-lg shadow-amber-400/25"
                >
                  שחק שוב מההתחלה 🏆
                </Button>
              )}
              {outcome === "bad" && (
                <Button
                  onClick={() => startLevel(currentLevel)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-xl px-5"
                >
                  <RotateCcw className="w-4 h-4 ml-1.5" /> נסה שוב את שלב {currentLevel}
                </Button>
              )}
              <Button onClick={onClose} variant="outline" className="rounded-xl border-slate-700 text-white">
                סגירה
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
