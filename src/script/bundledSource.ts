// 저장소에 들어 있는 대본 사본을 읽는다. 노션을 못 읽을 때 쓴다.

import { PLATING_SCRIPT, SPEAKERS } from '../data/platingScript';
import { ScriptSnapshot, ScriptSource } from './source';

export class BundledScriptSource implements ScriptSource {
  readonly origin = 'bundled' as const;

  async load(): Promise<ScriptSnapshot> {
    return {
      origin: this.origin,
      speakers: SPEAKERS,
      lines: PLATING_SCRIPT,
      loadedAt: Date.now(),
      warnings: [],
    };
  }
}
