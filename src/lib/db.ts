// Всё хранится в IndexedDB браузера на устройстве ведущего (Н3, Н4).
const DB_NAME = 'svoya-igra';
const DB_VERSION = 1;

export type StoreName = 'games' | 'media' | 'sessions' | 'rosters' | 'history' | 'kv';
const STORES: StoreName[] = ['games', 'media', 'sessions', 'rosters', 'history', 'kv'];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('База данных занята другой вкладкой. Закройте её и обновите страницу.'));
    });
  }
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error('Транзакция прервана'));
      }),
  );
}

export const db = {
  get<T>(store: StoreName, id: string): Promise<T | undefined> {
    return run(store, 'readonly', (s) => s.get(id)) as Promise<T | undefined>;
  },
  getAll<T>(store: StoreName): Promise<T[]> {
    return run(store, 'readonly', (s) => s.getAll()) as Promise<T[]>;
  },
  put<T>(store: StoreName, value: T): Promise<void> {
    return run(store, 'readwrite', (s) => s.put(value)).then(() => undefined);
  },
  delete(store: StoreName, id: string): Promise<void> {
    return run(store, 'readwrite', (s) => s.delete(id)).then(() => undefined);
  },
};

/** Просим браузер не удалять данные при нехватке места. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}
