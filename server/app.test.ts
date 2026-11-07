import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { GenerateContentResponse } from '@google/genai';
import type { GenerateContentParameters, Part } from '@google/genai';
import { BundledScriptSource } from '../src/script/bundledSource';
import type { ScriptSnapshot, ScriptSource } from '../src/script/source';
import type { RecordingMeta } from '../src/shared/recording';
import { createApp, extractWavAudio, PRESETS } from './app';
import type { AppDependencies, GeminiClient } from './app';
import type { RecordingRepository } from './githubRecordingRepository';
import { recordingsConfig } from './recordingsConfig';

function responseWithParts(parts: Part[]): GenerateContentResponse {
  return Object.assign(new GenerateContentResponse(), { candidates: [{ content: { parts } }] });
}

const pcm = Buffer.from([0, 0, 255, 127]);
const sourceMimeType = 'audio/L16;rate=16000;channels=1';
const pcmResponse = responseWithParts([{ inlineData: { mimeType: sourceMimeType, data: pcm.toString('base64') } }]);
const imageBase64 = Buffer.from([1, 3, 5]).toString('base64');
const imageResponse = responseWithParts([{ inlineData: { mimeType: 'image/webp', data: imageBase64 } }]);

describe('서버 라우트', () => {
  const servers: Server[] = [];
  const bundledSnapshot: ScriptSnapshot = { origin: 'bundled', speakers: [], lines: [], loadedAt: 1, warnings: [] };
  const notionSnapshot: ScriptSnapshot = { origin: 'notion', speakers: [], lines: [], loadedAt: 2, warnings: ['노션 경고'] };
  const bundledScript: ScriptSource = { origin: 'bundled', async load() { return structuredClone(bundledSnapshot); } };
  const notionScript: ScriptSource = { origin: 'notion', async load() { return notionSnapshot; } };
  const brokenScript: ScriptSource = { origin: 'notion', async load() { throw new Error('대본 읽기 실패'); } };
  const meta: RecordingMeta = { id: '음성 하나', createdAt: 3, mimeType: 'audio/wav', fields: { text: '안녕.' } };
  const storedAudio = Buffer.from([82, 73, 70, 70, 0, 255]);
  const listCalls: Parameters<RecordingRepository['list']>[] = [];
  const saveCalls: Parameters<RecordingRepository['save']>[] = [];
  const audioCalls: Parameters<RecordingRepository['readAudio']>[] = [];
  const generationCalls: GenerateContentParameters[] = [];
  const fallbackCalls: GenerateContentParameters[] = [];
  const brokenGenerationCalls: GenerateContentParameters[] = [];
  const silentGenerationCalls: GenerateContentParameters[] = [];
  let verifyCalls = 0;
  let brokenVerifyCalls = 0;
  const recordings: RecordingRepository = {
    target: '테스트/음성@recordings',
    async verify() { verifyCalls++; },
    async list(store) { listCalls.push([store]); return [meta]; },
    async save(store, savedMeta, audio) { saveCalls.push([store, savedMeta, audio]); },
    async readAudio(store, id) { audioCalls.push([store, id]); return storedAudio; },
  };
  const brokenRecordings: RecordingRepository = {
    target: '테스트/실패@recordings',
    async verify() {
      brokenVerifyCalls++;
      if (brokenVerifyCalls === 1) throw new Error('권한 확인 실패');
    },
    async list() { throw new Error('목록 읽기 실패'); },
    async save() { throw new Error('음성 저장 실패'); },
    async readAudio() { throw new Error('음성 읽기 실패'); },
  };
  const ai: GeminiClient = {
    models: {
      async generateContent(params) {
        generationCalls.push(params);
        return params.model === 'gemini-3.1-flash-lite-image' ? imageResponse : pcmResponse;
      },
    },
  };
  const brokenAi: GeminiClient = {
    models: { async generateContent(params) { brokenGenerationCalls.push(params); throw new Error('모델 호출 실패'); } },
  };
  const silentAi: GeminiClient = {
    models: { async generateContent(params) { silentGenerationCalls.push(params); return new GenerateContentResponse(); } },
  };
  const fallbackAi: GeminiClient = {
    models: {
      async generateContent(params) {
        fallbackCalls.push(params);
        if (params.model === 'gemini-3.8-flash-tts') throw new Error('주 모델 실패');
        return pcmResponse;
      },
    },
  };
  const reason = '테스트에서 서버 저장을 껐습니다.';
  let emptyUrl: string;
  let readyUrl: string;
  let brokenUrl: string;
  let silentUrl: string;
  let fallbackUrl: string;
  let bundledUrl: string;

  async function startApp(overrides: Partial<AppDependencies> = {}): Promise<string> {
    const server = createServer(createApp({
      notionScript: undefined,
      bundledScript,
      recordings: undefined,
      recordingsProblem: reason,
      getAiClient: () => undefined,
      ...overrides,
    }));
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  }

  function postJson(url: string, route: string, body: unknown): Promise<Response> {
    return fetch(`${url}${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  }

  before(async () => {
    emptyUrl = await startApp();
    readyUrl = await startApp({ notionScript, recordings, getAiClient: () => ai });
    brokenUrl = await startApp({ notionScript: brokenScript, recordings: brokenRecordings, getAiClient: () => brokenAi });
    silentUrl = await startApp({ getAiClient: () => silentAi });
    fallbackUrl = await startApp({ getAiClient: () => fallbackAi });
    bundledUrl = await startApp({ bundledScript: new BundledScriptSource() });
  });

  after(async () => {
    await Promise.all(servers.filter((server) => server.listening).map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    })));
  });

  beforeEach(() => {
    mock.method(console, 'error', () => {});
    listCalls.length = 0;
    saveCalls.length = 0;
    audioCalls.length = 0;
    generationCalls.length = 0;
    fallbackCalls.length = 0;
    brokenGenerationCalls.length = 0;
    silentGenerationCalls.length = 0;
  });
  afterEach(() => mock.restoreAll());

  test('프리셋 목록은 공개한 프리셋과 같다', async () => {
    const response = await fetch(`${readyUrl}/api/dubbing/presets`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { presets: PRESETS });
  });

  test('노션 출처가 없으면 사본과 토큰 누락 경고를 반환한다', async () => {
    const response = await fetch(`${emptyUrl}/api/script`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ...bundledSnapshot, warnings: ['NOTION_TOKEN이 없어 저장소 사본 대본을 씁니다.'],
    });
  });

  test('실제 사본 출처를 두 번 읽어도 토큰 누락 경고는 하나씩이다', async () => {
    for (let request = 0; request < 2; request++) {
      const response = await fetch(`${bundledUrl}/api/script`);
      assert.equal(response.status, 200);
      const snapshot = await response.json();
      assert.equal(snapshot.origin, 'bundled');
      assert.deepEqual(snapshot.warnings, ['NOTION_TOKEN이 없어 저장소 사본 대본을 씁니다.']);
    }
  });

  test('노션 읽기가 성공하면 해당 스냅샷을 반환한다', async () => {
    const response = await fetch(`${readyUrl}/api/script`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), notionSnapshot);
  });

  test('노션 읽기가 실패하면 사본에 오류 경고를 하나씩 붙인다', async () => {
    for (let request = 0; request < 2; request++) {
      const response = await fetch(`${brokenUrl}/api/script`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ...bundledSnapshot, warnings: ['노션에서 읽지 못해 저장소 사본을 씁니다: 대본 읽기 실패'],
      });
    }
  });

  test('녹음 저장소가 없으면 꺼진 이유를 반환한다', async () => {
    const response = await fetch(`${emptyUrl}/api/recordings/status`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { enabled: false, reason });
  });

  test('저장소 확인에 성공하면 두 요청에서 한 번만 확인한다', async () => {
    for (let request = 0; request < 2; request++) {
      const response = await fetch(`${readyUrl}/api/recordings/status`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { enabled: true, target: recordings.target });
    }
    assert.equal(verifyCalls, 1);
  });

  test('저장소 확인에 실패하면 다음 요청에서 재확인하고 성공을 기억한다', async () => {
    const failed = await fetch(`${brokenUrl}/api/recordings/status`);
    assert.equal(failed.status, 200);
    assert.deepEqual(await failed.json(), {
      enabled: false, reason: `${brokenRecordings.target}에 닿지 못했습니다: 권한 확인 실패`,
    });
    assert.equal(brokenVerifyCalls, 1);
    for (let request = 0; request < 2; request++) {
      const response = await fetch(`${brokenUrl}/api/recordings/status`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { enabled: true, target: brokenRecordings.target });
    }
    assert.equal(brokenVerifyCalls, 2);
  });

  for (const [label, baseUrl, store] of [
    ['모르는 저장소', () => readyUrl, 'unknown'], ['꺼진 저장소', () => emptyUrl, 'clips'],
  ] as const) {
    test(`목록 요청은 없는 저장소를 거절한다: ${label}`, async () => {
      const response = await fetch(`${baseUrl()}/api/recordings/${store}`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: '저장소가 없습니다.' });
      assert.deepEqual(listCalls, []);
    });

    test(`저장 요청은 없는 저장소를 거절한다: ${label}`, async () => {
      const response = await postJson(baseUrl(), `/api/recordings/${store}`, { meta, audioBase64: 'AQI=' });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: '저장소가 없습니다.' });
      assert.deepEqual(saveCalls, []);
    });

    test(`음성 요청은 없는 저장소에 빈 본문을 반환한다: ${label}`, async () => {
      const response = await fetch(`${baseUrl()}/api/recordings/${store}/음성/audio`);
      assert.equal(response.status, 404);
      assert.equal(await response.text(), '');
      assert.deepEqual(audioCalls, []);
    });
  }

  test('녹음 목록은 지정한 저장소에서 읽는다', async () => {
    const response = await fetch(`${readyUrl}/api/recordings/clips`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [meta]);
    assert.deepEqual(listCalls, [['clips']]);
  });

  test('목록 읽기 실패는 오류 메시지와 함께 반환한다', async () => {
    const response = await fetch(`${brokenUrl}/api/recordings/clips`);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: '목록 읽기 실패' });
  });

  for (const [label, body] of [
    ['메타데이터 없음', { audioBase64: 'AQI=' }],
    ['식별자 없음', { meta: {}, audioBase64: 'AQI=' }],
    ['식별자 빈 문자열', { meta: { id: '' }, audioBase64: 'AQI=' }],
    ['음성 없음', { meta }], ['음성 빈 문자열', { meta, audioBase64: '' }],
  ] as const) {
    test(`필수 값이 빠진 저장 요청은 거절한다: ${label}`, async () => {
      const response = await postJson(readyUrl, '/api/recordings/clips', body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'meta.id와 audioBase64가 필요합니다.' });
      assert.deepEqual(saveCalls, []);
    });
  }

  test('음성 저장은 전달받은 base64를 버퍼로 풀어 저장한다', async () => {
    const audio = Buffer.from([0, 127, 128, 255]);
    const response = await postJson(readyUrl, '/api/recordings/clips', { meta, audioBase64: audio.toString('base64') });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(saveCalls.length, 1);
    assert.ok(Buffer.isBuffer(saveCalls[0][2]));
    assert.deepEqual(saveCalls[0], ['clips', meta, audio]);
  });

  test('음성 저장 실패는 오류 메시지와 함께 반환한다', async () => {
    const response = await postJson(brokenUrl, '/api/recordings/clips', { meta, audioBase64: 'AQI=' });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: '음성 저장 실패' });
  });

  test('저장된 음성은 원본 바이트와 형식 및 캐시 헤더를 반환한다', async () => {
    const response = await fetch(`${readyUrl}/api/recordings/clips/${encodeURIComponent(meta.id)}/audio`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'audio/wav');
    assert.equal(response.headers.get('Cache-Control'), 'private, max-age=31536000, immutable');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), storedAudio);
    assert.deepEqual(audioCalls, [['clips', meta.id]]);
  });

  test('음성 읽기 실패는 빈 본문의 게이트웨이 오류를 반환한다', async () => {
    const response = await fetch(`${brokenUrl}/api/recordings/clips/음성/audio`);
    assert.equal(response.status, 502);
    assert.equal(await response.text(), '');
  });

  for (const [label, body] of [
    ['프롬프트 없음', {}], ['빈 문자열', { prompt: '' }],
    ['숫자', { prompt: 7 }], ['객체', { prompt: {} }],
  ] as const) {
    test(`씬 생성은 잘못된 프롬프트를 키 확인 전에 거절한다: ${label}`, async () => {
      const response = await postJson(emptyUrl, '/api/scenes/ai-generate', body);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: '생성할 씬에 대한 프롬프트를 입력해주세요.' });
    });
  }

  test('씬 생성 키가 없으면 기존 오류 메시지를 반환한다', async () => {
    const response = await postJson(emptyUrl, '/api/scenes/ai-generate', { prompt: '주방' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
  });

  test('씬 생성은 접두 문구와 다듬은 프롬프트를 보내고 이미지 주소를 반환한다', async () => {
    const response = await postJson(readyUrl, '/api/scenes/ai-generate', { prompt: '  어두운 주방  ' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { imageUrl: `data:image/webp;base64,${imageBase64}`, prompt: '어두운 주방' });
    assert.deepEqual(generationCalls, [{
      model: 'gemini-3.1-flash-lite-image',
      contents: { parts: [{ text: 'Cinematic animated film still, earthy desaturated palette, deep shadows, warm and cool light contrast, deep focus: 어두운 주방' }] },
    }]);
  });

  test('씬 생성 응답에 이미지가 없으면 게이트웨이 오류를 반환한다', async () => {
    const response = await postJson(silentUrl, '/api/scenes/ai-generate', { prompt: '주방' });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: '이미지가 생성되지 않았습니다. 다른 프롬프트로 시도해보세요.' });
  });

  test('씬 모델 호출 실패는 오류 메시지를 반환한다', async () => {
    const response = await postJson(brokenUrl, '/api/scenes/ai-generate', { prompt: '주방' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: '모델 호출 실패' });
  });

  test('더빙 키가 없으면 기존 영문 오류 메시지를 반환한다', async () => {
    const response = await postJson(emptyUrl, '/api/dubbing/generate', { text: '대사' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'GEMINI_API_KEY is not configured in the environment.' });
  });

  test('더빙 요청의 잘못된 JSON은 본문 파서가 거절한다', async () => {
    const response = await fetch(`${readyUrl}/api/dubbing/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(response.status, 400);
    await response.text();
    assert.deepEqual(generationCalls, []);
  });

  for (const [label, body, message] of [
    ['대사가 숫자', { text: 7 }, 'text.trim is not a function'],
    ['연기 지시가 숫자', { stylePrompt: 7 }, 'stylePrompt.trim is not a function'],
  ] as const) {
    test(`더빙 입력 타입 오류는 현재 내부 오류로 반환한다: ${label}`, async () => {
      const response = await postJson(readyUrl, '/api/dubbing/generate', body);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: message });
      assert.deepEqual(generationCalls, []);
    });
  }

  test('더빙 성공 응답은 대사와 모델 정보 및 PCM을 감싼 WAV를 반환한다', async () => {
    const response = await postJson(readyUrl, '/api/dubbing/generate', {
      text: '  안녕.  ', voiceName: 'Fenrir', stylePrompt: '  차분하게  ', language: 'en',
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), [
      'audioBase64', 'mimeType', 'sourceMimeType', 'voiceName', 'language', 'usedModel', 'text', 'timestamp',
    ].sort());
    assert.equal(body.mimeType, 'audio/wav');
    assert.equal(body.sourceMimeType, sourceMimeType);
    assert.equal(body.voiceName, 'Fenrir');
    assert.equal(body.language, 'en');
    assert.equal(body.usedModel, 'gemini-3.8-flash-tts');
    assert.equal(body.text, '안녕.');
    assert.equal(typeof body.timestamp, 'number');
    assert.ok(Number.isFinite(body.timestamp));
    const wav = Buffer.from(body.audioBase64, 'base64');
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.length, 44 + pcm.length);
    assert.equal(wav.readUInt32LE(24), 16000);
    assert.equal(wav.readUInt32LE(40), pcm.length);
    assert.deepEqual(wav.subarray(44), pcm);
    assert.deepEqual(generationCalls, [{
      model: 'gemini-3.8-flash-tts',
      contents: [{ role: 'user', parts: [{ text: '안녕.', speechMetadata: { style: '차분하게 Speak in natural English.' } }] }],
      config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } } },
    }]);
  });

  test('빈 더빙 요청은 현재 기본 대사와 목소리 및 한국어를 사용한다', async () => {
    const response = await postJson(readyUrl, '/api/dubbing/generate', {});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.text, '신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.');
    assert.equal(body.voiceName, 'Charon');
    assert.equal(body.language, 'ko');
    assert.equal(body.usedModel, 'gemini-3.8-flash-tts');
  });

  test('공백뿐인 대사는 현재 검증 없이 모델에 전달한다', async () => {
    const response = await postJson(readyUrl, '/api/dubbing/generate', { text: '   ' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, '');
    assert.equal(generationCalls.length, 1);
  });

  test('경량 모델 선호와 알 수 없는 언어의 한국어 기본값을 적용한다', async () => {
    const response = await postJson(readyUrl, '/api/dubbing/generate', {
      text: '대사', language: 'toString', modelPreference: 'gemini-3.8-flash-lite-tts',
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.usedModel, 'gemini-3.8-flash-lite-tts');
    assert.equal(body.language, 'ko');
    assert.equal(generationCalls.length, 1);
    assert.equal(generationCalls[0].model, 'gemini-3.8-flash-lite-tts');
  });

  test('더빙 응답에 음성이 없으면 재시도 없이 게이트웨이 오류를 반환한다', async () => {
    const response = await postJson(silentUrl, '/api/dubbing/generate', { text: '대사' });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: '음성 생성 응답에 오디오 데이터가 포함되지 않았습니다.' });
    assert.equal(silentGenerationCalls.length, 1);
  });

  test('주 모델 실패 시 발성 태그를 빼고 경량 모델로 재시도한다', async () => {
    const warning = mock.method(console, 'warn', () => {});
    const response = await postJson(fallbackUrl, '/api/dubbing/generate', { text: '  안녕.<sigh>반가워.  ', stylePrompt: '낮게' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.usedModel, 'gemini-3.8-flash-lite-tts');
    assert.equal(body.text, '안녕.<sigh>반가워.');
    assert.deepEqual(fallbackCalls.map((call) => call.model), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
    assert.deepEqual(fallbackCalls.map((call) => call.contents), ['안녕.<sigh>반가워.', '안녕.반가워.'].map((text) => [
      { role: 'user', parts: [{ text, speechMetadata: { style: '낮게 Speak in Korean.' } }] },
    ]));
    assert.equal(warning.mock.callCount(), 1);
  });

  test('처음부터 경량 모델을 선택해 실패하면 다시 호출하지 않는다', async () => {
    const warning = mock.method(console, 'warn', () => {});
    const response = await postJson(brokenUrl, '/api/dubbing/generate', { text: '대사', modelPreference: 'gemini-3.8-flash-lite-tts' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: '모델 호출 실패' });
    assert.deepEqual(brokenGenerationCalls.map((call) => call.model), ['gemini-3.8-flash-lite-tts']);
    assert.equal(warning.mock.callCount(), 1);
  });

  test('주 모델과 대체 모델이 모두 실패하면 내부 오류를 반환한다', async () => {
    mock.method(console, 'warn', () => {});
    const response = await postJson(brokenUrl, '/api/dubbing/generate', { text: '대사' });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: '모델 호출 실패' });
    assert.deepEqual(brokenGenerationCalls.map((call) => call.model), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  });
});

describe('녹음 저장소 설정', () => {
  test('토큰이 없으면 저장소 없이 이유만 반환한다', () => {
    assert.deepEqual(recordingsConfig({}), { problem: '서버에 GITHUB_TOKEN이 없습니다.' });
  });

  for (const [label, repo] of [
    ['새 토큰 모양', 'github_pat_fake/repo'], ['기존 토큰 모양', 'ghp_fake/repo'],
    ['소유자 없음', 'repo'], ['경로가 세 부분', 'owner/repo/extra'], ['공백 포함', 'owner/re po'],
  ] as const) {
    test(`잘못된 저장소 이름은 값을 노출하지 않는다: ${label}`, () => {
      assert.deepEqual(recordingsConfig({ GITHUB_TOKEN: '테스트용 토큰', GITHUB_RECORDINGS_REPO: repo }), {
        problem: 'GITHUB_RECORDINGS_REPO 값이 저장소 이름(owner/name)이 아닙니다. 비워 두면 기본값을 씁니다.',
      });
    });
  }

  for (const [label, branch] of [
    ['새 토큰 모양', 'github_pat_fake'], ['기존 토큰 모양', 'ghp_fake'],
    ['공백 포함', 'bad branch'], ['금지 기호', 'bad:branch'],
  ] as const) {
    test(`잘못된 브랜치 이름은 값을 노출하지 않는다: ${label}`, () => {
      assert.deepEqual(recordingsConfig({ GITHUB_TOKEN: '테스트용 토큰', GITHUB_RECORDINGS_BRANCH: branch }), {
        problem: 'GITHUB_RECORDINGS_BRANCH 값이 브랜치 이름이 아닙니다. 비워 두면 recordings를 씁니다.',
      });
    });
  }

  for (const [label, overrides] of [['지정하지 않음', {}], ['빈 문자열', { GITHUB_RECORDINGS_REPO: '', GITHUB_RECORDINGS_BRANCH: '' }]] as const) {
    test(`기본 저장소와 브랜치를 사용한다: ${label}`, () => {
      const config = recordingsConfig({ GITHUB_TOKEN: '테스트용 토큰', ...overrides });
      assert.equal(config.problem, undefined);
      assert.equal(config.repo?.target, 'tacosangsang/sangsang-voice@recordings');
    });
  }

  test('명시한 저장소와 브랜치로 저장 위치를 만든다', () => {
    const config = recordingsConfig({ GITHUB_TOKEN: '테스트용 토큰', GITHUB_RECORDINGS_REPO: 'owner/repo', GITHUB_RECORDINGS_BRANCH: 'takes/draft-1' });
    assert.equal(config.problem, undefined);
    assert.equal(config.repo?.target, 'owner/repo@takes/draft-1');
  });
});

describe('응답 오디오 추출', () => {
  afterEach(() => mock.restoreAll());

  test('후보가 없는 응답에서는 오디오를 찾지 못한다', () => {
    assert.equal(extractWavAudio(new GenerateContentResponse()), undefined);
  });

  for (const [label, parts] of [
    ['본문 없음', []], ['글만 있음', [{ text: '음성 없음' }]],
    ['이미지만 있음', [{ inlineData: { mimeType: 'image/png', data: imageBase64 } }]],
    ['오디오 데이터가 비어 있음', [{ inlineData: { mimeType: 'audio/wav', data: '' } }]],
  ] satisfies [string, Part[]][]) {
    test(`오디오 파트가 없으면 없는 값이다: ${label}`, () => {
      assert.equal(extractWavAudio(responseWithParts(parts)), undefined);
    });
  }

  for (const mimeType of ['audio/wav', 'audio/x-wav']) {
    test(`WAV 응답은 원본을 그대로 반환한다: ${mimeType}`, () => {
      const base64 = Buffer.from('RIFF원본').toString('base64');
      assert.deepEqual(extractWavAudio(responseWithParts([{ inlineData: { mimeType, data: base64 } }])), {
        base64, sourceMimeType: mimeType,
      });
    });
  }

  test('여러 WAV 조각은 첫 조각만 쓰고 한 번 경고한다', () => {
    const warning = mock.method(console, 'warn', () => {});
    const first = Buffer.from('RIFF첫 조각').toString('base64');
    const second = Buffer.from('RIFF둘째 조각').toString('base64');
    const result = extractWavAudio(responseWithParts([
      { inlineData: { mimeType: 'audio/wav', data: first } }, { inlineData: { mimeType: 'audio/wav', data: second } },
    ]));
    assert.deepEqual(result, { base64: first, sourceMimeType: 'audio/wav' });
    assert.equal(warning.mock.callCount(), 1);
    assert.deepEqual(warning.mock.calls[0].arguments, ['여러 WAV 조각이 왔지만 첫 조각만 사용합니다.']);
  });

  test('PCM 조각은 순서대로 합쳐 44바이트 WAV 헤더를 붙인다', () => {
    const first = Buffer.from([0, 0, 255, 127]);
    const second = Buffer.from([0, 128, 1, 0]);
    const mimeType = 'audio/L16;rate=48000;channels=2';
    const result = extractWavAudio(responseWithParts([
      { text: '끼어든 설명' }, { inlineData: { mimeType, data: first.toString('base64') } },
      { inlineData: { mimeType: 'image/png', data: imageBase64 } },
      { inlineData: { mimeType, data: second.toString('base64') } },
    ]));
    assert.ok(result);
    assert.equal(result.sourceMimeType, mimeType);
    const wav = Buffer.from(result.base64, 'base64');
    assert.equal(wav.length, 44 + first.length + second.length);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(4), 36 + first.length + second.length);
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), 48000);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(wav.readUInt32LE(40), first.length + second.length);
    assert.deepEqual(wav.subarray(44), Buffer.concat([first, second]));
  });

  test('형식이 없는 오디오 데이터는 기본 PCM 형식으로 감싼다', () => {
    const result = extractWavAudio(responseWithParts([{ inlineData: { data: pcm.toString('base64') } }]));
    assert.ok(result);
    assert.equal(result.sourceMimeType, 'audio/L16;rate=24000');
    const wav = Buffer.from(result.base64, 'base64');
    assert.equal(wav.readUInt32LE(24), 24000);
    assert.equal(wav.readUInt16LE(22), 1);
    assert.deepEqual(wav.subarray(44), pcm);
  });
});
