import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveStoredAudioPreferences, getStoredAudioPreferences } from "@/lib/audio-manager";
import { Volume2, Music, Bell, MessageSquare, Shield, LogOut, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "הגדרות חשבון ושמע — COLT Market World" }] }),
  component: Settings,
});

function Settings() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const [settings, setSettings] = useState<Record<string, unknown>>(profile?.settings ?? {});
  const [localPrefs, setLocalPrefs] = useState(() => getStoredAudioPreferences());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.settings) {
      setSettings(profile.settings);
    }
  }, [profile?.settings]);

  const save = async (newSettings = settings) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ settings: newSettings as never }).eq("id", user.id);
      if (error) toast.error("שגיאה בשמירה: " + error.message);
      else {
        toast.success("ההגדרות נשמרו בהצלחה!");
        refreshProfile();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: string, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    if (key === "music") {
      saveStoredAudioPreferences({ muted: !value });
      setLocalPrefs((p) => ({ ...p, muted: !value }));
    }
    save(updated);
  };

  const handleVolumeChange = (vol: number) => {
    const updated = { ...settings, music_volume: vol };
    setSettings(updated);
    saveStoredAudioPreferences({ volume: vol, muted: false });
    setLocalPrefs((p) => ({ ...p, volume: vol, muted: false }));
    save(updated);
  };

  return (
    <div dir="rtl" className="max-w-xl mx-auto space-y-5">
      <div className="chrome-panel p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground font-black text-xl shadow-md">
            ⚙️
          </div>
          <div>
            <h1 className="text-xl font-black">הגדרות שחקן ושמע</h1>
            <p className="text-xs text-muted-foreground">התאימו אישית את עוצמת הסאונד, מוזיקת הרקע וחווית המשחק</p>
          </div>
        </div>

        {/* Audio & Sound Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Volume2 className="h-4 w-4" />
            <span>הגדרות סאונד ומוזיקת רקע</span>
          </h2>

          <div className="space-y-2">
            <label className="flex items-center justify-between rounded-2xl bg-muted/60 hover:bg-muted p-3.5 border border-border cursor-pointer transition-all">
              <div className="flex items-center gap-2.5">
                <Music className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-bold text-xs block text-foreground">מוזיקת רקע (BGM)</span>
                  <span className="text-[11px] text-muted-foreground">הפעלת מוזיקת רקע אווירתית ברחבי המתחם</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.music !== false}
                onChange={(e) => handleToggle("music", e.target.checked)}
                className="h-5 w-5 rounded accent-primary cursor-pointer"
              />
            </label>

            {/* Music volume slider */}
            {settings.music !== false && (
              <div className="rounded-2xl bg-muted/40 p-3.5 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">עוצמת מוזיקת רקע:</span>
                  <span className="font-mono font-bold text-primary">
                    {Math.round(((typeof settings.music_volume === "number" ? settings.music_volume : localPrefs.volume) * 100))}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={typeof settings.music_volume === "number" ? settings.music_volume : localPrefs.volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full bg-muted cursor-pointer accent-primary"
                />
              </div>
            )}

            <label className="flex items-center justify-between rounded-2xl bg-muted/60 hover:bg-muted p-3.5 border border-border cursor-pointer transition-all">
              <div className="flex items-center gap-2.5">
                <Volume2 className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-bold text-xs block text-foreground">אפקטי קול (SFX)</span>
                  <span className="text-[11px] text-muted-foreground">צלילי לחיצות, זכיות בפרסים וקפיצות במשחק</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.sound !== false}
                onChange={(e) => handleToggle("sound", e.target.checked)}
                className="h-5 w-5 rounded accent-primary cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Chat & Privacy Section */}
        <div className="space-y-3 pt-2 border-t border-border">
          <h2 className="text-xs font-bold text-primary flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span>צ'אט ותקשורת</span>
          </h2>

          <div className="space-y-2">
            <label className="flex items-center justify-between rounded-2xl bg-muted/60 hover:bg-muted p-3.5 border border-border cursor-pointer transition-all">
              <div>
                <span className="font-bold text-xs block text-foreground">צ'אט ציבורי גלוי</span>
                <span className="text-[11px] text-muted-foreground">הצגת הודעות צ'אט חי משחקנים אחרים</span>
              </div>
              <input
                type="checkbox"
                checked={settings.chat_visible !== false}
                onChange={(e) => handleToggle("chat_visible", e.target.checked)}
                className="h-5 w-5 rounded accent-primary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between rounded-2xl bg-muted/60 hover:bg-muted p-3.5 border border-border cursor-pointer transition-all">
              <div>
                <span className="font-bold text-xs block text-foreground">אפשר הודעות פרטיות</span>
                <span className="text-[11px] text-muted-foreground">קבלת שיחות ופניות מחנויות ומשחקנים</span>
              </div>
              <input
                type="checkbox"
                checked={settings.pm_allowed !== false}
                onChange={(e) => handleToggle("pm_allowed", e.target.checked)}
                className="h-5 w-5 rounded accent-primary cursor-pointer"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => save()}
            disabled={isSaving}
            className="btn-plastic px-5 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            <span>{isSaving ? "שומר..." : "שמור שינויים"}</span>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="px-4 py-2 rounded-xl text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>התנתקות</span>
          </button>
        </div>
      </div>
    </div>
  );
}

