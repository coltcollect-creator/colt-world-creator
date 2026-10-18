import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { User, LogOut, ArrowRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "הגדרות חשבון — COLT Market World" }] }),
  component: Settings,
});

function Settings() {
  const { profile, user, signOut } = useAuth();

  return (
    <div dir="rtl" className="max-w-md mx-auto space-y-4">
      <div className="chrome-panel p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground font-black text-xl shadow-md">
            👤
          </div>
          <div>
            <h1 className="text-xl font-black">הגדרות חשבון</h1>
            <p className="text-xs text-muted-foreground">כל פרטי החשבון, ההישגים והאלבום מרוכזים בפרופיל שלך</p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-muted/50 p-4 border border-border text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">שם שחקן:</span>
            <span className="font-bold text-foreground text-sm">{profile?.username ?? "משתמש"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">אימייל מחובר:</span>
            <span className="font-mono font-bold text-foreground" dir="ltr">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">יתרת ג'מים:</span>
            <span className="font-bold text-primary">💎 {profile?.credits ?? 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">רמת שחקן:</span>
            <span className="font-bold text-amber-500">⭐ Lv {profile?.level ?? 1}</span>
          </div>
        </div>

        <div className="pt-2">
          <Link
            to="/profile"
            className="btn-plastic w-full flex items-center justify-center gap-2 py-3 text-xs font-bold shadow-md"
          >
            <User className="h-4 w-4" />
            <span>מעבר לפרופיל האישי ואלבום הכנס</span>
            <ArrowRight className="h-4 w-4 rotate-180" />
          </Link>
        </div>

        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={signOut}
            className="w-full px-4 py-2.5 rounded-xl text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>התנתקות מהחשבון</span>
          </button>
        </div>
      </div>
    </div>
  );
}

