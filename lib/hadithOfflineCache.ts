import type { HadithItem } from './hadithApi';

const DB_NAME = 'MuslimLifeHadithCache';
const DB_VERSION = 1;
const BOOKMARK_STORE = 'bookmarks';
const LAST_VIEWED_STORE = 'lastViewed';

type LastViewedRecord = HadithItem & { viewed_at: number };

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKMARK_STORE)) {
        db.createObjectStore(BOOKMARK_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LAST_VIEWED_STORE)) {
        const store = db.createObjectStore(LAST_VIEWED_STORE, { keyPath: 'id' });
        store.createIndex('viewed_at', 'viewed_at');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
};

const runStoreAction = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    action(store, resolve, reject);
  });
};

export const cacheBookmarkItems = async (items: HadithItem[]): Promise<void> => {
  await runStoreAction<void>(BOOKMARK_STORE, 'readwrite', (store, resolve, reject) => {
    try {
      store.clear();
      items.forEach((item) => store.put(item));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const removeCachedBookmark = async (id: string): Promise<void> => {
  await runStoreAction<void>(BOOKMARK_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getCachedBookmarks = async (): Promise<HadithItem[]> => {
  return runStoreAction<HadithItem[]>(BOOKMARK_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const data = (request.result as HadithItem[]) || [];
      resolve(
        data.sort((a, b) =>
          `${b.collection}${b.hadith_number}`.localeCompare(`${a.collection}${a.hadith_number}`)
        )
      );
    };
    request.onerror = () => reject(request.error);
  });
};

export const cacheLastViewed = async (item: HadithItem): Promise<void> => {
  await runStoreAction<void>(LAST_VIEWED_STORE, 'readwrite', (store, resolve, reject) => {
    const payload: LastViewedRecord = {
      ...item,
      viewed_at: Date.now(),
    };
    const request = store.put(payload);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getLastViewed = async (limit = 20): Promise<HadithItem[]> => {
  const data = await runStoreAction<LastViewedRecord[]>(
    LAST_VIEWED_STORE,
    'readonly',
    (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as LastViewedRecord[]) || []);
      request.onerror = () => reject(request.error);
    }
  );

  return data
    .sort((a, b) => b.viewed_at - a.viewed_at)
    .slice(0, limit)
    .map(({ viewed_at, ...rest }) => rest);
};

export const trimLastViewed = async (limit = 20): Promise<void> => {
  const data = await runStoreAction<LastViewedRecord[]>(
    LAST_VIEWED_STORE,
    'readonly',
    (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as LastViewedRecord[]) || []);
      request.onerror = () => reject(request.error);
    }
  );

  const overflow = data
    .sort((a, b) => b.viewed_at - a.viewed_at)
    .slice(limit)
    .map((item) => item.id);

  if (overflow.length === 0) return;

  await runStoreAction<void>(LAST_VIEWED_STORE, 'readwrite', (store, resolve, reject) => {
    try {
      overflow.forEach((id) => store.delete(id));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};
