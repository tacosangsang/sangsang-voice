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
  audioBase64: string;
  mimeType: string;
  audioUrl: string;
  duration?: number;
  createdAt: number;
}

export interface AudioFilterSettings {
  reverb: number; // 0 to 1
  roomTone: boolean;
  darkDrone: boolean;
  playbackRate: number; // 0.8 to 1.3
}
