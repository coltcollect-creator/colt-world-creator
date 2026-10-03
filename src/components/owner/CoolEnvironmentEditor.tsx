import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUpload } from "@/components/owner/ImageUpload";
import { FLOOR_TYPES, makeFloorCanvas, type FloorType } from "@/lib/floor-textures";
import { Sparkles, Eye, Move, Plus, Trash2, RotateCw, RotateCcw, Monitor, ZoomIn, ZoomOut, Save, LayoutGrid, Maximize2, Palette, DoorClosed, Box, Hand, Navigation, Target, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, User } from "lucide-react";

type ObjRow = {
  id: string;
  object_type: string;
  reference_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number | null;
  collision: boolean;
  interactive: boolean;
  metadata: Record<string, unknown>;
  map_version_id: string;
  layer: number;
};

type Tool = "select" | "pan" | "room" | "store" | "npc" | "door" | "decor" | "screen" | "treasure" | "spawn";

const TOOLS: Array<{ key: Tool; label: string; icon: string; desc: string }> = [
  { key: "select", label: "בחירה וגרירה", icon: "🖐️", desc: "הזז ושנה גדלים" },
  { key: "pan", label: "גרירת מסך (Pan)", icon: "🧭", desc: "הזז את זווית התצוגה בחלל" },
  { key: "room", label: "חדר / מתחם (Sims)", icon: "🏠", desc: "קירות נמוכים ורצפה מעוצבת" },
  { key: "store", label: "עמדת חנות / דוכן", icon: "🏪", desc: "הצב עמדת מסחר מפוארת" },
  { key: "npc", label: "דמות NPC", icon: "🙋", desc: "מדריך / דמות שיחה" },
  { key: "door", label: "שער מעבר מפה", icon: "🚪", desc: "שער מעבר למפה אחרת" },
  { key: "decor", label: "אלמנט עיצובי", icon: "✨", desc: "עצים, עמודים, ספות וצמחים" },
  { key: "screen", label: "מסך מולטימדיה", icon: "📺", desc: "מסך ענק להצגת תוכן" },
  { key: "treasure", label: "תיבת פרס", icon: "🎁", desc: "תיבת פרסים וג'מס" },
  { key: "spawn", label: "נקודת התחלה", icon: "🚩", desc: "מיקום כניסת השחקנים" },
];

export const COOL_DECOR_PRESETS: Array<{ id: string; name: string; icon: string; color: string; w: number; d: number; h: number }> = [
  { id: "cyber_tree", name: "עץ ניאון זוהר", icon: "🌲", color: "#38bdf8", w: 100, d: 100, h: 180 },
  { id: "palm_plant", name: "עציץ דקל יוקרתי", icon: "🌴", color: "#4ade80", w: 80, d: 80, h: 140 },
  { id: "neon_pillar", name: "עמוד תאורה עתידני", icon: "💡", color: "#ec4899", w: 50, d: 50, h: 220 },
  { id: "lounge_couch", name: "ספת לאונג' מעוצבת", icon: "🛋️", color: "#a855f7", w: 160, d: 80, h: 70 },
  { id: "hologram_podium", name: "פודיום הולוגרמה", icon: "🔮", color: "#06b6d4", w: 90, d: 90, h: 90 },
  { id: "luxury_rug", name: "שטיח קטיפה מלכותי", icon: "🟪", color: "#8b5cf6", w: 220, d: 160, h: 5 },
  { id: "cyber_fountain", name: "מזרקת מים מוארת", icon: "⛲", color: "#0ea5e9", w: 150, d: 150, h: 110 },
  { id: "gold_statue", name: "פסל אספנות מוזהב", icon: "🏆", color: "#eab308", w: 90, d: 90, h: 170 },
  { id: "table_set", name: "שולחן אירוח מודרני", icon: "🪑", color: "#f97316", w: 120, d: 90, h: 75 },
];

const DEFAULTS: Record<Tool, { width: number; depth: number; height: number }> = {
  select: { width: 0, depth: 0, height: 0 },
  pan: { width: 0, depth: 0, height: 0 },
  room: { width: 400, depth: 300, height: 65 },
  store: { width: 280, depth: 220, height: 260 },
  npc: { width: 80, depth: 80, height: 140 },
  door: { width: 140, depth: 50, height: 210 },
  decor: { width: 100, depth: 100, height: 160 },
  screen: { width: 260, depth: 30, height: 160 },
  treasure: { width: 80, depth: 80, height: 80 },
  spawn: { width: 60, depth: 60, height: 60 },
};

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

type Props = {
  map: {
    id: string;
    name: string;
    width: number;
    height: number;
    background_color?: string | null;
    floor_type?: string | null;
    floor_color?: string | null;
    floor_texture_url?: string | null;
    background_theme?: string | null;
  };
  versionId: string;
  objects: ObjRow[];
  stores: Array<{ id: string; name: string }>;
  npcs: Array<{ id: string; name: string }>;
  maps: Array<{ id: string; name: string }>;
  onPublish?: () => Promise<void> | void;
};

export function CoolEnvironmentEditor({ map, versionId, objects, stores, npcs, maps, onPublish }: Props) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(0.45);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState("");
  const [doorTarget, setDoorTarget] = useState("");
  const [decorPresetId, setDecorPresetId] = useState("cyber_tree");
  const [decorSprite, setDecorSprite] = useState<string | null>(null);
  const [screenText, setScreenText] = useState("ברוכים הבאים לסביבה המגניבה!");
  const [screenImageUrl, setScreenImageUrl] = useState<string | null>(null);
  const [screenBg, setScreenBg] = useState("#0f172a");
  const [screenFg, setScreenFg] = useState("#38bdf8");
  const [floorType, setFloorType] = useState<FloorType>(((map.floor_type as FloorType) ?? "neon"));
  const [floorColor, setFloorColor] = useState<string | null>(map.floor_color ?? "#0f172a");
  const [themeAtmosphere, setThemeAtmosphere] = useState(map.background_theme ?? "cyber_arcade");

  // Map Dimensions State
  const [mapWidth, setMapWidth] = useState<number>(map.width || 2400);
  const [mapDepth, setMapDepth] = useState<number>(map.height || 1800);

  // Room Tool State
  const [roomName, setRoomName] = useState<string>("מתחם ראשי");
  const [roomWallColor, setRoomWallColor] = useState<string>("#0284c7");
  const [roomFloorColor, setRoomFloorColor] = useState<string>("#0f172a");
  const [roomWallHeight, setRoomWallHeight] = useState<number>(65);
  const [roomDoorOpening, setRoomDoorOpening] = useState<"south" | "north" | "east" | "west" | "all">("south");
  const [roomTilesW, setRoomTilesW] = useState<number>(4);
  const [roomTilesD, setRoomTilesD] = useState<number>(3);

  const saveMapDimensions = async (w: number, d: number) => {
    setMapWidth(w);
    setMapDepth(d);
    const { error } = await supabase.from("maps").update({ width: w, height: d } as never).eq("id", map.id);
    if (error) toast.error(error.message);
    else {
      toast.success("מימדי המפה עודכנו בהצלחה!");
      qc.invalidateQueries({ queryKey: ["all-maps"] });
      qc.invalidateQueries({ queryKey: ["active-map"] });
    }
  };

  const saveFloorAndAtmosphere = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("maps").update(patch as never).eq("id", map.id);
    if (error) toast.error(error.message);
    else {
      toast.success("הגדרות הסביבה עודכנו בהצלחה!");
      qc.invalidateQueries({ queryKey: ["all-maps"] });
      qc.invalidateQueries({ queryKey: ["active-map"] });
    }
  };

  const drag = useRef<{ id: string; startWorldX: number; startWorldY: number; startMouseX: number; startMouseY: number; moved: boolean } | null>(null);
  const isPanning = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const [, forceTick] = useState(0);

  // Image Caching for 2.5D Stores & Decors
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const getCachedImg = (url: string): HTMLImageElement | null => {
    if (!url) return null;
    if (imageCache.current.has(url)) return imageCache.current.get(url)!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      imageCache.current.set(url, img);
      forceTick((n) => n + 1);
    };
    return null;
  };

  const selected = useMemo(() => objects.find((o) => o.id === selectedId) ?? null, [objects, selectedId]);

  // World bounds
  const mapW = mapWidth;
  const mapD = mapDepth;
  const GRID_SIZE = 100;

  // Isometric projection math:
  const ISO_ANGLE = Math.PI / 6;
  const cosA = Math.cos(ISO_ANGLE);
  const sinA = Math.sin(ISO_ANGLE);

  const canvasWidth = 1400;
  const canvasHeight = 900;
  const originX = canvasWidth / 2;
  const originY = 220;

  const toScreen = (wx: number, wz: number, wy = 0) => {
    const rx = wx - mapW / 2;
    const rz = wz - mapD / 2;
    const sx = originX + panX + (rx * cosA - rz * cosA) * zoom;
    const sy = originY + panY + (rx * sinA + rz * sinA) * zoom * 0.7 - wy * zoom;
    return { x: sx, y: sy };
  };

  const toWorld = (screenX: number, screenY: number) => {
    const dx = (screenX - (originX + panX)) / zoom;
    const dy = (screenY - (originY + panY)) / (zoom * 0.7);
    const rx = (dx / cosA + dy / sinA) / 2;
    const rz = (dy / sinA - dx / cosA) / 2;
    return {
      x: Math.max(0, Math.min(mapW, rx + mapW / 2)),
      z: Math.max(0, Math.min(mapD, rz + mapD / 2)),
    };
  };

  // Draw 2.5D Isometric Floor, Rooms with Sims-style walls, Objects, and Character
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (themeAtmosphere === "cyber_arcade") {
      bgGrad.addColorStop(0, "#090d16");
      bgGrad.addColorStop(0.5, "#131b2e");
      bgGrad.addColorStop(1, "#1a162b");
    } else if (themeAtmosphere === "outdoor_plaza") {
      bgGrad.addColorStop(0, "#bae6fd");
      bgGrad.addColorStop(0.6, "#e0f2fe");
      bgGrad.addColorStop(1, "#f0fdf4");
    } else {
      bgGrad.addColorStop(0, "#18181b");
      bgGrad.addColorStop(0.7, "#27272a");
      bgGrad.addColorStop(1, "#3f3f46");
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Floor polygon
    const p0 = toScreen(0, 0);
    const p1 = toScreen(mapW, 0);
    const p2 = toScreen(mapW, mapD);
    const p3 = toScreen(0, mapD);

    // Base floor tile with selected texture pattern
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();

    try {
      const fCanvas = makeFloorCanvas(floorType, floorColor);
      const pattern = ctx.createPattern(fCanvas, "repeat");
      if (pattern) {
        ctx.fillStyle = pattern;
      } else {
        ctx.fillStyle = floorColor || "#1e293b";
      }
    } catch {
      ctx.fillStyle = floorColor || "#1e293b";
    }
    ctx.fill();

    // Floor slab thickness for 3D depth presence
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y + 26);
    ctx.lineTo(p3.x, p3.y + 26);
    ctx.closePath();
    ctx.fillStyle = "#0f172a";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p3.x, p3.y + 26);
    ctx.lineTo(p0.x, p0.y + 26);
    ctx.closePath();
    ctx.fillStyle = "#1e293b";
    ctx.fill();

    // Isometric Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= mapW; gx += GRID_SIZE) {
      const gStart = toScreen(gx, 0);
      const gEnd = toScreen(gx, mapD);
      ctx.beginPath();
      ctx.moveTo(gStart.x, gStart.y);
      ctx.lineTo(gEnd.x, gEnd.y);
      ctx.stroke();
    }
    for (let gz = 0; gz <= mapD; gz += GRID_SIZE) {
      const gStart = toScreen(0, gz);
      const gEnd = toScreen(mapW, gz);
      ctx.beginPath();
      ctx.moveTo(gStart.x, gStart.y);
      ctx.lineTo(gEnd.x, gEnd.y);
      ctx.stroke();
    }

    const roomObjects = objects.filter((o) => o.object_type === "room");
    const otherObjects = objects.filter((o) => o.object_type !== "room").sort((a, b) => {
      const az = a.y + (a.depth ?? a.height ?? 80);
      const bz = b.y + (b.depth ?? b.height ?? 80);
      return az - bz;
    });

    // 1. Render Rooms (The Sims Style)
    for (const rm of roomObjects) {
      const isSel = rm.id === selectedId;
      const meta = rm.metadata || {};
      const rx = rm.x;
      const rz = rm.y;
      const rw = rm.width || 400;
      const rd = rm.depth || rm.height || 300;
      const wallH = (meta.wall_height as number) || 65;
      const wallCol = (meta.wall_color as string) || "#0284c7";
      const roomFlrCol = (meta.floor_color as string) || "#0f172a";
      const rName = (meta.room_name as string) || (meta.label as string) || "חדר";
      const doorOpen = (meta.door_opening as string) || "south";

      const rp0 = toScreen(rx, rz);
      const rp1 = toScreen(rx + rw, rz);
      const rp2 = toScreen(rx + rw, rz + rd);
      const rp3 = toScreen(rx, rz + rd);

      // Room Floor Patch
      ctx.beginPath();
      ctx.moveTo(rp0.x, rp0.y);
      ctx.lineTo(rp1.x, rp1.y);
      ctx.lineTo(rp2.x, rp2.y);
      ctx.lineTo(rp3.x, rp3.y);
      ctx.closePath();
      ctx.fillStyle = roomFlrCol;
      ctx.fill();
      ctx.strokeStyle = isSel ? "#ec4899" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = isSel ? 3 : 1.5;
      ctx.stroke();

      // Back & Left Walls (North: p0 to p1)
      const topP0 = toScreen(rx, rz, wallH);
      const topP1 = toScreen(rx + rw, rz, wallH);
      ctx.beginPath();
      ctx.moveTo(rp0.x, rp0.y);
      ctx.lineTo(rp1.x, rp1.y);
      ctx.lineTo(topP1.x, topP1.y);
      ctx.lineTo(topP0.x, topP0.y);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.stroke();

      // Left Wall (West: p0 to p3)
      const topP3 = toScreen(rx, rz + rd, wallH);
      ctx.beginPath();
      ctx.moveTo(rp0.x, rp0.y);
      ctx.lineTo(rp3.x, rp3.y);
      ctx.lineTo(topP3.x, topP3.y);
      ctx.lineTo(topP0.x, topP0.y);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.stroke();

      // Low Cutaway Walls
      const lowH = wallH * 0.35;
      const topP2_low = toScreen(rx + rw, rz + rd, lowH);
      const topP1_low = toScreen(rx + rw, rz, lowH);
      const topP3_low = toScreen(rx, rz + rd, lowH);

      // East Wall (Right)
      ctx.beginPath();
      ctx.moveTo(rp1.x, rp1.y);
      ctx.lineTo(rp2.x, rp2.y);
      ctx.lineTo(topP2_low.x, topP2_low.y);
      ctx.lineTo(topP1_low.x, topP1_low.y);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.globalAlpha = 0.65;
      ctx.fill();
      ctx.globalAlpha = 1;

      // South Wall (Front) with Open Entrance Doorway
      const doorW = 110;
      const sideW = Math.max(16, (rw - doorW) / 2);

      const pDoorLeft = toScreen(rx + sideW, rz + rd);
      const topDoorLeft_low = toScreen(rx + sideW, rz + rd, lowH);
      const pDoorRight = toScreen(rx + rw - sideW, rz + rd);
      const topDoorRight_low = toScreen(rx + rw - sideW, rz + rd, lowH);

      // South Left Wall
      ctx.beginPath();
      ctx.moveTo(rp3.x, rp3.y);
      ctx.lineTo(pDoorLeft.x, pDoorLeft.y);
      ctx.lineTo(topDoorLeft_low.x, topDoorLeft_low.y);
      ctx.lineTo(topP3_low.x, topP3_low.y);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.globalAlpha = 0.75;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.stroke();

      // South Right Wall
      ctx.beginPath();
      ctx.moveTo(pDoorRight.x, pDoorRight.y);
      ctx.lineTo(rp2.x, rp2.y);
      ctx.lineTo(topP2_low.x, topP2_low.y);
      ctx.lineTo(topDoorRight_low.x, topDoorRight_low.y);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 🚪 Open Entrance Doorway Frame & Open Door Indication
      const topDoorLeft_high = toScreen(rx + sideW, rz + rd, wallH * 0.95);
      const topDoorRight_high = toScreen(rx + rw - sideW, rz + rd, wallH * 0.95);

      // Left post
      ctx.strokeStyle = wallCol;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pDoorLeft.x, pDoorLeft.y);
      ctx.lineTo(topDoorLeft_high.x, topDoorLeft_high.y);
      ctx.stroke();

      // Right post
      ctx.beginPath();
      ctx.moveTo(pDoorRight.x, pDoorRight.y);
      ctx.lineTo(topDoorRight_high.x, topDoorRight_high.y);
      ctx.stroke();

      // Top lintel
      ctx.beginPath();
      ctx.moveTo(topDoorLeft_high.x, topDoorLeft_high.y);
      ctx.lineTo(topDoorRight_high.x, topDoorRight_high.y);
      ctx.stroke();

      // Open Door Leaf (swung 45° inward into room)
      const doorLeafInner = toScreen(rx + sideW + (doorW * 0.35) * Math.SQRT1_2, rz + rd - (doorW * 0.35) * Math.SQRT1_2);
      const doorLeafTop = toScreen(rx + sideW + (doorW * 0.35) * Math.SQRT1_2, rz + rd - (doorW * 0.35) * Math.SQRT1_2, wallH * 0.82);
      ctx.beginPath();
      ctx.moveTo(pDoorLeft.x, pDoorLeft.y);
      ctx.lineTo(doorLeafInner.x, doorLeafInner.y);
      ctx.lineTo(doorLeafTop.x, doorLeafTop.y);
      ctx.lineTo(topDoorLeft_high.x, topDoorLeft_high.y * 0.9);
      ctx.closePath();
      ctx.fillStyle = wallCol;
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();

      // Entrance Threshold Indicator
      const doorCenter = toScreen(rx + rw / 2, rz + rd);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🚪 דלת כניסה (פתוחה)", doorCenter.x, doorCenter.y + 14);

      // Room Center Label
      const roomCenter = toScreen(rx + rw / 2, rz + rd / 2, 5);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`🏠 ${rName}`, roomCenter.x, roomCenter.y);
    }

    // 2. Render Objects
    for (const obj of otherObjects) {
      const isSel = obj.id === selectedId;
      const meta = obj.metadata || {};
      const ow = obj.width || 120;
      const od = obj.depth || obj.height || 100;
      const oh = (meta.height_3d as number) || (obj.object_type === "store" ? 220 : 140);

      const centerWorldX = obj.x + ow / 2;
      const centerWorldZ = obj.y + od / 2;
      const basePos = toScreen(centerWorldX, centerWorldZ, 0);
      const topPos = toScreen(centerWorldX, centerWorldZ, oh);

      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y + 4, (ow * zoom * 0.45), (od * zoom * 0.25), 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();

      if (isSel) {
        ctx.beginPath();
        ctx.ellipse(basePos.x, basePos.y + 4, (ow * zoom * 0.55), (od * zoom * 0.3), 0, 0, Math.PI * 2);
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (obj.object_type === "store") {
        const sRef = stores.find((s) => s.id === obj.reference_id);
        const storeName = sRef?.name || (meta.label as string) || "עמדת חנות";
        const imgUrl = (meta.image_url as string) || sRef?.image_url;
        const sw = ow * zoom * 0.75;
        const sh = oh * zoom * 0.75;

        const storeImg = imgUrl ? getCachedImg(imgUrl) : null;
        if (storeImg) {
          ctx.drawImage(storeImg, basePos.x - sw / 2, basePos.y - sh, sw, sh);
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          safeRoundRect(ctx, basePos.x - sw / 2, basePos.y - sh - 22, sw, 20, 8);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`🏪 ${storeName}`, basePos.x, basePos.y - sh - 8);
        } else {
          ctx.fillStyle = "#3b82f6";
          ctx.fillRect(basePos.x - sw / 2, basePos.y - sh, sw, sh);

          ctx.beginPath();
          ctx.moveTo(basePos.x - sw / 2 - 10, basePos.y - sh);
          ctx.lineTo(basePos.x, basePos.y - sh - 25);
          ctx.lineTo(basePos.x + sw / 2 + 10, basePos.y - sh);
          ctx.closePath();
          ctx.fillStyle = "#f43f5e";
          ctx.fill();

          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`🏪 ${storeName}`, basePos.x, basePos.y - sh / 2);
        }
      } else if (obj.object_type === "npc") {
        const npcName = npcs.find((n) => n.id === obj.reference_id)?.name || "NPC";
        ctx.fillStyle = "#a855f7";
        ctx.beginPath();
        ctx.arc(topPos.x, topPos.y + 15, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#6366f1";
        ctx.fillRect(topPos.x - 12, topPos.y + 30, 24, 35);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`🙋 ${npcName}`, topPos.x, topPos.y - 8);
      } else if (obj.object_type === "treasure") {
        ctx.fillStyle = "#eab308";
        ctx.fillRect(basePos.x - 20, basePos.y - 35, 40, 30);
        ctx.fillStyle = "#ca8a04";
        ctx.fillRect(basePos.x - 22, basePos.y - 42, 44, 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎁 תיבת אוצר", basePos.x, basePos.y - 50);
      } else if (obj.object_type === "door") {
        const targetMap = maps.find((m) => m.id === meta.target_map_id)?.name || "מעבר חדר";
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(basePos.x, basePos.y - 40, 25, Math.PI, 0);
        ctx.lineTo(basePos.x + 25, basePos.y);
        ctx.lineTo(basePos.x - 25, basePos.y);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = "rgba(6,182,212,0.3)";
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`🚪 ${targetMap}`, basePos.x, basePos.y - 75);
      } else if (obj.object_type === "screen") {
        const text = (meta.text as string) || (meta.label as string) || "מסך תצוגה";
        const imgUrl = (meta.image_url as string) || (meta.sprite_url as string) || null;
        const scrImg = imgUrl ? getCachedImg(imgUrl) : null;
        const sw = 130 * zoom;
        const sh = 75 * zoom;
        const rotY = (meta.rotation_y as number) ?? (meta.rotation_deg ? (meta.rotation_deg as number) * (Math.PI / 180) : 0);

        ctx.save();
        ctx.translate(basePos.x, basePos.y - 45);
        ctx.rotate(rotY * 0.5);

        if (scrImg) {
          ctx.drawImage(scrImg, -sw / 2, -sh / 2, sw, sh);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2;
          ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
        } else {
          ctx.fillStyle = (meta.bg as string) || "#0f172a";
          ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2;
          ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
          ctx.fillStyle = (meta.fg as string) || "#38bdf8";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(text.slice(0, 16), 0, 4);
        }

        ctx.restore();

        // Screen Label above
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`📺 ${text.slice(0, 14)}`, basePos.x, basePos.y - 75);
      } else {
        const decorPreset = COOL_DECOR_PRESETS.find((d) => d.id === meta.preset) || COOL_DECOR_PRESETS[0];
        const imgUrl = (meta.image_url as string) || (meta.sprite_url as string);
        const decorImg = imgUrl ? getCachedImg(imgUrl) : null;
        const dw = ow * zoom * 0.7;
        const dh = oh * zoom * 0.7;

        if (decorImg) {
          ctx.drawImage(decorImg, basePos.x - dw / 2, basePos.y - dh, dw, dh);
        } else {
          ctx.fillStyle = decorPreset.color;
          ctx.beginPath();
          ctx.arc(basePos.x, basePos.y - 30, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "16px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(decorPreset.icon, basePos.x, basePos.y - 24);
          ctx.font = "bold 10px sans-serif";
          ctx.fillText(decorPreset.name, basePos.x, basePos.y - 55);
        }
      }
    }

    // 3D Convention Character preview at spawn position
    const spawnObj = objects.find((o) => o.object_type === "spawn");
    const spawnX = spawnObj?.x ?? mapW / 2;
    const spawnZ = spawnObj?.y ?? mapD / 2;
    const charPos = toScreen(spawnX, spawnZ, 0);

    // Dynamic ground shadow
    ctx.beginPath();
    ctx.ellipse(charPos.x, charPos.y + 3, 22, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fill();

    // 3D Humanoid Body Hierarchy (isometric 3/4 depth representation)
    const px = charPos.x;
    const py = charPos.y;

    // Sneakers
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px - 14, py - 6, 11, 6);
    ctx.fillRect(px + 3, py - 6, 11, 6);
    ctx.fillStyle = "#06b6d4";
    ctx.fillRect(px - 14, py - 2, 11, 2);
    ctx.fillRect(px + 3, py - 2, 11, 2);

    // Legs / Tech Pants
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(px - 12, py - 24, 9, 18);
    ctx.fillRect(px + 3, py - 24, 9, 18);

    // Pelvis & Torso / Jacket
    ctx.fillStyle = "#6d28d9"; // Royal purple jacket
    ctx.beginPath();
    ctx.roundRect(px - 15, py - 46, 30, 24, 6);
    ctx.fill();

    // Inner White Shirt & Gold Trim
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(px - 4, py - 44, 8, 20);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(px - 6, py - 44, 2, 20);
    ctx.fillRect(px + 4, py - 44, 2, 20);

    // Lanyard & Badge
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(px - 3, py - 32, 6, 8);

    // Arms
    ctx.fillStyle = "#5b21b6";
    ctx.beginPath();
    ctx.roundRect(px - 19, py - 44, 5, 18, 3);
    ctx.roundRect(px + 14, py - 44, 5, 18, 3);
    ctx.fill();
    // Hands
    ctx.fillStyle = "#fed7aa";
    ctx.beginPath();
    ctx.arc(px - 16.5, py - 25, 3, 0, Math.PI * 2);
    ctx.arc(px + 16.5, py - 25, 3, 0, Math.PI * 2);
    ctx.fill();

    // Neck & Head
    ctx.fillStyle = "#fed7aa"; // Skin
    ctx.fillRect(px - 3.5, py - 50, 7, 5);
    ctx.beginPath();
    ctx.arc(px, py - 58, 10, 0, Math.PI * 2);
    ctx.fill();

    // Stylized Dark Espresso Hair
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(px, py - 61, 10.5, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - 8, py - 63);
    ctx.lineTo(px - 2, py - 58);
    ctx.lineTo(px + 4, py - 64);
    ctx.fill();

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👤 דמות תלת-מימד (כניסה)", charPos.x, charPos.y - 75);
  }, [mapW, mapD, zoom, panX, panY, objects, selectedId, floorType, floorColor, themeAtmosphere, stores, npcs, maps]);

  // Click & Drag handling on the Isometric canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Pan with Right button or Middle click or Pan tool
    if (e.button === 1 || e.button === 2 || tool === "pan" || e.altKey || e.shiftKey) {
      isPanning.current = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);
    const world = toWorld(clickX, clickY);

    if (tool === "select") {
      let found: ObjRow | null = null;
      let minDist = 140;
      for (const obj of objects) {
        const objCenterWorldX = obj.x + (obj.width || 100) / 2;
        const objCenterWorldZ = obj.y + (obj.depth || obj.height || 100) / 2;
        const dist = Math.hypot(world.x - objCenterWorldX, world.z - objCenterWorldZ);
        if (dist < minDist) {
          minDist = dist;
          found = obj;
        }
      }
      if (found) {
        setSelectedId(found.id);
        drag.current = {
          id: found.id,
          startWorldX: found.x,
          startWorldY: found.y,
          startMouseX: clickX,
          startMouseY: clickY,
          moved: false,
        };
      } else {
        setSelectedId(null);
      }
    } else {
      const snapX = Math.round(world.x / GRID_SIZE) * GRID_SIZE;
      const snapZ = Math.round(world.z / GRID_SIZE) * GRID_SIZE;
      handlePlace(snapX, snapZ);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - isPanning.current.startX;
      const dy = e.clientY - isPanning.current.startY;
      setPanX(isPanning.current.startPanX + dx * 1.5);
      setPanY(isPanning.current.startPanY + dy * 1.5);
      return;
    }

    if (!drag.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
    const curY = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);

    const world = toWorld(curX, curY);
    drag.current.moved = true;

    const obj = objects.find((o) => o.id === drag.current!.id);
    if (obj) {
      const snappedX = Math.round((world.x - (obj.width || 100) / 2) / GRID_SIZE) * GRID_SIZE;
      const snappedZ = Math.round((world.z - (obj.depth || obj.height || 100) / 2) / GRID_SIZE) * GRID_SIZE;
      obj.x = Math.max(0, Math.min(mapW - (obj.width || 100), snappedX));
      obj.y = Math.max(0, Math.min(mapD - (obj.depth || obj.height || 100), snappedZ));
      forceTick((n) => n + 1);
    }
  };

  const handlePointerUp = async () => {
    isPanning.current = null;
    if (drag.current && drag.current.moved) {
      const obj = objects.find((o) => o.id === drag.current!.id);
      if (obj) {
        await supabase.from("map_objects").update({ x: obj.x, y: obj.y } as never).eq("id", obj.id);
        qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
      }
    }
    drag.current = null;
  };

  const handlePlace = async (worldX: number, worldZ: number) => {
    const base = {
      map_version_id: versionId,
      collision: true,
      interactive: false,
      layer: 1,
      metadata: {},
    };

    let payload: Record<string, unknown> = {};
    const d = DEFAULTS[tool];

    if (tool === "room") {
      const roomW = roomTilesW * GRID_SIZE;
      const roomD = roomTilesD * GRID_SIZE;
      payload = {
        ...base,
        object_type: "room",
        x: Math.max(0, Math.min(mapW - roomW, worldX - roomW / 2)),
        y: Math.max(0, Math.min(mapD - roomD, worldZ - roomD / 2)),
        width: roomW,
        height: roomD,
        depth: roomD,
        collision: false,
        interactive: false,
        metadata: {
          room_name: roomName,
          wall_color: roomWallColor,
          floor_color: roomFloorColor,
          wall_height: roomWallHeight,
          door_opening: roomDoorOpening,
        },
      };
    } else if (tool === "store") {
      if (!pickerId) {
        toast.error("אנא בחר חנות מהרשימה לפני ההצבה");
        return;
      }
      payload = {
        ...base,
        object_type: "store",
        reference_id: pickerId,
        x: Math.round(worldX - d.width / 2),
        y: Math.round(worldZ - d.depth / 2),
        width: d.width,
        height: d.depth,
        depth: d.depth,
        interactive: true,
        metadata: { height_3d: d.height },
      };
    } else if (tool === "npc") {
      if (!pickerId) {
        toast.error("אנא בחר NPC מהרשימה לפני ההצבה");
        return;
      }
      payload = {
        ...base,
        object_type: "npc",
        reference_id: pickerId,
        x: Math.round(worldX - d.width / 2),
        y: Math.round(worldZ - d.depth / 2),
        width: d.width,
        height: d.depth,
        depth: d.depth,
        interactive: true,
        metadata: { height_3d: d.height },
      };
    } else if (tool === "door") {
      if (!doorTarget) {
        toast.error("אנא בחר מפת יעד עבור הדלת");
        return;
      }
      payload = {
        ...base,
        object_type: "door",
        x: Math.round(worldX - d.width / 2),
        y: Math.round(worldZ - d.depth / 2),
        width: d.width,
        height: d.depth,
        depth: d.depth,
        interactive: true,
        metadata: { target_map_id: doorTarget, height_3d: d.height },
      };
    } else if (tool === "treasure") {
      payload = {
        ...base,
        object_type: "treasure",
        x: Math.round(worldX - d.width / 2),
        y: Math.round(worldZ - d.depth / 2),
        width: d.width,
        height: d.depth,
        depth: d.depth,
        interactive: true,
        metadata: { height_3d: d.height },
      };
    } else if (tool === "screen") {
      payload = {
        ...base,
        object_type: "screen",
        x: Math.round(worldX - d.width / 2),
        y: Math.round(worldZ - d.depth / 2),
        width: d.width,
        height: d.depth,
        depth: d.depth,
        interactive: true,
        metadata: {
          text: screenText,
          image_url: screenImageUrl,
          bg: screenBg,
          fg: screenFg,
          height_3d: d.height,
          rotation_y: 0,
        },
      };
    } else if (tool === "spawn") {
      payload = {
        ...base,
        object_type: "spawn",
        x: Math.round(worldX - d.width / 2),
        y: Math.round(worldZ - d.depth / 2),
        width: d.width,
        height: d.depth,
        depth: d.depth,
        collision: false,
        interactive: false,
      };
    } else if (tool === "decor") {
      const preset = COOL_DECOR_PRESETS.find((p) => p.id === decorPresetId) || COOL_DECOR_PRESETS[0];
      payload = {
        ...base,
        object_type: "decor",
        x: Math.round(worldX - preset.w / 2),
        y: Math.round(worldZ - preset.d / 2),
        width: preset.w,
        height: preset.d,
        depth: preset.d,
        metadata: { preset: preset.id, height_3d: preset.h, sprite_url: decorSprite },
      };
    }

    const { error } = await supabase.from("map_objects").insert(payload as never);
    if (error) toast.error(error.message);
    else {
      toast.success(tool === "room" ? "החדר נוצר בהצלחה!" : "האלמנט הוצב בהצלחה!");
      qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
    }
  };

  const removeSelected = async () => {
    if (!selectedId) return;
    const { error } = await supabase.from("map_objects").delete().eq("id", selectedId);
    if (error) toast.error(error.message);
    else {
      toast.success("נמחק");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
    }
  };

  return (
    <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-[320px_1fr_300px] gap-3 flex-1 min-h-0 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="space-y-3 h-full overflow-y-auto pr-1">
        {/* Map Dimensions Control */}
        <div className="chrome-panel p-3 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-xs text-foreground">
            <Maximize2 className="w-4 h-4 text-primary" />
            <span>📐 מימדי המפה (גודל החלל)</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">רוחב X (פיקסלים)</label>
              <input
                type="number"
                step="200"
                min="800"
                max="6000"
                value={mapWidth}
                onChange={(e) => setMapWidth(Number(e.target.value))}
                onBlur={() => saveMapDimensions(mapWidth, mapDepth)}
                className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">עומק Z (פיקסלים)</label>
              <input
                type="number"
                step="200"
                min="800"
                max="6000"
                value={mapDepth}
                onChange={(e) => setMapDepth(Number(e.target.value))}
                onBlur={() => saveMapDimensions(mapWidth, mapDepth)}
                className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">קיצורים:</span>
            <button
              onClick={() => saveMapDimensions(1600, 1200)}
              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border/50"
            >
              קומפקטי
            </button>
            <button
              onClick={() => saveMapDimensions(2400, 1800)}
              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border/50"
            >
              רגיל
            </button>
            <button
              onClick={() => saveMapDimensions(3600, 2400)}
              className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border/50"
            >
              ענק
            </button>
          </div>
        </div>

        {/* Atmosphere & Floor Config */}
        <div className="chrome-panel p-3 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-xs text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>✨ הגדרות סביבה ואווירה</span>
          </div>

          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">אווירת החדר</label>
            <select
              value={themeAtmosphere}
              onChange={(e) => {
                setThemeAtmosphere(e.target.value);
                saveFloorAndAtmosphere({ background_theme: e.target.value });
              }}
              className="w-full rounded-xl border border-border bg-input px-2.5 py-1.5 text-xs font-bold"
            >
              <option value="cyber_arcade">🌆 ניאון וסייבר עתידני (Cyber Arcade)</option>
              <option value="luxury_gold">👑 היכל זהב מלכותי (Royal Luxury)</option>
              <option value="outdoor_plaza">🌿 כיכר פתוחה ופסטורלית (Outdoor Plaza)</option>
              <option value="space_hub">🚀 תחנת חלל מודרנית (Space Hub)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">סוג רצפת המפה (חיפוי)</label>
            <select
              value={floorType}
              onChange={(e) => {
                const nextType = e.target.value as FloorType;
                setFloorType(nextType);
                saveFloorAndAtmosphere({ floor_type: nextType });
              }}
              className="w-full rounded-xl border border-border bg-input px-2.5 py-1.5 text-xs font-bold"
            >
              {FLOOR_TYPES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.icon} {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">גוון / צבע רצפה (אופציונלי)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={floorColor || "#0f172a"}
                onChange={(e) => setFloorColor(e.target.value)}
                onBlur={() => saveFloorAndAtmosphere({ floor_color: floorColor })}
                className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0.5"
              />
              <span className="text-xs text-muted-foreground font-mono">{floorColor || "ברירת מחדל"}</span>
            </div>
          </div>
        </div>

        {/* Tools Palette */}
        <div className="chrome-panel p-3 space-y-2">
          <div className="font-bold text-xs text-muted-foreground mb-1">🛠️ בחר כלי להצבה</div>
          <div className="grid grid-cols-2 gap-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTool(t.key)}
                className={`flex flex-col items-start p-2 rounded-xl text-right transition-all border ${
                  tool === t.key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm font-bold"
                    : "bg-muted/40 hover:bg-muted border-border/50 text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </div>
                <span className="text-[10px] opacity-80 mt-0.5 line-clamp-1">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Room tool setup */}
        {tool === "room" && (
          <div className="chrome-panel p-3 space-y-2.5 border-2 border-primary/50 bg-primary/5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
              <Box className="w-4 h-4" />
              <span>🏠 הגדרת חדר / מסדרון (The Sims)</span>
            </div>

            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">שם החדר / המתחם</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                placeholder="למשל: לובי ראשי / חדר VIP"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">רוחב (קוביות)</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={roomTilesW}
                  onChange={(e) => setRoomTilesW(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">עומק (קוביות)</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={roomTilesD}
                  onChange={(e) => setRoomTilesD(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">צבע קירות</label>
                <input
                  type="color"
                  value={roomWallColor}
                  onChange={(e) => setRoomWallColor(e.target.value)}
                  className="w-full h-7 rounded border border-border cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">רצפת חדר</label>
                <input
                  type="color"
                  value={roomFloorColor}
                  onChange={(e) => setRoomFloorColor(e.target.value)}
                  className="w-full h-7 rounded border border-border cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">פתח כניסה / מעבר</label>
              <select
                value={roomDoorOpening}
                onChange={(e) => setRoomDoorOpening(e.target.value as "south" | "north" | "east" | "west" | "all")}
                className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
              >
                <option value="south">דלת בחזית (קדימה)</option>
                <option value="north">דלת מאחור</option>
                <option value="east">דלת מימין</option>
                <option value="west">דלת משמאל</option>
                <option value="all">חלל פתוח מכל הכיוונים</option>
              </select>
            </div>
          </div>
        )}

        {tool === "store" && (
          <div className="chrome-panel p-3 space-y-2">
            <label className="block text-xs font-bold">🏪 בחר חנות / דוכן</label>
            <select
              value={pickerId}
              onChange={(e) => setPickerId(e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-2.5 py-1.5 text-xs font-bold"
            >
              <option value="">-- בחר חנות --</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">לחץ על משטח הרצפה להצבת הדוכן במיקום הרצוי</p>
          </div>
        )}

        {tool === "npc" && (
          <div className="chrome-panel p-3 space-y-2">
            <label className="block text-xs font-bold">🙋 בחר דמות NPC</label>
            <select
              value={pickerId}
              onChange={(e) => setPickerId(e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-2.5 py-1.5 text-xs font-bold"
            >
              <option value="">-- בחר דמות --</option>
              {npcs.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {tool === "door" && (
          <div className="chrome-panel p-3 space-y-2">
            <label className="block text-xs font-bold">🚪 בחר חדר יעד לשער</label>
            <select
              value={doorTarget}
              onChange={(e) => setDoorTarget(e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-2.5 py-1.5 text-xs font-bold"
            >
              <option value="">-- בחר מפה --</option>
              {maps.filter((m) => m.id !== map.id).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {tool === "decor" && (
          <div className="chrome-panel p-3 space-y-2">
            <label className="block text-xs font-bold">✨ אלמנט עיצובי מהקטלוג</label>
            <div className="grid grid-cols-1 gap-1">
              {COOL_DECOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDecorPresetId(p.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg text-xs text-right border transition-all ${
                    decorPresetId === p.id
                      ? "bg-secondary text-secondary-foreground border-secondary font-bold"
                      : "bg-muted/30 border-transparent hover:bg-muted"
                  }`}
                >
                  <span className="text-base">{p.icon}</span>
                  <span className="flex-1">{p.name}</span>
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-border">
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">או תמונת עיטור אישית:</label>
              <ImageUpload
                folder="decor"
                value={decorSprite}
                onChange={(url) => setDecorSprite(url)}
                label="העלה ספרייט"
              />
            </div>
          </div>
        )}

        {tool === "screen" && (
          <div className="chrome-panel p-3 space-y-2.5">
            <label className="block text-xs font-bold">📺 הגדרת מסך מולטימדיה</label>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">טקסט במסך</label>
              <input
                type="text"
                value={screenText}
                onChange={(e) => setScreenText(e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-2.5 py-1.5 text-xs"
                placeholder="ברוכים הבאים!"
              />
            </div>

            <div>
              <ImageUpload
                value={screenImageUrl}
                onChange={(url) => setScreenImageUrl(url)}
                label="🖼️ תמונה להצגה על המסך"
                folder="screens"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground">צבע רקע</label>
                <input
                  type="color"
                  value={screenBg}
                  onChange={(e) => setScreenBg(e.target.value)}
                  className="w-full h-7 rounded border border-border cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground">צבע טקסט</label>
                <input
                  type="color"
                  value={screenFg}
                  onChange={(e) => setScreenFg(e.target.value)}
                  className="w-full h-7 rounded border border-border cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Center Canvas */}
      <main className="chrome-panel p-2 flex flex-col items-center justify-center relative overflow-hidden bg-slate-950 select-none">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs">
          <span>✨ סביבה מגניבה (זווית עומק תלת-מימדית)</span>
        </div>

        {/* Pan / Navigation / Zoom Controls */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15">
          <button
            onClick={() => setZoom((z) => Math.min(1.2, Number((z + 0.08).toFixed(2))))}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="הגדל זום"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs text-white font-mono px-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.18, Number((z - 0.08).toFixed(2))))}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="הקטן זום"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-white/20 mx-1" />

          {/* Navigation Pan Arrows */}
          <button
            onClick={() => setPanY((y) => y + 120)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="הזז למעלה"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPanY((y) => y - 120)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="הזז למטה"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPanX((x) => x + 120)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="הזז שמאלה"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPanX((x) => x - 120)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="הזז ימינה"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-[1px] bg-white/20 mx-1" />

          {/* Reset Center */}
          <button
            onClick={() => {
              setPanX(0);
              setPanY(0);
              setZoom(0.45);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px]"
            title="מרכז תצוגה"
          >
            <Target className="w-3.5 h-3.5" />
            <span>מרכז</span>
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="max-w-full max-h-full rounded-2xl shadow-2xl cursor-crosshair touch-none"
        />
      </main>

      {/* Right Sidebar */}
      <aside className="space-y-3 h-full overflow-y-auto pl-1">
        {selected ? (
          <div className="chrome-panel p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-xs">עריכת פריט נבחר</span>
              <button
                onClick={removeSelected}
                className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors"
                title="מחק אלמנט"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px]">סוג:</span>
                <span className="font-bold">
                  {selected.object_type === "room"
                    ? "🏠 חדר / מתחם (The Sims)"
                    : selected.object_type === "store"
                    ? "🏪 חנות"
                    : selected.object_type === "npc"
                    ? "🙋 NPC"
                    : selected.object_type === "door"
                    ? "🚪 דלת מעבר"
                    : selected.object_type === "treasure"
                    ? "🎁 תיבת אוצר"
                    : selected.object_type === "screen"
                    ? "📺 מסך תצוגה"
                    : "✨ אלמנט עיצובי"}
                </span>
              </div>

              {selected.object_type === "room" ? (
                <div className="space-y-2 border-t border-border pt-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">שם החדר / מתחם</label>
                    <input
                      type="text"
                      value={(selected.metadata?.room_name as string) || ""}
                      onChange={async (e) => {
                        const newMeta = { ...(selected.metadata || {}), room_name: e.target.value };
                        selected.metadata = newMeta;
                        await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                        qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                      }}
                      className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">צבע קירות</label>
                      <input
                        type="color"
                        value={(selected.metadata?.wall_color as string) || "#0284c7"}
                        onChange={async (e) => {
                          const newMeta = { ...(selected.metadata || {}), wall_color: e.target.value };
                          selected.metadata = newMeta;
                          await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full h-7 rounded border border-border cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">צבע רצפה</label>
                      <input
                        type="color"
                        value={(selected.metadata?.floor_color as string) || "#0f172a"}
                        onChange={async (e) => {
                          const newMeta = { ...(selected.metadata || {}), floor_color: e.target.value };
                          selected.metadata = newMeta;
                          await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full h-7 rounded border border-border cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">רוחב X</label>
                      <input
                        type="number"
                        step="100"
                        value={selected.width}
                        onChange={async (e) => {
                          const val = Number(e.target.value);
                          selected.width = val;
                          await supabase.from("map_objects").update({ width: val } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">עומק Z</label>
                      <input
                        type="number"
                        step="100"
                        value={selected.depth || selected.height}
                        onChange={async (e) => {
                          const val = Number(e.target.value);
                          selected.depth = val;
                          selected.height = val;
                          await supabase.from("map_objects").update({ depth: val, height: val } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selected.object_type === "store" && (
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5 font-bold">🏪 שיוך לחנות במערכת</label>
                      <select
                        value={selected.reference_id || ""}
                        onChange={async (e) => {
                          const val = e.target.value || null;
                          selected.reference_id = val;
                          await supabase.from("map_objects").update({ reference_id: val } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                      >
                        <option value="">בחר חנות...</option>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selected.object_type === "screen" && (
                    <div className="space-y-2 border-t border-border pt-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5 font-bold">📺 כותרת המסך (שם)</label>
                        <input
                          type="text"
                          value={(selected.metadata?.label as string) || (selected.metadata?.title as string) || ""}
                          onChange={async (e) => {
                            const newMeta = { ...(selected.metadata || {}), label: e.target.value, title: e.target.value };
                            selected.metadata = newMeta;
                            await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                            qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                          }}
                          placeholder="למשל: מסך מבצעים / הודעות יריד"
                          className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5 font-bold">📝 טקסט / תוכן המסך</label>
                        <textarea
                          rows={3}
                          value={(selected.metadata?.text as string) || ""}
                          onChange={async (e) => {
                            const newMeta = { ...(selected.metadata || {}), text: e.target.value };
                            selected.metadata = newMeta;
                            await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                            qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                          }}
                          placeholder="תוכן ההודעה שיופיע בפופאפ כשהשחקנים מתקרבים וצופים במסך..."
                          className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                        />
                      </div>

                      <div>
                        <ImageUpload
                          value={(selected.metadata?.image_url as string) || null}
                          onChange={async (url) => {
                            const newMeta = { ...(selected.metadata || {}), image_url: url };
                            selected.metadata = newMeta;
                            await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                            qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                          }}
                          folder="screens"
                          label="🖼️ תמונה להצגה על המסך (נראית ב-2.5D ובפופאפ)"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">צבע רקע</label>
                          <input
                            type="color"
                            value={(selected.metadata?.bg as string) || "#0f172a"}
                            onChange={async (e) => {
                              const newMeta = { ...(selected.metadata || {}), bg: e.target.value };
                              selected.metadata = newMeta;
                              await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                              qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                            }}
                            className="w-full h-7 rounded border border-border cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">צבע טקסט</label>
                          <input
                            type="color"
                            value={(selected.metadata?.fg as string) || "#38bdf8"}
                            onChange={async (e) => {
                              const newMeta = { ...(selected.metadata || {}), fg: e.target.value };
                              selected.metadata = newMeta;
                              await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                              qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                            }}
                            className="w-full h-7 rounded border border-border cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selected.object_type !== "screen" && (
                    <div>
                      <ImageUpload
                        value={(selected.metadata?.image_url as string) || null}
                        onChange={async (url) => {
                          const newMeta = { ...(selected.metadata || {}), image_url: url };
                          selected.metadata = newMeta;
                          await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        folder="stores"
                        label="🖼️ תמונת חנות / תפאורה בדו-מימד (פרונט קיר 1 ב-2.5D)"
                      />
                    </div>
                  )}

                  {/* 🔄 45-Degree Rotation Tool for ALL elements */}
                  <div className="space-y-1.5 p-2 rounded-xl bg-card border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold">🔄 סיבוב אלמנט ב-45° לכל צד</span>
                      <span className="text-[10px] font-mono text-primary font-extrabold">
                        {Math.round((((((selected.metadata?.rotation_y as number) ?? 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI))}°
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          const cur = (selected.metadata?.rotation_y as number) ?? 0;
                          const step = Math.PI / 4;
                          const next = cur - step;
                          const twoPi = Math.PI * 2;
                          const norm = ((next % twoPi) + twoPi) % twoPi;
                          const snapIndex = Math.round(norm / step) % 8;
                          const snappedVal = snapIndex * step;
                          const newMeta = { ...(selected.metadata || {}), rotation_y: snappedVal, rotation_deg: snapIndex * 45 };
                          selected.metadata = newMeta;
                          await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="btn-plastic !py-1 !px-2 text-xs flex items-center justify-center gap-1 font-bold"
                        title="סובב 45 מעלות שמאלה"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-primary" />
                        <span>45°- שמאלה</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const cur = (selected.metadata?.rotation_y as number) ?? 0;
                          const step = Math.PI / 4;
                          const next = cur + step;
                          const twoPi = Math.PI * 2;
                          const norm = ((next % twoPi) + twoPi) % twoPi;
                          const snapIndex = Math.round(norm / step) % 8;
                          const snappedVal = snapIndex * step;
                          const newMeta = { ...(selected.metadata || {}), rotation_y: snappedVal, rotation_deg: snapIndex * 45 };
                          selected.metadata = newMeta;
                          await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="btn-plastic !py-1 !px-2 text-xs flex items-center justify-center gap-1 font-bold"
                        title="סובב 45 מעלות ימינה"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-primary" />
                        <span>45°+ ימינה</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 justify-center">
                      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                        const rad = deg * (Math.PI / 180);
                        const curDeg = Math.round((((((selected.metadata?.rotation_y as number) ?? 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI));
                        const isCur = curDeg === deg;
                        return (
                          <button
                            key={deg}
                            type="button"
                            onClick={async () => {
                              const newMeta = { ...(selected.metadata || {}), rotation_y: rad, rotation_deg: deg };
                              selected.metadata = newMeta;
                              await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                              qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                              isCur
                                ? "bg-primary text-primary-foreground shadow"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            }`}
                          >
                            {deg}°
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">זווית סבסוב מותאמת</label>
                      <select
                        value={(selected.metadata?.rotation_y as number) ?? 0}
                        onChange={async (e) => {
                          const val = Number(e.target.value);
                          const deg = Math.round(val * (180 / Math.PI));
                          const newMeta = { ...(selected.metadata || {}), rotation_y: val, rotation_deg: deg };
                          selected.metadata = newMeta;
                          await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                      >
                        <option value={0}>חזית 0° (קיר ישר)</option>
                        <option value={Math.PI / 4}>אלכסון 45° (איזומטרי ימין)</option>
                        <option value={Math.PI / 2}>פרופיל 90° (צד)</option>
                        <option value={(3 * Math.PI) / 4}>אלכסון 135°</option>
                        <option value={Math.PI}>גב 180°</option>
                        <option value={(5 * Math.PI) / 4}>אלכסון 225°</option>
                        <option value={(3 * Math.PI) / 2}>פרופיל 270° (צד שמאל)</option>
                        <option value={(7 * Math.PI) / 4}>אלכסון 315° (איזומטרי שמאל)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">גובה בתלת-מימד (px)</label>
                      <input
                        type="number"
                        value={(selected.metadata?.height_3d as number) || 180}
                        onChange={async (e) => {
                          const val = Number(e.target.value);
                          const newMeta = { ...(selected.metadata || {}), height_3d: val };
                          selected.metadata = newMeta;
                          await supabase.from("map_objects").update({ metadata: newMeta } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block">רוחב (X)</label>
                      <input
                        type="number"
                        value={selected.width}
                        onChange={async (e) => {
                          const val = Number(e.target.value);
                          selected.width = val;
                          await supabase.from("map_objects").update({ width: val } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block">עומק (Z)</label>
                      <input
                        type="number"
                        value={selected.depth || selected.height}
                        onChange={async (e) => {
                          const val = Number(e.target.value);
                          selected.depth = val;
                          selected.height = val;
                          await supabase.from("map_objects").update({ depth: val, height: val } as never).eq("id", selected.id);
                          qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                        }}
                        className="w-full rounded-lg border border-border bg-input px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border">
                <button
                  onClick={async () => {
                    const copy = {
                      map_version_id: versionId,
                      object_type: selected.object_type,
                      reference_id: selected.reference_id,
                      x: selected.x + 100,
                      y: selected.y + 100,
                      width: selected.width,
                      height: selected.height,
                      depth: selected.depth,
                      collision: selected.collision,
                      interactive: selected.interactive,
                      metadata: selected.metadata,
                      layer: selected.layer,
                    };
                    const { error } = await supabase.from("map_objects").insert(copy as never);
                    if (error) toast.error(error.message);
                    else {
                      toast.success("הפריט שוכפל בהצלחה!");
                      qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
                    }
                  }}
                  className="w-full py-1.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold"
                >
                  📋 שכפל פריט
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="chrome-panel p-4 text-center text-xs text-muted-foreground space-y-2">
            <div>🖐️ לחץ על פריט במפה כדי לערוך אותו, לשנות את מידותיו או למחוק אותו.</div>
            <div className="p-2 rounded-lg bg-muted/40 text-[11px] leading-relaxed">
              💡 טיפ: ניתן לגרור את התצוגה במפה עם כפתור ימני / כלי <strong>🧭 גרירת מסך</strong> או באמצעות חיצי הניווט.
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
