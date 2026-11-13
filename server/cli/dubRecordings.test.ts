import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { GenerateContentResponse } from '@google/genai';
import type { ScriptLine } from '../../src/data/platingScript';
import type { ScriptSource } from '../../src/script/source';
import { batchRequest, groupConsecutiveLines } from '../../src/script/lineGroups';
import type { RecordingMeta, RecordingStoreName } from '../../src/shared/recording';
import { encodeFloatChannelsToWav } from '../../src/shared/wav';
import type { GeminiClient } from '../dubbing';
import type { RecordingRepository } from '../githubRecordingRepository';
import { recordingsConfig } from '../recordingsConfig';
import { parseDubArgs } from './dubArgs';
import { dubLines, formatDubTable, wavDurationSeconds } from './dubLines';
import type { FileStore } from './fileStore';
import { DirFileStore } from './fileStore';

const options = parseDubArgs(['--voice', 'Kore']);
const lines: ScriptLine[] = [1, 2].map((index) => ({
  id: `S#01-C00${index}`, cut: `S#01-C00${index}`, speaker: 'anchor',
  text: `대사${index}.`, tc: '', cutSeconds: 2, situation: '', mood: '차분',
  direction: `줄 ${index} 지시.`,
}));
const source: ScriptSource = { origin: 'bundled', async load() {
  return { origin: 'bundled', lines, speakers: [{ id: 'anchor', name: '앵커' }], loadedAt: 0, warnings: [] };
} };
const firstName = 'S01/S01-C001-앵커-Kore-v1';

class MemoryFileStore implements FileStore {
  readonly files = new Map<string, Uint8Array>();
  async list() { return [...this.files.keys()]; }
  async write(path: string, bytes: Uint8Array) { this.files.set(path, new Uint8Array(bytes)); }
}

class MemoryRecordingRepository implements RecordingRepository {
  readonly target = 'example/voice@recordings';
  readonly records = new Map<string, RecordingMeta>();
  readonly audio = new Map<string, Buffer>();
  readonly events: string[] = [];
  verifyError?: Error;
  listError?: Error;
  saveError?: Error;
  beforeSave?: (meta: RecordingMeta, audio: Buffer) => void;

  async verify() {
    this.events.push('verify');
    if (this.verifyError) throw this.verifyError;
  }
  async list(store: RecordingStoreName) {
    this.events.push(`list:${store}`);
    if (this.listError) throw this.listError;
    return [...this.records.values()];
  }
  async save(store: RecordingStoreName, meta: RecordingMeta, audio: Buffer) {
    this.events.push(`save:${store}`);
    this.beforeSave?.(meta, audio);
    if (this.saveError) throw this.saveError;
    if (this.records.has(meta.id)) return;
    this.records.set(meta.id, meta);
    this.audio.set(meta.id, Buffer.from(audio));
  }
  async readAudio(_store: RecordingStoreName, id: string) {
    const audio = this.audio.get(id);
    assert.ok(audio, '저장된 음성이 필요합니다.');
    return Buffer.from(audio);
  }
}

function existing(name: string, inFields = false): RecordingMeta {
  return { id: name, createdAt: 1, mimeType: 'audio/wav',
    ...(inFields ? {} : { name }), fields: { recordName: name } };
}

function tones(count: number): Uint8Array {
  const sampleRate = 16000;
  const samples = new Float32Array(Math.round((0.4 + count * 0.4 + (count - 1) * 0.5) * sampleRate));
  for (let part = 0; part < count; part++) {
    const start = Math.round((0.2 + part * 0.9) * sampleRate);
    for (let i = 0; i < 0.4 * sampleRate; i++) {
      samples[start + i] = 0.2 * Math.sin(2 * Math.PI * 400 * i / sampleRate);
    }
  }
  return encodeFloatChannelsToWav([samples], sampleRate);
}

function fakeAi(bytes = tones(1)) {
  let calls = 0;
  const ai: GeminiClient = { models: { async generateContent() {
    calls++;
    return Object.assign(new GenerateContentResponse(), {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: Buffer.from(bytes).toString('base64') } }] } }],
    });
  } } };
  return { ai, get calls() { return calls; } };
}

test('가짜 저장소는 같은 id를 한 번만 보관하고 목록과 음성을 돌려준다', async () => {
  const repository = new MemoryRecordingRepository();
  const meta = existing(firstName);
  const bytes = Buffer.from(tones(1));
  await repository.save('clips', meta, bytes);
  await repository.save('clips', { ...meta, name: '다른 이름' }, Buffer.alloc(1));
  assert.deepEqual(await repository.list('clips'), [meta]);
  assert.deepEqual(await repository.readAudio('clips', meta.id), bytes);
});

test('깃허브 저장은 한 번 확인하고 로컬 저장 뒤 앱 형식의 meta와 WAV를 올린다', async () => {
  const repository = new MemoryRecordingRepository();
  const store = new MemoryFileStore();
  const bytes = tones(1);
  repository.beforeSave = (meta, audio) => {
    assert.deepEqual(store.files.get(`${meta.name}.wav`), bytes);
    assert.deepEqual(audio, Buffer.from(bytes));
  };
  const report = await dubLines(source, store, fakeAi(bytes).ai, {
    ...options, cuts: [lines[0].cut], stylePrompt: '차분하게.',
  }, repository);
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.recordingStatus, { enabled: true, target: repository.target });
  assert.deepEqual(repository.events, ['verify', 'list:clips', 'save:clips']);
  const meta = [...repository.records.values()][0];
  assert.ok(meta.createdAt > 0);
  assert.deepEqual(meta, {
    id: `cli-${meta.createdAt}`, createdAt: meta.createdAt, mimeType: 'audio/wav', name: firstName,
    fields: {
      id: `cli-${meta.createdAt}`, presetName: 'S#01-C001 Kore', voiceName: 'Kore',
      text: lines[0].text, stylePrompt: '차분하게. 줄 1 지시.', duration: wavDurationSeconds(bytes),
      scriptLineId: lines[0].id, language: 'ko', mimeType: 'audio/wav', recordName: firstName,
      createdAt: meta.createdAt,
    },
  });
  assert.equal('audioUrl' in meta.fields, false);
});

test('태그가 든 대사는 TTS 요청에 사용한 그대로 저장한다', async () => {
  const tagged: ScriptSource = { ...source, async load() {
    return { ...await source.load(), lines: [{ ...lines[0], ttsText: '<sigh>대사1.' }] };
  } };
  const repository = new MemoryRecordingRepository();
  await dubLines(tagged, new MemoryFileStore(), fakeAi().ai, options, repository);
  assert.equal([...repository.records.values()][0].fields.text, '<sigh>대사1.');
});

test('같은 밀리초에 여러 줄을 생성해도 id가 겹쳐 음성이 빠지지 않는다', async (t) => {
  t.mock.method(Date, 'now', () => 1700000000000);
  const repository = new MemoryRecordingRepository();
  const report = await dubLines(source, new MemoryFileStore(), fakeAi().ai, options, repository);
  assert.equal(report.rows.length, 2);
  assert.equal(repository.records.size, 2);
  assert.equal(repository.events.filter((event) => event === 'verify').length, 1);
});

test('토큰이 없으면 설정의 problem을 보여 주고 로컬에만 저장한다', async () => {
  const config = recordingsConfig({});
  const store = new MemoryFileStore();
  const report = await dubLines(source, store, fakeAi().ai, options, config.repo, config.problem);
  assert.deepEqual(report.recordingStatus, { enabled: false, reason: config.problem });
  assert.equal(store.files.size, 2);
  assert.equal(report.exitCode, 0);
});

test('--no-upload는 저장소가 주입되어도 확인·목록·업로드를 모두 생략한다', async () => {
  const repository = new MemoryRecordingRepository();
  const store = new MemoryFileStore();
  const noUpload = parseDubArgs(['--voice', 'Kore', '--no-upload']);
  const report = await dubLines(source, store, fakeAi().ai, noUpload, repository);
  assert.deepEqual(repository.events, []);
  assert.equal(report.recordingStatus.enabled, false);
  assert.match(report.recordingStatus.reason ?? '', /--no-upload/);
  assert.equal(store.files.size, 2);
  assert.equal(report.exitCode, 0);
});

for (const stage of ['verify', 'list'] as const) {
  test(`${stage} 실패는 경고하고 깃허브 저장만 끈 채 로컬 생성을 계속한다`, async () => {
    const repository = new MemoryRecordingRepository();
    if (stage === 'verify') repository.verifyError = new Error('접근 거부');
    else repository.listError = new Error('접근 거부');
    const store = new MemoryFileStore();
    const report = await dubLines(source, store, fakeAi().ai, options, repository);
    assert.equal(report.exitCode, 0);
    assert.equal(report.recordingStatus.enabled, false);
    assert.match(report.recordingStatus.reason ?? '', /접근 거부/);
    assert.match(report.warnings.join('\n'), /깃허브.*접근 거부/);
    assert.deepEqual(repository.events, stage === 'verify' ? ['verify'] : ['verify', 'list:clips']);
    assert.equal(store.files.size, 2);
  });
}

for (const inFields of [false, true]) {
  test(`깃허브에만 있는 이름도 생성 없이 건너뛴다: fields=${inFields}`, async () => {
    const repository = new MemoryRecordingRepository();
    const meta = existing(firstName, inFields);
    repository.records.set(meta.id, meta);
    const store = new MemoryFileStore();
    const client = fakeAi();
    const report = await dubLines(source, store, client.ai, { ...options, cuts: [lines[0].cut] }, repository);
    assert.equal(report.rows[0].status, 'skipped');
    assert.equal(report.rows[0].recordName, firstName);
    assert.equal(report.exitCode, 0);
    assert.equal(client.calls, 0);
    assert.equal(store.files.size, 0);
    assert.deepEqual(repository.events, ['verify', 'list:clips']);
  });
}

for (const [localVersion, remoteVersion] of [[1, 3], [5, 1]]) {
  test(`force는 로컬 v${localVersion}와 깃허브 v${remoteVersion}의 합집합에서 다음 버전을 쓴다`, async () => {
    const repository = new MemoryRecordingRepository();
    const meta = existing(firstName.replace('-v1', `-v${remoteVersion}`), true);
    repository.records.set(meta.id, meta);
    const store = new MemoryFileStore();
    store.files.set(`${firstName.replace('-v1', `-v${localVersion}`)}.wav`, tones(1));
    const report = await dubLines(source, store, fakeAi().ai, {
      ...options, cuts: [lines[0].cut], force: true,
    }, repository);
    const name = firstName.replace('-v1', `-v${Math.max(localVersion, remoteVersion) + 1}`);
    assert.equal(report.rows[0].recordName, name);
    assert.ok(store.files.has(`${name}.wav`));
    assert.equal([...repository.records.values()].at(-1)?.name, name);
  });
}

test('업로드 실패는 생성 성공을 유지하며 경고·판정·코드 2를 남기고 다음 줄도 처리한다', async () => {
  const repository = new MemoryRecordingRepository();
  repository.saveError = new Error('업로드 거부');
  const store = new MemoryFileStore();
  const report = await dubLines(source, store, fakeAi().ai, options, repository);
  assert.equal(report.exitCode, 2);
  assert.deepEqual(report.rows.map((row) => row.status), ['generated', 'generated']);
  assert.equal(store.files.size, 2);
  assert.equal(repository.records.size, 0);
  assert.equal(repository.events.filter((event) => event === 'save:clips').length, 2);
  assert.equal(report.warnings.length, 2);
  assert.match(report.warnings[0], /깃허브 저장 실패.*업로드 거부/);
  assert.match(formatDubTable(report.rows), /적합 · 깃허브 저장 실패/);
});

test('업로드 실패 뒤에도 실제 출력 폴더의 WAV가 남는다', async () => {
  const root = await mkdtemp(join(process.cwd(), '.cli-upload-test-'));
  try {
    const repository = new MemoryRecordingRepository();
    repository.saveError = new Error('업로드 거부');
    const bytes = tones(1);
    const report = await dubLines(source, new DirFileStore(root), fakeAi(bytes).ai, {
      ...options, cuts: [lines[0].cut],
    }, repository);
    assert.equal(report.exitCode, 2);
    assert.deepEqual(await readFile(join(root, `${firstName}.wav`)), Buffer.from(bytes));
  } finally {
    // mkdtemp가 현재 작업 폴더 아래에 만든 이 테스트 전용 경로만 지운다.
    assert.ok(root.startsWith(join(process.cwd(), '.cli-upload-test-')));
    await rm(root, { recursive: true, force: true });
  }
});

test('로컬 쓰기가 실패한 줄은 깃허브에도 올리지 않는다', async () => {
  const repository = new MemoryRecordingRepository();
  const store: FileStore = { async list() { return []; }, async write() { throw new Error('디스크 오류'); } };
  const report = await dubLines(source, store, fakeAi().ai, { ...options, cuts: [lines[0].cut] }, repository);
  assert.equal(report.exitCode, 2);
  assert.equal(report.rows[0].status, 'failed');
  assert.deepEqual(repository.events, ['verify', 'list:clips']);
});

test('dry-run도 깃허브를 확인하고 버전을 읽되 생성·로컬 쓰기·save는 하지 않는다', async () => {
  const repository = new MemoryRecordingRepository();
  const meta = existing(firstName);
  repository.records.set(meta.id, meta);
  const store = new MemoryFileStore();
  const client = fakeAi();
  const report = await dubLines(source, store, client.ai, {
    ...options, cuts: [lines[0].cut], force: true, dryRun: true,
  }, repository);
  assert.equal(report.rows[0].recordName, firstName.replace('-v1', '-v2'));
  assert.equal(report.rows[0].status, 'dry-run');
  assert.equal(report.recordingStatus.target, repository.target);
  assert.deepEqual(repository.events, ['verify', 'list:clips']);
  assert.equal(store.files.size, 0);
  assert.equal(client.calls, 0);
  assert.equal(report.exitCode, 0);
});

test('분할 묶음은 앱의 presetName·id·정렬 시각으로 컷과 원본을 서로 다른 id로 업로드한다', async () => {
  const repository = new MemoryRecordingRepository();
  const prior = existing(firstName);
  repository.records.set(prior.id, prior);
  const priorBatch = existing(firstName.replace('-v1', '-batch-v3'));
  repository.records.set(priorBatch.id, priorBatch);
  const store = new MemoryFileStore();
  repository.beforeSave = (meta, audio) => assert.deepEqual(Buffer.from(store.files.get(`${meta.name}.wav`) ?? []), audio);
  const stylePrompt = '차분하게.';
  const original = tones(2);
  const report = await dubLines(source, store, fakeAi(original).ai, {
    ...options, batch: true, stylePrompt,
  }, repository);
  const saved = [...repository.records.values()].slice(2);
  const cuts = saved.filter((meta) => meta.fields.scriptLineId);
  const whole = saved.find((meta) => !meta.fields.scriptLineId);
  const request = batchRequest(groupConsecutiveLines(lines)[0], stylePrompt, 'ko');
  assert.equal(report.exitCode, 0);
  assert.equal(saved.length, 3);
  assert.equal(cuts.length, 2);
  assert.equal(cuts[0].name, firstName.replace('-v1', '-v2'));
  cuts.forEach((meta, index) => {
    assert.equal(meta.id, `cli-batch-${cuts[0].createdAt}-${index}`);
    assert.equal(meta.createdAt, cuts[0].createdAt - index);
    assert.deepEqual(meta.fields, {
      id: meta.id, presetName: `${lines[index].cut} Kore (묶음)`, voiceName: 'Kore', text: request.texts[index],
      stylePrompt: request.stylePrompt, duration: wavDurationSeconds(store.files.get(`${meta.name}.wav`) ?? new Uint8Array()),
      scriptLineId: lines[index].id, language: 'ko', mimeType: 'audio/wav', recordName: meta.name, createdAt: meta.createdAt,
    });
  });
  assert.ok(whole);
  assert.equal(whole.id, `cli-batch-${cuts[0].createdAt}`);
  assert.equal(whole.name, firstName.replace('-v1', '-batch-v4'));
  assert.deepEqual(whole.fields, {
    id: whole.id, presetName: '묶음 S#01-C001~S#01-C002 Kore (묶음 원본)', voiceName: 'Kore',
    text: request.texts.join('\n\n'), stylePrompt: request.stylePrompt, duration: wavDurationSeconds(original),
    language: 'ko', mimeType: 'audio/wav', recordName: whole.name, createdAt: whole.createdAt,
  });
  assert.deepEqual(repository.audio.get(whole.id), Buffer.from(original));
  assert.match(formatDubTable(report.rows).split('\n').at(-1) ?? '', /묶음 원본$/);
});

test('묶음 dry-run도 깃허브에만 있는 전체 묶음을 호출 없이 건너뛴다', async () => {
  const repository = new MemoryRecordingRepository();
  for (const line of lines) {
    const meta = existing(`S01/${line.id.replace('#', '')}-앵커-Kore-v1`);
    repository.records.set(meta.id, meta);
  }
  const client = fakeAi(tones(2));
  const store = new MemoryFileStore();
  const report = await dubLines(source, store, client.ai, { ...options, batch: true, dryRun: true }, repository);
  assert.equal(report.exitCode, 0);
  assert.deepEqual(report.rows.map((row) => row.status), ['skipped', 'skipped']);
  assert.equal(report.batches[0].calls, 0);
  assert.deepEqual(repository.events, ['verify', 'list:clips']);
  assert.equal(client.calls, 0);
  assert.equal(store.files.size, 0);
});

for (const failUpload of [false, true]) {
  test(`통째 저장 묶음도 기타 폴더 대신 명시한 씬 이름으로 업로드한다: 업로드 실패=${failUpload}`, async () => {
    const repository = new MemoryRecordingRepository();
    const prior = existing(firstName.replace('-v1', '-batch-v2'));
    repository.records.set(prior.id, prior);
    if (failUpload) repository.saveError = new Error('업로드 거부');
    const store = new MemoryFileStore();
    const bytes = tones(1);
    const report = await dubLines(source, store, fakeAi(bytes).ai, { ...options, batch: true }, repository);
    const name = firstName.replace('-v1', '-batch-v3');
    assert.equal(report.exitCode, 2);
    assert.equal(report.rows[0].status, 'unsplit');
    assert.deepEqual(store.files.get(`${name}.wav`), bytes);
    assert.deepEqual(repository.events, ['verify', 'list:clips', 'save:clips']);
    if (failUpload) {
      assert.match(formatDubTable(report.rows), /통째 저장.*깃허브 저장 실패/);
      assert.match(report.warnings.at(-1) ?? '', /업로드 거부/);
    } else {
      const meta = [...repository.records.values()].at(-1);
      assert.ok(meta);
      assert.equal(meta.name, name);
      assert.equal(meta.id, `cli-batch-${meta.createdAt}-0`);
      assert.equal(meta.fields.presetName, '묶음 S#01-C001~S#01-C002 Kore (자르기 실패)');
      assert.equal(meta.fields.text, lines.map((line) => line.text).join('\n\n'));
      assert.equal(meta.fields.scriptLineId, undefined);
      assert.equal('scriptLineId' in meta.fields, false);
      assert.equal('audioUrl' in meta.fields, false);
      assert.equal(meta.fields.duration, wavDurationSeconds(bytes));
    }
  });
}

test('분할 묶음의 업로드 실패도 로컬 컷들을 유지하고 다음 컷 업로드를 계속한다', async () => {
  const repository = new MemoryRecordingRepository();
  repository.beforeSave = (meta) => {
    repository.saveError = meta.fields.scriptLineId === lines[0].id ? new Error('첫 컷 거부') : undefined;
  };
  const store = new MemoryFileStore();
  const report = await dubLines(source, store, fakeAi(tones(2)).ai, { ...options, batch: true }, repository);
  assert.equal(report.exitCode, 2);
  assert.equal(store.files.size, 3);
  assert.equal(repository.records.size, 2);
  assert.deepEqual(report.rows.map((row) => row.status), ['generated', 'generated', 'batch-original']);
  const table = formatDubTable(report.rows).split('\n');
  assert.match(table[1], /깃허브 저장 실패/);
  assert.doesNotMatch(table[2], /깃허브 저장 실패/);
  assert.doesNotMatch(table[3], /깃허브 저장 실패/);
});

test('성공한 묶음의 원본 업로드 실패도 모든 로컬 파일과 컷 업로드를 보존한다', async () => {
  const repository = new MemoryRecordingRepository();
  repository.beforeSave = (meta) => {
    repository.saveError = meta.fields.scriptLineId ? undefined : new Error('원본 업로드 거부');
  };
  const store = new MemoryFileStore();
  const original = tones(2);
  const report = await dubLines(source, store, fakeAi(original).ai, { ...options, batch: true }, repository);
  assert.equal(report.exitCode, 2);
  assert.equal(store.files.size, 3);
  assert.equal(repository.records.size, 2);
  assert.deepEqual(store.files.get(firstName.replace('-v1', '-batch-v1.wav')), original);
  assert.deepEqual(report.rows.map((row) => row.status), ['generated', 'generated', 'batch-original']);
  assert.equal(report.rows[2].uploadFailed, true);
  assert.match(formatDubTable(report.rows).split('\n')[3], /묶음 원본.*깃허브 저장 실패/);
});
