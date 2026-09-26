import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PLAYER_W, PLAYER_H, cosmeticRect, sortLayers } from "@/lib/avatar-layout";
import { toast } from "sonner";

type Cosmetic = {
  id: string; name: string; layer_type: string; layer_order: number | null;
  thumbnail_url: string | null; sprite_right_url: string | null; sprite_left_url: string | null;
  offset_x: number | null; offset_y: number | null; scale: number | null;
  is_free: boolean; credit_price: number; rarity: string | null;
};

export function SkinsMarket() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Cosmetic | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: cosmetics = [] } = useQuery({
    queryKey: ["skins-market"],
    queryFn: async () => (await supabase.from("cosmetics").select("id,name,layer_type,layer_order,thumbnail_url,sprite_right_url,sprite_left_url,offset_x,offset_y,scale,is_free,credit_price,rarity").eq("active", true).order("layer_order")).data as unknown as Cosmetic[] ?? [],
  });
  const { data: owned = [] } = useQuery({
    queryKey: ["skins-owned", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("player_cosmetics").select("cosmetic_id").eq("user_id", user!.id)).data ?? [],
  });
  const ownedIds = new Set(owned.map((o) => o.cosmetic_id as string));
  const avatarConf = (profile?.avatar_config ?? {}) as Record<string, string>;
  const charId = (profile as unknown as { character_id?: string | null } | null)?.character_id ?? null;
  const { data: baseUrl } = useQuery({
    queryKey: ["skins-base-char", charId],
    enabled: !!charId,
    queryFn: async () => {
      const { data } = await supabase.from("characters").select("image_url, sprite_right_url").eq("id", charId!).maybeSingle();
      return (data?.image_url ?? data?.sprite_right_url ?? null) as string | null;
    },
  });


  const layers = useMemo(() => Array.from(new Set(cosmetics.map((c) => c.layer_type))), [cosmetics]);
  const [activeLayer, setActiveLayer] = useState<string>("all");
  const [confirmBuy, setConfirmBuy] = useState(false);

  // Compute preview: current equipped, override with `selected` on its layer.
  const previewIds = useMemo(() => {
    const map = { ...avatarConf };
    if (selected) map[selected.layer_type] = selected.id;
    return Object.values(map).filter(Boolean);
  }, [avatarConf, selected]);

  const previewCosmetics = useMemo(() => {
    return previewIds.map((id) => cosmetics.find((c) => c.id === id)).filter(Boolean) as Cosmetic[];
  }, [previewIds, cosmetics]);

  const filtered = activeLayer === "all" ? cosmetics : cosmetics.filter((c) => c.layer_type === activeLayer);

  const buyAndEquip = async (equipOnly: boolean) => {
    if (!selected) return;
    setConfirmBuy(false);
    setBusy(true);
    let error;
    if (equipOnly) {
      const next = { ...avatarConf, [selected.layer_type]: selected.id };
      const { error: e } = await supabase.from("profiles").update({ avatar_config: next }).eq("id", user!.id);
      error = e;
    } else {
      const { error: e } = await supabase.rpc("buy_and_equip_cosmetic" as never, { _cosmetic_id: selected.id } as never);
      error = e;
    }
    setBusy(false);
    if (error) { toast.error((error as { message?: string }).message ?? String(error)); return; }
    toast.success(equipOnly ? "לובש 👕" : "רכשת ולובש! 🎉");
    await refreshProfile();
    qc.invalidateQueries({ queryKey: ["skins-owned"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const price = selected ? (selected.is_free ? 0 : selected.credit_price) : 0;
  const alreadyOwned = selected ? (ownedIds.has(selected.id) || selected.is_free) : false;

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div>
        <div className="chrome-panel p-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">תצוגה מקדימה עלייך</div>
          <AvatarPreview layers={previewCosmetics} baseUrl={baseUrl} />
          {selected ? (
            <>
              <div className="mt-3 truncate text-center font-bold">{selected.name}</div>
              <div className="text-center text-[11px] text-muted-foreground capitalize">{selected.layer_type}{selected.rarity ? ` · ${selected.rarity}` : ""}</div>
              <div className="mt-3 space-y-1">
                {alreadyOwned ? (
                  <button disabled={busy} onClick={() => buyAndEquip(true)} className="btn-plastic w-full text-sm">לבש עכשיו</button>
                ) : (
                  <>
                    <button disabled={busy} onClick={() => setConfirmBuy(true)} className="btn-plastic w-full text-sm">
                      רכוש ולבש · 💎 {price}
                    </button>
                    <div className="text-center text-[10px] text-muted-foreground">אם כבר לובש משהו בשכבה הזו – יוחלף אוטומטית.</div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="mt-3 text-center text-xs text-muted-foreground">בחרו פריט מהקטלוג ←</div>
          )}
        </div>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap gap-1">
          <button onClick={() => setActiveLayer("all")} className={`chrome-panel px-2 py-1 text-xs ${activeLayer === "all" ? "ring-2 ring-primary bg-primary/10" : ""}`}>הכל</button>
          {layers.map((l) => (
            <button key={l} onClick={() => setActiveLayer(l)} className={`chrome-panel px-2 py-1 text-xs capitalize ${activeLayer === l ? "ring-2 ring-primary bg-primary/10" : ""}`}>{l}</button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((c) => {
            const isSelected = selected?.id === c.id;
            const isOwned = ownedIds.has(c.id) || c.is_free;
            const isEquipped = avatarConf[c.layer_type] === c.id;
            return (
              <button key={c.id} type="button" onClick={() => setSelected(c)} className={`chrome-panel overflow-hidden p-0 text-start ${isSelected ? "ring-4 ring-primary" : ""}`}>
                <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-yellow-100 to-pink-100">
                  {(c.thumbnail_url ?? c.sprite_right_url) ? (
                    <img src={(c.thumbnail_url ?? c.sprite_right_url) as string} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
                  ) : <div className="grid h-full w-full place-items-center text-5xl">👕</div>}
                  {isEquipped && <span className="absolute right-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">לבוש</span>}
                  {!isOwned && !c.is_free && <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">💎 {c.credit_price}</span>}
                  {c.is_free && <span className="absolute left-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">חינם</span>}
                </div>
                <div className="p-2">
                  <div className="truncate text-xs font-bold">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{c.layer_type}</div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full py-8 text-center text-sm text-muted-foreground">אין פריטים בקטגוריה זו.</div>}
        </div>
      </div>
      {confirmBuy && selected && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={() => setConfirmBuy(false)}>
          <div dir="rtl" className="chrome-panel w-full max-w-sm p-5 text-center" onClick={(e) => e.stopPropagation()}>
            {(selected.thumbnail_url ?? selected.sprite_right_url) && (
              <img src={(selected.thumbnail_url ?? selected.sprite_right_url) as string} alt="" className="mx-auto mb-3 h-24 w-24 rounded-xl bg-muted object-contain p-1" />
            )}
            <h3 className="text-lg font-black">לאשר רכישה?</h3>
            <p className="mt-1 text-sm font-bold">{selected.name}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              הפעולה תוריד <span className="font-black text-primary">💎 {price}</span> ממאזן הקרדיטים שלכם ולא ניתנת להשבה.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => setConfirmBuy(false)} className="chrome-panel px-4 py-2 text-sm">ביטול</button>
              <button onClick={() => buyAndEquip(false)} disabled={busy} className="btn-plastic text-sm disabled:opacity-40">{busy ? "…" : "כן, לרכוש ✅"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarPreview({ layers, baseUrl }: { layers: Cosmetic[]; baseUrl?: string | null }) {
  const W = PLAYER_W * 1.6;
  const H = PLAYER_H * 1.6;
  const box = { x: 0, y: 0, w: W, h: H };
  const sorted = sortLayers(layers);
  const render = (behind: boolean) =>
    sorted
      .filter((c) => cosmeticRect(c, box).behind === behind)
      .map((c) => {
        const src = c.sprite_right_url ?? c.thumbnail_url;
        if (!src) return null;
        const r = cosmeticRect(c, box);
        return (
          <img
            key={c.id}
            src={src}
            alt=""
            className="pointer-events-none absolute object-contain"
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          />
        );
      });

  return (
    <div className="mx-auto grid place-items-center rounded-2xl bg-gradient-to-b from-sky-100 to-pink-100 p-2 shadow-inner">
      <div className="relative" style={{ width: W, height: H }}>
        {render(true)}
        {baseUrl ? (
          <img src={baseUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-5xl">🧍</div>
        )}
        {render(false)}
      </div>
    </div>
  );
}

