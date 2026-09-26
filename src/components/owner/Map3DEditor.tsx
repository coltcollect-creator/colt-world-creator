import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageUpload } from "@/components/owner/ImageUpload";
import { FLOOR_TYPES, FLOOR_BASE_COLOR, makeFloorCanvas, type FloorType } from "@/lib/floor-textures";

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

type Tool = "select" | "store" | "npc" | "door" | "decor" | "screen" | "wall" | "spawn";

const TOOLS: Array<{ key: Tool; label: string; icon: string }> = [
  { key: "select", label: "בחירה / גרירה", icon: "🖐️" },
  { key: "store", label: "חנות", icon: "🏪" },
  { key: "npc", label: "דמות NPC", icon: "🙋" },
  { key: "door", label: "דלת", icon: "🚪" },
  { key: "wall", label: "קיר", icon: "🧱" },
  { key: "decor", label: "עיטור", icon: "🌳" },
  { key: "screen", label: "מסך", icon: "📺" },
  { key: "spawn", label: "נקודת התחלה", icon: "★" },
];

const DEFAULTS: Record<Tool, { width: number; depth: number; height: number }> = {
  select: { width: 0, depth: 0, height: 0 },
  store: { width: 400, depth: 320, height: 340 },
  npc: { width: 90, depth: 90, height: 150 },
  door: { width: 160, depth: 60, height: 240 },
  wall: { width: 400, depth: 40, height: 220 },
  decor: { width: 120, depth: 120, height: 160 },
  screen: { width: 300, depth: 20, height: 180 },
  spawn: { width: 60, depth: 60, height: 60 },
};

const COLORS: Record<string, string> = {
  store: "#f9a8d4", npc: "#a78bfa", door: "#c99c6c", wall: "#9ca3af",
  decor: "#86efac", screen: "#1e1b4b", spawn: "#facc15", platform: "#86efac",
};

type Props = {
  map: { id: string; name: string; width: number; height: number; background_color?: string | null; floor_type?: string | null; floor_color?: string | null; floor_texture_url?: string | null };
  versionId: string;
  objects: ObjRow[];
  stores: Array<{ id: string; name: string }>;
  npcs: Array<{ id: string; name: string }>;
  maps: Array<{ id: string; name: string }>;
};

export function Map3DEditor({ map, versionId, objects, stores, npcs, maps }: Props) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(0.35);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState("");
  const [doorTarget, setDoorTarget] = useState("");
  const [decorSprite, setDecorSprite] = useState<string | null>(null);
  const [screenText, setScreenText] = useState("ברוכים הבאים!");
  const [floorType, setFloorType] = useState<FloorType>(((map.floor_type as FloorType) ?? "grass"));
  const [floorColor, setFloorColor] = useState<string | null>(map.floor_color ?? null);
  const [floorTexture, setFloorTexture] = useState<string | null>(map.floor_texture_url ?? null);

  const saveFloor = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("maps").update(patch as never).eq("id", map.id);
    if (error) toast.error(error.message);
    else { toast.success("הרצפה עודכנה"); qc.invalidateQueries({ queryKey: ["all-maps"] }); }
  };
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [, forceTick] = useState(0);

  const planW = map.width * zoom;
  const planH = map.height * zoom;
  const selected = useMemo(() => objects.find((o) => o.id === selectedId) ?? null, [objects, selectedId]);

  const depthOf = (o: ObjRow) => (o.depth && o.depth > 0 ? o.depth : Math.max(120, Math.round(o.width * 0.6)));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, planW, planH);
    if (floorType === "custom") {
      ctx.fillStyle = floorColor || "#e5e7eb";
      ctx.fillRect(0, 0, planW, planH);
    } else {
      const pattern = ctx.createPattern(makeFloorCanvas(floorType, floorColor), "repeat");
      ctx.fillStyle = pattern ?? (floorColor || FLOOR_BASE_COLOR[floorType] || "#dff6e6");
      ctx.fillRect(0, 0, planW, planH);
    }
    // grid
    ctx.strokeStyle = "rgba(0,0,0,0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= map.width; x += 200) { const sx = x * zoom; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, planH); ctx.stroke(); }
    for (let y = 0; y <= map.height; y += 200) { const sy = y * zoom; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(planW, sy); ctx.stroke(); }

    for (const o of objects) {
      const d = depthOf(o);
      const x = o.x * zoom, y = o.y * zoom, w = o.width * zoom, h = d * zoom;
      ctx.fillStyle = COLORS[o.object_type] ?? "#c7b3f7";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = selectedId === o.id ? "#ec4899" : "rgba(0,0,0,0.35)";
      ctx.lineWidth = selectedId === o.id ? 3 : 1;
      ctx.strokeRect(x, y, w, h);
      const name =
        o.object_type === "store" ? "🏪 " + (stores.find((s) => s.id === o.reference_id)?.name ?? "חנות")
        : o.object_type === "npc" ? "🙋 " + (npcs.find((n) => n.id === o.reference_id)?.name ?? "NPC")
        : o.object_type === "door" ? "🚪 " + ((o.metadata?.label as string) ?? "דלת")
        : o.object_type === "spawn" ? "★ התחלה"
        : o.object_type === "wall" ? "🧱"
        : o.object_type === "screen" ? "📺"
        : "🌳";
      ctx.fillStyle = o.object_type === "screen" ? "#fde68a" : "#3b1f4a";
      ctx.font = "bold 11px Fredoka, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(name, x + w / 2, y + Math.min(14, h - 2));
    }
  }, [objects, map, planW, planH, zoom, selectedId, stores, npcs, floorType, floorColor]);

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round((((e.clientX - rect.left) / rect.width) * planW) / zoom),
      y: Math.round((((e.clientY - rect.top) / rect.height) * planH) / zoom),
    };
  };

  const hitTest = (wx: number, wy: number) =>
    [...objects].reverse().find((o) => wx >= o.x && wx <= o.x + o.width && wy >= o.y && wy <= o.y + depthOf(o)) ?? null;

  const onPointerDown = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x: wx, y: wy } = toWorld(e);
    if (tool === "select") {
      const hit = hitTest(wx, wy);
      setSelectedId(hit?.id ?? null);
      if (hit) {
        drag.current = { id: hit.id, dx: wx - hit.x, dy: wy - hit.y, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    const def = DEFAULTS[tool];
    const base = {
      map_version_id: versionId,
      x: Math.max(0, wx - Math.round(def.width / 2)),
      y: Math.max(0, wy - Math.round(def.depth / 2)),
      width: def.width, depth: def.depth, height: def.height,
      layer: 1, collision: false, interactive: false,
      metadata: {} as Record<string, unknown>, reference_id: null as string | null,
      object_type: tool as string,
    };
    let payload: Record<string, unknown> = base;
    if (tool === "store") {
      if (!pickerId) { toast.error("בחרו חנות מהרשימה"); return; }
      payload = { ...base, interactive: true, collision: true, reference_id: pickerId };
    } else if (tool === "npc") {
      if (!pickerId) { toast.error("בחרו דמות NPC"); return; }
      payload = { ...base, interactive: true, reference_id: pickerId };
    } else if (tool === "door") {
      if (!doorTarget) { toast.error("בחרו מפת יעד לדלת"); return; }
      payload = { ...base, interactive: true, metadata: { target_map_id: doorTarget, label: maps.find((m) => m.id === doorTarget)?.name ?? "דלת" } };
    } else if (tool === "wall") {
      payload = { ...base, collision: true };
    } else if (tool === "decor") {
      payload = { ...base, metadata: { sprite_url: decorSprite ?? undefined } };
    } else if (tool === "screen") {
      payload = { ...base, metadata: { content_type: "text", text: screenText, bg: "#1e1b4b", fg: "#fde68a" } };
    }
    const { error } = await supabase.from("map_objects").insert(payload as never);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const { x: wx, y: wy } = toWorld(e);
    const obj = objects.find((o) => o.id === d.id);
    if (!obj) return;
    obj.x = Math.max(0, Math.min(map.width - obj.width, wx - d.dx));
    obj.y = Math.max(0, Math.min(map.height - depthOf(obj), wy - d.dy));
    d.moved = true;
    forceTick((n) => n + 1);
  };

  const onPointerUp = async () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    const obj = objects.find((o) => o.id === d.id);
    if (!obj) return;
    const { error } = await supabase.from("map_objects").update({ x: Math.round(obj.x), y: Math.round(obj.y) } as never).eq("id", obj.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
  };

  const patchSelected = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    const { error } = await supabase.from("map_objects").update(patch as never).eq("id", selected.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["editor-objects", versionId] });
  };

  const removeSelected = async () => {
    if (!selected) return;
    const { error } = await supabase.from("map_objects").delete().eq("id", selected.id);
    if (error) toast.error(error.message);
    else { setSelectedId(null); qc.invalidateQueries({ queryKey: ["editor-objects", versionId] }); }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr_280px] flex-1 min-h-0 overflow-hidden">
      <aside className="space-y-3 h-full overflow-y-auto pr-1">
        <div className="chrome-panel p-3">
          <div className="mb-2 text-xs font-bold">כלים (מפת 3D – מבט מלמעלה)</div>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map((tl) => (
              <button
                key={tl.key}
                onClick={() => setTool(tl.key)}
                className={`rounded-xl border-2 px-2 py-2 text-[11px] font-bold ${tool === tl.key ? "border-primary bg-primary/15" : "border-border bg-card"}`}
              >
                {tl.icon} {tl.label}
              </button>
            ))}
          </div>
        </div>

        {(tool === "store" || tool === "npc") && (
          <div className="chrome-panel p-3">
            <label className="mb-1 block text-xs font-bold">{tool === "store" ? "בחרו חנות" : "בחרו NPC"}</label>
            <select value={pickerId} onChange={(e) => setPickerId(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm">
              <option value="">—</option>
              {(tool === "store" ? stores : npcs).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {tool === "door" && (
          <div className="chrome-panel p-3">
            <label className="mb-1 block text-xs font-bold">מפת יעד</label>
            <select value={doorTarget} onChange={(e) => setDoorTarget(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm">
              <option value="">—</option>
              {maps.filter((m) => m.id !== map.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        {tool === "decor" && (
          <div className="chrome-panel p-3">
            <div className="mb-1 text-xs font-bold">תמונת עיטור (רקע שקוף)</div>
            <ImageUpload value={decorSprite} onChange={setDecorSprite} folder="decor" />
          </div>
        )}
        {tool === "screen" && (
          <div className="chrome-panel p-3">
            <label className="mb-1 block text-xs font-bold">טקסט למסך</label>
            <input value={screenText} onChange={(e) => setScreenText(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm" />
          </div>
        )}

        <div className="chrome-panel p-3">
          <div className="mb-2 text-xs font-bold">🧱 רצפת המפה</div>
          <div className="grid grid-cols-2 gap-2">
            {FLOOR_TYPES.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFloorType(f.key); saveFloor({ floor_type: f.key }); }}
                className={`rounded-xl border-2 px-2 py-2 text-[11px] font-bold ${floorType === f.key ? "border-primary bg-primary/15" : "border-border bg-card"}`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
          <label className="mt-2 block text-[11px] font-bold">
            צבע רצפה (אופציונלי)
            <input
              type="text"
              placeholder={FLOOR_BASE_COLOR[floorType]}
              value={floorColor ?? ""}
              onChange={(e) => setFloorColor(e.target.value || null)}
              onBlur={() => saveFloor({ floor_color: floorColor })}
              className="mt-1 w-full rounded-xl border-2 border-border bg-input px-2 py-1"
            />
          </label>
          {floorType === "custom" && (
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-bold">תמונת רצפה (נפרסת על כל הרצפה)</div>
              <ImageUpload
                value={floorTexture}
                folder="floors"
                onChange={(url) => { setFloorTexture(url); saveFloor({ floor_texture_url: url }); }}
              />
            </div>
          )}
        </div>

        <div className="chrome-panel p-3 text-[11px] leading-5 text-muted-foreground">
          במפה תלת-מימדית האובייקטים ממוקמים על הרצפה: <b>X</b> = ימין/שמאל, <b>Z</b> = קדימה/אחורה.
          התצוגה כאן היא תוכנית קרקע – גררו אובייקטים למקום המדויק, והגובה נקבע בפאנל המידות.
        </div>
      </aside>

      <div className="chrome-panel flex min-h-0 flex-col overflow-hidden p-2">
        <div className="mb-2 flex items-center gap-2 text-xs">
          <button className="chrome-panel px-2 py-1" onClick={() => setZoom((z) => Math.max(0.1, Number((z - 0.05).toFixed(2))))}>➖</button>
          <span className="font-bold">{Math.round(zoom * 100)}%</span>
          <button className="chrome-panel px-2 py-1" onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.05).toFixed(2))))}>➕</button>
          <span className="text-muted-foreground">{map.width} × {map.height}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-muted/40 p-2">
          <canvas
            ref={canvasRef}
            width={planW}
            height={planH}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="block touch-none rounded-xl border-2 border-white shadow-lg"
          />
        </div>
      </div>

      <aside className="space-y-3 h-full overflow-y-auto pl-1">
        <div className="chrome-panel p-3">
          <div className="mb-2 text-xs font-bold">מידות ומיקום</div>
          {!selected ? (
            <div className="text-[11px] text-muted-foreground">בחרו אובייקט על התוכנית</div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="font-bold">{selected.object_type}</div>
              {([
                { k: "x", label: "מיקום X" },
                { k: "y", label: "מיקום Z (קדימה/אחורה)" },
                { k: "width", label: "רוחב (X)" },
                { k: "depth", label: "עומק (Z)" },
                { k: "height", label: "גובה (Y)" },
              ] as const).map((f) => (
                <label key={f.k} className="block">
                  <span className="mb-1 block font-bold">{f.label}</span>
                  <input
                    type="number"
                    defaultValue={f.k === "depth" ? depthOf(selected) : (selected[f.k] as number)}
                    onBlur={(e) => patchSelected({ [f.k]: Number(e.target.value) })}
                    className="w-full rounded-xl border-2 border-border bg-input px-2 py-1"
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" defaultChecked={selected.collision} onChange={(e) => patchSelected({ collision: e.target.checked })} />
                חוסם מעבר (קוליזיה)
              </label>
              <button onClick={removeSelected} className="btn-plastic w-full !py-1 text-xs" style={{ background: "linear-gradient(180deg,#fca5a5,#ef4444)" }}>
                🗑️ מחיקה
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
