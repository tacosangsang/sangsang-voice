import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PLATING_SCRIPT, SPEAKERS, checkFit, countSyllables, findScriptLine, lineText, ttsTextMatches,
} from './platingScript';
import type { ScriptLine } from './platingScript';

const line: ScriptLine = {
  id: 'S#01-C001', cut: 'S#01-C001', tc: '', cutSeconds: 4,
  speaker: 'anchor', text: '안녕하세요.', situation: '',
};

for (const [label, text, expected] of [
  ['한글 음절', '가나다 힣', 4], ['숫자와 영문과 문장부호', 'ABC 123,!?', 0],
  ['한글과 다른 문자 혼합', '오늘 37도, Hello!', 3], ['빈 문자열', '', 0],
] as const) {
  test(`음절 수는 한글만 센다: ${label}`, () => {
    assert.equal(countSyllables(text), expected);
  });
}

for (const [label, duration, expected] of [
  ['딱 맞음', 4, { overSeconds: 0, fits: true }],
  ['넘침', 5.5, { overSeconds: 1.5, fits: false }],
  ['모자람', 2.5, { overSeconds: -1.5, fits: true }],
] as const) {
  test(`컷 길이 비교: ${label}`, () => {
    assert.deepEqual(checkFit(line, duration), expected);
  });
}

test('한국어는 태그를 넣은 TTS 대사를 우선한다', () => {
  assert.equal(lineText({ ...line, ttsText: '<sigh> 안녕하세요.' }, 'ko'), '<sigh> 안녕하세요.');
});

test('한국어 TTS 대사가 없으면 원문을 쓴다', () => {
  assert.equal(lineText(line, 'ko'), '안녕하세요.');
});

test('영어는 한국어 TTS 대사 대신 영어 대사를 쓴다', () => {
  assert.equal(lineText({ ...line, ttsText: '<sigh> 안녕하세요.', textEn: 'Hello.' }, 'en'), 'Hello.');
});

test('영어 대사가 없으면 없는 값을 반환한다', () => {
  assert.equal(lineText(line, 'en'), undefined);
});

for (const [label, text, tts, expected] of [
  ['태그만 추가', '안녕.', '<sigh>안녕.<short pause>', true],
  ['공백만 변경', '안녕 하세요.', '안 녕\n하 세 요.', true],
  ['글자 변경', '안녕.', '<sigh>잘가.', false],
  ['태그 안 공백', '안녕.', '< short pause > 안녕.', true],
] as const) {
  test(`TTS 대사 원문 검사: ${label}`, () => {
    assert.equal(ttsTextMatches(text, tts), expected);
  });
}

test('식별자가 같은 대본 줄을 찾는다', () => {
  assert.equal(findScriptLine([line], line.id), line);
});

for (const [label, id] of [['없는 식별자', '없음'], ['식별자 없음', undefined]] as const) {
  test(`대본 줄을 찾지 못하면 없는 값을 반환한다: ${label}`, () => {
    assert.equal(findScriptLine([line], id), undefined);
  });
}

test('사본 대본의 식별자는 중복되지 않는다', () => {
  assert.equal(new Set(PLATING_SCRIPT.map((item) => item.id)).size, PLATING_SCRIPT.length);
});

test('사본 대본의 식별자는 컷 번호와 같다', () => {
  for (const item of PLATING_SCRIPT) assert.equal(item.id, item.cut);
});

test('사본 대본의 모든 화자는 아는 화자 목록에 있다', () => {
  for (const item of PLATING_SCRIPT) assert.ok(SPEAKERS.some((speaker) => speaker.id === item.speaker), item.id);
});

test('사본 대본의 컷 길이는 양수다', () => {
  for (const item of PLATING_SCRIPT) assert.ok(item.cutSeconds > 0, item.id);
});

test('사본 대본의 원문은 비어 있지 않다', () => {
  for (const item of PLATING_SCRIPT) assert.ok(item.text.trim().length > 0, item.id);
});

test('사본 대본의 TTS 대사는 태그를 빼면 원문과 같다', () => {
  for (const item of PLATING_SCRIPT) {
    if (item.ttsText !== undefined) assert.ok(ttsTextMatches(item.text, item.ttsText), item.id);
  }
});

for (const key of ['id', 'name'] as const) {
  test(`아는 화자의 ${key === 'id' ? '식별자' : '이름'}은 중복되지 않는다`, () => {
    assert.equal(new Set(SPEAKERS.map((speaker) => speaker[key])).size, SPEAKERS.length);
  });
}
