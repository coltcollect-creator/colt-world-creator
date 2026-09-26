import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLAYER_W, PLAYER_H, cosmeticRect, sortLayers, anchorFor } from "@/lib/avatar-layout";

type Cos = {
  id: string; name: string; layer_type: string; layer_order: number | null;
  sprite_right_url: string | null; thumbnail_url: string | null;
  offset_x: number | null; offset_y: number | null; scale: number | null;
};

const GUIDE_LAYERS = ["background", "cape", "shirt", "pants", "shoes", "hat", "necklace", "hand"];

/**
 * Owner-facing preview: shows the uploaded character at its real in-game size
 * with the cosmetic anchor zones (head / torso / legs / background) drawn on
 * top, so it's easy to verify that body proportions fit the cosmetics system.
 */
export function CharacterFitPreview({ imageUrl }: { imageUrl?: string | null }) {
  const ZOOM = 2;
  const boxW = PLAYER_W * ZOOM;
  const boxH = PLAYER_H * ZOOM;
  const [showGuides, setShowGuides] = useState(true);
  const [tryOn, setTryOn] = useState(false);

  const { data: cosmetics = [] } = useQuery({
    queryKey: ["fit-preview-cosmetics"],
    queryFn: async () =>
      ((await supabase
        .from("cosmetics")
        .select("id,name,layer_type,layer_order,sprite_right_url,thumbnail_url,offset_x,offset_y,scale")
        .eq("active", true)
        .order("layer_order")).data ?? []) as unknown as Cos[],
  });

  // one sample cosmetic per layer for the try-on view
  const sample = useMemo(() => {
    const byLayer = new Map<string, Cos>();
    for (const c of cosmetics) {
      if (!byLayer.has(c.layer_type) && (c.sprite_right_url || c.thumbnail_url)) byLayer.set(c.layer_type, c);
    }
    return sortLayers(Array.from(byLayer.values()));
  }, [cosmetics]);

  const box = { x: 0, y: 0, w: boxW, h: boxH };

  return (
    <div className="rounded-2xl border-2 border-border bg-muted/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold">תצוגה מקדימה + פריסת קוסמטיקות ({PLAYER_W}×{PLAYER_H} בפועל)</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setShowGuides((v) => !v)} className="chrome-panel px-2 py-1 text-[10px]">
            {showGuides ? "הסתר אזורים" : "הצג אזורים"}
          </button>
          <button type="button" onClick={() => setTryOn((v) => !v)} className="chrome-panel px-2 py-1 text-[10px]">
            {tryOn ? "בלי פריטים" : "הלבש פריטים לדוגמה"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className="relative shrink-0 rounded-xl bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%)] [background-position:0_0,8px_8px] [background-size:16px_16px]"
          style={{ width: boxW, height: boxH }}
        >
          {/* behind-character cosmetics */}
          {tryOn && sample.filter((c) => anchorFor(c.layer_type).behind).map((c) => {
            const r = cosmeticRect(c, box);
            return <img key={c.id} src={(c.sprite_right_url ?? c.thumbnail_url)!} alt="" className="absolute object-contain" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
          })}

          {imageUrl ? (
            <img src={imageUrl} alt="דמות" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-5xl opacity-40">🧍</div>
          )}

          {/* front cosmetics */}
          {tryOn && sample.filter((c) => !anchorFor(c.layer_type).behind).map((c) => {
            const r = cosmeticRect(c, box);
            return <img key={c.id} src={(c.sprite_right_url ?? c.thumbnail_url)!} alt="" className="absolute object-contain" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />;
          })}

          {/* anchor guides */}
          {showGuides && GUIDE_LAYERS.map((l) => {
            const r = cosmeticRect({ layer_type: l }, box);
            return (
              <div
                key={l}
                className="pointer-events-none absolute rounded border border-dashed border-primary/70"
                style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
              >
                <span className="absolute -top-3 right-0 rounded bg-primary px-1 text-[8px] font-bold text-primary-foreground">{l}</span>
              </div>
            );
          })}
          {/* ground line */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-emerald-500" />
        </div>

        <ul className="min-w-0 flex-1 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
          <li>• הדמות מוצגת בגודל האמיתי במשחק (מוגדל ×2 לנוחות).</li>
          <li>• ראש: 30% העליונים · גוף: 30%–60% · רגליים: 60%–100%.</li>
          <li>• הרגליים צריכות לגעת בקו הירוק התחתון, בלי שוליים שקופים מיותרים.</li>
          <li>• רקע/גלימה מצוירים מאחורי הדמות; כובע, חולצה ופריטי יד מצוירים מלפנים.</li>
        </ul>
      </div>
    </div>
  );
}
