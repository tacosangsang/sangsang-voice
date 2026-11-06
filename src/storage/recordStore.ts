// 생성한 음성을 오래 남긴다. 새로고침하거나 다른 기기에서 열어도 다시 들을 수 있게 한다.
// 서버에 깃허브 저장소가 설정돼 있으면(GITHUB_TOKEN) 거기에, 없으면 이 브라우저의 IndexedDB에 저장한다.
// 다른 저장소(Drive 등)로 바꾸려면 RecordStore를 구현한다.

import {
  RecordingMeta,
  RecordingStatus,
  RecordingStoreName,
  recordingAudioUrl,
} from '../shared/recording';

export interface RecordStore<T> {
  /** 사람에게 보여 줄 저장 위치 */
  readonly target: string;
  list(): Promise<T[]>;
  put(record: T): Promise<void>;
}

/** 저장할 기록의 모양: id 칸, 음성 data URL 칸, 만든 시각. 나머지 칸은 그대로 저장한다. */
type Recordable = { createdAt: number };
type StringKey<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

// ---------- IndexedDB (이 브라우저에만) ----------

const DB_NAME = 'sangsang-voice';
const DB_VERSION = 2;

/** 브라우저 저장소 이름. takes는 예전 목소리 비교 저장 형식이라 읽기(옮기기)만 한다. */
export type LocalStoreName = RecordingStoreName | 'takes';

/** 저장소별 키 칸. 저장소를 늘리면 여기에 적고 DB_VERSION을 올린다. */
const KEY_PATHS: Record<LocalStoreName, string> = { takes: 'key', clips: 'id' };

let db: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(KEY_PATHS)) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

export class IndexedDbStore<T> implements RecordStore<T> {
  constructor(
    private readonly store: LocalStoreName,
    readonly target = '이 브라우저',
  ) {}

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

// ---------- 서버(깃허브) ----------

/** 서버 저장소. 음성은 파일로, 나머지 칸은 설명(meta.fields)으로 보내고, 불러올 때 음성 칸을 서버 주소로 바꾼다. */
export class ServerRecordStore<T extends Recordable> implements RecordStore<T> {
  constructor(
    private readonly store: RecordingStoreName,
    private readonly idKey: StringKey<T>,
    private readonly audioKey: StringKey<T>,
    readonly target: string,
  ) {}

  async list(): Promise<T[]> {
    const res = await fetch(`/api/recordings/${this.store}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `불러오기 실패 (${res.status})`);
    const metas = (await res.json()) as RecordingMeta[];
    return metas.map((m) => ({ ...m.fields, [this.audioKey]: recordingAudioUrl(this.store, m.id) }) as T);
  }

  async put(record: T): Promise<void> {
    const { [this.audioKey]: audioUrl, ...fields } = record;
    const match = /^data:([^;]+);base64,(.*)$/.exec(String(audioUrl));
    if (!match) throw new Error('음성이 data URL이 아니라 저장할 수 없습니다.');
    const meta: RecordingMeta = {
      id: String(record[this.idKey]),
      createdAt: record.createdAt,
      mimeType: match[1],
      fields,
    };
    const res = await fetch(`/api/recordings/${this.store}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta, audioBase64: match[2] }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `저장 실패 (${res.status})`);
  }
}

// ---------- 고르기 ----------

let status: Promise<RecordingStatus> | undefined;

function recordingStatus(): Promise<RecordingStatus> {
  status ??= fetch('/api/recordings/status')
    .then((r) => (r.ok ? r.json() : { enabled: false, reason: `상태 확인 실패 (${r.status})` }))
    .catch((e) => ({ enabled: false, reason: `상태 확인 실패: ${e?.message ?? e}` }));
  return status;
}

/** 서버 저장소가 켜져 있으면 그것을, 아니면 IndexedDB를 쓴다. */
export async function openRecordStore<T extends Recordable>(
  store: RecordingStoreName,
  idKey: StringKey<T>,
  audioKey: StringKey<T>,
): Promise<RecordStore<T>> {
  const s = await recordingStatus();
  if (s.enabled) return new ServerRecordStore<T>(store, idKey, audioKey, s.target ?? '서버');
  return new IndexedDbStore<T>(store, s.reason ? `이 브라우저 (깃허브 저장 꺼짐: ${s.reason})` : '이 브라우저');
}
