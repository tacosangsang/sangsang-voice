// 목소리 비교에서 만든 음성을 메인 생성 클립(DubbingItem)으로 만든다.
// 같은 조건(화자·목소리·대본 줄·지시문·언어)은 같은 키를 갖는다. 다시 생성하면 새 버전으로 따로 남고, 화면은 가장 최근 것을 쓴다.

import { DubbingItem } from '../types';
import { DialogueLanguage, toLanguage } from '../shared/language';
import { PLATING_SCRIPT, SPEAKERS, SpeakerId, findScriptLine, lineText } from './platingScript';

export interface AuditionTake {
  speaker: SpeakerId;
  voiceName: string;
  lineId: string;
  style: string;
  language: DialogueLanguage;
}

export function auditionKey(t: AuditionTake): string {
  return `${t.speaker}|${t.voiceName}|${t.lineId}|${t.style}|${t.language}`;
}

export function auditionClip(t: AuditionTake, text: string, audioUrl: string, createdAt: number): DubbingItem {
  const key = auditionKey(t);
  const speakerName = SPEAKERS.find((s) => s.id === t.speaker)?.name ?? t.speaker;
  return {
    id: `audition:${key}:${createdAt}`,
    auditionKey: key,
    presetName: `목소리 비교 · ${speakerName} ${t.voiceName}`,
    voiceName: t.voiceName,
    text,
    stylePrompt: t.style,
    scriptLineId: t.lineId,
    language: t.language,
    mimeType: 'audio/wav',
    audioUrl,
    createdAt,
  };
}

/** 예전 저장 형식(브라우저 IndexedDB "takes": 키와 data URL)을 클립으로 바꾼다. 대본 줄을 못 찾으면 버린다. */
export interface LegacyTake {
  key: string;
  url: string;
  createdAt: number;
}

export function clipFromLegacyTake(legacy: LegacyTake): DubbingItem | undefined {
  const parts = legacy.key.split('|');
  if (parts.length < 5) return undefined;
  const [speaker, voiceName, lineId] = parts;
  const language = toLanguage(parts[parts.length - 1]);
  const style = parts.slice(3, -1).join('|');
  const line = findScriptLine(PLATING_SCRIPT, lineId);
  const text = line && lineText(line, language);
  if (!text) return undefined;
  // 예전 형식은 id에 만든 시각이 없었다. 이미 옮긴 것과 겹치지 않게 그 id를 그대로 쓴다.
  return { ...auditionClip({ speaker, voiceName, lineId, style, language }, text, legacy.url, legacy.createdAt), id: `audition:${legacy.key}` };
}
