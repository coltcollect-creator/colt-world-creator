import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Lock, CheckCircle, ArrowRight } from "lucide-react";
import type { RoomLockRule } from "@/lib/npcs-system";

interface Props {
  rule: RoomLockRule;
  roomName: string;
  userLevel: number;
  userCosmetics: string[];
  userAlbumCards: string[];
  onSuccess: () => void;
  onClose: () => void;
}

export function BouncerCheckModal({
  rule,
  roomName,
  userLevel,
  userCosmetics,
  userAlbumCards,
  onSuccess,
  onClose,
}: Props) {
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Check conditions
  let canEnter = false;
  let reason = "";

  if (!rule.is_locked || rule.lock_type === "none") {
    canEnter = true;
  } else if (rule.lock_type === "level") {
    const minLvl = rule.min_level || 1;
    canEnter = userLevel >= minLvl;
    if (!canEnter) reason = `אזור זה סגור לשחקנים מתחת לרמה ${minLvl}. (הרמה הנוכחית שלך: ${userLevel})`;
  } else if (rule.lock_type === "password") {
    canEnter = false; // requires password check button
    reason = "מתחם מאובטח! עליך להזין את הסיסמה הנכונה כדי ששומר השער יאפשר לך להיכנס.";
  } else if (rule.lock_type === "album_card") {
    const cardId = rule.required_card_id;
    canEnter = Boolean(cardId && userAlbumCards.includes(cardId));
    if (!canEnter) reason = "רק מי שמחזיק בקלף הנדרש באלבום הכנס של COLT רשאי להיכנס למתחם זה!";
  } else if (rule.lock_type === "cosmetic") {
    const cosId = rule.required_cosmetic_id;
    canEnter = Boolean(cosId && userCosmetics.includes(cosId));
    if (!canEnter) reason = "רק שחקנים שלובשים את פריט הלבוש / הקוסמטיקה המיוחדת מורשים לעבור את השומר!";
  }

  const handlePasswordSubmit = () => {
    if (passwordInput.trim() === (rule.password || "").trim()) {
      onSuccess();
    } else {
      setPasswordError(true);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-2 border-red-500/50 text-white rounded-3xl p-6" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-400 flex items-center justify-center text-2xl">
              💂
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-red-300">
                שומר השער (VIP Guard)
              </DialogTitle>
              <p className="text-xs text-muted-foreground">עצור! בדיקת כניסה למתחם: {roomName}</p>
            </div>
          </div>
        </DialogHeader>

        {canEnter ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 mx-auto flex items-center justify-center text-emerald-300">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-emerald-300">הבדיקה עברה בהצלחה!</h4>
            <p className="text-xs text-muted-foreground">אתה עומד בכל הדרישות. השומר מפנה לך את הדרך בחיוך רחב.</p>
            <Button onClick={onSuccess} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
              היכנס למתחם 🚪
            </Button>
          </div>
        ) : rule.lock_type === "password" ? (
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-slate-300">
              💂 השומר אומר: &ldquo;סודי ביותר! רק בעלי הסיסמה הסודית רשאים לעבור.&rdquo;
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">הזן סיסמת כניסה:</label>
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                placeholder="הקלד סיסמה..."
                className="bg-slate-950 border-slate-700 text-white font-mono"
              />
              {passwordError && (
                <p className="text-xs text-rose-400 font-bold">סיסמה שגויה! השומר מסרב להכניסך.</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handlePasswordSubmit} className="flex-1 bg-red-600 hover:bg-red-700 font-bold rounded-xl">
                בדיקת סיסמה
              </Button>
              <Button onClick={onClose} variant="outline" className="rounded-xl border-slate-700 text-slate-300">
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border-2 border-rose-400 mx-auto flex items-center justify-center text-rose-300">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-rose-300">הכניסה חסומה!</h4>
            <p className="text-xs text-rose-200/90 leading-relaxed bg-rose-950/40 p-3 rounded-2xl border border-rose-500/30">
              {rule.lock_message || reason}
            </p>
            <Button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl">
              הבנתי, אחזור מאוחר יותר
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
