import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PLAYER_W, PLAYER_H, cosmeticRect, sortLayers } from "@/lib/avatar-layout";
import type { MapObject } from "@/components/game/GameViewport";
import { makeFloorCanvas, FLOOR_BASE_COLOR, FLOOR_TILE_SIZE, type FloorType } from "@/lib/floor-textures";
import { instantiateGlb, fitModel } from "@/lib/glb-loader";
import { useLivePositions } from "@/hooks/use-live-positions";

type THREE_NS = typeof import("three");

type StoreRef = { id: string; slug: string; name: string; store_type: string; image_url?: string | null };
type NpcRef = {
  id: string; slug: string; name: string;
  sprite_url?: string | null; sprite_left_url?: string | null;
  sprite_right_url?: string | null; sprite_jump_url?: string | null;
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
  floorType?: string | null;
  floorColor?: string | null;
  floorTextureUrl?: string | null;
  touchInputRef?: MutableRefObject<{ x: number; y?: number; jump: boolean }>;
  onInteract?: (kind: "store" | "npc" | "door" | "treasure", id: string, extra?: { targetMapId?: string }) => void;
  onNearby?: (n: Nearby) => void;
};

type EquippedCosmetic = {
  id: string; layer_type: string;
  sprite_left_url: string | null; sprite_right_url: string | null;
  offset_x: number; offset_y: number; scale: number; layer_order: number;
};

type Look = { idle: string | null; right: string | null; left: string | null; cosmetics: EquippedCosmetic[] };
type OtherPlayer = { user_id: string; x: number; y: number; username?: string; character_id?: string | null; avatar_config?: Record<string, string> | null };

const SPEED = 4.6;
const NEAR_DIST = 190;
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

/** Composites base sprite + cosmetics into a canvas we can use as a 3D billboard texture. */
function paintAvatar(canvas: HTMLCanvasElement, look: Look, facing: "left" | "right") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const box = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const ordered = sortLayers(look.cosmetics);

  const drawPiece = (c: EquippedCosmetic) => {
    const url = facing === "right" ? c.sprite_right_url : (c.sprite_left_url ?? c.sprite_right_url);
    const img = getImg(url);
    if (!img || !img.complete || !img.naturalWidth) return;
    const r = cosmeticRect(c, box);
    const ratio = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight);
    const dw = img.naturalWidth * ratio;
    const dh = img.naturalHeight * ratio;
    const dx = r.x + (r.w - dw) / 2;
    const dy = r.y + (r.h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  for (const c of ordered) if (cosmeticRect(c, box).behind) drawPiece(c);

  const baseUrl = facing === "right" ? (look.right ?? look.idle) : (look.left ?? look.idle ?? look.right);
  const base = getImg(baseUrl);
  if (base && base.complete && base.naturalWidth) {
    const ratio = Math.min(canvas.width / base.naturalWidth, canvas.height / base.naturalHeight);
    const dw = base.naturalWidth * ratio;
    const dh = base.naturalHeight * ratio;
    ctx.drawImage(base, (canvas.width - dw) / 2, canvas.height - dh, dw, dh);
  } else {
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height * 0.22, canvas.width * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(canvas.width * 0.28, canvas.height * 0.38, canvas.width * 0.44, canvas.height * 0.5);
  }

  for (const c of ordered) if (!cosmeticRect(c, box).behind) drawPiece(c);
}

function labelCanvas(text: string, color = "#3b1f4a") {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 56px Fredoka, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.min(500, ctx.measureText(text).width + 60);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  const x = (c.width - w) / 2;
  ctx.roundRect(x, 20, w, 88, 40);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, c.width / 2, 66);
  return c;
}

export function Game3DViewport({
  width, height,
  viewportWidth = 1280, viewportHeight = 720,
  mapId, objects, stores, npcs,
  isPublicRoom = false, backgroundColor, floorType, floorColor, floorTextureUrl,
  touchInputRef, onInteract, onNearby,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const live = useLivePositions(mapId, !!isPublicRoom, user?.id);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const [otherLooks, setOtherLooks] = useState<Record<string, Look>>({});
  const [otherModels, setOtherModels] = useState<Record<string, string>>({});

  const [equipped, setEquipped] = useState<EquippedCosmetic[]>([]);
  const [characterSprites, setCharacterSprites] = useState<{ right: string | null; left: string | null; idle: string | null } | null>(null);
  const [characterModelUrl, setCharacterModelUrl] = useState<string | null>(null);
  const [cosmeticModelUrls, setCosmeticModelUrls] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Live refs consumed by the render loop (avoids rebuilding the scene).
  const othersRef = useRef<OtherPlayer[]>([]);
  const looksRef = useRef<Record<string, Look>>({});
  const otherModelsRef = useRef<Record<string, string>>({});

  const myLookRef = useRef<Look>({ idle: null, right: null, left: null, cosmetics: [] });
  const nearbyRef = useRef<string | null>(null);
  const onNearbyRef = useRef(onNearby);
  const onInteractRef = useRef(onInteract);
  const [pov, setPov] = useState(false);
  const povRef = useRef(false);
  povRef.current = pov;

  othersRef.current = others;
  looksRef.current = otherLooks;
  otherModelsRef.current = otherModels;

  myLookRef.current = {
    idle: characterSprites?.idle ?? null,
    right: characterSprites?.right ?? null,
    left: characterSprites?.left ?? null,
    cosmetics: equipped,
  };
  onNearbyRef.current = onNearby;
  onInteractRef.current = onInteract;

  // ---- base character sprites
  useEffect(() => {
    const cid = (profile as unknown as { character_id?: string | null } | null)?.character_id;
    if (!cid) { setCharacterSprites(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("characters")
        .select("sprite_right_url, sprite_left_url, image_url, model_3d_url").eq("id", cid).maybeSingle();
      if (cancelled || !data) return;
      const d = data as { sprite_right_url: string | null; sprite_left_url: string | null; image_url: string | null; model_3d_url: string | null };
      setCharacterSprites({ right: d.sprite_right_url ?? d.image_url, left: d.sprite_left_url, idle: d.image_url ?? d.sprite_right_url });
      setCharacterModelUrl(d.model_3d_url ?? null);
    })();
    return () => { cancelled = true; };
  }, [profile]);

  // ---- equipped cosmetics
  useEffect(() => {
    const conf = (profile?.avatar_config ?? {}) as Record<string, string>;
    const ids = Object.values(conf).filter(Boolean);
    if (!ids.length) { setEquipped([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("cosmetics")
        .select("id, layer_type, layer_order, sprite_left_url, sprite_right_url, offset_x, offset_y, scale, model_3d_url").in("id", ids);
      if (cancelled || !data) return;
      setCosmeticModelUrls(
        (data as unknown as Array<{ model_3d_url: string | null }>).map((c) => c.model_3d_url).filter((u): u is string => !!u),
      );
      setEquipped((data as unknown as Array<Record<string, never>>).map((c) => {
        const r = c as unknown as { id: string; layer_type: string; sprite_left_url: string | null; sprite_right_url: string | null; offset_x: number | null; offset_y: number | null; scale: number | null; layer_order: number | null };
        return {
          id: r.id, layer_type: r.layer_type,
          sprite_left_url: r.sprite_left_url, sprite_right_url: r.sprite_right_url,
          offset_x: r.offset_x ?? 0, offset_y: r.offset_y ?? 0, scale: r.scale ?? 1, layer_order: r.layer_order ?? 0,
        };
      }).sort((a, b) => a.layer_order - b.layer_order));
    })();
    return () => { cancelled = true; };
  }, [profile?.avatar_config]);

  // ---- multiplayer presence
  useEffect(() => {
    if (!isPublicRoom || !mapId) { setOthers([]); return; }
    let cancelled = false;
    const load = async () => {
      const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
      const { data } = await supabase.from("active_players")
        .select("user_id, x, y, last_seen").eq("map_id", mapId).gt("last_seen", cutoff);
      if (cancelled || !data) return;
      const ids = Array.from(new Set(data.map((r) => r.user_id as string)));
      const infos = new Map<string, { username?: string; avatar_config?: Record<string, string> | null; character_id?: string | null }>();
      if (ids.length) {
        const { data: ps } = await supabase.rpc("get_public_profiles", { _ids: ids });
        for (const p of (ps ?? []) as Array<{ id: string; username: string; avatar_config: unknown; character_id: string | null }>) {
          infos.set(p.id, { username: p.username, avatar_config: (p.avatar_config ?? {}) as Record<string, string>, character_id: p.character_id });
        }
      }
      setOthers(data.filter((r) => r.user_id !== user?.id).map((r) => ({
        user_id: r.user_id as string, x: r.x as number, y: r.y as number,
        username: infos.get(r.user_id as string)?.username,
        avatar_config: infos.get(r.user_id as string)?.avatar_config ?? null,
        character_id: infos.get(r.user_id as string)?.character_id ?? null,
      })));
    };
    load();
    const interval = setInterval(load, 3000);
    const channel = supabase.channel(`presence3d-${mapId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "active_players", filter: `map_id=eq.${mapId}` }, () => load())
      .subscribe();
    return () => { cancelled = true; clearInterval(interval); supabase.removeChannel(channel); };
  }, [isPublicRoom, mapId, user?.id]);

  // ---- resolve other players' looks
  const othersLookKey = others.map((o) => `${o.user_id}:${o.character_id ?? ""}:${Object.values(o.avatar_config ?? {}).join(",")}`).join("|");
  useEffect(() => {
    if (!others.length) { setOtherLooks({}); setOtherModels({}); return; }
    let cancelled = false;
    (async () => {
      const charIds = Array.from(new Set(others.map((o) => o.character_id).filter(Boolean))) as string[];
      const cosIds = Array.from(new Set(others.flatMap((o) => Object.values(o.avatar_config ?? {}).filter(Boolean))));
      const [chars, cos] = await Promise.all([
        charIds.length ? supabase.from("characters").select("id, image_url, sprite_right_url, sprite_left_url, model_3d_url").in("id", charIds) : Promise.resolve({ data: [] as unknown[] }),
        cosIds.length ? supabase.from("cosmetics").select("id, layer_type, layer_order, sprite_left_url, sprite_right_url, offset_x, offset_y, scale").in("id", cosIds) : Promise.resolve({ data: [] as unknown[] }),
      ]);
      if (cancelled) return;
      const charMap = new Map((((chars.data ?? []) as Array<{ id: string; image_url: string | null; sprite_right_url: string | null; sprite_left_url: string | null; model_3d_url: string | null }>)).map((c) => [c.id, c]));
      const cosMap = new Map((((cos.data ?? []) as Array<{ id: string; layer_type: string; layer_order: number | null; sprite_left_url: string | null; sprite_right_url: string | null; offset_x: number | null; offset_y: number | null; scale: number | null }>)).map((c) => [c.id, c]));
      const next: Record<string, Look> = {};
      const models: Record<string, string> = {};
      for (const o of others) {
        const ch = o.character_id ? charMap.get(o.character_id) : undefined;
        if (ch?.model_3d_url) models[o.user_id] = ch.model_3d_url;
        next[o.user_id] = {
          idle: ch?.image_url ?? ch?.sprite_right_url ?? null,
          right: ch?.sprite_right_url ?? null,
          left: ch?.sprite_left_url ?? null,
          cosmetics: Object.values(o.avatar_config ?? {}).map((id) => cosMap.get(id)).filter(Boolean).map((c) => ({
            id: c!.id, layer_type: c!.layer_type,
            sprite_left_url: c!.sprite_left_url, sprite_right_url: c!.sprite_right_url,
            offset_x: c!.offset_x ?? 0, offset_y: c!.offset_y ?? 0, scale: c!.scale ?? 1, layer_order: c!.layer_order ?? 0,
          })),
        };
      }
      setOtherLooks(next);
      setOtherModels(models);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [othersLookKey]);


  // ---- the 3D scene
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let cleanupFns: Array<() => void> = [];

    (async () => {
      const THREE = (await import("three")) as THREE_NS;
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      const sky = backgroundColor || "#bfe9ff";
      scene.background = new THREE.Color(sky);
      scene.fog = new THREE.Fog(new THREE.Color(sky).getHex(), 1800, 4200);

      const camera = new THREE.PerspectiveCamera(52, viewportWidth / viewportHeight, 1, 8000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(viewportWidth, viewportHeight, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const dom = renderer.domElement;
      dom.style.width = "100%";
      dom.style.height = "auto";
      dom.style.display = "block";
      dom.style.borderRadius = "24px";
      dom.style.cursor = "pointer";
      host.appendChild(dom);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x9bbcd8, 1.05));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
      sun.position.set(-600, 1400, 900);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -2000; sun.shadow.camera.right = 2000;
      sun.shadow.camera.top = 2000; sun.shadow.camera.bottom = -2000;
      sun.shadow.camera.far = 5000;
      scene.add(sun);
      scene.add(sun.target);

      // ground
      const ft = ((floorType || "grass") as FloorType);
      const groundMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
      if (ft === "custom" && floorTextureUrl) {
        const tex = new THREE.TextureLoader().load(floorTextureUrl);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        const tile = FLOOR_TILE_SIZE.custom;
        tex.repeat.set(Math.max(1, width / tile), Math.max(1, height / tile));
        groundMat.map = tex;
      } else {
        const tex = new THREE.CanvasTexture(makeFloorCanvas(ft, floorColor));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        const tile = FLOOR_TILE_SIZE[ft] ?? 320;
        tex.repeat.set(Math.max(1, width / tile), Math.max(1, height / tile));
        groundMat.map = tex;
        groundMat.color = new THREE.Color(0xffffff);
      }
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, height), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(width / 2, 0, height / 2);
      ground.receiveShadow = true;
      scene.add(ground);

      const grid = new THREE.GridHelper(Math.max(width, height), Math.round(Math.max(width, height) / 200), 0xffffff, 0xffffff);
      (grid.material as { opacity: number; transparent: boolean }).opacity = 0.12;
      (grid.material as { transparent: boolean }).transparent = true;
      grid.position.set(width / 2, 1, height / 2);
      if (ft === "grass") scene.add(grid);

      // walls around the map
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
      const mkWall = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 260, d), wallMat);
        m.position.set(x, 130, z);
        scene.add(m);
      };
      mkWall(width, 20, width / 2, 0);
      mkWall(width, 20, width / 2, height);
      mkWall(20, height, 0, height / 2);
      mkWall(20, height, width, height / 2);

      const loader = new THREE.TextureLoader();
      const texture = (url?: string | null) => {
        if (!url) return null;
        const t = loader.load(url);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };

      const addLabel = (text: string, x: number, y: number, z: number, scale = 1) => {
        const tex = new THREE.CanvasTexture(labelCanvas(text));
        tex.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        sp.scale.set(320 * scale, 80 * scale, 1);
        sp.position.set(x, y, z);
        scene.add(sp);
        return sp;
      };

      type Solid = { x: number; z: number; hw: number; hd: number };
      const solids: Solid[] = [];
      type IKind = "store" | "npc" | "door" | "treasure";
      type Interactive = { kind: IKind; id: string; name: string; x: number; z: number; targetMapId?: string; mesh?: object };
      const interactives: Interactive[] = [];
      const pickables: Array<{ mesh: import("three").Object3D; kind: IKind; id: string; targetMapId?: string }> = [];


      const footprint = (o: MapObject) => {
        const w = o.width || 200;
        const d = ((o as unknown as { depth?: number }).depth || 0) || Math.max(120, Math.round(w * 0.6));
        return { w, d };
      };

      for (const o of objects) {
        const { w, d } = footprint(o);
        const cx = o.x + w / 2;
        const cz = o.y + d / 2;

        if (o.object_type === "store") {
          const store = stores.find((s) => s.id === o.reference_id);
          const h = o.height || 320;
          const tex = texture(store?.image_url ?? (o.metadata?.sprite_url as string | undefined) ?? null);
          const side = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.7 });
          const front = tex
            ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })
            : new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.7 });
          const mats = [side, side, new THREE.MeshStandardMaterial({ color: 0xef4d8f, roughness: 0.6 }), side, front, side];
          const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
          box.position.set(cx, h / 2, cz);
          box.castShadow = true;
          box.receiveShadow = true;
          scene.add(box);
          // roof
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.35, 4),
            new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6 }),
          );
          roof.rotation.y = Math.PI / 4;
          roof.position.set(cx, h + h * 0.17, cz);
          roof.castShadow = true;
          scene.add(roof);
          if (store?.name) addLabel(store.name, cx, h + h * 0.42, cz, 0.9);
          solids.push({ x: cx, z: cz, hw: w / 2, hd: d / 2 });
          if (o.reference_id && store) {
            interactives.push({ kind: "store", id: o.reference_id, name: store.name, x: cx, z: cz + d / 2 });
            pickables.push({ mesh: box, kind: "store", id: o.reference_id });
          }
          continue;
        }

        if (o.object_type === "door") {
          const h = o.height || 220;
          const frame = new THREE.Group();
          const mat = new THREE.MeshStandardMaterial({ color: 0xc99c6c, roughness: 0.8 });
          const post = (dx: number) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(24, h, 24), mat);
            m.position.set(dx, h / 2, 0);
            m.castShadow = true;
            return m;
          };
          frame.add(post(-w / 2), post(w / 2));
          const top = new THREE.Mesh(new THREE.BoxGeometry(w + 24, 28, 30), mat);
          top.position.set(0, h, 0);
          top.castShadow = true;
          frame.add(top);
          const portal = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h * 0.9),
            new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
          );
          portal.position.set(0, h * 0.45, 0);
          frame.add(portal);
          frame.position.set(cx, 0, cz);
          scene.add(frame);
          const label = (o.metadata?.label as string) || "דלת";
          addLabel(label, cx, h + 70, cz, 0.8);
          interactives.push({ kind: "door", id: o.id, name: label, x: cx, z: cz, targetMapId: o.metadata?.target_map_id as string | undefined });
          pickables.push({ mesh: portal, kind: "door", id: o.id, targetMapId: o.metadata?.target_map_id as string | undefined });
          continue;
        }

        if (o.object_type === "npc") {
          const npc = npcs.find((n) => n.id === o.reference_id);
          const tex = texture(npc?.sprite_url ?? npc?.sprite_right_url ?? null);
          const h = o.height || 140;
          const mesh = tex
            ? new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
            : new THREE.Mesh(new THREE.CapsuleGeometry(28, h * 0.5, 6, 12), new THREE.MeshStandardMaterial({ color: 0xa78bfa }));
          if (mesh instanceof THREE.Sprite) {
            mesh.scale.set(h * 0.7, h, 1);
            mesh.position.set(cx, h / 2, cz);
          } else {
            mesh.position.set(cx, h / 2, cz);
            mesh.castShadow = true;
          }
          scene.add(mesh);
          if (npc?.name) addLabel(npc.name, cx, h + 50, cz, 0.75);
          if (o.reference_id && npc) {
            interactives.push({ kind: "npc", id: o.reference_id, name: npc.name, x: cx, z: cz });
            pickables.push({ mesh, kind: "npc", id: o.reference_id });
          }
          continue;
        }

        if (o.object_type === "treasure" && o.reference_id) {
          const h = o.height || 90;
          const label = (o.metadata?.label as string) || "תיבת אוצר";
          const chest = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.9, h * 0.6, d * 0.7),
            new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6, metalness: 0.2 }),
          );
          body.position.y = h * 0.3;
          body.castShadow = true;
          const lid = new THREE.Mesh(
            new THREE.CylinderGeometry(h * 0.3, h * 0.3, w * 0.9, 16, 1, false, 0, Math.PI),
            new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, metalness: 0.35 }),
          );
          lid.rotation.z = Math.PI / 2;
          lid.position.y = h * 0.6;
          lid.castShadow = true;
          const lock = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.12, h * 0.22, 6),
            new THREE.MeshStandardMaterial({ color: 0xfde68a, metalness: 0.7, roughness: 0.3 }),
          );
          lock.position.set(0, h * 0.34, d * 0.36);
          chest.add(body, lid, lock);
          chest.position.set(cx, 0, cz);
          scene.add(chest);
          addLabel(label, cx, h + 60, cz, 0.8);
          interactives.push({ kind: "treasure", id: o.reference_id, name: label, x: cx, z: cz });
          pickables.push({ mesh: chest, kind: "treasure", id: o.reference_id });
          continue;
        }


        if (o.object_type === "platform" || o.object_type === "wall") {
          const h = o.object_type === "wall" ? (o.height || 200) : 24;
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: o.object_type === "wall" ? 0x9ca3af : 0x86efac, roughness: 0.9 }),
          );
          box.position.set(cx, h / 2, cz);
          box.castShadow = o.object_type === "wall";
          box.receiveShadow = true;
          scene.add(box);
          if (o.collision) solids.push({ x: cx, z: cz, hw: w / 2, hd: d / 2 });
          continue;
        }

        if (o.object_type === "decor") {
          const tex = texture(o.metadata?.sprite_url ?? null);
          const h = o.height || 120;
          if (tex) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
            sp.scale.set(h, h, 1);
            sp.position.set(cx, h / 2, cz);
            scene.add(sp);
          } else {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, h * 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x8b5a3c }));
            trunk.position.set(cx, h * 0.25, cz);
            const crown = new THREE.Mesh(new THREE.SphereGeometry(h * 0.35, 12, 12), new THREE.MeshStandardMaterial({ color: 0x22c55e }));
            crown.position.set(cx, h * 0.62, cz);
            crown.castShadow = true;
            scene.add(trunk, crown);
          }
          continue;
        }

        if (o.object_type === "screen") {
          const h = o.height || 160;
          const tex = texture(o.metadata?.image_url as string | undefined);
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 16),
            tex
              ? new THREE.MeshStandardMaterial({ map: tex })
              : new THREE.MeshStandardMaterial({ color: new THREE.Color((o.metadata?.bg as string) || "#1e1b4b") }),
          );
          panel.position.set(cx, h / 2 + 60, cz);
          panel.castShadow = true;
          scene.add(panel);
          if (!tex && o.metadata?.text) addLabel(String(o.metadata.text), cx, h + 90, cz, 0.8);
        }
      }

      // ---- player
      const spawn = objects.find((o) => o.object_type === "spawn");
      const player = {
        x: spawn ? spawn.x : width / 2,
        z: spawn ? spawn.y : height / 2,
        facing: "right" as "left" | "right",
        lastSave: 0,
      };

      const mkAvatar = () => {
        const canvas = document.createElement("canvas");
        canvas.width = PLAYER_W * 2;
        canvas.height = PLAYER_H * 2;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sp.scale.set(PLAYER_W * 1.6, PLAYER_H * 1.6, 1);
        scene.add(sp);
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(PLAYER_W * 0.5, 20),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
        );
        shadow.rotation.x = -Math.PI / 2;
        scene.add(shadow);
        return { canvas, tex, sp, shadow };
      };

      const me = mkAvatar();
      // Real 3D model for the player when the character has one.
      let meModel: import("three").Group | null = null;
      if (characterModelUrl) {
        (async () => {
          const g = await instantiateGlb(characterModelUrl);
          if (!g || disposed) return;
          await fitModel(g, PLAYER_H * 1.6);
          scene.add(g);
          meModel = g;
          me.sp.visible = false;
          for (const url of cosmeticModelUrls) {
            const cg = await instantiateGlb(url);
            if (!cg || disposed) continue;
            await fitModel(cg, PLAYER_H * 1.6);
            g.add(cg);
          }
        })();
      }
      const meLabel = addLabel(profile?.username ?? "אני", 0, 0, 0, 0.7);
      const otherAvatars = new Map<string, ReturnType<typeof mkAvatar> & { label: import("three").Sprite; name: string }>();
      const otherModelState = new Map<string, import("three").Group | null>();


      // ---- input
      const keys: Record<string, boolean> = {};
      const onKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
      const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      cleanupFns.push(() => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); });

      // camera distance + orbit
      const cam = { dist: 1100, yaw: 0, pitch: 0.95, look: 0 };
      const wheel = (e: WheelEvent) => {
        e.preventDefault();
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
        cam.dist = Math.max(420, Math.min(2600, cam.dist * Math.exp(dy * 0.0015)));
      };
      dom.addEventListener("wheel", wheel, { passive: false });
      cleanupFns.push(() => dom.removeEventListener("wheel", wheel));

      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let startYaw = 0;
      let startLook = 0;
      let moved = false;
      const onDown = (e: PointerEvent) => {
        dragging = true; moved = false;
        dragStartX = e.clientX; dragStartY = e.clientY;
        startYaw = cam.yaw; startLook = cam.look;
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        if (Math.abs(e.clientX - dragStartX) > 4 || Math.abs(e.clientY - dragStartY) > 4) moved = true;
        cam.yaw = startYaw + (e.clientX - dragStartX) * 0.005;
        if (povRef.current) {
          cam.look = Math.max(-0.9, Math.min(0.9, startLook - (e.clientY - dragStartY) * 0.004));
        }
      };
      const onUp = () => { dragging = false; };
      dom.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      cleanupFns.push(() => {
        dom.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      });

      // click to interact (raycast)
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onClick = (e: MouseEvent) => {
        if (moved) return;
        const rect = dom.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(pickables.map((p) => p.mesh), true);
        if (!hits.length) return;
        const target = pickables.find((p) => p.mesh === hits[0].object || (p.mesh as { children?: unknown[] }).children?.includes(hits[0].object));
        if (target) onInteractRef.current?.(target.kind, target.id, target.targetMapId ? { targetMapId: target.targetMapId } : undefined);
      };
      dom.addEventListener("click", onClick);
      cleanupFns.push(() => dom.removeEventListener("click", onClick));

      setReady(true);

      let frame = 0;
      const step = () => {
        if (disposed) return;
        frame++;

        // movement (world axes; up = away from camera)
        let ix = 0, iz = 0;
        if (keys["arrowleft"] || keys["a"]) ix -= 1;
        if (keys["arrowright"] || keys["d"]) ix += 1;
        if (keys["arrowup"] || keys["w"]) iz -= 1;
        if (keys["arrowdown"] || keys["s"]) iz += 1;
        const touch = touchInputRef?.current;
        if (touch) {
          if (Math.abs(touch.x) > 0.15) ix += touch.x;
          if (typeof touch.y === "number" && Math.abs(touch.y) > 0.15) iz += touch.y;
        }
        const len = Math.hypot(ix, iz);
        if (len > 0) {
          const nx = (ix / len) * SPEED;
          const nz = (iz / len) * SPEED;
          // rotate input by camera yaw so movement matches the view
          const cos = Math.cos(cam.yaw), sin = Math.sin(cam.yaw);
          const dx = nx * cos - nz * sin;
          const dz = nx * sin + nz * cos;
          let px = player.x + dx;
          let pz = player.z + dz;
          const r = PLAYER_W * 0.35;
          for (const s of solids) {
            if (Math.abs(px - s.x) < s.hw + r && Math.abs(pz - s.z) < s.hd + r) {
              if (Math.abs(player.x - s.x) >= s.hw + r) px = player.x;
              if (Math.abs(player.z - s.z) >= s.hd + r) pz = player.z;
            }
          }
          player.x = Math.max(30, Math.min(width - 30, px));
          player.z = Math.max(30, Math.min(height - 30, pz));
          if (Math.abs(dx) > 0.4) player.facing = dx > 0 ? "right" : "left";
        }

        // avatar billboard (hidden in first-person)
        const firstPerson = povRef.current;
        me.sp.visible = !firstPerson;
        meLabel.visible = !firstPerson;
        if (!firstPerson && frame % 4 === 0) {
          paintAvatar(me.canvas, myLookRef.current, player.facing);
          me.tex.needsUpdate = true;
        }
        me.sp.position.set(player.x, PLAYER_H * 0.8, player.z);
        if (meModel) {
          me.sp.visible = false;
          meModel.visible = !firstPerson;
          meModel.position.set(player.x, 0, player.z);
          meModel.rotation.y = player.facing === "right" ? Math.PI / 2 : -Math.PI / 2;
        }
        me.shadow.position.set(player.x, 2, player.z);
        meLabel.position.set(player.x, PLAYER_H * 1.75, player.z);

        // other players
        const seen = new Set<string>();
        for (const o of othersRef.current) {
          seen.add(o.user_id);
          let av = otherAvatars.get(o.user_id);
          if (!av) {
            const base = mkAvatar();
            const label = addLabel(o.username ?? "שחקן", 0, 0, 0, 0.7);
            av = { ...base, label, name: o.username ?? "" };
            otherAvatars.set(o.user_id, av);
          }
          // Load a real 3D model for this player once, when their character has one.
          const modelUrl = otherModelsRef.current[o.user_id];
          if (modelUrl && !otherModelState.has(o.user_id)) {
            otherModelState.set(o.user_id, null);
            (async () => {
              const g = await instantiateGlb(modelUrl);
              if (!g || disposed) return;
              await fitModel(g, PLAYER_H * 1.6);
              scene.add(g);
              otherModelState.set(o.user_id, g);
            })();
          }
          const lp = liveRef.current.sample(o.user_id);
          const ox = lp?.x ?? o.x;
          const oz = lp?.y ?? o.y;
          const oFacing = lp?.facing ?? "right";
          const model = otherModelState.get(o.user_id) ?? null;
          if (model) {
            av.sp.visible = false;
            model.position.set(ox, 0, oz);
            model.rotation.y = oFacing === "right" ? Math.PI / 2 : -Math.PI / 2;
          } else if (frame % 8 === 0) {
            paintAvatar(av.canvas, looksRef.current[o.user_id] ?? { idle: null, right: null, left: null, cosmetics: [] }, oFacing);
            av.tex.needsUpdate = true;
          }
          av.sp.position.set(ox, PLAYER_H * 0.8, oz);
          av.shadow.position.set(ox, 2, oz);
          av.label.position.set(ox, PLAYER_H * 1.75, oz);
        }
        for (const [id, av] of otherAvatars) {
          if (seen.has(id)) continue;
          scene.remove(av.sp, av.shadow, av.label);
          av.tex.dispose();
          otherAvatars.delete(id);
          const gone = otherModelState.get(id);
          if (gone) scene.remove(gone);
          otherModelState.delete(id);
        }


        // proximity
        let near: Interactive | null = null;
        let bestDist = NEAR_DIST;
        for (const it of interactives) {
          const dist = Math.hypot(it.x - player.x, it.z - player.z);
          if (dist < bestDist) { bestDist = dist; near = it; }
        }
        const key = near ? `${near.kind}:${near.id}` : null;
        if (key !== nearbyRef.current) {
          nearbyRef.current = key;
          onNearbyRef.current?.(near ? { kind: near.kind, id: near.id, name: near.name, targetMapId: near.targetMapId } as Nearby : null);
        }

        // camera follow / POV
        if (povRef.current) {
          const eye = PLAYER_H * 1.45;
          const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
          camera.position.set(player.x + fx * 12, eye, player.z + fz * 12);
          camera.lookAt(player.x + fx * 600, eye + cam.look * 600, player.z + fz * 600);
        } else {
          camera.position.set(
            player.x - Math.sin(cam.yaw) * cam.dist * Math.cos(cam.pitch),
            cam.dist * Math.sin(cam.pitch),
            player.z + Math.cos(cam.yaw) * cam.dist * Math.cos(cam.pitch),
          );
          camera.lookAt(player.x, PLAYER_H * 0.6, player.z);
        }
        sun.position.set(player.x - 600, 1400, player.z + 900);
        sun.target.position.set(player.x, 0, player.z);
        sun.target.updateMatrixWorld();

        // realtime broadcast (~16/sec) + low-frequency DB persistence
        const now = performance.now();
        liveRef.current.send(player.x, player.z, player.facing === "left" ? "left" : "right", len > 0);
        if (user && mapId && now - player.lastSave > 5000) {
          player.lastSave = now;
          supabase.from("active_players").upsert({
            user_id: user.id, map_id: mapId, x: Math.round(player.x), y: Math.round(player.z), last_seen: new Date().toISOString(),
          } as never, { onConflict: "user_id" }).then(() => {});
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);

      cleanupFns.push(() => {
        cancelAnimationFrame(raf);
        renderer.dispose();
        dom.remove();
      });
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanupFns.forEach((f) => f());
      cleanupFns = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, viewportWidth, viewportHeight, mapId, objects, stores, npcs, backgroundColor, floorType, floorColor, floorTextureUrl, characterModelUrl, cosmeticModelUrls]);

  return (
    <div className="relative w-full">
      <div
        ref={hostRef}
        className="w-full overflow-hidden rounded-3xl border-4 border-white shadow-[0_18px_60px_-20px_rgba(236,72,153,0.55)]"
        style={{ aspectRatio: `${viewportWidth} / ${viewportHeight}` }}
      />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center rounded-3xl bg-gradient-to-b from-sky-100 to-pink-100 text-sm font-bold">
          טוען עולם תלת מימד…
        </div>
      )}
      <div className="pointer-events-none absolute start-3 top-3 rounded-full border-2 border-white bg-white/80 px-3 py-1 text-[10px] font-black shadow md:text-xs">
        {pov
          ? "👁️ מצב ראייה ראשונה · WASD/חצים לתנועה · גרירה להסתכלות"
          : "🧭 3D · WASD/חצים לתנועה · גרירה לסיבוב · גלגלת לזום"}
      </div>
      <button
        type="button"
        onClick={() => setPov((v) => !v)}
        aria-pressed={pov}
        className={`absolute end-3 top-3 rounded-full border-2 border-white px-3 py-1.5 text-[11px] font-black shadow-lg transition active:scale-95 md:text-sm ${
          pov ? "bg-fuchsia-600 text-primary-foreground" : "bg-white/85 text-foreground"
        }`}
      >
        {pov ? "🚁 חזרה למצב מלמעלה" : "👁️ מצב POV"}
      </button>
    </div>
  );
}
