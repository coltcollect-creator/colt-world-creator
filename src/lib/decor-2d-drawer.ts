import type { DecorPresetItem } from "./decor-catalog";

function safeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

export function drawDecor2DPreset(
  ctx: CanvasRenderingContext2D,
  preset: DecorPresetItem,
  x: number,
  y: number,
  w: number,
  h: number,
  customImg?: HTMLImageElement | null
) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  const id = preset.id;

  if (customImg && customImg.complete && customImg.naturalWidth) {
    ctx.drawImage(customImg, x, y, w, h);
    ctx.restore();
    return;
  }

  switch (id) {
    // 🛎️ Reception desks
    case "reception_luxury": {
      // Counter
      ctx.fillStyle = "#f8fafc";
      safeRoundRect(ctx, x, y + h * 0.25, w, h * 0.75, 12);
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      ctx.stroke();
      // Gold strip
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(x, y + h * 0.25, w, 8);
      // Monitor
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(cx - 16, y + h * 0.05, 32, 22);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(cx - 14, y + h * 0.05 + 2, 28, 18);
      // Bell
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(cx + w * 0.28, y + h * 0.22, 6, Math.PI, 0);
      ctx.fill();
      break;
    }
    case "reception_cyber": {
      ctx.fillStyle = "#020617";
      safeRoundRect(ctx, x, y + h * 0.25, w, h * 0.75, 12);
      ctx.fill();
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3;
      ctx.stroke();
      // Neon logo strip
      ctx.fillStyle = "#06b6d4";
      ctx.fillRect(x + 10, y + h * 0.5, w - 20, 10);
      ctx.fillStyle = "#ec4899";
      ctx.fillRect(x + 4, y + h - 6, w - 8, 4);
      break;
    }

    // 🪴 Pots
    case "pot_terracotta": {
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.35, y + h * 0.45);
      ctx.lineTo(cx + w * 0.35, y + h * 0.45);
      ctx.lineTo(cx + w * 0.25, y + h);
      ctx.lineTo(cx - w * 0.25, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#15803d";
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.35, w * 0.38, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pot_geometric": {
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(cx - w * 0.3, y + h * 0.45, w * 0.6, h * 0.55);
      ctx.fillStyle = "#166534";
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx + i * 8 - 3, y + h * 0.05, 6, h * 0.45);
      }
      break;
    }
    case "pot_gold_tall": {
      ctx.fillStyle = "#eab308";
      ctx.fillRect(cx - w * 0.25, y + h * 0.4, w * 0.5, h * 0.6);
      ctx.fillStyle = "#573a24";
      ctx.fillRect(cx - 3, y + h * 0.25, 6, h * 0.2);
      ctx.fillStyle = "#14532d";
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.22, w * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pot_cyber_neon": {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(cx - w * 0.28, y + h * 0.45, w * 0.56, h * 0.55);
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - w * 0.28, y + h * 0.45, w * 0.56, h * 0.55);
      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.05);
      ctx.lineTo(cx + w * 0.3, y + h * 0.45);
      ctx.lineTo(cx - w * 0.3, y + h * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    }

    // 🌿 Plants
    case "plant_monstera": {
      ctx.fillStyle = "#334155";
      ctx.fillRect(cx - w * 0.2, y + h * 0.65, w * 0.4, h * 0.35);
      ctx.fillStyle = "#15803d";
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(ang) * w * 0.3, y + h * 0.35 + Math.sin(ang) * h * 0.2, w * 0.2, h * 0.25, ang, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "plant_bamboo": {
      ctx.fillStyle = "#451a03";
      ctx.fillRect(x, y + h * 0.8, w, h * 0.2);
      ctx.fillStyle = "#65a30d";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + 10 + (i * (w - 20)) / 4 - 3, y + h * 0.1, 6, h * 0.7);
      }
      break;
    }
    case "plant_flower_bush": {
      ctx.fillStyle = "#15803d";
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d946ef";
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * w * 0.25, cy + Math.sin(ang) * h * 0.25, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // 🌳 Trees
    case "tree_cyber_neon": {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - 8, y + h * 0.6, 16, h * 0.4);
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.05);
      ctx.lineTo(cx + w * 0.45, y + h * 0.65);
      ctx.lineTo(cx - w * 0.45, y + h * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.25);
      ctx.lineTo(cx + w * 0.35, y + h * 0.5);
      ctx.lineTo(cx - w * 0.35, y + h * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "tree_cherry_sakura": {
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(cx - 8, y + h * 0.5, 16, h * 0.5);
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.35, w * 0.4, 0, Math.PI * 2);
      ctx.arc(cx - w * 0.2, y + h * 0.3, w * 0.25, 0, Math.PI * 2);
      ctx.arc(cx + w * 0.2, y + h * 0.3, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "tree_palm_tropical": {
      ctx.fillStyle = "#78350f";
      ctx.fillRect(cx - 6, y + h * 0.4, 12, h * 0.6);
      ctx.fillStyle = "#22c55e";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * w * 0.35, y + h * 0.35 + Math.sin(a) * h * 0.15, w * 0.3, 10, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "tree_golden_oak": {
      ctx.fillStyle = "#451a03";
      ctx.fillRect(cx - 10, y + h * 0.5, 20, h * 0.5);
      ctx.fillStyle = "#ca8a04";
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.35, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // 🥤 Vending machines
    case "vending_soda_retro": {
      ctx.fillStyle = "#dc2626";
      safeRoundRect(ctx, x + 4, y, w - 8, h, 10);
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      safeRoundRect(ctx, x + 10, y + 10, w - 20, h * 0.45, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🥤 SODA", cx, y + 35);
      ctx.fillStyle = "#111827";
      ctx.fillRect(cx - 20, y + h - 25, 40, 16);
      break;
    }
    case "vending_cyber_energy": {
      ctx.fillStyle = "#020617";
      safeRoundRect(ctx, x + 4, y, w - 8, h, 10);
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 4, y, w - 8, h);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(x + 10, y + 15, w - 20, h * 0.4);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚡ ENERGY", cx, y + 35);
      break;
    }
    case "vending_snack_deluxe": {
      ctx.fillStyle = "#1e3a8a";
      safeRoundRect(ctx, x + 4, y, w - 8, h, 10);
      ctx.fill();
      ctx.fillStyle = "#93c5fd";
      safeRoundRect(ctx, x + 10, y + 12, w - 20, h * 0.55, 6);
      ctx.fill();
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - 25, y + h - 22, 50, 14);
      break;
    }

    // 🪞 Mirrors
    case "mirror_luxury_gold": {
      ctx.fillStyle = "#f59e0b";
      safeRoundRect(ctx, x + 4, y, w - 8, h, 20);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      safeRoundRect(ctx, x + 10, y + 8, w - 20, h - 16, 16);
      ctx.fill();
      break;
    }
    case "mirror_neon_cyber": {
      ctx.fillStyle = "#a855f7";
      safeRoundRect(ctx, x + 2, y, w - 4, h, 14);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      safeRoundRect(ctx, x + 8, y + 6, w - 16, h - 12, 10);
      ctx.fill();
      break;
    }
    case "mirror_modern_wood": {
      ctx.fillStyle = "#78350f";
      safeRoundRect(ctx, x + 6, y, w - 12, h, 12);
      ctx.fill();
      ctx.fillStyle = "#f1f5f9";
      safeRoundRect(ctx, x + 12, y + 6, w - 24, h - 12, 8);
      ctx.fill();
      break;
    }

    // 🛋️ Sofas
    case "sofa_cyber_lounge":
    case "sofa_luxury_velvet":
    case "sofa_modern_white":
    case "sofa_leather_tan": {
      ctx.fillStyle = preset.color;
      // Base
      safeRoundRect(ctx, x, y + h * 0.4, w, h * 0.6, 12);
      ctx.fill();
      // Backrest
      safeRoundRect(ctx, x, y, w, h * 0.5, 10);
      ctx.fill();
      // Cushions divider
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.2);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
      break;
    }

    // 🪑 Armchairs
    case "armchair_egg_chair": {
      ctx.fillStyle = "#e11d48";
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.45, w * 0.45, h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(cx - 3, y + h * 0.85, 6, h * 0.15);
      break;
    }
    case "armchair_modern_grey": {
      ctx.fillStyle = "#334155";
      safeRoundRect(ctx, x + 4, y + h * 0.3, w - 8, h * 0.7, 10);
      ctx.fill();
      safeRoundRect(ctx, x + 4, y, w - 8, h * 0.45, 8);
      ctx.fill();
      break;
    }
    case "armchair_cyber_pod": {
      ctx.fillStyle = "#0284c7";
      safeRoundRect(ctx, x + 4, y, w - 8, h, 20);
      ctx.fill();
      break;
    }

    // ☕ Small Tables
    case "table_round_glass": {
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(cx - 4, y + h * 0.2, 8, h * 0.8);
      ctx.fillStyle = "#0284c7";
      safeRoundRect(ctx, x, y, w, h * 0.35, 12);
      ctx.fill();
      break;
    }
    case "table_round_cafe": {
      ctx.fillStyle = "#111827";
      ctx.fillRect(cx - 4, y + h * 0.25, 8, h * 0.75);
      ctx.fillStyle = "#92400e";
      safeRoundRect(ctx, x, y, w, h * 0.35, 10);
      ctx.fill();
      break;
    }

    // 🏢 Large Tables
    case "table_large_conference": {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x + 10, y + h * 0.3, 10, h * 0.7);
      ctx.fillRect(x + w - 20, y + h * 0.3, 10, h * 0.7);
      ctx.fillStyle = "#5c2b14";
      safeRoundRect(ctx, x, y, w, h * 0.35, 10);
      ctx.fill();
      break;
    }
    case "table_large_cyber": {
      ctx.fillStyle = "#020617";
      ctx.fillRect(cx - w * 0.35, y + h * 0.25, w * 0.7, h * 0.75);
      ctx.fillStyle = "#06b6d4";
      safeRoundRect(ctx, x, y, w, h * 0.3, 8);
      ctx.fill();
      break;
    }

    // 🟪 Rugs
    case "rug_luxury_oriental":
    case "rug_geometric_modern":
    case "rug_cyber_hologram":
    default: {
      ctx.fillStyle = preset.color || "#8b5cf6";
      safeRoundRect(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(preset.icon, cx, cy + 4);
      break;
    }
  }

  ctx.restore();
}
