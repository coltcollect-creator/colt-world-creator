import { supabase, resetFirestoreCache } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

export interface PublishMapParams {
  mapId: string;
  versionId: string;
  mapName?: string;
}

/**
 * Purge cached map bundles from localStorage
 */
export function clearAllMapCaches(targetMapId?: string) {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (targetMapId) {
        if (key === `colt_map_bundle_${targetMapId}` || key.includes(targetMapId)) {
          keysToRemove.push(key);
        }
      } else {
        if (key.startsWith("colt_map_bundle_")) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    resetFirestoreCache("map_objects");
    resetFirestoreCache("map_versions");
    resetFirestoreCache("maps");
  } catch (err) {
    console.warn("Failed to clear map caches from localStorage:", err);
  }
}

/**
 * Publish a map version live to all players, invalidating caches across the system
 */
export async function publishMapVersion({ mapId, versionId, mapName }: PublishMapParams): Promise<boolean> {
  const publishToken = String(Date.now());
  const nowIso = new Date().toISOString();

  try {
    // 1. Archive other published versions for this map
    await supabase
      .from("map_versions")
      .update({ status: "archived" } as never)
      .eq("map_id", mapId)
      .eq("status", "published")
      .neq("id", versionId);

    // 2. Set this version as published with fresh timestamp and token
    const { error: verErr } = await supabase
      .from("map_versions")
      .update({
        status: "published",
        published_at: nowIso,
        updated_at: nowIso,
        publish_token: publishToken,
      } as never)
      .eq("id", versionId);

    if (verErr) {
      toast.error(`שגיאה בפרסום הגרסה: ${verErr.message}`);
      return false;
    }

    // 3. Update the map row metadata
    await supabase
      .from("maps")
      .update({
        published_at: nowIso,
        updated_at: nowIso,
        publish_token: publishToken,
      } as never)
      .eq("id", mapId);

    // 4. Update shared Firestore manifest for real-time live notification to all connected players
    try {
      const manifestRef = doc(db, "system_settings", "map_publish_manifest");
      await setDoc(
        manifestRef,
        {
          last_update: {
            map_id: mapId,
            version_id: versionId,
            published_at: nowIso,
            publish_token: publishToken,
          },
          [`map_${mapId}`]: {
            version_id: versionId,
            published_at: nowIso,
            publish_token: publishToken,
          },
        },
        { merge: true }
      );
    } catch (fsErr) {
      console.warn("Could not write map_publish_manifest to Firestore:", fsErr);
    }

    // 5. Clear all local browser caches
    clearAllMapCaches(mapId);
    resetFirestoreCache("map_objects");
    resetFirestoreCache("map_versions");
    resetFirestoreCache("maps");

    // 6. Broadcast event locally & cross-tab
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("colt-map-updated", {
          detail: { mapId, versionId, publishToken },
        })
      );

      try {
        const bc = new BroadcastChannel("colt_world_map_sync");
        bc.postMessage({ mapId, versionId, publishToken });
        setTimeout(() => bc.close(), 1000);
      } catch {}
    }

    toast.success(`המפה "${mapName || ""}" פורסמה בהצלחה בלייב לכל השחקנים! 🚀`);
    return true;
  } catch (err: any) {
    console.error("publishMapVersion error:", err);
    toast.error(err?.message || "שגיאה בפרסום המפה");
    return false;
  }
}

/**
 * Listen for live publish events from Firestore and local broadcast channels
 */
export function subscribeToMapPublishEvents(onUpdate: (data: { mapId: string; versionId?: string; publishToken?: string }) => void) {
  const unsubscribes: Array<() => void> = [];

  // Local window event
  if (typeof window !== "undefined") {
    const handleLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      onUpdate(detail);
    };
    window.addEventListener("colt-map-updated", handleLocal);
    unsubscribes.push(() => window.removeEventListener("colt-map-updated", handleLocal));

    // BroadcastChannel for cross-tab communication
    try {
      const bc = new BroadcastChannel("colt_world_map_sync");
      bc.onmessage = (msg) => {
        if (msg.data) onUpdate(msg.data);
      };
      unsubscribes.push(() => bc.close());
    } catch {}
  }

  // Firestore real-time listener for players across any device/browser
  try {
    const manifestRef = doc(db, "system_settings", "map_publish_manifest");
    let isInitial = true;
    const fsUnsub = onSnapshot(
      manifestRef,
      (snap) => {
        if (isInitial) {
          isInitial = false;
          return;
        }
        if (snap.exists()) {
          const data = snap.data();
          const last = data.last_update;
          if (last && last.map_id) {
            onUpdate({
              mapId: last.map_id,
              versionId: last.version_id,
              publishToken: last.publish_token,
            });
          }
        }
      },
      (err) => {
        console.warn("map_publish_manifest snapshot error:", err);
      }
    );
    unsubscribes.push(fsUnsub);
  } catch (err) {
    console.warn("Could not attach Firestore publish listener:", err);
  }

  return () => {
    unsubscribes.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}
