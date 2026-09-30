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
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [providerGuide, setProviderGuide] = useState<"facebook" | "apple" | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (next) window.location.replace(next);
      else navigate({ to: "/play" });
    }
  }, [user, loading, navigate, next]);

  const handleOAuthSignIn = async (provider: "google" | "facebook" | "apple") => {
    setBusy(true);
    setActiveProvider(provider);
    try {
      const res = await supabase.auth.signInWithOAuth({ provider });
      if (res.error) {
        const errMsg = String(res.error.message || "");
        const isNotAllowed =
          errMsg.includes("operation-not-allowed") ||
          (res.error as any).code === "auth/operation-not-allowed";

        if (res.error.code === "auth/popup-closed-by-user") {
          toast.info("ההתחברות בוטלה");
        } else if (isNotAllowed && (provider === "facebook" || provider === "apple")) {
          setProviderGuide(provider);
        } else {
          toast.error("שגיאה בהתחברות: " + (res.error.message || "נא לנסות שוב"));
        }
      } else {
        toast.success("התחברת בהצלחה!");
        if (next) window.location.replace(next);
        else navigate({ to: "/play" });
      }
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("operation-not-allowed")) {
        setProviderGuide(provider === "google" ? null : provider);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
      setActiveProvider(null);
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
            הכניסה וההרשמה דרך חשבונות מאומתים
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            התחברו ישירות עם חשבון Google, Meta (Facebook) או Apple ID שלכם כדי להמשיך לדמות ולמתחם היריד.
          </p>
        </div>

        <div className="space-y-3">
          {/* Google Sign In Button */}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleOAuthSignIn("google")}
            className="btn-plastic flex w-full items-center justify-center gap-3 font-bold text-sm py-3 shadow-md hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
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
            <span>{busy && activeProvider === "google" ? "מתחבר עם Google…" : "המשך עם Google"}</span>
          </button>

          {/* Meta / Facebook Sign In Button */}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleOAuthSignIn("facebook")}
            className="btn-plastic flex w-full items-center justify-center gap-3 font-bold text-sm py-3 text-white shadow-md hover:brightness-110 active:scale-98 transition-all disabled:opacity-50"
            style={{ background: "#1877F2", border: "2px solid #166fe5" }}
          >
            <svg className="h-5 w-5 shrink-0 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>{busy && activeProvider === "facebook" ? "מתחבר עם Meta…" : "המשך עם Meta / Facebook"}</span>
          </button>

          {/* Apple ID Sign In Button */}
          <button
            type="button"
            disabled={busy}
            onClick={() => handleOAuthSignIn("apple")}
            className="btn-plastic flex w-full items-center justify-center gap-3 font-bold text-sm py-3 text-white shadow-md hover:brightness-125 active:scale-98 transition-all disabled:opacity-50"
            style={{ background: "#000000", border: "2px solid #333333" }}
          >
            <svg className="h-5 w-5 shrink-0 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.64 1.35-.57.65-1.07 1.71-.94 2.73 1 .08 2.04-.48 2.66-1.23z"/>
            </svg>
            <span>{busy && activeProvider === "apple" ? "מתחבר עם Apple…" : "המשך עם Apple ID"}</span>
          </button>
        </div>

        {/* Modal Guide when provider is unauthorized in Firebase Console */}
        {providerGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="chrome-panel w-full max-w-md p-6 space-y-4 shadow-2xl border-2 border-primary">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{providerGuide === "facebook" ? "📘" : "🍏"}</span>
                  <h3 className="font-bold text-base">
                    הגדרת ספק {providerGuide === "facebook" ? "Meta / Facebook" : "Apple ID"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setProviderGuide(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                <p className="font-bold mb-1">הספק דורש הפעלה ב-Firebase Console</p>
                <p>
                  כדי שמשתמשים יוכלו להתחבר עם חשבון {providerGuide === "facebook" ? "Facebook / Meta" : "Apple"} האישי שלהם, יש להזין את מפתחות המפתח שלכם (App ID / Secret) בקונסולת Firebase של הפרויקט.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-bold text-foreground">הוראות הפעלה למנהל המערכת:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground bg-muted/50 p-3 rounded-xl">
                  <li>היכנסו אל <strong>Firebase Console</strong> בפרויקט</li>
                  <li>עברו אל <strong>Authentication &gt; Sign-in method</strong></li>
                  <li>לחצו על <strong>{providerGuide === "facebook" ? "Facebook" : "Apple"}</strong> והפעילו (Enable)</li>
                  <li>הזינו את ה-App ID וה-Secret מחשבון המפתחים שלכם ולחצו Save</li>
                </ol>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setProviderGuide(null);
                    handleOAuthSignIn("google");
                  }}
                  className="btn-plastic text-xs px-3 py-1.5"
                >
                  🌐 התחבר בינתיים עם Google
                </button>
                <button
                  type="button"
                  onClick={() => setProviderGuide(null)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-muted hover:bg-muted/80 text-foreground"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-border pt-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            בלחיצה על התחברות אתם מאשרים את תנאי השימוש ומדיניות הפרטיות של COLT Market World.
          </p>
        </div>
      </div>
    </div>
  );
}
