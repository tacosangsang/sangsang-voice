// 생성한 음성을 깃허브 저장소의 한 브랜치에 쌓는다.
// 모양: <저장소 이름>/index.json(설명 목록) + <저장소 이름>/<meta.name>.wav
// meta.name이 없으면(예전 음성) <id 해시>.wav. 실제 경로는 index.json의 path에 적어 두고 읽을 때 그대로 쓴다.
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

function idHash(id: string): string {
  return createHash('sha256').update(id).digest('hex');
}

/** 화면이 보낸 이름은 폴더/이름 꼴만 받는다. 위로 올라가는 경로나 파일 이름에 못 쓰는 글자는 거른다. */
function isSafeName(name: string): boolean {
  return /^[^\\:*?"<>|#%]+$/.test(name) && name.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/** 한글·괄호가 든 경로를 API 주소에 넣을 수 있게 칸마다 인코딩한다. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
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
    const first = await this.readIndex(store);
    // 같은 id는 같은 음성이다. 이미 목록에 있으면 다시 올리지 않는다.
    if (first.records.some((r) => r.id === meta.id)) return;

    const path = await this.choosePath(store, meta, first.records);
    if (!(await this.fileSha(path))) await this.putFile(path, audio, `음성 저장 ${path}`);
    const record: RecordingMeta = { ...meta, path };

    // 여러 탭이 동시에 저장하면 index.json sha가 어긋난다. 다시 읽어 합친다.
    for (let attempt = 1; ; attempt++) {
      const index = attempt === 1 ? first : await this.readIndex(store);
      if (index.records.some((r) => r.id === meta.id)) return;
      try {
        await this.putFile(
          this.indexPath(store),
          Buffer.from(JSON.stringify([...index.records, record], null, 1)),
          `목록 갱신 ${store}`,
          index.sha,
        );
        return;
      } catch (e) {
        if (!(e instanceof GitHubError) || (e.status !== 409 && e.status !== 422) || attempt >= INDEX_RETRIES) throw e;
      }
    }
  }

  async readAudio(store: RecordingStoreName, id: string): Promise<Buffer> {
    const { records } = await this.readIndex(store);
    const path = records.find((r) => r.id === id)?.path ?? this.hashPath(store, id);
    const res = await this.request(`/contents/${encodePath(path)}?ref=${this.branch}`, {
      headers: { Accept: 'application/vnd.github.raw' },
    });
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * 사람이 읽는 이름이 있으면 그 경로. 다른 음성이 이미 그 이름을 쓰고 있으면(동시에 두 탭에서 같은 버전을 매긴 경우)
   * 뒤에 id 해시를 붙인다. 같은 id로 다시 시도하면 같은 경로가 나오므로 한 번 올린 파일은 다시 올리지 않는다.
   */
  private async choosePath(store: RecordingStoreName, meta: RecordingMeta, records: RecordingMeta[]): Promise<string> {
    if (!meta.name || !isSafeName(meta.name)) return this.hashPath(store, meta.id);
    const wanted = `${store}/${meta.name}.wav`;
    const taken = records.some((r) => r.path === wanted) || (await this.fileSha(wanted)) !== undefined;
    return taken ? `${store}/${meta.name}-${idHash(meta.id).slice(0, 6)}.wav` : wanted;
  }

  private hashPath(store: RecordingStoreName, id: string): string {
    // 이름 없는 예전 음성. 테이크 id에는 | 와 한글이 들어가므로 파일 이름은 해시로 만든다.
    return `${store}/${idHash(id).slice(0, 24)}.wav`;
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
      const res = await this.request(`/contents/${encodePath(path)}?ref=${this.branch}`);
      return (await res.json()) as ContentFile;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return undefined;
      throw e;
    }
  }

  private async putFile(path: string, data: Buffer, message: string, sha?: string): Promise<void> {
    await this.request(`/contents/${encodePath(path)}`, {
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
