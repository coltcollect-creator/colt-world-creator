import { useEffect, useRef, useState, useMemo } from "react";
import {
  Maximize2,
  X,
  Compass,
  Sparkles,
  Store,
  DoorOpen,
  Monitor,
  Gift,
  User,
  ZoomIn,
  ZoomOut,
  Navigation,
  Layers,
} from "lucide-react";
import type { MapObject } from "@/components/game/GameViewport";
import {
  FOW_CELL_SIZE,
  calculateFogStats,
} from "@/lib/fog-of-war";

type StoreRef = { id: string; name: string; image_url?: string | null };
type NpcRef = { id: string; name: string };
type MapRef = { id: string; name: string };

type Props = {
  mapW: number;
  mapD: number;
  playerX: number;
  playerZ: number;
  playerFacing?: number; // radians or degrees
  camAngle: number; // camera orbital angle in radians
  discoveredCells: Set<number>;
  objects: MapObject[];
  stores: StoreRef[];
  npcs: NpcRef[];
  maps: MapRef[];
  mapName?: string;
  floorColor?: string | null;
  backgroundTheme?: string | null;
};

export function FogOfWarMinimap({
  mapW,
  mapD,
  playerX,
  playerZ,
  playerFacing = 0,
  camAngle = 0,
  discoveredCells,
  objects,
  stores,
  npcs,
  maps,
  mapName = "מפת היריד",
  floorColor = "#0f172a",
  backgroundTheme = "cyber_arcade",
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [modalZoom, setModalZoom] = useState(0.35);
  const [modalPan, setModalPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  const cols = Math.ceil(mapW / FOW_CELL_SIZE);
  const rows = Math.ceil(mapD / FOW_CELL_SIZE);

  const stats = useMemo(() => {
    return calculateFogStats(discoveredCells, cols, rows);
  }, [discoveredCells, cols, rows]);

  // Mini-radar canvas renderer (circular HUD at bottom-left)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    // Circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Background base
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, size, size);

    // Minimap scale: fit the whole map or track player
    const scale = (size - 16) / Math.max(mapW, mapD);
    const offsetX = (size - mapW * scale) / 2;
    const offsetZ = (size - mapD * scale) / 2;

    // 1. Draw Discovered Floor / Terrain
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const cellX = offsetX + c * FOW_CELL_SIZE * scale;
        const cellY = offsetZ + r * FOW_CELL_SIZE * scale;
        const cellW = FOW_CELL_SIZE * scale + 0.5;
        const cellH = FOW_CELL_SIZE * scale + 0.5;

        if (discoveredCells.has(index)) {
          ctx.fillStyle = "#1e3a5f"; // Clean illuminated deep ocean blue for explored floor
          ctx.fillRect(cellX, cellY, cellW, cellH);

          // Subtle grid dots
          if ((r + c) % 3 === 0) {
            ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
            ctx.fillRect(cellX, cellY, 1.5, 1.5);
          }
        } else {
          // Fog of War (Dark Mysterious Clouds)
          ctx.fillStyle = "#02040a";
          ctx.fillRect(cellX, cellY, cellW, cellH);
        }
      }
    }

    // 2. Draw Discovered Objects
    for (const obj of objects) {
      const ox = obj.x;
      const oz = obj.y;
      const ow = obj.width || 120;
      const od = obj.depth || obj.height || 100;
      const meta = obj.metadata || {};

      // Check if center of object is in discovered cell
      const centerCol = Math.floor((ox + ow / 2) / FOW_CELL_SIZE);
      const centerRow = Math.floor((oz + od / 2) / FOW_CELL_SIZE);
      const cellIndex = centerRow * cols + centerCol;

      if (!discoveredCells.has(cellIndex)) continue; // Hidden by fog

      const sx = offsetX + ox * scale;
      const sy = offsetZ + oz * scale;
      const sw = Math.max(4, ow * scale);
      const sd = Math.max(4, od * scale);

      if (obj.object_type === "room") {
        const wallCol = (meta.wall_color as string) || "#0284c7";
        ctx.fillStyle = wallCol;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(sx, sy, sw, sd);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = wallCol;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, sy, sw, sd);
      } else if (obj.object_type === "store") {
        ctx.fillStyle = "#ec4899";
        ctx.beginPath();
        ctx.arc(sx + sw / 2, sy + sd / 2, Math.max(3, sw * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.object_type === "npc") {
        ctx.fillStyle = "#a855f7";
        ctx.beginPath();
        ctx.arc(sx + sw / 2, sy + sd / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.object_type === "door") {
        ctx.fillStyle = "#06b6d4";
        ctx.beginPath();
        ctx.arc(sx + sw / 2, sy + sd / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.object_type === "screen") {
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(sx, sy, sw, Math.max(2, sd * 0.4));
      } else if (obj.object_type === "treasure") {
        ctx.fillStyle = "#eab308";
        ctx.fillRect(sx, sy, sw, sd);
      }
    }

    // 3. Player Position & Orientation
    const px = offsetX + playerX * scale;
    const py = offsetZ + playerZ * scale;

    // Glowing Radar Pulse around player
    const pulseTime = Date.now() * 0.003;
    const pulseRad = 6 + Math.sin(pulseTime) * 2.5;

    ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
    ctx.beginPath();
    ctx.arc(px, py, pulseRad + 4, 0, Math.PI * 2);
    ctx.fill();

    // Player Dot
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Player view direction arrow
    const lookAngle = playerFacing - Math.PI / 2;
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(lookAngle) * 8, py + Math.sin(lookAngle) * 8);
    ctx.stroke();

    ctx.restore();

    // Outer Cyber Ring & Compass indicator
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // North Needle on outer rim (rotates with camera angle)
    const northAngle = -camAngle - Math.PI / 2;
    const nx = center + Math.cos(northAngle) * (radius - 5);
    const ny = center + Math.sin(northAngle) * (radius - 5);

    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", nx, ny);

    ctx.restore();
  }, [
    mapW,
    mapD,
    playerX,
    playerZ,
    playerFacing,
    camAngle,
    discoveredCells,
    objects,
    floorColor,
    cols,
    rows,
  ]);

  // Fullscreen Expanded Map canvas renderer
  useEffect(() => {
    if (!isExpanded) return;
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + modalPan.x, h / 2 + modalPan.y);
    ctx.scale(modalZoom, modalZoom);
    ctx.translate(-mapW / 2, -mapD / 2);

    // 1. Draw Map Boundary & Fog Grid
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, mapW, mapD);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const cellX = c * FOW_CELL_SIZE;
        const cellY = r * FOW_CELL_SIZE;

        if (discoveredCells.has(index)) {
          ctx.fillStyle = "#1e3a5f";
          ctx.fillRect(cellX, cellY, FOW_CELL_SIZE + 0.5, FOW_CELL_SIZE + 0.5);

          // Grid pattern
          ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
          ctx.lineWidth = 1;
          ctx.strokeRect(cellX, cellY, FOW_CELL_SIZE, FOW_CELL_SIZE);
        } else {
          // Fog of war
          ctx.fillStyle = "#02040a";
          ctx.fillRect(cellX, cellY, FOW_CELL_SIZE + 0.5, FOW_CELL_SIZE + 0.5);

          // Fog cloud pattern
          if ((r * 7 + c * 13) % 5 === 0) {
            ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
            ctx.beginPath();
            ctx.arc(cellX + FOW_CELL_SIZE / 2, cellY + FOW_CELL_SIZE / 2, FOW_CELL_SIZE * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 2. Draw Discovered Objects with Clear Labels & Badges
    for (const obj of objects) {
      const ox = obj.x;
      const oz = obj.y;
      const ow = obj.width || 120;
      const od = obj.depth || obj.height || 100;
      const meta = obj.metadata || {};

      const centerCol = Math.floor((ox + ow / 2) / FOW_CELL_SIZE);
      const centerRow = Math.floor((oz + od / 2) / FOW_CELL_SIZE);
      const cellIndex = centerRow * cols + centerCol;

      if (!discoveredCells.has(cellIndex)) continue; // Undiscovered

      if (activeFilter !== "all" && activeFilter !== obj.object_type) continue;

      const cx = ox + ow / 2;
      const cz = oz + od / 2;

      if (obj.object_type === "room") {
        const wallCol = (meta.wall_color as string) || "#0284c7";
        const rName = (meta.room_name as string) || (meta.label as string) || "חדר";

        ctx.fillStyle = wallCol;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(ox, oz, ow, od);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = wallCol;
        ctx.lineWidth = 6;
        ctx.strokeRect(ox, oz, ow, od);

        // Room Label Badge
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(cx - 90, cz - 18, 180, 36);
        ctx.strokeStyle = wallCol;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 90, cz - 18, 180, 36);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`🏠 ${rName}`, cx, cz);
      } else if (obj.object_type === "store") {
        const sRef = stores.find((s) => s.id === obj.reference_id);
        const storeName = sRef?.name || (meta.label as string) || "חנות";

        ctx.fillStyle = "#ec4899";
        ctx.fillRect(ox, oz, ow, od);
        ctx.strokeStyle = "#f472b6";
        ctx.lineWidth = 3;
        ctx.strokeRect(ox, oz, ow, od);

        // Store Badge
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.fillRect(cx - 80, oz - 32, 160, 26);
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 80, oz - 32, 160, 26);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`🏪 ${storeName}`, cx, oz - 19);
      } else if (obj.object_type === "npc") {
        const npcName = npcs.find((n) => n.id === obj.reference_id)?.name || (meta.label as string) || "NPC";

        ctx.fillStyle = "#a855f7";
        ctx.beginPath();
        ctx.arc(cx, cz, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(cx - 60, cz - 40, 120, 24);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`🙋 ${npcName}`, cx, cz - 28);
      } else if (obj.object_type === "door") {
        const targetName = (meta.label as string) || maps.find((m) => m.id === meta.target_map_id)?.name || "שער מעבר";

        ctx.fillStyle = "#06b6d4";
        ctx.fillRect(ox, oz, ow, od);
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;
        ctx.strokeRect(ox, oz, ow, od);

        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(cx - 75, oz - 34, 150, 26);
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 75, oz - 34, 150, 26);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`🚪 ${targetName}`, cx, oz - 21);
      } else if (obj.object_type === "screen") {
        const text = (meta.text as string) || (meta.label as string) || "מסך";

        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(ox, oz, ow, od);
        ctx.strokeStyle = "#7dd3fc";
        ctx.lineWidth = 2;
        ctx.strokeRect(ox, oz, ow, od);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`📺 ${text.slice(0, 16)}`, cx, oz - 12);
      } else if (obj.object_type === "treasure") {
        ctx.fillStyle = "#eab308";
        ctx.fillRect(ox, oz, ow, od);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎁 תיבה", cx, oz - 10);
      }
    }

    // 3. Player Marker on Fullscreen Map
    ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
    ctx.beginPath();
    ctx.arc(playerX, playerZ, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(playerX, playerZ, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📍 אתה כאן", playerX, playerZ + 35);

    ctx.restore();
  }, [
    isExpanded,
    modalZoom,
    modalPan,
    activeFilter,
    mapW,
    mapD,
    playerX,
    playerZ,
    discoveredCells,
    objects,
    stores,
    npcs,
    maps,
    floorColor,
    cols,
    rows,
  ]);

  return (
    <>
      {/* 🧭 Circular Bottom-Left Radar / Mini-Map */}
      <div className="fixed bottom-6 left-6 z-30 flex flex-col items-start gap-1.5 select-none animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div
          onClick={() => setIsExpanded(true)}
          className="group relative cursor-pointer rounded-full p-1 bg-black/85 backdrop-blur-md border-2 border-primary shadow-2xl shadow-primary/20 hover:scale-105 hover:border-accent transition-all"
          title="לחץ לפתיחת מפת עולם מלאה"
        >
          <canvas
            ref={canvasRef}
            width={132}
            height={132}
            className="rounded-full block"
          />

          {/* Center Expand Icon Hover Overlay */}
          <div className="absolute inset-0 rounded-full bg-primary/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
          </div>

          {/* Discovery Percentage Badge */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold shadow-md flex items-center gap-1 border border-white/20 whitespace-nowrap">
            <Sparkles className="w-2.5 h-2.5" />
            <span>{stats.percentage}% נחשף</span>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(true)}
          className="px-2 py-0.5 rounded-lg bg-black/70 hover:bg-black/90 text-white/90 text-[10px] font-bold border border-white/10 shadow flex items-center gap-1"
        >
          <Maximize2 className="w-3 h-3 text-primary" />
          <span>מפה מלאה</span>
        </button>
      </div>

      {/* 🗺️ Fullscreen Interactive Expanded Map Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl h-[88vh] bg-card text-card-foreground rounded-3xl border-2 border-primary/40 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground font-bold shadow">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black flex items-center gap-2">
                    <span>{mapName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                      ערפל קרב פעיל
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium">
                    גילוי מפה: <strong className="text-primary">{stats.percentage}%</strong> ({stats.discoveredCount}/{stats.totalCount} תאים נחשפו ונשמרו)
                  </p>
                </div>
              </div>

              {/* Progress Bar & Filter Pills */}
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
                  {[
                    { id: "all", label: "הכל", icon: "🌟" },
                    { id: "store", label: "עמדות", icon: "🏪" },
                    { id: "room", label: "חדרים", icon: "🏠" },
                    { id: "door", label: "שערים", icon: "🚪" },
                    { id: "screen", label: "מסכים", icon: "📺" },
                    { id: "npc", label: "דמויות", icon: "🙋" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        activeFilter === f.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span>{f.icon}</span> {f.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 rounded-2xl bg-muted hover:bg-muted/80 text-foreground transition-all"
                  title="סגור מפה (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Map Canvas Area */}
            <div className="relative flex-1 bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing">
              <canvas
                ref={modalCanvasRef}
                width={1200}
                height={750}
                className="w-full h-full object-contain block"
              />

              {/* Float Controls: Zoom & Recenter */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
                <button
                  onClick={() => setModalZoom((z) => Math.min(1.2, z + 0.1))}
                  className="p-2.5 rounded-xl bg-black/80 hover:bg-black text-white border border-white/20 shadow-lg transition-all"
                  title="הגדל זום"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setModalZoom((z) => Math.max(0.18, z - 0.1))}
                  className="p-2.5 rounded-xl bg-black/80 hover:bg-black text-white border border-white/20 shadow-lg transition-all"
                  title="הקטן זום"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setModalPan({ x: 0, y: 0 });
                    setModalZoom(0.35);
                  }}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg transition-all"
                  title="מרכז על השחקן"
                >
                  <Navigation className="w-5 h-5" />
                </button>
              </div>

              {/* Exploration Legend Footer */}
              <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-xs text-white">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping inline-block" />
                  <span>מיקומך</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                <span className="text-muted-foreground">התקדם בעולם כדי לחשוף אזורים מושחרים נוספים</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
