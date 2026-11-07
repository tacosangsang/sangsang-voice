// 음성 파일 내려받기. 이름은 저장 이름(recordName.ts)을 따르고, 이름이 없는 예전 음성만 컷_언어_목소리_만든시각.

import { DubbingItem } from '../types';
import { recordFileName } from '../data/recordName';

export function downloadUrl(href: string, name: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function clipFileName(clip: DubbingItem, suffix: 'raw' | 'fx'): string {
  const name = recordFileName(clip);
  if (name) return `${name}${suffix === 'fx' ? '_fx' : ''}.wav`;
  const cut = (clip.scriptLineId ?? 'dub').replace('#', '');
  return `${cut}_${clip.language ?? 'ko'}_${clip.voiceName}_${clip.createdAt}_${suffix}.wav`;
}
