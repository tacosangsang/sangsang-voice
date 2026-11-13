// 여러 줄을 한 번에 뽑은 음성을 줄마다 자른다.
// 무음 후보에서 대사 길이 비율에 맞는 경계를 고른다. 다른 방법(글자 정렬 등)은 TakeSplitter를 구현한다.

import { encodeFloatChannelsToWav } from '../shared/wav';

export interface SplitSegment {
  /** WAV data URL */
  audioUrl: string;
  durationSec: number;
}

export interface SplitResult {
  segments: SplitSegment[];
  /** 말소리 길이가 대사 길이 비율과 크게 다른 줄 번호(0부터) */
  suspicious: number[];
}

export interface TakeSplitter {
  /** weights: 줄마다 예상 길이 비중(한글 음절 수, 없으면 글자 수). 개수가 곧 자를 줄 수다. */
  split(audioUrl: string, weights: number[]): Promise<SplitResult>;
}

const FRAME_SEC = 0.01;
/** 이보다 짧은 쉼은 줄 사이로 보지 않는다 */
const MIN_GAP_SEC = 0.12;
/** 기존 비율 판정에만 쓰는 말소리 앞뒤 여유. 저장 범위에는 적용하지 않는다. */
const VOICE_PAD_SEC = 0.08;
/** 가장 큰 소리보다 이만큼(dB) 작으면 무음 */
const SILENCE_DB = -35;

export interface SampleRange {
  start: number;
  end: number;
}

/** 쉼 중앙으로 나눈 길이를 써서 전체 길이를 고정하고 O(G²·N)으로 최소 비용 경로를 찾는다. */
function weightedCuts(gaps: SampleRange[], firstVoice: number, voiceEnd: number, count: number, weights: number[]): SampleRange[] {
  if (weights.length !== count || weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new RangeError('줄 길이 가중치는 줄 수만큼의 양수여야 합니다.');
  }
  const positions = [firstVoice, ...gaps.map((gap) => (gap.start + gap.end) / 2), voiceEnd];
  const total = voiceEnd - firstVoice;
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  type State = { readonly cost: number; readonly gapFrames: number; readonly previous: number };
  const paths = Array.from({ length: count + 1 }, () => Array<State | undefined>(positions.length));
  paths[0][0] = { cost: 0, gapFrames: 0, previous: -1 };
  for (let line = 1; line <= count; line++) {
    const expected = weights[line - 1] / weightTotal;
    for (let end = line; end < positions.length; end++) {
      if ((line === count) !== (end === positions.length - 1)) continue;
      const gapFrames = end <= gaps.length ? gaps[end - 1].end - gaps[end - 1].start : 0;
      for (let start = line - 1; start < end; start++) {
        const previous = paths[line - 1][start];
        if (!previous) continue;
        const ratio = (positions[end] - positions[start]) / total / expected;
        const cost = previous.cost + Math.log(ratio) ** 2;
        const silence = previous.gapFrames + gapFrames;
        const best = paths[line][end];
        if (!best || cost < best.cost - 1e-12 || (Math.abs(cost - best.cost) <= 1e-12 && silence > best.gapFrames)) {
          paths[line][end] = { cost, gapFrames: silence, previous: start };
        }
      }
    }
  }
  const cuts: SampleRange[] = [];
  let end = positions.length - 1;
  for (let line = count; line > 0; line--) {
    const state = paths[line][end];
    if (!state) throw new Error('줄 길이 비율이 맞는 자르기 위치를 찾지 못했습니다.');
    if (end <= gaps.length) cuts.push(gaps[end - 1]);
    end = state.previous;
  }
  return cuts.reverse();
}

/** 저장용 분할 범위와 비율 판정용 말소리 범위(브라우저 API 없음). 실패하면 이유를 담아 던진다. */
export function findLineRanges(samples: Float32Array, sampleRate: number, count: number, weights?: number[]): {
  readonly segments: SampleRange[];
  readonly voice: SampleRange[];
} {
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

  // 가중치가 없으면 기존처럼 가장 긴 쉼 count-1개를 줄 경계로 본다.
  const cuts = weights ? weightedCuts(gaps, firstVoice, lastVoice + 1, count, weights) : [...gaps]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, count - 1)
    .sort((a, b) => a.start - b.start);

  const pad = Math.round(VOICE_PAD_SEC / FRAME_SEC);
  const voiceStarts = [firstVoice, ...cuts.map((c) => c.end)];
  const voiceEnds = [...cuts.map((c) => c.start), lastVoice + 1];
  const voice = voiceStarts.map((start, i) => ({
    start: Math.max(0, start - pad) * frame,
    end: Math.min(frames, voiceEnds[i] + pad) * frame,
  }));
  if (weights) {
    const total = voice.reduce((sum, range) => sum + range.end - range.start, 0);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    if (voice.some((range, index) => {
      const ratio = (range.end - range.start) / total / (weights[index] / weightTotal);
      return ratio < 0.6 || ratio > 1.6;
    })) throw new Error('줄 길이 비율이 맞는 자르기 위치를 찾지 못했습니다.');
  }
  // 같은 샘플 경계를 공유해 쉼과 프레임보다 짧은 마지막 꼬리까지 빠짐없이 남긴다.
  const boundaries = [0, ...cuts.map((cut) => Math.round((cut.start + cut.end) * frame / 2)), samples.length];
  const segments = boundaries.slice(1).map((end, index) => ({ start: boundaries[index], end }));
  return { segments, voice };
}

/** 말소리 길이 비중이 예상 비중의 절반 미만이거나 두 배를 넘는 줄 */
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
    const { segments: ranges, voice } = findLineRanges(samples, audio.sampleRate, weights.length, weights);
    const segments = await Promise.all(
      ranges.map(async (r) => {
        const wav = encodeFloatChannelsToWav([samples.slice(r.start, r.end)], audio.sampleRate);
        return {
          audioUrl: await blobToDataUrl(new Blob([wav], { type: 'audio/wav' })),
          durationSec: (r.end - r.start) / audio.sampleRate,
        };
      }),
    );
    return { segments, suspicious: suspiciousRanges(voice, weights) };
  }
}
