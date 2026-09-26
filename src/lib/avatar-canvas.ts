import { cosmeticRect, sortLayers } from "@/lib/avatar-layout";

export type AvatarCosmetic = {
  id: string;
  layer_type: string;
  sprite_left_url: string | null;
  sprite_right_url: string | null;
  offset_x: number | null;
  offset_y: number | null;
  scale: number | null;
  layer_order: number | null;
};

export type AvatarLook = {
  idle: string | null;
  right: string | null;
  left: string | null;
  cosmetics: AvatarCosmetic[];
};

const IMG_CACHE = new Map<string, HTMLImageElement>();

export function getAvatarImg(url?: string | null) {
  if (!url) return null;
  const cached = IMG_CACHE.get(url);
  if (cached) return cached;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  IMG_CACHE.set(url, img);
  return img;
}

/** Composites base character sprite + equipped cosmetics onto a canvas. */
export function paintAvatarCanvas(canvas: HTMLCanvasElement, look: AvatarLook, facing: "left" | "right") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const box = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const ordered = sortLayers(
    look.cosmetics.map((c) => ({ ...c, layer_order: c.layer_order ?? 0 })),
  );

  const drawPiece = (c: AvatarCosmetic) => {
    const url = facing === "right" ? c.sprite_right_url : (c.sprite_left_url ?? c.sprite_right_url);
    const img = getAvatarImg(url);
    if (!img || !img.complete || !img.naturalWidth) return;
    const r = cosmeticRect(c, box);
    const ratio = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    ctx.drawImage(img, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
  };

  for (const c of ordered) if (cosmeticRect(c, box).behind) drawPiece(c);

  const baseUrl = facing === "right" ? (look.right ?? look.idle) : (look.left ?? look.idle ?? look.right);
  const base = getAvatarImg(baseUrl);
  if (base && base.complete && base.naturalWidth) {
    const ratio = Math.min(canvas.width / base.naturalWidth, canvas.height / base.naturalHeight);
    const dw = base.naturalWidth * ratio;
    const dh = base.naturalHeight * ratio;
    ctx.drawImage(base, (canvas.width - dw) / 2, canvas.height - dh, dw, dh);
  }

  for (const c of ordered) if (!cosmeticRect(c, box).behind) drawPiece(c);
}

/** True when every image the look needs has finished decoding. */
export function avatarAssetsReady(look: AvatarLook) {
  const urls = [look.idle, look.right, look.left, ...look.cosmetics.flatMap((c) => [c.sprite_right_url, c.sprite_left_url])];
  return urls.filter(Boolean).every((u) => {
    const img = getAvatarImg(u);
    return !img || img.complete;
  });
}
