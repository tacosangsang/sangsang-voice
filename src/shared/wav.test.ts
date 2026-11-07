import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeFloatChannelsToWav, isWavMime, parsePcmMime, wrapPcm16AsWav } from './wav';

for (const [label, mime, expected] of [
  ['표준 형식', 'audio/wav', true],
  ['대체 형식', 'audio/x-wav', true],
  ['대문자 형식', 'AUDIO/X-WAV', true],
  ['없는 형식', undefined, false],
  ['원시 음성 형식', 'audio/L16', false],
] as const) {
  test(`WAV 형식 판별: ${label}`, () => {
    assert.equal(isWavMime(mime), expected);
  });
}

for (const [label, mime, sampleRate, channels] of [
  ['명시한 값', 'audio/L16;rate=48000;channels=2', 48000, 2],
  ['대소문자가 섞인 값', 'AUDIO/L16;RATE=16000;CHANNELS=2', 16000, 2],
  ['속도만 있는 값', 'audio/L16;rate=16000', 16000, 1],
  ['채널만 있는 값', 'audio/L16;channels=2', 24000, 2],
  ['매개변수가 없는 값', 'audio/L16', 24000, 1],
  ['없는 형식', undefined, 24000, 1],
] as const) {
  test(`PCM 형식 해석: ${label}`, () => {
    assert.deepEqual(parsePcmMime(mime), { sampleRate, channels, bitsPerSample: 16 });
  });
}

const format = { sampleRate: 48000, channels: 2, bitsPerSample: 16 } as const;

for (const [label, offset, expected] of [
  ['파일 식별자', 0, 'RIFF'], ['컨테이너 식별자', 8, 'WAVE'],
  ['형식 식별자', 12, 'fmt '], ['본문 식별자', 36, 'data'],
] as const) {
  test(`WAV 헤더 문자: ${label}`, () => {
    const wav = wrapPcm16AsWav(new Uint8Array(8), format);
    assert.equal(new TextDecoder().decode(wav.subarray(offset, offset + 4)), expected);
  });
}

for (const [label, offset, bytes, expected] of [
  ['청크 크기', 4, 4, 44], ['형식 청크 크기', 16, 4, 16],
  ['PCM 형식 번호', 20, 2, 1], ['채널 수', 22, 2, 2],
  ['샘플레이트', 24, 4, 48000], ['바이트레이트', 28, 4, 192000],
  ['블록 정렬', 32, 2, 4], ['샘플 비트 수', 34, 2, 16], ['본문 크기', 40, 4, 8],
] as const) {
  test(`WAV 헤더 숫자: ${label}`, () => {
    const wav = wrapPcm16AsWav(new Uint8Array(8), format);
    const view = new DataView(wav.buffer);
    assert.equal(bytes === 2 ? view.getUint16(offset, true) : view.getUint32(offset, true), expected);
  });
}

test('PCM 본문은 44바이트 뒤에 그대로 붙는다', () => {
  const pcm = new Uint8Array([0x01, 0x23, 0x45, 0x67]);
  assert.deepEqual(wrapPcm16AsWav(pcm, format).subarray(44), pcm);
});

test('빈 PCM도 본문 크기가 0인 44바이트 헤더를 만든다', () => {
  const wav = wrapPcm16AsWav(new Uint8Array(), format);
  assert.equal(wav.length, 44);
  assert.equal(new DataView(wav.buffer).getUint32(4, true), 36);
  assert.equal(new DataView(wav.buffer).getUint32(40, true), 0);
});

for (const [label, value, expected] of [
  ['영점', 0, 0], ['양의 최댓값', 1, 32767], ['음의 최솟값', -1, -32768],
  ['양수 클리핑', 1.5, 32767], ['음수 클리핑', -1.5, -32768],
] as const) {
  test(`실수 샘플의 16비트 변환: ${label}`, () => {
    const wav = encodeFloatChannelsToWav([new Float32Array([value])], 24000);
    assert.equal(new DataView(wav.buffer).getInt16(44, true), expected);
  });
}

test('두 채널은 프레임마다 왼쪽과 오른쪽 순서로 섞인다', () => {
  const wav = encodeFloatChannelsToWav([new Float32Array([1, 0]), new Float32Array([-1, 1])], 16000);
  const view = new DataView(wav.buffer);
  assert.deepEqual([44, 46, 48, 50].map((offset) => view.getInt16(offset, true)), [32767, -32768, 0, 32767]);
});

for (const [label, channels] of [
  ['채널 목록이 빈 경우', []], ['채널의 샘플이 빈 경우', [new Float32Array()]],
] satisfies [string, Float32Array[]][]) {
  test(`${label} WAV 본문 길이는 0이다`, () => {
    const wav = encodeFloatChannelsToWav(channels, 24000);
    assert.equal(wav.length, 44);
    assert.equal(new DataView(wav.buffer).getUint32(40, true), 0);
  });
}
