import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

// IndexedDB audio blob storage for large MP3 / MP4 music files
const DB_NAME = "colt_audio_storage_db";
const STORE_NAME = "audio_blobs";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const objectUrlCache = new Map<string, string>();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      // Extract pure base64
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mime || "audio/mp3" });
}

/**
 * Saves an Audio / Video Blob (MP3, MP4, etc.) in IndexedDB & Firestore Cloud Sync
 * Returns an internal IDB URI: idb://<trackId>
 */
export async function saveAudioBlob(trackId: string, blob: Blob | File): Promise<string> {
  const dbInst = await getDB();
  const key = `audio-${trackId}`;

  // 1. Local IndexedDB storage for fast playback on this device
  await new Promise<void>((resolve, reject) => {
    const tx = dbInst.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(blob, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  const uri = `idb://${key}`;
  try {
    const old = objectUrlCache.get(uri);
    if (old) URL.revokeObjectURL(old);
    const objUrl = URL.createObjectURL(blob);
    objectUrlCache.set(uri, objUrl);
  } catch {}

  // 2. Cloud Firestore sync so mobile/tablet and all players can hear the audio
  try {
    const mime = blob.type || "audio/mp3";
    const base64 = await blobToBase64(blob);
    const CHUNK_SIZE = 700000; // 700KB chunks (safe for Firestore 1MB doc limit)

    if (base64.length <= CHUNK_SIZE) {
      await setDoc(doc(db, "audio_blobs", trackId), {
        id: trackId,
        mime,
        size: blob.size,
        data: base64,
        chunks_count: 1,
        updated_at: new Date().toISOString(),
      });
    } else {
      const totalChunks = Math.ceil(base64.length / CHUNK_SIZE);
      await setDoc(doc(db, "audio_blobs", trackId), {
        id: trackId,
        mime,
        size: blob.size,
        chunks_count: totalChunks,
        updated_at: new Date().toISOString(),
      });

      for (let i = 0; i < totalChunks; i++) {
        const chunkData = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await setDoc(doc(db, "audio_blobs", `${trackId}_chk_${i}`), {
          track_id: trackId,
          chunk_index: i,
          data: chunkData,
        });
      }
    }
  } catch (err) {
    console.warn("Could not sync audio to cloud Firestore:", err);
  }

  return uri;
}

const AUDIO_CACHE_NAME = "colt_audio_cache_v1";

/**
 * Resolves a track URL.
 * 1. If it's an idb:// URI:
 *    - Checks local IndexedDB first.
 *    - If missing locally (e.g. mobile accessing desktop upload), downloads from Firestore audio_blobs,
 *      caches in mobile IndexedDB, and creates ObjectURL.
 * 2. If it's a remote/external audio URL (http/https):
 *    - Checks in-memory objectUrlCache first (instant).
 *    - Checks the browser's CacheStorage.
 */
export async function resolveAudioUrl(url: string): Promise<string> {
  if (!url) return "";

  // Check in-memory object URL cache first
  if (objectUrlCache.has(url)) {
    return objectUrlCache.get(url)!;
  }

  // Case 1: IDB internal URI
  if (url.startsWith("idb://")) {
    const key = url.replace("idb://", "");
    const trackId = key.replace("audio-", "");

    // Check local IndexedDB first
    try {
      const idb = await getDB();
      const localBlob = await new Promise<Blob | undefined>((resolve) => {
        const tx = idb.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as Blob | undefined);
        req.onerror = () => resolve(undefined);
      });

      if (localBlob) {
        const objUrl = URL.createObjectURL(localBlob);
        objectUrlCache.set(url, objUrl);
        return objUrl;
      }
    } catch {}

    // Not found locally (e.g. on mobile): Fetch from cloud Firestore audio_blobs!
    try {
      const docSnap = await getDoc(doc(db, "audio_blobs", trackId));
      if (docSnap.exists()) {
        const docData = docSnap.data();
        const mime = docData?.mime || "audio/mp3";
        let fullBase64 = "";

        if (docData?.chunks_count && docData.chunks_count > 1) {
          const chunkPromises: Promise<string>[] = [];
          for (let i = 0; i < docData.chunks_count; i++) {
            chunkPromises.push(
              getDoc(doc(db, "audio_blobs", `${trackId}_chk_${i}`)).then((s) => (s.exists() ? s.data()?.data || "" : ""))
            );
          }
          const chunks = await Promise.all(chunkPromises);
          fullBase64 = chunks.join("");
        } else {
          fullBase64 = docData?.data || "";
        }

        if (fullBase64) {
          const blob = base64ToBlob(fullBase64, mime);
          // Cache into mobile IndexedDB for future visits
          try {
            const idb = await getDB();
            const tx = idb.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(blob, key);
          } catch {}

          const objUrl = URL.createObjectURL(blob);
          objectUrlCache.set(url, objUrl);
          return objUrl;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch cloud audio blob:", err);
    }

    return "";
  }

  // Case 2: Remote / Static URL (https://..., http://..., /storage_cache/...)
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const match = await cache.match(url);
      if (match) {
        const blob = await match.blob();
        const objUrl = URL.createObjectURL(blob);
        objectUrlCache.set(url, objUrl);
        return objUrl;
      }

      // Not in cache yet: fetch once, cache clone, and return ObjectURL
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) {
        await cache.put(url, res.clone());
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        objectUrlCache.set(url, objUrl);
        return objUrl;
      }
    } catch (e) {
      return url;
    }
  }

  return url;
}

/**
 * Deletes an audio Blob from IndexedDB & Firestore
 */
export async function deleteAudioBlob(url: string): Promise<void> {
  if (!url || !url.startsWith("idb://")) return;
  const key = url.replace("idb://", "");
  const trackId = key.replace("audio-", "");

  if (objectUrlCache.has(url)) {
    try {
      URL.revokeObjectURL(objectUrlCache.get(url)!);
      objectUrlCache.delete(url);
    } catch {}
  }

  try {
    const dbInst = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = dbInst.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  // Delete from Firestore
  try {
    const docSnap = await getDoc(doc(db, "audio_blobs", trackId));
    if (docSnap.exists()) {
      const chunksCount = docSnap.data()?.chunks_count || 1;
      await deleteDoc(doc(db, "audio_blobs", trackId));
      if (chunksCount > 1) {
        for (let i = 0; i < chunksCount; i++) {
          deleteDoc(doc(db, "audio_blobs", `${trackId}_chk_${i}`)).catch(() => {});
        }
      }
    }
  } catch {}
}
