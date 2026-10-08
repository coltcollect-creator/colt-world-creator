import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Compass, Key, Sparkles, HelpCircle, MapPin } from "lucide-react";

interface Props {
  npc: any;
  onClose: () => void;
}

export function PirateCluesModal({ npc, onClose }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userClues, setUserClues] = useState<any[]>([]);
  const [selectedClue, setSelectedClue] = useState<any | null>(null);

  useEffect(() => {
    async function loadClues() {
      if (!user) return;
      try {
        setLoading(true);
        // Load user unlocked clues from Supabase user_clues or all active clues
        const { data: userClueRows } = await supabase
          .from("user_clues")
          .select("clue_id, clues(*)")
          .eq("user_id", user.id);

        let list: any[] = [];
        if (userClueRows && userClueRows.length > 0) {
          list = userClueRows.map((r: any) => r.clues).filter(Boolean);
        } else {
          // If none explicitly unlocked in user_clues, load active free or tier 1 clues to help user start!
          const { data: activeClues } = await supabase
            .from("clues")
            .select("*")
            .eq("active", true)
            .limit(5);
          list = activeClues || [];
        }

        setUserClues(list);
        if (list.length > 0) setSelectedClue(list[0]);
      } catch (err) {
        console.error("Error loading pirate clues:", err);
      } finally {
        setLoading(false);
      }
    }
    loadClues();
  }, [user]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-slate-900 border-2 border-emerald-500/50 text-white rounded-3xl p-6" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-2xl">
              🏴‍☠️
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-emerald-300">
                קפטן הפיראט: רמז לרמז
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                מתקשים עם רמז שמצאתם? הפיראט קורא את הרמזים שבידכם ונותן עזרה לפענוח!
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">הפיראט פותח את מפת האוצר הישנה...</div>
        ) : userClues.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <div className="text-4xl">🗺️</div>
            <h4 className="text-sm font-bold text-emerald-400">אין לכם עדיין רמזים בתיק!</h4>
            <p className="text-xs text-muted-foreground">
              סיירו במפה, חפשו תיבות או רכשו רמז ראשון בגלגל המזל ובשוק, ואז חזרו אליי לעזרה!
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div>
              <span className="text-xs font-semibold text-muted-foreground block mb-1.5">
                בחרו רמז מהאוסף שלכם לקבלת עזרה מהפיראט:
              </span>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {userClues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClue(c)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                      selectedClue?.id === c.id
                        ? "bg-emerald-600 text-white border-emerald-400 shadow-md scale-105"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    🧩 {c.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedClue && (
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white">{selectedClue.name}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5">
                      📜 הרמז המקורי: &ldquo;{selectedClue.body || "רמז סודי המצביע אל עבר התיבה"}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Sub-clue / Pirate Help Clue */}
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>הרמז של הפיראט לפיתרון (רמז לרמז):</span>
                  </div>
                  <p className="leading-relaxed">
                    {selectedClue.sub_clue ||
                      selectedClue.metadata?.sub_clue ||
                      "אררר! הבט סביב הדוכנים העמוקים בהיכל ה-2.5D או ליד במת המכרזים, שם המפתח הזוהר מסתתר מתחת לעץ הנוסטלגיה!"}
                  </p>
                </div>
              </div>
            )}

            <Button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl">
              תודה, אמשיך לחפש! 🏴‍☠️
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
