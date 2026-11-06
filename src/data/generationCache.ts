// 생성 조건(대사·목소리·지시문·언어)이 같은 음성은 다시 부르지 않고 저장된 것을 쓴다.
// 조건은 DubbingItem에 이미 다 들어 있어 키를 따로 저장하지 않고 그때그때 만든다.

import { DubbingItem } from '../types';
import { DEFAULT_LANGUAGE, DialogueLanguage } from '../shared/language';

export interface GenerationRequest {
  text: string;
  voiceName: string;
  stylePrompt: string;
  language?: DialogueLanguage;
}

export function generationKey(r: GenerationRequest): string {
  return [r.voiceName, r.language ?? DEFAULT_LANGUAGE, r.stylePrompt.trim(), r.text.trim()].join('|');
}

/** 같은 조건으로 만든 음성 중 가장 최근 것. clips는 최신순이다. */
export function findGenerated(clips: DubbingItem[], request: GenerationRequest): DubbingItem | undefined {
  const key = generationKey(request);
  return clips.find((c) => generationKey(c) === key);
}
