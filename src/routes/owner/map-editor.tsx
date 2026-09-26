import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { ImageUpload } from "@/components/owner/ImageUpload";
import { Map3DEditor } from "@/components/owner/Map3DEditor";


export const Route = createFileRoute("/owner/map-editor")({ component: MapEditor });

type Tool = "select" | "platform" | "floor" | "store" | "npc" | "door" | "decor" | "screen" | "treasure" | "spawn";

/** Preset screen shapes; "pixels" lets the owner type exact dimensions. */
const SCREEN_RATIOS: Record<string, { label: string; w: number; h: number }> = {
  "16:9": { label: "16:9 רחב", w: 16, h: 9 },
  "4:3": { label: "4:3 קלאסי", w: 4, h: 3 },
  "1:1": { label: "1:1 ריבוע", w: 1, h: 1 },
  "9:16": { label: "9:16 אנכי", w: 9, h: 16 },
  "21:9": { label: "21:9 קינו", w: 21, h: 9 },
};


type ObjRow = {
  id: string;
  object_type: string;
  reference_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  collision: boolean;
  interactive: boolean;
  metadata: Record<string, unknown>;
  map_version_id: string;
  layer: number;
};

// Floor / platform styles (used by editor + game viewport)
export const FLOOR_STYLES: Record<string, { label: string; color: string; top: string }> = {
  grass:  { label: "🌱 דשא",     color: "#8b5a3c", top: "#7dd3a0" },
  stone:  { label: "🪨 אבן",      color: "#6b7280", top: "#9ca3af" },
  wood:   { label: "🪵 עץ",       color: "#a16207", top: "#d97706" },
  sand:   { label: "🏖️ חול",     color: "#e9c46a", top: "#f4d47a" },
  brick:  { label: "🧱 לבנים",    color: "#b91c1c", top: "#ef4444" },
  neon:   { label: "💜 ניאון",    color: "#7c3aed", top: "#c4b5fd" },
  ice:    { label: "❄️ קרח",     color: "#38bdf8", top: "#bae6fd" },
  lava:   { label: "🔥 לבה",     color: "#dc2626", top: "#fb923c" },
  candy:  { label: "🍬 סוכריה",  color: "#f472b6", top: "#fbcfe8" },
};

export const DECOR_PRESETS: Record<string, { label: string; emoji: string }> = {
  tree:    { label: "עץ",       emoji: "🌳" },
  flower:  { label: "פרח",     emoji: "🌸" },
  bush:    { label: "שיח",     emoji: "🌿" },
  cloud:   { label: "ענן",     emoji: "☁️" },
  balloon: { label: "בלון",    emoji: "🎈" },
  star:    { label: "כוכב",    emoji: "⭐" },
  crystal: { label: "קריסטל",  emoji: "💎" },
  heart:   { label: "לב",      emoji: "💖" },
  banner:  { label: "באנר",    emoji: "🎌" },
  lamp:    { label: "מנורה",  emoji: "💡" },
};

function MapEditor() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [mapId, setMapId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string>("");
  const [doorTarget, setDoorTarget] = useState<string>("");
  const [floorStyle, setFloorStyle] = useState<string>("grass");
  const [decorPreset, setDecorPreset] = useState<string>("tree");
  const [decorSprite, setDecorSprite] = useState<string | null>(null);
  const [screenContentType, setScreenContentType] = useState<"text" | "image">("text");
  const [screenText, setScreenText] = useState<string>("ברוכים הבאים!");
  const [screenImage, setScreenImage] = useState<string | null>(null);
  const [screenBg, setScreenBg] = useState<string>("#1e1b4b");
  const [screenFg, setScreenFg] = useState<string>("#fde68a");
  const [screenSizeMode, setScreenSizeMode] = useState<"ratio" | "pixels">("ratio");
  const [screenRatio, setScreenRatio] = useState<string>("16:9");
  const [screenBaseW, setScreenBaseW] = useState<number>(480);
  const [screenPxW, setScreenPxW] = useState<number>(480);
  const [screenPxH, setScreenPxH] = useState<number>(270);
  const [treasureId, setTreasureId] = useState<string>("");

  const [zoom, setZoom] = useState(0.6);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const { data: maps = [] } = useQuery({
    queryKey: ["all-maps"],
    queryFn: async () => (await supabase.from("maps").select("*").eq("is_archived", false).order("created_at")).data ?? [],
  });
  useEffect(() => {
    if (!mapId && maps.length) setMapId((maps.find((m) => m.is_active) ?? maps[0]).id);
  }, [maps, mapId]);

  const { data: version } = useQuery({
    queryKey: ["editor-version", mapId],
    enabled: !!mapId,
    queryFn: async () => {
      if (!mapId) return null;
      const { data: draft } = await supabase.from("map_versions").select("*").eq("map_id", mapId).eq("status", "draft").order("version_number", { ascending: false }).maybeSingle();
      if (draft) return draft;
      const { data: pub } = await supabase.from("map_versions").select("*").eq("map_id", mapId).eq("status", "published").order("version_number", { ascending: false }).maybeSingle();
      if (pub) return pub;
      const { data: created, error } = await supabase.from("map_versions").insert({ map_id: mapId, status: "draft", version_number: 1 } as never).select("*").maybeSingle();
      if (error) { toast.error(error.message); return null; }
      return created;
    },
  });

  const { data: objects = [] } = useQuery({
    queryKey: ["editor-objects", version?.id],
    enabled: !!version?.id,
    queryFn: async () => (await supabase.from("map_objects").select("*").eq("map_version_id", version!.id)).data ?? [],
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["all-stores"],
    queryFn: async () => (await supabase.from("stores").select("id,name").eq("active", true)).data ?? [],
  });
  const { data: npcs = [] } = useQuery({
    queryKey: ["all-npcs"],
    queryFn: async () => (await supabase.from("npcs").select("id,name").eq("active", true)).data ?? [],
  });
  const { data: treasureBoxes = [] } = useQuery({
    queryKey: ["all-treasure-boxes"],
    queryFn: async () => (await supabase.from("treasure_boxes").select("id,name,image_url").eq("active", true).order("name")).data ?? [],
  });


  const map = maps.find((m) => m.id === mapId);
  const is3D = (map as unknown as { dimension?: string } | undefined)?.dimension === "3d";
  const setDimension = async (dim: "2d" | "3d") => {
    if (!mapId) return;
    const { error } = await supabase.from("maps").update({ dimension: dim } as never).eq("id", mapId);
    if (error) { toast.error(error.message); return; }
    toast.success(dim === "3d" ? "המפה הוגדרה כתלת-מימדית" : "המפה הוגדרה כדו-מימדית");
    qc.invalidateQueries({ queryKey: ["all-maps"] });
    qc.invalidateQueries({ queryKey: ["active-map"] });
  };

  const mapW = (map?.width ?? 2400) * zoom;
  const mapH = (map?.height ?? 720) * zoom;

  const STORE_H = 320;
  const STORE_W = 400;
  const storeBaseline = (map?.height ?? 720) - 360;

  const GRID = 20;

  const zoomIn = () => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
  const zoomOut = () => setZoom((z) => Math.max(0.1, Number((z - 0.15).toFixed(2))));
  const resetZoom = () => setZoom(0.6);
  const fitZoom = () => {
    const vp = viewportRef.current;
    if (!vp || !map) return;
    const fit = (vp.clientWidth - 32) / (map.width ?? 2400);
    setZoom(Math.max(0.1, Math.min(1.5, Number(fit.toFixed(2)))));
  };

  const selected = useMemo(() => (objects as ObjRow[]).find((o) => o.id === selectedId) ?? null, [objects, selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mapW, mapH);
    // background
    const bg = (map.background_color as string | undefined) || null;
    const g = ctx.createLinearGradient(0, 0, 0, mapH);
    if (bg) { g.addColorStop(0, bg); g.addColorStop(1, "#fff2c2"); }
    else { g.addColorStop(0, "#ffd1ec"); g.addColorStop(0.5, "#c6e9ff"); g.addColorStop(1, "#fff2c2"); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, mapW, mapH);
    // grid
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < mapW; x += 40 * zoom) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mapH); ctx.stroke(); }
    for (let y = 0; y < mapH; y += 40 * zoom) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mapW, y); ctx.stroke(); }
    // Store baseline (dashed magenta)
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "rgba(236,72,153,0.65)";
    ctx.lineWidth = 2;
    const by = (storeBaseline + STORE_H) * zoom;
    ctx.beginPath(); ctx.moveTo(0, by); ctx.lineTo(mapW, by); ctx.stroke();
    ctx.restore();
    // objects
    for (const o of objects as ObjRow[]) {
      const x = o.x * zoom, y = o.y * zoom, w = o.width * zoom, h = o.height * zoom;
      let fill = "#c7b3f7", label = o.object_type, topStrip: string | null = null;
      if (o.object_type === "store") { fill = "#f9a8d4"; label = "🏪 " + (stores.find((s) => s.id === o.reference_id)?.name ?? "store"); }
      else if (o.object_type === "npc") { fill = "#a78bfa"; label = "🙋 " + (npcs.find((n) => n.id === o.reference_id)?.name ?? "npc"); }
      else if (o.object_type === "door") { fill = "#c99c6c"; label = "🚪 " + ((o.metadata?.label as string) ?? "door"); }
      else if (o.object_type === "platform") {
        const style = FLOOR_STYLES[(o.metadata?.style as string) || "grass"] ?? FLOOR_STYLES.grass;
        fill = style.color;
        topStrip = style.top;
        label = "";
      }
      else if (o.object_type === "spawn") { fill = "#facc15"; label = "★ spawn"; }
      else if (o.object_type === "decor") {
        fill = "#fbcfe8";
        const preset = DECOR_PRESETS[(o.metadata?.preset as string) || ""];
        label = preset?.emoji ?? "🌸";
      }
      else if (o.object_type === "screen") {
        fill = (o.metadata?.bg as string) || "#1e1b4b";
        label = "📺 " + ((o.metadata?.text as string) || "מסך");
      }
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      if (topStrip) { ctx.fillStyle = topStrip; ctx.fillRect(x, y, w, Math.max(3, h * 0.15)); }
      ctx.strokeStyle = selectedId === o.id ? "#ec4899" : "rgba(0,0,0,0.4)";
      ctx.lineWidth = selectedId === o.id ? 3 : 1;
      ctx.strokeRect(x, y, w, h);
      if (label) {
        ctx.fillStyle = o.object_type === "screen" ? ((o.metadata?.fg as string) || "#fff") : "#3b1f4a";
        ctx.font = "bold 11px Fredoka, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(label, x + w / 2, y + 14);
      }
    }
  }, [objects, map, mapW, mapH, selectedId, stores, npcs, storeBaseline, zoom]);

  const handleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!version || !map) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * mapW;
    const cy = ((e.clientY - rect.top) / rect.height) * mapH;
    const worldX = Math.round(cx / zoom);
    const worldY = Math.round(cy / zoom);

    if (tool === "select") {
      const hit = [...(objects as ObjRow[])].reverse().find((o) => worldX >= o.x && worldX <= o.x + o.width && worldY >= o.y && worldY <= o.y + o.height);
      setSelectedId(hit?.id ?? null);
      return;
    }

    const base = { map_version_id: version.id, x: worldX, y: worldY, layer: 1, collision: false, interactive: false, metadata: {} as Record<string, unknown>, reference_id: null as string | null };
    let payload: Record<string, unknown> = { ...base };
    if (tool === "platform") {
      payload = { ...base, object_type: "platform", width: 180, height: 24, collision: true, metadata: { style: floorStyle } };
    } else if (tool === "floor") {
      const floorY = (map.height ?? 720) - 40;
      payload = { ...base, x: 0, y: floorY, object_type: "platform", width: map.width ?? 2400, height: 40, collision: true, metadata: { role: "floor", style: floorStyle } };
    }
    else if (tool === "spawn") payload = { ...base, object_type: "spawn", width: 32, height: 48 };
    else if (tool === "decor") {
      payload = { ...base, object_type: "decor", width: 80, height: 80, metadata: { preset: decorPreset, sprite_url: decorSprite ?? undefined } };
    }
    else if (tool === "screen") {
      const meta: Record<string, unknown> = {
        content_type: screenContentType,
        bg: screenBg,
        fg: screenFg,
      };
      if (screenContentType === "text") meta.text = screenText;
      else meta.image_url = screenImage ?? "";
      const r = SCREEN_RATIOS[screenRatio] ?? SCREEN_RATIOS["16:9"];
      const sw = screenSizeMode === "pixels" ? Math.max(40, screenPxW) : Math.max(40, screenBaseW);
      const sh = screenSizeMode === "pixels" ? Math.max(40, screenPxH) : Math.round((Math.max(40, screenBaseW) * r.h) / r.w);
      meta.size_mode = screenSizeMode;
      meta.aspect_ratio = screenSizeMode === "ratio" ? screenRatio : null;
      meta.stretch = true;
      payload = { ...base, object_type: "screen", width: sw, height: sh, metadata: meta };
    }
    else if (tool === "treasure") {
      if (!treasureId) { toast.error("בחרו תיבת אוצר מהרשימה"); return; }
      const box = treasureBoxes.find((b) => b.id === treasureId);
      payload = {
        ...base, object_type: "treasure", width: 96, height: 80, interactive: true,
        reference_id: treasureId,
        metadata: { label: box?.name ?? "תיבת אוצר", sprite_url: box?.image_url ?? undefined },
      };

    }
    else if (tool === "store") {
      if (!pickerId) { toast.error("בחרו חנות מהרשימה"); return; }
      const snapX = Math.round(worldX / GRID) * GRID;
      const floorPlatforms = (objects as ObjRow[]).filter((o) => o.collision && o.object_type === "platform" && snapX + STORE_W > o.x && snapX < o.x + o.width);
      const floorTop = floorPlatforms.length ? Math.min(...floorPlatforms.map((p) => p.y)) : storeBaseline + STORE_H;
      const snapY = floorTop - STORE_H;
      payload = { ...base, x: snapX, y: snapY, object_type: "store", width: STORE_W, height: STORE_H, interactive: true, reference_id: pickerId };
    } else if (tool === "npc") {
      if (!pickerId) { toast.error("Choose an NPC from the dropdown"); return; }
      payload = { ...base, object_type: "npc", width: 48, height: 72, interactive: true, reference_id: pickerId };
    } else if (tool === "door") {
      if (!doorTarget) { toast.error("Choose target map for the door"); return; }
      payload = { ...base, object_type: "door", width: 48, height: 72, interactive: true, metadata: { target_map_id: doorTarget, label: maps.find((m) => m.id === doorTarget)?.name ?? "Door" } };
    }
    const { error } = await supabase.from("map_objects").insert(payload as never);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["editor-objects", version.id] });
  };

  const removeSelected = async () => {
    if (!selectedId) return;
    const { error } = await supabase.from("map_objects").delete().eq("id", selectedId);
    if (error) toast.error(error.message);
    else { setSelectedId(null); qc.invalidateQueries({ queryKey: ["editor-objects", version?.id] }); }
  };

  const updateSelectedMeta = async (patch: Record<string, unknown>, sizePatch?: { width?: number; height?: number }) => {
    if (!selected) return;
    const newMeta = { ...(selected.metadata ?? {}), ...patch };
    const upd: Record<string, unknown> = { metadata: newMeta };
    if (sizePatch?.width) upd.width = sizePatch.width;
    if (sizePatch?.height) upd.height = sizePatch.height;
    const { error } = await supabase.from("map_objects").update(upd as never).eq("id", selected.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["editor-objects", version?.id] });
  };

  const publish = async () => {
    if (!version) return;
    await supabase.from("map_versions").update({ status: "archived" }).eq("map_id", version.map_id).eq("status", "published");
    const { error } = await supabase.from("map_versions").update({ status: "published" }).eq("id", version.id);
    if (error) { toast.error(error.message); return; }
    toast.success("פורסם!");
    qc.invalidateQueries({ queryKey: ["editor-version", mapId] });
    qc.invalidateQueries({ queryKey: ["active-map"] });
  };

  return (
    <div dir="rtl" className="h-screen overflow-hidden flex flex-col p-3">
      <div className="chrome-panel mb-3 flex flex-wrap items-center justify-between gap-2 px-4 py-2 shrink-0">
        <div className="flex items-center gap-2 font-bold">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">🗺️</div>
          {t("owner.tab.mapEditor")}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={mapId ?? ""} onChange={(e) => { setMapId(e.target.value); setSelectedId(null); }} className="rounded-xl border-2 border-border bg-input px-2 py-1 text-xs font-bold">
            {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select
            value={is3D ? "3d" : "2d"}
            onChange={(e) => setDimension(e.target.value as "2d" | "3d")}
            className="rounded-xl border-2 border-border bg-input px-2 py-1 text-xs font-bold"
          >
            <option value="2d">🎬 מפה דו-מימדית (2D)</option>
            <option value="3d">🧊 מפה תלת-מימדית (3D)</option>
          </select>
          <button onClick={publish} className="btn-plastic !px-3 !py-1 text-xs">🚀 פרסום</button>
          <LanguageSwitcher />
          <Link to="/owner" className="chrome-panel px-3 py-1">← {t("owner.title")}</Link>
          <Link to="/play" className="chrome-panel px-3 py-1">{t("owner.enter")}</Link>
        </div>
      </div>

      {is3D ? (
        map && version ? (
          <Map3DEditor
            map={map as unknown as Parameters<typeof Map3DEditor>[0]["map"]}
            versionId={version.id}
            objects={objects as unknown as Parameters<typeof Map3DEditor>[0]["objects"]}
            stores={stores}
            npcs={npcs}
            maps={maps as unknown as Array<{ id: string; name: string }>}
          />
        ) : (
          <div className="chrome-panel grid flex-1 place-items-center text-sm">{t("common.loading")}</div>
        )
      ) : (
      <div className="grid gap-3 lg:grid-cols-[300px_1fr_280px] flex-1 min-h-0 overflow-hidden">

        <aside className="space-y-3 h-full overflow-y-auto pr-1">
          <div className="chrome-panel p-3">
            <label className="mb-1 block text-xs font-bold">מפה</label>
            <select value={mapId ?? ""} onChange={(e) => setMapId(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-2 text-sm">
              {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>


          <div className="chrome-panel p-3">
            <div className="mb-2 text-xs font-bold">כלים</div>
            <div className="grid grid-cols-2 gap-1">
              {(["select","platform","floor","store","npc","door","decor","screen","treasure","spawn"] as Tool[]).map((tk) => (
                <button
                  key={tk}
                  onClick={() => { setTool(tk); setSelectedId(null); }}
                  className={`chrome-panel px-2 py-1 text-xs ${tool === tk ? "ring-2 ring-primary bg-primary/10" : ""}`}
                >
                  {toolLabel(tk)}
                </button>
              ))}
            </div>

            {(tool === "platform" || tool === "floor") && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-bold">סגנון רצפה</label>
                <select value={floorStyle} onChange={(e) => setFloorStyle(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-sm">
                  {Object.entries(FLOOR_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}

            {tool === "decor" && (
              <div className="mt-2 space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">סוג תפאורה</label>
                  <select value={decorPreset} onChange={(e) => setDecorPreset(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-sm">
                    {Object.entries(DECOR_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
                <ImageUpload value={decorSprite} onChange={setDecorSprite} folder="decor" label="תמונה/GIF (אופציונלי)" />
              </div>
            )}

            {tool === "treasure" && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-bold">תיבת אוצר</label>
                <select value={treasureId} onChange={(e) => setTreasureId(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-sm">
                  <option value="">בחרו תיבה…</option>
                  {treasureBoxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {tool === "screen" && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold">מצב מידות
                    <select value={screenSizeMode} onChange={(e) => setScreenSizeMode(e.target.value as "ratio" | "pixels")} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-2 py-1 text-xs">
                      <option value="ratio">יחס גובה-רוחב</option>
                      <option value="pixels">פיקסלים</option>
                    </select>
                  </label>
                  {screenSizeMode === "ratio" ? (
                    <label className="text-xs font-bold">יחס
                      <select value={screenRatio} onChange={(e) => setScreenRatio(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-2 py-1 text-xs">
                        {Object.entries(SCREEN_RATIOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label className="text-xs font-bold">גובה (px)
                      <input type="number" value={screenPxH} onChange={(e) => setScreenPxH(parseInt(e.target.value, 10) || 0)} className="mt-1 w-full rounded-xl border-2 border-border bg-input px-2 py-1 text-xs" />
                    </label>
                  )}
                </div>
                <label className="block text-xs font-bold">רוחב (px)
                  <input
                    type="number"
                    value={screenSizeMode === "pixels" ? screenPxW : screenBaseW}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) || 0;
                      if (screenSizeMode === "pixels") setScreenPxW(v); else setScreenBaseW(v);
                    }}
                    className="mt-1 w-full rounded-xl border-2 border-border bg-input px-2 py-1 text-xs"
                  />
                </label>
                <div className="text-[11px] text-muted-foreground">
                  התמונה/GIF תימתח בדיוק לגודל המסך שקבעתם.
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold">סוג תוכן</label>
                  <select value={screenContentType} onChange={(e) => setScreenContentType(e.target.value as "text" | "image")} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-sm">
                    <option value="text">טקסט</option>
                    <option value="image">תמונה/GIF</option>
                  </select>
                </div>
                {screenContentType === "text" ? (
                  <textarea value={screenText} onChange={(e) => setScreenText(e.target.value)} rows={2} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-xs" placeholder="טקסט שיוצג במסך" />
                ) : (
                  <ImageUpload value={screenImage} onChange={setScreenImage} folder="screens" label="תמונה/GIF" />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">רקע<input type="color" value={screenBg} onChange={(e) => setScreenBg(e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                  <label className="text-xs">טקסט<input type="color" value={screenFg} onChange={(e) => setScreenFg(e.target.value)} className="mt-1 h-8 w-full rounded" /></label>
                </div>
              </div>
            )}

            {tool === "store" && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-bold">חנות למיקום</label>
                <select value={pickerId} onChange={(e) => setPickerId(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-sm">
                  <option value="">— בחרו —</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {tool === "npc" && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-bold">דמות למיקום</label>
                <select value={pickerId} onChange={(e) => setPickerId(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-sm">
                  <option value="">— בחרו —</option>
                  {npcs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            )}
            {tool === "door" && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-bold">דלת ליעד</label>
                <select value={doorTarget} onChange={(e) => setDoorTarget(e.target.value)} className="w-full rounded-xl border-2 border-border bg-input px-3 py-1.5 text-sm">
                  <option value="">— בחרו מפת יעד —</option>
                  {maps.filter((m) => m.id !== mapId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="chrome-panel p-3 space-y-2">
            <button onClick={removeSelected} disabled={!selectedId} className="btn-plastic w-full text-xs disabled:opacity-40">🗑️ מחיקה של הנבחר</button>
            <button
              onClick={async () => {
                if (!map || !version) return;
                const addStr = prompt("כמה פיקסלים להוסיף לרוחב המפה?", "800");
                if (!addStr) return;
                const add = parseInt(addStr, 10);
                if (!Number.isFinite(add) || add <= 0) return;
                const oldWidth = map.width ?? 2400;
                const { error } = await supabase.from("maps").update({ width: oldWidth + add }).eq("id", map.id);
                if (error) { toast.error(error.message); return; }
                const floorY = (map.height ?? 720) - 40;
                await supabase.from("map_objects").insert({
                  map_version_id: version.id,
                  object_type: "platform",
                  x: oldWidth, y: floorY, width: add, height: 40,
                  collision: true, interactive: false, layer: 1,
                  metadata: { role: "floor", style: floorStyle }, reference_id: null,
                } as never);
                toast.success("המפה הוארכה + נוספה רצפה");
                qc.invalidateQueries({ queryKey: ["all-maps"] });
                qc.invalidateQueries({ queryKey: ["editor-objects", version.id] });
              }}
              disabled={!map}
              className="btn-plastic w-full text-xs"
            >➕ הרחב את המפה</button>
            <button onClick={publish} disabled={!version} className="btn-plastic w-full text-xs">✨ פרסום הגרסה</button>

            <div className="text-[11px] text-muted-foreground">
              סטטוס גרסה: <b>{version?.status ?? "—"}</b>
            </div>
          </div>

          <div className="chrome-panel p-3 text-xs">
            <div className="mb-1 font-bold">איך משתמשים?</div>
            בחרו כלי, ואם צריך – בחרו סגנון/פריט ולחצו על המפה כדי למקם. עם ״בחירה״ אפשר לגעת בעצם, לערוך את המאפיינים שלו בצד או למחוק.
          </div>
        </aside>

        <div className="chrome-panel p-3 flex flex-col overflow-hidden h-full min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="text-xs font-bold">תצוגת מפה</div>
            <div className="flex items-center gap-1">
              <button onClick={zoomOut} className="chrome-panel grid h-8 w-8 place-items-center text-sm" title="התרחקות">−</button>
              <button onClick={resetZoom} className="chrome-panel px-2 py-1 text-xs min-w-[3.5rem] text-center" title="איפוס זום">
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={zoomIn} className="chrome-panel grid h-8 w-8 place-items-center text-sm" title="התקרבות">+</button>
              <button onClick={fitZoom} className="chrome-panel px-2 py-1 text-xs" title="התאמה לרוחב">↔️ התאמה</button>
            </div>
          </div>
          <div
            ref={viewportRef}
            className="overflow-auto rounded-2xl border-4 border-white bg-white shadow-lg flex-1 min-h-0"
            onWheel={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.deltaY < 0) zoomIn(); else zoomOut();
              }
            }}
          >
            {map ? (
              <canvas
                ref={canvasRef}
                width={mapW}
                height={mapH}
                onClick={handleClick}
                className="block cursor-crosshair"
              />
            ) : (
              <div className="grid h-96 place-items-center text-sm text-muted-foreground">{t("common.loading")}</div>
            )}
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground shrink-0">
            {objects.length} עצמים · מפה {map?.width}×{map?.height} · זום {Math.round(zoom * 100)}%
          </div>
        </div>

        <aside className="space-y-3 h-full overflow-y-auto pl-1">
          <div className="chrome-panel p-3">
            <div className="mb-2 text-xs font-bold">מאפייני האובייקט</div>
            {!selected && <div className="text-xs text-muted-foreground">בחרו אובייקט בקנבס כדי לערוך.</div>}
            {selected && (
              <div className="space-y-2 text-xs">
                <div><b>סוג:</b> {selected.object_type}</div>
                <div className="grid grid-cols-2 gap-2">
                  <label>רוחב<input type="number" defaultValue={selected.width} onBlur={(e) => updateSelectedMeta({}, { width: parseInt(e.target.value, 10) || selected.width })} className="mt-1 w-full rounded-lg border-2 border-border bg-input px-2 py-1" /></label>
                  <label>גובה<input type="number" defaultValue={selected.height} onBlur={(e) => updateSelectedMeta({}, { height: parseInt(e.target.value, 10) || selected.height })} className="mt-1 w-full rounded-lg border-2 border-border bg-input px-2 py-1" /></label>
                </div>
                {selected.object_type === "platform" && (
                  <label className="block">סגנון
                    <select defaultValue={(selected.metadata?.style as string) || "grass"} onChange={(e) => updateSelectedMeta({ style: e.target.value })} className="mt-1 w-full rounded-lg border-2 border-border bg-input px-2 py-1">
                      {Object.entries(FLOOR_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                )}
                {selected.object_type === "decor" && (
                  <>
                    <label className="block">תפאורה
                      <select defaultValue={(selected.metadata?.preset as string) || "tree"} onChange={(e) => updateSelectedMeta({ preset: e.target.value })} className="mt-1 w-full rounded-lg border-2 border-border bg-input px-2 py-1">
                        {Object.entries(DECOR_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                      </select>
                    </label>
                    <ImageUpload value={(selected.metadata?.sprite_url as string) ?? null} onChange={(url) => updateSelectedMeta({ sprite_url: url ?? undefined })} folder="decor" label="תמונה/GIF" />
                  </>
                )}
                {selected.object_type === "screen" && (
                  <>
                    <label className="block">סוג תוכן
                      <select defaultValue={(selected.metadata?.content_type as string) || "text"} onChange={(e) => updateSelectedMeta({ content_type: e.target.value })} className="mt-1 w-full rounded-lg border-2 border-border bg-input px-2 py-1">
                        <option value="text">טקסט</option>
                        <option value="image">תמונה/GIF</option>
                      </select>
                    </label>
                    {((selected.metadata?.content_type as string) || "text") === "text" ? (
                      <label className="block">טקסט
                        <textarea defaultValue={(selected.metadata?.text as string) || ""} onBlur={(e) => updateSelectedMeta({ text: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border-2 border-border bg-input px-2 py-1" />
                      </label>
                    ) : (
                      <ImageUpload value={(selected.metadata?.image_url as string) ?? null} onChange={(url) => updateSelectedMeta({ image_url: url ?? "" })} folder="screens" label="תמונה/GIF" />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label>רקע<input type="color" defaultValue={(selected.metadata?.bg as string) || "#1e1b4b"} onBlur={(e) => updateSelectedMeta({ bg: e.target.value })} className="mt-1 h-8 w-full rounded" /></label>
                      <label>טקסט<input type="color" defaultValue={(selected.metadata?.fg as string) || "#fde68a"} onBlur={(e) => updateSelectedMeta({ fg: e.target.value })} className="mt-1 h-8 w-full rounded" /></label>
                    </div>
                  </>
                )}
                {selected.object_type === "door" && (
                  <label className="block">תווית
                    <input type="text" defaultValue={(selected.metadata?.label as string) || ""} onBlur={(e) => updateSelectedMeta({ label: e.target.value })} className="mt-1 w-full rounded-lg border-2 border-border bg-input px-2 py-1" />
                  </label>
                )}
                <button onClick={removeSelected} className="btn-plastic w-full text-xs">🗑️ מחיקה</button>
              </div>
            )}
          </div>
        </aside>
      </div>
      )}

    </div>
  );
}

function toolLabel(t: Tool) {
  switch (t) {
    case "select": return "👆 בחירה";
    case "platform": return "🟪 פלטפורמה";
    case "floor": return "🟫 רצפה מלאה";
    case "store": return "🏪 חנות";
    case "npc": return "🙋 דמות";
    case "door": return "🚪 דלת";
    case "decor": return "🌸 תפאורה";
    case "screen": return "📺 מסך";
    case "treasure": return "🧰 תיבת אוצר";

    case "spawn": return "★ ספאון";
  }
}
