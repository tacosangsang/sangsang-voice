// 여러 줄을 한 번에 뽑은 음성을 줄마다 자른다.
// 지금 구현은 무음 구간 기준이다. 줄 사이 쉼이 줄 안의 쉼보다 길다는 가정이라, 다른 방법(글자 정렬 등)은 TakeSplitter를 구현한다.

import { encodeFloatChannelsToWav } from '../shared/wav';

export interface SplitSegment {
  /** WAV data URL */
  audioUrl: string;
  durationSec: number;
}

export interface SplitResult {
  segments: SplitSegment[];
  /** 잘린 길이가 대사 길이 비율과 크게 다른 줄 번호(0부터) */
  suspicious: number[];
}

export interface TakeSplitter {
  /** weights: 줄마다 예상 길이 비중(예: 글자 수). 개수가 곧 자를 줄 수다. */
  split(audioUrl: string, weights: number[]): Promise<SplitResult>;
}

const FRAME_SEC = 0.01;
/** 이보다 짧은 쉼은 줄 사이로 보지 않는다 */
const MIN_GAP_SEC = 0.12;
/** 잘라 낸 줄 앞뒤에 남기는 여유 */
const PAD_SEC = 0.08;
/** 가장 큰 소리보다 이만큼(dB) 작으면 무음 */
const SILENCE_DB = -35;

export interface SampleRange {
  start: number;
  end: number;
}

/** 자를 위치 계산(브라우저 API 없음). 실패하면 이유를 담아 던진다. */
export function findLineRanges(samples: Float32Array, sampleRate: number, count: number): SampleRange[] {
  const frame = Math.max(1, Math.round(sampleRate * FRAME_SEC));
  const frames = Math.floor(samples.length / frame);
  const rms = new Float32Array(frames);
  let peak = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) sum += samples[i] * samples[i];
    rms[f] = Math.sqrt(sum / frame);
    peak = Math.max(peak, rms[f]);
  }
  const threshold = Math.max(peak * 10 ** (SILENCE_DB / 20), 1e-4);
  const silent = (f: number) => rms[f] < threshold;

  const firstVoice = rms.findIndex((_, f) => !silent(f));
  let lastVoice = frames - 1;
  while (lastVoice >= 0 && silent(lastVoice)) lastVoice--;
  if (firstVoice < 0) throw new Error('소리가 없습니다.');

  // 말소리 사이의 무음 구간
  const gaps: SampleRange[] = [];
  for (let f = firstVoice; f <= lastVoice; f++) {
    if (!silent(f)) continue;
    const start = f;
    while (f <= lastVoice && silent(f)) f++;
    if ((f - start) * FRAME_SEC >= MIN_GAP_SEC) gaps.push({ start, end: f });
  }
  if (gaps.length < count - 1) {
    throw new Error(`줄 사이 쉼을 ${count - 1}곳 찾아야 하는데 ${gaps.length}곳뿐입니다.`);
  }

  // 가장 긴 쉼 count-1개를 줄 경계로 본다.
  const cuts = [...gaps]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, count - 1)
    .sort((a, b) => a.start - b.start);

  const pad = Math.round(PAD_SEC / FRAME_SEC);
  const voiceStarts = [firstVoice, ...cuts.map((c) => c.end)];
  const voiceEnds = [...cuts.map((c) => c.start), lastVoice + 1];
  return voiceStarts.map((s, i) => ({
    start: Math.max(0, s - pad) * frame,
    end: Math.min(frames, voiceEnds[i] + pad) * frame,
  }));
}

/** 잘린 길이 비중이 예상 비중의 절반 미만이거나 두 배를 넘는 줄 */
export function suspiciousRanges(ranges: SampleRange[], weights: number[]): number[] {
  const total = ranges.reduce((n, r) => n + r.end - r.start, 0);
  const weightTotal = weights.reduce((n, w) => n + w, 0);
  return ranges.flatMap((r, i) => {
    const ratio = (r.end - r.start) / total / (weights[i] / weightTotal);
    return ratio < 0.5 || ratio > 2 ? [i] : [];
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class SilenceTakeSplitter implements TakeSplitter {
  async split(audioUrl: string, weights: number[]): Promise<SplitResult> {
    const encoded = await (await fetch(audioUrl)).arrayBuffer();
    const audio = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(encoded);
    const samples = audio.getChannelData(0);
    const ranges = findLineRanges(samples, audio.sampleRate, weights.length);
    const segments = await Promise.all(
      ranges.map(async (r) => {
        const wav = encodeFloatChannelsToWav([samples.slice(r.start, r.end)], audio.sampleRate);
        return {
          audioUrl: await blobToDataUrl(new Blob([wav], { type: 'audio/wav' })),
          durationSec: (r.end - r.start) / audio.sampleRate,
        };
      }),
    );
    return { segments, suspicious: suspiciousRanges(ranges, weights) };
  }
}
