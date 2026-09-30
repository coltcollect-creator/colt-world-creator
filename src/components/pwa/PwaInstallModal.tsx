import React, { useState } from "react";
import { usePwaDevice, type DeviceType } from "@/hooks/use-pwa-device";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Download,
  Smartphone,
  Laptop,
  Share2,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  X,
  Sparkles,
  Compass,
} from "lucide-react";

export function PwaInstallButton({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { isInstalled } = usePwaDevice();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-95 transition-all"
        }
        title="הורדת האפליקציה למכשיר (PWA)"
      >
        <Download className="h-3.5 w-3.5 animate-bounce" />
        <span>{compact ? "הורדה" : isInstalled ? "הורדת האפליקציה (PWA)" : "הורדת האפליקציה"}</span>
      </button>

      {open && <PwaInstallModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function PwaInstallModal({ onClose }: { onClose: () => void }) {
  const { deviceType: detectedDevice, isInstalled, isInstallable, promptInstall } = usePwaDevice();
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>(detectedDevice);
  const [installing, setInstalling] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["game-settings"],
    queryFn: async () => (await supabase.from("game_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const handleDirectInstall = async () => {
    setInstalling(true);
    const success = await promptInstall();
    setInstalling(false);
    if (success) {
      onClose();
    }
  };

  const iosStep1 = settings?.pwa_ios_step1 || "לחצו על כפתור השיתוף / פעולות בסרגל של Safari (סמל ריבוע עם חץ עולה ⬆️ בתחתית המסך)";
  const iosStep2 = settings?.pwa_ios_step2 || "גללו מעט ברשימת האפשרויות ולחצו על ״הוסף למסך הבית״ (Add to Home Screen ➕)";
  const iosStep3 = settings?.pwa_ios_step3 || "לחצו על ״הוסף״ (Add) בפינה השמאלית העליונה — והאפליקציה מוכנה על מסך הבית שלכם!";

  const androidStep1 = settings?.pwa_android_step1 || "פתחו את תפריט הדפדפן (לחצו על שלוש הנקודות ⋮ בפינת המסך ב-Chrome)";
  const androidStep2 = settings?.pwa_android_step2 || "בחרו בתפריט ״התקן אפליקציה״ (Install app) או ״הוסף למסך הבית״";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="chrome-panel w-full max-w-lg p-0 overflow-hidden rounded-3xl shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 p-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 start-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            title="סגור"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 pe-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner text-2xl">
              📲
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-pink-200">
                <Sparkles className="h-3.5 w-3.5" />
                <span>PWA · התקנה ישירה וקלה</span>
              </div>
              <h2 className="text-xl font-black">הורדת האפליקציה למכשיר</h2>
              <p className="text-xs text-white/80">
                הוסיפו את COLT Market World למסך הבית שלכם לחוויה חלקה במסך מלא
              </p>
            </div>
          </div>

          {/* Device Tabs */}
          <div className="mt-4 flex gap-1.5 rounded-2xl bg-black/20 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setSelectedDevice("ios")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all ${
                selectedDevice === "ios"
                  ? "bg-white text-purple-900 shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>iPhone / iPad</span>
              {detectedDevice === "ios" && <span className="text-[10px] opacity-70">(זוהה)</span>}
            </button>

            <button
              type="button"
              onClick={() => setSelectedDevice("android")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all ${
                selectedDevice === "android"
                  ? "bg-white text-purple-900 shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Android</span>
              {detectedDevice === "android" && <span className="text-[10px] opacity-70">(זוהה)</span>}
            </button>

            <button
              type="button"
              onClick={() => setSelectedDevice("desktop")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold transition-all ${
                selectedDevice === "desktop"
                  ? "bg-white text-purple-900 shadow-md"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>מחשב</span>
              {detectedDevice === "desktop" && <span className="text-[10px] opacity-70">(זוהה)</span>}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Already installed banner */}
          {isInstalled && (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="text-xs font-bold">
                האפליקציה כבר מותקנת במכשיר זה! אתם מחוברים בחלון עצמאי.
              </div>
            </div>
          )}

          {/* Direct Install prompt button for Chromium/Desktop if available */}
          {isInstallable && (selectedDevice === "android" || selectedDevice === "desktop") && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-center space-y-2">
              <div className="text-xs font-bold text-foreground">
                הדפדפן שלכם תומך בהתקנה אוטומטית בלחיצה אחת:
              </div>
              <button
                type="button"
                disabled={installing}
                onClick={handleDirectInstall}
                className="w-full btn-plastic flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black text-sm py-2.5 shadow-md hover:brightness-105 active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>{installing ? "מתקין…" : "התקן את האפליקציה עכשיו"}</span>
              </button>
            </div>
          )}

          {/* iOS Safari instructions */}
          {selectedDevice === "ios" && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-pink-500/10 border border-pink-500/20 p-3 text-xs flex items-center gap-2">
                <Compass className="h-4 w-4 text-pink-600 shrink-0" />
                <span className="text-foreground">
                  במכשירי <strong>iPhone / iPad</strong> מומלץ לפתוח בדפדפן <strong>Safari</strong> להתקנה מהירה:
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Step 1 */}
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-pink-500 text-white text-xs font-black">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{iosStep1}</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5 pt-0.5">
                      <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] border border-border">
                        <Share2 className="h-3 w-3 inline text-primary mr-1" />
                        סמל השיתוף (ריבוע עם חץ עולה ⬆️ בסרגל התחתון)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-purple-500 text-white text-xs font-black">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{iosStep2}</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5 pt-0.5">
                      <span className="inline-block rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] border border-border">
                        <PlusSquare className="h-3 w-3 inline text-purple-500 mr-1" />
                        הוסף למסך הבית (Add to Home Screen)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white text-xs font-black">
                    3
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold">{iosStep3}</div>
                    <div className="text-muted-foreground">
                      אייקון האפליקציה יתווסף למסך הבית ויפעל כחלון אפליקציה מלא ללא צורך בהורדה מ-App Store.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Chrome instructions */}
          {selectedDevice === "android" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-muted-foreground">
                מדריך התקנה ל-Android (דפדפן Chrome / Samsung Internet):
              </div>

              <div className="space-y-2.5">
                {/* Step 1 */}
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-pink-500 text-white text-xs font-black">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{androidStep1}</span>
                      <MoreVertical className="h-3.5 w-3.5 text-primary inline" />
                    </div>
                    <div className="text-muted-foreground">
                      לחצו על שלוש הנקודות בפינה העליונה של הדפדפן.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-purple-500 text-white text-xs font-black">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{androidStep2}</span>
                      <Download className="h-3.5 w-3.5 text-purple-500 inline" />
                    </div>
                    <div className="text-muted-foreground">
                      אשרו את ההתקנה והאייקון יתווסף למגירת האפליקציות ולמסך הבית.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop instructions */}
          {selectedDevice === "desktop" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-muted-foreground">
                התקנה במחשב (דפדפן Chrome / Edge / Brave):
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-pink-500 text-white text-xs font-black">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold">סמל ההתקנה בשורת הכתובת</div>
                    <div className="text-muted-foreground">
                      חפשו את סמל ההורדה ⬇️ או המחשב בתוך שורת הכתובת בצד שמאל/ימין.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-purple-500 text-white text-xs font-black">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold">לחצו ״התקן״ (Install)</div>
                    <div className="text-muted-foreground">
                      הכנס ייפתח בחלון עצמאי, מהיר וללא שורות דפדפן.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Benefits summary */}
          <div className="rounded-2xl bg-muted/40 border border-border p-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>⚡</span> טעינה מהירה יותר
            </span>
            <span className="flex items-center gap-1.5">
              <span>🎮</span> מסך מלא ללא סרגלים
            </span>
            <span className="flex items-center gap-1.5">
              <span>🔒</span> מאובטח וקל לשימוש
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/20 p-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-plastic px-4 py-1.5 text-xs font-bold"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
