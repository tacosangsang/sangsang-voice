import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DubbingItem } from '../types';
import type { ScriptLine, Speaker } from './platingScript';
import { nextRecordName, recordFileName } from './recordName';

const line: ScriptLine = {
  id: 'S#01-C001', cut: 'S#01-C001', tc: '', cutSeconds: 4,
  speaker: 'anchor', text: '안녕.', situation: '',
};
const speakers: Speaker[] = [{ id: 'anchor', name: '앵커' }];

function clip(overrides: Partial<DubbingItem> = {}): DubbingItem {
  return {
    id: '음성', presetId: '차분', presetName: '차분', voiceName: 'Kore',
    text: '안녕.', stylePrompt: '', mimeType: 'audio/wav', audioUrl: '',
    scriptLineId: 'S#01-C001', createdAt: 1, ...overrides,
  };
}

test('첫 저장은 씬과 컷과 화자와 프리셋에 첫 버전을 붙인다', () => {
  assert.equal(nextRecordName(clip(), [line], speakers, []), 'S01/S01-C001-앵커-차분-v1');
});

test('같은 이름의 가장 큰 버전이 3이면 다음 버전은 4다', () => {
  const existing = [clip({ recordName: 'S01/S01-C001-앵커-차분-v3' }), clip({ recordName: 'S01/S01-C001-앵커-차분-v1' })];
  assert.equal(nextRecordName(clip(), [line], speakers, existing), 'S01/S01-C001-앵커-차분-v4');
});

test('다른 이름의 버전은 무시한다', () => {
  assert.equal(nextRecordName(clip(), [line], speakers, [clip({ recordName: 'S01/S01-C001-앵커-빠름-v9' })]),
    'S01/S01-C001-앵커-차분-v1');
});

for (const suffix of ['문자', '3x'] as const) {
  test(`버전 접두사 뒤가 숫자가 아니면 무시한다: ${suffix}`, () => {
    assert.equal(nextRecordName(clip(), [line], speakers, [clip({ recordName: `S01/S01-C001-앵커-차분-v${suffix}` })]),
      'S01/S01-C001-앵커-차분-v1');
  });
}

test('영어는 버전 앞에 언어 접미사를 붙인다', () => {
  assert.equal(nextRecordName(clip({ language: 'en' }), [line], speakers, []), 'S01/S01-C001-앵커-차분-en-v1');
});

test('프리셋이 없으면 목소리 이름을 쓴다', () => {
  assert.equal(nextRecordName(clip({ presetId: undefined }), [line], speakers, []), 'S01/S01-C001-앵커-Kore-v1');
});

test('대본 줄이 없으면 기타 폴더와 기타 이름을 쓴다', () => {
  assert.equal(nextRecordName(clip({ scriptLineId: undefined }), [line], speakers, []), '기타/기타-차분-v1');
});

test('모르는 노션 화자는 접두사를 뺀 이름을 쓴다', () => {
  assert.equal(nextRecordName(clip(), [{ ...line, speaker: 'notion:새 화자' }], speakers, []), 'S01/S01-C001-새_화자-차분-v1');
});

test('이름의 공백과 경로 구분자와 콜론은 밑줄이 된다', () => {
  assert.equal(nextRecordName(clip({ presetName: '낮은 목/소:리' }), [line], [{ id: 'anchor', name: '새 화/자:명' }], []),
    'S01/S01-C001-새_화_자_명-낮은_목_소_리-v1');
});

test('내려받기 파일 이름은 폴더를 뺀 이름이다', () => {
  assert.equal(recordFileName(clip({ recordName: 'S01/S01-C001-앵커-차분-v2' })), 'S01-C001-앵커-차분-v2');
});

test('저장 이름이 없으면 파일 이름도 없다', () => {
  assert.equal(recordFileName(clip()), undefined);
});
