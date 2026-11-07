import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { recordingAudioUrl } from '../shared/recording';
import { openRecordStore, ServerRecordStore } from './recordStore';

interface Clip {
  readonly id: string;
  readonly audioUrl: string;
  readonly createdAt: number;
  readonly recordName?: string;
  readonly text: string;
}

const clip: Clip = {
  id: '음성/#1', audioUrl: 'data:audio/wav;base64,AQID', createdAt: 123,
  recordName: 'S01/앵커-v1', text: '안녕.',
};
const store = new ServerRecordStore<Clip>('clips', 'id', 'audioUrl', 'owner/repo@recordings', 'recordName');

afterEach(() => mock.restoreAll());

test('서버 목록은 설명 칸을 펼치고 음성 칸을 식별자별 서버 주소로 채운다', async () => {
  const metas = ['음성/#1', '다른 음성'].map((id, index) => ({
    id, createdAt: index, mimeType: 'audio/wav',
    fields: { id, createdAt: index, text: `대사 ${index}`, audioUrl: '예전 주소' },
  }));
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(metas));

  const result = await store.list();

  assert.deepEqual(fetchMock.mock.calls[0].arguments, ['/api/recordings/clips']);
  assert.deepEqual(result, metas.map((meta) => ({
    ...meta.fields, audioUrl: recordingAudioUrl('clips', meta.id),
  })));
});

for (const [label, body, expected] of [
  ['오류 본문', JSON.stringify({ error: '목록 접근 거절' }), '목록 접근 거절'],
  ['JSON 아닌 본문', '<html>실패</html>', '불러오기 실패 (503)'],
] as const) {
  test(`서버 목록 실패 메시지: ${label}`, async () => {
    mock.method(globalThis, 'fetch', async () => new Response(body, { status: 503 }));
    await assert.rejects(store.list(), { message: expected });
  });
}

test('서버 저장은 data URL이 아닌 음성을 요청 전에 거절한다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({}));

  await assert.rejects(store.put({ ...clip, audioUrl: '/api/recordings/clips/음성/audio' }), {
    message: '음성이 data URL이 아니라 저장할 수 없습니다.',
  });

  assert.equal(fetchMock.mock.callCount(), 0);
});

test('서버 저장 본문은 음성 base64와 음성 칸을 뺀 설명을 나누어 보낸다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({}));

  await store.put(clip);

  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, '/api/recordings/clips');
  assert.equal(options?.method, 'POST');
  assert.deepEqual(options?.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(String(options?.body)), {
    meta: {
      id: '음성/#1', createdAt: 123, mimeType: 'audio/wav', name: 'S01/앵커-v1',
      fields: { id: '음성/#1', createdAt: 123, recordName: 'S01/앵커-v1', text: '안녕.' },
    },
    audioBase64: 'AQID',
  });
});

test('저장 이름 키가 없으면 전송한 설명에 이름을 넣지 않는다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({}));
  const unnamed = new ServerRecordStore<Clip>('clips', 'id', 'audioUrl', '서버');

  await unnamed.put(clip);

  const body = JSON.parse(String(fetchMock.mock.calls[0].arguments[1]?.body));
  assert.equal(body.meta.name, undefined);
  assert.equal(Object.hasOwn(body.meta, 'name'), false);
});

test('서버 저장 실패는 응답 본문의 오류를 던진다', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ error: '저장 접근 거절' }, { status: 403 }));
  await assert.rejects(store.put(clip), { message: '저장 접근 거절' });
});

test('서버 저장이 켜진 상태면 지정한 대상의 서버 저장소를 연다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({
    enabled: true, target: 'owner/repo@recordings',
  }));

  const opened = await openRecordStore<Clip>('clips', 'id', 'audioUrl', 'recordName');

  assert.ok(opened instanceof ServerRecordStore);
  assert.equal(opened.target, 'owner/repo@recordings');
  assert.deepEqual(fetchMock.mock.calls[0].arguments, ['/api/recordings/status']);
  assert.equal(fetchMock.mock.callCount(), 1);
});
