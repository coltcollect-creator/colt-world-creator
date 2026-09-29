import { useEffect, useState } from "react";
import {
  fetchAllAlbumCards,
  saveAlbumCard,
  deleteAlbumCard,
  type AlbumCard,
  type CardRarity,
} from "@/lib/album-cards";
import { ImageUpload } from "@/components/owner/ImageUpload";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Edit3, Lock, Trophy, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const input = "mt-1 w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-xs";

export function AlbumManagerPanel() {
  const [cards, setCards] = useState<AlbumCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<AlbumCard | null>(null);
  const [isNew, setIsNew] = useState(false);

  const loadCards = async () => {
    setLoading(true);
    try {
      const list = await fetchAllAlbumCards();
      setCards(list);
    } catch (err) {
      toast.error("שגיאה בטעינת קלפי האלבום");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const openNew = () => {
    const nextNum = cards.length > 0 ? Math.max(...cards.map((c) => c.card_number)) + 1 : 1;
    setEditingCard({
      id: `card-${Date.now()}`,
      card_number: nextNum,
      title: "",
      description: "",
      image_url: "",
      rarity: "common",
      source_type: "quest",
      source_name: "משימה חדשה",
      active: true,
    });
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editingCard) return;
    if (!editingCard.title.trim()) {
      toast.error("נא להזין שם לקלף");
      return;
    }
    if (!editingCard.image_url) {
      toast.error("נא להעלות תמונה לקלף");
      return;
    }

    try {
      await saveAlbumCard(editingCard);
      toast.success(isNew ? "הקלף נוצר בהצלחה!" : "הקלף עודכן בהצלחה!");
      setEditingCard(null);
      loadCards();
    } catch (err) {
      toast.error("שגיאה בשמירת הקלף");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("האם למחוק קלף זה מאלבום הכנס?")) return;
    try {
      await deleteAlbumCard(id);
      toast.success("הקלף נמחק");
      loadCards();
    } catch (err) {
      toast.error("שגיאה במחיקת הקלף");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <span>🃏 ניהול אלבום מדבקות דיגיטלי (Digital Event Album)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            הגדירו את אוסף הקלפים של הכנס. כל קלף ניתן להגדרה כפרס בהשלמת משימות או פתיחת תיבות אוצר.
          </p>
        </div>

        <button
          onClick={openNew}
          className="btn-plastic flex items-center gap-1.5 text-xs font-bold"
        >
          <Plus className="h-4 w-4" />
          <span>+ הוסף קלף חדש לאלבום</span>
        </button>
      </div>

      {loading ? (
        <div className="chrome-panel py-12 text-center text-xs text-muted-foreground">
          טוען קלפים...
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.id}
              className="chrome-panel flex flex-col justify-between overflow-hidden p-3 transition-all hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-white">
                    #{String(c.card_number).padStart(2, "0")}
                  </span>
                  <span className="capitalize">{c.rarity}</span>
                </div>

                <div className="my-2 aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-black/5">
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      אין תמונה
                    </div>
                  )}
                </div>

                <div className="font-black text-sm">{c.title}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                  {c.description || "אין תיאור"}
                </div>
                <div className="mt-2 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                  מקור: {c.source_name || c.source_type}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-border">
                <button
                  onClick={() => {
                    setEditingCard(c);
                    setIsNew(false);
                  }}
                  className="flex-1 rounded-lg bg-muted py-1 text-center text-xs font-bold hover:bg-muted/80 flex items-center justify-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>ערוך</span>
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-lg bg-destructive/10 p-1 text-destructive hover:bg-destructive/20"
                  title="מחק קלף"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card Editor Dialog */}
      {editingCard && (
        <Dialog open={!!editingCard} onOpenChange={() => setEditingCard(null)}>
          <DialogContent className="max-w-lg p-5 rounded-3xl border-4 border-white shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <span>{isNew ? "✨ הוספת קלף חדש לאלבום" : "✏️ עריכת קלף אלבום"}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-2">
                  <span className="font-semibold">שם הקלף</span>
                  <input
                    value={editingCard.title}
                    onChange={(e) =>
                      setEditingCard({ ...editingCard, title: e.target.value })
                    }
                    placeholder="לדוגמה: כרטיס אגדת COLT"
                    className={input}
                  />
                </label>
                <label>
                  <span className="font-semibold">מספר קלף</span>
                  <input
                    type="number"
                    value={editingCard.card_number}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        card_number: Number(e.target.value),
                      })
                    }
                    className={input}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="font-semibold">דרגת נדירות</span>
                  <select
                    value={editingCard.rarity}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        rarity: e.target.value as CardRarity,
                      })
                    }
                    className={input}
                  >
                    <option value="common">נפוץ (Common)</option>
                    <option value="rare">נדיר (Rare)</option>
                    <option value="epic">אפי (Epic)</option>
                    <option value="legendary">אגדי (Legendary)</option>
                  </select>
                </label>
                <label>
                  <span className="font-semibold">סוג מקור פרס</span>
                  <select
                    value={editingCard.source_type}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        source_type: e.target.value as any,
                      })
                    }
                    className={input}
                  >
                    <option value="quest">משימה (Quest)</option>
                    <option value="treasure">תיבת אוצר (Treasure)</option>
                    <option value="event">אירוע כנס (Event)</option>
                    <option value="custom">אחר</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="font-semibold">הנחיית פתיחה / משימה משויכת</span>
                <input
                  value={editingCard.source_name || ""}
                  onChange={(e) =>
                    setEditingCard({ ...editingCard, source_name: e.target.value })
                  }
                  placeholder="לדוגמה: השלימו משימת כניסה ראשונה לעולם"
                  className={input}
                />
              </label>

              <label className="block">
                <span className="font-semibold">תיאור הקלף והסיפור</span>
                <textarea
                  value={editingCard.description}
                  onChange={(e) =>
                    setEditingCard({ ...editingCard, description: e.target.value })
                  }
                  rows={2}
                  placeholder="התיאור שיוצג באלבום כאשר המשתמש לוחץ על הקלף..."
                  className={input}
                />
              </label>

              <div>
                <span className="font-semibold block mb-1">
                  תמונת הקלף (שומרת שקיפות ללא רקע שחור)
                </span>
                <ImageUpload
                  value={editingCard.image_url}
                  folder="cards"
                  onChange={(url) =>
                    setEditingCard({ ...editingCard, image_url: url || "" })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingCard(null)}
                  className="rounded-xl bg-muted px-4 py-2 font-bold"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-plastic px-5 py-2 font-black text-xs"
                >
                  שמור קלף ✅
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
