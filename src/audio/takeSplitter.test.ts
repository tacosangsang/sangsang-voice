import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findLineRanges, SilenceTakeSplitter, suspiciousRanges } from './takeSplitter';

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

const anchorWeights = [20, 19, 29, 26, 40, 25, 16];

function anchorTake(missingFirstGap: boolean): Float32Array {
  const parts = [{ seconds: 0.2, sound: false }];
  anchorWeights.forEach((weight, index) => {
    if (index === 4) {
      parts.push(
        { seconds: weight / 2 / 4.9, sound: true },
        { seconds: 0.4, sound: false },
        { seconds: weight / 2 / 4.9, sound: true },
      );
    } else parts.push({ seconds: weight / 4.9, sound: true });
    if (index < anchorWeights.length - 1 && !(missingFirstGap && index === 0)) {
      parts.push({ seconds: 0.3, sound: false });
    }
  });
  parts.push({ seconds: 0.2, sound: false });
  return signal(parts);
}

test('가중치 없이는 첫 줄 사이 쉼 누락을 C005 안의 쉼으로 대신해 일곱 조각이 어긋난다', () => {
  const ranges = findLineRanges(anchorTake(true), sampleRate, 7);
  const shiftedWeights = [39, 29, 26, 20, 20, 25, 16];
  assert.equal(ranges.length, 7);
  ranges.forEach((range, index) => {
    assert.ok(Math.abs((range.end - range.start) / sampleRate - (shiftedWeights[index] / 4.9 + 0.16)) < 0.03);
  });
});

test('음절 비율을 주면 첫 줄 사이 쉼이 빠진 일곱 줄 신호의 자르기를 거부한다', () => {
  assert.throws(() => findLineRanges(anchorTake(true), sampleRate, 7, anchorWeights), {
    message: '줄 길이 비율이 맞는 자르기 위치를 찾지 못했습니다.',
  });
});

test('문장 안 쉼이 줄 사이 쉼보다 길어도 음절 비율로 일곱 줄 경계를 고른다', () => {
  const ranges = findLineRanges(anchorTake(false), sampleRate, 7, anchorWeights);
  assert.equal(ranges.length, 7);
  ranges.forEach((range, index) => {
    const expected = anchorWeights[index] / 4.9 + 0.16 + (index === 4 ? 0.4 : 0);
    assert.ok(Math.abs((range.end - range.start) / sampleRate - expected) < 0.03);
  });
});

test('비율 비용이 같으면 더 긴 쉼을 경계로 고른다', () => {
  const samples = signal([
    { seconds: 0.2, sound: false }, { seconds: 0.9, sound: true },
    { seconds: 0.2, sound: false }, { seconds: 0.6, sound: true },
    { seconds: 0.6, sound: false }, { seconds: 0.7, sound: true }, { seconds: 0.2, sound: false },
  ]);
  assert.deepEqual(findLineRanges(samples, sampleRate, 2, [1, 1]), [
    { start: 1920, end: 31680 }, { start: 38720, end: 52480 },
  ]);
});

for (const [label, durations, weights] of [
  ['0.6배 미만', [0.4, 1.6], [1, 1]],
  ['1.6배 초과', [0.4, 0.4], [1, 4]],
] as const) {
  test(`선택한 조각 비율이 기대의 ${label}이면 자르기를 거부한다`, () => {
    const samples = signal([
      { seconds: 0.2, sound: false }, { seconds: durations[0], sound: true },
      { seconds: 0.5, sound: false }, { seconds: durations[1], sound: true }, { seconds: 0.2, sound: false },
    ]);
    assert.throws(() => findLineRanges(samples, sampleRate, 2, [...weights]), {
      message: '줄 길이 비율이 맞는 자르기 위치를 찾지 못했습니다.',
    });
  });
}

test('브라우저 자르기도 가중치를 전달해 비율 불일치를 거부한다', async (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'OfflineAudioContext');
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'OfflineAudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext');
  });
  context.mock.method(globalThis, 'fetch', async () => new Response(new ArrayBuffer(0)));
  Object.defineProperty(globalThis, 'OfflineAudioContext', { configurable: true, value: class {
    async decodeAudioData() {
      return { sampleRate, getChannelData: () => anchorTake(true) };
    }
  } });
  await assert.rejects(new SilenceTakeSplitter().split('data:audio/wav;base64,', anchorWeights), {
    message: '줄 길이 비율이 맞는 자르기 위치를 찾지 못했습니다.',
  });
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
