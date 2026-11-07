import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DubbingItem } from '../types';
import { findGenerated, generationKey } from './generationCache';
import type { GenerationRequest } from './generationCache';

const request: GenerationRequest = { text: '안녕.', voiceName: 'Kore', stylePrompt: '차분하게' };

function clip(overrides: Partial<DubbingItem> = {}): DubbingItem {
  return {
    id: '음성', presetName: '', voiceName: 'Kore', text: '안녕.', stylePrompt: '차분하게',
    mimeType: 'audio/wav', audioUrl: '', createdAt: 1, ...overrides,
  };
}

test('생성 키는 대사와 지시문 앞뒤 공백을 무시한다', () => {
  assert.equal(generationKey({ ...request, text: ' \n안녕. ', stylePrompt: ' 차분하게\n' }), generationKey(request));
});

test('생성 키의 기본 언어는 한국어다', () => {
  assert.equal(generationKey(request), generationKey({ ...request, language: 'ko' }));
});

for (const [label, change] of [
  ['목소리', { voiceName: 'Puck' }], ['지시문', { stylePrompt: '빠르게' }],
  ['대사', { text: '잘가.' }], ['언어', { language: 'en' }],
] satisfies [string, Partial<GenerationRequest>][]) {
  test(`${label}가 바뀌면 생성 키가 달라진다`, () => {
    assert.notEqual(generationKey({ ...request, ...change }), generationKey(request));
  });
}

test('같은 조건의 음성 중 목록의 가장 앞 항목을 찾는다', () => {
  const newest = clip({ id: '최신', createdAt: 3 });
  const clips = [clip({ text: '다른 대사', createdAt: 4 }), newest, clip({ id: '과거' })];
  assert.equal(findGenerated(clips, request), newest);
});

test('같은 조건의 음성이 없으면 없는 값을 반환한다', () => {
  assert.equal(findGenerated([clip({ voiceName: 'Puck' })], request), undefined);
});
