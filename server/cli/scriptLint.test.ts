import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./scriptLint.ts', import.meta.url));
const directory = fileURLToPath(new URL('../../', import.meta.url));

function run(args: string[], environment: NodeJS.ProcessEnv = {}, preload = '') {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx',
    ...(preload ? ['--import', `data:text/javascript,${encodeURIComponent(preload)}`] : []),
    entry, ...args,
  ], {
    cwd: directory, encoding: 'utf8', timeout: 15_000, windowsHide: true,
    env: {
      ...process.env, GEMINI_API_KEY: '', NOTION_TOKEN: '', NOTION_SCRIPT_PAGE_ID: '',
      DOTENV_CONFIG_PATH: fileURLToPath(new URL('./scriptLint.test.no-env', import.meta.url)),
      ...environment,
    },
  });
  assert.ifError(result.error);
  return result;
}

test('실제 CLI는 키 없이 사본 21줄을 JSON으로 점검한다', () => {
  const result = run(['--json', '--all']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(output), ['lines', 'warnings', 'summary']);
  assert.equal(output.summary.lineCount, 21);
  assert.equal(output.lines.length, 21);
});

test('실제 CLI의 JSON에서도 설정 값을 숨긴다', () => {
  const result = run(['--json', '--all'], { GEMINI_API_KEY: '앵커' });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.ok(output.lines.some((line: { speaker: string }) => line.speaker === '[설정값 숨김]'));
  assert.ok(!result.stdout.includes('앵커'));
});

for (const args of [['--unknown'], ['--lang', 'ja']]) {
  test(`실제 CLI의 인자 오류는 종료 코드 1이다: ${JSON.stringify(args)}`, () => {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^오류:/);
  });
}

test('노션 토큰 미설정은 8차와 같이 인자 오류 1이다', () => {
  const result = run(['--source', 'notion']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NOTION_TOKEN/);
});

test('노션 읽기 실패는 종료 코드 2이며 환경 변수 값은 출력하지 않는다', () => {
  const environment = {
    GEMINI_API_KEY: '가짜Gemini비밀', NOTION_TOKEN: '가짜Notion비밀"\n값', NOTION_SCRIPT_PAGE_ID: '가짜페이지비밀',
  };
  const result = run(['--source', 'notion'], environment, `
    globalThis.fetch = async () => {
      throw new Error([process.env.GEMINI_API_KEY, process.env.NOTION_TOKEN, process.env.NOTION_SCRIPT_PAGE_ID].join(' '));
    };
  `);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  for (const value of Object.values(environment)) assert.ok(!result.stderr.includes(value));
  assert.match(result.stderr, /\[설정값 숨김\]/);
});
