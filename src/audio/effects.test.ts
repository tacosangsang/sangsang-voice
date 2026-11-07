import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { buildImpulseResponse } from './effects';

function context(sampleRate = 8000): BaseAudioContext {
  // 임펄스 생성에 필요한 두 기능만 제공한다. 오디오 노드와 브라우저 실행은 범위 밖이다.
  return {
    sampleRate,
    createBuffer(numberOfChannels: number, length: number, rate: number) {
      const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
      return { numberOfChannels, length, sampleRate: rate, getChannelData: (c: number) => channels[c] };
    },
  } as unknown as BaseAudioContext;
}

afterEach(() => mock.restoreAll());

for (const [rate, duration] of [[8000, 0.3701], [24000, 2.5]] as const) {
  test(`임펄스는 두 채널과 내림한 샘플 길이를 쓴다: ${rate}Hz ${duration}초`, () => {
    const impulse = buildImpulseResponse(context(rate), duration, 2);
    assert.equal(impulse.numberOfChannels, 2);
    assert.equal(impulse.length, Math.floor(rate * duration));
    assert.equal(impulse.sampleRate, rate);
    assert.equal(impulse.getChannelData(0).length, Math.floor(rate * duration));
    assert.equal(impulse.getChannelData(1).length, Math.floor(rate * duration));
  });
}

test('두 채널의 모든 임펄스 샘플은 음수 1과 양수 1 사이에 있다', () => {
  const randomValues = [0, 0.25, 0.5, 0.75, 1 - Number.EPSILON];
  let index = 0;
  mock.method(Math, 'random', () => randomValues[index++ % randomValues.length]);

  const impulse = buildImpulseResponse(context(), 1, 2);

  for (let c = 0; c < 2; c++) {
    assert.ok(impulse.getChannelData(c).every((sample) => sample >= -1 && sample <= 1));
  }
});

test('임펄스 앞 10퍼센트의 절댓값 평균은 뒤 10퍼센트보다 크다', () => {
  mock.method(Math, 'random', () => 0.75);

  const impulse = buildImpulseResponse(context(), 1, 2);

  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    const size = Math.floor(data.length * 0.1);
    const mean = (samples: Float32Array) => samples.reduce((sum, sample) => sum + Math.abs(sample), 0) / samples.length;
    assert.ok(mean(data.subarray(0, size)) > mean(data.subarray(-size)));
  }
});
