import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findLineRanges, suspiciousRanges } from './takeSplitter';

const sampleRate = 16000;

function signal(parts: { seconds: number; sound: boolean }[]): Float32Array {
  const chunks = parts.map(({ seconds, sound }) => Float32Array.from(
    { length: Math.round(seconds * sampleRate) },
    (_, index) => sound ? 0.5 * Math.sin(2 * Math.PI * 440 * index / sampleRate) : 0,
  ));
  const samples = new Float32Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  return samples;
}

test('반 초 무음으로 나눈 두 소리는 양끝에 0.08초 여유를 남긴다', () => {
  const samples = signal([
    { seconds: 0.2, sound: false }, { seconds: 0.4, sound: true },
    { seconds: 0.5, sound: false }, { seconds: 0.4, sound: true }, { seconds: 0.2, sound: false },
  ]);
  assert.deepEqual(findLineRanges(samples, sampleRate, 2), [
    { start: 1920, end: 10880 }, { start: 16320, end: 25280 },
  ]);
});

test('0.05초 쉼은 두 줄을 나눌 경계가 되지 못한다', () => {
  const samples = signal([
    { seconds: 0.4, sound: true }, { seconds: 0.05, sound: false }, { seconds: 0.4, sound: true },
  ]);
  assert.throws(() => findLineRanges(samples, sampleRate, 2), {
    message: '줄 사이 쉼을 1곳 찾아야 하는데 0곳뿐입니다.',
  });
});

test('전부 무음이면 소리가 없다는 오류를 던진다', () => {
  assert.throws(() => findLineRanges(signal([{ seconds: 1, sound: false }]), sampleRate, 1), {
    message: '소리가 없습니다.',
  });
});

test('세 쉼 중 긴 두 쉼을 세 줄의 경계로 쓴다', () => {
  const samples = signal([
    { seconds: 0.2, sound: false }, { seconds: 0.3, sound: true },
    { seconds: 0.2, sound: false }, { seconds: 0.3, sound: true },
    { seconds: 0.6, sound: false }, { seconds: 0.3, sound: true },
    { seconds: 0.4, sound: false }, { seconds: 0.3, sound: true }, { seconds: 0.2, sound: false },
  ]);
  assert.deepEqual(findLineRanges(samples, sampleRate, 3), [
    { start: 1920, end: 17280 }, { start: 24320, end: 31680 }, { start: 35520, end: 42880 },
  ]);
});

test('한 줄이면 앞뒤 무음을 줄이고 여유를 남긴 범위 하나를 반환한다', () => {
  const samples = signal([
    { seconds: 0.3, sound: false }, { seconds: 0.5, sound: true }, { seconds: 0.3, sound: false },
  ]);
  assert.deepEqual(findLineRanges(samples, sampleRate, 1), [{ start: 3520, end: 14080 }]);
});

test('예상 비중대로 나눈 범위는 의심 줄이 없다', () => {
  assert.deepEqual(suspiciousRanges([{ start: 0, end: 100 }, { start: 100, end: 300 }], [1, 2]), []);
});

test('예상 비중의 절반 미만인 줄의 번호를 반환한다', () => {
  assert.deepEqual(suspiciousRanges([{ start: 0, end: 10 }, { start: 10, end: 100 }], [1, 1]), [0]);
});

test('예상 비중의 두 배를 넘는 줄의 번호를 반환한다', () => {
  assert.deepEqual(suspiciousRanges([{ start: 0, end: 60 }, { start: 60, end: 100 }], [1, 4]), [0]);
});

test('비중이 정확히 절반 또는 두 배면 의심 줄이 아니다', () => {
  assert.deepEqual(suspiciousRanges([{ start: 0, end: 1 }, { start: 1, end: 3 }], [2, 1]), []);
});
