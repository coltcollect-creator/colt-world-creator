import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { supabase, resetFirestoreCache } from "@/integrations/supabase/client";
import { GameViewport, type MapObject } from "@/components/game/GameViewport";
import { Game3DViewport } from "@/components/game/Game3DViewport";
import { CoolEnvironmentViewport } from "@/components/game/CoolEnvironmentViewport";

import { GlobalChat } from "@/components/chat/GlobalChat";
import { ActivePlayers } from "@/components/chat/ActivePlayers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { WheelView, MysteryView } from "@/components/game/WheelAndMystery";
import { AuctionView } from "@/components/game/AuctionView";
import { LiveRipView } from "@/components/game/LiveRipView";
import { TreasureView } from "@/components/game/TreasureView";
import { PlayerInspectModal } from "@/components/chat/PlayerInspectModal";
import { subscribeToMapPublishEvents, clearAllMapCaches } from "@/lib/map-publishing";

import { SkinsMarket } from "@/components/game/SkinsMarket";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServerFn } from "@tanstack/react-start";
import { syncWooStock } from "@/lib/woo.functions";
import { useTourAction } from "@/lib/tour";
import { QuestProgressToast } from "@/components/game/QuestProgressToast";
import { trackQuestAction } from "@/lib/quest-events";
import { Monitor, X, Gamepad2 } from "lucide-react";
import { ProfessorQuizModal } from "@/components/game/npcs/ProfessorQuizModal";
import { MysteryVendorModal } from "@/components/game/npcs/MysteryVendorModal";
import { PirateCluesModal } from "@/components/game/npcs/PirateCluesModal";
import { BouncerCheckModal } from "@/components/game/npcs/BouncerCheckModal";
import { MatchmakerModal } from "@/components/game/npcs/MatchmakerModal";
import { CatchCardGameModal } from "@/components/game/minigames/CatchCardGameModal";
import { PackRipPrecisionModal } from "@/components/game/minigames/PackRipPrecisionModal";
import { GradingMasherModal } from "@/components/game/minigames/GradingMasherModal";
import type { RoomLockRule } from "@/lib/npcs-system";



export const Route = createFileRoute("/_authenticated/play")({
  component: PlayPage,
});

type Nearby =
  | { kind: "store"; id: string; name: string }
  | { kind: "npc"; id: string; name: string }
  | { kind: "door"; id: string; name: string; targetMapId?: string }
  | { kind: "treasure"; id: string; name: string }
  | { kind: "screen"; id: string; name: string; text?: string; imageUrl?: string | null }
  | null;

function getStoredMapBundle(mapIdKey: string) {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(`colt_map_bundle_${mapIdKey}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return undefined;
}

function saveStoredMapBundle(mapIdKey: string, bundle: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`colt_map_bundle_${mapIdKey}`, JSON.stringify(bundle));
  } catch {}
}

function PlayPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  
  const [interaction, setInteraction] = useState<{ kind: "store" | "npc"; id: string } | null>(null);
  const [treasureId, setTreasureId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Nearby>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<{ user_id: string; username?: string } | null>(null);

  const [chatOverlay, setChatOverlay] = useState<{ conversationId: string; name: string } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [screenModalData, setScreenModalData] = useState<{
    title: string;
    text?: string;
    imageUrl?: string | null;
  } | null>(null);

  // Specialized NPC states
  const [activeProfessorNpc, setActiveProfessorNpc] = useState<any | null>(null);
  const [activeMysteryNpc, setActiveMysteryNpc] = useState<any | null>(null);
  const [activePirateNpc, setActivePirateNpc] = useState<any | null>(null);
  const [activeMatchmakerNpc, setActiveMatchmakerNpc] = useState<any | null>(null);
  const [bouncerCheck, setBouncerCheck] = useState<{
    rule: RoomLockRule;
    roomName: string;
    targetMapId?: string;
  } | null>(null);

  // Minigames states
  const [activeMinigame, setActiveMinigame] = useState<"catch_card" | "pack_rip" | "grading_masher" | null>(null);
  const [activeMapId, setActiveMapId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("mapId");
      if (fromUrl) return fromUrl;
      try {
        const saved = localStorage.getItem("colt_last_map_id");
        if (saved) return saved;
      } catch {}
    }
    return null;
  });

  const cacheKey = activeMapId || "main-lobby";

  const queryClient = useQueryClient();

  // Listen for reset to main map event
  useEffect(() => {
    const onResetMain = () => {
      try {
        localStorage.setItem("colt_last_map_id", "f5bb3160-7415-4f62-b72c-f04d1fcbd1a9");
      } catch {}
      setActiveMapId(null);
      toast.success("חזרת למפה הראשית 🏰");
    };
    window.addEventListener("colt-reset-to-main-map", onResetMain);
    return () => window.removeEventListener("colt-reset-to-main-map", onResetMain);
  }, []);

  // Listen for live map publishing events (from Firestore manifest, BroadcastChannel, and window events)
  useEffect(() => {
    const unsub = subscribeToMapPublishEvents((detail) => {
      clearAllMapCaches(detail?.mapId);
      resetFirestoreCache("map_objects");
      resetFirestoreCache("map_versions");
      resetFirestoreCache("maps");

      queryClient.invalidateQueries({ queryKey: ["active-map"] });
      queryClient.invalidateQueries({ queryKey: ["active-map", activeMapId] });
      queryClient.refetchQueries({ queryKey: ["active-map", activeMapId] });
      toast.info("המפה עודכנה בלייב לגרסה החדשה ביותר! 🔄", { duration: 3000 });
    });
    return () => unsub();
  }, [activeMapId, queryClient]);

  const { data: mapBundle } = useQuery({
    queryKey: ["active-map", activeMapId],
    initialData: () => getStoredMapBundle(cacheKey),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const cached = getStoredMapBundle(cacheKey);

      const fallbackMap = {
        id: "f5bb3160-7415-4f62-b72c-f04d1fcbd1a9",
        slug: "main-lobby",
        name: "מפה ראשית (Main Lobby)",
        width: 8800,
        height: 760,
        viewport_width: 1400,
        viewport_height: 760,
        is_active: true,
        is_public_room: true,
        background_color: "#c8ecff",
      };

      try {
        let mapRow = null;
        if (activeMapId) {
          const res = await supabase.from("maps").select("*").eq("id", activeMapId).maybeSingle();
          mapRow = res.data;
        } else {
          // Fetch active maps, prioritizing the main map ("מפה ראשית" / "main-lobby")
          const { data: activeMaps } = await supabase
            .from("maps")
            .select("*")
            .eq("is_active", true)
            .eq("is_archived", false);

          if (activeMaps && activeMaps.length > 0) {
            mapRow =
              activeMaps.find(
                (m) =>
                  m.slug?.toLowerCase().includes("main") ||
                  m.name?.includes("ראשית") ||
                  m.id === "f5bb3160-7415-4f62-b72c-f04d1fcbd1a9"
              ) || activeMaps[0];
          }

          if (!mapRow) {
            const { data: mainBySlug } = await supabase
              .from("maps")
              .select("*")
              .or("id.eq.f5bb3160-7415-4f62-b72c-f04d1fcbd1a9,slug.ilike.%main%")
              .limit(1)
              .maybeSingle();
            mapRow = mainBySlug;
          }
        }
        
        const currentMap = mapRow || fallbackMap;

        const { data: version } = await supabase
          .from("map_versions")
          .select("*")
          .eq("map_id", currentMap.id)
          .order("version_number", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const verId = version?.id || "34e2d77d-a542-4f2b-9425-cfe269c18636";

        const currentPublishToken = (currentMap as any).publish_token || version?.publish_token;
        const cachedPublishToken = cached?.map?.publish_token || cached?.version?.publish_token || cached?.publish_token;

        // Fast path: reuse cached objects ONLY if version AND publish_token match and are still fresh
        const isCacheValid =
          cached &&
          cached.map?.id === currentMap.id &&
          cached.version?.id === verId &&
          cached.objects?.length > 0 &&
          (!currentPublishToken || cachedPublishToken === currentPublishToken) &&
          (!version?.updated_at || cached.version?.updated_at === version.updated_at);

        if (isCacheValid) {
          return cached;
        }

        const { data: objs } = await supabase.from("map_objects").select("*").eq("map_version_id", verId);
        
        const isMainLobby = currentMap.id === "f5bb3160-7415-4f62-b72c-f04d1fcbd1a9" || currentMap.slug === "main-lobby";
        const fallbackObjects: MapObject[] = isMainLobby
          ? [
              { id: "obj-ground", map_version_id: verId, object_type: "platform", x: 0, y: 700, width: 2400, height: 60, layer: 1, collision: true, interactive: false, metadata: { color: "#4ade80", label: "רצפת היריד" } },
              { id: "obj-wall-left", map_version_id: verId, object_type: "platform", x: 0, y: 0, width: 30, height: 760, layer: 1, collision: true, interactive: false, metadata: { color: "#64748b" } },
              { id: "obj-wall-right", map_version_id: verId, object_type: "platform", x: 2370, y: 0, width: 30, height: 760, layer: 1, collision: true, interactive: false, metadata: { color: "#64748b" } },
              { id: "obj-store-cards", map_version_id: verId, object_type: "store", reference_id: "store-colt-cards", x: 350, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🃏 שוק הקלפים" } },
              { id: "obj-store-wheel", map_version_id: verId, object_type: "store", reference_id: "store-wheel", x: 750, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🎡 גלגל המזל" } },
              { id: "obj-store-mystery", map_version_id: verId, object_type: "store", reference_id: "store-mystery", x: 1150, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🎁 קופסאות מסתורין" } },
              { id: "obj-store-cosmetics", map_version_id: verId, object_type: "store", reference_id: "store-cosmetics", x: 1550, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "👕 בוטיק הכובעים" } },
              { id: "obj-store-auction", map_version_id: verId, object_type: "store", reference_id: "store-auction", x: 1950, y: 540, width: 160, height: 160, layer: 2, collision: false, interactive: true, metadata: { label: "🔨 מכרזים חיים" } },
              { id: "obj-npc-guide", map_version_id: verId, object_type: "npc", reference_id: "npc-guide", x: 180, y: 580, width: 80, height: 120, layer: 2, collision: false, interactive: true, metadata: { label: "מדריך קולט" } },
              { id: "obj-npc-professor", map_version_id: verId, object_type: "npc", reference_id: "npc-professor", x: 1380, y: 580, width: 80, height: 120, layer: 2, collision: false, interactive: true, metadata: { label: "פרופסור אוק" } },
            ]
          : [
              { id: `obj-ground-${currentMap.id}`, map_version_id: verId, object_type: "platform", x: 0, y: (currentMap.height || 720) - 60, width: currentMap.width || 2400, height: 60, layer: 1, collision: true, interactive: false, metadata: { color: "#8b5a3c", label: "רצפת החדר" } },
            ];

        const finalObjs = objs && objs.length > 0 ? objs : fallbackObjects;
        const result = {
          map: currentMap,
          objects: finalObjs as unknown as MapObject[],
          version: version || { id: verId },
          publish_token: currentPublishToken || String(Date.now()),
        };
        saveStoredMapBundle(cacheKey, result);
        return result;
      } catch (err) {
        console.error("Failed to load map bundle:", err);
        return {
          map: fallbackMap,
          objects: [
            { id: "obj-ground", map_version_id: "default", object_type: "platform", x: 0, y: 700, width: 2400, height: 60, layer: 1, collision: true, interactive: false, metadata: { color: "#4ade80", label: "רצפת היריד" } },
          ] as unknown as MapObject[],
          version: { id: "default" },
        };
      }
    },
  });

  // Keep last visited map in localStorage so refreshes always restore player location
  useEffect(() => {
    if (mapBundle?.map?.id) {
      try {
        localStorage.setItem("colt_last_map_id", mapBundle.map.id);
      } catch {}
    }
  }, [mapBundle?.map?.id]);

  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await supabase.from("stores").select("id,slug,name,store_type,image_url").eq("active", true)).data ?? [],
  });
  const { data: npcs = [] } = useQuery({
    queryKey: ["npcs-with-sprites"],
    queryFn: async () => {
      const { data } = await supabase
        .from("npcs")
        .select("id,slug,name,appearance_id, sprite_url, sprite_left_url, sprite_right_url, sprite_jump_url, npc_appearances(sprite_url,sprite_left_url,sprite_right_url,sprite_jump_url)")
        .eq("active", true);
      return (data ?? []).map((n) => {
        const app = (n as { npc_appearances?: Record<string, string | null> }).npc_appearances ?? {};
        const own = n as Record<string, string | null>;
        return {
          id: n.id as string,
          slug: n.slug as string,
          name: n.name as string,
          sprite_url: own.sprite_url ?? app.sprite_url ?? null,
          sprite_left_url: own.sprite_left_url ?? app.sprite_left_url ?? null,
          sprite_right_url: own.sprite_right_url ?? app.sprite_right_url ?? null,
          sprite_jump_url: own.sprite_jump_url ?? app.sprite_jump_url ?? null,
        };
      });
    },
  });

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(`colt_login_tracked_${user.id}`)) return;
    sessionStorage.setItem(`colt_login_tracked_${user.id}`, "1");
    // record login progress
    trackQuestAction("login", 1);
    supabase.rpc("progress_quest", { _action_type: "login", _amount: 1 }).then(() => {});
  }, [user]);

  // NPC contact = start conversation. Store contact = open catalog modal.
  const openInteraction = async (
    kind: "store" | "npc" | "door" | "treasure" | "screen" | "arcade",
    id: string,
    extra?: { targetMapId?: string; title?: string; text?: string; imageUrl?: string | null; minigameId?: string }
  ) => {
    if (kind === "arcade") {
      const gId = extra?.minigameId || id;
      const normalized = gId.includes("pack") ? "pack_rip" : gId.includes("grading") ? "grading_masher" : "catch_card";
      setActiveMinigame(normalized);
      return;
    }
    if (kind === "screen") {
      setScreenModalData({
        title: extra?.title || "מסך תצוגה",
        text: extra?.text,
        imageUrl: extra?.imageUrl,
      });
      return;
    }
    if (kind === "door") {
      if (extra?.targetMapId) {
        // Check if destination or current door has room lock rules
        const doorObj = mapBundle?.objects?.find((o) => o.id === id);
        const lockRule = (doorObj?.metadata?.lock_rule || doorObj?.metadata) as RoomLockRule | undefined;

        if (lockRule && lockRule.is_locked && lockRule.lock_type !== "none") {
          setBouncerCheck({
            rule: lockRule,
            roomName: (doorObj?.metadata?.label as string) || "אזור סגור",
            targetMapId: extra.targetMapId,
          });
          return;
        }

        try {
          localStorage.setItem("colt_last_map_id", extra.targetMapId);
        } catch {}
        setActiveMapId(extra.targetMapId);
        toast.success(t("play.enteredMap") || "Entered a new place");
      }
      return;
    }
    if (kind === "treasure") {
      setTreasureId(id);
      return;
    }

    if (kind === "npc") {
      trackQuestAction("visit_npc", 1, { npcId: id });
      supabase.rpc("progress_quest", { _action_type: "visit_npc", _amount: 1 }).then(() => {});

      const foundNpc = npcs.find((n) => n.id === id);
      const npcSlug = foundNpc?.slug?.toLowerCase() || "";
      const npcId = foundNpc?.id?.toLowerCase() || "";

      // 1. The Professor (Daily Quiz)
      if (npcSlug.includes("prof") || npcId.includes("prof")) {
        setActiveProfessorNpc(foundNpc || { id, name: "פרופסור אוק" });
        return;
      }

      // 2. Mystery Vendor (Roaming products)
      if (npcSlug.includes("mystery") || npcId.includes("mystery")) {
        setActiveMysteryNpc(foundNpc || { id, name: "הסוחר המסתורי" });
        return;
      }

      // 3. The Pirate (Daily Treasure Hunter - Clue to Clue)
      if (npcSlug.includes("pirate") || npcId.includes("pirate")) {
        setActivePirateNpc(foundNpc || { id, name: "הפיראט" });
        return;
      }

      // 4. The Matchmaker (Group Buy & Waitlist)
      if (npcSlug.includes("match") || npcId.includes("match")) {
        setActiveMatchmakerNpc(foundNpc || { id, name: "השדכן" });
        return;
      }

      await startConversationWith("npc", id, foundNpc?.name ?? "NPC");
      return;
    }
    if (kind === "store") {
      setInteraction({ kind, id });
      return;
    }
    setInteraction({ kind, id });
  };

  const startConversationWith = async (kind: "store" | "npc", id: string, name: string) => {
    if (!user) return;
    try {
      // Check if conversation already exists
      const { data: existingList } = await supabase
        .from("store_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq(kind === "store" ? "store_id" : "npc_id", id)
        .limit(1);

      if (existingList && existingList.length > 0 && existingList[0]?.id) {
        setChatOverlay({ conversationId: existingList[0].id, name });
        return;
      }

      const payload: Record<string, unknown> = {
        user_id: user.id,
        subject: name,
        status: "open",
        unread_owner: 0,
        unread_user: 0,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      };
      if (kind === "store") payload.store_id = id; else payload.npc_id = id;
      const { data } = await supabase.from("store_conversations").insert(payload as never).select("id").maybeSingle();
      const convId = data?.id || `${user.id}_${id}`;
      setChatOverlay({ conversationId: convId, name });
    } catch {
      setChatOverlay({ conversationId: `${user.id}_${id}`, name });
    }
  };

  const startFromNearby = () => {
    if (!nearby) return;
    if (nearby.kind === "store") startConversationWith("store", nearby.id, nearby.name);
    else if (nearby.kind === "npc") startConversationWith("npc", nearby.id, nearby.name);
  };

  // Guided-tour hooks: open the right panel/store when a tour step asks for it.
  useTourAction((action) => {
    if (action === "open-chat") { setInteraction(null); setShowChat(true); return; }
    if (!action.startsWith("open-store-")) return;
    const kind = action.replace("open-store-", "");
    const pick =
      kind === "marketplace"
        ? stores.find((x) => /market/i.test(x.name as string)) ??
          stores.find((x) => !["wheel", "mystery_box", "auction", "live_rip", "cosmetics"].includes((x.store_type as string) ?? ""))
        : stores.find((x) => (x.store_type as string) === (kind === "wheel" ? "wheel" : kind));
    if (pick) setInteraction({ kind: "store", id: pick.id as string });
  });

  const mapWidth = mapBundle?.map.width ?? 2400;
  const mapHeight = mapBundle?.map.height ?? 720;
  const bgColor = (mapBundle?.map as { background_color?: string | null } | undefined)?.background_color ?? null;
  const bgTheme = (mapBundle?.map as unknown as { background_theme?: string | null } | undefined)?.background_theme ?? "classic_sky";
  const bgUrl = (mapBundle?.map as { background_url?: string | null } | undefined)?.background_url ?? null;
  const dimension = (mapBundle?.map as { dimension?: string } | undefined)?.dimension || "2d";
  const is3D = dimension === "3d";
  const isCoolEnv = dimension === "cool_env";
  const touchInputRef = useRef<{ x: number; y: number; jump: boolean; rotate: number }>({ x: 0, y: 0, jump: false, rotate: 0 });


  return (
    <div className="mx-auto max-w-[1600px] p-2 md:p-4">
      <QuestProgressToast />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide text-foreground/80">
                {mapBundle?.map?.name || "מפה"}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/40">
                {isCoolEnv ? "✨ 2.5D עומק" : is3D ? "🧊 3D" : "🎬 2D"}
              </span>
            </div>

            <button
              onClick={() => {
                clearAllMapCaches(activeMapId ?? undefined);
                resetFirestoreCache("map_objects");
                resetFirestoreCache("map_versions");
                resetFirestoreCache("maps");
                queryClient.invalidateQueries({ queryKey: ["active-map"] });
                queryClient.invalidateQueries({ queryKey: ["active-map", activeMapId] });
                queryClient.refetchQueries({ queryKey: ["active-map", activeMapId] });
                toast.success("המפה רועננה והמטמון נוקה ישירות מהשרת! 🔄");
              }}
              type="button"
              className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground bg-background/80 hover:bg-muted/80 border border-border/60 px-2.5 py-0.5 rounded-full shadow-xs transition-all cursor-pointer"
              title="נקה מטמון ורענן את המפה ישירות מהשרת"
            >
              <span>🔄</span>
              <span>רענן מפה</span>
            </button>
          </div>

          <div data-tour="game-viewport" className="relative">
            {mapBundle?.map ? (
              isCoolEnv ? (
                <CoolEnvironmentViewport
                  width={mapWidth}
                  height={mapHeight}
                  viewportWidth={isMobile ? 720 : 1400}
                  viewportHeight={isMobile ? 900 : 760}
                  mapId={mapBundle.map.id}
                  objects={mapBundle.objects}
                  stores={stores}
                  npcs={npcs}
                  isPublicRoom={(mapBundle.map as { is_public_room?: boolean }).is_public_room !== false}
                  backgroundColor={bgColor}
                  backgroundTheme={bgTheme}
                  floorType={(mapBundle.map as unknown as { floor_type?: string | null }).floor_type ?? "wood"}
                  floorColor={(mapBundle.map as unknown as { floor_color?: string | null }).floor_color ?? null}
                  floorTextureUrl={(mapBundle.map as unknown as { floor_texture_url?: string | null }).floor_texture_url ?? null}
                  touchInputRef={touchInputRef}
                  onInteract={openInteraction}
                  onNearby={setNearby}
                  onInspectPlayer={setInspectedPlayer}
                />
              ) : is3D ? (
                <Game3DViewport
                  width={mapWidth}
                  height={mapHeight}
                  viewportWidth={isMobile ? 720 : 1400}
                  viewportHeight={isMobile ? 900 : 760}
                  mapId={mapBundle.map.id}
                  objects={mapBundle.objects}
                  stores={stores}
                  npcs={npcs}
                  isPublicRoom={(mapBundle.map as { is_public_room?: boolean }).is_public_room !== false}
                  backgroundColor={bgColor}
                  floorType={(mapBundle.map as unknown as { floor_type?: string | null }).floor_type ?? "grass"}
                  floorColor={(mapBundle.map as unknown as { floor_color?: string | null }).floor_color ?? null}
                  floorTextureUrl={(mapBundle.map as unknown as { floor_texture_url?: string | null }).floor_texture_url ?? null}
                  touchInputRef={touchInputRef}
                  onInteract={openInteraction}
                  onNearby={setNearby}
                  onInspectPlayer={setInspectedPlayer}
                />
              ) : (
              <GameViewport
                width={mapWidth}
                height={mapHeight}
                viewportWidth={isMobile ? 720 : 1400}
                viewportHeight={isMobile ? 1000 : 760}
                mapId={mapBundle.map.id}
                objects={mapBundle.objects}
                stores={stores}
                npcs={npcs}
                isPublicRoom={(mapBundle.map as { is_public_room?: boolean }).is_public_room !== false}
                backgroundColor={bgColor}
                backgroundTheme={bgTheme}
                backgroundUrl={bgUrl}
                touchInputRef={touchInputRef}
                onInteract={openInteraction}
                onNearby={setNearby}
                onInspectPlayer={setInspectedPlayer}
              />
              )
            ) : (

              <div className="grid h-[400px] place-items-center rounded-3xl border-4 border-white bg-gradient-to-b from-pink-100 to-sky-100 text-sm text-muted-foreground shadow-xl">
                {t("common.loading")}
              </div>
            )}

            {/* Nearby prompt */}
            {nearby && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 grid place-items-center px-2 md:bottom-4">
                <div className="pointer-events-auto flex max-w-full flex-nowrap items-center gap-1 rounded-full border-2 border-white bg-white/95 px-2 py-1 shadow-2xl backdrop-blur md:gap-2 md:border-4 md:px-4 md:py-2">
                  <span className="text-base md:text-2xl">
                    {nearby.kind === "store" ? "🏪" : nearby.kind === "door" ? "🚪" : nearby.kind === "treasure" ? "🧰" : nearby.kind === "arcade" ? "🕹️" : "🙋"}
                  </span>
                  <span className="max-w-[6.5rem] truncate text-[10px] font-black md:max-w-none md:text-sm">{nearby.name}</span>
                  {nearby.kind === "arcade" && (
                    <button
                      className="btn-plastic !px-2.5 !py-1 text-[10px] leading-none md:!px-3 md:!py-1.5 md:text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md"
                      onClick={() => {
                        const gId = (nearby as any).minigameId || nearby.id;
                        const normalized = gId.includes("pack") ? "pack_rip" : gId.includes("grading") ? "grading_masher" : "catch_card";
                        setActiveMinigame(normalized);
                      }}
                    >
                      🕹️ לשחק עכשיו!
                    </button>
                  )}
                  {nearby.kind === "store" && (
                    <>
                      <button className="btn-plastic !px-2 !py-1 text-[9px] leading-none md:!px-3 md:!py-1.5 md:text-xs" onClick={() => openInteraction("store", nearby.id)}>
                        🛍️ <span className="hidden md:inline">{t("play.enterStore")}</span><span className="md:hidden">קטלוג</span>
                      </button>
                      <button className="btn-plastic !px-2 !py-1 text-[9px] leading-none md:!px-3 md:!py-1.5 md:text-xs" onClick={startFromNearby} style={{ background: "linear-gradient(180deg,#fde68a,#f59e0b)" }}>
                        💬 <span className="hidden md:inline">{t("play.chatOwner")}</span><span className="md:hidden">שיחה</span>
                      </button>
                    </>
                  )}
                  {nearby.kind === "npc" && (
                    <button className="btn-plastic !px-2 !py-1 text-[9px] leading-none md:!px-3 md:!py-1.5 md:text-xs" onClick={startFromNearby}>
                      💬 {t("play.talkNpc")}
                    </button>
                  )}
                  {nearby.kind === "treasure" && (
                    <button className="btn-plastic !px-2 !py-1 text-[9px] leading-none md:!px-3 md:!py-1.5 md:text-xs" onClick={() => openInteraction("treasure", nearby.id)}>
                      🧰 פתיחת תיבה
                    </button>
                  )}
                  {nearby.kind === "screen" && (
                    <button
                      className="btn-plastic !px-2 !py-1 text-[9px] leading-none md:!px-3 md:!py-1.5 md:text-xs"
                      onClick={() =>
                        openInteraction("screen", nearby.id, {
                          title: nearby.name,
                          text: (nearby as { text?: string }).text,
                          imageUrl: (nearby as { imageUrl?: string | null }).imageUrl,
                        })
                      }
                    >
                      📺 צפה במסך
                    </button>
                  )}
                  {nearby.kind === "door" && (
                    <button className="btn-plastic !px-2 !py-1 text-[9px] leading-none md:!px-3 md:!py-1.5 md:text-xs" onClick={() => openInteraction("door", nearby.id, { targetMapId: nearby.targetMapId })}>
                      🚪 {t("play.enterDoor") || "היכנסו"}
                    </button>
                  )}

                </div>
              </div>
            )}

            {/* Mobile dual joystick controls */}
            <MobileJoystick touchInputRef={touchInputRef} mode={isCoolEnv ? "cool_env" : is3D ? "3d" : "2d"} />
          </div>


          {/* Chat toggle below */}
          <div data-tour="global-chat" className="mt-3">
            <button
              onClick={() => setShowChat((v) => !v)}
              className="chrome-panel flex w-full items-center justify-between px-4 py-2 text-sm font-bold"
            >
              <span>💬 {t("play.chat")}</span>
              <span className="text-xs opacity-70">{showChat ? "▾" : "▸"}</span>
            </button>
            {showChat && (
              <div className="mt-2">
                <GlobalChat />
              </div>
            )}
          </div>
        </div>
        <aside className="space-y-3">
          <div data-tour="active-players"><ActivePlayers /></div>
          <div className="chrome-panel p-3 text-xs">
            <div className="mb-1 font-bold">💡 Tip</div>
            {t("play.tip")}
          </div>
        </aside>
      </div>
      {interaction && interaction.kind === "store" && (
        <StoreModal
          storeId={interaction.id}
          onClose={() => setInteraction(null)}
          onChat={() => { const s = stores.find((x) => x.id === interaction.id); if (s) startConversationWith("store", s.id, s.name); setInteraction(null); }}
        />
      )}
      {treasureId && <TreasureView boxId={treasureId} onClose={() => setTreasureId(null)} />}
      {chatOverlay && (
        <ChatOverlay
          conversationId={chatOverlay.conversationId}
          name={chatOverlay.name}
          onClose={() => setChatOverlay(null)}
        />
      )}
      {inspectedPlayer && (
        <PlayerInspectModal
          playerId={inspectedPlayer.user_id}
          initialUsername={inspectedPlayer.username}
          onClose={() => setInspectedPlayer(null)}
          onStartChat={(pid, uname) => startConversationWith("npc", pid, uname)}
        />
      )}

      {/* Screen View Modal Popup */}
      {screenModalData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setScreenModalData(null)}
        >
          <div
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border-2 border-cyan-400/40 bg-slate-900/95 p-5 md:p-6 shadow-2xl shadow-cyan-500/20 text-white"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/20 p-2.5 text-cyan-400 border border-cyan-500/30">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white tracking-wide">
                    {screenModalData.title || "מסך תצוגה"}
                  </h3>
                  <p className="text-xs text-cyan-400 font-medium">שידור חי / תוכן מסך מולטימדיה</p>
                </div>
              </div>
              <button
                onClick={() => setScreenModalData(null)}
                className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                title="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {screenModalData.imageUrl && (
                <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/50 shadow-inner">
                  <img
                    src={screenModalData.imageUrl}
                    alt={screenModalData.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full max-h-[380px] object-contain rounded-2xl mx-auto"
                  />
                </div>
              )}

              {screenModalData.text && (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200 font-medium">
                    {screenModalData.text}
                  </p>
                </div>
              )}

              {!screenModalData.imageUrl && !screenModalData.text && (
                <div className="py-8 text-center text-white/50 text-sm">
                  אין תוכן מוגדר כרגע במסך זה.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setScreenModalData(null)}
                className="btn-plastic !px-6 !py-2 text-sm font-bold"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔬 1. The Professor Daily Quiz Modal */}
      {activeProfessorNpc && (
        <ProfessorQuizModal
          npc={activeProfessorNpc}
          onClose={() => setActiveProfessorNpc(null)}
        />
      )}

      {/* 🕵️ 2. Mystery Vendor Roaming Store Modal */}
      {activeMysteryNpc && (
        <MysteryVendorModal
          npc={activeMysteryNpc}
          onClose={() => setActiveMysteryNpc(null)}
        />
      )}

      {/* 🏴‍☠️ 3. Pirate Clue-to-Clue Help Modal */}
      {activePirateNpc && (
        <PirateCluesModal
          npc={activePirateNpc}
          onClose={() => setActivePirateNpc(null)}
        />
      )}

      {/* 💂 4. VIP Guard / Bouncer Check Modal */}
      {bouncerCheck && (
        <BouncerCheckModal
          rule={bouncerCheck.rule}
          roomName={bouncerCheck.roomName}
          userLevel={profile?.level || 1}
          userCosmetics={profile?.equipped_cosmetics || []}
          userAlbumCards={[]}
          onSuccess={() => {
            if (bouncerCheck.targetMapId) {
              try {
                localStorage.setItem("colt_last_map_id", bouncerCheck.targetMapId);
              } catch {}
              setActiveMapId(bouncerCheck.targetMapId);
              toast.success("שומר השער אפשר את כניסתך! ברוך הבא 🚪");
            }
            setBouncerCheck(null);
          }}
          onClose={() => setBouncerCheck(null)}
        />
      )}

      {/* 📢 5. Group Buy & Waitlist Matchmaker Modal */}
      {activeMatchmakerNpc && (
        <MatchmakerModal
          npc={activeMatchmakerNpc}
          onClose={() => setActiveMatchmakerNpc(null)}
        />
      )}

      {/* 🕹️ Arcade Minigame 1: Catch The Card */}
      {activeMinigame === "catch_card" && (
        <CatchCardGameModal onClose={() => setActiveMinigame(null)} />
      )}

      {/* 🕹️ Arcade Minigame 2: Pack Rip Precision */}
      {activeMinigame === "pack_rip" && (
        <PackRipPrecisionModal onClose={() => setActiveMinigame(null)} />
      )}

      {/* 🕹️ Arcade Minigame 3: Grading Button Masher */}
      {activeMinigame === "grading_masher" && (
        <GradingMasherModal onClose={() => setActiveMinigame(null)} />
      )}

    </div>
  );
}

function StoreModal({ storeId, onClose, onChat }: { storeId: string; onClose: () => void; onChat: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "product" | "cosmetic"; name: string; price: number; isFree?: boolean; image?: string | null } | null>(null);

  useEffect(() => {
    if (storeId) {
      trackQuestAction("visit_stores", 1, { storeId });
      supabase.rpc("progress_quest", { _action_type: "visit_store", _amount: 1 }).then(() => {});
    }
  }, [storeId]);
  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("stores").select("*").eq("id", storeId).maybeSingle()).data,
  });
  const { data: products = [], isPending: productsPending } = useQuery({
    queryKey: ["store-products", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("products").select("*").or(`store_id.eq.${storeId},store_ids.cs.{${storeId}}`).eq("active", true).order("credit_price")).data ?? [],
  });
  const { data: cosmetics = [], isPending: cosmeticsPending } = useQuery({
    queryKey: ["store-cosmetics", storeId],
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await supabase.from("cosmetics").select("*").eq("store_id", storeId).eq("active", true).order("credit_price")).data ?? [],
  });
  const storeLoading = productsPending || cosmeticsPending;

  const pushWooStock = useServerFn(syncWooStock);

  const buy = async (id: string, kind: "product" | "cosmetic") => {
    setConfirm(null);
    setBuyingId(id);
    const rpc = kind === "product" ? "purchase_product" : "purchase_cosmetic";
    const paramKey = kind === "product" ? "_product_id" : "_cosmetic_id";
    const { data, error } = await supabase.rpc(rpc as never, { [paramKey]: id } as never);
    setBuyingId(null);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok?: boolean; new_balance?: number } | null;
    if (res?.ok) {
      toast.success(kind === "product" ? "המוצר נרכש! 🎉" : "פריט חדש בארון 🎉");
      if (kind === "product") {
        pushWooStock({ data: { product_id: id } }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
      window.dispatchEvent(new Event("credits-changed"));
      qc.invalidateQueries({ queryKey: ["store-products", storeId] });
      qc.invalidateQueries({ queryKey: ["store-cosmetics", storeId] });
      qc.invalidateQueries({ queryKey: ["inv"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    }
  };


  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div data-tour="store-modal" className="chrome-panel w-full max-w-3xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-pink-200 via-purple-100 to-sky-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 text-xs font-bold text-primary">🏪 חנות</div>
              <h2 className="truncate text-2xl font-black">{store?.name ?? "Store"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{store?.description}</p>
            </div>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-md">✕</button>
          </div>
          {!storeLoading && !(products.length === 0 && cosmetics.length === 0 && store?.store_type !== "wheel" && store?.store_type !== "mystery_box" && store?.store_type !== "auction" && store?.store_type !== "live_rip") && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-plastic text-xs" onClick={onChat}>💬 {t("play.chatOwner")}</button>
            </div>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {storeLoading ? (
            <div dir="rtl" className="grid gap-3 py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm font-bold text-muted-foreground">טוען את החנות…</p>
            </div>
          ) : store?.store_type === "wheel" ? (
            <WheelView storeId={storeId} />
          ) : store?.store_type === "mystery_box" ? (
            <MysteryView storeId={storeId} />
          ) : store?.store_type === "auction" ? (
            <AuctionView storeId={storeId} />
          ) : store?.store_type === "live_rip" ? (
            <LiveRipView storeId={storeId} />
          ) : store?.store_type === "cosmetics" && cosmetics.length > 0 && products.length === 0 ? (
            <SkinsMarket />
          ) : products.length === 0 && cosmetics.length === 0 ? (
            <ComingSoonCard onChat={onChat} chatLabel={t("play.chatOwner")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {products.map((p) => {
                const soldOut = !(p as { unlimited_stock: boolean }).unlimited_stock && ((p as { stock: number | null }).stock ?? 0) <= 0;
                return (
                  <div key={p.id} className="chrome-panel overflow-hidden p-0 relative">
                    {soldOut && <div className="absolute right-2 top-2 z-10 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">אזל</div>}
                    <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100">
                      {p.image_url ? (<img src={p.image_url as string} alt={p.name as string} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />) : (<div className="grid h-full w-full place-items-center text-5xl">📦</div>)}
                    </div>
                    <div className="p-3">
                      <div className="font-bold">{p.name}</div>
                      {p.description && <div className="line-clamp-2 text-xs text-muted-foreground">{p.description}</div>}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-black text-primary">💎 {p.credit_price}</span>
                        <button className="btn-plastic text-xs disabled:opacity-40" disabled={soldOut || buyingId === p.id} onClick={() => setConfirm({ id: p.id as string, kind: "product", name: p.name as string, price: p.credit_price as number, image: (p.image_url as string | null) ?? null })}>
                          {soldOut ? "אזל" : buyingId === p.id ? "…" : t("play.buy")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {cosmetics.map((c) => (
                <div key={c.id} className="chrome-panel overflow-hidden p-0">
                  <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-yellow-100 to-pink-100">
                    {(c.thumbnail_url || c.sprite_right_url) ? (
                      <img src={(c.thumbnail_url ?? c.sprite_right_url) as string} alt={c.name as string} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
                    ) : (<div className="grid h-full w-full place-items-center text-5xl">👕</div>)}
                  </div>
                  <div className="p-3">
                    <div className="font-bold">{c.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{c.layer_type}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-lg font-black text-primary">💎 {c.is_free ? "חינם" : c.credit_price}</span>
                      <button className="btn-plastic text-xs disabled:opacity-40" disabled={buyingId === c.id} onClick={() => setConfirm({ id: c.id as string, kind: "cosmetic", name: c.name as string, price: c.credit_price as number, isFree: c.is_free as boolean, image: ((c.thumbnail_url ?? c.sprite_right_url) as string | null) ?? null })}>
                        {buyingId === c.id ? "…" : t("play.buy")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {confirm && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={() => setConfirm(null)}>
          <div dir="rtl" className="chrome-panel w-full max-w-sm p-5 text-center" onClick={(e) => e.stopPropagation()}>
            {confirm.image && <img src={confirm.image} alt={confirm.name} loading="lazy" decoding="async" className="mx-auto mb-3 h-24 w-24 rounded-xl bg-muted object-contain p-1" />}
            <h3 className="text-lg font-black">לאשר רכישה?</h3>
            <p className="mt-1 text-sm font-bold">{confirm.name}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {confirm.isFree
                ? "הפריט יתווסף לחשבונכם בחינם."
                : <>הפעולה תוריד <span className="font-black text-primary">💎 {confirm.price}</span> ממאזן הקרדיטים שלכם ולא ניתנת להשבה.</>}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button onClick={() => setConfirm(null)} className="chrome-panel px-4 py-2 text-sm">ביטול</button>
              <button onClick={() => buy(confirm.id, confirm.kind)} disabled={buyingId === confirm.id} className="btn-plastic text-sm disabled:opacity-40">
                {buyingId === confirm.id ? "…" : "כן, לרכוש ✅"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoonCard({ onChat, chatLabel }: { onChat: () => void; chatLabel: string }) {
  return (
    <div dir="rtl" className="relative mx-auto my-4 max-w-lg overflow-hidden rounded-3xl bg-gradient-to-br from-pink-100 via-purple-100 to-sky-100 p-8 text-center shadow-inner ring-1 ring-white/60">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pink-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="relative">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary shadow-sm">
          ✨ מודעה ✨
        </div>
        <h3 className="bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 bg-clip-text text-5xl font-black tracking-tight text-transparent md:text-6xl">
          COMING SOON
        </h3>
        <p className="mt-3 text-lg font-bold text-foreground">הישארו / חזרו בהמשך כדי לבדוק מה חדש</p>
        <p className="mt-1 text-xs text-muted-foreground">המשיכו להסתובב בכנס ובחנויות אחרות בינתיים.</p>
        <div className="mt-5 flex justify-center">
          <button className="btn-plastic text-sm" onClick={onChat}>💬 {chatLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ChatOverlay({ conversationId, name, onClose }: { conversationId: string; name: string; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: rawMessages = [] } = useQuery({
    queryKey: ["conv-messages", conversationId],
    queryFn: async () => (await supabase.from("conversation_messages").select("*").eq("conversation_id", conversationId).order("created_at")).data ?? [],
    refetchInterval: 3000,
  });
  const messages = Array.from(new Map(rawMessages.map((m: any) => [m.id, m])).values());

  useEffect(() => {
    const ch = supabase
      .channel(`conv-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        qc.invalidateQueries({ queryKey: ["conv-messages", conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  const send = async () => {
    if (!text.trim() || !user) return;
    const body = text.trim();
    setText("");
    const now = new Date().toISOString();
    const msgId = crypto.randomUUID();

    await supabase.from("conversation_messages").insert({
      id: msgId,
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: "user",
      body,
      created_at: now,
    });

    const { data: conv } = await supabase.from("store_conversations").select("unread_owner").eq("id", conversationId).maybeSingle();
    const currentUnread = Number(conv?.unread_owner) || 0;
    await supabase.from("store_conversations").update({
      last_message_at: now,
      unread_owner: currentUnread + 1,
      status: "open",
    }).eq("id", conversationId);

    qc.invalidateQueries({ queryKey: ["conv-messages", conversationId] });
    qc.invalidateQueries({ queryKey: ["owner-convs"] });
    qc.invalidateQueries({ queryKey: ["owner-tab-alerts"] });
    qc.invalidateQueries({ queryKey: ["owner-stats"] });
  };

  return (
    <div className="absolute bottom-6 left-1/2 z-30 w-[min(420px,90%)] -translate-x-1/2 chrome-panel overflow-hidden p-0 shadow-2xl">
      <div className="flex items-center justify-between bg-gradient-to-r from-pink-400 to-purple-400 px-4 py-2 text-white">
        <div className="font-black">💬 {name}</div>
        <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/25">✕</button>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && <div className="text-center text-xs text-muted-foreground">{t("msg.write")}</div>}
        {messages.map((m, idx) => {
          const mine = (m as { sender_id: string }).sender_id === user?.id;
          return (
            <div key={(m as { id: string }).id || `cm-${idx}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {(m as { body: string }).body}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          className="flex-1 rounded-full border-2 border-border bg-input px-3 py-1.5 text-sm outline-none focus:border-primary"
          placeholder={t("msg.write")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <button onClick={send} className="btn-plastic text-xs">{t("play.send")}</button>
      </div>
    </div>
  );
}

function MobileJoystick({
  touchInputRef,
  mode = "2d",
}: {
  touchInputRef: MutableRefObject<{ x: number; y: number; jump: boolean; rotate: number }>;
  mode?: "2d" | "3d" | "cool_env";
}) {
  // Move joystick (Left side: bottom-3 start-3)
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0 });
  const [moveActive, setMoveActive] = useState(false);
  const moveRef = useRef<HTMLDivElement>(null);

  // Camera rotation joystick (Right side: bottom-3 end-3)
  const [camKnob, setCamKnob] = useState({ x: 0, y: 0 });
  const [camActive, setCamActive] = useState(false);
  const camRef = useRef<HTMLDivElement>(null);

  const is3DOrCool = mode === "3d" || mode === "cool_env";

  const updateMove = (clientX: number, clientY: number) => {
    const el = moveRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = r.width / 2;
    const dist = Math.min(Math.hypot(dx, dy), max);
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * dist) / max;
    const ny = (Math.sin(angle) * dist) / max;
    setMoveKnob({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
    touchInputRef.current.x = nx;
    touchInputRef.current.y = ny;
    touchInputRef.current.jump = ny < -0.5;
  };

  const stopMove = () => {
    setMoveActive(false);
    setMoveKnob({ x: 0, y: 0 });
    touchInputRef.current.x = 0;
    touchInputRef.current.y = 0;
    touchInputRef.current.jump = false;
  };

  const updateCam = (clientX: number, clientY: number) => {
    const el = camRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = r.width / 2;
    const dist = Math.min(Math.hypot(dx, dy), max);
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * dist) / max;
    setCamKnob({ x: Math.cos(angle) * dist, y: 0 }); // Horizontal orbit rotation
    touchInputRef.current.rotate = nx; // Negative = rotate left (Q), Positive = rotate right (E)
  };

  const stopCam = () => {
    setCamActive(false);
    setCamKnob({ x: 0, y: 0 });
    touchInputRef.current.rotate = 0;
  };

  return (
    <div className="pointer-events-none absolute inset-0 md:hidden select-none">
      {/* 🎥 Left Side: Camera Rotation Joystick (2.5D/3D) OR Jump Button (2D) (Fixed to Physical Screen Left) */}
      {is3DOrCool ? (
        <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col items-center gap-1">
          {/* Camera Horizontal Orbit Rotation Joystick */}
          <div
            ref={camRef}
            className="relative grid h-20 w-20 place-items-center rounded-full border-2 border-cyan-400/80 bg-black/60 shadow-2xl backdrop-blur-md touch-none"
            onTouchStart={(e) => {
              setCamActive(true);
              updateCam(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={(e) => {
              updateCam(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchEnd={stopCam}
            onTouchCancel={stopCam}
            onPointerDown={(e) => {
              setCamActive(true);
              updateCam(e.clientX, e.clientY);
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (camActive) updateCam(e.clientX, e.clientY);
            }}
            onPointerUp={stopCam}
          >
            {/* Horizontal rotation guide indicators */}
            <span className="pointer-events-none absolute left-1.5 text-[9px] font-black text-cyan-400/80">⟲</span>
            <span className="pointer-events-none absolute right-1.5 text-[9px] font-black text-cyan-400/80">⟳</span>
            <div
              className="pointer-events-none h-8 w-8 rounded-full bg-cyan-500 shadow-lg ring-2 ring-white/80 transition-transform duration-75 flex items-center justify-center text-[10px] text-black font-extrabold"
              style={{ transform: `translate(${camKnob.x}px, 0px)` }}
            >
              🎥
            </div>
          </div>
          <span className="text-[9px] font-bold text-cyan-300 bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
            מצלמה 360°
          </span>
        </div>
      ) : (
        /* 2D Jump button */
        <div className="pointer-events-auto absolute bottom-4 left-3 flex flex-col items-center gap-1">
          <button
            className="grid h-14 w-14 place-items-center rounded-full border-2 border-white bg-primary text-xl text-primary-foreground shadow-2xl active:scale-95"
            onTouchStart={() => { touchInputRef.current.jump = true; }}
            onTouchEnd={() => { touchInputRef.current.jump = false; }}
            onPointerDown={() => { touchInputRef.current.jump = true; }}
            onPointerUp={() => { touchInputRef.current.jump = false; }}
          >
            ⤒
          </button>
          <span className="text-[9px] font-bold text-white/80 bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
            קפיצה
          </span>
        </div>
      )}

      {/* 🎮 Right Side: Movement Virtual Joystick (Fixed to Physical Screen Right) */}
      <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-center gap-1">
        <div
          ref={moveRef}
          className="relative grid h-20 w-20 place-items-center rounded-full border-2 border-white/80 bg-black/60 shadow-2xl backdrop-blur-md touch-none"
          onTouchStart={(e) => {
            setMoveActive(true);
            updateMove(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            updateMove(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchEnd={stopMove}
          onTouchCancel={stopMove}
          onPointerDown={(e) => {
            setMoveActive(true);
            updateMove(e.clientX, e.clientY);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (moveActive) updateMove(e.clientX, e.clientY);
          }}
          onPointerUp={stopMove}
        >
          {/* Directional ticks */}
          <div className="pointer-events-none absolute inset-1 rounded-full border border-white/10" />
          <div
            className="pointer-events-none h-8 w-8 rounded-full bg-primary shadow-lg ring-2 ring-white/80 transition-transform duration-75 flex items-center justify-center text-[10px] text-white font-bold"
            style={{ transform: `translate(${moveKnob.x}px, ${moveKnob.y}px)` }}
          >
            🕹️
          </div>
        </div>
        <span className="text-[9px] font-bold text-white/80 bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
          תנועה
        </span>
      </div>
    </div>
  );
}

