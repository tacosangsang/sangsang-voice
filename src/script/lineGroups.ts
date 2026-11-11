// 한 번의 TTS 호출로 함께 뽑을 대본 줄 묶음.
// 규칙: 같은 씬에서 같은 화자가 컷 순서상 이어서, 같은 감정으로 말하는 줄만 묶는다.
// 다른 화자가 끼거나, 씬이나 감정(노션 "감정" 칸)이 바뀌면 끊는다. 감정이 비어 있는 줄은 묶지 않는다.
// 앞 줄이 말줄임표로 끝나거나 다음 줄이 말줄임표로 시작해 이어 읽힐 수 있으면 끊는다.
// 한 번에 읽히는 톤은 하나라서 감정이 다른 줄을 묶으면 줄마다 연기를 바꿀 수 없다.

import { ScriptLine, SpeakerId, lineText } from '../data/platingScript';
import { DialogueLanguage } from '../shared/language';

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
    const prev = last?.lines[last.lines.length - 1];
    const sameTake =
      !!prev && !!line.mood && prev.mood === line.mood && prev.speaker === line.speaker && sceneOf(prev) === sceneOf(line) &&
      !/(?:…|\.{3})$/.test(prev.text.trimEnd()) && !/^(?:…|\.{3})/.test(line.text.trimStart());
    if (sameTake) last.lines.push(line);
    else groups.push({ id: '', scene: sceneOf(line), speaker: line.speaker, lines: [line] });
  }
  for (const g of groups) g.id = `${g.lines[0].id}~${g.lines[g.lines.length - 1].id}`;
  return groups;
}

/** 묶음 생성 때 지시문 뒤에 붙인다. 줄 사이 쉼이 있어야 무음으로 자를 수 있다. */
const BATCH_INSTRUCTION =
  'These are separate lines read one after another. Leave a clear silence of about one second between lines.';

export interface BatchRequest {
  /** 줄마다 대사. 이 언어 대사가 없는 줄은 undefined */
  texts: (string | undefined)[];
  /** 묶음 전체에 쓰는 지시문(줄마다 연기 지시 포함). 잘라 저장한 클립도 이 지시문을 가진다. */
  stylePrompt: string;
}

export function batchRequest(group: ScriptLineGroup, stylePrompt: string, language: DialogueLanguage): BatchRequest {
  const directions = group.lines
    .map((l, i) => (l.direction ? `Line ${i + 1}: ${l.direction}` : ''))
    .filter(Boolean)
    .join(' ');
  return {
    texts: group.lines.map((l) => lineText(l, language)),
    stylePrompt: [stylePrompt.trim(), BATCH_INSTRUCTION, directions].filter(Boolean).join(' '),
  };
}
