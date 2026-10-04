import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveFacing = "left" | "right";

type Entry = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  facing: LiveFacing;
  moving: boolean;
  lastMsg: number;
  lastSample: number;
};

export type LiveSample = { x: number; y: number; facing: LiveFacing; moving: boolean };

/** How often we broadcast our own position when moving (ms). ~22 updates/sec over WebSockets is silky smooth */
const SEND_MS = 45;
/** Smoothing rate for remote players (higher = snappier, instant response). */
const SMOOTH_K = 22;

/**
 * Realtime position sync over a Supabase broadcast channel.
 * Uses client-side interpolation (lerp) so remote players move at 60 FPS
 * while network broadcast is only sent when the player is actually moving.
 */
export function useLivePositions(mapId: string | null | undefined, enabled: boolean, selfId?: string) {
  const entries = useRef<Map<string, Entry>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  const lastX = useRef<number | null>(null);
  const lastY = useRef<number | null>(null);
  const lastFacing = useRef<LiveFacing | null>(null);
  const lastMoving = useRef<boolean | null>(null);
  const stationarySent = useRef(false);

  useEffect(() => {
    entries.current.clear();
    lastX.current = null;
    lastY.current = null;
    lastFacing.current = null;
    lastMoving.current = null;
    stationarySent.current = false;

    if (!enabled || !mapId) {
      channelRef.current = null;
      return;
    }
    const channel = supabase.channel(`pos-${mapId}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "pos" }, ({ payload }) => {
      let id: string | undefined;
      let px: number | undefined;
      let py: number | undefined;
      let pf: LiveFacing = "right";
      let pm = false;

      // Handle compressed packed array [id, x, y, facing(0|1), moving(0|1)]
      if (Array.isArray(payload)) {
        id = payload[0];
        px = payload[1];
        py = payload[2];
        pf = payload[3] === 0 ? "left" : "right";
        pm = Boolean(payload[4]);
      } else if (payload && typeof payload === "object") {
        const p = payload as { id?: string; x?: number; y?: number; f?: LiveFacing; m?: boolean };
        id = p.id;
        px = p.x;
        py = p.y;
        pf = p.f ?? "right";
        pm = Boolean(p.m);
      }

      if (!id || id === selfId || typeof px !== "number" || typeof py !== "number") return;

      const now = performance.now();
      const prev = entries.current.get(id);
      entries.current.set(id, {
        x: prev?.x ?? px,
        y: prev?.y ?? py,
        tx: px,
        ty: py,
        facing: pf,
        moving: pm,
        lastMsg: now,
        lastSample: prev?.lastSample ?? now,
      });
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [mapId, enabled, selfId]);

  const send = useCallback(
    (x: number, y: number, facing: LiveFacing = "right", moving = false, isIdle = false) => {
      const ch = channelRef.current;
      if (!ch || !selfId) return;

      // If document is hidden (background tab) or player is idle (AFK >= 3 min), zero network traffic
      if (typeof document !== "undefined" && document.hidden) return;
      if (isIdle) return;

      const rx = Math.round(x);
      const ry = Math.round(y);
      const now = performance.now();

      const hasMoved =
        lastX.current === null ||
        Math.abs(rx - lastX.current) >= 2 ||
        Math.abs(ry - lastY.current) >= 2 ||
        facing !== lastFacing.current ||
        moving !== lastMoving.current;

      if (!moving) {
        // If we already sent the stopped frame, don't send anything more!
        if (stationarySent.current) {
          return;
        }
        stationarySent.current = true;
        // Don't throttle the stop event by SEND_MS - send immediately so others see stop instantly!
      } else {
        stationarySent.current = false;
        // Throttle only active walking movement
        if (now - lastSent.current < SEND_MS) return;
      }

      lastSent.current = now;
      lastX.current = rx;
      lastY.current = ry;
      lastFacing.current = facing;
      lastMoving.current = moving;

      // Send compressed packed array [id, x, y, facing, moving]
      ch.send({
        type: "broadcast",
        event: "pos",
        payload: [selfId, rx, ry, facing === "left" ? 0 : 1, moving ? 1 : 0],
      });
    },
    [selfId],
  );

  /** Interpolated position for a remote player, or undefined if no live data. */
  const sample = useCallback((id: string): LiveSample | undefined => {
    const e = entries.current.get(id);
    if (!e) return undefined;
    const now = performance.now();
    // Keep entries for 10 minutes so stationary players in the room remain visible
    if (now - e.lastMsg > 600000) {
      entries.current.delete(id);
      return undefined;
    }

    // If target position jumped significantly (e.g. teleport/respawn/delayed network), snap immediately to prevent flying across the map
    const jumpDist = Math.hypot(e.tx - e.x, e.ty - e.y);
    if (jumpDist > 250) {
      e.x = e.tx;
      e.y = e.ty;
    } else {
      const dt = Math.min(0.2, Math.max(0, (now - e.lastSample) / 1000));
      const a = 1 - Math.exp(-SMOOTH_K * dt);
      e.x += (e.tx - e.x) * a;
      e.y += (e.ty - e.y) * a;

      // Snap micro-jitter when very close to target for razor-sharp rendering
      if (Math.abs(e.tx - e.x) < 0.25) e.x = e.tx;
      if (Math.abs(e.ty - e.y) < 0.25) e.y = e.ty;
    }
    e.lastSample = now;

    const moving = e.moving && now - e.lastMsg < 1200;
    return { x: e.x, y: e.y, facing: e.facing, moving };
  }, []);

  /** Ingest remote player position directly (from Firestore realtime snapshot) */
  const feed = useCallback(
    (id: string, x: number, y: number, facing: LiveFacing = "right", moving = false) => {
      if (!id || id === selfId) return;
      const now = performance.now();
      const prev = entries.current.get(id);
      
      // If position changed by more than 200px or no previous record, snap immediately instead of slowly flying across the screen
      const dist = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
      const shouldSnap = !prev || dist > 200;

      entries.current.set(id, {
        x: shouldSnap ? x : prev!.x,
        y: shouldSnap ? y : prev!.y,
        tx: x,
        ty: y,
        facing: facing ?? prev?.facing ?? "right",
        moving: !!moving,
        lastMsg: now,
        lastSample: prev?.lastSample ?? now,
      });
    },
    [selfId]
  );

  return { send, sample, feed };
}
