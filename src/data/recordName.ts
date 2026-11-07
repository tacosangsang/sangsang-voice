// 생성 음성의 저장 이름: <씬>/<컷>-<인물>-<프리셋>-v<버전> (확장자 없음).
// 깃허브 recordings 브랜치 경로(clips/<이 이름>.wav)와 내려받기 파일 이름이 같은 규칙을 쓴다.
// 버전은 같은 컷·인물·프리셋(·언어)으로 만든 음성 중 몇 번째인지다. 한 번 정하면 바꾸지 않는다.

import { DubbingItem } from '../types';
import { ScriptLine, Speaker, findScriptLine } from './platingScript';

/** 파일 이름에 못 쓰는 글자와 공백은 _ 로 바꾼다. */
function part(s: string): string {
  return s.replace(/[\\/:*?"<>|#%\s]+/g, '_').replace(/^_+|_+$/g, '') || '없음';
}

/** 대본 줄이 없는 음성(프리셋 시연, 자르기 실패 묶음 등)은 '기타' 폴더에 둔다. */
const UNSORTED = '기타';

/** 목소리 비교·한 줄·묶음 생성은 프리셋 없이 목소리를 고르므로 목소리 이름을 프리셋 자리에 쓴다. */
function presetLabel(clip: DubbingItem): string {
  return clip.presetId ? clip.presetName : clip.voiceName;
}

function baseName(clip: DubbingItem, lines: ScriptLine[], speakers: Speaker[]): string {
  const lang = clip.language === 'en' ? '-en' : '';
  const line = findScriptLine(lines, clip.scriptLineId);
  if (!line) return `${UNSORTED}/${UNSORTED}-${part(presetLabel(clip))}${lang}`;
  const cut = part(line.id.replace('#', '')); // S#01-C001 → S01-C001
  const scene = cut.split('-')[0];
  const speaker = speakers.find((s) => s.id === line.speaker)?.name ?? line.speaker.replace(/^notion:/, '');
  return `${scene}/${cut}-${part(speaker)}-${part(presetLabel(clip))}${lang}`;
}

/** existing 중 같은 이름의 가장 큰 버전 다음 번호를 붙인다. */
export function nextRecordName(
  clip: DubbingItem,
  lines: ScriptLine[],
  speakers: Speaker[],
  existing: DubbingItem[],
): string {
  const base = baseName(clip, lines, speakers);
  const prefix = `${base}-v`;
  const last = existing.reduce((max, c) => {
    if (!c.recordName?.startsWith(prefix)) return max;
    const v = Number(c.recordName.slice(prefix.length));
    return Number.isInteger(v) && v > max ? v : max;
  }, 0);
  return `${prefix}${last + 1}`;
}

/** 저장 이름의 파일 부분(폴더 빼고). 이름이 없는 예전 음성은 undefined. */
export function recordFileName(clip: DubbingItem): string | undefined {
  return clip.recordName?.split('/').pop();
}
