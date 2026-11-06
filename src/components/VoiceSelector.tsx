import React from 'react';
import { DubbingItem, DubbingPreset } from '../types';
import { Play, Check, Mic2, Wand2 } from 'lucide-react';

interface VoiceSelectorProps {
  presets: DubbingPreset[];
  activePresetId: string;
  isLoading: boolean;
  /** 이 프리셋 조건으로 이미 만든 음성. 있으면 "듣기"가 호출 없이 재생한다. */
  findClip: (preset: DubbingPreset) => DubbingItem | undefined;
  onPlay: (clip: DubbingItem) => void;
  /** TTS 호출 1회 */
  onGenerate: (preset: DubbingPreset) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  presets,
  activePresetId,
  isLoading,
  findClip,
  onPlay,
  onGenerate,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-red-500" />
            캐릭터 보이스 스타일 (Voice Personas)
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            토끼 가면의 은밀하고 서늘한 분위기를 각기 다른 연기 톤으로 해석한 더빙 프리셋입니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const clip = findClip(preset);

          return (
            <div
              key={preset.id}
              className={`group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-300 ${
                isActive
                  ? 'bg-neutral-900 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.2)] ring-1 ring-red-500/50'
                  : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      isActive
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {preset.badge}
                  </span>
                  {isActive ? (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-red-400">
                      <Check className="w-3.5 h-3.5" />
                      <span>재생 중</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-500 font-mono">
                      Voice: {preset.voiceName}
                    </span>
                  )}
                </div>

                <h4
                  className={`text-sm font-bold transition-colors ${
                    isActive ? 'text-white' : 'text-neutral-200 group-hover:text-white'
                  }`}
                >
                  {preset.name}
                </h4>

                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-neutral-500">
                  {preset.formattedText.includes('<breath>') && '호흡 연출 (<breath>)'}
                  {preset.formattedText.includes('<laugh>') && '실소 연출 (<laugh>)'}
                  {!preset.formattedText.includes('<breath>') && !preset.formattedText.includes('<laugh>') && '정갈한 독백'}
                </span>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => clip && onPlay(clip)}
                    disabled={!clip}
                    title={clip ? '저장된 음성 재생 (호출 없음)' : '아직 생성하지 않았습니다'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>듣기</span>
                  </button>
                  <button
                    onClick={() => onGenerate(preset)}
                    disabled={isLoading}
                    title="TTS 호출 1회"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>{clip ? '다시 생성' : '생성'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
