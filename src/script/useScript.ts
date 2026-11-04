// 화면에서 대본을 서버(/api/script)로 받아 온다. 받기 전과 실패했을 때는 저장소 사본을 보여 준다.

import { useCallback, useEffect, useState } from 'react';
import { PLATING_SCRIPT, SPEAKERS } from '../data/platingScript';
import { ScriptSnapshot } from './source';

const INITIAL: ScriptSnapshot = {
  origin: 'bundled',
  speakers: SPEAKERS,
  lines: PLATING_SCRIPT,
  loadedAt: 0,
  warnings: [],
};

export function useScript() {
  const [script, setScript] = useState<ScriptSnapshot>(INITIAL);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/script');
      if (!res.ok) throw new Error(`대본 요청 실패 (${res.status})`);
      setScript((await res.json()) as ScriptSnapshot);
    } catch (err: any) {
      setScript({ ...INITIAL, loadedAt: Date.now(), warnings: [err.message || '대본을 받지 못했습니다.'] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { script, isLoading, reload };
}
