import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { MapObject } from "@/components/game/GameViewport";
import { useLivePositions } from "@/hooks/use-live-positions";
import { Sparkles, MessageCircle, Store, DoorOpen, Gift, Monitor, Box, ZoomIn, ZoomOut, RotateCcw, RotateCw, User, Compass } from "lucide-react";
import { ALL_DECOR_PRESETS, type DecorPresetItem } from "@/lib/decor-catalog";
import { buildDecor3DGroup } from "@/lib/decor-3d-builder";
import { createConventionCharacter3D, type Character3DInstance } from "@/lib/character-3d";
import { makeFloorCanvas, FLOOR_TILE_SIZE, type FloorType } from "@/lib/floor-textures";
import { instantiateGlb, fitModel } from "@/lib/glb-loader";
import { PLAYER_W, PLAYER_H } from "@/lib/avatar-layout";
import { FogOfWarMinimap } from "@/components/game/FogOfWarMinimap";
import {
  loadDiscoveredCells,
  saveDiscoveredCells,
  revealFogCircle,
  FOW_CELL_SIZE,
  FOW_REVEAL_RADIUS,
} from "@/lib/fog-of-war";

type THREE_NS = typeof import("three");

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
  | { kind: "screen"; id: string; name: string; text?: string; imageUrl?: string | null }
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
  backgroundTheme?: string | null;
  floorType?: string | null;
  floorColor?: string | null;
  floorTextureUrl?: string | null;
  touchInputRef?: MutableRefObject<{ x: number; y?: number; jump: boolean }>;
  onInteract?: (kind: "store" | "npc" | "door" | "treasure" | "screen", id: string, extra?: { targetMapId?: string; title?: string; text?: string; imageUrl?: string | null }) => void;
  onNearby?: (n: Nearby) => void;
  onInspectPlayer?: (player: OtherPlayer) => void;
};

type OtherPlayer = {
  user_id: string;
  x: number;
  y: number;
  username?: string;
  character_id?: string | null;
  avatar_config?: Record<string, string> | null;
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

export function CoolEnvironmentViewport({
  width,
  height,
  viewportWidth = 1280,
  viewportHeight = 720,
  mapId,
  objects = [],
  stores = [],
  npcs = [],
  isPublicRoom = true,
  backgroundColor,
  backgroundTheme = "cyber_arcade",
  floorType = "wood",
  floorColor = null,
  floorTextureUrl = null,
  touchInputRef,
  onInteract,
  onNearby,
  onInspectPlayer,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const live = useLivePositions(mapId, !!isPublicRoom, user?.id);
  const liveRef = useRef(live);
  liveRef.current = live;

  const worldW = width || 2400;
  const worldD = height || 1800;

  const [activeNearby, setActiveNearby] = useState<Nearby>(null);
  const activeNearbyRef = useRef<Nearby>(null);
  activeNearbyRef.current = activeNearby;

  const onNearbyRef = useRef(onNearby);
  const onInteractRef = useRef(onInteract);
  onNearbyRef.current = onNearby;
  onInteractRef.current = onInteract;

  // Zoom state (further back view by default)
  const DEFAULT_ZOOM = 1.0;
  const [zoomFactor, setZoomFactor] = useState<number>(DEFAULT_ZOOM);
  const zoomFactorRef = useRef<number>(DEFAULT_ZOOM);
  zoomFactorRef.current = zoomFactor;

  // Fog of War (Heroes of Might & Magic style persistence per user & map)
  const [discoveredCells, setDiscoveredCells] = useState<Set<number>>(() => loadDiscoveredCells(user?.id, mapId));
  const discoveredCellsRef = useRef(discoveredCells);
  discoveredCellsRef.current = discoveredCells;

  useEffect(() => {
    const loaded = loadDiscoveredCells(user?.id, mapId);
    setDiscoveredCells(loaded);
    discoveredCellsRef.current = loaded;
  }, [user?.id, mapId]);

  // Maps list for minimap portal labels
  const [mapsList, setMapsList] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    supabase.from("maps").select("id, name").then(({ data }) => {
      if (data) setMapsList(data);
    });
  }, []);

  // Camera orbital rotation (Q / E 360-degree smooth perspective)
  const [camAngle, setCamAngle] = useState<number>(0);
  const camAngleRef = useRef<number>(0);
  camAngleRef.current = camAngle;

  // Realtime Player HUD coordinates for Minimap
  const [hudPlayer, setHudPlayer] = useState({ x: 300, z: 300, facing: 0 });

  // Rotate Camera Helpers
  const handleRotateLeft = () => {
    camAngleRef.current -= Math.PI / 6;
    setCamAngle(camAngleRef.current);
  };
  const handleRotateRight = () => {
    camAngleRef.current += Math.PI / 6;
    setCamAngle(camAngleRef.current);
  };
  const handleResetCamera = () => {
    camAngleRef.current = 0;
    setCamAngle(0);
  };

  // In 2.5D Cool Environment, ALL players (local and remote) uniformly embody
  // the official Colt Bot mascot with the iconic purple hoodie and golden "C" emblem.
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const othersRef = useRef<OtherPlayer[]>([]);
  othersRef.current = others;

  useEffect(() => {
    if (!isPublicRoom || !mapId) {
      setOthers([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const cutoff = new Date(Date.now() - 90 * 1000).toISOString();
      const { data } = await supabase
        .from("active_players")
        .select("user_id, x, y, last_seen")
        .eq("map_id", mapId)
        .gt("last_seen", cutoff);
      if (cancelled || !data) return;
      const ids = Array.from(new Set(data.map((r) => r.user_id as string)));
      const usernames = new Map<string, string>();
      if (ids.length) {
        const { data: ps } = await supabase.rpc("get_public_profiles", { _ids: ids });
        for (const p of (ps ?? []) as Array<{ id: string; username: string }>) {
          usernames.set(p.id, p.username);
        }
      }
      setOthers(
        data
          .filter((r) => r.user_id !== user?.id)
          .map((r) => ({
            user_id: r.user_id as string,
            x: Number(r.x) || 0,
            y: Number(r.y) || 0,
            username: usernames.get(r.user_id as string) || "שחקן",
          }))
      );
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mapId, isPublicRoom, user?.id]);

  // Zoom Helpers
  const handleZoomIn = () => setZoomFactor((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))));
  const handleZoomOut = () => setZoomFactor((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
  const handleResetZoom = () => setZoomFactor(DEFAULT_ZOOM);

  // Three.js Cool Environment Renderer
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    const keysDown = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      keysDown.add(e.code);
      if (e.code === "KeyE" || e.code === "Space") {
        if (activeNearbyRef.current) {
          const nb = activeNearbyRef.current;
          onInteractRef.current?.(nb.kind, nb.id, {
            targetMapId: (nb as { targetMapId?: string }).targetMapId,
            title: nb.name,
            text: (nb as { text?: string }).text,
            imageUrl: (nb as { imageUrl?: string | null }).imageUrl,
          });
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysDown.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    (async () => {
      const THREE = (await import("three")) as THREE_NS;
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();

      // Atmospheric Sky & Fog
      const isCyber = backgroundTheme === "cyber_arcade";
      const isPlaza = backgroundTheme === "outdoor_plaza";
      const skyHex = isCyber ? 0x090d16 : isPlaza ? 0xcbebfb : 0x18181b;
      scene.background = new THREE.Color(skyHex);
      scene.fog = new THREE.FogExp2(skyHex, 0.00035);

      // Camera setup: Elevated 3/4 Isometric Perspective from behind the character
      const aspect = viewportWidth / viewportHeight;
      const camera = new THREE.PerspectiveCamera(42, aspect, 10, 12000);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(viewportWidth, viewportHeight, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const dom = renderer.domElement;
      dom.style.width = "100%";
      dom.style.height = "100%";
      dom.style.display = "block";
      dom.style.borderRadius = "20px";
      host.appendChild(dom);

      // Mouse Wheel Zoom
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY * 0.0012;
        setZoomFactor((z) => Math.max(0.55, Math.min(2.1, Number((z + delta).toFixed(2)))));
      };
      dom.addEventListener("wheel", onWheel, { passive: false });

      // Touch Pinch-to-Zoom
      let initialPinchDist = 0;
      let initialPinchZoom = 1;
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          initialPinchDist = Math.hypot(dx, dy);
          initialPinchZoom = zoomFactorRef.current;
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && initialPinchDist > 0) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const ratio = initialPinchDist / dist;
          setZoomFactor(Math.max(0.55, Math.min(2.1, Number((initialPinchZoom * ratio).toFixed(2)))));
        }
      };
      const onTouchEnd = () => {
        initialPinchDist = 0;
      };
      dom.addEventListener("touchstart", onTouchStart, { passive: true });
      dom.addEventListener("touchmove", onTouchMove, { passive: true });
      dom.addEventListener("touchend", onTouchEnd, { passive: true });

      // Lights
      const hemiLight = new THREE.HemisphereLight(0xffffff, isCyber ? 0x1e1b4b : 0x475569, 0.95);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(isCyber ? 0x38bdf8 : 0xfffaed, 1.45);
      dirLight.position.set(-800, 1600, 900);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.camera.left = -3000;
      dirLight.shadow.camera.right = 3000;
      dirLight.shadow.camera.top = 3000;
      dirLight.shadow.camera.bottom = -3000;
      dirLight.shadow.camera.far = 4800;
      scene.add(dirLight);

      // Cool Accent Lights
      if (isCyber) {
        const pinkLight = new THREE.PointLight(0xec4899, 2.5, 1400);
        pinkLight.position.set((width || 2400) * 0.3, 350, (height || 1800) * 0.3);
        scene.add(pinkLight);

        const cyanLight = new THREE.PointLight(0x06b6d4, 2.5, 1400);
        cyanLight.position.set((width || 2400) * 0.7, 350, (height || 1800) * 0.7);
        scene.add(cyanLight);
      }

      // Map Floor with procedural texture based on chosen floor_type
      const mapW = width || 2400;
      const mapD = height || 1800;

      const fType = (floorType as FloorType) || "wood";
      const tileUnit = FLOOR_TILE_SIZE[fType] || 320;
      let floorMat: THREE.MeshStandardMaterial;

      if (floorTextureUrl) {
        const texLoader = new THREE.TextureLoader();
        const tex = texLoader.load(floorTextureUrl);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.max(1, Math.round(mapW / tileUnit)), Math.max(1, Math.round(mapD / tileUnit)));
        tex.colorSpace = THREE.SRGBColorSpace;
        floorMat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.45,
          metalness: 0.1,
        });
      } else {
        const floorCanvas = makeFloorCanvas(fType, floorColor);
        const tex = new THREE.CanvasTexture(floorCanvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.max(1, Math.round(mapW / tileUnit)), Math.max(1, Math.round(mapD / tileUnit)));
        tex.colorSpace = THREE.SRGBColorSpace;
        floorMat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: fType === "marble" || fType === "tile" ? 0.2 : 0.6,
          metalness: fType === "marble" ? 0.2 : 0.05,
        });
      }

      const floorGeo = new THREE.PlaneGeometry(mapW, mapD);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(mapW / 2, 0, mapD / 2);
      floor.receiveShadow = true;
      scene.add(floor);

      // Floor grid lines
      const grid = new THREE.GridHelper(Math.max(mapW, mapD), 30, isCyber ? 0x38bdf8 : 0xffffff, isCyber ? 0x1e293b : 0x334155);
      grid.position.set(mapW / 2, 1, mapD / 2);
      (grid.material as { opacity: number; transparent: boolean }).opacity = 0.25;
      (grid.material as { transparent: boolean }).transparent = true;
      scene.add(grid);

      // Boundaries (Surrounding Glass/Neon Railings)
      const railMat = new THREE.MeshStandardMaterial({
        color: isCyber ? 0x38bdf8 : 0x94a3b8,
        transparent: true,
        opacity: 0.4,
        roughness: 0.2,
      });
      const addRail = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 40, d), railMat);
        m.position.set(x, 20, z);
        scene.add(m);
      };
      addRail(mapW, 10, mapW / 2, 0);
      addRail(mapW, 10, mapW / 2, mapD);
      addRail(10, mapD, 0, mapD / 2);
      addRail(10, mapD, mapW, mapD / 2);

      // Render Map Objects
      type InteractableTarget = {
        kind: "store" | "npc" | "door" | "treasure" | "screen";
        id: string;
        name: string;
        x: number;
        z: number;
        targetMapId?: string;
        text?: string;
        imageUrl?: string | null;
      };
      const interactables: InteractableTarget[] = [];
      const clickableObjects: THREE.Object3D[] = [];
      type SolidBox = { minX: number; maxX: number; minZ: number; maxZ: number };
      const solidBoxes: SolidBox[] = [];

      for (const obj of objects) {
        const meta = obj.metadata || {};
        const ow = obj.width || 120;
        const od = obj.depth || obj.height || 100;
        const oh = (meta.height_3d as number) || (obj.object_type === "store" ? 220 : 140);
        const ox = obj.x + ow / 2;
        const oz = obj.y + od / 2;

        if (obj.object_type === "room") {
          // 🏠 The Sims Style Room with Grand Solid Walls & Majestic Open Entrance Door
          const rx = obj.x;
          const rz = obj.y;
          const rw = ow;
          const rd = od;
          const wallH = (meta.wall_height as number) || 85;
          const wallCol = (meta.wall_color as string) || "#0284c7";
          const roomFlrCol = (meta.floor_color as string) || "#0f172a";
          const rName = (meta.room_name as string) || (meta.label as string) || "חדר";

          const roomGroup = new THREE.Group();

          const rFlrMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(roomFlrCol), roughness: 0.3 });
          const rFlrMesh = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), rFlrMat);
          rFlrMesh.rotation.x = -Math.PI / 2;
          rFlrMesh.position.set(rx + rw / 2, 1.5, rz + rd / 2);
          rFlrMesh.receiveShadow = true;
          roomGroup.add(rFlrMesh);

          const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallCol), roughness: 0.45 });
          const wallThick = 14;

          // North Wall (Back) - Solid
          const northWall = new THREE.Mesh(new THREE.BoxGeometry(rw, wallH, wallThick), wallMat);
          northWall.position.set(rx + rw / 2, wallH / 2, rz);
          northWall.castShadow = true;
          northWall.receiveShadow = true;
          roomGroup.add(northWall);
          solidBoxes.push({ minX: rx, maxX: rx + rw, minZ: rz - wallThick / 2, maxZ: rz + wallThick / 2 });

          // West Wall (Left) - Solid
          const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, rd), wallMat);
          westWall.position.set(rx, wallH / 2, rz + rd / 2);
          westWall.castShadow = true;
          westWall.receiveShadow = true;
          roomGroup.add(westWall);
          solidBoxes.push({ minX: rx - wallThick / 2, maxX: rx + wallThick / 2, minZ: rz, maxZ: rz + rd });

          // East Wall (Right low wall) - Solid
          const lowWallH = wallH * 0.4;
          const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lowWallH, rd), wallMat);
          eastWall.position.set(rx + rw, lowWallH / 2, rz + rd / 2);
          eastWall.castShadow = true;
          roomGroup.add(eastWall);
          solidBoxes.push({ minX: rx + rw - wallThick / 2, maxX: rx + rw + wallThick / 2, minZ: rz, maxZ: rz + rd });

          // South Wall (Front wall) with Grand Open Entrance Doorway (Tall & Wide)
          const doorW = 190;
          const sideW = Math.max(16, (rw - doorW) / 2);

          // South Left Wall - Solid
          const southLeft = new THREE.Mesh(new THREE.BoxGeometry(sideW, lowWallH, wallThick), wallMat);
          southLeft.position.set(rx + sideW / 2, lowWallH / 2, rz + rd);
          southLeft.castShadow = true;
          roomGroup.add(southLeft);
          solidBoxes.push({ minX: rx, maxX: rx + sideW, minZ: rz + rd - wallThick / 2, maxZ: rz + rd + wallThick / 2 });

          // South Right Wall - Solid
          const southRight = new THREE.Mesh(new THREE.BoxGeometry(sideW, lowWallH, wallThick), wallMat);
          southRight.position.set(rx + rw - sideW / 2, lowWallH / 2, rz + rd);
          southRight.castShadow = true;
          roomGroup.add(southRight);
          solidBoxes.push({ minX: rx + rw - sideW, maxX: rx + rw, minZ: rz + rd - wallThick / 2, maxZ: rz + rd + wallThick / 2 });

          // 🚪 Grand Open Door Frame & Door Indication (Extra Large & Tall, open, matching room wallCol)
          const doorPostH = wallH * 1.65; // Extra tall grand portal entrance
          const doorPostGeo = new THREE.BoxGeometry(14, doorPostH, wallThick + 8);
          const doorPostMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallCol), roughness: 0.25, metalness: 0.3 });

          // Left Doorpost
          const leftPost = new THREE.Mesh(doorPostGeo, doorPostMat);
          leftPost.position.set(rx + sideW, doorPostH / 2, rz + rd);
          leftPost.castShadow = true;
          roomGroup.add(leftPost);

          // Right Doorpost
          const rightPost = new THREE.Mesh(doorPostGeo, doorPostMat);
          rightPost.position.set(rx + rw - sideW, doorPostH / 2, rz + rd);
          rightPost.castShadow = true;
          roomGroup.add(rightPost);

          // Door Top Lintel & Grand Arch Beam
          const lintelGeo = new THREE.BoxGeometry(doorW + 18, 18, wallThick + 8);
          const lintel = new THREE.Mesh(lintelGeo, doorPostMat);
          lintel.position.set(rx + rw / 2, doorPostH - 9, rz + rd);
          lintel.castShadow = true;
          roomGroup.add(lintel);

          // Open Door Leaf (hinged on left doorpost, swung inward at 50° angle, tall & majestic matching wallCol)
          const doorLeafW = 85;
          const doorLeafH = doorPostH * 0.92;
          const doorLeafGeo = new THREE.BoxGeometry(doorLeafW, doorLeafH, 6);
          const doorLeafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallCol), roughness: 0.2, metalness: 0.15 });
          const doorLeaf = new THREE.Mesh(doorLeafGeo, doorLeafMat);
          doorLeaf.position.set(rx + sideW + (doorLeafW / 2) * 0.7, doorLeafH / 2, rz + rd - (doorLeafW / 2) * 0.7);
          doorLeaf.rotation.y = -Math.PI / 3.5;
          doorLeaf.castShadow = true;
          roomGroup.add(doorLeaf);

          // Golden Door Handle
          const handleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
          const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 16), handleMat);
          doorHandle.position.set(rx + sideW + doorLeafW * 0.65, doorLeafH * 0.48, rz + rd - doorLeafW * 0.65 + 4);
          doorHandle.rotation.z = Math.PI / 2;
          roomGroup.add(doorHandle);

          // Glowing Entrance Floor Threshold Strip
          const thresholdMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(wallCol), transparent: true, opacity: 0.85 });
          const thresholdMesh = new THREE.Mesh(new THREE.PlaneGeometry(doorW - 8, 22), thresholdMat);
          thresholdMesh.rotation.x = -Math.PI / 2;
          thresholdMesh.position.set(rx + rw / 2, 2.2, rz + rd);
          roomGroup.add(thresholdMesh);

          // Grand Door Sign
          const dSignCanvas = document.createElement("canvas");
          dSignCanvas.width = 300;
          dSignCanvas.height = 70;
          const dCtx = dSignCanvas.getContext("2d");
          if (dCtx) {
            dCtx.fillStyle = "rgba(15, 23, 42, 0.92)";
            safeRoundRect(dCtx, 6, 6, 288, 58, 14);
            dCtx.fill();
            dCtx.strokeStyle = wallCol;
            dCtx.lineWidth = 3;
            dCtx.stroke();
            dCtx.fillStyle = "#ffffff";
            dCtx.font = "bold 26px sans-serif";
            dCtx.textAlign = "center";
            dCtx.textBaseline = "middle";
            dCtx.fillText(`🚪 כניסה: ${rName}`, 150, 35);

            const dTex = new THREE.CanvasTexture(dSignCanvas);
            const dSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dTex, transparent: true }));
            dSprite.scale.set(130, 30, 1);
            dSprite.position.set(rx + rw / 2, doorPostH + 25, rz + rd);
            roomGroup.add(dSprite);
          }

          // Floating Room Label
          const rCanvas = document.createElement("canvas");
          rCanvas.width = 384;
          rCanvas.height = 80;
          const rCtx = rCanvas.getContext("2d");
          if (rCtx) {
            rCtx.fillStyle = "rgba(15, 23, 42, 0.75)";
            safeRoundRect(rCtx, 10, 10, 364, 60, 20);
            rCtx.fill();
            rCtx.strokeStyle = "rgba(255,255,255,0.2)";
            rCtx.lineWidth = 2;
            rCtx.stroke();
            rCtx.fillStyle = "#ffffff";
            rCtx.font = "bold 30px sans-serif";
            rCtx.textAlign = "center";
            rCtx.textBaseline = "middle";
            rCtx.fillText(`🏠 ${rName}`, 192, 40);

            const rTex = new THREE.CanvasTexture(rCanvas);
            const rSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rTex, transparent: true }));
            rSprite.scale.set(160, 35, 1);
            rSprite.position.set(rx + rw / 2, 10, rz + rd / 2);
            roomGroup.add(rSprite);
          }

          scene.add(roomGroup);
        } else if (obj.object_type === "store") {
          const sRef = stores.find((s) => s.id === obj.reference_id);
          const storeName = sRef?.name || (meta.label as string) || "חנות";
          const imageUrl = sRef?.image_url || (meta.image_url as string) || (meta.sprite_url as string);
          interactables.push({ kind: "store", id: sRef?.id || obj.id, name: storeName, x: ox, z: oz });

          const boothGroup = new THREE.Group();
          boothGroup.position.set(ox, 0, oz);
          const rotY = (meta.rotation_y as number) ?? (meta.rotation_deg ? (meta.rotation_deg as number) * (Math.PI / 180) : 0);
          boothGroup.rotation.y = rotY;

          if (imageUrl) {
            // 2.5D Single Wall Store Display (45° Isometric perspective)
            const planeW = ow || 180;
            const planeH = oh || 180;

            const texLoader = new THREE.TextureLoader();
            const storeTex = texLoader.load(imageUrl);
            storeTex.colorSpace = THREE.SRGBColorSpace;

            const storeMat = new THREE.MeshStandardMaterial({
              map: storeTex,
              transparent: true,
              alphaTest: 0.05,
              side: THREE.DoubleSide,
              roughness: 0.4,
            });

            const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), storeMat);
            wallMesh.position.y = planeH / 2;
            wallMesh.castShadow = true;
            boothGroup.add(wallMesh);

            // Ground shadow disc for realistic floor anchoring
            const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
            const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW * 0.95, od * 0.7), shadowMat);
            shadowMesh.rotation.x = -Math.PI / 2;
            shadowMesh.position.y = 1;
            boothGroup.add(shadowMesh);

            // Floating 2.5D Store Title Sign
            const signCanvas = document.createElement("canvas");
            signCanvas.width = 384;
            signCanvas.height = 96;
            const sCtx = signCanvas.getContext("2d");
            if (sCtx) {
              sCtx.fillStyle = "rgba(15, 23, 42, 0.88)";
              safeRoundRect(sCtx, 8, 8, 368, 80, 18);
              sCtx.fill();
              sCtx.strokeStyle = "#38bdf8";
              sCtx.lineWidth = 4;
              sCtx.stroke();
              sCtx.fillStyle = "#ffffff";
              sCtx.font = "bold 34px sans-serif";
              sCtx.textAlign = "center";
              sCtx.textBaseline = "middle";
              sCtx.fillText(`🏪 ${storeName}`, 192, 48);

              const signTex = new THREE.CanvasTexture(signCanvas);
              const signSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true }));
              signSprite.scale.set(160, 40, 1);
              signSprite.position.set(0, planeH + 30, 0);
              boothGroup.add(signSprite);
            }
          } else {
            // Single Wall 2.5D Default Store Stand
            const planeW = ow || 180;
            const planeH = oh || 180;

            const backWallGeo = new THREE.BoxGeometry(planeW, planeH, 12);
            const backWallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
            const backWall = new THREE.Mesh(backWallGeo, backWallMat);
            backWall.position.y = planeH / 2;
            backWall.castShadow = true;
            boothGroup.add(backWall);

            // Counter front desk
            const counter = new THREE.Mesh(new THREE.BoxGeometry(planeW * 0.9, 50, od * 0.5), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }));
            counter.position.set(0, 25, 20);
            counter.castShadow = true;
            boothGroup.add(counter);

            // Store Title Sign
            const signCanvas = document.createElement("canvas");
            signCanvas.width = 512;
            signCanvas.height = 128;
            const sCtx = signCanvas.getContext("2d");
            if (sCtx) {
              sCtx.fillStyle = "rgba(15, 23, 42, 0.92)";
              safeRoundRect(sCtx, 10, 10, 492, 108, 20);
              sCtx.fill();
              sCtx.strokeStyle = "#38bdf8";
              sCtx.lineWidth = 6;
              sCtx.stroke();
              sCtx.fillStyle = "#ffffff";
              sCtx.font = "bold 44px sans-serif";
              sCtx.textAlign = "center";
              sCtx.textBaseline = "middle";
              sCtx.fillText(`🏪 ${storeName}`, 256, 64);

              const signTex = new THREE.CanvasTexture(signCanvas);
              const signSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true }));
              signSprite.scale.set(220, 55, 1);
              signSprite.position.set(0, planeH + 35, 0);
              boothGroup.add(signSprite);
            }
          }

          boothGroup.userData = {
            interactable: { kind: "store", id: sRef?.id || obj.id, name: storeName },
          };
          clickableObjects.push(boothGroup);
          scene.add(boothGroup);

          const cosR = Math.abs(Math.cos(rotY));
          const sinR = Math.abs(Math.sin(rotY));
          const rotW = ow * cosR + (od * 0.7) * sinR;
          const rotD = ow * sinR + (od * 0.7) * cosR;
          solidBoxes.push({ minX: ox - rotW / 2, maxX: ox + rotW / 2, minZ: oz - rotD / 2, maxZ: oz + rotD / 2 });
        } else if (obj.object_type === "npc") {
          const nRef = npcs.find((n) => n.id === obj.reference_id);
          const npcName = nRef?.name || "NPC";
          interactables.push({ kind: "npc", id: nRef?.id || obj.id, name: npcName, x: ox, z: oz });

          const npcGroup = new THREE.Group();
          npcGroup.position.set(ox, 0, oz);
          const rotY = (meta.rotation_y as number) ?? (meta.rotation_deg ? (meta.rotation_deg as number) * (Math.PI / 180) : 0);
          npcGroup.rotation.y = rotY;

          const charMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.4 });
          const charBody = new THREE.Mesh(new THREE.CapsuleGeometry(20, 50, 4, 8), charMat);
          charBody.position.y = 50;
          charBody.castShadow = true;
          npcGroup.add(charBody);

          const nCanvas = document.createElement("canvas");
          nCanvas.width = 256;
          nCanvas.height = 64;
          const nCtx = nCanvas.getContext("2d");
          if (nCtx) {
            nCtx.fillStyle = "rgba(0,0,0,0.75)";
            safeRoundRect(nCtx, 10, 10, 236, 44, 16);
            nCtx.fill();
            nCtx.fillStyle = "#ffffff";
            nCtx.font = "bold 24px sans-serif";
            nCtx.textAlign = "center";
            nCtx.textBaseline = "middle";
            nCtx.fillText(`💬 ${npcName}`, 128, 32);

            const nTex = new THREE.CanvasTexture(nCanvas);
            const nSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nTex, transparent: true }));
            nSprite.scale.set(120, 30, 1);
            nSprite.position.set(0, 120, 0);
            npcGroup.add(nSprite);
          }

          npcGroup.userData = {
            interactable: { kind: "npc", id: nRef?.id || obj.id, name: npcName },
          };
          clickableObjects.push(npcGroup);
          scene.add(npcGroup);
        } else if (obj.object_type === "treasure") {
          interactables.push({ kind: "treasure", id: obj.id, name: "תיבת אוצר", x: ox, z: oz });

          const chestGroup = new THREE.Group();
          chestGroup.position.set(ox, 0, oz);

          const chestMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.8, roughness: 0.3 });
          const chest = new THREE.Mesh(new THREE.BoxGeometry(50, 40, 40), chestMat);
          chest.position.y = 20;
          chest.castShadow = true;
          chestGroup.add(chest);

          const auraMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true, transparent: true, opacity: 0.4 });
          const aura = new THREE.Mesh(new THREE.SphereGeometry(35, 8, 8), auraMat);
          aura.position.y = 25;
          chestGroup.add(aura);

          chestGroup.userData = {
            interactable: { kind: "treasure", id: obj.id, name: "תיבת אוצר" },
          };
          clickableObjects.push(chestGroup);
          scene.add(chestGroup);
        } else if (obj.object_type === "door") {
          const targetMapId = meta.target_map_id as string;
          const targetName = (meta.label as string) || "שער מעבר";
          interactables.push({ kind: "door", id: obj.id, name: targetName, x: ox, z: oz, targetMapId });

          const doorGroup = new THREE.Group();
          doorGroup.position.set(ox, 0, oz);
          const rotY = (meta.rotation_y as number) ?? 0;
          doorGroup.rotation.y = rotY;

          // Grand Majestic Portal Gateway Arch (Taller and Wider)
          const archGeo = new THREE.TorusGeometry(95, 14, 14, 32, Math.PI);
          const archMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, roughness: 0.15, metalness: 0.5 });
          const arch = new THREE.Mesh(archGeo, archMat);
          arch.position.y = 110;
          doorGroup.add(arch);

          // Portal Pillars Left & Right
          const pillarGeo = new THREE.BoxGeometry(22, 115, 22);
          const pMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 });
          const pillarL = new THREE.Mesh(pillarGeo, pMat);
          pillarL.position.set(-95, 57.5, 0);
          doorGroup.add(pillarL);

          const pillarR = new THREE.Mesh(pillarGeo, pMat);
          pillarR.position.set(95, 57.5, 0);
          doorGroup.add(pillarR);

          // Swirling Vortex Disc
          const portalDisc = new THREE.Mesh(
            new THREE.CircleGeometry(85, 28),
            new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
          );
          portalDisc.position.y = 110;
          doorGroup.add(portalDisc);

          // Floating Grand Portal Sign
          const pSignCanvas = document.createElement("canvas");
          pSignCanvas.width = 400;
          pSignCanvas.height = 90;
          const psCtx = pSignCanvas.getContext("2d");
          if (psCtx) {
            psCtx.fillStyle = "rgba(15, 23, 42, 0.94)";
            safeRoundRect(psCtx, 8, 8, 384, 74, 18);
            psCtx.fill();
            psCtx.strokeStyle = "#22d3ee";
            psCtx.lineWidth = 4;
            psCtx.stroke();
            psCtx.fillStyle = "#ffffff";
            psCtx.font = "bold 32px sans-serif";
            psCtx.textAlign = "center";
            psCtx.textBaseline = "middle";
            psCtx.fillText(`🚪 ${targetName}`, 200, 45);

            const psTex = new THREE.CanvasTexture(pSignCanvas);
            const psSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: psTex, transparent: true }));
            psSprite.scale.set(190, 42, 1);
            psSprite.position.set(0, 235, 0);
            doorGroup.add(psSprite);
          }

          doorGroup.userData = {
            interactable: { kind: "door", id: obj.id, name: targetName, targetMapId },
          };
          clickableObjects.push(doorGroup);
          scene.add(doorGroup);
        } else if (obj.object_type === "screen") {
          const screenGroup = new THREE.Group();
          screenGroup.position.set(ox, 0, oz);
          const rotY = (meta.rotation_y as number) ?? (meta.rotation_deg ? (meta.rotation_deg as number) * (Math.PI / 180) : 0);
          screenGroup.rotation.y = rotY;

          const scrText = (meta.text as string) || "";
          const scrImgUrl = (meta.image_url as string) || (meta.sprite_url as string) || null;
          const scrTitle = (meta.label as string) || (meta.title as string) || "מסך מולטימדיה";

          interactables.push({
            kind: "screen",
            id: obj.id,
            name: scrTitle,
            text: scrText,
            imageUrl: scrImgUrl,
            x: ox,
            z: oz,
          });

          // Screen Frame (Dark sleek metallic body)
          const frameMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.6, metalness: 0.4 });
          const frame = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, 16), frameMat);
          frame.position.y = oh / 2 + 30;
          frame.castShadow = true;
          screenGroup.add(frame);

          // Support Stand Pillar
          const standMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 });
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(9, 13, 35, 12), standMat);
          stand.position.y = 17.5;
          stand.castShadow = true;
          screenGroup.add(stand);

          // Floor Base Plate
          const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(35, 38, 6, 16), standMat);
          basePlate.position.y = 3;
          screenGroup.add(basePlate);

          // Screen Content Surface (Image or Animated Text Canvas)
          if (scrImgUrl) {
            const texLoader = new THREE.TextureLoader();
            const scrTex = texLoader.load(scrImgUrl);
            scrTex.colorSpace = THREE.SRGBColorSpace;
            const screenFace = new THREE.Mesh(
              new THREE.PlaneGeometry(ow - 12, oh - 12),
              new THREE.MeshBasicMaterial({ map: scrTex })
            );
            screenFace.position.set(0, oh / 2 + 30, 8.5);
            screenGroup.add(screenFace);
          } else {
            const scrCanvas = document.createElement("canvas");
            scrCanvas.width = 512;
            scrCanvas.height = 288;
            const scrCtx = scrCanvas.getContext("2d");
            if (scrCtx) {
              scrCtx.fillStyle = (meta.bg as string) || "#0f172a";
              scrCtx.fillRect(0, 0, 512, 288);
              scrCtx.fillStyle = (meta.fg as string) || "#38bdf8";
              scrCtx.font = "bold 32px sans-serif";
              scrCtx.textAlign = "center";
              scrCtx.textBaseline = "middle";
              scrCtx.fillText(scrText || "COLT WORLD", 256, 144);

              const scrTex = new THREE.CanvasTexture(scrCanvas);
              const screenFace = new THREE.Mesh(
                new THREE.PlaneGeometry(ow - 12, oh - 12),
                new THREE.MeshBasicMaterial({ map: scrTex })
              );
              screenFace.position.set(0, oh / 2 + 30, 8.5);
              screenGroup.add(screenFace);
            }
          }

          // Floating Screen Badge Sign
          const sTitleCanvas = document.createElement("canvas");
          sTitleCanvas.width = 384;
          sTitleCanvas.height = 80;
          const stCtx = sTitleCanvas.getContext("2d");
          if (stCtx) {
            stCtx.fillStyle = "rgba(15, 23, 42, 0.88)";
            safeRoundRect(stCtx, 8, 8, 368, 64, 16);
            stCtx.fill();
            stCtx.strokeStyle = "#38bdf8";
            stCtx.lineWidth = 3;
            stCtx.stroke();
            stCtx.fillStyle = "#ffffff";
            stCtx.font = "bold 28px sans-serif";
            stCtx.textAlign = "center";
            stCtx.textBaseline = "middle";
            stCtx.fillText(`📺 ${scrTitle}`, 192, 40);

            const stTex = new THREE.CanvasTexture(sTitleCanvas);
            const stSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: stTex, transparent: true }));
            stSprite.scale.set(150, 35, 1);
            stSprite.position.set(0, oh + 55, 0);
            screenGroup.add(stSprite);
          }

          screenGroup.userData = {
            interactable: { kind: "screen", id: obj.id, name: scrTitle, text: scrText, imageUrl: scrImgUrl },
          };
          clickableObjects.push(screenGroup);
          scene.add(screenGroup);

          const cosR = Math.abs(Math.cos(rotY));
          const sinR = Math.abs(Math.sin(rotY));
          const rotW = ow * cosR + 25 * sinR;
          const rotD = ow * sinR + 25 * cosR;
          solidBoxes.push({ minX: ox - rotW / 2, maxX: ox + rotW / 2, minZ: oz - rotD / 2, maxZ: oz + rotD / 2 });
        } else {
          // Decor / Furniture Element (supports all 33+ comprehensive presets across categories)
          const decorImageUrl = (meta.image_url as string) || (meta.sprite_url as string);
          const presetId = meta.preset as string;
          const preset = ALL_DECOR_PRESETS.find((p) => p.id === presetId) || ALL_DECOR_PRESETS[0];

          const decorGroup = new THREE.Group();
          decorGroup.position.set(ox, 0, oz);
          const rotY = (meta.rotation_y as number) ?? (meta.rotation_deg ? (meta.rotation_deg as number) * (Math.PI / 180) : 0);
          decorGroup.rotation.y = rotY;

          if (decorImageUrl && !preset.allowCustomImage) {
            const planeW = ow || 120;
            const planeH = oh || 120;

            const texLoader = new THREE.TextureLoader();
            const decorTex = texLoader.load(decorImageUrl);
            decorTex.colorSpace = THREE.SRGBColorSpace;

            const decorMat = new THREE.MeshStandardMaterial({
              map: decorTex,
              transparent: true,
              alphaTest: 0.05,
              side: THREE.DoubleSide,
              roughness: 0.5,
            });

            const decorMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), decorMat);
            decorMesh.position.y = planeH / 2;
            decorMesh.castShadow = true;
            decorGroup.add(decorMesh);

            const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
            const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW * 0.9, od * 0.7), shadowMat);
            shadowMesh.rotation.x = -Math.PI / 2;
            shadowMesh.position.y = 1;
            decorGroup.add(shadowMesh);
          } else {
            // Build rich procedural 3D furniture/decor from catalog
            const builtMesh = buildDecor3DGroup(THREE, preset, ow, od, oh, meta);
            decorGroup.add(builtMesh);
          }

          scene.add(decorGroup);
        }
      }

      // ==========================================
      // Fully-Articulated 3D Convention Character
      // ==========================================
      const spawnObj = objects.find((o) => o.object_type === "spawn");
      let playerX = spawnObj?.x ?? mapW / 2;
      let playerZ = spawnObj?.y ?? mapD / 2;

      // Reveal initial fog around spawn immediately
      const initCols = Math.ceil(mapW / FOW_CELL_SIZE);
      const initRows = Math.ceil(mapD / FOW_CELL_SIZE);
      revealFogCircle(discoveredCellsRef.current, playerX, playerZ, FOW_REVEAL_RADIUS, initCols, initRows);
      saveDiscoveredCells(user?.id, mapId, discoveredCellsRef.current);
      setDiscoveredCells(new Set(discoveredCellsRef.current));
      setHudPlayer({ x: Math.round(playerX), z: Math.round(playerZ), facing: 0 });

      const playerPivot = new THREE.Group();
      playerPivot.position.set(playerX, 0, playerZ);

      // Local 3D Humanoid Character with articulated limbs, swinging arms, knees & smooth 360° turn
      const localPlayer3D = createConventionCharacter3D(THREE, {
        jacketColor: 0x6d28d9, // Stylish purple convention jacket with golden trim
        shirtColor: 0xf8fafc,
        pantsColor: 0x1e293b,
        shoesColor: 0xf1f5f9,
        hairColor: 0x1c1917,
        skinColor: 0xfed7aa,
        scale: 1.15,
      });
      playerPivot.add(localPlayer3D.group);

      // Multi-player 3D characters registry
      type RemotePlayerMesh = {
        group: import("three").Group;
        char3D: Character3DInstance;
        nameSprite?: import("three").Sprite;
        lastX: number;
        lastZ: number;
      };
      const remotePlayerMeshes = new Map<string, RemotePlayerMesh>();

      // Player Name Label above head
      const pNameCanvas = document.createElement("canvas");
      pNameCanvas.width = 300;
      pNameCanvas.height = 75;
      const pCtx = pNameCanvas.getContext("2d");
      if (pCtx) {
        pCtx.fillStyle = "rgba(15, 23, 42, 0.88)";
        safeRoundRect(pCtx, 10, 10, 280, 55, 18);
        pCtx.fill();
        pCtx.strokeStyle = "#38bdf8";
        pCtx.lineWidth = 3;
        pCtx.stroke();
        pCtx.fillStyle = "#ffffff";
        pCtx.font = "bold 26px sans-serif";
        pCtx.textAlign = "center";
        pCtx.textBaseline = "middle";
        pCtx.fillText(profile?.username || "אתה", 150, 37);

        const pNameTex = new THREE.CanvasTexture(pNameCanvas);
        const pNameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: pNameTex, transparent: true }));
        pNameSprite.scale.set(130, 32, 1);
        pNameSprite.position.set(0, 120, 0);
        playerPivot.add(pNameSprite);
      }

      scene.add(playerPivot);

      // Click to Walk target
      let targetX: number | null = null;
      let targetZ: number | null = null;

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      dom.addEventListener("pointerdown", (e) => {
        const rect = dom.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        raycaster.setFromCamera(mouse, camera);

        // Check if an interactive object was clicked directly
        const hitInteracts = raycaster.intersectObjects(clickableObjects, true);
        if (hitInteracts.length > 0) {
          let curr: THREE.Object3D | null = hitInteracts[0].object;
          while (curr && !curr.userData?.interactable) {
            curr = curr.parent;
          }
          if (curr && curr.userData?.interactable) {
            const it = curr.userData.interactable as {
              kind: "store" | "npc" | "door" | "treasure" | "screen";
              id: string;
              name: string;
              targetMapId?: string;
              text?: string;
              imageUrl?: string | null;
            };
            onInteractRef.current?.(it.kind, it.id, {
              targetMapId: it.targetMapId,
              title: it.name,
              text: it.text,
              imageUrl: it.imageUrl,
            });
            return;
          }
        }

        const intersects = raycaster.intersectObject(floor);
        if (intersects.length > 0) {
          const pt = intersects[0].point;
          targetX = Math.max(30, Math.min(mapW - 30, pt.x));
          targetZ = Math.max(30, Math.min(mapD - 30, pt.z));
        }
      });

      // Animation & Movement Loop
      let lastTime = performance.now();
      let lastHudSync = 0;
      const SPEED = 8.2;

      const animate = () => {
        if (disposed) return;
        raf = requestAnimationFrame(animate);
        const now = performance.now();
        const dt = Math.min(0.06, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        // Camera Orbital Rotation with Q and E keys (smooth 360° perspective view)
        const ROT_SPEED = 2.4;
        if (keysDown.has("KeyQ")) {
          camAngleRef.current -= ROT_SPEED * dt;
        }
        if (keysDown.has("KeyE") && !activeNearbyRef.current) {
          camAngleRef.current += ROT_SPEED * dt;
        }

        // Determine Movement Vector relative to current Camera View Angle
        const curAngle = camAngleRef.current;
        let rawMoveX = 0;
        let rawMoveZ = 0;

        if (keysDown.has("ArrowLeft") || keysDown.has("KeyA")) rawMoveX -= 1;
        if (keysDown.has("ArrowRight") || keysDown.has("KeyD")) rawMoveX += 1;
        if (keysDown.has("ArrowUp") || keysDown.has("KeyW")) rawMoveZ -= 1;
        if (keysDown.has("ArrowDown") || keysDown.has("KeyS")) rawMoveZ += 1;

        if (touchInputRef?.current) {
          if (touchInputRef.current.x) rawMoveX += touchInputRef.current.x;
          if (touchInputRef.current.y) rawMoveZ += touchInputRef.current.y;
        }

        let moveX = 0;
        let moveZ = 0;
        if (rawMoveX !== 0 || rawMoveZ !== 0) {
          // Camera-relative isometric translation
          moveX = rawMoveX * Math.cos(curAngle) + rawMoveZ * Math.sin(curAngle);
          moveZ = -rawMoveX * Math.sin(curAngle) + rawMoveZ * Math.cos(curAngle);
        }

        let nextX = playerX;
        let nextZ = playerZ;
        let isMoving = false;

        if (moveX !== 0 || moveZ !== 0) {
          targetX = null;
          targetZ = null;
          isMoving = true;
          const len = Math.hypot(moveX, moveZ);
          nextX += (moveX / len) * SPEED;
          nextZ += (moveZ / len) * SPEED;

          // Smooth 360-degree rotation towards movement direction
          localPlayer3D.setDirection(moveX, moveZ, dt);
        } else if (targetX !== null && targetZ !== null) {
          const dx = targetX - playerX;
          const dz = targetZ - playerZ;
          const dist = Math.hypot(dx, dz);
          if (dist > 6) {
            isMoving = true;
            nextX += (dx / dist) * SPEED;
            nextZ += (dz / dist) * SPEED;

            // Smooth 360-degree rotation towards click destination
            localPlayer3D.setDirection(dx, dz, dt);
          } else {
            targetX = null;
            targetZ = null;
          }
        }

        // True 3D Humanoid animation: legs swinging, knees bending, arms swaying, breathing
        localPlayer3D.updateAnimation(isMoving, dt);

        // Multi-player 3D Characters Update
        const curOthers = othersRef.current;
        const curIds = new Set(curOthers.map((o) => o.user_id));

        for (const [uid, rep] of remotePlayerMeshes.entries()) {
          if (!curIds.has(uid)) {
            scene.remove(rep.group);
            rep.char3D.dispose();
            remotePlayerMeshes.delete(uid);
          }
        }

        for (const o of curOthers) {
          let rep = remotePlayerMeshes.get(o.user_id);
          if (!rep) {
            const rGroup = new THREE.Group();

            const rChar3D = createConventionCharacter3D(THREE, {
              jacketColor: 0x4f46e5, // Indigo stylish convention jacket
              shirtColor: 0xf1f5f9,
              pantsColor: 0x334155,
              shoesColor: 0xffffff,
              hairColor: 0x292524,
              skinColor: 0xfde68a,
              scale: 1.15,
            });
            rGroup.add(rChar3D.group);

            const rNameCanvas = document.createElement("canvas");
            rNameCanvas.width = 280;
            rNameCanvas.height = 70;
            const rCtx = rNameCanvas.getContext("2d");
            let rNameSprite: import("three").Sprite | undefined;
            if (rCtx) {
              rCtx.fillStyle = "rgba(15, 23, 42, 0.88)";
              safeRoundRect(rCtx, 10, 10, 260, 50, 16);
              rCtx.fill();
              rCtx.strokeStyle = "#818cf8";
              rCtx.lineWidth = 2.5;
              rCtx.stroke();
              rCtx.fillStyle = "#ffffff";
              rCtx.font = "bold 24px sans-serif";
              rCtx.textAlign = "center";
              rCtx.textBaseline = "middle";
              rCtx.fillText(o.username || "שחקן", 140, 35);

              const rNameTex = new THREE.CanvasTexture(rNameCanvas);
              rNameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rNameTex, transparent: true }));
              rNameSprite.scale.set(120, 30, 1);
              rNameSprite.position.set(0, 120, 0);
              rGroup.add(rNameSprite);
            }

            scene.add(rGroup);
            rep = {
              group: rGroup,
              char3D: rChar3D,
              nameSprite: rNameSprite,
              lastX: o.x,
              lastZ: o.y,
            };
            remotePlayerMeshes.set(o.user_id, rep);
          }

          const lp = liveRef.current?.sample(o.user_id);
          const rx = lp?.x ?? o.x;
          const rz = lp?.y ?? o.y;
          rep.group.position.set(rx, 0, rz);

          const dx = rx - rep.lastX;
          const dz = rz - rep.lastZ;
          const rMoving = !!lp?.moving || Math.hypot(dx, dz) > 0.4;
          if (rMoving && Math.hypot(dx, dz) > 0.1) {
            rep.char3D.setDirection(dx, dz, dt);
          }
          rep.char3D.updateAnimation(rMoving, dt);
          rep.lastX = rx;
          rep.lastZ = rz;
        }

        // Solid wall collision
        let blockedX = false;
        let blockedZ = false;
        const playerRadius = 20;

        for (const box of solidBoxes) {
          if (nextX + playerRadius > box.minX && nextX - playerRadius < box.maxX && playerZ + playerRadius > box.minZ && playerZ - playerRadius < box.maxZ) {
            blockedX = true;
          }
          if (playerX + playerRadius > box.minX && playerX - playerRadius < box.maxX && nextZ + playerRadius > box.minZ && nextZ - playerRadius < box.maxZ) {
            blockedZ = true;
          }
        }

        if (!blockedX) playerX = nextX;
        if (!blockedZ) playerZ = nextZ;

        playerX = Math.max(30, Math.min(mapW - 30, playerX));
        playerZ = Math.max(30, Math.min(mapD - 30, playerZ));

        playerPivot.position.set(playerX, 0, playerZ);

        // Dynamic Camera Distance with Zoom In / Out & Smooth Orbit Rotation
        const currentZoom = zoomFactorRef.current;
        const baseOffsetY = 780;
        const baseOffsetZ = 920;
        const camDist = baseOffsetZ * currentZoom;
        const camOffsetY = baseOffsetY * currentZoom;

        const camX = playerX + Math.sin(curAngle) * camDist;
        const camZ = playerZ + Math.cos(curAngle) * camDist;

        camera.position.set(camX, camOffsetY, camZ);
        camera.lookAt(playerX, PLAYER_H * 0.45, playerZ);

        // Fog of War Discovery & Persistence (Heroes-style uncovering)
        const fowCols = Math.ceil(mapW / FOW_CELL_SIZE);
        const fowRows = Math.ceil(mapD / FOW_CELL_SIZE);
        const discoveredChanged = revealFogCircle(
          discoveredCellsRef.current,
          playerX,
          playerZ,
          FOW_REVEAL_RADIUS,
          fowCols,
          fowRows
        );
        if (discoveredChanged) {
          saveDiscoveredCells(user?.id, mapId, discoveredCellsRef.current);
          setDiscoveredCells(new Set(discoveredCellsRef.current));
        }

        // Throttled HUD update for Minimap
        if (now - lastHudSync > 60) {
          lastHudSync = now;
          setHudPlayer({
            x: Math.round(playerX),
            z: Math.round(playerZ),
            facing: localPlayer3D.getCurrentAngle(),
          });
          setCamAngle(curAngle);
        }

        // Check nearby interactive items
        let closest: InteractableTarget | null = null;
        let closestDist = 180;

        for (const it of interactables) {
          const d = Math.hypot(playerX - it.x, playerZ - it.z);
          if (d < closestDist) {
            closestDist = d;
            closest = it;
          }
        }

        if (closest) {
          const nb: Nearby = {
            kind: closest.kind,
            id: closest.id,
            name: closest.name,
            ...(closest.targetMapId ? { targetMapId: closest.targetMapId } : {}),
            ...(closest.text ? { text: closest.text } : {}),
            ...(closest.imageUrl ? { imageUrl: closest.imageUrl } : {}),
          };
          setActiveNearby(nb);
          onNearbyRef.current?.(nb);
        } else {
          setActiveNearby(null);
          onNearbyRef.current?.(null);
        }

        // Multiplayer live position broadcast
        if (mapId && user?.id) {
          const currentFacing: "left" | "right" = localPlayer3D.getCurrentAngle() < 0 ? "left" : "right";
          liveRef.current?.send(playerX, playerZ, currentFacing, isMoving);
        }

        renderer.render(scene, camera);
      };

      animate();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
      }
    };
  }, [width, height, viewportWidth, viewportHeight, mapId, objects, stores, npcs, floorType, floorColor, floorTextureUrl, backgroundTheme, profile, user]);

  return (
    <div className="relative w-full h-[640px] md:h-[760px] rounded-3xl overflow-hidden border-4 border-white/20 bg-slate-950 shadow-2xl select-none">
      {/* 3D Canvas Host */}
      <div ref={hostRef} className="w-full h-full" />

      {/* 🗺️ Fog of War Minimap HUD at Bottom-Left (Heroes of Might & Magic Style with Discovery & Modal) */}
      <div className="absolute bottom-6 left-6 z-20">
        <FogOfWarMinimap
          mapW={worldW}
          mapD={worldD}
          playerX={hudPlayer.x}
          playerZ={hudPlayer.z}
          playerFacing={hudPlayer.facing}
          camAngle={camAngle}
          discoveredCells={discoveredCells}
          objects={objects}
          stores={stores}
          npcs={npcs}
          maps={mapsList}
          floorColor={floorColor}
          backgroundTheme={backgroundTheme}
        />
      </div>

      {/* Floating Controls Bar at Bottom-Right: Camera Perspective (Q / E) & Zoom */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
        {/* Camera Perspective 360° Controls */}
        <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-xl text-white">
          <button
            onClick={handleRotateLeft}
            className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-1 text-xs font-bold"
            title="סובב מבט שמאלה [מקש Q]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[10px] hidden sm:inline">Q</span>
          </button>
          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition-all text-white/80"
            title="איפוס נקודת מבט לחזית"
          >
            <Compass className="w-3.5 h-3.5 text-white/70" />
          </button>
          <button
            onClick={handleRotateRight}
            className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-1 text-xs font-bold"
            title="סובב מבט ימינה [מקש E]"
          >
            <span className="font-mono text-[10px] hidden sm:inline">E</span>
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>

        {/* Zoom Controls (+ / - / Reset) */}
        <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-xl text-white">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
            title="התקרב (זום אין)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono px-1.5 text-white/90 font-bold min-w-[38px] text-center">
            {Math.round((1 / zoomFactor) * 100)}%
          </span>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
            title="התרחק (זום אאוט)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Near-Object Action Prompt */}
      {activeNearby && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-black/85 backdrop-blur-md px-5 py-3 rounded-2xl border-2 border-primary shadow-2xl text-white animate-bounce">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground font-bold">
            {activeNearby.kind === "store" && <Store className="w-5 h-5" />}
            {activeNearby.kind === "npc" && <MessageCircle className="w-5 h-5" />}
            {activeNearby.kind === "door" && <DoorOpen className="w-5 h-5" />}
            {activeNearby.kind === "treasure" && <Gift className="w-5 h-5" />}
            {activeNearby.kind === "screen" && <Monitor className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs text-primary font-bold">
              {activeNearby.kind === "store" && "דוכן מסחר / חנות"}
              {activeNearby.kind === "npc" && "דמות שיחה"}
              {activeNearby.kind === "door" && "שער מעבר"}
              {activeNearby.kind === "treasure" && "תיבת פרס"}
              {activeNearby.kind === "screen" && "מסך מולטימדיה"}
            </div>
            <div className="text-sm font-extrabold">{activeNearby.name}</div>
          </div>
          <button
            onClick={() => {
              if (activeNearby) {
                onInteract?.(activeNearby.kind, activeNearby.id, {
                  targetMapId: (activeNearby as { targetMapId?: string }).targetMapId,
                  title: activeNearby.name,
                  text: (activeNearby as { text?: string }).text,
                  imageUrl: (activeNearby as { imageUrl?: string | null }).imageUrl,
                });
              }
            }}
            className="btn-plastic !px-4 !py-1.5 text-xs font-bold mr-2"
          >
            {activeNearby.kind === "screen" ? "צפה במסך [רווח/E]" : "פתח / דבר [רווח/E]"}
          </button>
        </div>
      )}

      {/* Movement & View Controls Guide & Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white text-xs">
        <User className="w-4 h-4 text-purple-400 animate-pulse" />
        <span>✨ סביבה מגניבה (נקודת מבט 360° חופשית | ערפל קרב מתגלה)</span>
      </div>

      <div className="absolute top-4 right-4 z-10 hidden md:flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-white/80 text-[11px]">
        <span>🔄 סיבוב מבט: Q / E | ⌨️ תנועה: WASD / חיצים | 🗺️ לחץ על המפה לפתיחה מלאה</span>
      </div>
    </div>
  );
}
