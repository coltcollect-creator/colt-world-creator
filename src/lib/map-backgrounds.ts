import pastelTownBgImg from "@/assets/images/dreamy_pastel_town_bg_1790836742200.jpg";
import endlessOceanBgImg from "@/assets/images/endless_ocean_bg_1790836759398.jpg";

export type MapBackgroundTheme = "classic_sky" | "pastel_town" | "endless_ocean" | "custom";

export interface TimeOfDayInfo {
  isNight: boolean; // true if 19:00 to 05:59
  hour: number;
  timeString: string;
  themeColor: string;
}

// Check time of day based on current hour (Daytime: 06:00 - 18:59, Nighttime: 19:00 - 05:59)
export function getTimeOfDayInfo(): TimeOfDayInfo {
  const now = new Date();
  const hour = now.getHours();
  const isNight = hour >= 19 || hour < 6;

  const timeString = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const themeColor = isNight ? "#0b1026" : "#c6e9ff";

  return { isNight, hour, timeString, themeColor };
}

// Cached image loaders for background assets
const imageCache = new Map<string, HTMLImageElement>();

function getLoadedImage(src: string): HTMLImageElement | null {
  if (!src) return null;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// Preload the theme images immediately
if (typeof window !== "undefined") {
  getLoadedImage(pastelTownBgImg);
  getLoadedImage(endlessOceanBgImg);
}

export const MAP_THEMES: Array<{
  id: MapBackgroundTheme;
  name: string;
  description: string;
  emoji: string;
  previewColor: string;
}> = [
  {
    id: "classic_sky",
    name: "שמיים ועננים דינמיים",
    description: "עננים זזים, שמש ביום וירח וכוכבים נוצצים בלילה (מ-19:00)",
    emoji: "🌤️",
    previewColor: "#38bdf8",
  },
  {
    id: "pastel_town",
    name: "עיירת פסטל חלומית",
    description: "בתים צבעוניים, חלונות מוארים ושרשראות דגלים בהשראת Mew EX",
    emoji: "🌸",
    previewColor: "#f472b6",
  },
  {
    id: "endless_ocean",
    name: "אוקיינוס וים אינסופי",
    description: "גלי מים נעים, אופק טרופי אינסופי, השתקפויות שמש/ירח ושחפים",
    emoji: "🌊",
    previewColor: "#0284c7",
  },
];

export interface BackgroundRenderOptions {
  ctx: CanvasRenderingContext2D;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  camX: number;
  camY: number;
  theme?: MapBackgroundTheme | string | null;
  customBgColor?: string | null;
  customBgUrl?: string | null;
  time?: number; // performance.now() timestamp
}

export function renderAnimatedMapBackground({
  ctx,
  viewportWidth,
  viewportHeight,
  worldWidth,
  worldHeight,
  camX,
  camY,
  theme = "classic_sky",
  customBgColor,
  customBgUrl,
  time = performance.now(),
}: BackgroundRenderOptions) {
  const { isNight } = getTimeOfDayInfo();
  const selectedTheme = (theme as MapBackgroundTheme) || "classic_sky";
  const tSec = time / 1000;

  // Custom Image URL if provided
  if (customBgUrl) {
    const customImg = getLoadedImage(customBgUrl);
    if (customImg) {
      // Tile or stretch custom image horizontally across world width with parallax
      const patternW = Math.max(800, (customImg.naturalWidth * viewportHeight) / customImg.naturalHeight);
      const startX = -((camX * 0.35) % patternW);
      for (let x = startX - patternW; x < viewportWidth + patternW; x += patternW) {
        ctx.drawImage(customImg, x, 0, patternW, viewportHeight);
      }
      return;
    }
  }

  switch (selectedTheme) {
    case "pastel_town":
      renderPastelTownTheme(ctx, viewportWidth, viewportHeight, camX, camY, tSec, isNight);
      break;

    case "endless_ocean":
      renderEndlessOceanTheme(ctx, viewportWidth, viewportHeight, camX, camY, tSec, isNight);
      break;

    case "classic_sky":
    default:
      renderClassicSkyTheme(ctx, viewportWidth, viewportHeight, worldWidth, camX, camY, tSec, isNight, customBgColor);
      break;
  }
}

// -------------------------------------------------------------
// THEME 1: CLASSIC DYNAMIC SKY (DAY / NIGHT 19:00 CYCLE)
// -------------------------------------------------------------
function renderClassicSkyTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  worldWidth: number,
  camX: number,
  camY: number,
  tSec: number,
  isNight: boolean,
  customBgColor?: string | null
) {
  // Sky Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (customBgColor) {
    grad.addColorStop(0, customBgColor);
    grad.addColorStop(1, isNight ? "#060919" : "#ffffff");
  } else if (isNight) {
    // Night sky (19:00+)
    grad.addColorStop(0, "#070b1e");
    grad.addColorStop(0.5, "#0e1838");
    grad.addColorStop(1, "#1e295d");
  } else {
    // Daylight sky
    grad.addColorStop(0, "#ffd5ec");
    grad.addColorStop(0.45, "#bfe7ff");
    grad.addColorStop(1, "#fff6cf");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Celestial Body: Sun or Moon
  const celestialX = ((w * 0.75 - camX * 0.05) % (w + 200)) - 50;
  const celestialY = 70 + Math.sin(tSec * 0.2) * 5;

  if (isNight) {
    // Glowing Moon
    ctx.save();
    // Moon halo glow
    const halo = ctx.createRadialGradient(celestialX, celestialY, 15, celestialX, celestialY, 65);
    halo.addColorStop(0, "rgba(254, 240, 138, 0.45)");
    halo.addColorStop(0.5, "rgba(254, 240, 138, 0.15)");
    halo.addColorStop(1, "rgba(254, 240, 138, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(celestialX, celestialY, 65, 0, Math.PI * 2);
    ctx.fill();

    // Crescent / Full Moon Body
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(celestialX, celestialY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Moon craters
    ctx.fillStyle = "rgba(202, 138, 4, 0.25)";
    ctx.beginPath();
    ctx.arc(celestialX - 6, celestialY - 4, 5, 0, Math.PI * 2);
    ctx.arc(celestialX + 8, celestialY + 6, 7, 0, Math.PI * 2);
    ctx.arc(celestialX - 4, celestialY + 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Twinkling stars
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (let i = 0; i < 35; i++) {
      const starX = (i * 97 - camX * 0.04) % w;
      const actualX = starX < 0 ? starX + w : starX;
      const starY = (i * 47) % (h * 0.55);
      const twinkle = Math.max(0.1, 0.5 + 0.5 * Math.sin(tSec * 2 + i));
      const r = Math.max(0.5, 1 + (i % 3) * 0.6 * twinkle);
      ctx.beginPath();
      ctx.arc(actualX, starY, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Glowing Warm Sun
    ctx.save();
    // Sun Rays glow
    const sunGlow = ctx.createRadialGradient(celestialX, celestialY, 20, celestialX, celestialY, 80);
    sunGlow.addColorStop(0, "rgba(253, 224, 71, 0.6)");
    sunGlow.addColorStop(0.5, "rgba(251, 146, 60, 0.2)");
    sunGlow.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(celestialX, celestialY, 80, 0, Math.PI * 2);
    ctx.fill();

    // Sun core
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(celestialX, celestialY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Distant rolling hills with parallax
  ctx.fillStyle = isNight ? "rgba(20, 30, 70, 0.65)" : "rgba(255, 255, 255, 0.5)";
  const hillWidth = 520;
  for (let i = -1; i < Math.ceil(w / hillWidth) + 2; i++) {
    const hx = ((i * hillWidth - camX * 0.18) % (w + hillWidth));
    const finalHx = hx < -hillWidth ? hx + w + hillWidth * 2 : hx;
    ctx.beginPath();
    ctx.ellipse(finalHx, h - 85, 280, 95, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moving animated clouds (Layer 1 - Far & Slow)
  ctx.fillStyle = isNight ? "rgba(148, 163, 184, 0.25)" : "rgba(255, 255, 255, 0.65)";
  for (let i = 0; i < 5; i++) {
    const cloudSpeed = 12; // px per sec
    const baseOffset = i * 420;
    const cx = ((baseOffset + tSec * cloudSpeed - camX * 0.25) % (w + 300)) - 100;
    const finalCx = cx < -200 ? cx + w + 300 : cx;
    const cy = 60 + (i % 3) * 35;
    drawPuffyCloud(ctx, finalCx, cy, 1.1);
  }

  // Moving animated clouds (Layer 2 - Closer & Faster)
  ctx.fillStyle = isNight ? "rgba(203, 213, 225, 0.4)" : "rgba(255, 255, 255, 0.88)";
  for (let i = 0; i < 4; i++) {
    const cloudSpeed = 22; // px per sec
    const baseOffset = i * 480 + 200;
    const cx = ((baseOffset + tSec * cloudSpeed - camX * 0.4) % (w + 350)) - 100;
    const finalCx = cx < -200 ? cx + w + 350 : cx;
    const cy = 110 + (i % 2) * 45;
    drawPuffyCloud(ctx, finalCx, cy, 1.35);
  }
}

// -------------------------------------------------------------
// THEME 2: DREAMY PASTEL FANTASY TOWN (Mew EX Aesthetic)
// -------------------------------------------------------------
function renderPastelTownTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
  camY: number,
  tSec: number,
  isNight: boolean
) {
  // Sunset / Twilight dreamy sky backdrop
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  if (isNight) {
    skyGrad.addColorStop(0, "#190e38");
    skyGrad.addColorStop(0.45, "#381a4d");
    skyGrad.addColorStop(1, "#5b2354");
  } else {
    skyGrad.addColorStop(0, "#f472b6"); // dreamy magenta pink
    skyGrad.addColorStop(0.4, "#fbcfe8"); // pastel blush
    skyGrad.addColorStop(0.75, "#fed7aa"); // soft apricot
    skyGrad.addColorStop(1, "#fef08a"); // warm pastel yellow
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // High-Res Panoramic Town Backdrop with gentle horizontal parallax
  const bgImg = getLoadedImage(pastelTownBgImg);
  if (bgImg) {
    const imgH = h * 0.95;
    const imgW = (bgImg.naturalWidth * imgH) / bgImg.naturalHeight;
    const startX = -((camX * 0.35) % imgW);

    for (let x = startX - imgW; x < w + imgW; x += imgW) {
      ctx.drawImage(bgImg, x, h - imgH, imgW, imgH);
    }
  }

  // Floating pastel cloud puffs
  ctx.fillStyle = isNight ? "rgba(232, 121, 249, 0.25)" : "rgba(255, 255, 255, 0.75)";
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 380 + tSec * 16 - camX * 0.22) % (w + 280)) - 80;
    const finalCx = cx < -150 ? cx + w + 280 : cx;
    const cy = 40 + (i % 3) * 28;
    drawPuffyCloud(ctx, finalCx, cy, 0.9);
  }

  // Whimsical glowing fairy lights / lanterns
  for (let i = 0; i < 8; i++) {
    const fx = ((i * 240 + Math.sin(tSec + i) * 8 - camX * 0.45) % (w + 100));
    const finalFx = fx < 0 ? fx + w + 100 : fx;
    const fy = h - 160 + Math.cos(tSec * 1.5 + i) * 12;
    const glow = Math.max(0.2, 0.4 + 0.6 * Math.abs(Math.sin(tSec * 3 + i * 2)));

    ctx.save();
    const fairyGrad = ctx.createRadialGradient(finalFx, fy, 2, finalFx, fy, 18);
    fairyGrad.addColorStop(0, "rgba(254, 240, 138, 0.95)");
    fairyGrad.addColorStop(0.5, "rgba(244, 114, 182, 0.45)");
    fairyGrad.addColorStop(1, "rgba(244, 114, 182, 0)");
    ctx.fillStyle = fairyGrad;
    ctx.beginPath();
    ctx.arc(finalFx, fy, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(finalFx, fy, Math.max(0.5, 2.5 * glow), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// -------------------------------------------------------------
// THEME 3: ENDLESS OCEAN & HORIZON
// -------------------------------------------------------------
function renderEndlessOceanTheme(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
  camY: number,
  tSec: number,
  isNight: boolean
) {
  // Tropical sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  if (isNight) {
    skyGrad.addColorStop(0, "#050d24");
    skyGrad.addColorStop(0.5, "#0b2046");
    skyGrad.addColorStop(1, "#133863");
  } else {
    skyGrad.addColorStop(0, "#38bdf8");
    skyGrad.addColorStop(0.45, "#7dd3fc");
    skyGrad.addColorStop(0.75, "#bae6fd");
    skyGrad.addColorStop(1, "#e0f2fe");
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Panoramic Ocean & Island Backdrop
  const oceanImg = getLoadedImage(endlessOceanBgImg);
  if (oceanImg) {
    const imgH = h * 0.88;
    const imgW = (oceanImg.naturalWidth * imgH) / oceanImg.naturalHeight;
    const startX = -((camX * 0.3) % imgW);

    for (let x = startX - imgW; x < w + imgW; x += imgW) {
      ctx.drawImage(oceanImg, x, h - imgH, imgW, imgH);
    }
  }

  // Animated Procedural Ocean Waves on lower viewport
  const waveY = h - 140;
  const waveH = 140;

  // Wave Layer 1 (Deeper water)
  ctx.fillStyle = isNight ? "rgba(10, 35, 75, 0.75)" : "rgba(14, 116, 144, 0.55)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 20; x += 20) {
    const waveSin = Math.sin((x + camX * 0.4) * 0.015 + tSec * 2.5) * 8;
    ctx.lineTo(x, waveY + 20 + waveSin);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Wave Layer 2 (Crest & Sparkles)
  ctx.fillStyle = isNight ? "rgba(30, 70, 130, 0.85)" : "rgba(6, 182, 212, 0.65)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 20; x += 20) {
    const waveSin = Math.sin((x + camX * 0.6) * 0.02 + tSec * 3.8 + 1) * 6;
    ctx.lineTo(x, waveY + 45 + waveSin);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Wave Foam / Glistening Light
  ctx.strokeStyle = isNight ? "rgba(147, 197, 253, 0.6)" : "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= w + 20; x += 30) {
    const waveSin = Math.sin((x + camX * 0.6) * 0.02 + tSec * 3.8 + 1) * 6;
    if (Math.sin(x * 0.1 + tSec) > 0.1) {
      ctx.moveTo(x, waveY + 45 + waveSin);
      ctx.lineTo(x + 18, waveY + 45 + waveSin);
    }
  }
  ctx.stroke();

  // Soaring Seagulls gliding across the horizon
  ctx.strokeStyle = isNight ? "rgba(203, 213, 225, 0.7)" : "#ffffff";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const birdX = ((i * 360 + tSec * 35 - camX * 0.15) % (w + 200)) - 50;
    const finalBx = birdX < -80 ? birdX + w + 200 : birdX;
    const birdY = 75 + (i * 35) + Math.sin(tSec * 2 + i) * 8;
    const flap = Math.sin(tSec * 6 + i) * 4;

    ctx.beginPath();
    ctx.moveTo(finalBx - 10, birdY + flap);
    ctx.quadraticCurveTo(finalBx - 5, birdY - 4, finalBx, birdY);
    ctx.quadraticCurveTo(finalBx + 5, birdY - 4, finalBx + 10, birdY + flap);
    ctx.stroke();
  }
}

// Utility: Draw Fluffy Cartoon Cloud
function drawPuffyCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.arc(22, -6, 20, 0, Math.PI * 2);
  ctx.arc(42, 2, 22, 0, Math.PI * 2);
  ctx.arc(20, 14, 18, 0, Math.PI * 2);
  ctx.arc(-10, 10, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
