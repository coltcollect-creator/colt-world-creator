import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { TourButton } from "@/lib/tour";
import { PwaInstallButton } from "@/components/pwa/PwaInstallModal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    let { data } = await supabase.auth.getUser();
    if (!data?.user && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("colt_auth_session_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id) return { user: parsed };
        }
      } catch {}
    }
    if (!data?.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/play", key: "nav.play", icon: "🎮" },
  { to: "/profile", key: "nav.profile", icon: "👤" },
  { to: "/customize", key: "nav.customize", icon: "🎨" },
  { to: "/inventory", key: "nav.inventory", icon: "🎒" },
  { to: "/quests", key: "nav.quests", icon: "📜" },
  { to: "/messages", key: "nav.messages", icon: "💬" },
  { to: "/credits", key: "nav.credits", icon: "💎" },
  { to: "/history", key: "nav.history", icon: "🧾" },
  { to: "/settings", key: "nav.settings", icon: "⚙️" },
] as const;

function AuthedLayout() {
  const { profile, isOwner, signOut, loading, user } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: unread = 0 } = useQuery({
    queryKey: ["my-unread", user?.id],
    enabled: !!user,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase.from("store_conversations").select("unread_user").eq("user_id", user!.id),
        supabase
          .from("player_notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("kind", "system")
          .eq("read", false),
      ]);
      return (data ?? []).reduce((s, r) => s + (r.unread_user ?? 0), 0) + (count ?? 0);
    },

  });

  const { data: isVendor = false } = useQuery({
    queryKey: ["is-vendor", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id").eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (loading || !user || !profile) return;
    const hasCharacter = Boolean(
      profile.character_id ||
      profile.avatar_config?._initialized ||
      Object.keys(profile.avatar_config ?? {}).length > 0
    );
    if (!hasCharacter && loc.pathname !== "/character-setup") {
      navigate({ to: "/character-setup" });
    }
  }, [loading, user, profile, loc.pathname, navigate]);

  // Close the drawer whenever the route changes
  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  return (
    <div className="min-h-screen">
      <header className="chrome-panel mx-3 mt-3 flex items-center justify-between gap-2 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            aria-label="menu"
            onClick={() => setMenuOpen(true)}
            className="lg:hidden grid h-9 w-9 place-items-center rounded-xl bg-muted text-lg shadow-sm active:scale-95 relative"
          >
            ☰
            {unread > 0 && (
              <span className="absolute -top-1 -end-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread}</span>
            )}
          </button>
          <Link to="/play" className="flex items-center gap-2 font-bold min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">C</div>
            <span className="truncate text-sm sm:text-base">{t("app.name")}</span>
          </Link>
        </div>
        <nav data-tour="nav" className="hidden gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} data-tour={`nav-${n.to}`} className="relative rounded-full px-3 py-1 text-sm hover:bg-muted" activeProps={{ className: "bg-primary/15 text-primary font-semibold" }}>
              <span className="mx-1">{n.icon}</span>{t(n.key)}
              {n.to === "/messages" && unread > 0 && (
                <span className="absolute -top-1 -end-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread}</span>
              )}
            </Link>
          ))}
          {isVendor && (
            <Link to="/vendor" className="relative rounded-full px-3 py-1 text-sm hover:bg-muted" activeProps={{ className: "bg-primary/15 text-primary font-semibold" }}>
              <span className="mx-1">🏪</span>אזור הוונדור
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-1.5 text-sm">
          <PwaInstallButton />
          <TourButton />
          {profile && (
            <>
              <Link to="/credits" className="chrome-panel px-2.5 py-1 text-[11px] md:text-xs font-bold hover:border-primary transition-colors">
                💎 {profile.credits}
              </Link>
              <Link
                to="/profile"
                title={`${profile.xp || 0} XP`}
                className="hidden sm:inline-flex items-center gap-1.5 chrome-panel px-2.5 py-1 text-[11px] md:text-xs hover:border-primary transition-colors"
              >
                <span className="font-black text-amber-500">⭐ Lv {profile.level}</span>
                <span className="text-[10px] text-muted-foreground font-mono">({profile.xp || 0} XP)</span>
              </Link>
              <span className="hidden md:inline font-semibold">{profile.username}</span>
            </>
          )}
          {!isVendor && (
            <Link to="/vendor" className="hidden sm:inline rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">
              🏪 הפוך לוונדור
            </Link>
          )}
          {isOwner && (
            <Link to="/owner" className="hidden lg:inline chrome-panel px-3 py-1 text-xs">{t("nav.owner")}</Link>
          )}
          <button onClick={signOut} className="hidden lg:inline chrome-panel px-3 py-1 text-xs">{t("nav.signout")}</button>
        </div>
      </header>

      {/* Mobile side drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <aside
            className="absolute inset-y-0 start-0 w-72 max-w-[85%] bg-background shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 font-bold">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">C</div>
                <span>{t("app.name")}</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-muted">✕</button>
            </div>
            {profile && (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-bold">{profile.username?.slice(0,1)?.toUpperCase() ?? "?"}</div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-sm">{profile.username}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span>💎 {profile.credits}</span>
                    <span>·</span>
                    <span className="font-bold text-amber-500">⭐ Lv {profile.level}</span>
                    <span className="text-[10px] font-mono">({profile.xp || 0} XP)</span>
                  </div>
                </div>
              </div>
            )}
            <nav className="flex-1 overflow-y-auto p-2">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted"
                  activeProps={{ className: "bg-primary/15 text-primary font-bold" }}
                >
                  <span className="flex items-center gap-2"><span className="text-lg">{n.icon}</span>{t(n.key)}</span>
                  {n.to === "/messages" && unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread}</span>
                  )}
                </Link>
              ))}
              {isOwner && (
                <Link to="/owner" className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold bg-muted">
                  <span className="text-lg">🛠️</span>{t("nav.owner")}
                </Link>
              )}
              <div className="mt-3">
                <PwaInstallButton className="w-full btn-plastic flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs py-2 shadow" />
              </div>
            </nav>
            <div className="border-t border-border p-3 flex items-center justify-between gap-2">
              <Link to="/vendor" className="chrome-panel px-3 py-1.5 text-xs font-bold">
                {isVendor ? "🏪 אזור הוונדור" : "🏪 הפוך לוונדור"}
              </Link>
              <button onClick={signOut} className="chrome-panel px-3 py-1.5 text-xs">{t("nav.signout")}</button>
            </div>
          </aside>
        </div>
      )}

      <main data-tour="page" className="mx-3 mt-3 pb-6">
        <Outlet />
      </main>
    </div>
  );
}
