import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameViewport, type MapObject } from "@/components/game/GameViewport";
import { Game3DViewport } from "@/components/game/Game3DViewport";

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

import { SkinsMarket } from "@/components/game/SkinsMarket";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServerFn } from "@tanstack/react-start";
import { syncWooStock } from "@/lib/woo.functions";
import { useTourAction } from "@/lib/tour";



export const Route = createFileRoute("/_authenticated/play")({
  component: PlayPage,
});

type Nearby =
  | { kind: "store"; id: string; name: string }
  | { kind: "npc"; id: string; name: string }
  | { kind: "door"; id: string; name: string; targetMapId?: string }
  | { kind: "treasure"; id: string; name: string }
  | null;

function PlayPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  
  const [interaction, setInteraction] = useState<{ kind: "store" | "npc"; id: string } | null>(null);
  const [treasureId, setTreasureId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Nearby>(null);

  const [chatOverlay, setChatOverlay] = useState<{ conversationId: string; name: string } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);

  const { data: mapBundle } = useQuery({
    queryKey: ["active-map", activeMapId],
    queryFn: async () => {
      const mapQuery = activeMapId
        ? supabase.from("maps").select("*").eq("id", activeMapId).maybeSingle()
        : supabase.from("maps").select("*").eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
      const { data: mapRow } = await mapQuery;
      
      const currentMap = mapRow || {
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

      const { data: version } = await supabase.from("map_versions").select("*").eq("map_id", currentMap.id).eq("status", "published").order("version_number", { ascending: false }).maybeSingle();
      let ver = version;
      if (!ver) {
        const { data: anyVer } = await supabase.from("map_versions").select("*").eq("map_id", currentMap.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
        ver = anyVer;
      }
      
      const verId = ver?.id || "34e2d77d-a542-4f2b-9425-cfe269c18636";
      const { data: objs } = await supabase.from("map_objects").select("*").eq("map_version_id", verId);
      
      const fallbackObjects: MapObject[] = [
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
      ];

      const finalObjs = objs && objs.length > 0 ? objs : fallbackObjects;
      return { map: currentMap, objects: finalObjs as unknown as MapObject[], version: ver || { id: verId } };
    },
  });

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
    // record login progress
    supabase.rpc("progress_quest", { _action_type: "login", _amount: 1 }).then(() => {});
    return () => { supabase.from("active_players").delete().eq("user_id", user.id).then(() => {}); };
  }, [user]);

  // NPC contact = start conversation. Store contact = open catalog modal.
  const openInteraction = async (kind: "store" | "npc" | "door" | "treasure", id: string, extra?: { targetMapId?: string }) => {
    if (kind === "door") {
      if (extra?.targetMapId) { setActiveMapId(extra.targetMapId); toast.success(t("play.enteredMap") || "Entered a new place"); }
      return;
    }
    if (kind === "treasure") {
      setTreasureId(id);
      return;
    }

    if (kind === "npc") {
      supabase.rpc("progress_quest", { _action_type: "visit_npc", _amount: 1 }).then(() => {});
      await startConversationWith("npc", id, npcs.find((n) => n.id === id)?.name ?? "NPC");
      return;
    }
    supabase.rpc("progress_quest", { _action_type: "visit_store", _amount: 1 }).then(() => {});
    setInteraction({ kind, id });
  };

  const startConversationWith = async (kind: "store" | "npc", id: string, name: string) => {
    if (!user) return;
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        subject: name,
        status: "open",
        created_at: new Date().toISOString(),
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
  const is3D = (mapBundle?.map as { dimension?: string } | undefined)?.dimension === "3d";
  const touchInputRef = useRef({ x: 0, y: 0, jump: false });


  return (
    <div className="mx-auto max-w-[1600px] p-2 md:p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
        <div>
          <div data-tour="game-viewport" className="relative">
            {mapBundle?.map ? (
              is3D ? (
                <Game3DViewport
                  width={mapWidth}
                  height={mapHeight}
                  viewportWidth={isMobile ? 720 : 1400}
                  viewportHeight={isMobile ? 900 : 760}
                  mapId={mapBundle.map.id}
                  objects={mapBundle.objects}
                  stores={stores}
                  npcs={npcs}
                  isPublicRoom={!!(mapBundle.map as { is_public_room?: boolean }).is_public_room}
                  backgroundColor={bgColor}
                  floorType={(mapBundle.map as unknown as { floor_type?: string | null }).floor_type ?? "grass"}
                  floorColor={(mapBundle.map as unknown as { floor_color?: string | null }).floor_color ?? null}
                  floorTextureUrl={(mapBundle.map as unknown as { floor_texture_url?: string | null }).floor_texture_url ?? null}
                  touchInputRef={touchInputRef}
                  onInteract={openInteraction}
                  onNearby={setNearby}
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
                isPublicRoom={!!(mapBundle.map as { is_public_room?: boolean }).is_public_room}
                backgroundColor={bgColor}
                touchInputRef={touchInputRef}
                onInteract={openInteraction}
                onNearby={setNearby}
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
                    {nearby.kind === "store" ? "🏪" : nearby.kind === "door" ? "🚪" : nearby.kind === "treasure" ? "🧰" : "🙋"}
                  </span>
                  <span className="max-w-[6.5rem] truncate text-[10px] font-black md:max-w-none md:text-sm">{nearby.name}</span>
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
                  {nearby.kind === "door" && (
                    <button className="btn-plastic !px-2 !py-1 text-[9px] leading-none md:!px-3 md:!py-1.5 md:text-xs" onClick={() => openInteraction("door", nearby.id, { targetMapId: nearby.targetMapId })}>
                      🚪 {t("play.enterDoor") || "היכנסו"}
                    </button>
                  )}

                </div>
              </div>
            )}

            {/* Mobile joystick */}
            <MobileJoystick touchInputRef={touchInputRef} />

            {/* Inline chat overlay */}
            {chatOverlay && (
              <ChatOverlay conversationId={chatOverlay.conversationId} name={chatOverlay.name} onClose={() => setChatOverlay(null)} />
            )}
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

    </div>
  );
}

function StoreModal({ storeId, onClose, onChat }: { storeId: string; onClose: () => void; onChat: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: "product" | "cosmetic"; name: string; price: number; isFree?: boolean; image?: string | null } | null>(null);
  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => (await supabase.from("stores").select("*").eq("id", storeId).maybeSingle()).data,
  });
  const { data: products = [], isPending: productsPending } = useQuery({
    queryKey: ["store-products", storeId],
    queryFn: async () => (await supabase.from("products").select("*").or(`store_id.eq.${storeId},store_ids.cs.{${storeId}}`).eq("active", true).order("credit_price")).data ?? [],
  });
  const { data: cosmetics = [], isPending: cosmeticsPending } = useQuery({
    queryKey: ["store-cosmetics", storeId],
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
            {confirm.image && <img src={confirm.image} alt={confirm.name} className="mx-auto mb-3 h-24 w-24 rounded-xl bg-muted object-contain p-1" />}
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
  const { data: messages = [] } = useQuery({
    queryKey: ["conv-messages", conversationId],
    queryFn: async () => (await supabase.from("conversation_messages").select("*").eq("conversation_id", conversationId).order("created_at")).data ?? [],
    refetchInterval: 3000,
  });

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
    await supabase.from("conversation_messages").insert({ conversation_id: conversationId, sender_id: user.id, sender_role: "user", body });
  };

  return (
    <div className="absolute bottom-6 left-1/2 z-30 w-[min(420px,90%)] -translate-x-1/2 chrome-panel overflow-hidden p-0 shadow-2xl">
      <div className="flex items-center justify-between bg-gradient-to-r from-pink-400 to-purple-400 px-4 py-2 text-white">
        <div className="font-black">💬 {name}</div>
        <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/25">✕</button>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && <div className="text-center text-xs text-muted-foreground">{t("msg.write")}</div>}
        {messages.map((m) => {
          const mine = (m as { sender_id: string }).sender_id === user?.id;
          return (
            <div key={(m as { id: string }).id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
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

function MobileJoystick({ touchInputRef }: { touchInputRef: MutableRefObject<{ x: number; y: number; jump: boolean }> }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const update = (clientX: number, clientY: number) => {
    const el = ref.current;
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
    setKnob({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
    touchInputRef.current.x = nx;
    touchInputRef.current.y = ny;
    touchInputRef.current.jump = ny < -0.5;
  };
  const stop = () => {
    setActive(false);
    setKnob({ x: 0, y: 0 });
    touchInputRef.current.x = 0;
    touchInputRef.current.y = 0;
    touchInputRef.current.jump = false;
  };

  return (
    <div className="pointer-events-none absolute inset-0 md:hidden">
      <div
        ref={ref}
        className="pointer-events-auto absolute bottom-3 end-3 grid h-20 w-20 place-items-center rounded-full border-2 border-white bg-white/60 shadow-xl backdrop-blur touch-none select-none"
        onTouchStart={(e) => { setActive(true); update(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={(e) => { update(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={stop}
        onTouchCancel={stop}
        onPointerDown={(e) => { setActive(true); update(e.clientX, e.clientY); (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (active) update(e.clientX, e.clientY); }}
        onPointerUp={stop}
      >
        <div
          className="pointer-events-none h-8 w-8 rounded-full bg-primary shadow-inner ring-2 ring-white/70"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>
      <div className="pointer-events-auto absolute bottom-4 start-3 flex flex-col items-center gap-1">
        <button
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-primary text-lg text-primary-foreground shadow-xl active:scale-95"
          onTouchStart={() => { touchInputRef.current.jump = true; }}
          onTouchEnd={() => { touchInputRef.current.jump = false; }}
          onPointerDown={() => { touchInputRef.current.jump = true; }}
          onPointerUp={() => { touchInputRef.current.jump = false; }}
        >⤒</button>
      </div>
    </div>
  );
}

