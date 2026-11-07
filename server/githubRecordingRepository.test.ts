import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, mock, test } from 'node:test';
import type { RecordingMeta } from '../src/shared/recording';
import { GitHubRecordingRepository } from './githubRecordingRepository';

afterEach(() => mock.restoreAll());

const meta: RecordingMeta = { id: '음성|하나', createdAt: 1, mimeType: 'audio/wav', fields: { text: '안녕.' } };
const hash = createHash('sha256').update(meta.id).digest('hex');
const api = 'https://api.github.com/repos/owner/repo';
const indexUrl = `${api}/contents/clips/index.json`;
const repository = new GitHubRecordingRepository('테스트용 토큰', 'owner/repo', 'recordings');

function indexFile(records: RecordingMeta[], sha = '목록 버전'): Response {
  return Response.json({ sha, content: Buffer.from(JSON.stringify(records)).toString('base64') });
}

test('저장소 확인은 인코딩한 브랜치 주소를 부른다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({}));
  await new GitHubRecordingRepository('테스트용 토큰', 'owner/repo', '녹음/초안').verify();
  assert.equal(fetchMock.mock.calls[0].arguments[0], `${api}/branches/%EB%85%B9%EC%9D%8C%2F%EC%B4%88%EC%95%88`);
});

test('목록 파일의 base64 내용을 풀어 반환한다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => indexFile([meta]));
  assert.deepEqual(await repository.list('clips'), [meta]);
  assert.equal(fetchMock.mock.calls[0].arguments[0], `${indexUrl}?ref=recordings`);
});

test('목록 파일이 없으면 빈 목록이다', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ message: '없음' }, { status: 404 }));
  assert.deepEqual(await repository.list('clips'), []);
});

test('같은 식별자가 있으면 목록만 읽고 아무 파일도 올리지 않는다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => indexFile([meta]));
  await repository.save('clips', meta, Buffer.from([1, 2]));
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(fetchMock.mock.calls[0].arguments[1]?.method, undefined);
});

for (const [label, name] of [['상위 경로', '../음성'], ['콜론', '씬/음:성']] as const) {
  test(`안전하지 않은 이름은 해시 경로에 저장한다: ${label}`, async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      Response.json({}, { status: init?.method === 'PUT' ? 200 : 404 }));
    await repository.save('clips', { ...meta, name }, Buffer.from([1, 2]));
    const puts = fetchMock.mock.calls.filter((call) => call.arguments[1]?.method === 'PUT');
    assert.equal(puts[0].arguments[0], `${api}/contents/clips/${hash.slice(0, 24)}.wav`);
    const body = JSON.parse(String(puts[1].arguments[1]?.body));
    assert.equal(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))[0].path, `clips/${hash.slice(0, 24)}.wav`);
  });
}

for (const collision of ['목록', '원격 파일'] as const) {
  test(`${collision}에 같은 경로가 있으면 해시 여섯 자리를 붙인다`, async () => {
    const existing = { ...meta, id: '다른 음성', path: 'clips/scene/take.wav' };
    const fetchMock = mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.method === 'PUT') return Response.json({});
      if (String(input) === `${indexUrl}?ref=recordings`) return indexFile(collision === '목록' ? [existing] : []);
      if (collision === '원격 파일' && String(input) === `${api}/contents/clips/scene/take.wav?ref=recordings`) {
        return Response.json({ sha: '기존 파일', content: '' });
      }
      return Response.json({}, { status: 404 });
    });
    await repository.save('clips', { ...meta, name: 'scene/take' }, Buffer.from([1]));
    const audioPut = fetchMock.mock.calls.find((call) => call.arguments[1]?.method === 'PUT');
    assert.equal(audioPut?.arguments[0], `${api}/contents/clips/scene/take-${hash.slice(0, 6)}.wav`);
  });
}

test('목록 갱신 충돌은 새 목록과 버전을 읽어 합친 뒤 재시도한다', async () => {
  let reads = 0;
  let writes = 0;
  const other: RecordingMeta = { ...meta, id: '동시에 저장한 음성' };
  const fetchMock = mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input) === `${indexUrl}?ref=recordings`) {
      reads++;
      return indexFile(reads === 1 ? [] : [other], `버전-${reads}`);
    }
    if (String(input) === indexUrl && init?.method === 'PUT') {
      writes++;
      return Response.json({ message: '충돌' }, { status: writes === 1 ? 409 : 200 });
    }
    return Response.json({}, { status: init?.method === 'PUT' ? 200 : 404 });
  });
  await repository.save('clips', meta, Buffer.from([1]));
  const puts = fetchMock.mock.calls.filter((call) => call.arguments[0] === indexUrl);
  assert.equal(reads, 2);
  assert.equal(puts.length, 2);
  const body = JSON.parse(String(puts[1].arguments[1]?.body));
  assert.equal(body.sha, '버전-2');
  assert.deepEqual(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')),
    [other, { ...meta, path: `clips/${hash.slice(0, 24)}.wav` }]);
});

test('목록 갱신이 세 번 충돌하면 더 시도하지 않고 던진다', async () => {
  let writes = 0;
  let reads = 0;
  mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input) === `${indexUrl}?ref=recordings`) return indexFile([], `버전-${++reads}`);
    if (String(input) === indexUrl && init?.method === 'PUT') {
      writes++;
      return Response.json({ message: '계속 충돌' }, { status: 409 });
    }
    return Response.json({}, { status: init?.method === 'PUT' ? 200 : 404 });
  });
  await assert.rejects(repository.save('clips', meta, Buffer.from([1])), /GitHub 409.*계속 충돌/);
  assert.equal(writes, 3);
  assert.equal(reads, 3);
});

test('한글 음성 경로는 경로 칸마다 인코딩한다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) =>
    String(input) === `${indexUrl}?ref=recordings`
      ? indexFile([{ ...meta, path: 'clips/씬 하나/음성.wav' }])
      : new Response(new Uint8Array([1, 2])));
  assert.deepEqual(await repository.readAudio('clips', meta.id), Buffer.from([1, 2]));
  assert.equal(fetchMock.mock.calls[1].arguments[0],
    `${api}/contents/clips/%EC%94%AC%20%ED%95%98%EB%82%98/%EC%9D%8C%EC%84%B1.wav?ref=recordings`);
});

test('오류 응답의 메시지를 예외에 포함한다', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ message: '권한 없음' }, { status: 403 }));
  await assert.rejects(repository.verify(), /GitHub 403.*권한 없음/);
});
