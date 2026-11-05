import { DialogueLanguage } from './shared/language';

export interface SceneItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  defaultSpeaker: string;
  defaultQuote: string;
  characterTagLeft?: string;
  characterTagRight?: string;
  redEyeGlowPosition?: { top: string; right?: string; left?: string };
  directorsNote: string;
  isCustom?: boolean;
  createdAt?: number;
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

export interface DubbingItem {
  id: string;
  presetId?: string;
  presetName: string;
  voiceName: string;
  text: string;
  stylePrompt: string;
  mimeType: string;
  audioUrl: string;
  duration?: number;
  /** PLATING 대본 줄(컷 번호). 컷 길이 비교와 파일 이름에 쓴다. */
  scriptLineId?: string;
  /** 목소리 비교로 만든 음성의 생성 조건 키. 같은 조건이면 다시 부르지 않고 이 음성을 쓴다. */
  auditionKey?: string;
  language?: DialogueLanguage;
  createdAt: number;
}

export interface AudioFilterSettings {
  reverb: number; // 0 to 1
  roomTone: boolean;
  darkDrone: boolean;
  playbackRate: number; // 0.8 to 1.3
}
