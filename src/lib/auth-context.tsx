import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_config: Record<string, string>;
  credits: number;
  level: number;
  xp: number;
  active_title_id: string | null;
  current_map_id: string | null;
  last_x: number;
  last_y: number;
  is_suspended: boolean;
  is_muted: boolean;
  email_verified: boolean;
  settings: Record<string, unknown>;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isOwner: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: roles }, { data: admin }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("admins").select("id").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile((p as unknown as Profile) ?? null);
    const ownerStatus = (roles ?? []).some((r: { role: string }) => r.role === "owner") || !!admin;
    setIsOwner(ownerStatus);
  };

  useEffect(() => {
    // First set up the listener, then get session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setIsOwner(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  // Live balance: refresh when the profile row changes, or when the app
  // signals a credit-affecting action (purchase, spin, reward...).
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const onChanged = () => { loadProfile(uid); };
    window.addEventListener("credits-changed", onChanged);
    const channel = supabase
      .channel(`profile-${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
        (payload) => setProfile((prev) => ({ ...(prev ?? {}), ...(payload.new as Profile) })),
      )
      .subscribe();
    return () => {
      window.removeEventListener("credits-changed", onChanged);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsOwner(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isOwner, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
