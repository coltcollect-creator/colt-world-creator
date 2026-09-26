import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { sendVerificationCode, submitVerificationCode } from "@/lib/email-verification.functions";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "אימות חשבון — COLT" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { user, profile, refreshProfile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const send = useServerFn(sendVerificationCode);
  const submit = useServerFn(submitVerificationCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoSentRef = useRef(false);

  const { isOwner } = useAuth();
  useEffect(() => {
    if (!loading && (profile?.email_verified || isOwner)) {
      navigate({ to: "/play" });
    }
  }, [loading, profile?.email_verified, isOwner, navigate]);


  const sendCode = async (silent = false) => {
    setSending(true);
    try {
      const res = await send();
      if (res.alreadyVerified) {
        await refreshProfile();
        return;
      }
      if (!silent) toast.success("שלחנו קוד אימות למייל שלך");
      setCooldown(45);
    } catch (e) {
      toast.error((e as Error).message || "לא הצלחנו לשלוח קוד, נסה שוב");
    } finally {
      setSending(false);
    }
  };

  // Auto-send a code on first mount
  useEffect(() => {
    if (!user || autoSentRef.current || loading) return;
    if (profile?.email_verified) return;
    autoSentRef.current = true;
    sendCode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, profile?.email_verified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error("הקוד חייב להיות 6 ספרות");
      return;
    }
    setBusy(true);
    try {
      const res = await submit({ data: { code } });
      if (!res.ok) {
        const map: Record<string, string> = {
          invalid: "קוד שגוי",
          expired: "הקוד פג תוקף — שלח קוד חדש",
          too_many_attempts: "יותר מדי ניסיונות — שלח קוד חדש",
          no_code: "אין קוד פעיל — שלח קוד חדש",
        };
        toast.error(map[res.reason ?? ""] ?? "אימות נכשל");
        return;
      }
      toast.success("החשבון אומת בהצלחה 🎉");
      await refreshProfile();
      navigate({ to: "/play" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6">
      <div className="chrome-panel w-full max-w-md p-8 text-right">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground font-black">C</div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">אימות חשבון</h1>
            <p className="text-xs text-muted-foreground">שלחנו קוד בן 6 ספרות למייל שלך</p>
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          כדי להיכנס למשחק, הזן/י את הקוד ששלחנו אל <strong className="text-foreground">{user?.email}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-primary"
            autoFocus
          />
          <button disabled={busy || code.length !== 6} className="btn-plastic w-full">
            {busy ? "מאמת…" : "אמת חשבון"}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs">
          <button
            type="button"
            disabled={sending || cooldown > 0}
            onClick={() => sendCode(false)}
            className="underline disabled:opacity-50"
          >
            {cooldown > 0 ? `שלח קוד חדש (${cooldown})` : sending ? "שולח…" : "שלח קוד חדש"}
          </button>
          <button type="button" onClick={signOut} className="underline text-muted-foreground">
            התנתק
          </button>
        </div>
      </div>
    </div>
  );
}
