import { checkFit, lineText } from '../../src/data/platingScript';
import type { ScriptLine, Speaker } from '../../src/data/platingScript';
import { nextRecordName } from '../../src/data/recordName';
import type { ScriptSource } from '../../src/script/source';
import type { DubbingItem } from '../../src/types';
import type { RecordingStatus } from '../../src/shared/recording';
import { generateDubbing } from '../dubbing';
import type { GeminiClient } from '../dubbing';
import type { RecordingRepository } from '../githubRecordingRepository';
import { CliArgumentError } from './dubArgs';
import type { DubOptions, LineSelection } from './dubArgs';
import { generateBatch, nextBatchName, planDubGroups } from './dubBatch';
import type { BatchPlan } from './dubBatch';
import type { FileStore } from './fileStore';
import { prepareRecordings, uploadClip } from './dubRecordings';

export type DubRow = {
  readonly line: ScriptLine;
  readonly recordName: string;
  readonly uploadFailed?: boolean;
} & (
  | { readonly status: 'generated'; readonly audioSeconds: number; readonly suspicious?: boolean }
  | { readonly status: 'unsplit'; readonly audioSeconds: number; readonly reason: string }
  | { readonly status: 'dry-run' }
  | { readonly status: 'skipped' | 'failed'; readonly reason: string }
);

export type DubReport = {
  readonly rows: readonly DubRow[];
  readonly warnings: readonly string[];
  readonly batches: readonly BatchPlan[];
  readonly recordingStatus: RecordingStatus;
  readonly exitCode: 0 | 2;
};

export class WavHeaderError extends Error {
  readonly name = 'WavHeaderError';
  constructor() { super('WAV 헤더 또는 오디오 데이터 크기가 올바르지 않습니다.'); }
}

export function selectLines(lines: readonly ScriptLine[], selection: LineSelection): ScriptLine[] {
  return lines.filter((line) =>
    (!selection.scenes.length || selection.scenes.some((scene) => line.cut.startsWith(scene))) &&
    (!selection.cuts.length || selection.cuts.includes(line.cut)) &&
    (!selection.speakers.length || selection.speakers.includes(line.speaker)));
}

export function recordNamesFromPaths(paths: readonly string[]): string[] {
  return paths.filter((path) => /\.wav$/i.test(path))
    .map((path) => path.replaceAll('\\', '/').replace(/\.wav$/i, ''));
}

export function planLine(line: ScriptLine, speakers: Speaker[], options: DubOptions, names: readonly string[]) {
  const clip: DubbingItem = {
    id: line.id, scriptLineId: line.id, presetName: '', voiceName: options.voiceName,
    text: '', stylePrompt: '', mimeType: 'audio/wav', audioUrl: '', createdAt: 0, language: options.language,
  };
  const existing = names.map((recordName) => ({ ...clip, recordName }));
  const next = nextRecordName(clip, [line], speakers, existing);
  const version = Number(next.slice(next.lastIndexOf('-v') + 2));
  const skipExisting = !options.force && version > 1;
  return {
    recordName: skipExisting ? next.replace(/-v\d+$/, `-v${version - 1}`) : next,
    skipExisting,
  };
}

export function wavDurationSeconds(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new WavHeaderError();
  const end = view.getUint32(4, true) + 8;
  if (end < 12 || end > bytes.length) throw new WavHeaderError();
  let byteRate: number | undefined;
  let dataSize: number | undefined;
  let offset = 12;
  while (offset + 8 <= end) {
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > end) throw new WavHeaderError();
    if (tag(offset) === 'fmt ') {
      if (size < 16) throw new WavHeaderError();
      byteRate = view.getUint32(start + 8, true);
    }
    if (tag(offset) === 'data') dataSize = (dataSize ?? 0) + size;
    offset = start + size + (size % 2);
  }
  if (offset !== end || !byteRate || dataSize === undefined) throw new WavHeaderError();
  return dataSize / byteRate;
}

export async function dubLines(
  source: ScriptSource, store: FileStore, ai: GeminiClient | undefined, options: DubOptions,
  repository?: RecordingRepository, recordingsProblem?: string,
): Promise<DubReport> {
  const snapshot = await source.load();
  const selectedLines = selectLines(snapshot.lines, options);
  const selectedSpeakerIds = [...new Set(selectedLines.map((line) => line.speaker))];
  if (selectedSpeakerIds.length > 1) {
    throw new CliArgumentError(`선택된 줄에 화자가 ${selectedSpeakerIds.length}명입니다(${selectedSpeakerIds.join(', ')}). --speaker로 한 화자만 고르세요.`);
  }
  const recordings = await prepareRecordings(repository, options.noUpload, recordingsProblem);
  const names = [...new Set([...recordNamesFromPaths(await store.list()), ...recordings.names])];
  const warnings = [...snapshot.warnings, ...recordings.warnings];
  const rows: DubRow[] = [];
  const batches: BatchPlan[] = [];
  let lastCreatedAt = 0;
  for (const group of planDubGroups(selectedLines, options)) {
    const plans = group.lines.map((line) => planLine(line, snapshot.speakers, options, names));
    const allExist = plans.every((plan) => plan.skipExisting);
    if (options.batch) batches.push({ id: group.id, lineCount: group.lines.length,
      calls: allExist || !group.lines.some((line) => lineText(line, options.language)?.trim()) ? 0 : 1 });
    if (group.lines.length > 1) {
      if (allExist) {
        group.lines.forEach((line, index) => rows.push({ line, recordName: plans[index].recordName,
          status: 'skipped', reason: '이미 같은 이름의 파일이 있습니다.' }));
        continue;
      }
      if (!options.force && plans.some((plan) => plan.skipExisting)) {
        warnings.push(`${group.id}: 묶음 일부만 저장되어 있어 이미 있는 줄도 다시 생성합니다. 기존 파일은 보존하고 다음 버전으로 저장합니다.`);
      }
      const batchOptions = { ...options, force: true };
      if (options.dryRun) {
        for (const line of group.lines) {
          const { recordName } = planLine(line, snapshot.speakers, batchOptions, names);
          rows.push({ line, recordName, status: 'dry-run' });
          names.push(recordName);
        }
        continue;
      }
      try {
        if (!ai) throw new CliArgumentError('Gemini 클라이언트가 없습니다.');
        const audio = await generateBatch(ai, group, options);
        const createdAt = Math.max(Date.now(), lastCreatedAt + 1);
        lastCreatedAt = createdAt;
        switch (audio.kind) {
          case 'whole': {
            const line = group.lines[0];
            const recordName = nextBatchName(plans[0].recordName, names);
            const audioSeconds = wavDurationSeconds(audio.bytes);
            await store.write(`${recordName}.wav`, audio.bytes);
            names.push(recordName);
            const uploadFailed = await uploadClip(recordings.repository, {
              id: `cli-batch-${createdAt}-0`, presetName: `묶음 ${group.id} ${options.voiceName} (자르기 실패)`,
              voiceName: options.voiceName, text: audio.texts.join('\n\n'), stylePrompt: audio.stylePrompt,
              duration: audioSeconds, language: options.language, mimeType: 'audio/wav', recordName, createdAt,
            }, audio.bytes, warnings);
            rows.push({ line, recordName, status: 'unsplit', audioSeconds, uploadFailed,
              reason: `${group.id}: ${audio.reason}` });
            break;
          }
          case 'split': {
            for (const [index, line] of group.lines.entries()) {
              const { recordName } = planLine(line, snapshot.speakers, batchOptions, names);
              const segment = audio.segments[index];
              try {
                await store.write(`${recordName}.wav`, segment.bytes);
                names.push(recordName);
                const uploadFailed = await uploadClip(recordings.repository, {
                  id: `cli-batch-${createdAt}-${index}`, presetName: `${line.cut} ${options.voiceName} (묶음)`,
                  voiceName: options.voiceName, text: audio.texts[index], stylePrompt: audio.stylePrompt,
                  duration: segment.audioSeconds, scriptLineId: line.id, language: options.language,
                  mimeType: 'audio/wav', recordName, createdAt: createdAt - index,
                }, segment.bytes, warnings);
                rows.push({ line, recordName, status: 'generated', audioSeconds: segment.audioSeconds,
                  suspicious: segment.suspicious, uploadFailed });
              } catch (error) {
                rows.push({ line, recordName, status: 'failed', reason: error instanceof Error ? error.message : '알 수 없는 저장 오류' });
              }
            }
            break;
          }
          default: {
            const unreachable: never = audio;
            throw new TypeError(`알 수 없는 묶음 결과: ${unreachable}`);
          }
        }
      } catch (error) {
        for (const line of group.lines) {
          const { recordName } = planLine(line, snapshot.speakers, batchOptions, names);
          rows.push({ line, recordName, status: 'failed', reason: error instanceof Error ? error.message : '알 수 없는 묶음 생성 오류' });
        }
      }
      continue;
    }
    const line = group.lines[0];
    const { recordName, skipExisting } = planLine(line, snapshot.speakers, options, names);
    const text = lineText(line, options.language);
    if (text === undefined || !text.trim()) {
      const reason = `${options.language === 'en' ? '영어' : '한국어'} 대사가 없어 건너뜁니다.`;
      warnings.push(`${line.cut}: ${reason}`);
      rows.push({ line, recordName, status: 'skipped', reason });
      continue;
    }
    if (skipExisting) {
      rows.push({ line, recordName, status: 'skipped', reason: '이미 같은 이름의 파일이 있습니다.' });
      continue;
    }
    if (options.dryRun) {
      rows.push({ line, recordName, status: 'dry-run' });
      names.push(recordName);
      continue;
    }
    try {
      if (!ai) {
        rows.push({ line, recordName, status: 'failed', reason: 'Gemini 클라이언트가 없습니다.' });
        continue;
      }
      const stylePrompt = [options.stylePrompt.trim(), line.direction?.trim()].filter(Boolean).join(' ');
      const result = await generateDubbing(ai, {
        text, voiceName: options.voiceName, language: options.language, modelPreference: options.modelPreference,
        stylePrompt,
      });
      const bytes = Buffer.from(result.wavBase64, 'base64');
      const audioSeconds = wavDurationSeconds(bytes);
      await store.write(`${recordName}.wav`, bytes);
      names.push(recordName);
      const createdAt = Math.max(Date.now(), lastCreatedAt + 1);
      lastCreatedAt = createdAt;
      const uploadFailed = await uploadClip(recordings.repository, {
        id: `cli-${createdAt}`, presetName: `${line.cut} ${options.voiceName}`, voiceName: options.voiceName,
        text, stylePrompt, duration: audioSeconds, scriptLineId: line.id, language: options.language,
        mimeType: 'audio/wav', recordName, createdAt,
      }, bytes, warnings);
      rows.push({ line, recordName, status: 'generated', audioSeconds, uploadFailed });
    } catch (error) {
      rows.push({ line, recordName, status: 'failed', reason: error instanceof Error ? error.message : '알 수 없는 생성 오류' });
    }
  }
  return { rows, warnings, batches, recordingStatus: recordings.status,
    exitCode: rows.some((row) => row.status === 'failed' || row.status === 'unsplit' || row.uploadFailed) ? 2 : 0 };
}

export function formatDubTable(rows: readonly DubRow[]): string {
  const output = ['컷 | 저장 이름 | 음성 길이(초) | 컷 길이(초) | 판정'];
  for (const row of rows) {
    let seconds = '-';
    let verdict: string;
    switch (row.status) {
      case 'generated': {
        seconds = row.audioSeconds.toFixed(1);
        const fit = checkFit(row.line, row.audioSeconds);
        verdict = fit.fits ? '적합' : `+${fit.overSeconds.toFixed(1)}s 초과`;
        if (row.suspicious) verdict += ' · 들어 보고 확인';
        break;
      }
      case 'unsplit': seconds = row.audioSeconds.toFixed(1); verdict = `통째 저장(자르기 실패): ${row.reason}`; break;
      case 'dry-run': verdict = '생성 예정'; break;
      case 'skipped': verdict = `건너뜀: ${row.reason}`; break;
      case 'failed': verdict = `실패: ${row.reason}`; break;
      default: {
        const unreachable: never = row;
        throw new TypeError(`알 수 없는 처리 결과: ${unreachable}`);
      }
    }
    if (row.uploadFailed) verdict += ' · 깃허브 저장 실패';
    output.push([row.line.cut, `${row.recordName}.wav`, seconds, row.line.cutSeconds.toFixed(1), verdict]
      .map((cell) => cell.replace(/[\r\n|]+/g, ' ')).join(' | '));
  }
  return output.join('\n');
}
