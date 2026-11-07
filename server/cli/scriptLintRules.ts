import { countSyllables, lineText, SYLLABLES_PER_SECOND, ttsTextMatches } from '../../src/data/platingScript';
import type { ScriptSnapshot } from '../../src/script/source';
import { selectLines } from './dubLines';
import type { ScriptLintOptions } from './scriptLintArgs';

export type ScriptLintIssue = {
  readonly code: 'missing-text' | 'invalid-cut-seconds' | 'unknown-speaker' | 'tts-mismatch' | 'duplicate-id';
  readonly message: string;
} | {
  readonly code: 'cut-overrun';
  readonly message: string;
  readonly overSeconds: number;
};

export type ScriptLintLine = {
  readonly id: string;
  readonly cut: string;
  readonly speakerId: string;
  readonly speaker: string;
  readonly syllables: number | null;
  readonly estimatedSeconds: number | null;
  readonly cutSeconds: number;
  readonly issues: readonly ScriptLintIssue[];
};

export type ScriptLintReport = {
  readonly lines: readonly ScriptLintLine[];
  readonly warnings: readonly string[];
  readonly summary: {
    readonly lineCount: number;
    readonly problemCount: number;
    readonly predictionNote: string | null;
  };
  readonly exitCode: 0 | 1;
};

/** 출처 전체에서 중복을 찾고, 선택한 줄의 문제를 점검한다. 입출력과 환경 변수에 의존하지 않는다. */
export function lintScript(snapshot: ScriptSnapshot, options: ScriptLintOptions): ScriptLintReport {
  const idCounts = new Map<string, number>();
  for (const line of snapshot.lines) idCounts.set(line.id, (idCounts.get(line.id) ?? 0) + 1);
  const speakerNames = new Map(snapshot.speakers.map((speaker) => [speaker.id, speaker.name]));
  const lines = selectLines(snapshot.lines, options).map((line): ScriptLintLine => {
    const text = lineText(line, options.language) ?? '';
    const hasText = Boolean(text.trim());
    const syllables = options.language === 'ko' && hasText ? countSyllables(text) : null;
    const estimatedSeconds = syllables === null ? null : syllables / SYLLABLES_PER_SECOND;
    const issues: ScriptLintIssue[] = [];
    if (estimatedSeconds !== null && estimatedSeconds > line.cutSeconds) {
      const overSeconds = estimatedSeconds - line.cutSeconds;
      issues.push({ code: 'cut-overrun', message: `컷 길이 +${overSeconds.toFixed(2)}초 초과 예상`, overSeconds });
    }
    if (!hasText) {
      issues.push({ code: 'missing-text', message: `${options.language === 'ko' ? '한국어' : '영어'} 대사 없음` });
    }
    if (line.cutSeconds <= 0) {
      issues.push({ code: 'invalid-cut-seconds', message: '컷 길이가 0 이하' });
    }
    if (line.speaker.startsWith('notion:')) {
      issues.push({ code: 'unknown-speaker', message: `모르는 화자: ${line.speaker}` });
    }
    if (line.ttsText !== undefined && !ttsTextMatches(line.text, line.ttsText)) {
      issues.push({ code: 'tts-mismatch', message: 'TTS 대사가 원문과 다름' });
    }
    if ((idCounts.get(line.id) ?? 0) > 1) {
      issues.push({ code: 'duplicate-id', message: `id 중복: ${line.id}` });
    }
    return {
      id: line.id, cut: line.cut, speakerId: line.speaker,
      speaker: speakerNames.get(line.speaker) ?? line.speaker,
      syllables, estimatedSeconds, cutSeconds: line.cutSeconds, issues,
    };
  });
  const warnings = [...snapshot.warnings];
  const problemCount = warnings.length + lines.reduce((count, line) => count + line.issues.length, 0);
  return {
    lines, warnings,
    summary: {
      lineCount: lines.length, problemCount,
      predictionNote: options.language === 'en' ? '영어는 길이 예측 없음' : null,
    },
    exitCode: options.strict && problemCount > 0 ? 1 : 0,
  };
}

export function formatScriptLint(
  report: ScriptLintReport, options: Pick<ScriptLintOptions, 'json' | 'all'>,
  redact: (message: string) => string = (message) => message,
): string {
  const lines = report.lines.filter((line) => options.all || line.issues.length > 0);
  if (options.json) {
    // 문자열 값에서 먼저 설정 값을 숨겨 따옴표·줄바꿈이 있어도 JSON 형식을 보존한다.
    return JSON.stringify({ lines, warnings: report.warnings, summary: report.summary },
      (_key, value: unknown) => typeof value === 'string' ? redact(value) : value, 2);
  }
  const output = report.warnings.map((warning) => `경고: ${warning}`);
  if (report.summary.predictionNote) output.push(report.summary.predictionNote);
  output.push('컷 | 화자 | 음절 | 예상 초 | 컷 초 | 문제');
  for (const line of lines) {
    output.push([
      line.cut, line.speaker, line.syllables === null ? '-' : String(line.syllables),
      line.estimatedSeconds === null ? '-' : line.estimatedSeconds.toFixed(2), line.cutSeconds.toFixed(2),
      line.issues.map((issue) => issue.message).join('; ') || '없음',
    ].map((cell) => cell.replace(/[\r\n|]+/g, ' ')).join(' | '));
  }
  output.push(`요약: ${report.summary.lineCount}줄, 문제 ${report.summary.problemCount}건`);
  return redact(output.join('\n'));
}
