import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { SPEAKERS } from '../src/data/platingScript';
import type { NotionBlock } from '../src/script/notionRecordingScript';
import { NotionScriptSource } from './notionScriptSource';

afterEach(() => mock.restoreAll());

const heading: NotionBlock = {
  id: 'heading', type: 'heading_2', heading_2: { rich_text: [{ plain_text: '녹음 대본 (인물별 대사)' }] },
};
const speaker: NotionBlock = {
  id: 'speaker', type: 'paragraph', paragraph: { rich_text: [{ plain_text: '앵커', annotations: { bold: true } }] },
};
const table: NotionBlock = { id: 'table', type: 'table', has_children: true };
const rows: NotionBlock[] = [
  ['컷', '대사', '길이'], ['S#01-C001', '안녕.', '4s'],
].map((cells, index) => ({
  id: `row-${index}`, type: 'table_row', table_row: { cells: cells.map((plain_text) => [{ plain_text }]) },
}));
const source = new NotionScriptSource('테스트용 토큰', 'page');

function children(results: NotionBlock[], next?: string): Response {
  return Response.json({ results, has_more: next !== undefined, next_cursor: next ?? null });
}

test('페이지 블록은 다음 커서를 따라 끝까지 모은다', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    if (url.pathname.includes('/table/')) return children(rows);
    return url.searchParams.has('start_cursor') ? children([speaker, table]) : children([heading], '다음 커서');
  });
  const snapshot = await source.load();
  const urls = fetchMock.mock.calls.map((call) => new URL(String(call.arguments[0])));
  assert.equal(snapshot.lines[0].text, '안녕.');
  assert.equal(urls[0].searchParams.get('page_size'), '100');
  assert.equal(urls[0].searchParams.has('start_cursor'), false);
  assert.equal(urls[1].searchParams.get('start_cursor'), '다음 커서');
  assert.equal(urls.filter((url) => url.pathname === '/v1/blocks/page/children').length, 2);
});

test('섹션 안 표의 자식만 추가로 요청한다', async () => {
  const following: NotionBlock = {
    id: 'next', type: 'heading_1', heading_1: { rich_text: [{ plain_text: '다음 섹션' }] },
  };
  const fetchMock = mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    if (url.pathname.includes('/page/')) {
      return children([{ ...table, id: 'before' }, heading, speaker, table, following, { ...table, id: 'after' }]);
    }
    assert.equal(url.pathname, '/v1/blocks/table/children');
    return children(rows);
  });
  await source.load();
  assert.deepEqual(fetchMock.mock.calls.map((call) => new URL(String(call.arguments[0])).pathname),
    ['/v1/blocks/page/children', '/v1/blocks/table/children']);
});

test('표의 행도 다음 커서를 따라 끝까지 모은다', async () => {
  mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    if (url.pathname.includes('/page/')) return children([heading, speaker, table]);
    return url.searchParams.has('start_cursor') ? children(rows.slice(1)) : children(rows.slice(0, 1), 'next-row');
  });
  assert.deepEqual((await source.load()).lines.map((line) => line.id), ['S#01-C001']);
});

test('읽은 대사 줄이 없으면 경고를 담아 던진다', async () => {
  mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => new URL(String(input)).pathname.includes('/page/')
    ? children([heading, speaker, table]) : children(rows.slice(0, 1)));
  await assert.rejects(source.load(), /대사 줄이 하나도 없습니다/);
});

test('대사 없는 아는 화자도 화자 목록에 남긴다', async () => {
  mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => new URL(String(input)).pathname.includes('/page/')
    ? children([heading, speaker, table]) : children(rows));
  const snapshot = await source.load();
  assert.deepEqual(snapshot.speakers, SPEAKERS);
  assert.deepEqual([...new Set(snapshot.lines.map((line) => line.speaker))], ['anchor']);
});

test('API 오류 상태와 응답 본문을 예외에 넣는다', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('접근 거부', { status: 403 }));
  await assert.rejects(source.load(), /노션 API 403: 접근 거부/);
});
