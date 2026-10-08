import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { GroupBuyItem } from "@/lib/npcs-system";
import { Users, Phone, Mail, User, CheckCircle2, ShoppingCart } from "lucide-react";

interface Props {
  npc: any;
  onClose: () => void;
}

export function MatchmakerModal({ npc, onClose }: Props) {
  const { user, profile } = useAuth();
  const [groupBuys, setGroupBuys] = useState<GroupBuyItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<GroupBuyItem | null>(null);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        let items: GroupBuyItem[] = npc?.group_buys || [];
        if (!items.length) {
          const npcSnap = await getDoc(doc(db, "npcs", npc?.id || "npc-matchmaker"));
          if (npcSnap.exists()) {
            items = npcSnap.data()?.group_buys || [];
          }
        }

        if (!items.length) {
          // Fallback initial group buy item
          items = [
            {
              id: "gb-pokemon-151",
              title: "מארז בוסטר 151 יפני (Pokémon 151 Booster Box)",
              description: "יבוא מיוחד וישיר של קופסאות אטומות לחלוטין. קבוצה מאוחדת זוכה למחיר עלות סיטונאי!",
              price: 249,
              target_members: 10,
              image_url: "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=500&auto=format&fit=crop&q=80",
              active: true,
              signups: [],
            },
          ];
        }

        setGroupBuys(items);
        if (items.length > 0) {
          setSelectedItem(items[0]);
          const joined = Boolean(items[0].signups?.some((s) => s.user_id === user?.id));
          setHasJoined(joined);
        }
      } catch (err) {
        console.error("Error loading group buys:", err);
      }
    }
    loadData();
  }, [npc, user]);

  const handleSelect = (item: GroupBuyItem) => {
    setSelectedItem(item);
    setHasJoined(Boolean(item.signups?.some((s) => s.user_id === user?.id)));
  };

  const handleJoin = async () => {
    if (!user || !selectedItem || submitting) return;
    if (!phone.trim() || phone.trim().length < 9) {
      toast.error("אנא הזינו מספר טלפון נייד תקין ליצירת קשר");
      return;
    }

    setSubmitting(true);
    try {
      const npcRef = doc(db, "npcs", npc?.id || "npc-matchmaker");
      const snap = await getDoc(npcRef);
      const prevData = snap.exists() ? snap.data() : {};
      const currentList: GroupBuyItem[] = prevData.group_buys || groupBuys;

      const updated = currentList.map((item) => {
        if (item.id === selectedItem.id) {
          const newSignup = {
            user_id: user.id,
            username: profile?.username || user.email?.split("@")[0] || "משתמש",
            email: user.email || "",
            phone: phone.trim(),
            created_at: new Date().toISOString(),
          };
          return {
            ...item,
            signups: [...(item.signups || []).filter((s) => s.user_id !== user.id), newSignup],
          };
        }
        return item;
      });

      await setDoc(npcRef, { ...prevData, group_buys: updated }, { merge: true });
      setGroupBuys(updated);
      setHasJoined(true);
      toast.success("נרשמת בהצלחה לקבוצת הרכישה! השדכן רשם את פרטיך 🎉");
    } catch (err: any) {
      toast.error(err?.message || "שגיאה ברישום לקבוצה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-2 border-purple-500/50 text-white rounded-3xl p-6" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400 flex items-center justify-center text-2xl">
              📢
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-purple-300">
                השדכן: רכישות קבוצתיות ו-Waitlist
              </DialogTitle>
              <p className="text-xs text-muted-foreground">מתאגדים יחד כוח קנייה ומשיגים מוצרים ומחירים בלעדיים!</p>
            </div>
          </div>
        </DialogHeader>

        {groupBuys.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-2">
            {groupBuys.map((gb) => (
              <button
                key={gb.id}
                type="button"
                onClick={() => handleSelect(gb)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                  selectedItem?.id === gb.id
                    ? "bg-purple-600 text-white border-purple-400"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {gb.title}
              </button>
            ))}
          </div>
        )}

        {selectedItem && (
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex gap-3.5">
              {selectedItem.image_url ? (
                <img src={selectedItem.image_url} alt="" className="w-20 h-20 object-contain rounded-xl bg-slate-900/60 p-1 shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-purple-900/40 flex items-center justify-center text-3xl shrink-0">
                  📦
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black text-white">{selectedItem.title}</h4>
                <p className="text-xs text-purple-200/80 line-clamp-2 mt-1">{selectedItem.description}</p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="font-bold text-amber-300">מחיר מועדון: ₪{selectedItem.price}</span>
                  <span className="flex items-center gap-1 text-purple-300 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    {selectedItem.signups?.length || 0} נרשמו
                  </span>
                </div>
              </div>
            </div>

            {hasJoined ? (
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h5 className="text-sm font-bold text-emerald-300">אתם רשומים ברשימת השדכן!</h5>
                <p className="text-xs text-emerald-200/80">
                  ברגע שנגיע ליעד הנרשמים תקבלו הודעת SMS ואימייל להשלמת הרכישה.
                </p>
                <Button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl mt-2">
                  סגירה
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> שם משתמש:
                  </label>
                  <Input
                    readOnly
                    value={profile?.username || user?.email || "שחקן"}
                    className="bg-slate-950/60 border-slate-700 text-muted-foreground text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> אימייל לעדכונים:
                  </label>
                  <Input
                    readOnly
                    value={user?.email || ""}
                    className="bg-slate-950/60 border-slate-700 text-muted-foreground text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-purple-400" /> מספר טלפון נייד: *
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="050-1234567"
                    className="bg-slate-950 border-purple-500/50 text-white text-xs font-mono"
                  />
                </div>

                <Button
                  onClick={handleJoin}
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold rounded-xl py-2.5 text-sm shadow-lg shadow-purple-500/25"
                >
                  {submitting ? "רושם אותך..." : "הצטרף עכשיו לקבוצת הרכישה 🤝"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
