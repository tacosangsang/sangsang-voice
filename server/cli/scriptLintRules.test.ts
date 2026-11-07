import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLATING_SCRIPT } from '../../src/data/platingScript';
import type { ScriptLine } from '../../src/data/platingScript';
import type { ScriptSource } from '../../src/script/source';
import { parseScriptLintArgs } from './scriptLintArgs';
import { formatScriptLint, lintScript } from './scriptLintRules';

const first: ScriptLine = {
  id: 'S#01-C001', cut: 'S#01-C001', speaker: 'anchor', text: '하나둘셋넷다', textEn: 'First.',
  tc: '', cutSeconds: 1, situation: '',
};
const second: ScriptLine = { ...first, id: 'S#05-C003', cut: 'S#05-C003', speaker: 'rabbit' };
const options = parseScriptLintArgs([]);

function fakeSource(lines: ScriptLine[], warnings: string[] = []): ScriptSource {
  return {
    origin: 'bundled', async load() {
      return {
        origin: 'bundled', lines, warnings, loadedAt: 0,
        speakers: [{ id: 'anchor', name: '앵커' }, { id: 'rabbit', name: '토끼' }],
      };
    },
  };
}

test('출처 경고를 그대로 보존하고 문제 수에 포함한다', async () => {
  const source = fakeSource([first], ['표에 빠진 칸이 있습니다.']);
  const report = lintScript(await source.load(), options);
  assert.deepEqual(report.warnings, ['표에 빠진 칸이 있습니다.']);
  assert.deepEqual(report.summary, { lineCount: 1, problemCount: 1, predictionNote: null });
  assert.equal(report.exitCode, 0);
  assert.match(formatScriptLint(report, options), /경고: 표에 빠진 칸이 있습니다\./);
});

test('한글 음절 수와 초과 초를 계산하고 태그 대사를 사용한다', async () => {
  const source = fakeSource([{ ...first, text: '하나둘셋넷다하나둘셋넷다', ttsText: '<sigh>하나둘셋넷다하나둘셋넷다' }]);
  const report = lintScript(await source.load(), options);
  assert.equal(report.lines[0].syllables, 12);
  assert.equal(report.lines[0].estimatedSeconds, 2);
  assert.deepEqual(report.lines[0].issues, [{
    code: 'cut-overrun', message: '컷 길이 +1.00초 초과 예상', overSeconds: 1,
  }]);
  assert.match(formatScriptLint(report, options), /S#01-C001 \| 앵커 \| 12 \| 2\.00 \| 1\.00 \| .*\+1\.00초/);
});

test('컷 길이와 예상 길이가 같으면 문제로 세지 않는다', async () => {
  const source = fakeSource([first]);
  const report = lintScript(await source.load(), options);
  assert.equal(report.lines[0].estimatedSeconds, 1);
  assert.deepEqual(report.lines[0].issues, []);
  assert.equal(report.summary.problemCount, 0);
});

for (const language of ['ko', 'en'] as const) {
  test(`${language} 대사가 없거나 공백뿐이면 빠진 대사로 표시한다`, async () => {
    const source = fakeSource([
      { ...first, text: '', textEn: undefined },
      { ...second, text: ' \n ', textEn: ' \t ' },
    ]);
    const report = lintScript(await source.load(), { ...options, language });
    assert.deepEqual(report.lines.map((line) => line.issues.map((issue) => issue.code)), [
      ['missing-text'], ['missing-text'],
    ]);
    assert.ok(report.lines.every((line) => line.estimatedSeconds === null));
  });
}

test('영어는 한글이 섞여 있어도 길이 예측을 생략하며 strict에 걸리지 않는다', async () => {
  const source = fakeSource([{ ...first, textEn: 'English 한글'.repeat(20) }]);
  const selected = { ...options, language: 'en', strict: true, all: true } as const;
  const report = lintScript(await source.load(), selected);
  assert.equal(report.lines[0].syllables, null);
  assert.equal(report.lines[0].estimatedSeconds, null);
  assert.deepEqual(report.lines[0].issues, []);
  assert.equal(report.summary.predictionNote, '영어는 길이 예측 없음');
  assert.equal(report.exitCode, 0);
  assert.match(formatScriptLint(report, selected), /영어는 길이 예측 없음/);
});

test('0 이하인 컷 길이를 표시한다', async () => {
  const source = fakeSource([{ ...first, cutSeconds: 0 }, { ...second, cutSeconds: -1 }]);
  const report = lintScript(await source.load(), options);
  assert.ok(report.lines.every((line) => line.issues.some((issue) => issue.code === 'invalid-cut-seconds')));
});

test('notion 접두 화자는 이름과 함께 표시한다', async () => {
  const source = fakeSource([{ ...first, speaker: 'notion:새 화자' }]);
  const report = lintScript(await source.load(), options);
  assert.equal(report.lines[0].speaker, 'notion:새 화자');
  assert.equal(report.lines[0].issues[0].code, 'unknown-speaker');
});

test('태그를 빼도 원문과 다른 TTS 대사는 영어 점검에서도 표시한다', async () => {
  const source = fakeSource([{ ...first, ttsText: '<sigh>다른 말' }]);
  const report = lintScript(await source.load(), { ...options, language: 'en' });
  assert.deepEqual(report.lines[0].issues.map((issue) => issue.code), ['tts-mismatch']);
});

test('중복 id는 첫 줄과 뒤의 줄을 모두 표시한다', async () => {
  const source = fakeSource([first, { ...second, id: first.id }]);
  const report = lintScript(await source.load(), options);
  assert.deepEqual(report.lines.map((line) => line.issues.map((issue) => issue.code)), [
    ['duplicate-id'], ['duplicate-id'],
  ]);
  assert.equal(report.summary.problemCount, 2);
});

test('씬·컷·화자 선택은 selectLines 규칙을 따르고 선택 밖 중복도 찾는다', async () => {
  const source = fakeSource([first, { ...second, id: first.id }]);
  const selected = parseScriptLintArgs(['--scene', 'S#05', '--cut', second.cut, '--speaker', 'rabbit']);
  const report = lintScript(await source.load(), selected);
  assert.equal(report.summary.lineCount, 1);
  assert.equal(report.lines[0].cut, second.cut);
  assert.deepEqual(report.lines[0].issues.map((issue) => issue.code), ['duplicate-id']);
});

for (const all of [false, true]) {
  test(`사람용 표는 all=${all}일 때 정상 줄 표시를 결정한다`, async () => {
    const source = fakeSource([first, { ...second, cutSeconds: 0 }]);
    const report = lintScript(await source.load(), options);
    const output = formatScriptLint(report, { ...options, all });
    assert.equal(output.includes(first.cut), all);
    assert.ok(output.includes(second.cut));
    assert.match(output, /요약: 2줄, 문제 2건/);
    assert.ok(output.startsWith('컷 | 화자 | 음절 | 예상 초 | 컷 초 | 문제\n'));
  });

  test(`JSON은 all=${all}일 때 같은 표시 규칙과 전체 요약을 쓴다`, async () => {
    const source = fakeSource([first, { ...second, textEn: undefined }], ['출처 경고']);
    const selected = { ...options, language: 'en', json: true, all } as const;
    const report = lintScript(await source.load(), selected);
    const output = JSON.parse(formatScriptLint(report, selected));
    assert.deepEqual(Object.keys(output), ['lines', 'warnings', 'summary']);
    assert.deepEqual(output.lines.map((line: { cut: string }) => line.cut), all ? [first.cut, second.cut] : [second.cut]);
    assert.deepEqual(output.warnings, ['출처 경고']);
    assert.deepEqual(output.summary, {
      lineCount: 2, problemCount: 2, predictionNote: '영어는 길이 예측 없음',
    });
    assert.equal(output.lines[0].estimatedSeconds, null);
  });
}

for (const [label, lines, warnings, expected] of [
  ['정상', [first], [], 0],
  ['줄 문제', [{ ...first, text: '' }], [], 1],
  ['출처 경고만 있음', [first], ['표 경고'], 1],
] as const) {
  test(`strict 종료 코드: ${label}`, async () => {
    const source = fakeSource([...lines], [...warnings]);
    const report = lintScript(await source.load(), { ...options, strict: true });
    assert.equal(report.exitCode, expected);
  });
}

test('필터 결과가 없어도 오류 없이 0줄로 끝난다', async () => {
  const source = fakeSource([first]);
  const report = lintScript(await source.load(), { ...options, scenes: ['S#99'] });
  assert.equal(report.summary.lineCount, 0);
  assert.equal(report.exitCode, 0);
});

test('사본 대본 전체는 오류 없이 끝나고 29줄을 점검한다', async () => {
  const source = fakeSource(PLATING_SCRIPT);
  const report = lintScript(await source.load(), options);
  assert.equal(report.exitCode, 0);
  assert.equal(report.summary.lineCount, 29);
});

test('JSON은 설정 값에 따옴표·줄바꿈이 있어도 값부터 숨겨 형식을 보존한다', async () => {
  const secret = '설정"값\n역슬래시\\';
  const source = fakeSource([first], [`표 경고: ${secret}`]);
  const report = lintScript(await source.load(), options);
  const output = formatScriptLint(report, { ...options, json: true },
    (message) => message.replaceAll(secret, '[설정값 숨김]'));
  assert.deepEqual(JSON.parse(output).warnings, ['표 경고: [설정값 숨김]']);
});

test('사람용 표는 컷의 줄바꿈과 구분자가 열을 깨지 않게 한다', async () => {
  const source = fakeSource([{ ...first, cut: 'S#01|C001\n추가' }]);
  const report = lintScript(await source.load(), options);
  const output = formatScriptLint(report, { ...options, all: true }).split('\n');
  assert.equal(output.length, 3);
  assert.equal(output[1].split(' | ').length, 6);
});
