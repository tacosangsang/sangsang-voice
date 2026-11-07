// 저장된 음성 목록. 메인 화면에서 바로 보이고, 항목마다 호출 없이 다시 듣거나 WAV로 저장한다.

import React, { useMemo, useState } from 'react';
import { Download, History, Play, Search } from 'lucide-react';
import { DubbingItem } from '../types';
import { clipFileName, downloadUrl } from '../utils/download';
import { recordFileName } from '../data/recordName';

interface ClipLibraryProps {
  clips: DubbingItem[];
  currentClipId?: string;
  /** 저장 위치(깃허브 브랜치 또는 이 브라우저) */
  target?: string;
  onPlay: (clip: DubbingItem) => void;
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({ clips, currentClipId, target, onPlay }) => {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter((c) =>
      [c.recordName, c.scriptLineId, c.presetName, c.voiceName, c.text].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [clips, query]);

  return (
    <section className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <History className="w-4 h-4 text-neutral-400" />
          <span>저장된 음성 ({clips.length})</span>
          {target && <span className="text-xs font-normal text-neutral-500">· 저장 위치: {target}</span>}
        </div>
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300">
          <Search className="w-3.5 h-3.5 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="컷, 인물, 목소리, 대사로 찾기"
            className="bg-transparent outline-none w-40 placeholder-neutral-600"
          />
        </label>
      </div>
      <p className="text-[11px] text-neutral-500">듣기와 저장은 TTS를 다시 부르지 않습니다.</p>

      {shown.length === 0 ? (
        <p className="text-xs text-neutral-500 py-4 text-center">
          {clips.length === 0 ? '생성한 음성이 여기에 쌓입니다.' : '찾는 음성이 없습니다.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[28rem] overflow-y-auto pr-1">
          {shown.map((clip) => {
            const isCurrent = clip.id === currentClipId;
            return (
              <div
                key={clip.id}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  isCurrent ? 'bg-red-950/40 border-red-500/80 text-white' : 'bg-neutral-950 border-neutral-800/80 text-neutral-300'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {recordFileName(clip) ?? (
                      <>
                        {clip.scriptLineId && <span className="font-mono text-neutral-400 mr-1.5">{clip.scriptLineId}</span>}
                        {clip.presetName}
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">{clip.text}</div>
                  <div className="text-[10px] text-neutral-500 font-mono truncate">
                    {clip.voiceName} • {clip.language ?? 'ko'} •{' '}
                    {new Date(clip.createdAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onPlay(clip)}
                    title="듣기"
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg ${isCurrent ? 'bg-red-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'}`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    듣기
                  </button>
                  <button
                    onClick={() => downloadUrl(clip.audioUrl, clipFileName(clip, 'raw'))}
                    title="WAV로 저장"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                  >
                    <Download className="w-3 h-3" />
                    저장
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
