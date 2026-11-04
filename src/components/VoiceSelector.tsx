import React from 'react';
import { DubbingPreset } from '../types';
import { Play, Sparkles, Check, Mic2, Flame } from 'lucide-react';

interface VoiceSelectorProps {
  presets: DubbingPreset[];
  activePresetId: string;
  isLoading: boolean;
  onSelectPreset: (preset: DubbingPreset) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  presets,
  activePresetId,
  isLoading,
  onSelectPreset,
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

          return (
            <div
              key={preset.id}
              onClick={() => !isLoading && onSelectPreset(preset)}
              className={`group relative flex flex-col justify-between p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
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

                <button
                  disabled={isLoading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-neutral-800 text-neutral-300 group-hover:bg-neutral-700 group-hover:text-white'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>듣기</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
