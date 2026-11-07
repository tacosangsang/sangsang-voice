import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DubbingItem } from '../types';
import { clipFileName } from './download';

const clip: DubbingItem = {
  id: '음성', presetName: '차분', voiceName: 'Kore', text: '안녕.',
  stylePrompt: '', mimeType: 'audio/wav', audioUrl: '',
  scriptLineId: 'S#01-C001', createdAt: 123,
};

for (const [suffix, expected] of [
  ['raw', 'S01-C001-앵커-차분-v2.wav'],
  ['fx', 'S01-C001-앵커-차분-v2_fx.wav'],
] as const) {
  test(`저장 이름이 있으면 폴더를 뺀 내려받기 이름을 쓴다: ${suffix === 'raw' ? '원본' : '효과'}`, () => {
    assert.equal(clipFileName({ ...clip, recordName: 'S01/S01-C001-앵커-차분-v2' }, suffix), expected);
  });
}

test('저장 이름이 없으면 컷의 우물정자를 빼고 기본 한국어와 목소리와 만든 시각을 쓴다', () => {
  assert.equal(clipFileName(clip, 'raw'), 'S01-C001_ko_Kore_123_raw.wav');
});

test('저장 이름이 없고 영어면 영어 접미사를 쓴다', () => {
  assert.equal(clipFileName({ ...clip, language: 'en' }, 'raw'), 'S01-C001_en_Kore_123_raw.wav');
});

test('대본 줄이 없으면 내려받기 이름의 컷 자리는 dub이다', () => {
  assert.equal(clipFileName({ ...clip, scriptLineId: undefined }, 'raw'), 'dub_ko_Kore_123_raw.wav');
});

test('저장 이름 없는 효과 음성도 효과 접미사를 쓴다', () => {
  assert.equal(clipFileName(clip, 'fx'), 'S01-C001_ko_Kore_123_fx.wav');
});
