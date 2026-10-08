import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, limit, orderBy, query, setDoc } from "firebase/firestore";
import { Trophy, Play, RotateCcw, Award, Sparkles, Clock, Zap } from "lucide-react";

interface FallingCard {
  id: number;
  x: number; // percentage 10 - 90
  y: number; // percentage 0 - 100
  speed: number;
  icon: string;
  name: string;
  gradient: string;
  caught: boolean;
}

const CARD_TEMPLATES = [
  { icon: "✨ Charizard", gradient: "from-amber-500 via-orange-600 to-red-600" },
  { icon: "⚡ Pikachu Holo", gradient: "from-yellow-400 via-amber-400 to-orange-500" },
  { icon: "🔮 Gengar Ghost", gradient: "from-purple-500 via-indigo-600 to-slate-900" },
  { icon: "🌊 Blastoise V", gradient: "from-blue-500 via-cyan-600 to-indigo-700" },
  { icon: "💎 Gold Mew", gradient: "from-amber-300 via-yellow-200 to-amber-500" },
];

interface Props {
  onClose: () => void;
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
  const [timeBonusPulse, setTimeBonusPulse] = useState(false);
  const [catcherX, setCatcherX] = useState(50); // percentage 10 - 90
  const [fallingCards, setFallingCards] = useState<FallingCard[]>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ username: string; score: number }>>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Mutable refs to prevent React render lag or interval resets
  const catcherXRef = useRef(50);
  catcherXRef.current = catcherX;

  const sleeveTierRef = useRef<"sleeve" | "toploader">("sleeve");
  sleeveTierRef.current = sleeveTier;

  const streakRef = useRef(0);
  streakRef.current = streak;

  const scoreRef = useRef(0);
  scoreRef.current = score;

  const timeLeftRef = useRef(30);
  timeLeftRef.current = timeLeft;

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const cardsRef = useRef<FallingCard[]>([]);
  const lastSpawnTimeRef = useRef(0);
  const nextCardIdRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef(0);

  // Load Leaderboard
  const loadLeaderboard = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Countdown handler
  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown > 1) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setGameState("playing");
        setTimeLeft(30);
        timeLeftRef.current = 30;
        setScore(0);
        scoreRef.current = 0;
        setStreak(0);
        streakRef.current = 0;
        setSleeveTier("sleeve");
        sleeveTierRef.current = "sleeve";
        cardsRef.current = [];
        setFallingCards([]);
        lastSpawnTimeRef.current = performance.now();
        lastTickTimeRef.current = performance.now();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [gameState, countdown]);

  // Second countdown timer
  useEffect(() => {
    if (gameState !== "playing") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishGame();
          return 0;
        }
        timeLeftRef.current = prev - 1;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // Game Loop with 60 FPS requestAnimationFrame
  useEffect(() => {
    if (gameState !== "playing") return;

    let running = true;

    const loop = (timestamp: number) => {
      if (!running || gameStateRef.current !== "playing") return;

      const elapsedSinceSpawn = timestamp - lastSpawnTimeRef.current;
      const currentSecondsElapsed = 30 - timeLeftRef.current;
      // Spawn interval accelerates as player progresses
      const spawnInterval = Math.max(380, 1100 - currentSecondsElapsed * 28);

      // Spawn new card if due
      if (elapsedSinceSpawn >= spawnInterval) {
        lastSpawnTimeRef.current = timestamp;
        const template = CARD_TEMPLATES[Math.floor(Math.random() * CARD_TEMPLATES.length)];
        const baseSpeed = 0.55 + Math.min(0.65, currentSecondsElapsed * 0.02);

        cardsRef.current.push({
          id: nextCardIdRef.current++,
          x: Math.floor(Math.random() * 75) + 12,
          y: -8,
          speed: baseSpeed + Math.random() * 0.35,
          icon: template.icon,
          name: template.icon,
          gradient: template.gradient,
          caught: false,
        });
      }

      // Physics and Collision Update
      const updatedCards: FallingCard[] = [];
      const curCatcherX = catcherXRef.current;
      const curTier = sleeveTierRef.current;
      const catcherWidth = curTier === "toploader" ? 22 : 16;
      const halfW = catcherWidth / 2;

      for (const card of cardsRef.current) {
        if (card.caught) continue;

        card.y += card.speed;

        // Collision check with catcher at y between 72% and 86%
        if (card.y >= 72 && card.y <= 86) {
          const dist = Math.abs(card.x - curCatcherX);

          if (dist <= halfW) {
            // CAUGHT!
            card.caught = true;

            const isPerfect = dist <= 3.8;
            let earnedPoints = 120;
            let feedback = "✨ יפה מאד! תפיסה טובה!";
            let color = "#38bdf8";

            if (isPerfect) {
              earnedPoints = 300;
              feedback = "🎯 בול באמצע! +2 שניות! (+300)";
              color = "#facc15";

              // ⏱️ Perfect catch adds +2 seconds!
              timeLeftRef.current += 2;
              setTimeLeft((t) => t + 2);
              setTimeBonusPulse(true);
              setTimeout(() => setTimeBonusPulse(false), 800);
            } else if (dist <= 6.5) {
              earnedPoints = 180;
              feedback = "🔥 הופה! מדויק! (+180)";
              color = "#4ade80";
            }

            if (curTier === "toploader") {
              earnedPoints = Math.round(earnedPoints * 1.5);
            }

            scoreRef.current += earnedPoints;
            setScore(scoreRef.current);

            streakRef.current += 1;
            setStreak(streakRef.current);

            if (streakRef.current >= 4 && curTier !== "toploader") {
              sleeveTierRef.current = "toploader";
              setSleeveTier("toploader");
              setFloatText({
                text: "⭐ שודרג ל-Toploader! נקודות כפולות!",
                color: "#ec4899",
                id: timestamp,
              });
            } else {
              setFloatText({
                text: feedback,
                color,
                id: timestamp,
              });
            }
            continue;
          }
        }

        // Card passed bottom screen without catch
        if (card.y > 98) {
          // MISSED
          card.caught = true;
          streakRef.current = 0;
          setStreak(0);
          if (curTier !== "sleeve") {
            sleeveTierRef.current = "sleeve";
            setSleeveTier("sleeve");
          }
          setFloatText({
            text: "פספוס! 💔",
            color: "#f87171",
            id: timestamp,
          });
          continue;
        }

        updatedCards.push(card);
      }

      cardsRef.current = updatedCards;
      setFallingCards([...updatedCards]);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameState]);

  // Finish Game & Record Score
  const finishGame = async () => {
    setGameState("gameover");
    const finalScore = scoreRef.current;

    if (!user) return;
    try {
      const scoreDocRef = doc(db, "minigame_scores_catch_card", `${user.id}`);
      await setDoc(
        scoreDocRef,
        {
          user_id: user.id,
          username: profile?.username || user.email?.split("@")[0] || "שחקן",
          score: finalScore,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );

      const earnedXp = Math.max(10, Math.floor(finalScore / 10));
      const currentXp = Number(profile?.xp || 0);
      await supabase.from("profiles").update({ xp: currentXp + earnedXp } as never).eq("id", user.id);
      toast.success(`המשחק הסתיים! ניקוד: ${finalScore} נקודות. קיבלת ${earnedXp} XP 🏆`);
      loadLeaderboard();
    } catch (err) {
      console.error("Save score error:", err);
    }
  };

  // Keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (gameState !== "playing") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setCatcherX((x) => {
          const next = Math.max(10, x - 6);
          catcherXRef.current = next;
          return next;
        });
      } else if (e.key === "ArrowRight") {
        setCatcherX((x) => {
          const next = Math.min(90, x + 6);
          catcherXRef.current = next;
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState]);

  // Mouse / Touch Move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== "playing" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const bounded = Math.max(10, Math.min(90, pct));
    setCatcherX(bounded);
    catcherXRef.current = bounded;
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
              <div className="flex items-center gap-3 text-xs font-mono font-bold">
                <span className="text-amber-400 text-sm">ניקוד: {score}</span>
                <span
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${
                    timeBonusPulse
                      ? "bg-emerald-500 text-black font-black scale-110 shadow-lg shadow-emerald-500/50"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeLeft}s</span>
                  {timeBonusPulse && <span className="text-[10px]">+2s!</span>}
                </span>
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
                קלפים נדירים נופלים מלמעלה במהירות גוברת. הזיזו את הסליב ימינה ושמאלה.
                <br />
                <span className="text-amber-300 font-bold">🎯 כל תפיסה מושלמת באמצע מוסיפה +2 שניות לזמן המשחק!</span>
                <br />
                רצף של 4 תפיסות ישדרג אתכם ל-Toploader שמעניק ניקוד מוגבר.
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
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Trophy className="w-4 h-4" />
                  <span>טבלת אלופים גלובלית (TOP 10):</span>
                </div>
                {loadingLeaderboard && <span className="text-[10px] text-muted-foreground">טוען...</span>}
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                {leaderboard.length === 0 ? (
                  <p className="text-muted-foreground text-[11px] py-2 text-center">אין עדיין תוצאות. היו הראשונים להגיע לפסגה!</p>
                ) : (
                  leaderboard.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                      <span className="font-bold flex items-center gap-2">
                        <span className={`font-mono text-xs ${idx === 0 ? "text-amber-400 font-black" : idx === 1 ? "text-slate-300 font-bold" : idx === 2 ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
                          #{idx + 1}
                        </span>
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
            className="relative w-full h-[400px] rounded-2xl bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 border-2 border-slate-700 overflow-hidden cursor-ew-resize select-none"
          >
            {/* Guide markers */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

            {/* Floating popups */}
            {floatText && (
              <div
                key={floatText.id}
                className="absolute top-10 inset-x-0 mx-auto text-center font-black text-sm drop-shadow-lg animate-out fade-out zoom-out duration-700 pointer-events-none z-20"
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
                className={`absolute w-12 h-16 rounded-xl border-2 border-amber-300/80 bg-gradient-to-br ${card.gradient} shadow-xl shadow-amber-400/30 flex flex-col items-center justify-between p-1 text-[9px] font-black pointer-events-none select-none z-10 transition-transform`}
              >
                <span className="text-[10px]">✨</span>
                <span className="text-white drop-shadow font-mono text-[8px] text-center leading-tight">HOLO</span>
                <span className="text-[9px]">⭐</span>
              </div>
            ))}

            {/* Catcher (Sleeve / Toploader) */}
            <div
              style={{
                left: `${catcherX}%`,
                bottom: "12%",
                transform: "translateX(-50%)",
                width: sleeveTier === "toploader" ? "92px" : "68px",
              }}
              className={`absolute h-20 rounded-2xl border-4 transition-all duration-75 flex flex-col items-center justify-between p-1.5 shadow-2xl z-10 ${
                sleeveTier === "toploader"
                  ? "border-pink-400 bg-pink-500/25 shadow-pink-500/60"
                  : "border-sky-400 bg-sky-500/20 shadow-sky-500/50"
              }`}
            >
              <div className="w-full flex items-center justify-between px-1">
                <span className="text-[8px] text-white/80 font-mono">COLT</span>
                {sleeveTier === "toploader" && <Zap className="w-3 h-3 text-pink-300 animate-pulse" />}
              </div>
              <span className="text-[10px] font-black uppercase text-white tracking-wider">
                {sleeveTier === "toploader" ? "TOPLOADER" : "SLEEVE"}
              </span>
              <div className="w-4 h-1 rounded-full bg-white/60 mx-auto" />
            </div>

            <div className="absolute bottom-2 inset-x-0 text-center text-[10px] text-slate-400 font-mono pointer-events-none">
              הזיזו עם העכבר / מגע במסך / חיצים ימינה ושמאלה במקלדת
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-6">
            <div className="space-y-2">
              <div className="text-6xl animate-bounce">🏆</div>
              <h3 className="text-2xl font-black text-amber-400">המשחק הסתיים!</h3>
              <p className="text-base font-bold text-white">השגת {score} נקודות!</p>
              <p className="text-xs text-muted-foreground">התוצאה נשמרה בטבלת השיאים העולמית</p>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => {
                  setGameState("countdown");
                  setCountdown(3);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl px-6"
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
