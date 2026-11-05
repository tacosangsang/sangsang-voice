// 한 번의 TTS 호출로 함께 뽑을 대본 줄 묶음.
// 규칙: 같은 씬에서 같은 화자가 컷 순서상 이어서 말하는 줄만 묶는다(다른 화자가 끼면 끊는다).
// 그래야 한 흐름으로 읽어도 어색하지 않고, 줄마다 다른 상황이 섞이지 않는다.

import { ScriptLine, SpeakerId } from '../data/platingScript';

export interface ScriptLineGroup {
  /** 첫 줄과 끝 줄 id, 예: S#01-C001~S#01-C008 */
  id: string;
  scene: string;
  speaker: SpeakerId;
  lines: ScriptLine[];
}

function sceneOf(line: ScriptLine): string {
  return line.id.split('-')[0];
}

export function groupConsecutiveLines(lines: ScriptLine[]): ScriptLineGroup[] {
  // 노션 섹션은 화자별로 나뉘어 있어 컷 순서로 다시 줄 세운다.
  const ordered = [...lines].sort((a, b) => a.id.localeCompare(b.id));
  const groups: ScriptLineGroup[] = [];
  for (const line of ordered) {
    const last = groups[groups.length - 1];
    if (last && last.speaker === line.speaker && last.scene === sceneOf(line)) last.lines.push(line);
    else groups.push({ id: '', scene: sceneOf(line), speaker: line.speaker, lines: [line] });
  }
  for (const g of groups) g.id = `${g.lines[0].id}~${g.lines[g.lines.length - 1].id}`;
  return groups;
}
