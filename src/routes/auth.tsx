import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { emailForUsername } from "@/lib/username-lookup.functions";
import { useServerFn } from "@tanstack/react-start";

type Mode = "login" | "register" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode; next?: string } => ({
    mode: (s.mode as Mode) ?? undefined,
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — COLT Market World" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: modeParam, next } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(modeParam ?? "login");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const lookupEmail = useServerFn(emailForUsername);

  useEffect(() => {
    if (!loading && user) {
      if (next) window.location.replace(next);
      else navigate({ to: "/play" });
    }
  }, [user, loading, navigate, next]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let loginEmail = usernameOrEmail.trim();
      if (!loginEmail.includes("@")) {
        const res = await lookupEmail({ data: { username: loginEmail } });
        if (!res.email) throw new Error("No account found with that username");
        loginEmail = res.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      toast.success("Welcome back!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { username: username.trim() },
        },
      });
      if (error) {
        if (error.message.includes("operation-not-allowed")) {
          throw new Error("הרשמה במייל עדיין לא מופעלת בקונסולת פיירבייס. יש להפעיל 'Email/Password' ב-Firebase Console -> Authentication -> Sign-in method, או להתחבר באמצעות גוגל.");
        }
        throw error;
      }
      toast.success("החשבון נוצר בהצלחה! התחברות כעת...");
      setMode("login");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent.");
      setMode("login");
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="chrome-panel w-full max-w-md p-8">
        <Link to="/" className="text-xs text-muted-foreground">← Back to plaza</Link>
        <div className="mb-6 mt-3 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground font-black">C</div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">COLT Market World</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "login" ? "Sign in to continue" : mode === "register" ? "Create your account" : "Reset your password"}
            </p>
          </div>
        </div>

        {/* Instant Play Button */}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await (supabase.auth as any).signInAsGuest();
              toast.success("ברוכים הבאים ליריד COLT!");
              navigate({ to: "/play" });
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="btn-plastic mb-3 flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground font-black text-sm py-2.5 shadow-md hover:brightness-110 active:scale-95"
        >
          🎮 כניסה מיידית למשחק (Instant Play)
        </button>

        {/* Google Sign In Button */}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { error } = await supabase.auth.signInWithOAuth();
              if (error) throw error;
              toast.success("Signed in with Google!");
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="btn-plastic mb-4 flex w-full items-center justify-center gap-2"
          style={{ background: "#ffffff", color: "#1f2937", border: "2px solid var(--color-border)" }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
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
          Continue with Google
        </button>

        <div className="relative mb-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <span className="relative bg-card px-2 text-xs text-muted-foreground">or with email</span>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-3">
            <Input label="Username or email" value={usernameOrEmail} onChange={setUsernameOrEmail} autoFocus />
            <Input label="Password" type="password" value={password} onChange={setPassword} />
            <button disabled={busy} className="btn-plastic w-full">
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => setMode("register")} className="underline">Create account</button>
              <button type="button" onClick={() => setMode("forgot")} className="underline">Forgot password</button>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-3">
            <Input label="Username" value={username} onChange={setUsername} autoFocus />
            <Input label="Email" type="email" value={email} onChange={setEmail} />
            <Input label="Password" type="password" value={password} onChange={setPassword} />
            <button disabled={busy} className="btn-plastic w-full">{busy ? "Creating…" : "Create account"}</button>
            <button type="button" onClick={() => setMode("login")} className="text-xs underline">Have an account? Sign in</button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot} className="space-y-3">
            <Input label="Email" type="email" value={email} onChange={setEmail} autoFocus />
            <button disabled={busy} className="btn-plastic w-full">{busy ? "Sending…" : "Send reset email"}</button>
            <button type="button" onClick={() => setMode("login")} className="text-xs underline">Back to sign in</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, autoFocus }: { label: string; type?: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 outline-none focus:border-primary"
        required
      />
    </label>
  );
}
