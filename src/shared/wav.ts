// 서버(Node)와 브라우저 양쪽에서 쓰는 WAV 유틸. Buffer 대신 Uint8Array/DataView만 사용한다.

export interface PcmFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: 16;
}

const DEFAULT_PCM: PcmFormat = { sampleRate: 24000, channels: 1, bitsPerSample: 16 };

/** 응답 mimeType이 이미 WAV 컨테이너인지 */
export function isWavMime(mimeType: string | undefined): boolean {
  return !!mimeType && /audio\/(x-)?wav/i.test(mimeType);
}

/** "audio/L16;codec=pcm;rate=24000" 같은 raw PCM mimeType에서 포맷을 읽는다. 값이 없으면 기본값. */
export function parsePcmMime(mimeType: string | undefined): PcmFormat {
  const rate = mimeType?.match(/rate=(\d+)/i);
  const channels = mimeType?.match(/channels=(\d+)/i);
  return {
    sampleRate: rate ? Number(rate[1]) : DEFAULT_PCM.sampleRate,
    channels: channels ? Number(channels[1]) : DEFAULT_PCM.channels,
    bitsPerSample: 16,
  };
}

/** 헤더 없는 16bit little-endian PCM 앞에 44바이트 WAV 헤더를 붙인다. */
export function wrapPcm16AsWav(pcm: Uint8Array, format: PcmFormat): Uint8Array<ArrayBuffer> {
  const { sampleRate, channels, bitsPerSample } = format;
  const blockAlign = (channels * bitsPerSample) / 8;
  const out = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(out.buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  out.set(pcm, 44);
  return out;
}

export class PcmWavError extends Error {
  readonly name = 'PcmWavError';
}

/** PCM 16bit WAV의 청크를 읽고 인터리브된 샘플을 채널별로 복원한다. */
export function decodePcm16Wav(bytes: Uint8Array): { sampleRate: number; channels: Float32Array[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new PcmWavError('WAV RIFF 헤더가 올바르지 않습니다.');
  }
  const end = view.getUint32(4, true) + 8;
  if (end < 12 || end > bytes.length) throw new PcmWavError('WAV 파일이 잘렸습니다.');
  let format: { sampleRate: number; channels: number; blockAlign: number } | undefined;
  const chunks: { start: number; size: number }[] = [];
  let offset = 12;
  while (offset + 8 <= end) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > end) throw new PcmWavError('WAV 청크가 잘렸습니다.');
    if (tag(offset) === 'fmt ') {
      if (size < 16) throw new PcmWavError('WAV fmt 청크가 잘렸습니다.');
      if (view.getUint16(start, true) !== 1 || view.getUint16(start + 14, true) !== 16) {
        throw new PcmWavError('WAV는 16bit PCM 형식만 지원합니다.');
      }
      const channels = view.getUint16(start + 2, true);
      const sampleRate = view.getUint32(start + 4, true);
      const blockAlign = view.getUint16(start + 12, true);
      if (!channels || !sampleRate || blockAlign !== channels * 2 ||
        view.getUint32(start + 8, true) !== sampleRate * blockAlign) {
        throw new PcmWavError('WAV PCM 포맷이 올바르지 않습니다.');
      }
      format = { channels, sampleRate, blockAlign };
    }
    if (tag(offset) === 'data') chunks.push({ start, size });
    offset = start + size + size % 2;
  }
  if (offset !== end || !format || !chunks.length) throw new PcmWavError('WAV 필수 청크 또는 패딩이 없습니다.');
  const { sampleRate, channels: count, blockAlign } = format;
  if (chunks.some(({ size }) => size % blockAlign !== 0)) throw new PcmWavError('WAV 샘플 프레임이 잘렸습니다.');
  const frames = chunks.reduce((total, { size }) => total + size / blockAlign, 0);
  const channels = Array.from({ length: count }, () => new Float32Array(frames));
  let frame = 0;
  for (const { start, size } of chunks) {
    for (let position = start; position < start + size; position += blockAlign) {
      for (let channel = 0; channel < count; channel++) {
        const value = view.getInt16(position + channel * 2, true);
        channels[channel][frame] = value / (value < 0 ? 0x8000 : 0x7fff);
      }
      frame++;
    }
  }
  return { sampleRate, channels };
}

/** float 채널 데이터(-1..1)를 16bit WAV로 인코딩한다. 브라우저의 AudioBuffer 내보내기에 쓴다. */
export function encodeFloatChannelsToWav(channels: Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const frames = channels[0]?.length ?? 0;
  const pcm = new Uint8Array(frames * channels.length * 2);
  const view = new DataView(pcm.buffer);
  let offset = 0;
  for (let i = 0; i < frames; i++) {
    for (const ch of channels) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return wrapPcm16AsWav(pcm, { sampleRate, channels: channels.length, bitsPerSample: 16 });
}
