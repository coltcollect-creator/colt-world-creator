import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Avatar3DPreview } from "@/components/game/Avatar3DPreview";
import type { AvatarCosmetic, AvatarLook } from "@/lib/avatar-canvas";
import { readAdjust, applyAdjust, ADJUST_KEY, type AdjustMap } from "@/lib/avatar-adjust";

export const Route = createFileRoute("/_authenticated/customize")({
  component: Customize,
  head: () => ({
    meta: [
      { title: "התאמה אישית לדמות | COLT Market World" },
      { name: "description", content: "בחרו כובעים, חולצות, גלימות ופריטים לדמות שלכם וצפו בתצוגה מקדימה מסתובבת בתלת-מימד." },
      { property: "og:title", content: "התאמה אישית לדמות | COLT Market World" },
      { property: "og:description", content: "הלבישו את הדמות שלכם וצפו בה מסתובבת בתלת-מימד לפני שנכנסים למשחק." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const LAYER_LABELS: Record<string, string> = {
  hat: "כובעים", hair: "שיער", face: "פנים", glasses: "משקפיים",
  necklace: "שרשראות", shirt: "חולצות", top: "חולצות", armor: "שריון",
  cape: "גלימות", wings: "כנפיים", background: "רקע", backdrop: "רקע",
  pants: "מכנסיים", shoes: "נעליים", hand: "פריט ביד", hands: "פריט ביד",
  item: "פריט", weapon: "נשק", pet: "חיית מחמד", character: "גוף",
};

type CosmeticRow = AvatarCosmetic & {
  name: string;
  is_free: boolean;
  credit_price: number;
  limited_edition: boolean;
  thumbnail_url: string | null;
  model_3d_url: string | null;
};

function Customize() {
  const { user, profile, refreshProfile } = useAuth();
  
  const [mode, setMode] = useState<"2d" | "3d">("3d");
  const [adjustId, setAdjustId] = useState<string | null>(null);

  const { data: owned = [] } = useQuery({
    queryKey: ["owned-cos", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("player_cosmetics").select("cosmetic_id").eq("user_id", user!.id)).data ?? [],
  });

  const { data: cosmetics = [] } = useQuery({
    queryKey: ["all-cosmetics"],
    staleTime: 60_000,
    queryFn: async () =>
      ((await supabase.from("cosmetics").select("*").eq("active", true).order("layer_order")).data ?? []) as unknown as CosmeticRow[],
  });

  const characterId = (profile as unknown as { character_id?: string | null } | null)?.character_id ?? null;
  const { data: character } = useQuery({
    queryKey: ["my-character", characterId],
    enabled: !!characterId,
    staleTime: 60_000,
    queryFn: async () =>
      (await supabase.from("characters").select("id, name, image_url, sprite_right_url, sprite_left_url, model_3d_url").eq("id", characterId!).maybeSingle()).data as
        | { id: string; name: string; image_url: string | null; sprite_right_url: string | null; sprite_left_url: string | null; model_3d_url: string | null }
        | null,
  });

  const ownedIds = useMemo(() => new Set(owned.map((o) => o.cosmetic_id)), [owned]);
  const config = (profile?.avatar_config ?? {}) as Record<string, string>;
  const adjust = useMemo(() => readAdjust(profile?.settings), [profile?.settings]);

  const equipped = useMemo(
    () => cosmetics.filter((c) => Object.values(config).includes(c.id)),
    [cosmetics, config],
  );

  const look: AvatarLook = useMemo(
    () => ({
      idle: character?.image_url ?? null,
      right: character?.sprite_right_url ?? character?.image_url ?? null,
      left: character?.sprite_left_url ?? null,
      cosmetics: applyAdjust(
        equipped.map((c) => ({
          id: c.id,
          layer_type: c.layer_type,
          sprite_left_url: c.sprite_left_url,
          sprite_right_url: c.sprite_right_url ?? c.thumbnail_url,
          offset_x: c.offset_x,
          offset_y: c.offset_y,
          scale: c.scale,
          layer_order: c.layer_order,
        })),
        adjust,
      ),
    }),
    [character, equipped, adjust],
  );

  const cosmeticModels = useMemo(
    () => equipped.map((c) => c.model_3d_url).filter((u): u is string => !!u),
    [equipped],
  );

  const setLayer = useMutation({
    mutationFn: async ({ layer, id }: { layer: string; id: string | null }) => {
      if (!user || !profile) return;
      const conf = { ...(profile.avatar_config ?? {}) } as Record<string, string>;
      if (id) conf[layer] = id;
      else delete conf[layer];
      const { error } = await supabase.from("profiles").update({ avatar_config: conf }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveAdjust = useMutation({
    mutationFn: async (next: AdjustMap) => {
      if (!user || !profile) return;
      const settings = { ...((profile.settings ?? {}) as Record<string, unknown>), [ADJUST_KEY]: next };
      const { error } = await supabase.from("profiles").update({ settings }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const nudge = (id: string, patch: { dx?: number; dy?: number; scale?: number; layer?: number }) => {
    const cur = adjust[id] ?? {};
    const next: AdjustMap = {
      ...adjust,
      [id]: {
        dx: Math.round(((cur.dx ?? 0) + (patch.dx ?? 0)) * 10) / 10,
        dy: Math.round(((cur.dy ?? 0) + (patch.dy ?? 0)) * 10) / 10,
        scale: Math.max(0.3, Math.min(3, Number((((cur.scale ?? 1) + (patch.scale ?? 0))).toFixed(2)))),
        layer: patch.layer !== undefined ? (cur.layer ?? 0) + patch.layer : cur.layer,
      },
    };
    saveAdjust.mutate(next);
  };

  const resetAdjust = (id: string) => {
    const next = { ...adjust };
    delete next[id];
    saveAdjust.mutate(next);
  };


  // Only items the player actually obtained (purchase / quest / wheel / gift) appear here.
  const myCosmetics = useMemo(() => cosmetics.filter((c) => ownedIds.has(c.id)), [cosmetics, ownedIds]);
  const layers = useMemo(() => Array.from(new Set(myCosmetics.map((c) => c.layer_type))), [myCosmetics]);
  const activeAdjust = adjustId ? adjust[adjustId] ?? {} : null;

  return (
    <div className="space-y-3">
      {/* Sticky entry CTA — this is also the screen right after signup */}
      <div data-tour="enter-con" className="sticky top-0 z-40 -mx-2 px-2 pt-2 md:-mx-4 md:px-4">
        <div className="chrome-panel flex flex-wrap items-center justify-between gap-2 px-3 py-2 shadow-xl backdrop-blur">
          <div className="text-xs font-bold md:text-sm">
            סיימתם להלביש את הדמות? קדימה, זמן להיכנס 🎉
          </div>
          <Link to="/play" className="btn-plastic w-full text-center text-sm md:w-auto">
            🎪 כניסה לכנס האספנים
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div data-tour="preview" className="chrome-panel p-4">
            <h2 className="mb-2 text-sm font-bold">הדמות שלי</h2>
            <Avatar3DPreview
              look={look}
              modelUrl={character?.model_3d_url ?? null}
              cosmeticModelUrls={cosmeticModels}
              mode={mode}
              onModeChange={setMode}
            />
            <div className="mt-2 text-xs text-muted-foreground">
              {character?.name ?? "לא נבחרה דמות"} · 💎 {profile?.credits ?? 0}
            </div>
          </div>

          {/* Per-player fit adjustment */}
          <div className="chrome-panel p-4">
            <h3 className="text-sm font-bold">🎯 התאמת אביזרים</h3>
            <p className="mb-2 text-[11px] text-muted-foreground">
              בחרו אביזר והזיזו אותו ימינה/שמאלה, למעלה/למטה, הגדילו/הקטינו או העבירו שכבה — עד שהוא יושב מושלם.
            </p>
            <div className="flex flex-wrap gap-1">
              {equipped.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAdjustId(adjustId === c.id ? null : c.id)}
                  className={`chrome-panel px-2 py-1 text-[11px] font-bold ${adjustId === c.id ? "ring-2 ring-primary bg-primary/10" : ""}`}
                >
                  {c.name}
                </button>
              ))}
              {equipped.length === 0 && <div className="text-xs text-muted-foreground">אין אביזרים מולבשים.</div>}
            </div>

            {adjustId && (
              <div className="mt-3 space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-1">
                  <span />
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { dy: -1 })}>⬆️</button>
                  <span />
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { dx: -1 })}>⬅️</button>
                  <button className="chrome-panel py-1" onClick={() => resetAdjust(adjustId)}>↺</button>
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { dx: 1 })}>➡️</button>
                  <span />
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { dy: 1 })}>⬇️</button>
                  <span />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { scale: -0.05 })}>➖ הקטנה</button>
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { scale: 0.05 })}>➕ הגדלה</button>
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { layer: -1 })}>⤵️ אחורה בשכבות</button>
                  <button className="chrome-panel py-1" onClick={() => nudge(adjustId, { layer: 1 })}>⤴️ קדימה בשכבות</button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  הזחה: {activeAdjust?.dx ?? 0} / {activeAdjust?.dy ?? 0} · גודל ×{activeAdjust?.scale ?? 1}
                  {activeAdjust?.layer !== undefined && ` · שכבה ${activeAdjust.layer}`}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div data-tour="items" className="space-y-3">
          <div className="chrome-panel p-4">
            <h1 className="text-xl font-bold">התאמה אישית לדמות</h1>
            <p className="text-xs text-muted-foreground">
              כאן מופיעים רק פריטים שהשגתם — מהחנויות, משימות, גלגל המזל או מתנות. כל בחירה מתעדכנת מיד בתצוגה המקדימה.
            </p>
          </div>

          {layers.length === 0 && (
            <div className="chrome-panel p-6 text-center">
              <div className="text-4xl">🎁</div>
              <h3 className="mt-2 font-bold">הארון ריק</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                עדיין אין לכם אביזרים. צאו לכנס, קנו בחנויות, השלימו משימות או סובבו את גלגל המזל כדי לאסוף פריטים.
              </p>
              <Link to="/play" className="btn-plastic mt-3 inline-block text-sm">🎪 כניסה לכנס האספנים</Link>
            </div>
          )}

          {layers.map((l) => (
            <div key={l} className="chrome-panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold">{LAYER_LABELS[l] ?? l}</h3>
                {config[l] && (
                  <button className="text-xs text-destructive underline" onClick={() => setLayer.mutate({ layer: l, id: null })}>
                    הסרה
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {myCosmetics.filter((c) => c.layer_type === l).map((c) => {
                  const isEquipped = config[l] === c.id;
                  return (
                    <div key={c.id} className={`chrome-panel p-3 text-sm ${isEquipped ? "ring-4 ring-primary" : ""}`}>
                      {(c.thumbnail_url || c.sprite_right_url) && (
                        <img
                          src={c.thumbnail_url ?? c.sprite_right_url ?? ""}
                          alt={c.name}
                          loading="lazy"
                          className="mx-auto mb-1 h-16 w-16 object-contain"
                        />
                      )}
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        בבעלותכם
                        {c.limited_edition && " · מהדורה מוגבלת"}
                        {c.model_3d_url && " · 🧊 3D"}
                      </div>
                      <div className="mt-2">
                        <button className="btn-plastic w-full text-xs" onClick={() => setLayer.mutate({ layer: l, id: c.id })}>
                          {isEquipped ? "מולבש" : "הלבשה"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
