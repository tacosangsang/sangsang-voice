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
