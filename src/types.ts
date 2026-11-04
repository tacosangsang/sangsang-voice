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
  language?: DialogueLanguage;
  createdAt: number;
}

export interface AudioFilterSettings {
  reverb: number; // 0 to 1
  roomTone: boolean;
  darkDrone: boolean;
  playbackRate: number; // 0.8 to 1.3
}
