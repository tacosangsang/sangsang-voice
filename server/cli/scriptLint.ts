import 'dotenv/config';
import { BundledScriptSource } from '../../src/script/bundledSource';
import type { ScriptSource } from '../../src/script/source';
import { DEFAULT_SCRIPT_PAGE_ID, NotionScriptSource } from '../notionScriptSource';
import { CliArgumentError } from './dubArgs';
import { parseScriptLintArgs } from './scriptLintArgs';
import { formatScriptLint, lintScript } from './scriptLintRules';

// dub CLI와 같은 방식으로 외부 API 오류와 대본 출력에서 설정 값을 숨긴다.
const configuredValues = [process.env.GEMINI_API_KEY, process.env.NOTION_TOKEN, process.env.NOTION_SCRIPT_PAGE_ID]
  .filter((value): value is string => Boolean(value));
const redact = (message: string) => configuredValues.reduce((text, value) =>
  text.replaceAll(value, '[설정값 숨김]'), message);

try {
  const options = parseScriptLintArgs(process.argv.slice(2));
  let source: ScriptSource = new BundledScriptSource();
  if (options.source === 'notion') {
    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) throw new CliArgumentError('노션 출처에는 NOTION_TOKEN 환경 변수가 필요합니다.');
    source = new NotionScriptSource(notionToken, process.env.NOTION_SCRIPT_PAGE_ID || DEFAULT_SCRIPT_PAGE_ID);
  }
  const report = lintScript(await source.load(), options);
  console.log(formatScriptLint(report, options, redact));
  process.exitCode = report.exitCode;
} catch (error) {
  console.error(redact(`오류: ${error instanceof Error ? error.message : '알 수 없는 실행 오류'}`));
  process.exitCode = error instanceof CliArgumentError ? 1 : 2;
}
