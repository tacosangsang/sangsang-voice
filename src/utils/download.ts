// 음성 파일 내려받기와 파일 이름 규칙(컷_언어_목소리_만든시각).

import { DubbingItem } from '../types';

export function downloadUrl(href: string, name: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function clipFileName(clip: DubbingItem, suffix: 'raw' | 'fx'): string {
  const cut = (clip.scriptLineId ?? 'dub').replace('#', '');
  return `${cut}_${clip.language ?? 'ko'}_${clip.voiceName}_${clip.createdAt}_${suffix}.wav`;
}
