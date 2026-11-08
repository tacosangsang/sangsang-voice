import { checkFit, lineText } from '../../src/data/platingScript';
import type { ScriptLine, Speaker } from '../../src/data/platingScript';
import { nextRecordName } from '../../src/data/recordName';
import type { ScriptSource } from '../../src/script/source';
import type { DubbingItem } from '../../src/types';
import { generateDubbing } from '../dubbing';
import type { GeminiClient } from '../dubbing';
import { CliArgumentError } from './dubArgs';
import type { DubOptions, LineSelection } from './dubArgs';
import type { FileStore } from './fileStore';

export type DubRow = {
  readonly line: ScriptLine;
  readonly recordName: string;
} & (
  | { readonly status: 'generated'; readonly audioSeconds: number }
  | { readonly status: 'dry-run' }
  | { readonly status: 'skipped' | 'failed'; readonly reason: string }
);

export type DubReport = {
  readonly rows: readonly DubRow[];
  readonly warnings: readonly string[];
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
): Promise<DubReport> {
  const snapshot = await source.load();
  const selectedLines = selectLines(snapshot.lines, options);
  const selectedSpeakerIds = [...new Set(selectedLines.map((line) => line.speaker))];
  if (selectedSpeakerIds.length > 1) {
    throw new CliArgumentError(`선택된 줄에 화자가 ${selectedSpeakerIds.length}명입니다(${selectedSpeakerIds.join(', ')}). --speaker로 한 화자만 고르세요.`);
  }
  const names = recordNamesFromPaths(await store.list());
  const warnings = [...snapshot.warnings];
  const rows: DubRow[] = [];
  for (const line of selectedLines) {
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
      const result = await generateDubbing(ai, {
        text, voiceName: options.voiceName, language: options.language, modelPreference: options.modelPreference,
        stylePrompt: [options.stylePrompt.trim(), line.direction?.trim()].filter(Boolean).join(' '),
      });
      const bytes = Buffer.from(result.wavBase64, 'base64');
      const audioSeconds = wavDurationSeconds(bytes);
      await store.write(`${recordName}.wav`, bytes);
      names.push(recordName);
      rows.push({ line, recordName, status: 'generated', audioSeconds });
    } catch (error) {
      rows.push({ line, recordName, status: 'failed', reason: error instanceof Error ? error.message : '알 수 없는 생성 오류' });
    }
  }
  return { rows, warnings, exitCode: rows.some((row) => row.status === 'failed') ? 2 : 0 };
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
        break;
      }
      case 'dry-run': verdict = '생성 예정'; break;
      case 'skipped': verdict = `건너뜀: ${row.reason}`; break;
      case 'failed': verdict = `실패: ${row.reason}`; break;
      default: {
        const unreachable: never = row;
        throw new TypeError(`알 수 없는 처리 결과: ${unreachable}`);
      }
    }
    output.push([row.line.cut, `${row.recordName}.wav`, seconds, row.line.cutSeconds.toFixed(1), verdict]
      .map((cell) => cell.replace(/[\r\n|]+/g, ' ')).join(' | '));
  }
  return output.join('\n');
}
