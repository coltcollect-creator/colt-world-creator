import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { TriviaQuestion } from "@/lib/npcs-system";
import { Sparkles, HelpCircle, CheckCircle2, XCircle, Award } from "lucide-react";

interface Props {
  npc: any;
  onClose: () => void;
}

export function ProfessorQuizModal({ npc, onClose }: Props) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<TriviaQuestion | null>(null);
  const [alreadyAnsweredToday, setAlreadyAnsweredToday] = useState(false);
  const [allQuestionsFinished, setAllQuestionsFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"correct" | "wrong" | null>(null);

  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  useEffect(() => {
    async function loadQuizState() {
      if (!user) return;
      try {
        setLoading(true);
        // Load user's professor progress doc from Firestore
        const userProgressRef = doc(db, "user_npc_progress", `${user.id}_professor`);
        const userProgressSnap = await getDoc(userProgressRef);
        const progressData = userProgressSnap.exists() ? userProgressSnap.data() : { answered_days: {}, question_index: 0 };

        // Check if user already answered today
        if (progressData.answered_days && progressData.answered_days[todayKey]) {
          setAlreadyAnsweredToday(true);
          setOutcome(progressData.answered_days[todayKey].correct ? "correct" : "wrong");
          setLoading(false);
          return;
        }

        // Get questions from npc data or Firestore npc
        let questions: TriviaQuestion[] = npc?.trivia_questions || [];
        if (!questions.length) {
          const npcSnap = await getDoc(doc(db, "npcs", npc?.id || "npc-professor"));
          if (npcSnap.exists()) {
            questions = npcSnap.data()?.trivia_questions || [];
          }
        }

        // Default fallback trivia if none configured yet
        if (!questions.length) {
          questions = [
            {
              id: "q-default-1",
              question: "פוקימון רוח עם חיוך שאי אפשר לשכוח ועוקב בצללים?",
              options: ["גנגר (Gengar)", "פיקאצ׳ו (Pikachu)", "צ׳ריזארד (Charizard)", "סנורלקס (Snorlax)"],
              correct_index: 0,
              reward_type: "xp",
              reward_amount: 150,
              reward_label: "150 XP 🎓",
            },
            {
              id: "q-default-2",
              question: "איזה פוקימון אגדי נברא על ידי בני אדם במעבדה?",
              options: ["מיו (Mew)", "מיוטו (Mewtwo)", "מולטרס (Moltres)", "זאפדוס (Zapdos)"],
              correct_index: 1,
              reward_type: "gems",
              reward_amount: 50,
              reward_label: "50 ג׳מס 💎",
            },
          ];
        }

        const qIdx = progressData.question_index || 0;
        if (qIdx >= questions.length) {
          setAllQuestionsFinished(true);
        } else {
          setCurrentQuestion(questions[qIdx]);
        }
      } catch (err) {
        console.error("Error loading professor quiz:", err);
      } finally {
        setLoading(false);
      }
    }
    loadQuizState();
  }, [user, npc, todayKey]);

  const handleAnswer = async () => {
    if (selectedOption === null || !currentQuestion || !user || submitting) return;
    setSubmitting(true);

    const isCorrect = selectedOption === currentQuestion.correct_index;
    try {
      const userProgressRef = doc(db, "user_npc_progress", `${user.id}_professor`);
      const userProgressSnap = await getDoc(userProgressRef);
      const prevData = userProgressSnap.exists() ? userProgressSnap.data() : { answered_days: {}, question_index: 0 };

      const nextQIndex = (prevData.question_index || 0) + 1;

      // Save user answer for today
      await setDoc(
        userProgressRef,
        {
          user_id: user.id,
          last_answered_date: todayKey,
          question_index: nextQIndex,
          answered_days: {
            ...(prevData.answered_days || {}),
            [todayKey]: {
              question_id: currentQuestion.id,
              selected_option: selectedOption,
              correct: isCorrect,
              answered_at: new Date().toISOString(),
            },
          },
        },
        { merge: true }
      );

      setOutcome(isCorrect ? "correct" : "wrong");
      setAlreadyAnsweredToday(true);

      if (isCorrect) {
        // Grant reward
        if (currentQuestion.reward_type === "xp" && currentQuestion.reward_amount) {
          const currentXp = Number(profile?.xp || 0);
          await supabase.from("profiles").update({ xp: currentXp + currentQuestion.reward_amount } as never).eq("id", user.id);
          toast.success(`תשובה נכונה! קיבלת ${currentQuestion.reward_label} 🎉`);
        } else if (currentQuestion.reward_type === "gems" && currentQuestion.reward_amount) {
          const currentCredits = Number(profile?.credits || 0);
          await supabase.from("profiles").update({ credits: currentCredits + currentQuestion.reward_amount } as never).eq("id", user.id);
          toast.success(`תשובה נכונה! קיבלת ${currentQuestion.reward_label} 💎`);
        } else {
          toast.success(`תשובה נכונה ומדויקת! כל הכבוד! 🎉`);
        }
      } else {
        toast.error(`תשובה לא נכונה! תוכל לנסות שוב עם חידה חדשה מחר.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "שגיאה בשמירת התשובה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-2 border-indigo-500/50 text-white rounded-3xl p-6" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400 flex items-center justify-center text-2xl">
              🔬
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-indigo-300">
                הפרופסור: החידה היומית
              </DialogTitle>
              <p className="text-xs text-muted-foreground">ענו נכונה פעם אחת בכל יום וזכו בפרסים!</p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">טוען את החידה היומית...</div>
        ) : allQuestionsFinished ? (
          <div className="py-8 text-center space-y-3">
            <div className="text-4xl">🎓</div>
            <h4 className="text-lg font-bold text-emerald-400">פתרתם את כל החידות של הפרופסור!</h4>
            <p className="text-xs text-muted-foreground">
              אין לפרופסור חידות נוספות כרגע. בדקו שוב מחר או המתינו לעדכונים חדשים מהסופר אדמין!
            </p>
          </div>
        ) : alreadyAnsweredToday ? (
          <div className="py-6 text-center space-y-4">
            {outcome === "correct" ? (
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                <h4 className="text-base font-bold">עניתם נכון על החידה של היום! 🎉</h4>
                <p className="text-xs text-emerald-200/80">
                  הפרס נאסף בהצלחה לחשבונכם. חידה חדשה תופיע מחר בחצות!
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 space-y-2">
                <XCircle className="w-10 h-10 mx-auto text-rose-400" />
                <h4 className="text-base font-bold">ניסיתם כבר את החידה היומית להיום.</h4>
                <p className="text-xs text-rose-200/80">
                  לא צדקתם הפעם, אך אל דאגה! מחר תהיה הזדמנות חדשה וחידה חדשה.
                </p>
              </div>
            )}
            <Button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl">
              סגירה
            </Button>
          </div>
        ) : currentQuestion ? (
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
              <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold mb-1">
                <HelpCircle className="w-4 h-4" />
                <span>חידת היום:</span>
              </div>
              <p className="text-sm font-bold text-white leading-relaxed">
                {currentQuestion.question}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl w-fit">
                <Award className="w-3.5 h-3.5" />
                <span>פרס תשובה נכונה: {currentQuestion.reward_label}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground block">בחרו תשובה:</span>
              {currentQuestion.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedOption(idx)}
                  className={`w-full text-right p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                    selectedOption === idx
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30 scale-[1.01]"
                      : "bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  <span>{opt}</span>
                  <span className="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center text-[10px]">
                    {String.fromCharCode(65 + idx)}
                  </span>
                </button>
              ))}
            </div>

            <Button
              onClick={handleAnswer}
              disabled={selectedOption === null || submitting}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-2.5 rounded-xl text-sm shadow-lg shadow-indigo-500/25"
            >
              {submitting ? "בודק..." : "אישור תשובה סופית"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
