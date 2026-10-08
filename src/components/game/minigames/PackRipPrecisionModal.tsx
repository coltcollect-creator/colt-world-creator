import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Sparkles, Scissors, RotateCcw, Award } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function PackRipPrecisionModal({ onClose }: Props) {
  const { user, profile } = useAuth();
  const [gameState, setGameState] = useState<"ready" | "playing" | "result">("ready");
  const [indicatorX, setIndicatorX] = useState(0); // 0% to 100%
  const [direction, setDirection] = useState<1 | -1>(1);
  const [outcome, setOutcome] = useState<"clean" | "bad" | null>(null);

  // Sweet spot range: 42% to 58%
  const SWEET_MIN = 44;
  const SWEET_MAX = 56;

  useEffect(() => {
    if (gameState !== "playing") return;

    const interval = setInterval(() => {
      setIndicatorX((prev) => {
        let next = prev + direction * 2.6;
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
  }, [gameState, direction]);

  const handleRip = async () => {
    if (gameState !== "playing") return;
    const isClean = indicatorX >= SWEET_MIN && indicatorX <= SWEET_MAX;
    setOutcome(isClean ? "clean" : "bad");
    setGameState("result");

    if (!user) return;
    try {
      if (isClean) {
        // Clean Tear: grant 100 XP + celebration
        const currentXp = Number(profile?.xp || 0);
        await supabase.from("profiles").update({ xp: currentXp + 100 } as never).eq("id", user.id);
        toast.success("קריעה מושלמת ונקייה! נחשף קלף זהב נדיר! 🌟 +100 XP");
      } else {
        toast.info("קריעה עקומה! נחשף קלף רגיל (Common) 🃏");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-950 border-2 border-emerald-500/50 text-white rounded-3xl p-6 select-none" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-xl">
              ✂️
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-emerald-300">
                קריעת בוסטר (Pack Rip Precision)
              </DialogTitle>
              <p className="text-xs text-muted-foreground">תזמון בלחיצה אחת: קרעו את הבוסטר בול ב-Sweet Spot!</p>
            </div>
          </div>
        </DialogHeader>

        {gameState === "ready" ? (
          <div className="py-6 space-y-5 text-center">
            <div className="text-6xl animate-pulse">📦✨</div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              הביטו בסמן שנע לאורך קו הקריעה העליון. לחצו על המסך בדיוק בשבריר השנייה כשהוא עובר במרכז האזור הירוק
              כדי לחשוף קלף מוזהב נדיר!
            </p>
            <Button
              onClick={() => {
                setGameState("playing");
                setIndicatorX(10);
                setDirection(1);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-black px-8 py-3 rounded-2xl text-base shadow-lg shadow-emerald-500/25"
            >
              התחל לקרוע ✂️
            </Button>
          </div>
        ) : gameState === "playing" ? (
          <div className="space-y-6 py-4">
            {/* Booster pack visual */}
            <div className="relative w-64 h-80 mx-auto rounded-2xl bg-gradient-to-b from-purple-700 via-indigo-900 to-slate-900 border-4 border-amber-400/80 shadow-2xl flex flex-col justify-between overflow-hidden">
              {/* Tear line with Sweet Spot at top */}
              <div className="relative w-full h-10 bg-slate-950/80 border-b-2 border-dashed border-amber-400/60 flex items-center">
                {/* Sweet spot area */}
                <div
                  style={{
                    left: `${SWEET_MIN}%`,
                    width: `${SWEET_MAX - SWEET_MIN}%`,
                  }}
                  className="absolute h-full bg-emerald-500/50 border-x-2 border-emerald-400 flex items-center justify-center text-[10px] font-black text-emerald-200"
                >
                  SWEET
                </div>

                {/* Moving Indicator */}
                <div
                  style={{
                    left: `${indicatorX}%`,
                    transform: "translateX(-50%)",
                  }}
                  className="absolute w-4 h-9 bg-white rounded-md shadow-lg shadow-white/80 border border-slate-900 flex items-center justify-center text-xs"
                >
                  ▼
                </div>
              </div>

              {/* Booster Artwork */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-2">
                <div className="text-4xl">⚡🐲</div>
                <h4 className="text-base font-black text-amber-300">COLT 2026 EDITION</h4>
                <p className="text-[10px] text-purple-200 font-semibold">10 CARDS • GUARENTEED HOLO</p>
              </div>

              <div className="p-2 bg-slate-950/80 text-center text-[10px] font-mono text-muted-foreground border-t border-purple-500/30">
                לחצו עכשיו על כפתור הקריעה למטה!
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
                  <div className="text-[9px] text-amber-900">GOLD EDITION</div>
                </div>
                <h4 className="text-xl font-black text-amber-300">קריעה חלקה ומושלמת! (Clean Tear) 🎉</h4>
                <p className="text-xs text-emerald-300 font-bold bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-500/30">
                  סאונד נוסטלגי של פתיחה נקייה! נחשף קלף מוזהב נדיר וקיבלתם 100 XP!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-24 h-36 mx-auto rounded-xl bg-slate-800 border-2 border-slate-600 p-2 flex flex-col items-center justify-center text-slate-300 font-bold">
                  <div className="text-3xl">🃏</div>
                  <div className="text-[11px] mt-1">COMMON</div>
                  <div className="text-[9px] text-muted-foreground">רגיל</div>
                </div>
                <h4 className="text-lg font-bold text-rose-400">קריעה עקומה (Bad Rip)</h4>
                <p className="text-xs text-muted-foreground">האריזה נקרעה בצורה עקומה ונחשף קלף פשוט.</p>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setGameState("playing");
                  setIndicatorX(10);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-xl"
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
