// Shared avatar geometry so cosmetics land in the same place everywhere
// (game canvas, skins market preview, owner character preview).

export const PLAYER_W = 96;
export const PLAYER_H = 144;

/** Base size the owner-provided offset_x / offset_y values were authored against. */
export const OFFSET_BASE_W = 96;
export const OFFSET_BASE_H = 144;

export type AnchorBox = {
  /** fractions of the character box */
  x: number;
  y: number;
  w: number;
  h: number;
  /** drawn behind the character sprite */
  behind?: boolean;
};

/**
 * Anchors are expressed as fractions of the character box, so they scale
 * automatically whenever the character size changes.
 * Character sprite assumption: head ≈ top 30%, torso ≈ 30%–60%, legs ≈ 60%–100%.
 */
export const LAYER_ANCHORS: Record<string, AnchorBox> = {
  background: { x: -0.35, y: -0.22, w: 1.7, h: 1.45, behind: true },
  backdrop: { x: -0.35, y: -0.22, w: 1.7, h: 1.45, behind: true },
  wings: { x: -0.2, y: 0.18, w: 1.4, h: 0.55, behind: true },
  cape: { x: 0.06, y: 0.26, w: 0.88, h: 0.6, behind: true },
  aura: { x: -0.15, y: -0.1, w: 1.3, h: 1.2, behind: true },

  hat: { x: 0.17, y: -0.1, w: 0.66, h: 0.36 },
  head: { x: 0.17, y: -0.1, w: 0.66, h: 0.36 },
  hair: { x: 0.18, y: -0.04, w: 0.64, h: 0.34 },
  mask: { x: 0.24, y: 0.1, w: 0.52, h: 0.18 },
  face: { x: 0.24, y: 0.1, w: 0.52, h: 0.18 },
  glasses: { x: 0.24, y: 0.12, w: 0.52, h: 0.13 },

  necklace: { x: 0.32, y: 0.29, w: 0.36, h: 0.18 },
  shirt: { x: 0.13, y: 0.29, w: 0.74, h: 0.34 },
  top: { x: 0.13, y: 0.29, w: 0.74, h: 0.34 },
  armor: { x: 0.1, y: 0.27, w: 0.8, h: 0.38 },
  back: { x: 0.1, y: 0.27, w: 0.8, h: 0.4, behind: true },

  pants: { x: 0.2, y: 0.58, w: 0.6, h: 0.32 },
  shoes: { x: 0.16, y: 0.85, w: 0.68, h: 0.16 },

  hand: { x: 0.62, y: 0.4, w: 0.42, h: 0.34 },
  hands: { x: 0.62, y: 0.4, w: 0.42, h: 0.34 },
  item: { x: 0.62, y: 0.4, w: 0.42, h: 0.34 },
  weapon: { x: 0.6, y: 0.32, w: 0.48, h: 0.5 },
  pet: { x: 0.72, y: 0.68, w: 0.42, h: 0.32 },
};

export const DEFAULT_ANCHOR: AnchorBox = { x: 0, y: 0, w: 1, h: 1 };

export function anchorFor(layerType?: string | null): AnchorBox {
  if (!layerType) return DEFAULT_ANCHOR;
  return LAYER_ANCHORS[layerType.toLowerCase()] ?? DEFAULT_ANCHOR;
}

export function isBehindLayer(layerType?: string | null): boolean {
  return !!anchorFor(layerType).behind;
}

export type CosmeticGeom = {
  layer_type: string;
  offset_x?: number | null;
  offset_y?: number | null;
  scale?: number | null;
};

/**
 * Resolve where a cosmetic should be drawn for a character box.
 * Keeps aspect-independent anchoring; `scale` grows the piece around its anchor
 * center, and offsets nudge it (authored against a 96x144 character).
 */
export function cosmeticRect(
  c: CosmeticGeom,
  box: { x: number; y: number; w: number; h: number },
) {
  const a = anchorFor(c.layer_type);
  const scale = c.scale && c.scale > 0 ? c.scale : 1;
  const baseW = a.w * box.w;
  const baseH = a.h * box.h;
  const w = baseW * scale;
  const h = baseH * scale;
  const cx = box.x + (a.x + a.w / 2) * box.w;
  const cy = box.y + (a.y + a.h / 2) * box.h;
  const ox = ((c.offset_x ?? 0) / OFFSET_BASE_W) * box.w;
  const oy = ((c.offset_y ?? 0) / OFFSET_BASE_H) * box.h;
  return { x: cx - w / 2 + ox, y: cy - h / 2 + oy, w, h, behind: !!a.behind };
}

/** Layers ordered back-to-front for rendering. */
export function sortLayers<T extends { layer_order?: number | null; layer_type: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.layer_order ?? 0) - (b.layer_order ?? 0));
}
