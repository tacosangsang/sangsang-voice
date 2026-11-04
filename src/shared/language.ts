// 대사 언어. 서버(TTS 지시문)와 화면(선택지·파일 이름)이 같은 정의를 쓴다.
// 언어를 늘리려면 여기에 항목만 더한다.

export type DialogueLanguage = 'ko' | 'en';

export interface LanguageInfo {
  id: DialogueLanguage;
  label: string;
  /** TTS 연기 지시문 끝에 붙는 언어 지시 */
  ttsInstruction: string;
}

export const LANGUAGES: Record<DialogueLanguage, LanguageInfo> = {
  ko: { id: 'ko', label: '한국어', ttsInstruction: 'Speak in Korean.' },
  en: { id: 'en', label: 'English', ttsInstruction: 'Speak in natural English.' },
};

export const DEFAULT_LANGUAGE: DialogueLanguage = 'ko';

export function toLanguage(value: unknown): DialogueLanguage {
  return typeof value === 'string' && value in LANGUAGES ? (value as DialogueLanguage) : DEFAULT_LANGUAGE;
}
