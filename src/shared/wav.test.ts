import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodePcm16Wav, encodeFloatChannelsToWav, isWavMime, parsePcmMime, wrapPcm16AsWav } from './wav';

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

test('PCM 16bit WAV를 되읽으면 부호와 최댓값을 복원한다', () => {
  const integers = [-32768, -16384, -1, 0, 1, 16384, 32767];
  const pcm = new Uint8Array(integers.length * 2);
  const view = new DataView(pcm.buffer);
  integers.forEach((value, index) => view.setInt16(index * 2, value, true));
  const wav = wrapPcm16AsWav(pcm, { sampleRate: 24000, channels: 1, bitsPerSample: 16 });

  const decoded = decodePcm16Wav(wav);

  assert.equal(decoded.sampleRate, 24000);
  assert.deepEqual(decoded.channels, [Float32Array.from(integers, (value) => value / (value < 0 ? 32768 : 32767))]);
});

test('float WAV를 되읽으면 클리핑 경계를 포함해 양자화 오차 안에서 복원한다', () => {
  const samples = Float32Array.from([-2, -1, -0.5, 0, 0.5, 1, 2]);
  const decoded = decodePcm16Wav(encodeFloatChannelsToWav([samples], 16000));
  samples.forEach((value, index) => {
    assert.ok(Math.abs(decoded.channels[0][index] - Math.max(-1, Math.min(1, value))) <= 1 / 32767);
  });
  assert.equal(decoded.channels[0][0], -1);
  assert.equal(decoded.channels[0][6], 1);
});

test('두 채널 인터리브와 부분 버퍼의 시작 위치를 복원한다', () => {
  const channels = [Float32Array.from([-1, 0, 1]), Float32Array.from([1, -1, 0])];
  const wav = encodeFloatChannelsToWav(channels, 48000);
  const padded = new Uint8Array(wav.length + 9);
  padded.set(wav, 5);

  assert.deepEqual(decodePcm16Wav(padded.subarray(5, 5 + wav.length)), { sampleRate: 48000, channels });
});

test('홀수 크기 추가 청크의 패딩과 data 뒤의 추가 청크를 건너뛴다', () => {
  const wav = encodeFloatChannelsToWav([Float32Array.from([1, -1])], 16000);
  const junk = Uint8Array.from([74, 85, 78, 75, 1, 0, 0, 0, 7, 0]);
  const extended = new Uint8Array(wav.length + junk.length * 2);
  extended.set(wav.subarray(0, 12));
  extended.set(junk, 12);
  extended.set(wav.subarray(12), 22);
  extended.set(junk, wav.length + junk.length);
  new DataView(extended.buffer).setUint32(4, extended.length - 8, true);

  assert.deepEqual(decodePcm16Wav(extended), decodePcm16Wav(wav));
});

test('data가 fmt 앞에 있어도 두 청크를 찾아 읽는다', () => {
  const wav = encodeFloatChannelsToWav([Float32Array.from([1])], 16000);
  const reordered = new Uint8Array(wav.length);
  reordered.set(wav.subarray(0, 12));
  reordered.set(wav.subarray(36), 12);
  reordered.set(wav.subarray(12, 36), 22);

  assert.deepEqual(decodePcm16Wav(reordered), decodePcm16Wav(wav));
});

for (const [label, offset, value] of [
  ['8bit', 34, 8], ['float PCM', 20, 3], ['채널 없음', 22, 0],
  ['블록 정렬 오류', 32, 3], ['샘플레이트 없음', 24, 0],
] as const) {
  test(`지원하지 않거나 잘못된 WAV 형식은 거절한다: ${label}`, () => {
    const wav = encodeFloatChannelsToWav([Float32Array.from([1])], 16000);
    new DataView(wav.buffer).setUint16(offset, value, true);
    assert.throws(() => decodePcm16Wav(wav), /WAV/);
  });
}

test('잘린 청크와 누락된 필수 청크를 거절한다', () => {
  const wav = encodeFloatChannelsToWav([Float32Array.from([1])], 16000);
  const missingData = wav.slice(0, 36);
  new DataView(missingData.buffer).setUint32(4, missingData.length - 8, true);
  for (const bytes of [new Uint8Array(12), wav.subarray(0, wav.length - 1), missingData]) {
    assert.throws(() => decodePcm16Wav(bytes), /WAV/);
  }
});
