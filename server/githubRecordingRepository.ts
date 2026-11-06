// 생성한 음성을 깃허브 저장소의 한 브랜치에 쌓는다.
// 모양: <저장소 이름>/index.json(설명 목록) + <저장소 이름>/<id 해시>.wav
// 필요한 것: GITHUB_TOKEN(이 저장소 Contents 읽기·쓰기 권한), 브랜치가 미리 있어야 한다.

import { createHash } from 'crypto';
import { RecordingMeta, RecordingStoreName } from '../src/shared/recording';

export interface RecordingRepository {
  /** 사람에게 보여 줄 저장 위치 */
  readonly target: string;
  /** 저장소에 닿는지 확인한다. 안 되면 이유를 담아 던진다. */
  verify(): Promise<void>;
  list(store: RecordingStoreName): Promise<RecordingMeta[]>;
  save(store: RecordingStoreName, meta: RecordingMeta, audio: Buffer): Promise<void>;
  readAudio(store: RecordingStoreName, id: string): Promise<Buffer>;
}

const GITHUB_API = 'https://api.github.com';
const INDEX_RETRIES = 3;

interface ContentFile {
  sha: string;
  content: string;
}

class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class GitHubRecordingRepository implements RecordingRepository {
  readonly target: string;

  constructor(
    private readonly token: string,
    private readonly repo: string,
    private readonly branch: string,
  ) {
    this.target = `${repo}@${branch}`;
  }

  async verify(): Promise<void> {
    await this.request(`/branches/${encodeURIComponent(this.branch)}`);
  }

  async list(store: RecordingStoreName): Promise<RecordingMeta[]> {
    return (await this.readIndex(store)).records;
  }

  async save(store: RecordingStoreName, meta: RecordingMeta, audio: Buffer): Promise<void> {
    const audioPath = this.audioPath(store, meta.id);
    // 같은 id는 같은 음성이다. 이미 있으면 다시 올리지 않는다.
    const existing = await this.fileSha(audioPath);
    if (!existing) await this.putFile(audioPath, audio, `음성 저장 ${store}/${meta.id}`);

    // 여러 탭이 동시에 저장하면 index.json sha가 어긋난다. 다시 읽어 합친다.
    for (let attempt = 1; ; attempt++) {
      const index = await this.readIndex(store);
      if (index.records.some((r) => r.id === meta.id)) return;
      const next = [...index.records, meta];
      try {
        await this.putFile(this.indexPath(store), Buffer.from(JSON.stringify(next, null, 1)), `목록 갱신 ${store}`, index.sha);
        return;
      } catch (e) {
        if (!(e instanceof GitHubError) || (e.status !== 409 && e.status !== 422) || attempt >= INDEX_RETRIES) throw e;
      }
    }
  }

  async readAudio(store: RecordingStoreName, id: string): Promise<Buffer> {
    const res = await this.request(`/contents/${this.audioPath(store, id)}?ref=${this.branch}`, {
      headers: { Accept: 'application/vnd.github.raw' },
    });
    return Buffer.from(await res.arrayBuffer());
  }

  private audioPath(store: RecordingStoreName, id: string): string {
    // 테이크 id에는 | 와 한글이 들어가므로 파일 이름은 해시로 만든다.
    return `${store}/${createHash('sha256').update(id).digest('hex').slice(0, 24)}.wav`;
  }

  private indexPath(store: RecordingStoreName): string {
    return `${store}/index.json`;
  }

  private async readIndex(store: RecordingStoreName): Promise<{ sha?: string; records: RecordingMeta[] }> {
    const file = await this.getFile(this.indexPath(store));
    if (!file) return { records: [] };
    return { sha: file.sha, records: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')) };
  }

  private async fileSha(path: string): Promise<string | undefined> {
    return (await this.getFile(path))?.sha;
  }

  private async getFile(path: string): Promise<ContentFile | undefined> {
    try {
      const res = await this.request(`/contents/${path}?ref=${this.branch}`);
      return (await res.json()) as ContentFile;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return undefined;
      throw e;
    }
  }

  private async putFile(path: string, data: Buffer, message: string, sha?: string): Promise<void> {
    await this.request(`/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: data.toString('base64'), branch: this.branch, sha }),
    });
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${GITHUB_API}/repos/${this.repo}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let detail = body.slice(0, 200);
      try {
        detail = JSON.parse(body).message ?? detail;
      } catch {
        // JSON이 아니면 본문 앞부분을 그대로 쓴다.
      }
      throw new GitHubError(res.status, `GitHub ${res.status} ${path}: ${detail}`);
    }
    return res;
  }
}
