import { countSyllables, lineText } from '../../src/data/platingScript';
import type { ScriptLine } from '../../src/data/platingScript';
import { findLineRanges, suspiciousRanges } from '../../src/audio/takeSplitter';
import { batchRequest, groupConsecutiveLines } from '../../src/script/lineGroups';
import type { ScriptLineGroup } from '../../src/script/lineGroups';
import { decodePcm16Wav, encodeFloatChannelsToWav } from '../../src/shared/wav';
import { generateDubbing } from '../dubbing';
import type { GeminiClient } from '../dubbing';
import { CliArgumentError } from './dubArgs';
import type { DubOptions } from './dubArgs';

export type BatchPlan = {
  readonly id: string;
  readonly lineCount: number;
  readonly calls: 0 | 1;
};

export type BatchAudioResult = {
  readonly texts: readonly string[];
  readonly stylePrompt: string;
} & (
  | { readonly kind: 'split'; readonly segments: readonly {
    readonly bytes: Uint8Array; readonly audioSeconds: number; readonly suspicious: boolean;
  }[] }
  | { readonly kind: 'whole'; readonly bytes: Uint8Array; readonly reason: string }
);

export function planDubGroups(lines: ScriptLine[], options: DubOptions): ScriptLineGroup[] {
  const single = (line: ScriptLine): ScriptLineGroup => ({
    id: `${line.id}~${line.id}`, scene: line.id.split('-')[0], speaker: line.speaker, lines: [line],
  });
  if (!options.batch) return lines.map(single);
  return groupConsecutiveLines(lines).flatMap((group) =>
    // 선택한 언어 대사가 빠진 묶음은 한 줄씩 처리해 해당 줄만 경고하고 건너뛴다.
    group.lines.some((line) => !lineText(line, options.language)?.trim()) ? group.lines.map(single) : [group]);
}

/** 자르기에 실패한 원본은 첫 줄 이름을 바탕으로 별도의 묶음 버전을 쓴다. */
export function nextBatchName(firstRecordName: string, names: readonly string[]): string {
  const prefix = `${firstRecordName.replace(/-v\d+$/, '')}-batch-v`;
  const last = names.reduce((max, name) => {
    if (!name.startsWith(prefix)) return max;
    const version = Number(name.slice(prefix.length));
    return Number.isInteger(version) && version > max ? version : max;
  }, 0);
  return `${prefix}${last + 1}`;
}

export async function generateBatch(
  ai: GeminiClient, group: ScriptLineGroup, options: DubOptions,
): Promise<BatchAudioResult> {
  const request = batchRequest(group, options.stylePrompt, options.language);
  const texts = request.texts.filter((text): text is string => Boolean(text?.trim()));
  if (texts.length !== group.lines.length) throw new CliArgumentError('묶음에 선택한 언어의 대사가 없는 줄이 있습니다.');
  const result = await generateDubbing(ai, {
    text: texts.join('\n\n'), voiceName: options.voiceName, stylePrompt: request.stylePrompt,
    language: options.language, modelPreference: options.modelPreference,
  });
  const bytes = Buffer.from(result.wavBase64, 'base64');
  try {
    const { sampleRate, channels } = decodePcm16Wav(bytes);
    const samples = channels[0];
    const weights = texts.map((text) => countSyllables(text) || text.length);
    const ranges = findLineRanges(samples, sampleRate, texts.length, weights);
    const suspicious = suspiciousRanges(ranges, weights);
    return { kind: 'split', texts, stylePrompt: request.stylePrompt, segments: ranges.map(({ start, end }, index) => ({
      bytes: encodeFloatChannelsToWav([samples.slice(start, end)], sampleRate),
      audioSeconds: (end - start) / sampleRate, suspicious: suspicious.includes(index),
    })) };
  } catch (error) {
    // 생성에 쓴 호출을 낭비하지 않도록 자르지 못한 원본도 보존한다.
    if (error instanceof Error) return { kind: 'whole', bytes, reason: error.message, texts, stylePrompt: request.stylePrompt };
    throw error;
  }
}

export function formatBatchPlan(plans: readonly BatchPlan[]): string {
  return [
    `묶음 ${plans.length}개 | 호출 예정 ${plans.reduce((total, plan) => total + plan.calls, 0)}회`,
    '묶음 id | 줄 수 | 호출 예정 횟수',
    ...plans.map((plan) => `${plan.id.replace(/[\r\n|]+/g, ' ')} | ${plan.lineCount} | ${plan.calls}`),
  ].join('\n');
}
