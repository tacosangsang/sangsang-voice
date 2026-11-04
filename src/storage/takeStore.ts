// 생성한 음성(테이크)을 브라우저에 오래 남긴다. 새로고침해도 다시 들을 수 있게 한다.
// 저장 위치는 이 브라우저의 IndexedDB라 다른 기기·브라우저와는 공유되지 않는다.
// 다른 저장소(서버, 클라우드)로 바꾸려면 TakeStore를 구현한다.

export interface StoredTake {
  /** 생성 조건을 이은 키(화자|목소리|대본 줄|지시문|언어) */
  key: string;
  /** data:audio/wav;base64,... */
  url: string;
  createdAt: number;
}

export interface TakeStore {
  list(): Promise<StoredTake[]>;
  put(take: StoredTake): Promise<void>;
}

const DB_NAME = 'sangsang-voice';
const STORE = 'takes';

export class IndexedDbTakeStore implements TakeStore {
  private db?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  async list(): Promise<StoredTake[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as StoredTake[]);
      req.onerror = () => reject(req.error);
    });
  }

  async put(take: StoredTake): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(take);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
