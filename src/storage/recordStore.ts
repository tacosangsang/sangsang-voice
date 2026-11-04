// 생성한 음성을 브라우저에 오래 남긴다. 새로고침해도 다시 들을 수 있게 한다.
// 저장 위치는 이 브라우저의 IndexedDB라 다른 기기·브라우저와는 공유되지 않는다.
// 다른 저장소(서버, 클라우드)로 바꾸려면 RecordStore를 구현한다.

export interface RecordStore<T> {
  list(): Promise<T[]>;
  put(record: T): Promise<void>;
}

const DB_NAME = 'sangsang-voice';
const DB_VERSION = 2;

/** 저장소 이름과 키 칸. 저장소를 늘리면 여기에 적고 DB_VERSION을 올린다. */
const STORES = {
  /** 목소리 비교 테이크 */
  takes: 'key',
  /** 메인 화면 생성 클립 */
  clips: 'id',
} as const;

export type StoreName = keyof typeof STORES;

let db: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

export class IndexedDbStore<T> implements RecordStore<T> {
  constructor(private readonly store: StoreName) {}

  async list(): Promise<T[]> {
    const conn = await openDb();
    return new Promise((resolve, reject) => {
      const req = conn.transaction(this.store, 'readonly').objectStore(this.store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async put(record: T): Promise<void> {
    const conn = await openDb();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(this.store, 'readwrite');
      tx.objectStore(this.store).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
