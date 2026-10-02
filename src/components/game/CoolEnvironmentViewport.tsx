import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { MapObject } from "@/components/game/GameViewport";
import { useLivePositions } from "@/hooks/use-live-positions";
import { Sparkles, MessageCircle, Store, DoorOpen, Gift, Monitor, Box, ZoomIn, ZoomOut, RotateCcw, User } from "lucide-react";
import { COOL_DECOR_PRESETS } from "@/components/owner/CoolEnvironmentEditor";
import { createConventionCharacter3D, type Character3DInstance } from "@/lib/character-3d";
import { makeFloorCanvas, FLOOR_TILE_SIZE, type FloorType } from "@/lib/floor-textures";
import { instantiateGlb, fitModel } from "@/lib/glb-loader";
import { PLAYER_W, PLAYER_H } from "@/lib/avatar-layout";

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
  onInteract?: (kind: "store" | "npc" | "door" | "treasure", id: string, extra?: { targetMapId?: string }) => void;
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
          onInteractRef.current?.(nb.kind, nb.id, { targetMapId: (nb as { targetMapId?: string }).targetMapId });
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
        kind: "store" | "npc" | "door" | "treasure";
        id: string;
        name: string;
        x: number;
        z: number;
        targetMapId?: string;
      };
      const interactables: InteractableTarget[] = [];
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
          // 🏠 The Sims Style Room
          const rx = obj.x;
          const rz = obj.y;
          const rw = ow;
          const rd = od;
          const wallH = (meta.wall_height as number) || 65;
          const wallCol = (meta.wall_color as string) || "#0284c7";
          const roomFlrCol = (meta.floor_color as string) || "#0f172a";
          const rName = (meta.room_name as string) || (meta.label as string) || "חדר";
          const doorOpen = (meta.door_opening as string) || "south";

          const roomGroup = new THREE.Group();

          const rFlrMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(roomFlrCol), roughness: 0.3 });
          const rFlrMesh = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), rFlrMat);
          rFlrMesh.rotation.x = -Math.PI / 2;
          rFlrMesh.position.set(rx + rw / 2, 1.5, rz + rd / 2);
          rFlrMesh.receiveShadow = true;
          roomGroup.add(rFlrMesh);

          const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallCol), roughness: 0.45 });
          const wallThick = 12;

          // North Wall (Back)
          const northWall = new THREE.Mesh(new THREE.BoxGeometry(rw, wallH, wallThick), wallMat);
          northWall.position.set(rx + rw / 2, wallH / 2, rz);
          northWall.castShadow = true;
          northWall.receiveShadow = true;
          roomGroup.add(northWall);
          solidBoxes.push({ minX: rx, maxX: rx + rw, minZ: rz - wallThick / 2, maxZ: rz + wallThick / 2 });

          // West Wall (Left)
          const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, rd), wallMat);
          westWall.position.set(rx, wallH / 2, rz + rd / 2);
          westWall.castShadow = true;
          westWall.receiveShadow = true;
          roomGroup.add(westWall);
          solidBoxes.push({ minX: rx - wallThick / 2, maxX: rx + wallThick / 2, minZ: rz, maxZ: rz + rd });

          // East Wall (Right low wall)
          const lowWallH = wallH * 0.35;
          const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, lowWallH, rd), wallMat);
          eastWall.position.set(rx + rw, lowWallH / 2, rz + rd / 2);
          eastWall.castShadow = true;
          roomGroup.add(eastWall);

          // South Wall (Front wall with doorway)
          if (doorOpen !== "south" && doorOpen !== "all") {
            const southWall = new THREE.Mesh(new THREE.BoxGeometry(rw, lowWallH, wallThick), wallMat);
            southWall.position.set(rx + rw / 2, lowWallH / 2, rz + rd);
            southWall.castShadow = true;
            roomGroup.add(southWall);
          } else {
            const doorW = 120;
            const sideW = (rw - doorW) / 2;
            if (sideW > 20) {
              const southLeft = new THREE.Mesh(new THREE.BoxGeometry(sideW, lowWallH, wallThick), wallMat);
              southLeft.position.set(rx + sideW / 2, lowWallH / 2, rz + rd);
              roomGroup.add(southLeft);

              const southRight = new THREE.Mesh(new THREE.BoxGeometry(sideW, lowWallH, wallThick), wallMat);
              southRight.position.set(rx + rw - sideW / 2, lowWallH / 2, rz + rd);
              roomGroup.add(southRight);
            }
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
            const rotY = (meta.rotation_y as number) ?? (meta.rotation_deg ? (meta.rotation_deg as number) * (Math.PI / 180) : 0);
            wallMesh.rotation.y = rotY;
            wallMesh.castShadow = true;
            boothGroup.add(wallMesh);

            // Ground shadow disc for realistic floor anchoring
            const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
            const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW * 0.95, od * 0.7), shadowMat);
            shadowMesh.rotation.x = -Math.PI / 2;
            shadowMesh.position.y = 1;
            shadowMesh.rotation.z = rotY;
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
            const rotY = (meta.rotation_y as number) ?? 0;
            backWall.rotation.y = rotY;
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

          scene.add(boothGroup);
          solidBoxes.push({ minX: ox - ow / 2, maxX: ox + ow / 2, minZ: oz - (od * 0.7) / 2, maxZ: oz + (od * 0.7) / 2 });
        } else if (obj.object_type === "npc") {
          const nRef = npcs.find((n) => n.id === obj.reference_id);
          const npcName = nRef?.name || "NPC";
          interactables.push({ kind: "npc", id: nRef?.id || obj.id, name: npcName, x: ox, z: oz });

          const npcGroup = new THREE.Group();
          npcGroup.position.set(ox, 0, oz);

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

          scene.add(chestGroup);
        } else if (obj.object_type === "door") {
          const targetMapId = meta.target_map_id as string;
          interactables.push({ kind: "door", id: obj.id, name: "שער מעבר", x: ox, z: oz, targetMapId });

          const doorGroup = new THREE.Group();
          doorGroup.position.set(ox, 0, oz);

          const archGeo = new THREE.TorusGeometry(50, 8, 8, 24, Math.PI);
          const archMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, roughness: 0.2 });
          const arch = new THREE.Mesh(archGeo, archMat);
          arch.position.y = 50;
          doorGroup.add(arch);

          const portalDisc = new THREE.Mesh(
            new THREE.CircleGeometry(42, 16),
            new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
          );
          portalDisc.position.y = 50;
          doorGroup.add(portalDisc);

          scene.add(doorGroup);
        } else if (obj.object_type === "screen") {
          const screenGroup = new THREE.Group();
          screenGroup.position.set(ox, 0, oz);

          const frameMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.8 });
          const frame = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, 15), frameMat);
          frame.position.y = oh / 2 + 30;
          frame.castShadow = true;
          screenGroup.add(frame);

          const scrCanvas = document.createElement("canvas");
          scrCanvas.width = 512;
          scrCanvas.height = 288;
          const scrCtx = scrCanvas.getContext("2d");
          if (scrCtx) {
            scrCtx.fillStyle = (meta.bg as string) || "#0f172a";
            scrCtx.fillRect(0, 0, 512, 288);
            scrCtx.fillStyle = (meta.fg as string) || "#38bdf8";
            scrCtx.font = "bold 36px sans-serif";
            scrCtx.textAlign = "center";
            scrCtx.textBaseline = "middle";
            scrCtx.fillText((meta.text as string) || "COLT WORLD", 256, 144);

            const scrTex = new THREE.CanvasTexture(scrCanvas);
            const screenFace = new THREE.Mesh(
              new THREE.PlaneGeometry(ow - 10, oh - 10),
              new THREE.MeshBasicMaterial({ map: scrTex })
            );
            screenFace.position.set(0, oh / 2 + 30, 8);
            screenGroup.add(screenFace);
          }

          scene.add(screenGroup);
        } else {
          // Decor / Furniture Element
          const decorImageUrl = (meta.image_url as string) || (meta.sprite_url as string);
          const presetId = meta.preset as string;
          const preset = COOL_DECOR_PRESETS.find((p) => p.id === presetId) || COOL_DECOR_PRESETS[0];

          const decorGroup = new THREE.Group();
          decorGroup.position.set(ox, 0, oz);

          if (decorImageUrl) {
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
            const rotY = (meta.rotation_y as number) ?? 0;
            decorMesh.rotation.y = rotY;
            decorMesh.castShadow = true;
            decorGroup.add(decorMesh);

            const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
            const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW * 0.9, od * 0.7), shadowMat);
            shadowMesh.rotation.x = -Math.PI / 2;
            shadowMesh.position.y = 1;
            shadowMesh.rotation.z = rotY;
            decorGroup.add(shadowMesh);
          } else if (preset.id === "cyber_tree") {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(8, 12, 60), new THREE.MeshStandardMaterial({ color: 0x334155 }));
            trunk.position.y = 30;
            trunk.castShadow = true;
            decorGroup.add(trunk);

            const foliage = new THREE.Mesh(new THREE.ConeGeometry(50, 100, 6), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 }));
            foliage.position.y = 100;
            foliage.castShadow = true;
            decorGroup.add(foliage);
          } else if (preset.id === "neon_pillar") {
            const pillar = new THREE.Mesh(
              new THREE.CylinderGeometry(15, 15, 160, 8),
              new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xdb2777, roughness: 0.2 })
            );
            pillar.position.y = 80;
            pillar.castShadow = true;
            decorGroup.add(pillar);
          } else {
            const box = new THREE.Mesh(
              new THREE.BoxGeometry(ow, preset.h || 80, od),
              new THREE.MeshStandardMaterial({ color: new THREE.Color(preset.color || "#a855f7"), roughness: 0.4 })
            );
            box.position.y = (preset.h || 80) / 2;
            box.castShadow = true;
            decorGroup.add(box);
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
        const intersects = raycaster.intersectObject(floor);
        if (intersects.length > 0) {
          const pt = intersects[0].point;
          targetX = Math.max(30, Math.min(mapW - 30, pt.x));
          targetZ = Math.max(30, Math.min(mapD - 30, pt.z));
        }
      });

      // Animation & Movement Loop
      let lastTime = performance.now();
      const SPEED = 5.5;

      const animate = () => {
        if (disposed) return;
        raf = requestAnimationFrame(animate);
        const now = performance.now();
        const dt = Math.min(0.06, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        // Determine Movement Vector
        let moveX = 0;
        let moveZ = 0;

        if (keysDown.has("ArrowLeft") || keysDown.has("KeyA")) moveX -= 1;
        if (keysDown.has("ArrowRight") || keysDown.has("KeyD")) moveX += 1;
        if (keysDown.has("ArrowUp") || keysDown.has("KeyW")) moveZ -= 1;
        if (keysDown.has("ArrowDown") || keysDown.has("KeyS")) moveZ += 1;

        if (touchInputRef?.current) {
          if (touchInputRef.current.x) moveX += touchInputRef.current.x;
          if (touchInputRef.current.y) moveZ += touchInputRef.current.y;
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

        // Dynamic Camera Distance with Zoom In / Out
        // Default baseline distance is further away (~1100 to 1350)
        const currentZoom = zoomFactorRef.current;
        const baseOffsetY = 780;
        const baseOffsetZ = 920;
        const camOffsetY = baseOffsetY * currentZoom;
        const camOffsetZ = baseOffsetZ * currentZoom;

        camera.position.set(playerX, camOffsetY, playerZ + camOffsetZ);
        camera.lookAt(playerX, PLAYER_H * 0.45, playerZ);

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

      {/* Floating Zoom Controls (+ / - / Reset) */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-xl text-white">
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
          title="התקרב (זום אין)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono px-1.5 text-white/90 font-bold min-w-[42px] text-center">
          {Math.round((1 / zoomFactor) * 100)}%
        </span>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
          title="התרחק (זום אאוט)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-4 w-[1px] bg-white/20 mx-0.5" />
        <button
          onClick={handleResetZoom}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
          title="איפוס זום"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Near-Object Action Prompt */}
      {activeNearby && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-black/85 backdrop-blur-md px-5 py-3 rounded-2xl border-2 border-primary shadow-2xl text-white animate-bounce">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground font-bold">
            {activeNearby.kind === "store" && <Store className="w-5 h-5" />}
            {activeNearby.kind === "npc" && <MessageCircle className="w-5 h-5" />}
            {activeNearby.kind === "door" && <DoorOpen className="w-5 h-5" />}
            {activeNearby.kind === "treasure" && <Gift className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs text-primary font-bold">
              {activeNearby.kind === "store" && "דוכן מסחר / חנות"}
              {activeNearby.kind === "npc" && "דמות שיחה"}
              {activeNearby.kind === "door" && "שער מעבר"}
              {activeNearby.kind === "treasure" && "תיבת פרס"}
            </div>
            <div className="text-sm font-extrabold">{activeNearby.name}</div>
          </div>
          <button
            onClick={() => {
              if (activeNearby) {
                onInteract?.(activeNearby.kind, activeNearby.id, {
                  targetMapId: (activeNearby as { targetMapId?: string }).targetMapId,
                });
              }
            }}
            className="btn-plastic !px-4 !py-1.5 text-xs font-bold mr-2"
          >
            פתח / דבר [E]
          </button>
        </div>
      )}

      {/* Movement Controls Guide & Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-white text-xs">
        <User className="w-4 h-4 text-purple-400 animate-pulse" />
        <span>✨ סביבה מגניבה (דמות תלת-מימד אמיתית - הליכה חלקה)</span>
      </div>

      <div className="absolute top-4 right-4 z-10 hidden md:flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-white/80 text-[11px]">
        <span>🖱️ זום עם גלגלת העכבר | ⌨️ תנועה: חיצים / WASD או לחיצה על הרצפה</span>
      </div>
    </div>
  );
}
