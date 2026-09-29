import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { supabase, cleanForFirestore } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PLAYER_W, PLAYER_H, cosmeticRect, sortLayers } from "@/lib/avatar-layout";
import { useLivePositions } from "@/hooks/use-live-positions";
import { trackQuestAction } from "@/lib/quest-events";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, query, where, onSnapshot } from "firebase/firestore";

// Pre-cached starter characters
const STARTER_CHARACTER_SPRITES: Record<string, { right: string; left: string | null; jump: string | null; idle: string }> = {
  "d14fed03-b2c5-4205-b2ff-a151345151ee": {
    right: "https://hgjnssvpydwdxbswozfp.supabase.co/storage/v1/object/sign/assets/characters/1790241340487-ckaoy2.png",
    left: null,
    jump: null,
    idle: "https://hgjnssvpydwdxbswozfp.supabase.co/storage/v1/object/sign/assets/characters/1790241168098-3udpgm.png",
  },
  "d7fc1b37-dae3-4bd0-bab1-3c21a4a51571": {
    right: "https://hgjnssvpydwdxbswozfp.supabase.co/storage/v1/object/sign/assets/characters/1790247232415-8xr2rk.png",
    left: null,
    jump: null,
    idle: "https://hgjnssvpydwdxbswozfp.supabase.co/storage/v1/object/sign/assets/characters/1790245088277-toz4do.png",
  },
  "44ca85cf-9e82-47e5-9ce5-06abde1ec0d1": {
    right: "https://hgjnssvpydwdxbswozfp.supabase.co/storage/v1/object/sign/assets/characters/1790244597162-oi7k6a.png",
    left: null,
    jump: null,
    idle: "https://hgjnssvpydwdxbswozfp.supabase.co/storage/v1/object/sign/assets/characters/1790243842980-2zbn8o.png",
  },
};

export type MapObject = {
  id: string;
  object_type: string;
  reference_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
  collision: boolean;
  interactive: boolean;
  metadata: Record<string, unknown> & {
    color?: string;
    sprite_url?: string;
    label?: string;
    target_map_id?: string;
  };
};

type StoreRef = { id: string; slug: string; name: string; store_type: string; image_url?: string | null };
type NpcRef = {
  id: string;
  slug: string;
  name: string;
  sprite_url?: string | null;
  sprite_left_url?: string | null;
  sprite_right_url?: string | null;
  sprite_jump_url?: string | null;
};

type Nearby =
  | { kind: "store"; id: string; name: string }
  | { kind: "npc"; id: string; name: string }
  | { kind: "door"; id: string; name: string; targetMapId?: string }
  | { kind: "treasure"; id: string; name: string }
  | null;

type Props = {
  width: number;
  height: number;
  viewportWidth?: number;
  viewportHeight?: number;
  mapId: string | null;
  objects: MapObject[];
  stores: StoreRef[];
  npcs: NpcRef[];
  isPublicRoom?: boolean;
  backgroundColor?: string | null;
  touchInputRef?: MutableRefObject<{ x: number; jump: boolean }>;
  onInteract?: (kind: "store" | "npc" | "door" | "treasure", id: string, extra?: { targetMapId?: string }) => void;
  onNearby?: (n: Nearby) => void;
  onInspectPlayer?: (player: OtherPlayer) => void;
};


type OtherPlayer = {
  user_id: string; x: number; y: number; username?: string; last_seen: string;
  avatar_config?: Record<string, string> | null;
  character_id?: string | null;
};

type EquippedCosmetic = {
  id: string; layer_type: string;
  sprite_left_url: string | null; sprite_right_url: string | null;
  offset_x: number; offset_y: number; scale: number; layer_order: number;
};

type Look = { idle: string | null; right: string | null; left: string | null; cosmetics: EquippedCosmetic[] };

const GRAVITY = 0.55;
const JUMP = 13.5;
const SPEED = 4;

// Simple sprite cache
const IMG_CACHE = new Map<string, HTMLImageElement>();
function getImg(url?: string | null) {
  if (!url) return null;
  const cached = IMG_CACHE.get(url);
  if (cached) return cached;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  IMG_CACHE.set(url, img);
  return img;
}

// Immediately warm up starter sprite images in cache
if (typeof window !== "undefined") {
  Object.values(STARTER_CHARACTER_SPRITES).forEach((s) => {
    if (s.right) getImg(s.right);
    if (s.idle) getImg(s.idle);
    if (s.left) getImg(s.left);
    if (s.jump) getImg(s.jump);
  });
}

export function GameViewport({
  width,
  height,
  viewportWidth = 1024,
  viewportHeight = 560,
  mapId,
  objects,
  stores,
  npcs,
  isPublicRoom = false,
  backgroundColor,
  touchInputRef,
  onInteract,
  onNearby,
  onInspectPlayer,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user, profile } = useAuth();
  const live = useLivePositions(mapId, !!isPublicRoom, user?.id);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [message, setMessage] = useState<string | null>(null);
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const othersRef = useRef<OtherPlayer[]>([]);
  othersRef.current = others;
  const [equipped, setEquipped] = useState<EquippedCosmetic[]>([]);

  const initialCid = (profile as unknown as { character_id?: string | null } | null)?.character_id || "d14fed03-b2c5-4205-b2ff-a151345151ee";
  const initialStarter = STARTER_CHARACTER_SPRITES[initialCid] || STARTER_CHARACTER_SPRITES["d14fed03-b2c5-4205-b2ff-a151345151ee"];
  const [characterSprites, setCharacterSprites] = useState<{ right: string | null; left: string | null; jump: string | null; idle: string | null }>(() => ({
    right: initialStarter?.right ?? null,
    left: initialStarter?.left ?? null,
    jump: initialStarter?.jump ?? null,
    idle: initialStarter?.idle ?? null,
  }));
  const [otherLooks, setOtherLooks] = useState<Record<string, Look>>({});
  const otherLooksRef = useRef<Record<string, Look>>({});
  otherLooksRef.current = otherLooks;


  const nearbyRef = useRef<string | null>(null);
  const bubblesRef = useRef<Map<string, { text: string; until: number }>>(new Map());
  const mapLoadedRef = useRef<string | null>(null);
  const stateRef = useRef({
    x: 100, y: 100, vx: 0, vy: 0, onGround: false, facing: 1 as 1 | -1,
    keys: {} as Record<string, boolean>,
    jumpConsumed: false,
    camX: 0, camY: 0,
    npcPositions: new Map<string, { x: number; y: number; dir: number; base: number }>(),
    lastSave: 0,
  });

  useEffect(() => {
    const s = stateRef.current;
    s.npcPositions.clear();

    for (const o of objects) {
      if (o.object_type === "npc") s.npcPositions.set(o.id, { x: o.x, y: o.y, dir: 1, base: o.x });
    }

    // Only reset character coordinates on first load or when switching to a different map
    if (mapLoadedRef.current !== mapId) {
      mapLoadedRef.current = mapId;
      const spawn = objects.find((o) => o.object_type === "spawn");
      s.x = spawn?.x ?? 100;
      s.y = spawn?.y ?? 100;
      s.vx = 0;
      s.vy = 0;
      s.camX = 0;
      s.camY = 0;
      s.onGround = false;
      s.jumpConsumed = false;
      nearbyRef.current = null;
      onNearby?.(null);

      const savedMapId = profile?.current_map_id;
      const hasSavedPositionForThisMap = !!mapId && savedMapId === mapId;
      if (profile && hasSavedPositionForThisMap) {
        s.x = profile.last_x || s.x;
        s.y = profile.last_y || s.y;
      }
    }
  }, [objects, mapId, onNearby]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { stateRef.current.keys[e.key.toLowerCase()] = true; };
    const ku = (e: KeyboardEvent) => { stateRef.current.keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const platforms = objects.filter((o) => o.collision && (o.object_type === "platform" || o.object_type === "wall"));
    const decor = objects.filter((o) => o.object_type === "decor");
    const screens = objects.filter((o) => o.object_type === "screen");
    const doors = objects.filter((o) => o.object_type === "door");
    const storesOnMap = objects.filter((o) => o.object_type === "store");
    const npcsOnMap = objects.filter((o) => o.object_type === "npc");
    const treasuresOnMap = objects.filter((o) => o.object_type === "treasure" && o.reference_id);


    const FLOOR_STYLE_MAP: Record<string, { color: string; top: string }> = {
      grass:  { color: "#8b5a3c", top: "#7dd3a0" },
      stone:  { color: "#6b7280", top: "#9ca3af" },
      wood:   { color: "#a16207", top: "#d97706" },
      sand:   { color: "#e9c46a", top: "#f4d47a" },
      brick:  { color: "#b91c1c", top: "#ef4444" },
      neon:   { color: "#7c3aed", top: "#c4b5fd" },
      ice:    { color: "#38bdf8", top: "#bae6fd" },
      lava:   { color: "#dc2626", top: "#fb923c" },
      candy:  { color: "#f472b6", top: "#fbcfe8" },
    };
    const drawDecorPreset = (preset: string, x: number, y: number, w: number, h: number) => {
      ctx.save();
      const cx = x + w / 2, cy = y + h / 2;
      switch (preset) {
        case "tree":
          ctx.fillStyle = "#7c3f22"; ctx.fillRect(cx - w * 0.08, y + h * 0.55, w * 0.16, h * 0.45);
          ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(cx, y + h * 0.4, w * 0.42, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(cx - w * 0.2, y + h * 0.5, w * 0.28, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + w * 0.2, y + h * 0.5, w * 0.28, 0, Math.PI * 2); ctx.fill(); break;
        case "flower":
          ctx.fillStyle = "#4ade80"; ctx.fillRect(cx - 2, y + h * 0.5, 4, h * 0.5);
          for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.fillStyle = "#f472b6"; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * w * 0.22, y + h * 0.35 + Math.sin(a) * w * 0.22, w * 0.18, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(cx, y + h * 0.35, w * 0.12, 0, Math.PI * 2); ctx.fill(); break;
        case "bush":
          ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(cx - w * 0.25, cy + h * 0.15, w * 0.28, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + w * 0.25, cy + h * 0.15, w * 0.28, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx, cy, w * 0.32, 0, Math.PI * 2); ctx.fill(); break;
        case "cloud":
          ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx - w * 0.2, cy, w * 0.25, 0, Math.PI * 2); ctx.arc(cx, cy - h * 0.1, w * 0.3, 0, Math.PI * 2); ctx.arc(cx + w * 0.22, cy, w * 0.25, 0, Math.PI * 2); ctx.fill(); break;
        case "balloon":
          ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.ellipse(cx, y + h * 0.35, w * 0.35, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, y + h * 0.75); ctx.lineTo(cx, y + h); ctx.stroke(); break;
        case "star":
          ctx.fillStyle = "#fde047"; ctx.beginPath();
          for (let i = 0; i < 10; i++) { const r = i % 2 ? w * 0.2 : w * 0.42; const a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
          ctx.closePath(); ctx.fill(); break;
        case "crystal":
          ctx.fillStyle = "#a78bfa"; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#5b21b6"; ctx.stroke(); break;
        case "heart":
          ctx.fillStyle = "#ec4899"; ctx.beginPath();
          ctx.moveTo(cx, y + h * 0.85);
          ctx.bezierCurveTo(x, y + h * 0.5, x, y, cx, y + h * 0.3);
          ctx.bezierCurveTo(x + w, y, x + w, y + h * 0.5, cx, y + h * 0.85);
          ctx.fill(); break;
        case "banner":
          ctx.fillStyle = "#f472b6"; ctx.fillRect(x, y, w, h * 0.6);
          ctx.beginPath(); ctx.moveTo(x, y + h * 0.6); ctx.lineTo(x + w * 0.5, y + h); ctx.lineTo(x + w, y + h * 0.6); ctx.closePath(); ctx.fill(); break;
        case "lamp":
          ctx.fillStyle = "#334155"; ctx.fillRect(cx - 2, y + h * 0.4, 4, h * 0.6);
          ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(cx, y + h * 0.3, w * 0.28, 0, Math.PI * 2); ctx.fill(); break;
        default:
          ctx.fillStyle = "#fbcfe8"; roundRect(ctx, x, y, w, h, 12); ctx.fill();
      }
      ctx.restore();
    };

    const step = () => {
      const s = stateRef.current;
      const tin = touchInputRef?.current;
      const left = s.keys["arrowleft"] || s.keys["a"] || (tin && tin.x < -0.2);
      const right = s.keys["arrowright"] || s.keys["d"] || (tin && tin.x > 0.2);
      const jumpKey = !!(s.keys["arrowup"] || s.keys["w"] || s.keys[" "] || (tin && tin.jump));
      s.vx = left ? -SPEED : right ? SPEED : 0;
      if (s.vx < 0) s.facing = -1; else if (s.vx > 0) s.facing = 1;

      // Single crisp jump impulse per press/tap
      if (jumpKey && !s.jumpConsumed && s.onGround) {
        s.vy = -JUMP;
        s.onGround = false;
        s.jumpConsumed = true;
      } else if (!jumpKey) {
        s.jumpConsumed = false;
      }

      s.vy += GRAVITY;
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < 0) s.x = 0;
      if (s.x > width - PLAYER_W) s.x = width - PLAYER_W;

      s.onGround = false;
      // Precision collision: only check landing when character is falling downwards (vy >= 0)
      if (s.vy >= 0) {
        for (const p of platforms) {
          if (s.x + PLAYER_W * 0.75 > p.x && s.x + PLAYER_W * 0.25 < p.x + p.width) {
            const feet = s.y + PLAYER_H;
            const prevFeet = feet - s.vy;
            if (prevFeet <= p.y + 4 && feet >= p.y) {
              s.y = p.y - PLAYER_H;
              s.vy = 0;
              s.onGround = true;
              break;
            }
          }
        }
      }

      // Safeguard floor boundary so character never clips into the void
      if (s.y > height - PLAYER_H) {
        s.y = height - PLAYER_H;
        s.vy = 0;
        s.onGround = true;
      }


      for (const npc of npcsOnMap) {
        const np = s.npcPositions.get(npc.id);
        if (!np) continue;
        np.x += np.dir * 0.5;
        if (Math.abs(np.x - np.base) > 100) np.dir *= -1;
      }

      // Nearby detection — stores > doors > npcs
      let near: Nearby = null;
      for (const st of storesOnMap) {
        if (Math.abs(s.x - st.x) < 120 && Math.abs(s.y - st.y) < 140 && st.reference_id) {
          const sref = stores.find((x) => x.id === st.reference_id);
          near = { kind: "store", id: st.reference_id, name: sref?.name ?? "Store" };
          break;
        }
      }
      if (!near) for (const tb of treasuresOnMap) {
        if (Math.abs(s.x - (tb.x + tb.width / 2)) < 110 && Math.abs(s.y - tb.y) < 130) {
          near = { kind: "treasure", id: tb.reference_id!, name: (tb.metadata?.label as string) || "תיבת אוצר" };
          break;
        }
      }
      if (!near) for (const d of doors) {

        if (Math.abs(s.x - d.x) < 90 && Math.abs(s.y - d.y) < 120) {
          near = {
            kind: "door",
            id: d.id,
            name: (d.metadata?.label as string) || "דלת",
            targetMapId: d.metadata?.target_map_id as string | undefined,
          };
          break;
        }
      }
      if (!near) for (const npc of npcsOnMap) {
        const np = s.npcPositions.get(npc.id) ?? { x: npc.x, y: npc.y };
        if (Math.abs(s.x - np.x) < 90 && Math.abs(s.y - np.y) < 100 && npc.reference_id) {
          const nref = npcs.find((x) => x.id === npc.reference_id);
          near = { kind: "npc", id: npc.reference_id, name: nref?.name ?? "NPC" };
          break;
        }
      }
      const nearKey = near ? `${near.kind}:${near.id}` : null;
      if (nearKey !== nearbyRef.current) {
        nearbyRef.current = nearKey;
        onNearby?.(near);
      }




      s.camX = Math.max(0, Math.min(width - viewportWidth, s.x - viewportWidth / 2));
      s.camY = Math.max(0, Math.min(height - viewportHeight, s.y - viewportHeight / 2));

      const t = performance.now();
      // High-frequency realtime broadcast (~16/sec) so others see smooth motion
      liveRef.current.send(s.x, s.y, s.facing === -1 ? "left" : "right", s.vx !== 0 || !s.onGround);
      
      // Realtime multiplayer sync to Firestore: immediate on start, throttled to 250ms when moving, 2500ms when stationary
      if (user && mapId) {
        const isMoving = s.vx !== 0 || !s.onGround;
        const interval = isMoving ? 250 : 2500;
        if (s.lastSave === 0 || t - s.lastSave > interval) {
          s.lastSave = t;
          const currentUsername = profile?.display_name || profile?.username || user?.user_metadata?.username || "Player";
          const posData = {
            id: user.id,
            user_id: user.id,
            username: currentUsername,
            avatar_config: profile?.avatar_config || null,
            character_id: profile?.character_id || null,
            map_id: mapId,
            x: Math.round(s.x),
            y: Math.round(s.y),
            facing: s.facing === -1 ? "left" : "right",
            moving: isMoving,
            last_seen: new Date().toISOString(),
          };
          setDoc(doc(db, "active_players", user.id), cleanForFirestore(posData), { merge: true }).catch(() => {});
          supabase.from("profiles").update({ last_x: s.x, last_y: s.y, current_map_id: mapId }).eq("id", user.id).then(() => {});
        }
      }

      // Draw
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);
      // Sky
      const g = ctx.createLinearGradient(0, 0, 0, viewportHeight);
      if (backgroundColor) {
        g.addColorStop(0, backgroundColor); g.addColorStop(1, shade(backgroundColor, -14));
      } else {
        g.addColorStop(0, "#ffd1ec"); g.addColorStop(0.55, "#c6e9ff"); g.addColorStop(1, "#fff2c2");
      }

      ctx.fillStyle = g; ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      // Distant hills
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 5; i++) {
        const hx = ((i * 480 - s.camX * 0.25) % (width + 480));
        ctx.beginPath();
        ctx.ellipse(hx, viewportHeight - 90, 260, 90, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Clouds
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 360 - s.camX * 0.4) % (width + 360));
        ctx.beginPath(); ctx.arc(cx, 70 + (i % 2) * 40, 34, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 28, 82 + (i % 2) * 40, 24, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.translate(-s.camX, -s.camY);
      // Decor (background layer)
      for (const d of decor) {
        const img = getImg(d.metadata?.sprite_url);
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, d.x, d.y, d.width, d.height);
        } else {
          const preset = (d.metadata?.preset as string) || "";
          if (preset) drawDecorPreset(preset, d.x, d.y, d.width, d.height);
          else { ctx.fillStyle = (d.metadata?.color as string) || "#f5c6ea"; roundRect(ctx, d.x, d.y, d.width, d.height, 12); ctx.fill(); }
        }
      }
      // Screens (background info panels)
      for (const sc of screens) {
        const bg = (sc.metadata?.bg as string) || "#1e1b4b";
        const fg = (sc.metadata?.fg as string) || "#fde68a";
        // frame
        ctx.fillStyle = "#111827"; roundRect(ctx, sc.x - 6, sc.y - 6, sc.width + 12, sc.height + 12, 12); ctx.fill();
        ctx.fillStyle = bg; roundRect(ctx, sc.x, sc.y, sc.width, sc.height, 8); ctx.fill();
        const contentType = (sc.metadata?.content_type as string) || "text";
        if (contentType === "image") {
          const scImg = getImg(sc.metadata?.image_url as string | undefined);
          if (scImg && scImg.complete && scImg.naturalWidth) {
            ctx.save(); ctx.beginPath(); roundRect(ctx, sc.x, sc.y, sc.width, sc.height, 8); ctx.clip();
            ctx.drawImage(scImg, sc.x, sc.y, sc.width, sc.height); ctx.restore();
          }
        } else {
          const text = (sc.metadata?.text as string) || "";
          ctx.fillStyle = fg; ctx.textAlign = "center";
          const fontSize = Math.max(14, Math.min(32, sc.height / 5));
          ctx.font = `bold ${fontSize}px Fredoka, system-ui`;
          const lines = text.split("\n");
          const lineH = fontSize * 1.2;
          const startY = sc.y + sc.height / 2 - ((lines.length - 1) * lineH) / 2 + fontSize / 3;
          for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], sc.x + sc.width / 2, startY + i * lineH);
        }
        // subtle scan-line
        ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
        for (let sy = sc.y + 4; sy < sc.y + sc.height; sy += 4) { ctx.beginPath(); ctx.moveTo(sc.x, sy); ctx.lineTo(sc.x + sc.width, sy); ctx.stroke(); }
      }
      // Platforms
      for (const p of platforms) {
        const styleKey = (p.metadata?.style as string) || "";
        const style = FLOOR_STYLE_MAP[styleKey];
        const col = style?.color || (p.metadata?.color as string) || "#b39ddb";
        const topCol = style?.top || "#7dd3a0";
        const grd = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
        grd.addColorStop(0, col); grd.addColorStop(1, shade(col, -12));
        ctx.fillStyle = grd;
        roundRect(ctx, p.x, p.y, p.width, p.height, 10); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 2; ctx.stroke();
        // top strip
        ctx.fillStyle = topCol;
        roundRect(ctx, p.x, p.y - 3, p.width, 8, 4); ctx.fill();
      }
      // Doors
      for (const d of doors) {
        ctx.fillStyle = "#8b5a3c";
        roundRect(ctx, d.x, d.y, d.width || 48, d.height || 72, 6); ctx.fill();
        ctx.fillStyle = "#c99c6c";
        roundRect(ctx, d.x + 4, d.y + 4, (d.width || 48) - 8, (d.height || 72) - 8, 4); ctx.fill();
        ctx.fillStyle = "#f7c948";
        ctx.beginPath(); ctx.arc(d.x + (d.width || 48) - 10, d.y + (d.height || 72) / 2, 3, 0, Math.PI * 2); ctx.fill();
        if (d.metadata?.label) {
          ctx.fillStyle = "#3b1f4a"; ctx.font = "bold 12px Fredoka, system-ui"; ctx.textAlign = "center";
          ctx.fillText(d.metadata.label as string, d.x + (d.width || 48) / 2, d.y - 6);
        }
      }
      // Treasure boxes
      for (const tb of treasuresOnMap) {
        const w = tb.width || 72;
        const h = tb.height || 60;
        const img = getImg(tb.metadata?.sprite_url as string | undefined);
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, tb.x, tb.y, w, h);
        } else {
          ctx.fillStyle = "#b45309";
          roundRect(ctx, tb.x, tb.y + h * 0.3, w, h * 0.7, 8); ctx.fill();
          ctx.fillStyle = "#f59e0b";
          roundRect(ctx, tb.x, tb.y, w, h * 0.38, 8); ctx.fill();
          ctx.fillStyle = "#fde68a";
          ctx.fillRect(tb.x + w / 2 - 6, tb.y + h * 0.28, 12, h * 0.28);
        }
        ctx.fillStyle = "#4b1d5f"; ctx.font = "bold 14px Fredoka, system-ui"; ctx.textAlign = "center";
        ctx.fillText((tb.metadata?.label as string) || "תיבת אוצר", tb.x + w / 2, tb.y - 6);
      }
      // Stores

      for (const st of storesOnMap) {
        const sref = stores.find((x) => x.id === st.reference_id);
        const img = getImg(sref?.image_url || (st.metadata?.sprite_url as string | undefined));
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, st.x, st.y, st.width, st.height);
        } else {
          // Cute storefront
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, st.x, st.y + 28, st.width, st.height - 28, 14); ctx.fill();
          ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 4; ctx.stroke();
          // Awning stripes
          const stripes = Math.max(3, Math.floor(st.width / 28));
          for (let i = 0; i < stripes; i++) {
            ctx.fillStyle = i % 2 ? "#ec4899" : "#fbcfe8";
            ctx.beginPath();
            ctx.moveTo(st.x + (i * st.width) / stripes, st.y);
            ctx.lineTo(st.x + ((i + 1) * st.width) / stripes, st.y);
            ctx.lineTo(st.x + ((i + 1) * st.width) / stripes - 8, st.y + 34);
            ctx.lineTo(st.x + (i * st.width) / stripes - 8, st.y + 34);
            ctx.closePath(); ctx.fill();
          }
          // Door
          ctx.fillStyle = "#a78bfa";
          roundRect(ctx, st.x + st.width / 2 - 22, st.y + st.height - 60, 44, 60, 6); ctx.fill();
        }
        ctx.fillStyle = "#4b1d5f"; ctx.font = "bold 20px Fredoka, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(sref?.name ?? "חנות", st.x + st.width / 2, st.y - 8);
      }
      // NPCs (sprite-aware)
      for (const n of npcsOnMap) {
        const nref = npcs.find((x) => x.id === n.reference_id);
        const np = s.npcPositions.get(n.id) ?? { x: n.x, y: n.y, dir: 1, base: n.x };
        const direction: "left" | "right" = np.dir < 0 ? "left" : "right";
        const url = pickSprite(nref, direction, false) || (n.metadata?.sprite_url as string | undefined);
        const img = getImg(url);
        if (img && img.complete && img.naturalWidth) {
          if (!url?.includes("_left") && direction === "left" && !nref?.sprite_left_url) {
            ctx.save();
            ctx.translate(np.x + n.width, np.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, n.width, n.height);
            ctx.restore();
          } else {
            ctx.drawImage(img, np.x, np.y, n.width, n.height);
          }
        } else {
          drawCharacter(ctx, np.x, np.y, n.width, n.height, "#a78bfa", direction);
        }
        ctx.fillStyle = "#3b1f4a"; ctx.font = "bold 12px Fredoka, system-ui";
        ctx.textAlign = "center"; ctx.fillText(nref?.name ?? "NPC", np.x + n.width / 2, np.y - 6);
      }
      // Other players (multiplayer) — same sprites + cosmetics as the local player
      for (const op of othersRef.current) {
        if (op.user_id === user?.id) continue;
        const look = otherLooksRef.current[op.user_id];
        const lp = liveRef.current.sample(op.user_id);
        const ox = lp?.x ?? op.x;
        const oy = lp?.y ?? op.y;
        const oFacing = lp?.facing ?? "right";
        const sprite = oFacing === "left"
          ? (look?.left ?? look?.idle ?? look?.right ?? null)
          : (look?.right ?? look?.idle ?? null);
        drawAvatar(ctx, ox, oy, sprite, look?.cosmetics ?? [], oFacing, "#60a5fa", oFacing === "left" && !look?.left, lp?.moving ?? false);
        ctx.fillStyle = "#1e3a8a"; ctx.font = "bold 11px Fredoka, system-ui"; ctx.textAlign = "center";
        ctx.fillText(op.username ?? "player", ox + PLAYER_W / 2, oy - 6);
        const b = bubblesRef.current.get(op.user_id);
        if (b && b.until > performance.now()) drawBubble(ctx, ox + PLAYER_W / 2, oy - 20, b.text);
      }
      // Player
      const jumping = !s.onGround;
      const facing: "left" | "right" = s.facing === -1 ? "left" : "right";
      let spriteUrl: string | null = null;
      let flip = false;
      if (characterSprites) {
        const moving = s.vx !== 0;
        const wantJump = jumping && characterSprites.jump;
        spriteUrl = wantJump
          ? characterSprites.jump
          : !moving
            ? (characterSprites.idle ?? (facing === "right" ? characterSprites.right : (characterSprites.left ?? characterSprites.right)))
            : facing === "right"
              ? characterSprites.right
              : (characterSprites.left ?? characterSprites.right);
        flip = facing === "left" && !characterSprites.left && !wantJump;
      }
      drawAvatar(ctx, s.x, s.y, spriteUrl, equipped, facing, "#ec4899", flip, jumping);
      ctx.fillStyle = "#3b1f4a"; ctx.font = "bold 11px Fredoka, system-ui"; ctx.textAlign = "center";
      ctx.fillText(profile?.username ?? "you", s.x + PLAYER_W / 2, s.y - 6);
      if (user) {
        const mb = bubblesRef.current.get(user.id);
        if (mb && mb.until > performance.now()) drawBubble(ctx, s.x + PLAYER_W / 2, s.y - 20, mb.text);
      }
      ctx.restore();

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [width, height, viewportWidth, viewportHeight, objects, stores, npcs, user, mapId, onInteract, onNearby, profile?.username, equipped, characterSprites, backgroundColor, touchInputRef]);

  // Load selected base character sprites from profile.character_id
  useEffect(() => {
    const cid = (profile as unknown as { character_id?: string | null } | null)?.character_id || "d14fed03-b2c5-4205-b2ff-a151345151ee";
    const cached = STARTER_CHARACTER_SPRITES[cid];
    if (cached) {
      setCharacterSprites({
        right: cached.right,
        left: cached.left,
        jump: cached.jump,
        idle: cached.idle,
      });
      getImg(cached.right);
      getImg(cached.idle);
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("characters")
        .select("sprite_right_url, sprite_left_url, sprite_jump_url, image_url")
        .eq("id", cid).maybeSingle();
      if (cancelled || !data) return;
      const d = data as { sprite_right_url: string | null; sprite_left_url: string | null; sprite_jump_url: string | null; image_url: string | null };
      const right = d.sprite_right_url ?? d.image_url;
      const idle = d.image_url ?? d.sprite_right_url;
      if (right) getImg(right);
      if (idle) getImg(idle);
      if (d.sprite_left_url) getImg(d.sprite_left_url);
      if (d.sprite_jump_url) getImg(d.sprite_jump_url);
      setCharacterSprites({
        right,
        left: d.sprite_left_url,
        jump: d.sprite_jump_url,
        idle,
      });
    })();
    return () => { cancelled = true; };
  }, [profile]);




  // Load equipped cosmetic sprites from profile.avatar_config
  useEffect(() => {
    const conf = (profile?.avatar_config ?? {}) as Record<string, string>;
    const ids = Object.values(conf).filter(Boolean);
    if (!ids.length) { setEquipped([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("cosmetics")
        .select("id, layer_type, layer_order, sprite_left_url, sprite_right_url, offset_x, offset_y, scale")
        .in("id", ids);
      if (cancelled || !data) return;
      setEquipped((data as unknown as Array<{ id: string; layer_type: string; sprite_left_url: string | null; sprite_right_url: string | null; offset_x: number | null; offset_y: number | null; scale: number | null; layer_order: number | null }>).map((c) => ({
        id: c.id, layer_type: c.layer_type,
        sprite_left_url: c.sprite_left_url, sprite_right_url: c.sprite_right_url,
        offset_x: c.offset_x ?? 0, offset_y: c.offset_y ?? 0, scale: c.scale ?? 1,
        layer_order: c.layer_order ?? 0,
      })).sort((a, b) => a.layer_order - b.layer_order));
    })();
    return () => { cancelled = true; };
  }, [profile?.avatar_config]);

  // Multiplayer presence: real-time Firestore onSnapshot for this map
  useEffect(() => {
    if (!mapId) {
      othersRef.current = [];
      setOthers([]);
      return;
    }
    let cancelled = false;

    let unsubSnapshot: (() => void) | null = null;
    try {
      const q = query(collection(db, "active_players"), where("map_id", "==", mapId));
      unsubSnapshot = onSnapshot(q, (snapshot) => {
        if (cancelled) return;
        const now = Date.now();
        // 3-minute cutoff to tolerate clock skew and stationary players
        const cutoff = now - 180 * 1000;
        const remotePlayers: OtherPlayer[] = [];

        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const uid = (d.user_id || docSnap.id) as string;
          if (!uid || uid === user?.id) return;
          const seenTime = new Date(d.last_seen || 0).getTime();
          if (d.last_seen && seenTime < cutoff) return;

          const px = typeof d.x === "number" ? d.x : 100;
          const py = typeof d.y === "number" ? d.y : 100;
          const facing = d.facing === "left" ? "left" : "right";
          const moving = Boolean(d.moving);

          // Feed position directly into smooth interpolator
          liveRef.current.feed(uid, px, py, facing, moving);

          remotePlayers.push({
            user_id: uid,
            x: px,
            y: py,
            last_seen: d.last_seen || new Date().toISOString(),
            username: (d.username as string) || "Player",
            avatar_config: (d.avatar_config as Record<string, string>) || null,
            character_id: (d.character_id as string) || null,
          });
        });

        othersRef.current = remotePlayers;
        setOthers(remotePlayers);
      }, (err) => {
        console.warn("Firestore presence onSnapshot error:", err);
      });
    } catch (e) {
      console.warn("Error setting up active_players onSnapshot:", e);
    }

    const cleanupSelf = () => {
      if (user?.id) {
        deleteDoc(doc(db, "active_players", user.id)).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", cleanupSelf);

    return () => {
      cancelled = true;
      if (unsubSnapshot) unsubSnapshot();
      window.removeEventListener("beforeunload", cleanupSelf);
      cleanupSelf();
    };
  }, [mapId, user?.id]);

  // Resolve other players' base character sprites + equipped cosmetics
  const othersLookKey = others.map((o) => `${o.user_id}:${o.character_id ?? ""}:${Object.values(o.avatar_config ?? {}).join(",")}`).join("|");
  useEffect(() => {
    if (!others.length) {
      otherLooksRef.current = {};
      setOtherLooks({});
      return;
    }
    let cancelled = false;
    (async () => {
      const charIds = Array.from(new Set(others.map((o) => o.character_id).filter(Boolean))) as string[];
      const cosIds = Array.from(new Set(others.flatMap((o) => Object.values(o.avatar_config ?? {}).filter(Boolean))));
      const [chars, cos] = await Promise.all([
        charIds.length
          ? supabase.from("characters").select("id, image_url, sprite_right_url, sprite_left_url").in("id", charIds)
          : Promise.resolve({ data: [] as unknown[] }),
        cosIds.length
          ? supabase.from("cosmetics").select("id, layer_type, layer_order, sprite_left_url, sprite_right_url, offset_x, offset_y, scale").in("id", cosIds)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);
      if (cancelled) return;
      const charMap = new Map((((chars.data ?? []) as Array<{ id: string; image_url: string | null; sprite_right_url: string | null; sprite_left_url: string | null }>)).map((c) => [c.id, c]));
      const cosMap = new Map((((cos.data ?? []) as Array<{ id: string; layer_type: string; layer_order: number | null; sprite_left_url: string | null; sprite_right_url: string | null; offset_x: number | null; offset_y: number | null; scale: number | null }>)).map((c) => [c.id, c]));
      const next: Record<string, Look> = {};
      for (const o of others) {
        const ch = o.character_id ? charMap.get(o.character_id) : undefined;
        next[o.user_id] = {
          idle: ch?.image_url ?? ch?.sprite_right_url ?? null,
          right: ch?.sprite_right_url ?? null,
          left: ch?.sprite_left_url ?? null,
          cosmetics: Object.values(o.avatar_config ?? {})
            .map((id) => cosMap.get(id))
            .filter(Boolean)
            .map((c) => ({
              id: c!.id, layer_type: c!.layer_type,
              sprite_left_url: c!.sprite_left_url, sprite_right_url: c!.sprite_right_url,
              offset_x: c!.offset_x ?? 0, offset_y: c!.offset_y ?? 0,
              scale: c!.scale ?? 1, layer_order: c!.layer_order ?? 0,
            })),
        };
      }
      otherLooksRef.current = next;
      setOtherLooks(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [othersLookKey]);

  // NPC random speech
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const npcOnMap = objects.filter((o) => o.object_type === "npc" && o.reference_id);
      if (npcOnMap.length) {
        const pick = npcOnMap[Math.floor(Math.random() * npcOnMap.length)];
        const { data } = await supabase.from("npc_messages").select("message").eq("npc_id", pick.reference_id!).eq("enabled", true).eq("auto_speech", true).limit(20);
        if (data && data.length && !cancelled) {
          const msg = data[Math.floor(Math.random() * data.length)].message as string;
          const nref = npcs.find((x) => x.id === pick.reference_id);
          setMessage(`${nref?.name ?? "NPC"}: ${msg}`);
          setTimeout(() => setMessage(null), 4000);
        }
      }
      setTimeout(tick, 15000 + Math.random() * 30000);
    };
    const to = setTimeout(tick, 3000);
    return () => { cancelled = true; clearTimeout(to); };
  }, [objects, npcs]);

  // Global chat → floating bubbles above players
  useEffect(() => {
    const handleCustomBubble = (e: any) => {
      const d = e.detail;
      if (d?.userId && d?.message) {
        bubblesRef.current.set(d.userId, { text: d.message.slice(0, 120), until: performance.now() + 5000 });
      }
    };
    window.addEventListener("colt-chat-bubble", handleCustomBubble);

    const channel = supabase
      .channel(`chat-bubbles-${mapId ?? "any"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "channel=eq.global" },
        (payload) => {
          const m = payload.new as { user_id: string; message: string };
          const text = (m.message ?? "").slice(0, 120);
          bubblesRef.current.set(m.user_id, { text, until: performance.now() + 5000 });
        },
      )
      .subscribe();
    return () => {
      window.removeEventListener("colt-chat-bubble", handleCustomBubble);
      supabase.removeChannel(channel);
    };
  }, [mapId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const s = stateRef.current;
    const wx = sx + s.camX;
    const wy = sy + s.camY;

    // 1. Check if clicked on another player in the world to inspect their profile and album
    if (onInspectPlayer) {
      for (const op of othersRef.current) {
        const lp = liveRef.current.sample(op.user_id);
        const px = lp?.x ?? op.x;
        const py = lp?.y ?? op.y;
        if (wx >= px - 20 && wx <= px + PLAYER_W + 20 && wy >= py - 25 && wy <= py + PLAYER_H + 20) {
          onInspectPlayer(op);
          return;
        }
      }
    }

    if (!onInteract) return;
    for (const o of objects) {
      const hit = wx >= o.x && wx <= o.x + o.width && wy >= o.y && wy <= o.y + o.height;
      if (!hit || !o.reference_id) continue;
      if (o.object_type === "store") { onInteract("store", o.reference_id); return; }
      if (o.object_type === "treasure") { onInteract("treasure", o.reference_id); return; }
    }
  };

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={viewportWidth}
        height={viewportHeight}
        onClick={handleCanvasClick}
        className="block w-full cursor-pointer rounded-3xl border-4 border-white shadow-[0_18px_60px_-20px_rgba(236,72,153,0.55)]"
        style={{ aspectRatio: `${viewportWidth} / ${viewportHeight}` }}
      />

      {message && (
        <div className="absolute inset-x-0 top-4 mx-auto w-fit chrome-panel px-4 py-2 text-sm shadow-xl">
          💬 {message}
        </div>
      )}
    </div>
  );
}

function pickSprite(n: NpcRef | undefined, dir: "left" | "right", jumping: boolean): string | null {
  if (!n) return null;
  if (jumping && n.sprite_jump_url) return n.sprite_jump_url;
  if (dir === "left" && n.sprite_left_url) return n.sprite_left_url;
  if (dir === "right" && n.sprite_right_url) return n.sprite_right_url;
  return n.sprite_url ?? null;
}

/** Draws base sprite + cosmetics, anchored per layer type (background behind, hat on head, etc.). */
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  spriteUrl: string | null,
  cosmetics: EquippedCosmetic[],
  facing: "left" | "right",
  fallbackColor: string,
  flip = false,
  jumping = false,
) {
  const box = { x, y, w: PLAYER_W, h: PLAYER_H };
  const ordered = sortLayers(cosmetics);

  const drawPiece = (c: EquippedCosmetic) => {
    const url = facing === "right" ? c.sprite_right_url : (c.sprite_left_url ?? c.sprite_right_url);
    const img = getImg(url);
    if (!img || !img.complete || !img.naturalWidth) return;
    const r = cosmeticRect(c, box);
    // keep the asset's aspect ratio inside the anchor box (contain)
    const ratio = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    const dx = r.x + (r.w - dw) / 2;
    const dy = r.y + (r.h - dh) / 2;
    if (facing === "left" && !c.sprite_left_url && c.sprite_right_url) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  };

  for (const c of ordered) if (cosmeticRect(c, box).behind) drawPiece(c);

  const base = spriteUrl ? getImg(spriteUrl) : null;
  if (base && base.complete && base.naturalWidth) {
    if (flip) {
      ctx.save();
      ctx.translate(x + PLAYER_W, y);
      ctx.scale(-1, 1);
      ctx.drawImage(base, 0, 0, PLAYER_W, PLAYER_H);
      ctx.restore();
    } else {
      ctx.drawImage(base, x, y, PLAYER_W, PLAYER_H);
    }
  } else {
    drawCharacter(ctx, x, y, PLAYER_W, PLAYER_H, fallbackColor, facing, jumping);
  }

  for (const c of ordered) if (!cosmeticRect(c, box).behind) drawPiece(c);
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, facing: "left" | "right", jumping = false,
) {
  // Body
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, shade(color, 22)); grd.addColorStop(1, shade(color, -10));
  ctx.fillStyle = grd;
  roundRect(ctx, x, y + h * 0.35, w, h * 0.65, 8); ctx.fill();
  // Head
  ctx.fillStyle = "#ffe0c2";
  ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.25, w * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1.5; ctx.stroke();
  // Eyes (facing)
  ctx.fillStyle = "#3b1f4a";
  const eyeY = y + h * 0.22;
  const eyeOffset = facing === "left" ? -2 : 2;
  ctx.beginPath(); ctx.arc(x + w / 2 - 5 + eyeOffset, eyeY, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w / 2 + 5 + eyeOffset, eyeY, 1.8, 0, Math.PI * 2); ctx.fill();
  // Cheeks
  ctx.fillStyle = "rgba(236,72,153,0.55)";
  ctx.beginPath(); ctx.arc(x + w / 2 - 7, y + h * 0.29, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w / 2 + 7, y + h * 0.29, 2, 0, Math.PI * 2); ctx.fill();
  // Feet
  ctx.fillStyle = "#3b1f4a";
  const legY = y + h - (jumping ? 6 : 2);
  roundRect(ctx, x + 4, legY, w / 2 - 6, 4, 2); ctx.fill();
  roundRect(ctx, x + w / 2 + 2, legY, w / 2 - 6, 4, 2); ctx.fill();
}

function shade(hex: string, percent: number) {
  const c = hex.replace("#", "");
  const num = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBubble(ctx: CanvasRenderingContext2D, cx: number, baseY: number, text: string) {
  ctx.save();
  ctx.font = "bold 12px Fredoka, system-ui";
  ctx.textAlign = "center";
  const padX = 8, padY = 5;
  const maxW = 180;
  // Wrap
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else { cur = test; }
  }
  if (cur) lines.push(cur);
  const lineH = 14;
  const bw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + padX * 2;
  const bh = lines.length * lineH + padY * 2;
  const bx = cx - bw / 2;
  const by = baseY - bh - 6;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.strokeStyle = "rgba(59,31,74,0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
  // Tail
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.moveTo(cx - 5, by + bh);
  ctx.lineTo(cx + 5, by + bh);
  ctx.lineTo(cx, by + bh + 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3b1f4a";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, by + padY + lineH * i + 11);
  }
  ctx.restore();
}
