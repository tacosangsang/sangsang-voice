import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GenerateContentResponse } from '@google/genai';
import type { GenerateContentParameters } from '@google/genai';
import type { ScriptLine } from '../../src/data/platingScript';
import type { ScriptSource } from '../../src/script/source';
import { wrapPcm16AsWav } from '../../src/shared/wav';
import type { GeminiClient } from '../dubbing';
import { parseDubArgs } from './dubArgs';
import { dubLines, formatDubTable, planLine, recordNamesFromPaths, selectLines, wavDurationSeconds } from './dubLines';
import type { FileStore } from './fileStore';

const first: ScriptLine = {
  id: 'S#01-C001', cut: 'S#01-C001', speaker: 'anchor', text: '첫 대사.', textEn: 'First.',
  tc: '', cutSeconds: 1, situation: '',
};
const second: ScriptLine = { ...first, id: 'S#01-C002', cut: 'S#01-C002', speaker: 'rabbit', text: '다음 대사.' };
const third: ScriptLine = { ...first, id: 'S#05-C001', cut: 'S#05-C001', text: '마지막 대사.' };
const lines = [first, second, third];
const speakers = [{ id: 'anchor', name: '앵커' }, { id: 'rabbit', name: '토끼' }];
const options = parseDubArgs(['--voice', 'Kore']);
const source: ScriptSource = {
  origin: 'bundled',
  async load() { return { origin: 'bundled', lines, speakers, loadedAt: 0, warnings: ['출처 경고'] }; },
};
const wav = wrapPcm16AsWav(new Uint8Array(8800), { sampleRate: 2000, channels: 1, bitsPerSample: 16 });

class MemoryFileStore implements FileStore {
  readonly files = new Map<string, Uint8Array>();
  async list() { return [...this.files.keys()]; }
  async write(path: string, bytes: Uint8Array) { this.files.set(path, new Uint8Array(bytes)); }
}

function fakeAi(mimeType = 'audio/wav', bytes: Uint8Array = wav) {
  const calls: GenerateContentParameters[] = [];
  const ai: GeminiClient = {
    models: {
      async generateContent(request) {
        calls.push(request);
        return Object.assign(new GenerateContentResponse(), {
          candidates: [{ content: { parts: [{ inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } }] } }],
        });
      },
    },
  };
  return { ai, calls };
}

test('필터가 없으면 모든 줄을 고른다', () => {
  assert.deepEqual(selectLines(lines, options), lines);
});

test('씬은 접두사로 고르고 반복 값은 OR다', () => {
  assert.deepEqual(selectLines(lines, { ...options, scenes: ['S#01'] }), [first, second]);
  assert.deepEqual(selectLines(lines, { ...options, scenes: ['S#0'] }), lines);
  assert.deepEqual(selectLines(lines, { ...options, scenes: ['S#01', 'S#05'] }), lines);
});

test('컷은 정확히 일치하고 반복 값은 OR다', () => {
  assert.deepEqual(selectLines(lines, { ...options, cuts: ['S#01-C00'] }), []);
  assert.deepEqual(selectLines(lines, { ...options, cuts: [first.cut, third.cut] }), [first, third]);
});

test('화자는 id로 고르고 다른 필터와 AND다', () => {
  assert.deepEqual(selectLines(lines, { ...options, speakers: ['anchor'] }), [first, third]);
  assert.deepEqual(selectLines(lines, {
    ...options, scenes: ['S#01'], cuts: [first.cut, second.cut], speakers: ['rabbit'],
  }), [second]);
  assert.deepEqual(selectLines(lines, { ...options, scenes: ['S#05'], speakers: ['rabbit'] }), []);
});

test('WAV 경로는 구분자와 확장자를 정리한 저장 이름으로 읽는다', () => {
  assert.deepEqual(recordNamesFromPaths([
    'S01/S01-C001-앵커-Kore-v1.wav', 'S01\\S01-C001-앵커-Kore-v3.WAV', '설명.txt',
  ]), ['S01/S01-C001-앵커-Kore-v1', 'S01/S01-C001-앵커-Kore-v3']);
});

test('v1·v3이 있으면 force는 v4이고 기본은 실제 v3을 건너뛴다', () => {
  const names = ['S01/S01-C001-앵커-Kore-v1', 'S01/S01-C001-앵커-Kore-v3'];
  assert.deepEqual(planLine(first, speakers, { ...options, force: true }, names), {
    recordName: 'S01/S01-C001-앵커-Kore-v4', skipExisting: false,
  });
  assert.deepEqual(planLine(first, speakers, options, names), {
    recordName: 'S01/S01-C001-앵커-Kore-v3', skipExisting: true,
  });
});

test('영어 이름은 -en이며 다른 언어·화자·목소리의 버전은 무시한다', () => {
  const plan = planLine(first, speakers, { ...options, language: 'en' }, [
    'S01/S01-C001-앵커-Kore-v3', 'S01/S01-C001-토끼-Kore-en-v8', 'S01/S01-C001-앵커-Fenrir-en-v9',
  ]);
  assert.deepEqual(plan, { recordName: 'S01/S01-C001-앵커-Kore-en-v1', skipExisting: false });
});

test('WAV 길이는 data 크기와 byteRate로 계산하고 부분 버퍼도 받는다', () => {
  assert.equal(wavDurationSeconds(wav), 2.2);
  const padded = new Uint8Array(wav.length + 9);
  padded.set(wav, 5);
  assert.equal(wavDurationSeconds(padded.subarray(5, 5 + wav.length)), 2.2);
});

test('WAV의 홀수 길이 추가 청크와 패딩을 건너뛴다', () => {
  const extended = Buffer.concat([Buffer.from(wav.subarray(0, 12)), Buffer.from('JUNK'),
    Buffer.from([1, 0, 0, 0, 7, 0]), Buffer.from(wav.subarray(12))]);
  extended.writeUInt32LE(extended.length - 8, 4);
  assert.equal(wavDurationSeconds(extended), 2.2);
});

test('잘못된 WAV·잘린 data·0 byteRate는 길이로 받아들이지 않는다', () => {
  const zeroRate = Buffer.from(wav);
  zeroRate.writeUInt32LE(0, 28);
  for (const invalid of [new Uint8Array(12), wav.subarray(0, 43), wav.subarray(0, wav.length - 1), zeroRate]) {
    assert.throws(() => wavDurationSeconds(invalid), /WAV/);
  }
});

test('한 줄씩 WAV를 저장하고 길이와 컷 초과량을 표로 출력한다', async () => {
  const store = new MemoryFileStore();
  const { ai, calls } = fakeAi();
  const report = await dubLines(source, store, ai, { ...options, cuts: [first.cut] });
  assert.equal(report.exitCode, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual([...store.files.keys()], ['S01/S01-C001-앵커-Kore-v1.wav']);
  assert.deepEqual(store.files.get('S01/S01-C001-앵커-Kore-v1.wav'), wav);
  assert.equal(formatDubTable(report.rows), [
    '컷 | 저장 이름 | 음성 길이(초) | 컷 길이(초) | 판정',
    'S#01-C001 | S01/S01-C001-앵커-Kore-v1.wav | 2.2 | 1.0 | +1.2s 초과',
  ].join('\n'));
  assert.deepEqual(report.warnings, ['출처 경고']);
});

test('PCM도 기존 generateDubbing을 통해 WAV로 변환하고 컷 안이면 적합이다', async () => {
  const store = new MemoryFileStore();
  const { ai } = fakeAi('audio/L16;rate=2000', new Uint8Array(2000));
  const report = await dubLines(source, store, ai, { ...options, cuts: [first.cut] });
  assert.match(formatDubTable(report.rows), /0\.5 \| 1\.0 \| 적합/);
  assert.equal(wavDurationSeconds([...store.files.values()][0]), 0.5);
});

test('이미 있는 파일은 생성 없이 건너뛰고 force는 다음 버전으로 저장한다', async () => {
  const store = new MemoryFileStore();
  store.files.set('S01/S01-C001-앵커-Kore-v3.wav', wav);
  const { ai, calls } = fakeAi();
  const selected = { ...options, cuts: [first.cut] };
  const skipped = await dubLines(source, store, ai, selected);
  assert.equal(calls.length, 0);
  assert.equal(skipped.rows[0].status, 'skipped');
  assert.match(formatDubTable(skipped.rows), /v3\.wav.*건너뜀/);
  const forced = await dubLines(source, store, ai, { ...selected, force: true });
  assert.equal(forced.exitCode, 0);
  assert.equal(calls.length, 1);
  assert.equal(store.files.size, 2);
  assert.ok(store.files.has('S01/S01-C001-앵커-Kore-v4.wav'));
});

test('영어 대사가 없으면 경고하고 다음 줄은 영어로 생성한다', async () => {
  const missing: ScriptSource = {
    origin: 'bundled', async load() {
      return { origin: 'bundled', lines: [{ ...first, textEn: undefined }, second], speakers, loadedAt: 0, warnings: [] };
    },
  };
  const store = new MemoryFileStore();
  const { ai, calls } = fakeAi();
  const report = await dubLines(missing, store, ai, { ...options, language: 'en' });
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.rows.map((row) => row.status), ['skipped', 'generated']);
  assert.match(report.warnings[0], /S#01-C001.*영어 대사/);
  assert.equal(calls.length, 1);
  assert.deepEqual([...store.files.keys()], ['S01/S01-C002-토끼-Kore-en-v1.wav']);
});

test('한 줄 생성 실패 후에도 다음 줄을 처리하고 종료 코드 2와 이유를 남긴다', async () => {
  let count = 0;
  const success = fakeAi();
  const ai: GeminiClient = { models: { async generateContent(request) {
    count += 1;
    return count === 1 ? new GenerateContentResponse() : success.ai.models.generateContent(request);
  } } };
  const store = new MemoryFileStore();
  const report = await dubLines(source, store, ai, options);
  assert.equal(report.exitCode, 2);
  assert.equal(count, 3);
  assert.deepEqual(report.rows.map((row) => row.status), ['failed', 'generated', 'generated']);
  assert.equal(store.files.size, 2);
  assert.match(formatDubTable(report.rows), /실패: 음성 생성 응답에 오디오 데이터/);
});

test('파일 쓰기 실패도 해당 줄만 실패로 남기고 계속한다', async () => {
  const store: FileStore = { async list() { return []; }, async write(path) {
    if (path.includes('C001-앵커') && path.startsWith('S01/')) throw new Error('저장 실패');
  } };
  const { ai, calls } = fakeAi();
  const report = await dubLines(source, store, ai, options);
  assert.equal(report.exitCode, 2);
  assert.equal(calls.length, 3);
  assert.match(formatDubTable(report.rows), /실패: 저장 실패/);
});

test('dry-run은 대상 이름만 만들고 Gemini 호출과 쓰기가 없다', async () => {
  const store = new MemoryFileStore();
  const { ai, calls } = fakeAi();
  const report = await dubLines(source, store, ai, { ...options, dryRun: true });
  assert.equal(report.exitCode, 0);
  assert.equal(calls.length, 0);
  assert.equal(store.files.size, 0);
  assert.equal(report.rows.length, 3);
  assert.match(formatDubTable(report.rows), /S01\/S01-C001-앵커-Kore-v1\.wav.*생성 예정/);
  assert.equal((await dubLines(source, store, undefined, { ...options, dryRun: true })).exitCode, 0);
});

test('태그 대사와 선택 모델을 기존 생성 함수에 전달한다', async () => {
  const directed: ScriptSource = { origin: 'bundled', async load() {
    return { origin: 'bundled', lines: [{ ...first, ttsText: '<sigh>첫 대사.', direction: 'Keep it flat.' }],
      speakers, loadedAt: 0, warnings: [] };
  } };
  const { ai, calls } = fakeAi();
  await dubLines(directed, new MemoryFileStore(), ai, {
    ...options, stylePrompt: 'Speak softly.', modelPreference: 'gemini-3.8-flash-lite-tts',
  });
  assert.equal(calls[0].model, 'gemini-3.8-flash-lite-tts');
  assert.match(JSON.stringify(calls[0].contents), /<sigh>/);
});
