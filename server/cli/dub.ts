import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { BundledScriptSource } from '../../src/script/bundledSource';
import type { ScriptSource } from '../../src/script/source';
import { DEFAULT_SCRIPT_PAGE_ID, NotionScriptSource } from '../notionScriptSource';
import { CliArgumentError, parseDubArgs } from './dubArgs';
import { dubLines, formatDubTable } from './dubLines';
import { DirFileStore } from './fileStore';

// 외부 API 오류에 설정 값이 들어 있어도 터미널에는 노출하지 않는다.
const configuredValues = [process.env.GEMINI_API_KEY, process.env.NOTION_TOKEN, process.env.NOTION_SCRIPT_PAGE_ID]
  .filter((value): value is string => Boolean(value));
const redact = (message: string) => configuredValues.reduce((text, value) =>
  text.replaceAll(value, '[설정값 숨김]'), message);
const originalWarn = console.warn;
// 공유 TTS 함수의 서버 동작을 유지하며 CLI의 재시도 경고는 한국어로 출력한다.
console.warn = (...messages: unknown[]) => {
  const [first, ...rest] = messages;
  const message = typeof first === 'string' && first.startsWith('Primary TTS (')
    ? 'TTS 모델 요청에 실패했습니다. 경량 모델 재시도 여부를 확인합니다.' : String(first);
  console.error(redact(`경고: ${[message, ...rest.map(String)].join(' ')}`));
};

try {
  const options = parseDubArgs(process.argv.slice(2));
  const apiKey = process.env.GEMINI_API_KEY;
  const notionToken = process.env.NOTION_TOKEN;
  if (!options.dryRun && !apiKey) throw new CliArgumentError('GEMINI_API_KEY 환경 변수가 필요합니다.');
  let source: ScriptSource = new BundledScriptSource();
  if (options.source === 'notion') {
    if (!notionToken) throw new CliArgumentError('노션 출처에는 NOTION_TOKEN 환경 변수가 필요합니다.');
    source = new NotionScriptSource(notionToken, process.env.NOTION_SCRIPT_PAGE_ID || DEFAULT_SCRIPT_PAGE_ID);
  }
  const ai = options.dryRun ? undefined : new GoogleGenAI({
    apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
  const report = await dubLines(source, new DirFileStore(options.out), ai, options);
  for (const warning of report.warnings) console.error(redact(`경고: ${warning}`));
  console.log(redact(formatDubTable(report.rows)));
  process.exitCode = report.exitCode;
} catch (error) {
  console.error(redact(`오류: ${error instanceof Error ? error.message : '알 수 없는 실행 오류'}`));
  process.exitCode = error instanceof CliArgumentError ? 1 : 2;
} finally {
  console.warn = originalWarn;
}
