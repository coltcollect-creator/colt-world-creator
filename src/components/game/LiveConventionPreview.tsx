import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useLivePositions } from "@/hooks/use-live-positions";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLAYER_W, PLAYER_H, cosmeticRect, sortLayers } from "@/lib/avatar-layout";
import { Users, Eye, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { renderAnimatedMapBackground } from "@/lib/map-backgrounds";

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
    style?: string;
    preset?: string;
    sprite_url?: string;
    label?: string;
    text?: string;
    bg?: string;
    fg?: string;
    content_type?: string;
    image_url?: string;
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

type OtherPlayer = {
  user_id: string;
  x: number;
  y: number;
  username?: string;
  last_seen: string;
  avatar_config?: Record<string, string> | null;
  character_id?: string | null;
};

type EquippedCosmetic = {
  id: string;
  layer_type: string;
  sprite_left_url: string | null;
  sprite_right_url: string | null;
  offset_x: number;
  offset_y: number;
  scale: number;
  layer_order: number;
};

type Look = { idle: string | null; right: string | null; left: string | null; cosmetics: EquippedCosmetic[] };

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

function shade(hex: string, percent: number) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return hex;
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
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

const FLOOR_STYLE_MAP: Record<string, { color: string; top: string }> = {
  grass: { color: "#8b5a3c", top: "#7dd3a0" },
  stone: { color: "#6b7280", top: "#9ca3af" },
  wood:  { color: "#a16207", top: "#d97706" },
  sand:  { color: "#e9c46a", top: "#f4d47a" },
  brick: { color: "#b91c1c", top: "#ef4444" },
  neon:  { color: "#7c3aed", top: "#c4b5fd" },
  ice:   { color: "#38bdf8", top: "#bae6fd" },
  lava:  { color: "#dc2626", top: "#fb923c" },
  candy: { color: "#f472b6", top: "#fbcfe8" },
};

export function LiveConventionPreview() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activePlayerCount, setActivePlayerCount] = useState(0);

  // Fetch all maps
  const { data: maps = [] } = useQuery({
    queryKey: ["all-maps-preview"],
    queryFn: async () => {
      const { data } = await supabase.from("maps").select("*").eq("is_active", true).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Default to main map if no selection
  const mainMap = maps.find((m) => m.slug === "main-lobby" || m.name?.includes("ראשית") || m.name?.includes("Main")) || maps[0] || {
    id: "f5bb3160-7415-4f62-b72c-f04d1fcbd1a9",
    name: "מפה ראשית (Main Lobby)",
    slug: "main-lobby",
    width: 8800,
    height: 760,
    background_color: "#c8ecff",
  };

  const currentMap = maps.find((m) => m.id === selectedMapId) || mainMap;
  const activeMapId = currentMap.id;

  // Load real map objects from published version
  const { data: mapData } = useQuery({
    queryKey: ["live-map-bundle", activeMapId],
    queryFn: async () => {
      const { data: version } = await supabase
        .from("map_versions")
        .select("*")
        .eq("map_id", activeMapId)
        .order("version_number", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const verId = version?.id || "34e2d77d-a542-4f2b-9425-cfe269c18636";
      const { data: objs } = await supabase.from("map_objects").select("*").eq("map_version_id", verId);

      const fallbackObjects: MapObject[] = [
        { id: "obj-ground", map_version_id: verId, object_type: "platform", x: 0, y: 700, width: 8800, height: 60, layer: 1, collision: true, interactive: false, metadata: { color: "#4ade80", style: "grass", label: "רצפת היריד" } },
        { id: "obj-store-cards", map_version_id: verId, object_type: "store", reference_id: "store-colt-cards", x: 350, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🃏 שוק הקלפים" } },
        { id: "obj-store-wheel", map_version_id: verId, object_type: "store", reference_id: "store-wheel", x: 750, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🎡 גלגל המזל" } },
        { id: "obj-store-mystery", map_version_id: verId, object_type: "store", reference_id: "store-mystery", x: 1150, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🎁 קופסאות מסתורין" } },
        { id: "obj-store-cosmetics", map_version_id: verId, object_type: "store", reference_id: "store-cosmetics", x: 1550, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "👕 בוטיק הכובעים" } },
        { id: "obj-store-auction", map_version_id: verId, object_type: "store", reference_id: "store-auction", x: 1950, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🔨 מכרזים חיים" } },
        { id: "obj-npc-guide", map_version_id: verId, object_type: "npc", reference_id: "npc-guide", x: 180, y: 580, width: 80, height: 120, layer: 2, collision: false, interactive: true, metadata: { label: "מדריך קולט" } },
        { id: "obj-npc-professor", map_version_id: verId, object_type: "npc", reference_id: "npc-professor", x: 1380, y: 580, width: 80, height: 120, layer: 2, collision: false, interactive: true, metadata: { label: "פרופסור אוק" } },
      ];

      return (objs && objs.length > 0 ? objs : fallbackObjects) as MapObject[];
    },
  });

  const objects = mapData || [];

  // Fetch stores, npcs, characters, cosmetics for rich rendering
  const { data: stores = [] } = useQuery({
    queryKey: ["preview-stores"],
    queryFn: async () => (await supabase.from("stores").select("*")).data ?? [],
  });

  const { data: npcs = [] } = useQuery({
    queryKey: ["preview-npcs"],
    queryFn: async () => (await supabase.from("npcs").select("*")).data ?? [],
  });

  // Realtime positions hook
  const { sample } = useLivePositions(activeMapId, true);

  // Spectator Camera
  const mapWidth = currentMap.width || 8800;
  const mapHeight = currentMap.height || 760;

  const cameraRef = useRef({
    x: 1200,
    y: 380,
    targetX: 1200,
    targetY: 380,
    autoPanDir: 1,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    camStartX: 0,
    camStartY: 0,
    lastUserAction: Date.now(),
    npcPositions: new Map<string, { x: number; y: number; dir: number; base: number }>(),
  });

  // Active online players — real-time Firestore subscription
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([]);
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | null = null;

    try {
      const q = query(collection(db, "active_players"), where("map_id", "==", activeMapId));
      unsub = onSnapshot(q, (snapshot) => {
        if (!mounted) return;
        const now = Date.now();
        const cutoff = now - 5 * 60 * 1000;
        const playersList: OtherPlayer[] = [];

        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const uid = (d.user_id || docSnap.id) as string;
          if (!uid) return;
          const seenTime = new Date(d.last_seen || 0).getTime();
          if (d.last_seen && seenTime < cutoff) return;

          playersList.push({
            user_id: uid,
            x: typeof d.x === "number" ? d.x : 100,
            y: typeof d.y === "number" ? d.y : 100,
            username: (d.username as string) || "Player",
            character_id: (d.character_id as string) || "d14fed03-b2c5-4205-b2ff-a151345151ee",
            avatar_config: (d.avatar_config as Record<string, string>) || {},
            last_seen: (d.last_seen as string) || new Date().toISOString(),
          });
        });

        setOtherPlayers(playersList);
        setActivePlayerCount(playersList.length);
      }, (err) => {
        console.warn("Live preview active_players notice:", err);
      });
    } catch (e) {
      console.warn("Live preview listener error:", e);
    }

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [activeMapId]);

  // Init NPCs patrol
  useEffect(() => {
    const cam = cameraRef.current;
    cam.npcPositions.clear();
    for (const o of objects) {
      if (o.object_type === "npc") {
        cam.npcPositions.set(o.id, { x: o.x, y: o.y, dir: 1, base: o.x });
      }
    }
  }, [objects]);

  // Draw decor presets
  const drawDecorPreset = (ctx: CanvasRenderingContext2D, preset: string, x: number, y: number, w: number, h: number) => {
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

  // Main Live Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const cam = cameraRef.current;
      const now = Date.now();

      // Smooth camera interpolation
      cam.x += (cam.targetX - cam.x) * 0.08;
      cam.y += (cam.targetY - cam.y) * 0.08;

      // Auto-pan if user is idle
      if (!cam.isDragging && now - cam.lastUserAction > 3500) {
        if (otherPlayers.length > 0 && Math.random() < 0.005) {
          const p = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
          cam.targetX = Math.max(400, Math.min(mapWidth - 400, p.x));
        } else {
          cam.targetX += 1.0 * cam.autoPanDir;
          if (cam.targetX > mapWidth - 700) cam.autoPanDir = -1;
          if (cam.targetX < 500) cam.autoPanDir = 1;
        }
      }

      // Update NPC patrol positions
      for (const obj of objects) {
        if (obj.object_type === "npc") {
          const np = cam.npcPositions.get(obj.id);
          if (np) {
            np.x += np.dir * 0.4;
            if (Math.abs(np.x - np.base) > 80) np.dir *= -1;
          }
        }
      }

      const vw = canvas.width;
      const vh = canvas.height;

      const halfVw = (vw / 2) / zoom;
      const halfVh = (vh / 2) / zoom;
      const camLeft = Math.max(0, Math.min(mapWidth - vw / zoom, cam.x - halfVw));
      const camTop = Math.max(0, Math.min(mapHeight - vh / zoom, cam.y - halfVh));

      const t = performance.now();

      ctx.save();
      ctx.clearRect(0, 0, vw, vh);

      // Dynamic Animated Sky / Theme Background
      renderAnimatedMapBackground({
        ctx,
        viewportWidth: vw,
        viewportHeight: vh,
        worldWidth: mapWidth,
        worldHeight: mapHeight,
        camX: camLeft,
        camY: camTop,
        theme: (currentMap as unknown as { background_theme?: string })?.background_theme || "classic_sky",
        customBgColor: currentMap.background_color,
        customBgUrl: currentMap.background_url,
        time: t,
      });

      // Apply zoom & camera translate
      ctx.scale(zoom, zoom);
      ctx.translate(-camLeft, -camTop);

      const platforms = objects.filter((o) => o.collision && (o.object_type === "platform" || o.object_type === "wall"));
      const decor = objects.filter((o) => o.object_type === "decor");
      const screens = objects.filter((o) => o.object_type === "screen");
      const doors = objects.filter((o) => o.object_type === "door");
      const storesOnMap = objects.filter((o) => o.object_type === "store");
      const npcsOnMap = objects.filter((o) => o.object_type === "npc");
      const treasuresOnMap = objects.filter((o) => o.object_type === "treasure");

      // 1. Decor
      for (const d of decor) {
        const img = getImg(d.metadata?.sprite_url);
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, d.x, d.y, d.width, d.height);
        } else {
          const preset = (d.metadata?.preset as string) || "";
          if (preset) drawDecorPreset(ctx, preset, d.x, d.y, d.width, d.height);
          else { ctx.fillStyle = (d.metadata?.color as string) || "#f5c6ea"; roundRect(ctx, d.x, d.y, d.width, d.height, 12); ctx.fill(); }
        }
      }

      // 2. Screens
      for (const sc of screens) {
        const bg = (sc.metadata?.bg as string) || "#1e1b4b";
        const fg = (sc.metadata?.fg as string) || "#fde68a";
        ctx.fillStyle = "#111827"; roundRect(ctx, sc.x - 6, sc.y - 6, sc.width + 12, sc.height + 12, 12); ctx.fill();
        ctx.fillStyle = bg; roundRect(ctx, sc.x, sc.y, sc.width, sc.height, 8); ctx.fill();
        const text = (sc.metadata?.text as string) || (sc.metadata?.label as string) || "";
        if (text) {
          ctx.fillStyle = fg; ctx.textAlign = "center";
          ctx.font = "bold 16px sans-serif";
          ctx.fillText(text, sc.x + sc.width / 2, sc.y + sc.height / 2 + 5);
        }
      }

      // 3. Platforms
      for (const p of platforms) {
        const styleKey = (p.metadata?.style as string) || "";
        const style = FLOOR_STYLE_MAP[styleKey];
        const col = style?.color || (p.metadata?.color as string) || "#8b5a3c";
        const topCol = style?.top || "#7dd3a0";
        const grd = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
        grd.addColorStop(0, col); grd.addColorStop(1, shade(col, -12));
        ctx.fillStyle = grd;
        roundRect(ctx, p.x, p.y, p.width, p.height, 10); ctx.fill();
        ctx.fillStyle = topCol;
        roundRect(ctx, p.x, p.y - 3, p.width, 8, 4); ctx.fill();
      }

      // 4. Doors
      for (const d of doors) {
        ctx.fillStyle = "#8b5a3c";
        roundRect(ctx, d.x, d.y, d.width || 48, d.height || 72, 6); ctx.fill();
        ctx.fillStyle = "#c99c6c";
        roundRect(ctx, d.x + 4, d.y + 4, (d.width || 48) - 8, (d.height || 72) - 8, 4); ctx.fill();
        if (d.metadata?.label) {
          ctx.fillStyle = "#3b1f4a"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(d.metadata.label as string, d.x + (d.width || 48) / 2, d.y - 6);
        }
      }

      // 5. Treasures
      for (const tb of treasuresOnMap) {
        const w = tb.width || 72, h = tb.height || 60;
        ctx.fillStyle = "#b45309";
        roundRect(ctx, tb.x, tb.y + h * 0.3, w, h * 0.7, 8); ctx.fill();
        ctx.fillStyle = "#f59e0b";
        roundRect(ctx, tb.x, tb.y, w, h * 0.38, 8); ctx.fill();
        ctx.fillStyle = "#4b1d5f"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
        ctx.fillText((tb.metadata?.label as string) || "תיבת אוצר", tb.x + w / 2, tb.y - 6);
      }

      // 6. Stores & Booths
      for (const st of storesOnMap) {
        const sref = stores.find((x) => x.id === st.reference_id || x.slug === st.reference_id);
        const img = getImg(sref?.image_url || (st.metadata?.sprite_url as string | undefined));
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, st.x, st.y, st.width, st.height);
        } else {
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, st.x, st.y + 28, st.width, st.height - 28, 14); ctx.fill();
          ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 4; ctx.stroke();
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
          ctx.fillStyle = "#a78bfa";
          roundRect(ctx, st.x + st.width / 2 - 22, st.y + st.height - 60, 44, 60, 6); ctx.fill();
        }
        ctx.fillStyle = "#4b1d5f"; ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(sref?.name ?? (st.metadata?.label as string) ?? "חנות", st.x + st.width / 2, st.y - 8);
      }

      // 7. NPCs
      for (const n of npcsOnMap) {
        const nref = npcs.find((x) => x.id === n.reference_id || x.slug === n.reference_id);
        const np = cam.npcPositions.get(n.id) ?? { x: n.x, y: n.y, dir: 1, base: n.x };
        const img = getImg(nref?.sprite_url || (n.metadata?.sprite_url as string | undefined));
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, np.x, np.y, n.width, n.height);
        } else {
          ctx.fillStyle = "#a855f7";
          roundRect(ctx, np.x, np.y, n.width, n.height, 10);
          ctx.fill();
        }
        ctx.fillStyle = "#3b1f4a"; ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center"; ctx.fillText(nref?.name ?? (n.metadata?.label as string) ?? "NPC", np.x + n.width / 2, np.y - 6);
      }

      // 8. Live Realtime Players
      for (const op of otherPlayers) {
        const livePos = sample(op.user_id);
        const px = livePos?.x ?? op.x;
        const py = livePos?.y ?? op.y;
        const facing = livePos?.facing === "left" ? -1 : 1;

        ctx.save();
        ctx.translate(px + PLAYER_W / 2, py + PLAYER_H / 2);
        ctx.scale(facing, 1);

        ctx.fillStyle = "#3b82f6";
        roundRect(ctx, -PLAYER_W / 2, -PLAYER_H / 2, PLAYER_W, PLAYER_H, 12);
        ctx.fill();

        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(0, -PLAYER_H / 4, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(4, -PLAYER_H / 4 - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Tag
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        const tagW = Math.max(60, (op.username || "Player").length * 8 + 16);
        roundRect(ctx, px + PLAYER_W / 2 - tagW / 2, py - 24, tagW, 18, 9);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#38bdf8";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(op.username || "Player", px + PLAYER_W / 2, py - 11);
        ctx.restore();
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [objects, stores, npcs, otherPlayers, mapWidth, mapHeight, currentMap, zoom, sample]);

  // Drag controls
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    cam.isDragging = true;
    cam.dragStartX = e.clientX;
    cam.dragStartY = e.clientY;
    cam.camStartX = cam.targetX;
    cam.camStartY = cam.targetY;
    cam.lastUserAction = Date.now();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    if (!cam.isDragging) return;
    const dx = (e.clientX - cam.dragStartX) / zoom;
    const dy = (e.clientY - cam.dragStartY) / zoom;
    cam.targetX = Math.max(300, Math.min(mapWidth - 300, cam.camStartX - dx));
    cam.targetY = Math.max(200, Math.min(mapHeight - 100, cam.camStartY - dy));
    cam.lastUserAction = Date.now();
  };

  const handleMouseUp = () => {
    cameraRef.current.isDragging = false;
  };

  const pan = (dx: number) => {
    const cam = cameraRef.current;
    cam.targetX = Math.max(300, Math.min(mapWidth - 300, cam.targetX + dx));
    cam.lastUserAction = Date.now();
  };

  return (
    <div className="chrome-panel relative flex flex-col overflow-hidden rounded-3xl border-2 border-primary/30 p-2 shadow-2xl bg-card/60 backdrop-blur-md">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 px-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-black text-red-600 dark:text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
            <Eye className="h-3.5 w-3.5" />
            שידור חי מהמפה הראשית
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-1 rounded-full">
            <Users className="h-3 w-3" />
            {activePlayerCount > 0 ? `${activePlayerCount} שחקנים מחוברים` : "ממתין לשחקנים"}
          </span>
        </div>

        {/* Room Switcher */}
        {maps.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            {maps.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMapId(m.id);
                  cameraRef.current.targetX = 1000;
                  cameraRef.current.lastUserAction = Date.now();
                }}
                className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                  activeMapId === m.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted"
                }`}
              >
                {m.name || m.slug}
              </button>
            ))}
          </div>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="rounded-lg bg-muted p-1 hover:bg-muted/80 text-muted-foreground"
            title="הקטן תצוגה"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(1.4, z + 0.15))}
            className="rounded-lg bg-muted p-1 hover:bg-muted/80 text-muted-foreground"
            title="הגדל תצוגה"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative min-h-[380px] sm:min-h-[440px] w-full flex-1 overflow-hidden rounded-2xl bg-slate-900 select-none">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={(e) => {
            const t = e.touches[0];
            const cam = cameraRef.current;
            cam.isDragging = true;
            cam.dragStartX = t.clientX;
            cam.dragStartY = t.clientY;
            cam.camStartX = cam.targetX;
            cam.camStartY = cam.targetY;
            cam.lastUserAction = Date.now();
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            const cam = cameraRef.current;
            if (!cam.isDragging) return;
            const dx = (t.clientX - cam.dragStartX) / zoom;
            const dy = (t.clientY - cam.dragStartY) / zoom;
            cam.targetX = Math.max(300, Math.min(mapWidth - 300, cam.camStartX - dx));
            cam.targetY = Math.max(200, Math.min(mapHeight - 100, cam.camStartY - dy));
            cam.lastUserAction = Date.now();
          }}
          onTouchEnd={handleMouseUp}
          className="h-full w-full object-cover cursor-grab active:cursor-grabbing"
        />

        {/* Left / Right Pan Buttons */}
        <button
          onClick={() => pan(-450)}
          className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-lg backdrop-blur hover:bg-background active:scale-95 transition-all text-foreground"
          title="הזז שמאלה"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <button
          onClick={() => pan(450)}
          className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-lg backdrop-blur hover:bg-background active:scale-95 transition-all text-foreground"
          title="הזז ימינה"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Quick Tour Info */}
        <div className="absolute top-3 start-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur pointer-events-none">
          👆 גררו את המפה או לחצו על החצים כדי לסייר במתחם הכנס
        </div>

        {/* Bottom CTA Bar */}
        <div className="absolute bottom-3 inset-x-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl bg-background/90 p-3 shadow-xl backdrop-blur-md border border-primary/20">
          <div className="flex items-center gap-2 text-start">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-black text-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">רוצים להצטרף ליריד, לאסוף קלפים ולסחור?</div>
              <div className="text-[10px] text-muted-foreground">התחברו עכשיו והתחילו לשחק עם הדמות שלכם!</div>
            </div>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Link
              to="/auth"
              className="btn-plastic flex-1 sm:flex-none text-center text-xs font-black bg-primary text-primary-foreground py-2 px-4 shadow-md hover:brightness-110"
            >
              התחברות לחשבון
            </Link>
            <Link
              to="/auth"
              search={{ mode: "register" } as never}
              className="btn-plastic flex-1 sm:flex-none text-center text-xs font-bold py-2 px-3 bg-secondary text-secondary-foreground"
            >
              יצירת חשבון
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
