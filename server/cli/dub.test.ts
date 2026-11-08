import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./dub.ts', import.meta.url));

function run(args: string[], environment: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', entry,
    '--voice', 'Kore', '--speaker', 'anchor', '--scene', 'S#01', '--dry-run',
    '--out', fileURLToPath(new URL('./dub.test.no-out', import.meta.url)), ...args], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8', timeout: 15_000, windowsHide: true,
    env: { ...process.env, GEMINI_API_KEY: '', NOTION_TOKEN: '', NOTION_SCRIPT_PAGE_ID: '',
      GITHUB_TOKEN: '', GITHUB_RECORDINGS_REPO: '', GITHUB_RECORDINGS_BRANCH: '',
      DOTENV_CONFIG_PATH: fileURLToPath(new URL('./dub.test.no-env', import.meta.url)), ...environment },
  });
  assert.ifError(result.error);
  return result;
}

test('실제 CLI의 dry-run 첫 줄은 토큰 미설정 이유이고 종료 코드는 0이다', () => {
  const result = run([]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout.split(/\r?\n/)[0], '깃허브 저장 꺼짐: 서버에 GITHUB_TOKEN이 없습니다.');
  assert.match(result.stdout, /S01\/S01-C001-앵커-Kore-v1\.wav.*생성 예정/);
});

test('실제 CLI의 --no-upload는 꺼진 이유를 첫 줄에 표시한다', () => {
  const result = run(['--no-upload']);
  assert.equal(result.status, 0);
  assert.match(result.stdout.split(/\r?\n/)[0], /^깃허브 저장 꺼짐: --no-upload/);
  assert.equal(result.stderr, '');
});

test('실제 CLI는 GITHUB_TOKEN과 같은 문자열이 표에 있어도 숨긴다', () => {
  const result = run(['--no-upload'], { GITHUB_TOKEN: 'Kore' });
  assert.equal(result.status, 0);
  assert.equal((result.stdout + result.stderr).includes('Kore'), false);
  assert.match(result.stdout, /\[설정값 숨김\]/);
});

test('실제 CLI는 저장소 설정이 잘못되면 problem을 표시하고 값은 출력하지 않는다', () => {
  const result = run([], { GITHUB_TOKEN: '가짜-토큰', GITHUB_RECORDINGS_REPO: 'ghp_fake_value' });
  assert.equal(result.status, 0);
  assert.match(result.stdout.split(/\r?\n/)[0], /깃허브 저장 꺼짐: GITHUB_RECORDINGS_REPO 값이/);
  assert.equal((result.stdout + result.stderr).includes('ghp_fake_value'), false);
  assert.equal((result.stdout + result.stderr).includes('가짜-토큰'), false);
});
