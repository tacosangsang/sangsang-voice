import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GenerateContentResponse } from '@google/genai';
import type { GenerateContentParameters } from '@google/genai';
import type { ScriptLine } from '../../src/data/platingScript';
import type { ScriptSource } from '../../src/script/source';
import { decodePcm16Wav, encodeFloatChannelsToWav } from '../../src/shared/wav';
import type { GeminiClient } from '../dubbing';
import { parseDubArgs } from './dubArgs';
import { formatBatchPlan, planDubGroups } from './dubBatch';
import { dubLines, formatDubTable } from './dubLines';
import type { FileStore } from './fileStore';

const options = parseDubArgs(['--voice', 'Kore', '--batch']);
const speakers = [{ id: 'anchor', name: '앵커' }];
const sampleRate = 16000;

function script(count: number): ScriptLine[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `S#01-C00${index + 1}`, cut: `S#01-C00${index + 1}`, speaker: 'anchor',
    text: `대사${index + 1}.`, tc: '', cutSeconds: 2, situation: '', mood: '차분',
  }));
}

function source(lines: ScriptLine[]): ScriptSource {
  return { origin: 'bundled', async load() {
    return { origin: 'bundled', lines, speakers, loadedAt: 0, warnings: [] };
  } };
}

class MemoryFileStore implements FileStore {
  readonly files = new Map<string, Uint8Array>();
  async list() { return [...this.files.keys()]; }
  async write(path: string, bytes: Uint8Array) { this.files.set(path, new Uint8Array(bytes)); }
}

function tones(durations: number[], gap = 0.5): Uint8Array {
  const frames = Math.round((0.4 + durations.reduce((sum, value) => sum + value, 0) + gap * (durations.length - 1)) * sampleRate);
  const samples = new Float32Array(frames);
  let start = Math.round(0.2 * sampleRate);
  durations.forEach((duration, index) => {
    for (let i = 0; i < Math.round(duration * sampleRate); i++) {
      samples[start + i] = (0.2 + index * 0.1) * Math.sin(2 * Math.PI * 400 * i / sampleRate);
    }
    start += Math.round((duration + gap) * sampleRate);
  });
  return encodeFloatChannelsToWav([samples], sampleRate);
}

function fakeAi(bytes: Uint8Array) {
  const calls: GenerateContentParameters[] = [];
  const ai: GeminiClient = { models: { async generateContent(request) {
    calls.push(request);
    return Object.assign(new GenerateContentResponse(), {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: Buffer.from(bytes).toString('base64') } }] } }],
    });
  } } };
  return { ai, calls };
}

for (const count of [2, 3]) {
  test(`${count}줄 묶음은 한 번 호출하고 쉼 가운데서 나눠 앞뒤 무음까지 순서대로 저장한다`, async () => {
    const lines = script(count);
    const store = new MemoryFileStore();
    const { ai, calls } = fakeAi(tones(Array.from({ length: count }, () => 0.4)));
    const report = await dubLines(source(lines), store, ai, options);
    assert.equal(report.exitCode, 0);
    assert.equal(calls.length, 1);
    assert.equal(store.files.size, count);
    const requestedText = JSON.stringify(lines.map((line) => line.text).join('\n\n')).slice(1, -1);
    assert.ok(JSON.stringify(calls[0].contents).includes(requestedText));
    report.rows.forEach((row, index) => {
      assert.equal(row.recordName, `S01/S01-C00${index + 1}-앵커-Kore-v1`);
      assert.equal(row.status, 'generated');
      if (row.status !== 'generated') assert.fail('줄별 생성 결과가 필요합니다.');
      const expectedSamples = (index === 0 || index === count - 1) ? 13600 : 14400;
      assert.equal(row.audioSeconds, expectedSamples / sampleRate);
      const bytes = store.files.get(`${row.recordName}.wav`);
      assert.ok(bytes);
      const decoded = decodePcm16Wav(bytes);
      assert.equal(decoded.sampleRate, sampleRate);
      assert.equal(decoded.channels[0].length, expectedSamples);
      const peak = decoded.channels[0].reduce((max, value) => Math.max(max, Math.abs(value)), 0);
      assert.ok(Math.abs(peak - (0.2 + index * 0.1)) < 0.001);
    });
  });
}

test('한 줄 묶음은 기존 한 줄 요청과 WAV를 그대로 쓴다', async () => {
  const bytes = tones([0.4]);
  const batch = fakeAi(bytes);
  const single = fakeAi(bytes);
  const batchStore = new MemoryFileStore();
  const lines = script(1).map((line) => ({ ...line, direction: 'Keep it flat.' }));
  const report = await dubLines(source(lines), batchStore, batch.ai, options);
  await dubLines(source(lines), new MemoryFileStore(), single.ai, { ...options, batch: false });
  assert.deepEqual(batch.calls, single.calls);
  assert.deepEqual([...batchStore.files.values()], [bytes]);
  assert.equal(report.exitCode, 0);
});

test('씬·감정이 바뀌거나 감정이 비면 묶음을 나눈다', () => {
  const lines = script(5);
  lines[2] = { ...lines[2], mood: '긴장' };
  lines[3] = { ...lines[3], mood: undefined };
  lines[4] = { ...lines[4], id: 'S#02-C001', cut: 'S#02-C001' };
  assert.deepEqual(planDubGroups(lines, options).map((group) => group.lines.length), [2, 1, 1, 1]);
});

test('감정이 없는 두 줄은 각각 한 번 호출한다', async () => {
  const { ai, calls } = fakeAi(tones([0.4]));
  const report = await dubLines(source(script(2).map((line) => ({ ...line, mood: undefined }))), new MemoryFileStore(), ai, options);
  assert.equal(calls.length, 2);
  assert.equal(report.exitCode, 0);
});

test('모든 줄이 이미 있으면 묶음 전체를 호출 없이 건너뛴다', async () => {
  const store = new MemoryFileStore();
  for (const index of [1, 2]) store.files.set(`S01/S01-C00${index}-앵커-Kore-v3.wav`, tones([0.4]));
  const { ai, calls } = fakeAi(tones([0.4, 0.4]));
  const report = await dubLines(source(script(2)), store, ai, { ...options, dryRun: true });
  assert.equal(calls.length, 0);
  assert.deepEqual(report.rows.map((row) => row.status), ['skipped', 'skipped']);
  assert.equal(report.batches[0].calls, 0);
  assert.equal(store.files.size, 2);
});

for (const force of [false, true]) {
  test(`일부 줄만 있으면 전체를 다시 생성하고 기존 파일은 보존한다: force=${force}`, async () => {
    const store = new MemoryFileStore();
    const old = tones([0.2]);
    store.files.set('S01/S01-C001-앵커-Kore-v3.wav', old);
    const { ai, calls } = fakeAi(tones([0.4, 0.4]));
    const report = await dubLines(source(script(2)), store, ai, { ...options, force });
    assert.equal(calls.length, 1);
    assert.equal(report.exitCode, 0);
    assert.deepEqual(report.rows.map((row) => row.recordName), ['S01/S01-C001-앵커-Kore-v4', 'S01/S01-C002-앵커-Kore-v1']);
    assert.equal(report.warnings.length, force ? 0 : 1);
    if (!force) assert.match(report.warnings[0], /이미 있는 줄도 다시 생성/);
    assert.deepEqual(store.files.get('S01/S01-C001-앵커-Kore-v3.wav'), old);
  });
}

for (const priorBatch of [false, true]) {
  test(`자르기 실패는 첫 줄의 batch 이름으로 통째 저장하고 코드 2를 반환한다: 이전 묶음=${priorBatch}`, async () => {
    const store = new MemoryFileStore();
    const bytes = tones([1]);
    if (priorBatch) {
      store.files.set('S01/S01-C001-앵커-Kore-batch-v3.wav', bytes);
      store.files.set('S01/S01-C001-앵커-Kore-v7.wav', bytes);
    }
    const { ai, calls } = fakeAi(bytes);
    const report = await dubLines(source(script(2)), store, ai, options);
    const name = `S01/S01-C001-앵커-Kore-batch-v${priorBatch ? 4 : 1}.wav`;
    assert.equal(report.exitCode, 2);
    assert.equal(calls.length, 1);
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0].status, 'unsplit');
    assert.equal(store.files.size, priorBatch ? 3 : 1);
    assert.deepEqual(store.files.get(name), bytes);
    assert.match(formatDubTable(report.rows), /통째 저장.*줄 사이 쉼/);
  });
}

test('dry-run은 묶음 id·줄 수·호출 예정 횟수를 출력하며 호출과 쓰기는 없다', async () => {
  const lines = script(3);
  lines[2] = { ...lines[2], mood: '긴장' };
  const store = new MemoryFileStore();
  const { ai, calls } = fakeAi(tones([0.4, 0.4]));
  const report = await dubLines(source(lines), store, ai, { ...options, dryRun: true });
  assert.equal(calls.length, 0);
  assert.equal(store.files.size, 0);
  assert.equal(report.exitCode, 0);
  assert.match(formatBatchPlan(report.batches), /묶음 2개.*호출 예정 2회/);
  assert.match(formatBatchPlan(report.batches), /S#01-C001~S#01-C002 \| 2 \| 1/);
  assert.match(formatBatchPlan(report.batches), /S#01-C003~S#01-C003 \| 1 \| 1/);
  assert.deepEqual(report.rows.map((row) => row.status), ['dry-run', 'dry-run', 'dry-run']);
});

test('줄 길이 비율이 안 맞으면 batch-v1으로 원본을 통째 저장하고 코드 2를 반환한다', async () => {
  const bytes = tones([0.1, 1.4]);
  const { ai, calls } = fakeAi(bytes);
  const store = new MemoryFileStore();
  const report = await dubLines(source(script(2)), store, ai, options);
  assert.equal(report.exitCode, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual([...store.files.keys()], ['S01/S01-C001-앵커-Kore-batch-v1.wav']);
  assert.deepEqual(store.files.get('S01/S01-C001-앵커-Kore-batch-v1.wav'), bytes);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].status, 'unsplit');
  assert.match(formatDubTable(report.rows), /통째 저장.*줄 길이 비율이 맞는 자르기 위치를 찾지 못했습니다\./);
});

test('일부 영어 대사가 없으면 한 줄 경로로 나눠 있는 대사만 생성한다', async () => {
  const lines = script(2);
  lines[1] = { ...lines[1], textEn: 'Second.' };
  const { ai, calls } = fakeAi(tones([0.4]));
  const report = await dubLines(source(lines), new MemoryFileStore(), ai, { ...options, language: 'en' });
  assert.equal(calls.length, 1);
  assert.deepEqual(report.rows.map((row) => row.status), ['skipped', 'generated']);
  assert.match(report.rows[1].recordName, /-Kore-en-v1$/);
});

test('묶음의 파일 쓰기 실패는 해당 줄에 남기고 다음 줄을 계속 저장한다', async () => {
  const written: string[] = [];
  const store: FileStore = { async list() { return []; }, async write(path) {
    if (path.includes('C001')) throw new Error('저장 실패');
    written.push(path);
  } };
  const { ai } = fakeAi(tones([0.4, 0.4]));
  const report = await dubLines(source(script(2)), store, ai, options);
  assert.equal(report.exitCode, 2);
  assert.deepEqual(report.rows.map((row) => row.status), ['failed', 'generated']);
  assert.deepEqual(written, ['S01/S01-C002-앵커-Kore-v1.wav']);
});

test('한국어 묶음 가중치는 태그와 공백 대신 음절 수를 쓴다', async () => {
  const lines = script(2);
  lines[0] = { ...lines[0], text: '가가', ttsText: '<sigh> 가가' };
  lines[1] = { ...lines[1], text: '나'.repeat(8) };
  const { ai } = fakeAi(tones([0.4, 1.6]));
  const report = await dubLines(source(lines), new MemoryFileStore(), ai, options);
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.rows.map((row) => row.status), ['generated', 'generated']);
  assert.doesNotMatch(formatDubTable(report.rows), /들어 보고 확인/);
});

test('한글 음절이 없는 영어 묶음 가중치는 글자 수를 쓴다', async () => {
  const lines = script(2);
  lines[0] = { ...lines[0], textEn: 'A' };
  lines[1] = { ...lines[1], textEn: 'BBBB' };
  const { ai } = fakeAi(tones([0.4, 1.6]));
  const report = await dubLines(source(lines), new MemoryFileStore(), ai, { ...options, language: 'en' });
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.rows.map((row) => row.status), ['generated', 'generated']);
});

test('두 채널 WAV도 첫 채널에서만 자르고 줄별 WAV는 모노로 저장한다', async () => {
  const samples = decodePcm16Wav(tones([0.4, 0.4])).channels[0];
  const { ai } = fakeAi(encodeFloatChannelsToWav([samples, new Float32Array(samples.length).fill(0.5)], sampleRate));
  const store = new MemoryFileStore();
  const report = await dubLines(source(script(2)), store, ai, options);
  assert.equal(report.exitCode, 0);
  assert.equal(store.files.size, 2);
  for (const bytes of store.files.values()) assert.equal(decodePcm16Wav(bytes).channels.length, 1);
});

test('묶음 생성 실패는 모든 해당 줄에 남기고 다음 묶음은 계속 생성한다', async () => {
  const lines = script(3);
  lines[2] = { ...lines[2], mood: '긴장' };
  let calls = 0;
  const success = fakeAi(tones([0.4]));
  const ai: GeminiClient = { models: { async generateContent(request) {
    calls++;
    return calls === 1 ? new GenerateContentResponse() : success.ai.models.generateContent(request);
  } } };
  const report = await dubLines(source(lines), new MemoryFileStore(), ai, options);
  assert.equal(calls, 2);
  assert.equal(report.exitCode, 2);
  assert.deepEqual(report.rows.map((row) => row.status), ['failed', 'failed', 'generated']);
});
