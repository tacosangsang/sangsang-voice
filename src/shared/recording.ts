// 서버·브라우저가 함께 쓰는 녹음 저장 약속.

/** 저장소 이름. 목소리 비교 테이크(takes)와 메인 생성 클립(clips). */
export const RECORDING_STORES = ['takes', 'clips'] as const;
export type RecordingStoreName = (typeof RECORDING_STORES)[number];

export function isRecordingStore(name: string): name is RecordingStoreName {
  return (RECORDING_STORES as readonly string[]).includes(name);
}

/** 음성 파일 하나의 설명. 음성 자체는 따로 저장하고 여기에는 넣지 않는다. */
export interface RecordingMeta {
  id: string;
  createdAt: number;
  mimeType: string;
  /** 저장소별 나머지 칸(대사, 목소리 등) */
  fields: Record<string, unknown>;
}

export interface RecordingStatus {
  /** false면 서버 저장소가 없어 브라우저에만 저장한다. */
  enabled: boolean;
  /** 사람에게 보여 줄 저장 위치, 예: owner/repo@recordings */
  target?: string;
}

export function recordingAudioUrl(store: RecordingStoreName, id: string): string {
  return `/api/recordings/${store}/${encodeURIComponent(id)}/audio`;
}
