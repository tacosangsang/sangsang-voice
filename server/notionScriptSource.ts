// 노션 API로 컷표 페이지를 읽어 "녹음 대본" 섹션을 대본 줄로 만든다.
// 필요한 것: NOTION_TOKEN(통합 토큰), 컷표 페이지를 그 통합에 공유.

import { SPEAKERS } from '../src/data/platingScript';
import { NotionBlock, findSectionTables, parseRecordingScript } from '../src/script/notionRecordingScript';
import { ScriptSnapshot, ScriptSource } from '../src/script/source';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface BlockChildrenResponse {
  results: NotionBlock[];
  has_more: boolean;
  next_cursor: string | null;
}

export class NotionScriptSource implements ScriptSource {
  readonly origin = 'notion' as const;

  constructor(
    private readonly token: string,
    private readonly pageId: string,
  ) {}

  async load(): Promise<ScriptSnapshot> {
    const pageBlocks = await this.children(this.pageId);
    // 섹션 안 표의 행만 더 가져온다(페이지의 다른 컷표 표는 건드리지 않는다).
    for (const table of findSectionTables(pageBlocks)) {
      table.children = await this.children(table.id);
    }
    const parsed = parseRecordingScript(pageBlocks);
    if (parsed.lines.length === 0) {
      throw new Error(parsed.warnings.join(' ') || '노션에서 대사 줄을 읽지 못했습니다.');
    }
    // 대사가 없는 아는 화자도 목록에 남겨 프리셋 화면이 흔들리지 않게 한다.
    const speakers = [...parsed.speakers];
    for (const known of SPEAKERS) {
      if (!speakers.some((s) => s.id === known.id)) speakers.push(known);
    }
    return {
      origin: this.origin,
      speakers,
      lines: parsed.lines,
      loadedAt: Date.now(),
      warnings: parsed.warnings,
    };
  }

  private async children(blockId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let cursor: string | null = null;
    do {
      const url = new URL(`${NOTION_API}/blocks/${blockId}/children`);
      url.searchParams.set('page_size', '100');
      if (cursor) url.searchParams.set('start_cursor', cursor);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Notion-Version': NOTION_VERSION,
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`노션 API ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as BlockChildrenResponse;
      blocks.push(...data.results);
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);
    return blocks;
  }
}
