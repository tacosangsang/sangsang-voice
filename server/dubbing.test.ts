import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { GenerateContentResponse } from '@google/genai';
import type { GenerateContentParameters, Part } from '@google/genai';
import { extractWavAudio, generateDubbing, NoAudioError } from './dubbing';
import type { DubbingRequest, GeminiClient } from './dubbing';

function responseWithParts(parts: Part[]): GenerateContentResponse {
  return Object.assign(new GenerateContentResponse(), { candidates: [{ content: { parts } }] });
}

const pcm = Buffer.from([0, 0, 255, 127]);
const imageBase64 = Buffer.from([1, 3, 5]).toString('base64');

describe('더빙 생성', () => {
  const wavBase64 = Buffer.from('RIFF원본').toString('base64');
  const wavResponse = responseWithParts([{ inlineData: { mimeType: 'audio/wav', data: wavBase64 } }]);
  const request: DubbingRequest = {
    text: '안녕.<sigh>반가워.', voiceName: 'Fenrir', stylePrompt: '  낮게  ', language: 'ko',
  };
  const calls: GenerateContentParameters[] = [];
  let respond: GeminiClient['models']['generateContent'];
  const ai: GeminiClient = {
    models: {
      async generateContent(params) {
        calls.push(params);
        return respond(params);
      },
    },
  };

  beforeEach(() => {
    calls.length = 0;
    respond = async () => wavResponse;
  });
  afterEach(() => mock.restoreAll());

  test('성공하면 주 모델의 WAV와 대사 및 지시문을 반환한다', async () => {
    assert.deepEqual(await generateDubbing(ai, request), {
      wavBase64, sourceMimeType: 'audio/wav', usedModel: 'gemini-3.8-flash-tts',
      text: request.text, styleWithLanguage: '낮게 Speak in Korean.',
    });
    assert.deepEqual(calls, [{
      model: 'gemini-3.8-flash-tts',
      contents: [{ role: 'user', parts: [{ text: request.text, speechMetadata: { style: '낮게 Speak in Korean.' } }] }],
      config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } } },
    }]);
  });

  test('PCM 응답은 WAV로 변환하고 원본 형식 정보를 보존한다', async () => {
    const sourceMimeType = 'audio/L16;rate=16000;channels=1';
    respond = async () => responseWithParts([{ inlineData: { mimeType: sourceMimeType, data: pcm.toString('base64') } }]);
    const result = await generateDubbing(ai, request);
    assert.equal(result.sourceMimeType, sourceMimeType);
    const wav = Buffer.from(result.wavBase64, 'base64');
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.length, 44 + pcm.length);
    assert.equal(wav.readUInt32LE(24), 16000);
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(40), pcm.length);
    assert.deepEqual(wav.subarray(44), pcm);
  });

  for (const [language, label, instruction] of [
    ['ko', '한국어', 'Speak in Korean.'], ['en', '영어', 'Speak in natural English.'],
  ] as const) {
    test(`연기 지시문을 정리하고 언어 지시를 붙인다: ${label}`, async () => {
      const result = await generateDubbing(ai, { ...request, language });
      assert.equal(result.styleWithLanguage, `낮게 ${instruction}`);
      assert.deepEqual(calls[0].contents, [{
        role: 'user', parts: [{ text: request.text, speechMetadata: { style: `낮게 ${instruction}` } }],
      }]);
    });
  }

  test('주 모델 실패 시 경량 모델에만 태그 없는 대사를 보낸다', async () => {
    const warning = mock.method(console, 'warn', () => {});
    respond = async (params) => {
      if (params.model === 'gemini-3.8-flash-tts') throw new Error('주 모델 실패');
      return wavResponse;
    };
    const result = await generateDubbing(ai, request);
    assert.equal(result.usedModel, 'gemini-3.8-flash-lite-tts');
    assert.equal(result.text, request.text);
    assert.equal(result.wavBase64, wavBase64);
    assert.deepEqual(calls.map((call) => call.model), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
    assert.deepEqual(calls.map((call) => call.contents), [request.text, '안녕.반가워.'].map((text) => [
      { role: 'user', parts: [{ text, speechMetadata: { style: '낮게 Speak in Korean.' } }] },
    ]));
    assert.deepEqual(calls[1].config, calls[0].config);
    assert.equal(warning.mock.callCount(), 1);
    assert.deepEqual(warning.mock.calls[0].arguments, [
      'Primary TTS (gemini-3.8-flash-tts) failed, attempting fallback to gemini-3.8-flash-lite-tts:', '주 모델 실패',
    ]);
  });

  test('경량 모델을 선호하면 태그를 유지해 한 번만 호출한다', async () => {
    const result = await generateDubbing(ai, { ...request, modelPreference: 'gemini-3.8-flash-lite-tts' });
    assert.equal(result.usedModel, 'gemini-3.8-flash-lite-tts');
    assert.deepEqual(calls.map((call) => call.model), ['gemini-3.8-flash-lite-tts']);
    assert.deepEqual(calls[0].contents, [{
      role: 'user', parts: [{ text: request.text, speechMetadata: { style: '낮게 Speak in Korean.' } }],
    }]);
  });

  test('Error 인스턴스가 아닌 예외도 기존 경고 메시지를 유지한다', async () => {
    const warning = mock.method(console, 'warn', () => {});
    const failure = { message: '주 모델 실패' };
    respond = async (params) => {
      if (params.model === 'gemini-3.8-flash-tts') throw failure;
      return wavResponse;
    };

    const result = await generateDubbing(ai, request);

    assert.equal(result.usedModel, 'gemini-3.8-flash-lite-tts');
    assert.deepEqual(warning.mock.calls[0].arguments, [
      'Primary TTS (gemini-3.8-flash-tts) failed, attempting fallback to gemini-3.8-flash-lite-tts:', failure.message,
    ]);
    assert.equal(warning.mock.callCount(), 1);
  });

  test('처음부터 경량 모델을 선택해 실패하면 같은 오류를 던지고 재시도하지 않는다', async () => {
    const warning = mock.method(console, 'warn', () => {});
    const failure = new Error('경량 모델 실패');
    respond = async () => { throw failure; };
    await assert.rejects(generateDubbing(ai, { ...request, modelPreference: 'gemini-3.8-flash-lite-tts' }), (error) => error === failure);
    assert.deepEqual(calls.map((call) => call.model), ['gemini-3.8-flash-lite-tts']);
    assert.equal(warning.mock.callCount(), 1);
    assert.deepEqual(warning.mock.calls[0].arguments, [
      'Primary TTS (gemini-3.8-flash-lite-tts) failed, attempting fallback to gemini-3.8-flash-lite-tts:', '경량 모델 실패',
    ]);
  });

  test('두 모델이 모두 실패하면 대체 모델의 오류를 그대로 던진다', async () => {
    mock.method(console, 'warn', () => {});
    const failure = new Error('대체 모델 실패');
    respond = async (params) => {
      if (params.model === 'gemini-3.8-flash-tts') throw new Error('주 모델 실패');
      throw failure;
    };
    await assert.rejects(generateDubbing(ai, request), (error) => error === failure);
    assert.deepEqual(calls.map((call) => call.model), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']);
  });

  for (const [label, fallback] of [['주 모델', false], ['대체 모델', true]] as const) {
    test(`음성이 없으면 전용 오류를 던지고 추가 재시도하지 않는다: ${label}`, async () => {
      const warning = mock.method(console, 'warn', () => {});
      respond = async (params) => {
        if (fallback && params.model === 'gemini-3.8-flash-tts') throw new Error('주 모델 실패');
        return new GenerateContentResponse();
      };
      await assert.rejects(generateDubbing(ai, request), (error) => {
        assert.ok(error instanceof NoAudioError);
        assert.equal(error.message, '음성 생성 응답에 오디오 데이터가 포함되지 않았습니다.');
        return true;
      });
      assert.equal(calls.length, fallback ? 2 : 1);
      assert.equal(warning.mock.callCount(), fallback ? 1 : 0);
    });
  }
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
