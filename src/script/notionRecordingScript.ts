// 노션 컷표 페이지의 "녹음 대본 (인물별 대사)" 섹션을 대본 줄로 바꾼다.
// 섹션 모양: 제목(heading) 아래에 "굵은 글씨 한 줄 = 화자 이름" 다음 표가 온다.
// 표 머리 줄의 칸 이름(컷, TC, 길이, 대사, 상황, 영어 대사, TTS 대사, 연기 지시)으로 칸을 찾으므로 칸 순서가 바뀌어도 된다.
// 이 파일은 노션 응답 모양만 알고 네트워크는 모른다(서버의 NotionScriptSource가 블록을 가져온다).

import { SPEAKERS, ScriptLine, Speaker, ttsTextMatches } from '../data/platingScript';

export const RECORDING_SECTION_TITLE = '녹음 대본';

/** 노션 API 블록 중 여기서 읽는 부분만 적은 모양 */
export interface NotionRichText {
  plain_text: string;
  annotations?: { bold?: boolean };
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  paragraph?: { rich_text: NotionRichText[] };
  table?: { has_column_header?: boolean };
  table_row?: { cells: NotionRichText[][] };
  /** 표 블록이면 서버가 가져온 행을 여기에 채운다 */
  children?: NotionBlock[];
}

const HEADING_TYPES = ['heading_1', 'heading_2', 'heading_3'] as const;

type Column = 'cut' | 'tc' | 'length' | 'text' | 'textEn' | 'situation' | 'ttsText' | 'direction';

const COLUMN_NAMES: Record<Column, string[]> = {
  cut: ['컷'],
  tc: ['TC'],
  length: ['길이'],
  text: ['대사'],
  textEn: ['영어 대사', '영어', 'English'],
  situation: ['상황'],
  ttsText: ['TTS 대사'],
  direction: ['연기 지시'],
};

function plain(rich: NotionRichText[] | undefined): string {
  return (rich ?? []).map((r) => r.plain_text).join('').trim();
}

function headingText(block: NotionBlock): string | undefined {
  for (const type of HEADING_TYPES) {
    if (block.type === type) return plain(block[type]?.rich_text);
  }
  return undefined;
}

/** 문단 전체가 굵은 글씨면 그 글을 돌려준다(화자 이름 줄). */
function boldLabel(block: NotionBlock): string | undefined {
  const rich = block.type === 'paragraph' ? block.paragraph?.rich_text : undefined;
  if (!rich || rich.length === 0) return undefined;
  const allBold = rich.every((r) => r.annotations?.bold || r.plain_text.trim() === '');
  const text = plain(rich);
  return allBold && text ? text : undefined;
}

/** 표 블록 중 섹션 안에 있는 것. 서버는 이 표들의 행만 더 가져오면 된다. */
export function findSectionTables(pageBlocks: NotionBlock[]): NotionBlock[] {
  return sectionBlocks(pageBlocks).filter((b) => b.type === 'table');
}

function sectionBlocks(pageBlocks: NotionBlock[]): NotionBlock[] {
  const start = pageBlocks.findIndex((b) => headingText(b)?.includes(RECORDING_SECTION_TITLE));
  if (start < 0) return [];
  const rest = pageBlocks.slice(start + 1);
  const end = rest.findIndex((b) => headingText(b) !== undefined);
  return end < 0 ? rest : rest.slice(0, end);
}

function parseSeconds(value: string): number | undefined {
  const m = value.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

function speakerFor(name: string, known: Speaker[]): Speaker {
  return known.find((s) => s.name === name) ?? { id: `notion:${name}`, name };
}

export interface ParsedRecordingScript {
  speakers: Speaker[];
  lines: ScriptLine[];
  warnings: string[];
}

/** 섹션 안 블록(표는 children에 행이 채워진 상태)을 대본 줄로 바꾼다. */
export function parseRecordingScript(pageBlocks: NotionBlock[]): ParsedRecordingScript {
  const blocks = sectionBlocks(pageBlocks);
  const warnings: string[] = [];
  if (blocks.length === 0) {
    return { speakers: [], lines: [], warnings: [`노션 페이지에서 "${RECORDING_SECTION_TITLE}" 제목을 찾지 못했습니다.`] };
  }

  const speakers: Speaker[] = [];
  const lines: ScriptLine[] = [];
  const seenIds = new Set<string>();
  let label: string | undefined;

  for (const block of blocks) {
    const bold = boldLabel(block);
    if (bold) {
      label = bold;
      continue;
    }
    if (block.type !== 'table') continue;
    if (!label) {
      warnings.push('화자 이름(굵은 글씨) 없이 시작하는 표가 있어 건너뛰었습니다.');
      continue;
    }

    const rows = (block.children ?? []).map((r) => (r.table_row?.cells ?? []).map((c) => plain(c)));
    const [header, ...body] = rows;
    if (!header) continue;
    const col = (key: Column) => header.findIndex((h) => COLUMN_NAMES[key].includes(h));
    const idx = Object.fromEntries(
      (Object.keys(COLUMN_NAMES) as Column[]).map((k) => [k, col(k)]),
    ) as Record<Column, number>;
    if (idx.cut < 0 || idx.text < 0) {
      warnings.push(`"${label}" 표에 컷 또는 대사 칸이 없어 건너뛰었습니다.`);
      continue;
    }

    const speaker = speakerFor(label, SPEAKERS);
    if (!SPEAKERS.some((s) => s.id === speaker.id)) {
      warnings.push(`새 화자 "${label}"이(가) 노션에 있습니다. 프리셋이 없으니 직접 고르세요.`);
    }
    if (!speakers.some((s) => s.id === speaker.id)) speakers.push(speaker);

    for (const row of body) {
      const cell = (key: Column) => (idx[key] >= 0 ? row[idx[key]] ?? '' : '');
      const cut = cell('cut');
      const text = cell('text');
      if (!cut || !text) continue;
      const cutSeconds = parseSeconds(cell('length'));
      if (cutSeconds === undefined) warnings.push(`${cut}: 길이 칸을 읽지 못했습니다.`);

      let id = cut;
      for (let n = 2; seenIds.has(id); n++) id = `${cut}#${n}`;
      if (id !== cut) warnings.push(`${cut}: 같은 컷 번호가 두 번 있어 ${id}로 구분했습니다.`);
      seenIds.add(id);

      let ttsText = cell('ttsText') || undefined;
      if (ttsText && !ttsTextMatches(text, ttsText)) {
        warnings.push(`${cut}: TTS 대사가 원래 대사와 달라 쓰지 않았습니다. 태그만 넣어야 합니다.`);
        ttsText = undefined;
      }

      lines.push({
        id,
        cut,
        tc: cell('tc'),
        cutSeconds: cutSeconds ?? 0,
        speaker: speaker.id,
        text,
        textEn: cell('textEn') || undefined,
        situation: cell('situation'),
        ttsText,
        direction: cell('direction') || undefined,
      });
    }
  }

  if (lines.length === 0) warnings.push('섹션은 찾았지만 대사 줄이 하나도 없습니다.');
  return { speakers, lines, warnings };
}
