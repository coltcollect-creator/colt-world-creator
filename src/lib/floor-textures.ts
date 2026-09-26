// Procedural floor styles for 3D maps. Each style renders to a small canvas
// that we tile across the ground plane, so no extra assets are required.

export type FloorType =
  | "grass"
  | "wood"
  | "tile"
  | "checker"
  | "stone"
  | "sand"
  | "carpet"
  | "asphalt"
  | "marble"
  | "custom";

export const FLOOR_TYPES: Array<{ key: FloorType; label: string; icon: string }> = [
  { key: "grass", label: "דשא", icon: "🌱" },
  { key: "wood", label: "פרקט עץ", icon: "🪵" },
  { key: "tile", label: "אריחים", icon: "🧱" },
  { key: "checker", label: "שחמט", icon: "🏁" },
  { key: "stone", label: "אבן", icon: "🪨" },
  { key: "sand", label: "חול", icon: "🏖️" },
  { key: "carpet", label: "שטיח", icon: "🟥" },
  { key: "asphalt", label: "אספלט", icon: "🛣️" },
  { key: "marble", label: "שיש", icon: "⬜" },
  { key: "custom", label: "תמונה מותאמת", icon: "🖼️" },
];

export const FLOOR_BASE_COLOR: Record<FloorType, string> = {
  grass: "#7dd3a0",
  wood: "#c08552",
  tile: "#e6eef5",
  checker: "#f1f5f9",
  stone: "#9aa3ab",
  sand: "#f0d9a7",
  carpet: "#b3455a",
  asphalt: "#4b5563",
  marble: "#f5f5f7",
  custom: "#ffffff",
};

/** World size (in map units) covered by one texture tile. */
export const FLOOR_TILE_SIZE: Record<FloorType, number> = {
  grass: 400,
  wood: 320,
  tile: 240,
  checker: 240,
  stone: 300,
  sand: 420,
  carpet: 360,
  asphalt: 380,
  marble: 500,
  custom: 600,
};

function shade(ctx: CanvasRenderingContext2D, color: string, alpha: number, x: number, y: number, w: number, h: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
}

/** Builds a tileable 128x128 canvas for the given floor style. */
export function makeFloorCanvas(type: FloorType, colorOverride?: string | null): HTMLCanvasElement {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const base = colorOverride || FLOOR_BASE_COLOR[type] || "#cccccc";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  if (type === "grass") {
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * S;
      const y = Math.random() * S;
      shade(ctx, Math.random() > 0.5 ? "#ffffff" : "#0f5132", 0.08 + Math.random() * 0.12, x, y, 2, 4);
    }
  } else if (type === "wood") {
    const planks = 4;
    const ph = S / planks;
    for (let i = 0; i < planks; i++) {
      shade(ctx, i % 2 ? "#000000" : "#ffffff", 0.06, 0, i * ph, S, ph);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, i * ph);
      ctx.lineTo(S, i * ph);
      ctx.stroke();
      for (let g = 0; g < 12; g++) {
        shade(ctx, "#000000", 0.05, Math.random() * S, i * ph + Math.random() * ph, 18 + Math.random() * 40, 1);
      }
    }
  } else if (type === "tile" || type === "marble") {
    ctx.strokeStyle = type === "marble" ? "rgba(120,120,140,0.35)" : "rgba(90,110,130,0.45)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, S, S);
    ctx.beginPath();
    ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
    ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
    ctx.stroke();
    if (type === "marble") {
      ctx.strokeStyle = "rgba(120,120,150,0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * S, 0);
        ctx.bezierCurveTo(Math.random() * S, S / 3, Math.random() * S, (2 * S) / 3, Math.random() * S, S);
        ctx.stroke();
      }
    } else {
      shade(ctx, "#ffffff", 0.25, 6, 6, S / 2 - 14, S / 2 - 14);
    }
  } else if (type === "checker") {
    const half = S / 2;
    shade(ctx, "#1f2937", 0.85, 0, 0, half, half);
    shade(ctx, "#1f2937", 0.85, half, half, half, half);
  } else if (type === "stone") {
    for (let i = 0; i < 14; i++) {
      const w = 22 + Math.random() * 34;
      const h = 18 + Math.random() * 26;
      const x = Math.random() * S;
      const y = Math.random() * S;
      shade(ctx, Math.random() > 0.5 ? "#ffffff" : "#000000", 0.08 + Math.random() * 0.1, x, y, w, h);
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  } else if (type === "sand") {
    for (let i = 0; i < 1400; i++) {
      shade(ctx, Math.random() > 0.5 ? "#ffffff" : "#a1701f", 0.07, Math.random() * S, Math.random() * S, 2, 2);
    }
  } else if (type === "carpet") {
    for (let y = 0; y < S; y += 4) shade(ctx, y % 8 ? "#ffffff" : "#000000", 0.07, 0, y, S, 2);
    for (let i = 0; i < 500; i++) shade(ctx, "#ffffff", 0.05, Math.random() * S, Math.random() * S, 2, 2);
  } else if (type === "asphalt") {
    for (let i = 0; i < 1800; i++) {
      shade(ctx, Math.random() > 0.5 ? "#ffffff" : "#000000", 0.06, Math.random() * S, Math.random() * S, 2, 2);
    }
  }
  return c;
}
