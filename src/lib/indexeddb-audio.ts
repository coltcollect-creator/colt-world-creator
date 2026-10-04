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

/**
 * Saves an Audio / Video Blob (MP3, MP4, etc.) in IndexedDB
 * Returns an internal IDB URI: idb://<trackId>
 */
export async function saveAudioBlob(trackId: string, blob: Blob | File): Promise<string> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const key = `audio-${trackId}`;
    const req = store.put(blob, key);

    req.onsuccess = () => {
      const uri = `idb://${key}`;
      // Pre-cache object URL for instant playback
      try {
        const old = objectUrlCache.get(uri);
        if (old) URL.revokeObjectURL(old);
        const objUrl = URL.createObjectURL(blob);
        objectUrlCache.set(uri, objUrl);
      } catch {}
      resolve(uri);
    };
    req.onerror = () => reject(req.error);
  });
}

const AUDIO_CACHE_NAME = "colt_audio_cache_v1";

/**
 * Resolves a track URL.
 * 1. If it's an idb:// URI, fetches the Blob from IndexedDB and returns a playable Object URL.
 * 2. If it's a remote/external audio URL (http/https or relative path):
 *    - Checks in-memory objectUrlCache first (instant).
 *    - Checks the browser's CacheStorage (`caches.open(AUDIO_CACHE_NAME)`).
 *    - If already cached locally, creates an Object URL from the cached Blob and returns it immediately (0 network requests!).
 *    - If not yet cached, fetches the audio file once, caches it in CacheStorage for future loops/sessions,
 *      and returns the local object URL.
 * Next time the track plays or loops: 0 server bytes consumed!
 */
export async function resolveAudioUrl(url: string): Promise<string> {
  if (!url) return "";

  // Check in-memory object URL cache first
  if (objectUrlCache.has(url)) {
    return objectUrlCache.get(url)!;
  }

  // Case 1: IDB internal URI
  if (url.startsWith("idb://")) {
    try {
      const db = await getDB();
      const key = url.replace("idb://", "");
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          const blob = req.result as Blob | undefined;
          if (blob) {
            const objUrl = URL.createObjectURL(blob);
            objectUrlCache.set(url, objUrl);
            resolve(objUrl);
          } else {
            resolve("");
          }
        };
        req.onerror = () => resolve("");
      });
    } catch {
      return "";
    }
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
      // Fallback to original URL if offline or CORS restricted
      return url;
    }
  }

  return url;
}

/**
 * Deletes an audio Blob from IndexedDB
 */
export async function deleteAudioBlob(url: string): Promise<void> {
  if (!url || !url.startsWith("idb://")) return;
  const key = url.replace("idb://", "");
  
  if (objectUrlCache.has(url)) {
    try {
      URL.revokeObjectURL(objectUrlCache.get(url)!);
      objectUrlCache.delete(url);
    } catch {}
  }

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}
