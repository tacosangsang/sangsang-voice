// 화자별 목소리 후보. 사용자가 목소리 비교 화면에서 들어 보고 하나를 고르면, 그 목소리와 baseStyle이 화자 프리셋이 된다.
// 목소리 성별과 성격은 Google Cloud Gemini-TTS 문서의 표(https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)와
// Gemini API 문서(https://ai.google.dev/gemini-api/docs/speech-generation)의 표기다.
// 규칙: 화자 성별에 맞는 목소리만 후보로 두고, 한 목소리는 한 화자만 쓴다(후보도 화자끼리 겹치지 않게 둔다).

import { SpeakerId } from './platingScript';

export type VoiceGender = 'female' | 'male';

export const GENDER_LABEL: Record<VoiceGender, string> = { female: '여', male: '남' };

export interface VoiceCandidate {
  voiceName: string;
  /** Google 문서의 성격 한 단어 */
  trait: string;
}

export interface SpeakerAudition {
  speaker: SpeakerId;
  /** 사용자가 정한 화자 성별. 후보는 모두 이 성별의 목소리다. */
  gender: VoiceGender;
  /** 화자 공통 연기 지시문(영어). 확정되면 프리셋 지시문이 된다. 언어 지시는 서버가 붙인다. */
  baseStyle: string;
  candidates: VoiceCandidate[];
}

export const SPEAKER_AUDITIONS: SpeakerAudition[] = [
  {
    speaker: 'anchor',
    gender: 'female',
    baseStyle: 'Polished state TV newscaster. Polite formal speech, steady even pace, emotionally neutral, quietly propagandistic.',
    candidates: [
      { voiceName: 'Erinome', trait: 'Clear' },
      { voiceName: 'Kore', trait: 'Firm' },
      { voiceName: 'Autonoe', trait: 'Bright' },
    ],
  },
  {
    speaker: 'rabbit',
    gender: 'male',
    baseStyle: 'Masked servant of the elite. Low, polite and very calm, almost no rise and fall in pitch, unreadable.',
    candidates: [
      { voiceName: 'Schedar', trait: 'Even' },
      { voiceName: 'Algieba', trait: 'Smooth' },
      { voiceName: 'Enceladus', trait: 'Breathy' },
    ],
  },
  {
    speaker: 'purist-peacock',
    gender: 'male',
    baseStyle: 'Leader of a vain aristocratic faction. Proud, arrogant and theatrical, old-fashioned authoritative speech.',
    candidates: [
      { voiceName: 'Alnilam', trait: 'Firm' },
      { voiceName: 'Charon', trait: 'Informative' },
      { voiceName: 'Sadaltager', trait: 'Knowledgeable' },
    ],
  },
  {
    speaker: 'preserver-eagle',
    gender: 'male',
    baseStyle: 'Leader of a rival aristocratic faction. Heavy, calm and firm, older-sounding, dismissive.',
    candidates: [
      { voiceName: 'Algenib', trait: 'Gravelly' },
      { voiceName: 'Orus', trait: 'Firm' },
      { voiceName: 'Iapetus', trait: 'Clear' },
    ],
  },
  {
    speaker: 'flamingo',
    gender: 'female',
    baseStyle: 'Bored aristocrat in a private back room. Casual, condescending and amused, informal speech.',
    candidates: [
      { voiceName: 'Callirrhoe', trait: 'Easy-going' },
      { voiceName: 'Pulcherrima', trait: 'Forward' },
      { voiceName: 'Laomedeia', trait: 'Upbeat' },
    ],
  },
  {
    speaker: 'backroom-voice',
    gender: 'female',
    baseStyle: 'An unseen aristocrat behind a door, murmuring to themselves with quiet amusement.',
    candidates: [
      { voiceName: 'Despina', trait: 'Smooth' },
      { voiceName: 'Achernar', trait: 'Soft' },
      { voiceName: 'Gacrux', trait: 'Mature' },
    ],
  },
  {
    speaker: 'jinwoo',
    gender: 'male',
    baseStyle: 'A worn-out food-truck cook from the lower district. Low, quiet and restrained, warm underneath.',
    candidates: [
      { voiceName: 'Achird', trait: 'Friendly' },
      { voiceName: 'Umbriel', trait: 'Easy-going' },
      { voiceName: 'Zubenelgenubi', trait: 'Casual' },
    ],
  },
];

/** 이 목소리를 이미 확정한 다른 화자. 없으면 undefined. 한 목소리는 한 화자만 쓴다. */
export function voiceOwner(
  choices: Partial<Record<SpeakerId, { voiceName: string }>>,
  voiceName: string,
  exceptSpeaker: SpeakerId,
): SpeakerId | undefined {
  return (Object.keys(choices) as SpeakerId[]).find(
    (id) => id !== exceptSpeaker && choices[id]?.voiceName === voiceName,
  );
}
