import type { RecordingMeta, RecordingStatus } from '../../src/shared/recording';
import type { DubbingItem } from '../../src/types';
import type { RecordingRepository } from '../githubRecordingRepository';

type PreparedRecordings = {
  readonly repository?: RecordingRepository;
  readonly status: RecordingStatus;
  readonly names: readonly string[];
  readonly warnings: readonly string[];
};

/** 실행마다 한 번 확인하고 기존 이름을 읽는다. 준비 실패는 로컬 생성을 막지 않는다. */
export async function prepareRecordings(
  repository: RecordingRepository | undefined, noUpload: boolean, problem?: string,
): Promise<PreparedRecordings> {
  const warnings: string[] = [];
  const status: RecordingStatus = { enabled: false,
    reason: noUpload ? '--no-upload 옵션으로 껐습니다.' : problem ?? '깃허브 저장소가 설정되지 않았습니다.' };
  if (!repository || noUpload) return { repository: undefined, status, names: [], warnings };
  try {
    await repository.verify();
    const records = await repository.list('clips');
    const names = records.map((meta) => meta.name ?? meta.fields.recordName)
      .filter((name): name is string => typeof name === 'string');
    return { repository, status: { enabled: true, target: repository.target }, names, warnings };
  } catch (error) {
    const reason = `깃허브 저장 준비 실패: ${error instanceof Error ? error.message : '알 수 없는 저장소 오류'}`;
    warnings.push(reason);
    return { repository: undefined, status: { enabled: false, reason }, names: [], warnings };
  }
}

/** ServerRecordStore.put과 같은 meta를 만든다. 업로드 실패로 로컬 저장 성공을 되돌리지 않는다. */
export async function uploadClip(
  repository: RecordingRepository | undefined, fields: Omit<DubbingItem, 'audioUrl'>,
  bytes: Uint8Array, warnings: string[],
): Promise<boolean> {
  if (!repository) return false;
  const meta: RecordingMeta = {
    id: fields.id, createdAt: fields.createdAt, mimeType: 'audio/wav', name: fields.recordName, fields,
  };
  try {
    await repository.save('clips', meta, Buffer.from(bytes));
    return false;
  } catch (error) {
    warnings.push(`${fields.recordName}: 깃허브 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 업로드 오류'}`);
    return true;
  }
}
