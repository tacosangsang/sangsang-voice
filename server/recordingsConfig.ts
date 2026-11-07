import { GitHubRecordingRepository } from './githubRecordingRepository';
import type { RecordingRepository } from './githubRecordingRepository';

// 생성한 음성 저장. GITHUB_TOKEN이 있으면 깃허브 브랜치에, 없으면 브라우저가 스스로 저장한다.
// 저장소·브랜치 값은 화면에 보이므로, 형식이 틀리면(토큰을 잘못 넣은 경우 등) 값을 되풀이하지 않고 칸 이름만 알린다.
const SECRET_LIKE = /^(github_pat_|gh[pousr]_)/;
export function recordingsConfig(env: Record<string, string | undefined>): { repo?: RecordingRepository; problem?: string } {
  const token = env.GITHUB_TOKEN;
  if (!token) return { problem: '서버에 GITHUB_TOKEN이 없습니다.' };
  const repo = env.GITHUB_RECORDINGS_REPO || 'tacosangsang/sangsang-voice';
  const branch = env.GITHUB_RECORDINGS_BRANCH || 'recordings';
  if (SECRET_LIKE.test(repo) || !/^[\w.-]+\/[\w.-]+$/.test(repo))
    return { problem: 'GITHUB_RECORDINGS_REPO 값이 저장소 이름(owner/name)이 아닙니다. 비워 두면 기본값을 씁니다.' };
  if (SECRET_LIKE.test(branch) || !/^[\w.\/-]+$/.test(branch))
    return { problem: 'GITHUB_RECORDINGS_BRANCH 값이 브랜치 이름이 아닙니다. 비워 두면 recordings를 씁니다.' };
  return { repo: new GitHubRecordingRepository(token, repo, branch) };
}
