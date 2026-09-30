import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/character-setup")({
  ssr: false,
  beforeLoad: async () => {
    let { data } = await supabase.auth.getUser();
    let currentUser = data?.user;
    if (!currentUser && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("colt_auth_session_v1");
        if (raw) currentUser = JSON.parse(raw);
      } catch {}
    }
    if (!currentUser) throw redirect({ to: "/auth" });
  },
  component: CharacterSetup,
});

type Role = { id: string; name: string; description: string | null; icon: string | null };
type Character = {
  id: string; name: string; description: string | null; role_id: string | null;
  image_url: string | null; sprite_right_url: string | null;
  is_free: boolean; credit_price: number;
};

const FALLBACK_ROLES: Role[] = [
  { id: "role_adventurer", name: "הרפתקן", description: "חוקר עולמות וסייר", icon: "🧭" },
  { id: "role_collector", name: "אספן", description: "מומחה לאיסוף ואוצרות", icon: "💎" },
  { id: "role_trader", name: "סוחר", description: "מומחה למסחר והחלפות", icon: "⚖️" },
];

const FALLBACK_CHARACTERS: Character[] = [
  {
    id: "adventurer-orion",
    name: "אוריון החוקר",
    description: "חוקר הרפתקאות נועז שמכיר כל פינה בעולם.",
    role_id: "role_adventurer",
    image_url: "/storage_cache/characters/image_url_adventurer-orion_muigjx1q.png",
    sprite_right_url: "/storage_cache/characters/sprite_right_url_adventurer-orion_muigjx5l.png",
    is_free: true,
    credit_price: 0,
  },
  {
    id: "collector-carl",
    name: "קארל האספן",
    description: "אספן אגדי שסוחר בפריטים נדירים ביותר.",
    role_id: "role_collector",
    image_url: "/storage_cache/characters/image_url_44ca85cf-9e82-47e5-9ce5-06abde1ec0d1_muigjwus.png",
    sprite_right_url: "/storage_cache/characters/image_url_44ca85cf-9e82-47e5-9ce5-06abde1ec0d1_muigjwus.png",
    is_free: true,
    credit_price: 0,
  },
  {
    id: "trader-maya",
    name: "מאיה הסוחרת",
    description: "מומחית להערכת שווי וסחר חופשי ביריד.",
    role_id: "role_trader",
    image_url: "/storage_cache/characters/image_url_d7fc1b37-dae3-4bd0-bab1-3c21a4a51571_muigjxm0.png",
    sprite_right_url: "/storage_cache/characters/sprite_right_url_d7fc1b37-dae3-4bd0-bab1-3c21a4a51571_muigjxf0.png",
    is_free: true,
    credit_price: 0,
  },
  {
    id: "44ca85cf-9e82-47e5-9ce5-06abde1ec0d1",
    name: "קוסם",
    description: "חוקר COLT בעל יכולות קסם מותאם לכל שכבות הקוסמטיקה",
    role_id: null,
    image_url: "/storage_cache/characters/image_url_44ca85cf-9e82-47e5-9ce5-06abde1ec0d1_muigjwus.png",
    sprite_right_url: "/storage_cache/characters/sprite_right_url_44ca85cf-9e82-47e5-9ce5-06abde1ec0d1_muigjwm9.png",
    is_free: true,
    credit_price: 0,
  },
];

function CharacterSetup() {
  const { profile, refreshProfile, user, signOut, isOwner } = useAuth();
  const navigate = useNavigate();

  const { data: rawRoles = [] } = useQuery<Role[]>({
    queryKey: ["setup-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("character_roles")
        .select("id,name,description,icon").eq("active", true).order("display_order");
      if (error) throw error;
      return (data ?? []) as Role[];
    },
  });

  const { data: rawCharacters = [] } = useQuery<Character[]>({
    queryKey: ["setup-characters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("characters")
        .select("id,name,description,role_id,image_url,sprite_right_url,is_free,credit_price")
        .eq("active", true).eq("is_starter", true).order("display_order");
      if (error) throw error;
      return (data ?? []) as Character[];
    },
  });

  const roles = rawRoles.length > 0 ? rawRoles : FALLBACK_ROLES;
  const characters = rawCharacters.length > 0 ? rawCharacters : FALLBACK_CHARACTERS;

  const [roleId, setRoleId] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [username, setUsername] = useState(profile?.username || user?.user_metadata?.username || "Colt");

  // Auto-select character based on existing profile or first available
  useEffect(() => {
    if (!characterId) {
      if (profile?.character_id && characters.some((c) => c.id === profile.character_id)) {
        setCharacterId(profile.character_id);
        const match = characters.find((c) => c.id === profile.character_id);
        if (match?.role_id) setRoleId(match.role_id);
      } else if (characters.length > 0) {
        setCharacterId(characters[0].id);
        setRoleId(characters[0].role_id);
      }
    }
  }, [characters, characterId, profile?.character_id]);

  const filteredCharacters = useMemo(() => {
    if (!roleId) return characters;
    return characters.filter((c) => !c.role_id || c.role_id === roleId);
  }, [characters, roleId]);

  const selected = characters.find((c) => c.id === characterId) ?? characters[0] ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user");
      const chosenCharId = characterId || characters[0]?.id || "adventurer-orion";
      const finalUsername = username.trim() || "Colt";

      const { error } = await supabase.from("profiles").update({
        username: finalUsername,
        character_id: chosenCharId,
        role_id: roleId,
        avatar_config: { _initialized: true },
      }).eq("id", user.id);

      if (error) throw error;
      await refreshProfile();
    },
    onSuccess: () => {
      toast.success("דמות נשמרה! נכנסים למפה הראשית 🎪");
      navigate({ to: "/play" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleLogout = async () => {
    await signOut();
    toast.success("התנתקת בהצלחה");
    navigate({ to: "/auth" });
  };

  return (
    <div dir="rtl" className="min-h-screen p-4 md:p-6">
      <div className="chrome-panel mx-auto max-w-5xl p-6">
        {/* Top bar with sign out and owner panel links */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div>
            <h1 className="text-2xl font-bold">יצירת דמות</h1>
            <p className="text-sm text-muted-foreground">בחרו תפקיד ודמות בסיס. תוכלו להוסיף עליה כובעים, בגדים ופריטים בהמשך.</p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <Link to="/owner" className="btn-plastic text-xs" style={{ background: "var(--color-secondary)" }}>
                ⚙️ פאנל ניהול בעלים
              </Link>
            )}
            <button type="button" onClick={handleLogout} className="chrome-panel px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
              🚪 התנתקות
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold">שם משתמש</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="שם השחקן שלך"
            className="mt-1 w-full max-w-xs rounded-xl border-2 border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Roles */}
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-bold">🎭 בחרו תפקיד</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setRoleId(null); }}
              className={`chrome-panel px-4 py-2 text-sm transition-all ${roleId === null ? "ring-4 ring-primary font-bold shadow-md" : ""}`}
            >
              הכל
            </button>
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRoleId(r.id);
                  const matchingChar = characters.find((c) => c.role_id === r.id);
                  if (matchingChar) setCharacterId(matchingChar.id);
                }}
                className={`chrome-panel px-4 py-2 text-sm transition-all ${roleId === r.id ? "ring-4 ring-primary font-bold shadow-md" : ""}`}
                title={r.description ?? ""}
              >
                {r.icon ? `${r.icon} ` : ""}{r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Character grid */}
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-bold">🧍 בחרו דמות</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filteredCharacters.map((c) => {
              const isSelected = (characterId || characters[0]?.id) === c.id;
              const img = c.image_url ?? c.sprite_right_url;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCharacterId(c.id);
                    if (c.role_id) setRoleId(c.role_id);
                  }}
                  className={`chrome-panel overflow-hidden p-0 text-center transition-all ${isSelected ? "ring-4 ring-primary shadow-lg scale-[1.02]" : "hover:scale-[1.01]"}`}
                >
                  <div className="aspect-square w-full bg-gradient-to-br from-sky-100 to-pink-100">
                    {img ? (
                      <img src={img} alt={c.name} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-5xl">🧍</div>
                    )}
                  </div>
                  <div className="p-2 text-sm font-bold">{c.name}</div>
                  {c.description && <div className="px-2 pb-2 text-[10px] text-muted-foreground">{c.description}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
            נבחרה: <b>{selected.name}</b>
            {selected.description && <> · {selected.description}</>}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate({ to: "/play" })}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            דילוג ישיר למפה ←
          </button>
          <button
            className="btn-plastic text-base"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? "שומר…" : "כניסה ל-COLT 🎪"}
          </button>
        </div>
      </div>
    </div>
  );
}
