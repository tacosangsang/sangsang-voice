import express from 'express';
import type { Express } from 'express';
import type { GoogleGenAI } from '@google/genai';
import { isWavMime, parsePcmMime, wrapPcm16AsWav } from '../src/shared/wav';
import { LANGUAGES, toLanguage } from '../src/shared/language';
import type { ScriptSource } from '../src/script/source';
import type { RecordingRepository } from './githubRecordingRepository';
import { isRecordingStore } from '../src/shared/recording';
import type { RecordingMeta, RecordingStatus } from '../src/shared/recording';

export type GeminiClient = {
  readonly models: Pick<GoogleGenAI['models'], 'generateContent'>;
};

export interface AppDependencies {
  readonly notionScript: ScriptSource | undefined;
  readonly bundledScript: ScriptSource;
  readonly recordings: RecordingRepository | undefined;
  readonly recordingsProblem: string | undefined;
  readonly getAiClient: () => GeminiClient | undefined;
}

export interface DubbingPreset {
  id: string;
  name: string;
  voiceName: string;
  badge: string;
  description: string;
  stylePrompt: string;
  formattedText: string;
  characterDescription: string;
}

export const PRESETS: DubbingPreset[] = [
  {
    id: 'charon-elegant',
    name: '우아한 악마 (Charon)',
    voiceName: 'Charon',
    badge: '추천 • 시네마틱',
    description: '서늘하고 여유로운 신사. 낮고 우아하며 비밀을 속삭이듯 냉정한 어조',
    stylePrompt:
      'A sophisticated, chillingly calm, polite yet deeply sinister gentleman in a tailored white suit whispering cynical philosophical truths with subtle breath pauses and cold elegance.',
    formattedText: '신은 두 접시 중 하나만 고릅니다. <breath> 다른 하나가 초라하면 더 쉽겠지요.',
    characterDescription:
      '하얀 정장을 입고 붉은 눈의 토끼 가면을 쓴 의문의 신사. 요리사의 귀에 다가가 냉소적인 제안을 건네는 순간',
  },
  {
    id: 'fenrir-cynical',
    name: '비정한 냉혈한 (Fenrir)',
    voiceName: 'Fenrir',
    badge: '다크 • 묵직함',
    description: '극도로 가라앉은 저음, 감정이 배제된 채 압박해오는 차가운 위압감',
    stylePrompt:
      'Deep, raspy, heavy, and cynical male voice, emotionally detached, dark psychological pressure with an unyielding cold cadence.',
    formattedText: '신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면, 더 쉽겠지요.',
    characterDescription:
      '요리사의 고뇌를 꿰뚫어 보며 선택의 잔인함을 차갑게 각인시키는 어두운 조언자',
  },
  {
    id: 'puck-eccentric',
    name: '기괴한 조소 (Puck)',
    voiceName: 'Puck',
    badge: '그로테스크 • 광기',
    description: '가면 뒤에서 번지는 옅은 조소와 비틀린 유머, 신경질적인 광기',
    stylePrompt:
      'Eccentric, slightly playful yet deeply eerie and twisted voice with a sarcastic sneer, unsettlingly casual about cruel fate.',
    formattedText: '신은 두 접시 중 하나만 고릅니다. <laugh> 다른 하나가 초라하면... 더 쉽겠지요?',
    characterDescription:
      '붉은 유리 눈알 뒤에서 비웃음을 머금고 세상의 비정함을 즐기듯 속삭이는 가면의 남자',
  },
  {
    id: 'zephyr-whisper',
    name: '스산한 환영 (Zephyr)',
    voiceName: 'Zephyr',
    badge: '미스터리 • 에코',
    description: '꿈결처럼 귓가를 맴돌며 유혹하는 나직하고 몽환적인 음성',
    stylePrompt:
      'Ethereal, haunting whisper, calm and smooth yet spine-chilling, delivered close to the microphone as if speaking into someone’s ear.',
    formattedText: '신은 두 접시 중 하나만 고릅니다... 다른 하나가 초라하면, 더 쉽겠지요.',
    characterDescription:
      '피할 수 없는 악마의 속삭임처럼 요리사의 귓가에 맴도는 유혹과 파멸의 계시',
  },
];


type GenaiResponse = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

/**
 * TTS 응답의 오디오 조각을 모두 이어 붙이고, raw PCM(audio/L16 등)이면 WAV 헤더를 씌운다.
 * 응답 mimeType을 보지 않고 audio/wav로 붙이면 헤더 없는 PCM이 재생·다운로드되지 않는다.
 */
export function extractWavAudio(response: GenaiResponse): { base64: string; sourceMimeType: string } | undefined {
  const parts = (response.candidates?.[0]?.content?.parts ?? []).filter(
    (p) => p.inlineData?.data && (p.inlineData.mimeType ?? 'audio/').startsWith('audio/')
  );
  if (parts.length === 0) return undefined;

  const sourceMimeType = parts[0].inlineData?.mimeType ?? 'audio/L16;rate=24000';
  const chunks = parts.map((p) => Buffer.from(p.inlineData!.data!, 'base64'));

  if (isWavMime(sourceMimeType)) {
    if (chunks.length > 1) {
      console.warn('여러 WAV 조각이 왔지만 첫 조각만 사용합니다.');
    }
    return { base64: chunks[0].toString('base64'), sourceMimeType };
  }
  const pcm = new Uint8Array(Buffer.concat(chunks));
  const wav = wrapPcm16AsWav(pcm, parsePcmMime(sourceMimeType));
  return { base64: Buffer.from(wav).toString('base64'), sourceMimeType };
}

export function createApp(deps: AppDependencies): Express {
  const { notionScript, bundledScript, recordings, recordingsProblem, getAiClient } = deps;
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // 프리셋 목록
  app.get('/api/dubbing/presets', (_req, res) => {
    res.json({ presets: PRESETS });
  });

  // 씬 이미지 생성
  app.post('/api/scenes/ai-generate', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: '생성할 씬에 대한 프롬프트를 입력해주세요.' });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
      }

      // PLATING 규칙: 스톱모션·클레이·인형·미니어처·실사 연상 단어 금지. 색감만 흙빛 저채도, 깊은 그림자, 온·냉 대비.
      const enhancedPrompt = `Cinematic animated film still, earthy desaturated palette, deep shadows, warm and cool light contrast, deep focus: ${prompt.trim()}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [
            {
              text: enhancedPrompt,
            },
          ],
        },
      });

      let generatedImageUrl: string | undefined;

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!generatedImageUrl) {
        return res.status(502).json({
          error: '이미지가 생성되지 않았습니다. 다른 프롬프트로 시도해보세요.',
        });
      }

      res.json({
        imageUrl: generatedImageUrl,
        prompt: prompt.trim(),
      });
    } catch (error: any) {
      console.error('Error generating scene image:', error);
      res.status(500).json({
        error: error.message || 'AI 씬 이미지 생성 중 오류가 발생했습니다.',
      });
    }
  });

  // 녹음 대본. NOTION_TOKEN이 있으면 노션 컷표에서 매번 새로 읽고, 없거나 실패하면 저장소 사본을 쓴다.
  app.get('/api/script', async (_req, res) => {
    if (!notionScript) {
      const snapshot = await bundledScript.load();
      snapshot.warnings.push('NOTION_TOKEN이 없어 저장소 사본 대본을 씁니다.');
      return res.json(snapshot);
    }
    try {
      res.json(await notionScript.load());
    } catch (error: any) {
      console.error('Failed to load script from Notion:', error);
      const snapshot = await bundledScript.load();
      snapshot.warnings.push(`노션에서 읽지 못해 저장소 사본을 씁니다: ${error.message}`);
      res.json(snapshot);
    }
  });



  // 토큰이 있어도 이름·권한·브랜치가 틀리면 저장이 안 된다. 화면에 이유를 보이도록 한 번 확인해 둔다(실패는 다음 요청에 다시 확인).
  let recordingsVerified: Promise<void> | undefined;

  app.get('/api/recordings/status', async (_req, res) => {
    if (!recordings) {
      const status: RecordingStatus = { enabled: false, reason: recordingsProblem };
      return res.json(status);
    }
    recordingsVerified ??= recordings.verify().catch((e) => {
      recordingsVerified = undefined;
      throw e;
    });
    try {
      await recordingsVerified;
      const status: RecordingStatus = { enabled: true, target: recordings.target };
      res.json(status);
    } catch (error: any) {
      console.error('GitHub recordings unavailable:', error);
      const status: RecordingStatus = { enabled: false, reason: `${recordings.target}에 닿지 못했습니다: ${error.message}` };
      res.json(status);
    }
  });

  app.get('/api/recordings/:store', async (req, res) => {
    const { store } = req.params;
    if (!recordings || !isRecordingStore(store)) return res.status(404).json({ error: '저장소가 없습니다.' });
    try {
      res.json(await recordings.list(store));
    } catch (error: any) {
      console.error('Failed to list recordings:', error);
      res.status(502).json({ error: error.message });
    }
  });

  app.post('/api/recordings/:store', async (req, res) => {
    const { store } = req.params;
    if (!recordings || !isRecordingStore(store)) return res.status(404).json({ error: '저장소가 없습니다.' });
    const { meta, audioBase64 } = req.body as { meta?: RecordingMeta; audioBase64?: string };
    if (!meta?.id || !audioBase64) return res.status(400).json({ error: 'meta.id와 audioBase64가 필요합니다.' });
    try {
      await recordings.save(store, meta, Buffer.from(audioBase64, 'base64'));
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Failed to save recording:', error);
      res.status(502).json({ error: error.message });
    }
  });

  app.get('/api/recordings/:store/:id/audio', async (req, res) => {
    const { store, id } = req.params;
    if (!recordings || !isRecordingStore(store)) return res.status(404).end();
    try {
      const audio = await recordings.readAudio(store, id);
      // 같은 id의 음성은 바뀌지 않는다.
      res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'private, max-age=31536000, immutable' }).send(audio);
    } catch (error: any) {
      console.error('Failed to read recording:', error);
      res.status(502).end();
    }
  });

  // 대사 음성 생성
  app.post('/api/dubbing/generate', async (req, res) => {
    try {
      for (const field of ['text', 'voiceName', 'stylePrompt', 'modelPreference'] as const) {
        const value: unknown = req.body[field];
        if (value !== undefined && typeof value !== 'string') {
          return res.status(400).json({ error: `${field}은(는) 문자열이어야 합니다.` });
        }
      }
      const {
        text = '신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.',
        voiceName = 'Charon',
        stylePrompt = 'A chilling, calm, sophisticated and cynical Korean voice with subtle breath',
        modelPreference = 'gemini-3.8-flash-tts',
      } = req.body;
      const cleanText = text.trim();
      if (!cleanText) {
        return res.status(400).json({ error: '대사가 비어 있습니다.' });
      }
      const language = toLanguage(req.body.language);
      // 언어 지시는 서버 한 곳에서만 붙인다. 프리셋 지시문에는 언어를 적지 않는다.
      const styleWithLanguage = `${stylePrompt.trim()} ${LANGUAGES[language].ttsInstruction}`;

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured in the environment.',
        });
      }

      const primaryModel =
        modelPreference === 'gemini-3.8-flash-lite-tts'
          ? 'gemini-3.8-flash-lite-tts'
          : 'gemini-3.8-flash-tts';

      let audio: ReturnType<typeof extractWavAudio>;
      let usedModel = primaryModel;

      try {
        const response = await ai.models.generateContent({
          model: primaryModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: styleWithLanguage,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        audio = extractWavAudio(response);
      } catch (err: any) {
        console.warn(
          `Primary TTS (${primaryModel}) failed, attempting fallback to gemini-3.8-flash-lite-tts:`,
          err.message
        );
        // 대체 모델로 재시도
        if (primaryModel !== 'gemini-3.8-flash-lite-tts') {
          usedModel = 'gemini-3.8-flash-lite-tts';
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanText.replace(/<[^>]+>/g, ''), // 경량 모델에서는 발성 태그를 뺀다.
                    speechMetadata: {
                      style: styleWithLanguage,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          });
          audio = extractWavAudio(fallbackResponse);
        } else {
          throw err;
        }
      }

      if (!audio) {
        return res.status(502).json({
          error: '음성 생성 응답에 오디오 데이터가 포함되지 않았습니다.',
        });
      }

      res.json({
        audioBase64: audio.base64,
        mimeType: 'audio/wav',
        sourceMimeType: audio.sourceMimeType,
        voiceName,
        language,
        usedModel,
        text: cleanText,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error('Error generating speech dubbing:', error);
      res.status(500).json({
        error: error.message || '음성 더빙 생성 중 오류가 발생했습니다.',
      });
    }
  });

  return app;
}
