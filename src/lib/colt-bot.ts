/**
 * Colt Bot Character Engine
 *
 * Dedicated renderer for the official COLT Bot mascot wearing the iconic purple hoodie
 * with the bold golden "C" emblem in the center. Used uniformly in the 2.5D Cool Environment
 * for all players.
 */

export type ColtFacing = "left" | "right";

const cachedTextures = new Map<string, HTMLCanvasElement>();

/**
 * Preloads and processes the AI-generated mascot images into transparent PNG canvases.
 */
function createCutoutCanvas(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(c);
        return;
      }
      ctx.drawImage(img, 0, 0);

      try {
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const data = imgData.data;
        const total = data.length;

        // Cut out pure white / near-white studio background with smooth anti-aliased edge
        for (let i = 0; i < total; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // High brightness white threshold
          if (r > 240 && g > 240 && b > 240) {
            // Distance from pure white
            const dist = Math.min(255 - r, 255 - g, 255 - b);
            if (dist < 4) {
              data[i + 3] = 0; // Pure transparent
            } else {
              // Soft feather
              data[i + 3] = Math.round((dist / 15) * 255);
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch {
        // Fallback if cross-origin tainted
      }
      resolve(c);
    };
    img.onerror = reject;
  });
}

// Background image cutouts cache
let cutoutRight: HTMLCanvasElement | null = null;
let cutoutLeft: HTMLCanvasElement | null = null;

if (typeof window !== "undefined") {
  createCutoutCanvas("/characters/colt-bot/colt_right.jpg")
    .then((c) => {
      cutoutRight = c;
    })
    .catch(() => {});

  createCutoutCanvas("/characters/colt-bot/colt_left.jpg")
    .then((c) => {
      cutoutLeft = c;
    })
    .catch(() => {});
}

/**
 * Draws the high-detail procedural Colt Bot with purple hoodie and 'C' emblem.
 * Guarantees zero blank frames, razor-sharp vector curves, and dynamic walking animation.
 */
export function drawColtBotProcedural(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  facing: ColtFacing = "right",
  isMoving = false,
  time = 0
) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const isLeft = facing === "left";
  const dir = isLeft ? -1 : 1;

  // Walking bob / step
  const step = isMoving ? Math.sin(time * 14) : 0;
  const stepCos = isMoving ? Math.cos(time * 14) : 0;
  const bobY = isMoving ? Math.abs(step) * 5 : Math.sin(time * 3) * 2;

  // Flip canvas horizontally if facing left
  if (isLeft) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  // --- 1. SNEAKERS & LEGS ---
  const legY = h * 0.72 - bobY;
  const legOffset1 = isMoving ? step * 12 : 0;
  const legOffset2 = isMoving ? -step * 12 : 0;

  // Left Leg (Back)
  ctx.fillStyle = "#1e1b4b"; // Dark purple-tinted tech pants
  ctx.beginPath();
  ctx.roundRect(cx - 18 + legOffset2, legY, 14, 30, 6);
  ctx.fill();

  // Left Sneaker
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(cx - 24 + legOffset2, legY + 24, 22, 12, [5, 5, 3, 3]);
  ctx.fill();
  // Sneaker cyan sole
  ctx.fillStyle = "#06b6d4";
  ctx.fillRect(cx - 24 + legOffset2, legY + 33, 22, 4);

  // Right Leg (Front)
  ctx.fillStyle = "#312e81";
  ctx.beginPath();
  ctx.roundRect(cx + 4 + legOffset1, legY, 14, 30, 6);
  ctx.fill();

  // Right Sneaker
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(cx + 2 + legOffset1, legY + 24, 24, 12, [5, 5, 3, 3]);
  ctx.fill();
  // Sneaker purple stripe
  ctx.fillStyle = "#7e22ce";
  ctx.fillRect(cx + 8 + legOffset1, legY + 26, 6, 6);
  // Sneaker cyan sole
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(cx + 2 + legOffset1, legY + 33, 24, 4);

  // --- 2. PURPLE HOODIE BODY ---
  const bodyY = h * 0.42 - bobY;
  const bodyW = 68;
  const bodyH = 62;

  // Shadow behind body / hood folds
  ctx.fillStyle = "#581c87"; // Deep purple shadow
  ctx.beginPath();
  ctx.roundRect(cx - bodyW / 2 - 2, bodyY - 4, bodyW + 4, bodyH + 8, 20);
  ctx.fill();

  // Main Purple Hoodie Torso
  const bodyGrad = ctx.createLinearGradient(cx, bodyY, cx, bodyY + bodyH);
  bodyGrad.addColorStop(0, "#9333ea"); // Vibrant royal purple
  bodyGrad.addColorStop(1, "#6b21a8"); // Rich darker purple
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(cx - bodyW / 2, bodyY, bodyW, bodyH, 18);
  ctx.fill();

  // Hoodie Kangaroo Pocket
  ctx.fillStyle = "#581c87";
  ctx.beginPath();
  ctx.roundRect(cx - 22, bodyY + 36, 44, 20, 8);
  ctx.fill();
  ctx.fillStyle = "#7e22ce";
  ctx.beginPath();
  ctx.roundRect(cx - 20, bodyY + 38, 40, 16, 6);
  ctx.fill();

  // Hoodie Drawstrings
  ctx.strokeStyle = "#e9d5ff";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  // Left string
  ctx.beginPath();
  ctx.moveTo(cx - 10, bodyY + 8);
  ctx.lineTo(cx - 12, bodyY + 28);
  ctx.stroke();
  // Right string
  ctx.beginPath();
  ctx.moveTo(cx + 10, bodyY + 8);
  ctx.lineTo(cx + 12, bodyY + 26);
  ctx.stroke();

  // Drawstring Aglets (Gold)
  ctx.fillStyle = "#facc15";
  ctx.fillRect(cx - 14, bodyY + 27, 4, 6);
  ctx.fillRect(cx + 10, bodyY + 25, 4, 6);

  // --- 3. ICONIC GOLD "C" EMBLEM IN THE CENTER ---
  const emblemX = cx + 2;
  const emblemY = bodyY + 22;

  // Golden Glow backdrop
  ctx.save();
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 10;

  // Outer dark contour for the "C"
  ctx.fillStyle = "#78350f";
  ctx.font = "900 28px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("C", emblemX, emblemY + 1);

  // Bright Vibrant Golden "C"
  const cGrad = ctx.createLinearGradient(emblemX, emblemY - 12, emblemX, emblemY + 12);
  cGrad.addColorStop(0, "#fef08a"); // Light brilliant gold
  cGrad.addColorStop(0.5, "#eab308"); // Rich gold
  cGrad.addColorStop(1, "#ca8a04"); // Warm amber
  ctx.fillStyle = cGrad;
  ctx.fillText("C", emblemX, emblemY);
  ctx.restore();

  // --- 4. HOODIE SLEEVES & ROBOT HANDS ---
  const armSwing = isMoving ? stepCos * 10 : 0;

  // Back Arm
  ctx.fillStyle = "#6b21a8";
  ctx.beginPath();
  ctx.roundRect(cx - bodyW / 2 - 8, bodyY + 8 - armSwing, 14, 34, 7);
  ctx.fill();
  // Back hand (robot white ball / mitten)
  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.arc(cx - bodyW / 2 - 1, bodyY + 44 - armSwing, 7, 0, Math.PI * 2);
  ctx.fill();

  // Front Arm
  ctx.fillStyle = "#8b5cf6";
  ctx.beginPath();
  ctx.roundRect(cx + bodyW / 2 - 6, bodyY + 8 + armSwing, 15, 34, 7);
  ctx.fill();
  // Front hand (robot white ball / mitten)
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(cx + bodyW / 2 + 1, bodyY + 44 + armSwing, 8, 0, Math.PI * 2);
  ctx.fill();

  // --- 5. OVERSIZED PURPLE HOOD AROUND HEAD ---
  const headY = bodyY - 36;
  const headSize = 58;

  // Outer Hood Back
  ctx.fillStyle = "#581c87";
  ctx.beginPath();
  ctx.arc(cx, headY + 12, 38, 0, Math.PI * 2);
  ctx.fill();

  // Hood Rim
  ctx.fillStyle = "#7e22ce";
  ctx.beginPath();
  ctx.ellipse(cx, headY + 10, 36, 38, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- 6. ROBOT HEAD (White Metallic Chrome Sphere) ---
  const headGrad = ctx.createRadialGradient(cx - 8, headY - 4, 4, cx, headY + 4, 30);
  headGrad.addColorStop(0, "#ffffff");
  headGrad.addColorStop(0.6, "#f1f5f9");
  headGrad.addColorStop(1, "#cbd5e1");

  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(cx, headY + 6, 28, 0, Math.PI * 2);
  ctx.fill();

  // Robot Ears / Side bolts
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(cx - 31, headY + 2, 5, 10);
  ctx.fillRect(cx + 26, headY + 2, 5, 10);
  ctx.fillStyle = "#06b6d4";
  ctx.fillRect(cx - 31, headY + 5, 3, 4);
  ctx.fillRect(cx + 28, headY + 5, 3, 4);

  // --- 7. ROBOT VISOR / SCREEN ---
  const visorW = 42;
  const visorH = 22;
  const visorY = headY + 1;

  // Glossy Dark Visor Screen
  ctx.fillStyle = "#090d16";
  ctx.beginPath();
  ctx.roundRect(cx - visorW / 2 + 3, visorY, visorW, visorH, 9);
  ctx.fill();

  // Screen Cyan Glow / Digital Happy Eyes (^ _ ^)
  ctx.save();
  ctx.shadowColor = "#22d3ee";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";

  // Left Eye (Cheerful Arc)
  ctx.beginPath();
  ctx.arc(cx - 10, visorY + 12, 4.5, Math.PI, 0, false);
  ctx.stroke();

  // Right Eye (Cheerful Arc)
  ctx.beginPath();
  ctx.arc(cx + 12, visorY + 12, 4.5, Math.PI, 0, false);
  ctx.stroke();

  // Screen Glass Specular Highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx - 6, visorY + 4, 12, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 8. ROBOT ANTENNA ---
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, headY - 22);
  ctx.lineTo(cx, headY - 32);
  ctx.stroke();

  // Glowing Cyan Antenna Tip
  ctx.save();
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#22d3ee";
  ctx.beginPath();
  ctx.arc(cx, headY - 34, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/**
 * Paints Colt Bot onto any canvas. If high-res cutout textures are ready,
 * uses them with subtle breathing / movement; otherwise seamlessly uses procedural renderer.
 */
export function paintColtBotCanvas(
  canvas: HTMLCanvasElement,
  facing: ColtFacing = "right",
  isMoving = false,
  time = 0
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cutout = facing === "left" ? (cutoutLeft || cutoutRight) : (cutoutRight || cutoutLeft);

  if (cutout && cutout.width > 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // If only cutoutRight exists and we need left, flip it
    const needFlip = facing === "left" && cutout === cutoutRight;
    if (needFlip) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    const pad = 8;
    const targetH = canvas.height - pad * 2;
    const ratio = targetH / cutout.height;
    const targetW = cutout.width * ratio;
    const drawX = (canvas.width - targetW) / 2;
    const drawY = canvas.height - targetH - pad;

    ctx.drawImage(cutout, drawX, drawY, targetW, targetH);
    ctx.restore();
  } else {
    drawColtBotProcedural(ctx, canvas.width, canvas.height, facing, isMoving, time);
  }
}

/**
 * Returns a static canvas texture for quick previews (e.g., in the map editor).
 */
export function getColtBotPreviewCanvas(facing: ColtFacing = "right"): HTMLCanvasElement {
  const key = `colt-bot-${facing}`;
  const existing = cachedTextures.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 200;
  paintColtBotCanvas(canvas, facing, false, 0);
  cachedTextures.set(key, canvas);
  return canvas;
}
