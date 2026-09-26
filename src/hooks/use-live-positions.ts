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

/** How often we broadcast our own position (ms). */
const SEND_MS = 60;
/** Smoothing rate for remote players (higher = snappier). */
const SMOOTH_K = 14;

/**
 * Realtime position sync over a Supabase broadcast channel.
 * Broadcasts are cheap (no DB writes), so we can push ~16 updates/sec and
 * interpolate between them for smooth movement of other players.
 */
export function useLivePositions(mapId: string | null | undefined, enabled: boolean, selfId?: string) {
  const entries = useRef<Map<string, Entry>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  const lastPayload = useRef<string>("");

  useEffect(() => {
    entries.current.clear();
    if (!enabled || !mapId) {
      channelRef.current = null;
      return;
    }
    const channel = supabase.channel(`pos-${mapId}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "pos" }, ({ payload }) => {
      const p = payload as { id?: string; x?: number; y?: number; f?: LiveFacing; m?: boolean };
      if (!p?.id || p.id === selfId || typeof p.x !== "number" || typeof p.y !== "number") return;
      const now = performance.now();
      const prev = entries.current.get(p.id);
      entries.current.set(p.id, {
        x: prev?.x ?? p.x,
        y: prev?.y ?? p.y,
        tx: p.x,
        ty: p.y,
        facing: p.f ?? prev?.facing ?? "right",
        moving: !!p.m,
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
    (x: number, y: number, facing: LiveFacing = "right", moving = false) => {
      const ch = channelRef.current;
      if (!ch || !selfId) return;
      const now = performance.now();
      const payload = `${Math.round(x)}|${Math.round(y)}|${facing}|${moving ? 1 : 0}`;
      if (now - lastSent.current < SEND_MS) return;
      if (payload === lastPayload.current && now - lastSent.current < 1000) return;
      lastSent.current = now;
      lastPayload.current = payload;
      ch.send({
        type: "broadcast",
        event: "pos",
        payload: { id: selfId, x: Math.round(x), y: Math.round(y), f: facing, m: moving },
      });
    },
    [selfId],
  );

  /** Interpolated position for a remote player, or undefined if no live data. */
  const sample = useCallback((id: string): LiveSample | undefined => {
    const e = entries.current.get(id);
    if (!e) return undefined;
    const now = performance.now();
    if (now - e.lastMsg > 10000) {
      entries.current.delete(id);
      return undefined;
    }
    const dt = Math.min(0.25, Math.max(0, (now - e.lastSample) / 1000));
    e.lastSample = now;
    const a = 1 - Math.exp(-SMOOTH_K * dt);
    e.x += (e.tx - e.x) * a;
    e.y += (e.ty - e.y) * a;
    const moving = e.moving && now - e.lastMsg < 400;
    return { x: e.x, y: e.y, facing: e.facing, moving };
  }, []);

  return { send, sample };
}
