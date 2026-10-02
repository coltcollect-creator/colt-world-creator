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

/**
 * Resolves a track URL. If it's an idb:// URI, fetches the Blob from IndexedDB
 * and returns a playable Object URL. Otherwise returns the original URL string.
 */
export async function resolveAudioUrl(url: string): Promise<string> {
  if (!url) return "";
  if (!url.startsWith("idb://")) {
    return url;
  }

  // Check cache first
  if (objectUrlCache.has(url)) {
    return objectUrlCache.get(url)!;
  }

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
