// 화자별 목소리 후보. 사용자가 목소리 비교 화면에서 들어 보고 하나를 고르면, 그 목소리와 baseStyle이 화자 프리셋이 된다.
// 후보 성격 설명은 Google 문서의 표기(https://ai.google.dev/gemini-api/docs/speech-generation)다. 문서에 성별 표기는 없다.

import { SpeakerId } from './platingScript';

export interface VoiceCandidate {
  voiceName: string;
  /** Google 문서의 성격 한 단어 */
  trait: string;
}

export interface SpeakerAudition {
  speaker: SpeakerId;
  /** 화자 공통 연기 지시문(영어). 확정되면 프리셋 지시문이 된다. 언어 지시는 서버가 붙인다. */
  baseStyle: string;
  candidates: VoiceCandidate[];
}

export const SPEAKER_AUDITIONS: SpeakerAudition[] = [
  {
    speaker: 'anchor',
    baseStyle: 'Polished state TV newscaster. Polite formal speech, steady even pace, emotionally neutral, quietly propagandistic.',
    candidates: [
      { voiceName: 'Charon', trait: 'Informative' },
      { voiceName: 'Rasalgethi', trait: 'Informative' },
      { voiceName: 'Erinome', trait: 'Clear' },
    ],
  },
  {
    speaker: 'rabbit',
    baseStyle: 'Masked servant of the elite. Low, polite and very calm, almost no rise and fall in pitch, unreadable.',
    candidates: [
      { voiceName: 'Schedar', trait: 'Even' },
      { voiceName: 'Algieba', trait: 'Smooth' },
      { voiceName: 'Enceladus', trait: 'Breathy' },
    ],
  },
  {
    speaker: 'purist-peacock',
    baseStyle: 'Leader of a vain aristocratic faction. Proud, arrogant and theatrical, old-fashioned authoritative speech.',
    candidates: [
      { voiceName: 'Gacrux', trait: 'Mature' },
      { voiceName: 'Pulcherrima', trait: 'Forward' },
      { voiceName: 'Alnilam', trait: 'Firm' },
    ],
  },
  {
    speaker: 'preserver-eagle',
    baseStyle: 'Leader of a rival aristocratic faction. Heavy, calm and firm, older-sounding, dismissive.',
    candidates: [
      { voiceName: 'Algenib', trait: 'Gravelly' },
      { voiceName: 'Orus', trait: 'Firm' },
      { voiceName: 'Kore', trait: 'Firm' },
    ],
  },
  {
    speaker: 'flamingo',
    baseStyle: 'Bored aristocrat in a private back room. Casual, condescending and amused, informal speech.',
    candidates: [
      { voiceName: 'Zubenelgenubi', trait: 'Casual' },
      { voiceName: 'Callirrhoe', trait: 'Easy-going' },
      { voiceName: 'Umbriel', trait: 'Easy-going' },
    ],
  },
  {
    speaker: 'backroom-voice',
    baseStyle: 'An unseen aristocrat behind a door, murmuring to themselves with quiet amusement.',
    candidates: [
      { voiceName: 'Despina', trait: 'Smooth' },
      { voiceName: 'Achernar', trait: 'Soft' },
      { voiceName: 'Enceladus', trait: 'Breathy' },
    ],
  },
  {
    speaker: 'jinwoo',
    baseStyle: 'A worn-out food-truck cook from the lower district. Low, quiet and restrained, warm underneath.',
    candidates: [
      { voiceName: 'Achird', trait: 'Friendly' },
      { voiceName: 'Sulafat', trait: 'Warm' },
      { voiceName: 'Leda', trait: 'Youthful' },
    ],
  },
];
