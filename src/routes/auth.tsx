import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({ meta: [{ title: "התחברות ופתיחת חשבון — COLT Market World" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (next) window.location.replace(next);
      else navigate({ to: "/play" });
    }
  }, [user, loading, navigate, next]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      const res = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (res.error) {
        const errCode = (res.error as any).code || "";
        if (errCode === "auth/popup-closed-by-user") {
          toast.info("ההתחברות בוטלה על ידך");
        } else if (errCode === "auth/popup-blocked") {
          toast.error("הדפדפן חסם את חלון ההתחברות הקופץ. אנא אפשרו חלונות קופצים (Popups) ונסו שוב.");
        } else {
          toast.error("שגיאה בהתחברות: " + (res.error.message || "נא לנסות שוב"));
        }
      } else {
        toast.success("התחברת בהצלחה!");
        if (next) window.location.replace(next);
        else navigate({ to: "/play" });
      }
    } catch (err) {
      toast.error((err as Error).message || "שגיאה בהתחברות עם Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/40">
      <div className="chrome-panel w-full max-w-md p-8 shadow-2xl border-2 border-primary/20">
        <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">← חזרה למתחם היריד</Link>
        
        <div className="mb-6 mt-3 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-md">
            C
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight">COLT Market World</h1>
            <p className="text-xs text-muted-foreground">
              התחברות או פתיחת חשבון מאובטח
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-muted/60 p-4 border border-border text-center">
          <p className="text-sm font-semibold text-foreground mb-1">
            הכניסה וההרשמה מתבצעות באמצעות Gmail
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            התחברו ישירות עם חשבון ה-Google / Gmail שלכם כדי להמשיך לדמות, לדוכנים ולמתחם היריד.
          </p>
        </div>

        <div className="space-y-3">
          {/* Google / Gmail Sign In Button */}
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleSignIn}
            className="btn-plastic flex w-full items-center justify-center gap-3 font-bold text-sm py-3.5 shadow-md hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
            style={{ background: "#ffffff", color: "#1f2937", border: "2px solid #e5e7eb" }}
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{busy ? "מתחבר עם Google / Gmail…" : "המשך עם Google / Gmail"}</span>
          </button>
        </div>

        <div className="mt-8 border-t border-border pt-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            בלחיצה על התחברות אתם מאשרים את תנאי השימוש ומדיניות הפרטיות של COLT Market World.
          </p>
        </div>
      </div>
    </div>
  );
}
