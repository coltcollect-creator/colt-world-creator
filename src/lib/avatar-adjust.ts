// Per-player fine-tuning of cosmetic placement.
// Owners author global offsets on the cosmetic row; each player can nudge a
// piece a little so it sits perfectly on their own character. The overrides
// live in profiles.settings.cosmetic_adjust.

export type CosmeticAdjust = {
  /** horizontal nudge in 96px-character units */
  dx?: number;
  /** vertical nudge in 144px-character units */
  dy?: number;
  /** multiplier on the cosmetic scale */
  scale?: number;
  /** absolute layer order override (front/back within the stack) */
  layer?: number;
};

export type AdjustMap = Record<string, CosmeticAdjust>;

export const ADJUST_KEY = "cosmetic_adjust";

export function readAdjust(settings: unknown): AdjustMap {
  const s = (settings ?? {}) as Record<string, unknown>;
  const a = s[ADJUST_KEY];
  return (a && typeof a === "object" ? (a as AdjustMap) : {});
}

type Geom = {
  id: string;
  offset_x?: number | null;
  offset_y?: number | null;
  scale?: number | null;
  layer_order?: number | null;
};

/** Applies the player's overrides on top of the owner-authored geometry. */
export function applyAdjust<T extends Geom>(list: T[], adjust: AdjustMap | null | undefined): T[] {
  if (!adjust) return list;
  return list.map((c) => {
    const a = adjust[c.id];
    if (!a) return c;
    return {
      ...c,
      offset_x: (c.offset_x ?? 0) + (a.dx ?? 0),
      offset_y: (c.offset_y ?? 0) + (a.dy ?? 0),
      scale: (c.scale ?? 1) * (a.scale ?? 1),
      layer_order: a.layer ?? c.layer_order ?? 0,
    };
  });
}
