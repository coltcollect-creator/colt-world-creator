import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — COLT" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase places recovery tokens in the URL hash; the client will parse them.
    setReady(true);
  }, []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/auth" });
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  if (!ready) return null;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handle} className="chrome-panel w-full max-w-md p-8 space-y-3">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-xl border-2 border-border bg-input px-3 py-2"
          required
        />
        <button disabled={busy} className="btn-plastic w-full">{busy ? "Updating…" : "Update password"}</button>
      </form>
    </div>
  );
}
