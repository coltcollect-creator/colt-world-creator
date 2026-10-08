import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Gauge, RotateCcw, Zap } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function GradingMasherModal({ onClose }: Props) {
  const { user, profile } = useAuth();
  const [gameState, setGameState] = useState<"countdown" | "mashing" | "result">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(3.0);
  const [clicks, setClicks] = useState(0);

  // 3-second countdown on open
  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown > 1) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setGameState("mashing");
        setTimeLeft(3.0);
        setClicks(0);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [gameState, countdown]);

  // 3-second mashing window
  useEffect(() => {
    if (gameState !== "mashing") return;

    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.1) {
          clearInterval(interval);
          finishGrading();
          return 0;
        }
        return Number((t - 0.1).toFixed(1));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [gameState]);

  const handleMash = () => {
    if (gameState !== "mashing") return;
    setClicks((c) => c + 1);
  };

  // Grade calculation based on clicks:
  // 0 - 10 clicks => Grade 7
  // 11 - 18 clicks => Grade 8
  // 19 - 25 clicks => Grade 9 (Near Mint)
  // 26+ clicks => Grade 10 (Gem Mint 10!)
  const getGrade = (c: number) => {
    if (c >= 26) return { grade: 10, label: "Gem Mint 10 💎", slabCol: "gold" };
    if (c >= 19) return { grade: 9, label: "Mint 9 ✨", slabCol: "silver" };
    if (c >= 12) return { grade: 8, label: "Near Mint 8 ⭐", slabCol: "blue" };
    return { grade: 7, label: "Excellent 7", slabCol: "slate" };
  };

  const finishGrading = async () => {
    setGameState("result");
    const result = getGrade(clicks);
    if (!user) return;

    try {
      if (result.grade === 10) {
        const currentXp = Number(profile?.xp || 0);
        await supabase.from("profiles").update({ xp: currentXp + 150 } as never).eq("id", user.id);
        toast.success("צחצוח מדהים! השגת סלאב Gem Mint 10 מוזהב! 🏆 +150 XP");
      } else {
        const currentXp = Number(profile?.xp || 0);
        await supabase.from("profiles").update({ xp: currentXp + 50 } as never).eq("id", user.id);
        toast.info(`הקלף קיבל דירוג ${result.label}! +50 XP`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentGradeObj = getGrade(clicks);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-950 border-2 border-cyan-500/50 text-white rounded-3xl p-6 select-none" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-xl">
              🔍
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-cyan-300">
                צחצוח ל-PSA 10 (Grading Masher)
              </DialogTitle>
              <p className="text-xs text-muted-foreground">תופפו ולחצו הכי מהר שאפשר תוך 3 שניות להעלאת הציון!</p>
            </div>
          </div>
        </DialogHeader>

        {gameState === "countdown" ? (
          <div className="py-20 text-center space-y-4">
            <div className="text-7xl font-black text-cyan-400 animate-bounce">{countdown}</div>
            <p className="text-sm font-bold text-muted-foreground">היכונו לתופף על המסך במהירות שיא!</p>
          </div>
        ) : gameState === "mashing" ? (
          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between px-2 text-xs font-mono font-bold">
              <span className="text-cyan-400 text-sm">לחיצות: {clicks}</span>
              <span className="text-rose-400 text-base font-black bg-rose-500/10 px-3 py-1 rounded-xl">
                ⏱️ {timeLeft.toFixed(1)}s
              </span>
            </div>

            {/* Card & Magnifier Visual */}
            <div className="relative w-52 h-64 mx-auto rounded-2xl bg-gradient-to-b from-slate-900 to-indigo-950 border-2 border-slate-700 flex flex-col items-center justify-center p-3 shadow-2xl">
              {/* Grade Meter on Side */}
              <div className="absolute top-3 right-3 flex flex-col items-center gap-1 bg-black/60 p-1.5 rounded-xl border border-white/10 text-[10px] font-black">
                <span className={currentGradeObj.grade === 10 ? "text-amber-400 scale-125" : "text-slate-600"}>10</span>
                <span className={currentGradeObj.grade === 9 ? "text-cyan-300 scale-125" : "text-slate-600"}>9</span>
                <span className={currentGradeObj.grade === 8 ? "text-sky-400 scale-125" : "text-slate-600"}>8</span>
                <span className={currentGradeObj.grade === 7 ? "text-slate-300 scale-125" : "text-slate-600"}>7</span>
              </div>

              <div className="text-5xl animate-pulse">✨🔍✨</div>
              <p className="text-xs font-bold text-white mt-2">מצחצח את הקלף...</p>
              <div className="mt-3 text-sm font-black text-amber-300 bg-amber-500/20 px-3 py-1 rounded-xl">
                ציון נוכחי: {currentGradeObj.grade}
              </div>
            </div>

            {/* Giant Masher Tap Button */}
            <button
              type="button"
              onClick={handleMash}
              className="w-full h-24 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:scale-[1.02] active:scale-95 text-white font-black text-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/30 transition-transform cursor-pointer"
            >
              <Zap className="w-7 h-7 animate-bounce" />
              תופפו כאן הכי מהר שאפשר! ({clicks})
            </button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-6">
            {currentGradeObj.grade === 10 ? (
              <div className="space-y-4">
                {/* Gold Slab frame */}
                <div className="w-36 h-52 mx-auto rounded-2xl bg-slate-900 border-4 border-amber-400 shadow-2xl shadow-amber-400/60 p-2 flex flex-col justify-between items-center animate-bounce">
                  <div className="w-full bg-amber-400 text-black text-[11px] font-black py-0.5 rounded-md">
                    GEM MINT 10
                  </div>
                  <div className="text-4xl">👑</div>
                  <div className="text-[10px] text-amber-300 font-bold">PERFECT GRADE</div>
                </div>
                <h4 className="text-2xl font-black text-amber-300">הגעתם ל-PSA 10 מוזהב! 💎</h4>
                <p className="text-xs text-emerald-300 font-bold bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-500/30">
                  צחצוח על! תקתקתם {clicks} לחיצות תוך 3 שניות וזכיתם ב-150 XP!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Standard Slab frame */}
                <div className="w-36 h-52 mx-auto rounded-2xl bg-slate-900 border-2 border-slate-500 p-2 flex flex-col justify-between items-center">
                  <div className="w-full bg-slate-700 text-white text-[11px] font-bold py-0.5 rounded-md">
                    GRADE {currentGradeObj.grade}
                  </div>
                  <div className="text-4xl">🃏</div>
                  <div className="text-[10px] text-muted-foreground">{currentGradeObj.label}</div>
                </div>
                <h4 className="text-lg font-bold text-cyan-300">תוצאה: {currentGradeObj.label}</h4>
                <p className="text-xs text-muted-foreground">תקתקתם {clicks} לחיצות תוך 3 שניות.</p>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setGameState("countdown");
                  setCountdown(3);
                }}
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-black rounded-xl"
              >
                <RotateCcw className="w-4 h-4 ml-1.5" /> נסה שוב
              </Button>
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
