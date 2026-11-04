// 대본을 어디서 읽는지(노션, 저장소 사본)와 상관없이 화면과 서버가 같은 모양을 쓴다.
// 새 출처를 붙이려면 ScriptSource를 구현한다.

import type { ScriptLine, Speaker } from '../data/platingScript';

export type ScriptOrigin = 'notion' | 'bundled';

export interface ScriptSnapshot {
  origin: ScriptOrigin;
  speakers: Speaker[];
  lines: ScriptLine[];
  /** 읽은 시각(ms) */
  loadedAt: number;
  /** 읽다가 걸린 것(모르는 화자, 빠진 칸, 노션 실패로 사본을 쓴 이유 등) */
  warnings: string[];
}

export interface ScriptSource {
  readonly origin: ScriptOrigin;
  load(): Promise<ScriptSnapshot>;
}
