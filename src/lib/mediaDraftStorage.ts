/**
 * IndexedDB helper for persisting media blobs (Story video/photo drafts, Voice note drafts)
 * so they survive page reloads, tab navigation, and browser closes without hitting
 * localStorage 5MB quota restrictions.
 */

const DB_NAME = "flick_media_drafts_db";
const DB_VERSION = 1;
const STORE_NAME = "media_drafts";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

/**
 * Save a Blob to IndexedDB
 */
export async function saveDraftBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`Failed to save blob for key ${key}`));
    });
  } catch (err) {
    console.warn("[DraftStorage] Error saving blob to IndexedDB:", err);
  }
}

/**
 * Retrieve a Blob from IndexedDB
 */
export async function getDraftBlob(key: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const result = req.result;
        if (result instanceof Blob) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => reject(req.error || new Error(`Failed to get blob for key ${key}`));
    });
  } catch (err) {
    console.warn("[DraftStorage] Error reading blob from IndexedDB:", err);
    return null;
  }
}

/**
 * Delete a Blob from IndexedDB
 */
export async function deleteDraftBlob(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`Failed to delete blob for key ${key}`));
    });
  } catch (err) {
    console.warn("[DraftStorage] Error deleting blob from IndexedDB:", err);
  }
}
