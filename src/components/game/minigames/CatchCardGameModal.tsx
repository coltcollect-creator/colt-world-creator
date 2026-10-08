import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { Trophy, Play, RotateCcw, Award } from "lucide-react";

interface FallingCard {
  id: number;
  x: number; // percentage 5 - 90
  y: number; // percentage 0 - 100
  speed: number;
  type: "holo" | "secret" | "gold";
  caught: boolean;
}

export function CatchCardGameModal({ onClose }: Props) {
  const { user, profile } = useAuth();
  const [gameState, setGameState] = useState<"ready" | "countdown" | "playing" | "gameover">("ready");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sleeveTier, setSleeveTier] = useState<"sleeve" | "toploader">("sleeve");
  const [floatText, setFloatText] = useState<{ text: string; color: string; id: number } | null>(null);
  const [catcherX, setCatcherX] = useState(50); // percentage 10 - 90
  const [fallingCards, setFallingCards] = useState<FallingCard[]>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ username: string; score: number }>>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef(0);
  streakRef.current = streak;

  // Load Leaderboard
  const loadLeaderboard = async () => {
    try {
      setLoadingLeaderboard(true);
      const q = query(collection(db, "minigame_scores_catch_card"), orderBy("score", "desc"), limit(10));
      const snaps = await getDocs(q);
      const list: Array<{ username: string; score: number }> = [];
      snaps.forEach((d) => list.push(d.data() as any));
      setLeaderboard(list);
    } catch (err) {
      console.error("Leaderboard load err:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Countdown
  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown > 1) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setGameState("playing");
        setTimeLeft(30);
        setScore(0);
        setStreak(0);
        setSleeveTier("sleeve");
        setFallingCards([]);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [gameState, countdown]);

  // Game Loop
  useEffect(() => {
    if (gameState !== "playing") return;

    // Timer countdown
    const timerInterval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerInterval);
          finishGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // Cards Spawner & Physics
    let lastSpawn = Date.now();
    let cardIdCounter = 1;

    const gameLoopInterval = setInterval(() => {
      const now = Date.now();
      // Increase spawn rate as time passes (harder)
      const currentElapsed = 30 - timeLeft;
      const spawnDelay = Math.max(450, 1200 - currentElapsed * 25);

      setFallingCards((prev) => {
        let updated = prev
          .map((c) => ({
            ...c,
            y: c.y + c.speed,
          }))
          .filter((c) => c.y < 105 && !c.caught);

        // Check catches with catcher (catcher is around y = 85, width approx 18%)
        const catcherY = 82;
        const catcherW = sleeveTier === "toploader" ? 22 : 16;
        const catcherLeft = catcherX - catcherW / 2;
        const catcherRight = catcherX + catcherW / 2;

        for (const card of updated) {
          if (card.y >= catcherY && card.y <= catcherY + 8 && !card.caught) {
            const cardCenterX = card.x;
            if (cardCenterX >= catcherLeft && cardCenterX <= catcherRight) {
              card.caught = true;
              const distFromCenter = Math.abs(cardCenterX - catcherX);
              let points = 100;
              let feedback = "תפיסה טובה!";
              let color = "#38bdf8";

              if (distFromCenter < 3) {
                points = 250;
                feedback = "🎯 בול באמצע! מושלם!";
                color = "#facc15";
              } else if (distFromCenter < 7) {
                points = 150;
                feedback = "✨ הופה! יפה מאד!";
                color = "#4ade80";
              }

              if (sleeveTier === "toploader") {
                points = Math.round(points * 1.5);
              }

              setScore((s) => s + points);
              setStreak((st) => {
                const newSt = st + 1;
                if (newSt >= 4) {
                  setSleeveTier("toploader");
                  setFloatText({ text: "⭐ שודרג ל-Toploader! בונוס ניקוד!", color: "#ec4899", id: Date.now() });
                } else {
                  setFloatText({ text: feedback, color, id: Date.now() });
                }
                return newSt;
              });
            }
          } else if (card.y > 92 && !card.caught) {
            // Missed!
            card.caught = true;
            setStreak(0);
            setSleeveTier("sleeve");
            setFloatText({ text: "פספוס! 💔", color: "#f87171", id: Date.now() });
          }
        }

        return updated;
      });

      if (now - lastSpawn > spawnDelay) {
        lastSpawn = now;
        const types: Array<"holo" | "secret" | "gold"> = ["holo", "secret", "gold"];
        const randType = types[Math.floor(Math.random() * types.length)];
        const baseSpeed = 1.6 + (30 - timeLeft) * 0.08;

        setFallingCards((prev) => [
          ...prev,
          {
            id: cardIdCounter++,
            x: Math.floor(Math.random() * 80) + 10,
            y: 0,
            speed: baseSpeed + Math.random() * 0.8,
            type: randType,
            caught: false,
          },
        ]);
      }
    }, 45);

    return () => {
      clearInterval(timerInterval);
      clearInterval(gameLoopInterval);
    };
  }, [gameState, timeLeft, catcherX, sleeveTier]);

  const finishGame = async () => {
    setGameState("gameover");
    if (!user) return;

    try {
      // Save highscore
      const scoreDocRef = doc(db, "minigame_scores_catch_card", `${user.id}`);
      await setDoc(
        scoreDocRef,
        {
          user_id: user.id,
          username: profile?.username || user.email?.split("@")[0] || "שחקן",
          score,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );

      // Grant rewards
      const earnedXp = Math.floor(score / 10);
      const currentXp = Number(profile?.xp || 0);
      await supabase.from("profiles").update({ xp: currentXp + earnedXp } as never).eq("id", user.id);
      toast.success(`המשחק הסתיים! ניקוד: ${score} נקודות. קיבלת ${earnedXp} XP 🏆`);
      loadLeaderboard();
    } catch (err) {
      console.error("Save score error:", err);
    }
  };

  // Mouse / Touch Move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== "playing" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setCatcherX(Math.max(10, Math.min(90, pct)));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-slate-950 border-2 border-amber-500/50 text-white rounded-3xl p-6 select-none" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-xl">
                🃏
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-amber-300">
                  תפוס את הקלף! (Catch The Card)
                </DialogTitle>
                <p className="text-xs text-muted-foreground">הזיזו את הסליב ותפסו קלפי Holo נופלים!</p>
              </div>
            </div>
            {gameState === "playing" && (
              <div className="flex items-center gap-4 text-xs font-mono font-bold">
                <span className="text-amber-400 text-sm">ניקוד: {score}</span>
                <span className="text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">⏱️ {timeLeft}s</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {gameState === "ready" ? (
          <div className="py-6 space-y-6 text-center">
            <div className="space-y-2">
              <div className="text-5xl">✨🃏🛡️</div>
              <h3 className="text-xl font-black text-white">מוכנים לאתגר התפיסה?</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                קלפים נדירים נופלים מלמעלה. הזז את המגן ימינה ושמאלה. תפיסות רצופות ישדרגו אותך ל-Toploader
                שיעניק נקודות כפולות!
              </p>
            </div>

            <Button
              onClick={() => {
                setGameState("countdown");
                setCountdown(3);
              }}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-black font-black text-base px-8 py-3 rounded-2xl shadow-xl shadow-amber-500/20"
            >
              <Play className="w-5 h-5 ml-2" /> התחל משחק (30 שניות)
            </Button>

            {/* Global Leaderboard Top 10 */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-right space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 border-b border-slate-800 pb-2">
                <Trophy className="w-4 h-4" />
                <span>טבלת אלופים גלובלית (TOP 10):</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                {leaderboard.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">אין עדיין תוצאות. היו הראשונים!</p>
                ) : (
                  leaderboard.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-800/40">
                      <span className="font-bold flex items-center gap-2">
                        <span className="text-amber-400 font-mono">#{idx + 1}</span>
                        <span>{item.username}</span>
                      </span>
                      <span className="font-mono text-amber-300 font-bold">{item.score} נק׳</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : gameState === "countdown" ? (
          <div className="py-24 text-center space-y-4">
            <div className="text-7xl font-black text-amber-400 animate-bounce">{countdown}</div>
            <p className="text-sm font-bold text-muted-foreground">היכונו... הקלפים מתחילים ליפול!</p>
          </div>
        ) : gameState === "playing" ? (
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onTouchMove={handleMouseMove}
            className="relative w-full h-[400px] rounded-2xl bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 border border-slate-800 overflow-hidden cursor-ew-resize"
          >
            {/* Floating popups */}
            {floatText && (
              <div
                key={floatText.id}
                className="absolute top-8 inset-x-0 mx-auto text-center font-black text-sm animate-out fade-out zoom-out duration-700 pointer-events-none"
                style={{ color: floatText.color }}
              >
                {floatText.text}
              </div>
            )}

            {/* Falling cards */}
            {fallingCards.map((card) => (
              <div
                key={card.id}
                style={{
                  left: `${card.x}%`,
                  top: `${card.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className="absolute w-10 h-14 rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 shadow-lg shadow-amber-400/40 flex items-center justify-center text-xs font-bold pointer-events-none animate-pulse"
              >
                🌟
              </div>
            ))}

            {/* Catcher (Sleeve / Toploader) */}
            <div
              style={{
                left: `${catcherX}%`,
                bottom: "10%",
                transform: "translateX(-50%)",
                width: sleeveTier === "toploader" ? "88px" : "64px",
              }}
              className={`absolute h-20 rounded-xl border-4 transition-all duration-75 flex flex-col items-center justify-end p-1 shadow-2xl ${
                sleeveTier === "toploader"
                  ? "border-pink-400 bg-pink-500/20 shadow-pink-500/50"
                  : "border-sky-400 bg-sky-500/20 shadow-sky-500/40"
              }`}
            >
              <span className="text-[10px] font-black uppercase text-white tracking-wider">
                {sleeveTier === "toploader" ? "TOPLOADER" : "SLEEVE"}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-6">
            <div className="space-y-2">
              <div className="text-6xl">🏆</div>
              <h3 className="text-2xl font-black text-amber-400">המשחק הסתיים!</h3>
              <p className="text-base font-bold text-white">השגת {score} נקודות!</p>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setGameState("countdown");
                  setCountdown(3);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl"
              >
                <RotateCcw className="w-4 h-4 ml-2" /> שחק שוב
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

interface Props {
  onClose: () => void;
}
