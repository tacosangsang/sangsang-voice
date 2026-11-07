import type { GoogleGenAI } from '@google/genai';
import { isWavMime, parsePcmMime, wrapPcm16AsWav } from '../src/shared/wav';
import { LANGUAGES } from '../src/shared/language';
import type { DialogueLanguage } from '../src/shared/language';

export type GeminiClient = {
  readonly models: Pick<GoogleGenAI['models'], 'generateContent'>;
};

export interface DubbingRequest {
  text: string;
  voiceName: string;
  stylePrompt: string;
  language: DialogueLanguage;
  modelPreference?: string;
}

export interface DubbingResult {
  wavBase64: string;
  sourceMimeType: string;
  usedModel: string;
  text: string;
  styleWithLanguage: string;
}

export class NoAudioError extends Error {
  readonly name = 'NoAudioError';

  constructor() {
    super('음성 생성 응답에 오디오 데이터가 포함되지 않았습니다.');
  }
}

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

export async function generateDubbing(ai: GeminiClient, request: DubbingRequest): Promise<DubbingResult> {
  const { text, voiceName, stylePrompt, language, modelPreference } = request;
  // 언어 지시는 서버 한 곳에서만 붙인다. 프리셋 지시문에는 언어를 적지 않는다.
  const styleWithLanguage = `${stylePrompt.trim()} ${LANGUAGES[language].ttsInstruction}`;
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
              text,
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
  } catch (err) {
    console.warn(
      `Primary TTS (${primaryModel}) failed, attempting fallback to gemini-3.8-flash-lite-tts:`,
      typeof err === 'object' && err !== null && 'message' in err ? err.message : undefined
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
                text: text.replace(/<[^>]+>/g, ''), // 경량 모델에서는 발성 태그를 뺀다.
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

  if (!audio) throw new NoAudioError();

  return {
    wavBase64: audio.base64,
    sourceMimeType: audio.sourceMimeType,
    usedModel,
    text,
    styleWithLanguage,
  };
}
