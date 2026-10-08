import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { ImageUpload } from "@/components/owner/ImageUpload";
import type { TriviaQuestion, GroupBuyItem } from "@/lib/npcs-system";
import { Plus, Trash2, Edit2, Check, Users, Sparkles } from "lucide-react";

export function SpecializedNpcEditor({ npc, onClose }: { npc: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"general" | "professor" | "mystery" | "pirate" | "matchmaker">("general");

  // Determine tab based on npc slug or type
  useEffect(() => {
    if (npc?.slug?.includes("prof") || npc?.id?.includes("prof")) setActiveTab("professor");
    else if (npc?.slug?.includes("mystery") || npc?.id?.includes("mystery")) setActiveTab("mystery");
    else if (npc?.slug?.includes("pirate") || npc?.id?.includes("pirate")) setActiveTab("pirate");
    else if (npc?.slug?.includes("match") || npc?.id?.includes("match")) setActiveTab("matchmaker");
  }, [npc]);

  const { data: allProducts = [] } = useQuery({
    queryKey: ["all-products-for-vendor"],
    queryFn: async () => (await supabase.from("products").select("id,name,credit_price,image_url").eq("active", true)).data ?? [],
  });

  // State for Professor questions
  const [questions, setQuestions] = useState<TriviaQuestion[]>(() => npc?.trivia_questions || []);

  // State for Mystery vendor products
  const [vendorProducts, setVendorProducts] = useState<string[]>(() => npc?.vendor_product_ids || []);

  // State for Matchmaker group buys and shout phrases
  const [shoutPhrases, setShoutPhrases] = useState<string[]>(() => npc?.shout_phrases || [
    "מארגנים רכישה קבוצתית מטורפת עכשיו!",
    "מי רוצה קופסת בוסטר במחיר מועדון?",
  ]);
  const [newPhrase, setNewPhrase] = useState("");
  const [groupBuys, setGroupBuys] = useState<GroupBuyItem[]>(() => npc?.group_buys || []);

  const [saving, setSaving] = useState(false);

  // Add question to Professor
  const addQuestion = () => {
    const newQ: TriviaQuestion = {
      id: `q-${Date.now()}`,
      question: "שאלה חדשה...",
      options: ["אפשרות 1", "אפשרות 2", "אפשרות 3", "אפשרות 4"],
      correct_index: 0,
      reward_type: "xp",
      reward_amount: 100,
      reward_label: "100 XP",
    };
    setQuestions([...questions, newQ]);
  };

  // Add Group Buy to Matchmaker
  const addGroupBuy = () => {
    const newGB: GroupBuyItem = {
      id: `gb-${Date.now()}`,
      title: "מוצר קבוצתי חדש",
      description: "תיאור המוצר המאוגד עבור הקבוצה",
      price: 199,
      target_members: 10,
      active: true,
      signups: [],
    };
    setGroupBuys([...groupBuys, newGB]);
  };

  const handleSaveAll = async () => {
    if (!npc?.id) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        trivia_questions: questions,
        vendor_product_ids: vendorProducts,
        shout_phrases: shoutPhrases,
        group_buys: groupBuys,
      };

      // Save to Firestore npcs collection
      await setDoc(doc(db, "npcs", npc.id), payload, { merge: true });

      // Invalidate query
      qc.invalidateQueries({ queryKey: ["all-npcs"] });
      qc.invalidateQueries({ queryKey: ["npcs-with-sprites"] });
      toast.success("הגדרות ה-NPC נשמרו בהצלחה!");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} dir="rtl">
      <div className="chrome-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 font-bold text-lg">
            <span>✨ עריכת NPC מתקדם:</span>
            <span className="text-primary">{npc?.name}</span>
          </div>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1 text-xs">✕</button>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-2 border-b border-border pb-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("professor")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === "professor" ? "bg-indigo-600 text-white" : "bg-muted/40 hover:bg-muted"
            }`}
          >
            🔬 הפרופסור (חידות יומיות)
          </button>
          <button
            onClick={() => setActiveTab("mystery")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === "mystery" ? "bg-amber-600 text-white" : "bg-muted/40 hover:bg-muted"
            }`}
          >
            🕵️ הסוחר המסתורי (מוצרים)
          </button>
          <button
            onClick={() => setActiveTab("matchmaker")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === "matchmaker" ? "bg-purple-600 text-white" : "bg-muted/40 hover:bg-muted"
            }`}
          >
            📢 השדכן (רכישות ובועות דיבור)
          </button>
        </div>

        {/* Professor Config Tab */}
        {activeTab === "professor" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">רשימת שאלות החידה היומית ({questions.length})</h4>
                <p className="text-xs text-muted-foreground">
                  בכל יום מוצגת לשחקן השאלה הבאה ברשימה. לאחר מענה (נכון או לא) הם לא יכולים לענות שוב באותו יום.
                </p>
              </div>
              <button onClick={addQuestion} className="btn-plastic !px-3 !py-1 text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> הוסף שאלה
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id || idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400">שאלה #{idx + 1}</span>
                    <button
                      onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">נוסח השאלה / החידה</label>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => {
                        const next = [...questions];
                        next[idx].question = e.target.value;
                        setQuestions(next);
                      }}
                      className="w-full rounded-xl border border-border bg-input px-3 py-1.5 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correct_index === optIdx}
                          onChange={() => {
                            const next = [...questions];
                            next[idx].correct_index = optIdx;
                            setQuestions(next);
                          }}
                          className="w-4 h-4 accent-indigo-500"
                          title="סמן כתשובה הנכונה"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...questions];
                            next[idx].options[optIdx] = e.target.value;
                            setQuestions(next);
                          }}
                          placeholder={`אפשרות ${optIdx + 1}`}
                          className="flex-1 rounded-lg border border-border bg-input px-2 py-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">סוג פרס</label>
                      <select
                        value={q.reward_type}
                        onChange={(e) => {
                          const next = [...questions];
                          next[idx].reward_type = e.target.value as any;
                          setQuestions(next);
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                      >
                        <option value="xp">נקודות XP</option>
                        <option value="gems">ג׳מס (קרדיטים)</option>
                        <option value="cosmetic">קוסמטיקה</option>
                        <option value="product">מוצר</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">כמות (XP/ג׳מס)</label>
                      <input
                        type="number"
                        value={q.reward_amount || 0}
                        onChange={(e) => {
                          const next = [...questions];
                          next[idx].reward_amount = Number(e.target.value);
                          setQuestions(next);
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">תווית פרס למשתמש</label>
                      <input
                        type="text"
                        value={q.reward_label}
                        onChange={(e) => {
                          const next = [...questions];
                          next[idx].reward_label = e.target.value;
                          setQuestions(next);
                        }}
                        placeholder="לדוגמה: 150 XP"
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mystery Vendor Tab */}
        {activeTab === "mystery" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold">בחירת מוצרים לסוחר המסתורי הנודד</h4>
              <p className="text-xs text-muted-foreground">
                הסוחר מתהלך במפה ומציע נקודתית את המוצרים הנבחרים הללו למי שלוחץ עליו.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto">
              {allProducts.map((p) => {
                const isSelected = vendorProducts.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) setVendorProducts(vendorProducts.filter((id) => id !== p.id));
                      else setVendorProducts([...vendorProducts, p.id]);
                    }}
                    className={`p-2.5 rounded-xl border text-right text-xs transition-all flex items-center gap-2 ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-500 text-white font-bold"
                        : "bg-slate-900 border-slate-800 text-muted-foreground hover:bg-slate-800"
                    }`}
                  >
                    <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0">
                      {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                    </div>
                    <span className="truncate flex-1">{p.name} ({p.credit_price} 💎)</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Matchmaker Tab */}
        {activeTab === "matchmaker" && (
          <div className="space-y-5">
            {/* Shout phrases while walking */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold">📢 טקסטים ובועות כרוז בזמן הליכה</h4>
              <p className="text-xs text-muted-foreground">
                הדמות תצעק את המשפטים הללו במרווחי זמנים אקראיים תוך כדי שוטטות במפה.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  placeholder="הוסף קריאת כרוז חדשה..."
                  className="flex-1 rounded-xl border border-border bg-input px-3 py-1.5 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newPhrase.trim()) {
                      setShoutPhrases([...shoutPhrases, newPhrase.trim()]);
                      setNewPhrase("");
                    }
                  }}
                  className="btn-plastic !px-3 !py-1 text-xs"
                >
                  הוסף
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {shoutPhrases.map((phrase, pIdx) => (
                  <span
                    key={pIdx}
                    className="inline-flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs px-2.5 py-1 rounded-full font-semibold"
                  >
                    <span>&ldquo;{phrase}&rdquo;</span>
                    <button
                      type="button"
                      onClick={() => setShoutPhrases(shoutPhrases.filter((_, i) => i !== pIdx))}
                      className="text-purple-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Group Buys list & registered participants */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold">רשימות רכישה קבוצתית ומשתתפים רשומים</h4>
                  <p className="text-xs text-muted-foreground">צפו בכל מי שנרשם עם שם משתמש, מייל וטלפון.</p>
                </div>
                <button onClick={addGroupBuy} className="btn-plastic !px-3 !py-1 text-xs flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> הוסף מוצר לקבוצה
                </button>
              </div>

              <div className="space-y-3">
                {groupBuys.map((gb, gbIdx) => (
                  <div key={gb.id || gbIdx} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-400">קבוצה #{gbIdx + 1}</span>
                      <button
                        onClick={() => setGroupBuys(groupBuys.filter((_, i) => i !== gbIdx))}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">שם המוצר</label>
                        <input
                          type="text"
                          value={gb.title}
                          onChange={(e) => {
                            const next = [...groupBuys];
                            next[gbIdx].title = e.target.value;
                            setGroupBuys(next);
                          }}
                          className="w-full rounded-xl border border-border bg-input px-2.5 py-1 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">מחיר (₪)</label>
                        <input
                          type="number"
                          value={gb.price}
                          onChange={(e) => {
                            const next = [...groupBuys];
                            next[gbIdx].price = Number(e.target.value);
                            setGroupBuys(next);
                          }}
                          className="w-full rounded-xl border border-border bg-input px-2.5 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">תיאור</label>
                      <input
                        type="text"
                        value={gb.description}
                        onChange={(e) => {
                          const next = [...groupBuys];
                          next[gbIdx].description = e.target.value;
                          setGroupBuys(next);
                        }}
                        className="w-full rounded-xl border border-border bg-input px-2.5 py-1 text-xs"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1.5">
                        <Users className="w-4 h-4" />
                        <span>רשימת נרשמים לקבוצה זו ({gb.signups?.length || 0}):</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {!gb.signups || gb.signups.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">אין נרשמים עדיין לקבוצה זו.</p>
                        ) : (
                          gb.signups.map((s, sIdx) => (
                            <div key={sIdx} className="p-1.5 rounded-lg bg-slate-800/80 text-[11px] flex items-center justify-between">
                              <span className="font-bold">{s.username}</span>
                              <span className="text-muted-foreground font-mono">{s.email}</span>
                              <span className="text-purple-300 font-mono font-bold">{s.phone}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button onClick={onClose} className="chrome-panel px-4 py-1.5 text-xs">ביטול</button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="btn-plastic !px-5 !py-1.5 text-xs font-bold"
          >
            {saving ? "שומר..." : "שמור שינויים 💾"}
          </button>
        </div>
      </div>
    </div>
  );
}
