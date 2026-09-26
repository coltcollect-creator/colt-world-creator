import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

function Settings() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const [settings, setSettings] = useState<Record<string, unknown>>(profile?.settings ?? {});
  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ settings: settings as never }).eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); refreshProfile(); }
  };
  return (
    <div className="chrome-panel p-6 max-w-lg">
      <h1 className="text-xl font-bold mb-3">Settings</h1>
      <div className="space-y-2 text-sm">
        <Toggle label="Sound" k="sound" v={settings} setV={setSettings} />
        <Toggle label="Music" k="music" v={settings} setV={setSettings} />
        <Toggle label="Public chat visible" k="chat_visible" v={settings} setV={setSettings} />
        <Toggle label="Allow private messages" k="pm_allowed" v={settings} setV={setSettings} />
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-plastic" onClick={save}>Save</button>
        <button className="chrome-panel px-4 py-2" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}

function Toggle({ label, k, v, setV }: { label: string; k: string; v: Record<string, unknown>; setV: (v: Record<string, unknown>) => void }) {
  const checked = (v[k] as boolean) ?? true;
  return (
    <label className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => setV({ ...v, [k]: e.target.checked })} />
    </label>
  );
}
