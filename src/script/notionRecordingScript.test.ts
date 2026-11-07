import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPEAKERS } from '../data/platingScript';
import { findSectionTables, parseRecordingScript } from './notionRecordingScript';
import type { NotionBlock } from './notionRecordingScript';

function heading(title = '녹음 대본 (인물별 대사)', type = 'heading_2'): NotionBlock {
  return { id: title, type, [type]: { rich_text: [{ plain_text: title }] } };
}

function speaker(name = '앵커', bold = true): NotionBlock {
  return { id: name, type: 'paragraph', paragraph: { rich_text: [{ plain_text: name, annotations: { bold } }] } };
}

function table(headers = ['컷', '대사', '길이'], rows = [['S#01-C001', '안녕.', '4.5s']]): NotionBlock {
  return {
    id: '대본 표', type: 'table', table: { has_column_header: true },
    children: [headers, ...rows].map((cells, index) => ({
      id: `행-${index}`, type: 'table_row', table_row: { cells: cells.map((plain_text) => [{ plain_text }]) },
    })),
  };
}

test('녹음 섹션 안의 표만 고르고 섹션 전과 다음 제목 뒤는 제외한다', () => {
  const inside = { ...table(), id: '섹션 안' };
  const blocks = [table(), heading(), speaker(), inside, heading('다음 제목'), table()];
  assert.deepEqual(findSectionTables(blocks), [inside]);
});

test('녹음 제목이 없으면 표를 고르지 않는다', () => {
  assert.deepEqual(findSectionTables([heading('다른 제목'), table()]), []);
});

for (const type of ['heading_1', 'heading_2', 'heading_3'] as const) {
  test(`${type.slice(-1)}단계 제목으로 녹음 섹션을 찾는다`, () => {
    const inside = table();
    assert.deepEqual(findSectionTables([heading(undefined, type), inside]), [inside]);
  });
}

test('녹음 제목이 없으면 경고와 빈 결과를 반환한다', () => {
  const parsed = parseRecordingScript([speaker(), table()]);
  assert.deepEqual(parsed.lines, []);
  assert.deepEqual(parsed.speakers, []);
  assert.match(parsed.warnings.join(' '), /녹음 대본.*제목을 찾지 못했습니다/);
});

test('칸 순서가 달라도 머리 칸 이름으로 모든 값을 읽는다', () => {
  const parsed = parseRecordingScript([heading(), speaker(), table(
    ['감정', '대사', '영어 대사', '컷', '연기 지시', 'TTS 대사', '길이', 'TC', '상황'],
    [['차분', '안녕.', 'Hello.', 'S#01-C001', '낮게', '<sigh> 안녕.', '4.5s', '00:00–00:04', '방송']],
  )]);
  assert.deepEqual(parsed.lines, [{
    id: 'S#01-C001', cut: 'S#01-C001', tc: '00:00–00:04', cutSeconds: 4.5,
    speaker: 'anchor', text: '안녕.', textEn: 'Hello.', situation: '방송',
    ttsText: '<sigh> 안녕.', direction: '낮게', mood: '차분',
  }]);
});

for (const [label, headers] of [['컷', ['대사', '길이']], ['대사', ['컷', '길이']]] as const) {
  test(`${label} 칸이 없는 표는 경고하고 건너뛴다`, () => {
    const parsed = parseRecordingScript([heading(), speaker(), table([...headers])]);
    assert.deepEqual(parsed.lines, []);
    assert.match(parsed.warnings.join(' '), /컷 또는 대사 칸이 없어/);
  });
}

test('굵은 화자 문단 없이 시작한 표는 경고하고 건너뛴다', () => {
  const parsed = parseRecordingScript([heading(), speaker('앵커', false), table()]);
  assert.deepEqual(parsed.lines, []);
  assert.match(parsed.warnings.join(' '), /화자 이름.*없이 시작하는 표/);
});

test('굵지 않은 공백이 섞여도 굵은 화자 이름을 읽는다', () => {
  const label: NotionBlock = {
    ...speaker(),
    paragraph: { rich_text: [
      { plain_text: ' \t' },
      { plain_text: '앵커', annotations: { bold: true } },
      { plain_text: '\n' },
    ] },
  };

  const parsed = parseRecordingScript([heading(), label, table()]);

  assert.deepEqual(parsed.lines.map((line) => line.speaker), ['anchor']);
});

test('아는 화자는 정해진 식별자로 읽는다', () => {
  const parsed = parseRecordingScript([heading(), speaker(), table()]);
  assert.equal(parsed.lines[0].speaker, SPEAKERS.find((item) => item.name === '앵커')?.id);
  assert.deepEqual(parsed.speakers, [{ id: 'anchor', name: '앵커' }]);
  assert.deepEqual(parsed.warnings, []);
});

test('모르는 화자는 노션 접두사 식별자와 경고를 만든다', () => {
  const parsed = parseRecordingScript([heading(), speaker('새 화자'), table()]);
  assert.equal(parsed.lines[0].speaker, 'notion:새 화자');
  assert.deepEqual(parsed.speakers, [{ id: 'notion:새 화자', name: '새 화자' }]);
  assert.match(parsed.warnings.join(' '), /새 화자/);
});

test('컷 번호가 중복되면 두 번째 식별자에 접미사를 붙이고 경고한다', () => {
  const parsed = parseRecordingScript([heading(), speaker(), table(undefined, [
    ['S#01-C001', '처음.', '4s'], ['S#01-C001', '다음.', '4s'],
  ])]);
  assert.deepEqual(parsed.lines.map((line) => line.id), ['S#01-C001', 'S#01-C001#2']);
  assert.equal(parsed.lines[1].cut, 'S#01-C001');
  assert.match(parsed.warnings.join(' '), /같은 컷 번호.*S#01-C001#2/);
});

test('소수 초 단위 길이를 읽는다', () => {
  assert.equal(parseRecordingScript([heading(), speaker(), table()]).lines[0].cutSeconds, 4.5);
});

test('길이가 빈 칸이면 경고하고 0초로 읽는다', () => {
  const parsed = parseRecordingScript([heading(), speaker(), table(undefined, [['S#01-C001', '안녕.', '']])]);
  assert.equal(parsed.lines[0].cutSeconds, 0);
  assert.match(parsed.warnings.join(' '), /S#01-C001: 길이 칸을 읽지 못했습니다/);
});

test('TTS 대사가 원문을 바꾸면 버리고 경고한다', () => {
  const parsed = parseRecordingScript([heading(), speaker(), table(
    ['컷', '대사', '길이', 'TTS 대사'], [['S#01-C001', '안녕.', '4s', '<sigh> 잘가.']],
  )]);
  assert.equal(parsed.lines[0].ttsText, undefined);
  assert.match(parsed.warnings.join(' '), /TTS 대사가 원래 대사와 달라/);
});

for (const [label, field] of [['영어 대사', 'textEn'], ['연기 지시', 'direction'], ['감정', 'mood']] as const) {
  test(`${label}가 빈 칸이면 없는 값으로 읽는다`, () => {
    const parsed = parseRecordingScript([heading(), speaker(), table(
      ['컷', '대사', '길이', label], [['S#01-C001', '안녕.', '4s', '  ']],
    )]);
    assert.equal(parsed.lines[0][field], undefined);
  });
}

for (const [label, row] of [['컷', ['', '안녕.', '4s']], ['대사', ['S#01-C001', '', '4s']]] as const) {
  test(`${label}가 빈 행은 건너뛴다`, () => {
    const parsed = parseRecordingScript([heading(), speaker(), table(undefined, [[...row], ['S#01-C002', '다음.', '4s']])]);
    assert.deepEqual(parsed.lines.map((line) => line.id), ['S#01-C002']);
  });
}

test('섹션에 대사 줄이 하나도 없으면 경고한다', () => {
  const parsed = parseRecordingScript([heading(), speaker(), table(undefined, [])]);
  assert.deepEqual(parsed.lines, []);
  assert.match(parsed.warnings.join(' '), /대사 줄이 하나도 없습니다/);
});
