import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Download, Sliders, Volume2, Sparkles, Mic, Layers } from 'lucide-react';
import { DubbingItem } from '../types';
import { ScriptLine, checkFit, findScriptLine } from '../data/platingScript';
import { effectsFromSettings, renderWithEffects } from '../audio/offlineRender';
import { clipFileName, downloadUrl } from '../utils/download';

interface AudioPlayerBarProps {
  currentClip: DubbingItem | null;
  /** 컷 길이 비교에 쓰는 지금 대본 */
  scriptLines: ScriptLine[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  reverbAmount: number;
  playbackRate: number;
  atmosphereDrone: boolean;
  isLoading: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onReplay: () => void;
  onChangeReverb: (val: number) => void;
  onChangeRate: (rate: number) => void;
  onToggleDrone: () => void;
  onOpenCustomStudio: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentClip,
  scriptLines,
  isPlaying,
  currentTime,
  duration,
  reverbAmount,
  playbackRate,
  atmosphereDrone,
  isLoading,
  onPlayPause,
  onSeek,
  onReplay,
  onChangeReverb,
  onChangeRate,
  onToggleDrone,
  onOpenCustomStudio,
}) => {
  const [showEffects, setShowEffects] = useState(false);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const [isExporting, setIsExporting] = useState(false);
  const scriptLine = findScriptLine(scriptLines, currentClip?.scriptLineId);
  const fit = scriptLine && duration > 0 ? checkFit(scriptLine, duration / playbackRate) : undefined;

  // 원본: TTS가 만든 음성 그대로
  const handleDownload = () => {
    if (!currentClip) return;
    downloadUrl(currentClip.audioUrl, clipFileName(currentClip, 'raw'));
  };

  // 효과 포함: 지금 들리는 잔향·드론을 입혀 렌더 (재생 속도는 제외, offlineRender.ts 주석 참고)
  const handleDownloadWithEffects = async () => {
    if (!currentClip || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await renderWithEffects(
        currentClip.audioUrl,
        effectsFromSettings({ reverb: reverbAmount, darkDrone: atmosphereDrone })
      );
      const url = URL.createObjectURL(blob);
      downloadUrl(url, clipFileName(currentClip, 'fx'));
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('효과 렌더 실패:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative rounded-2xl bg-neutral-900 border border-neutral-800 p-4 sm:p-5 shadow-xl">
      {/* Top Status & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {currentClip?.presetName || '토끼 가면 보이스 더빙'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                {currentClip?.voiceName || 'Charon'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 truncate max-w-sm sm:max-w-md">
              {currentClip?.text || '대사를 생성하여 감상해보세요'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Audio Effects Toggle */}
          <button
            onClick={() => setShowEffects(!showEffects)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showEffects
                ? 'bg-neutral-800 text-white border-neutral-600 shadow-inner'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>오디오 이펙트</span>
          </button>

          {/* Custom Studio Button */}
          <button
            onClick={onOpenCustomStudio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>대사 편집 & 녹음</span>
          </button>

          {/* Download Audio */}
          <button
            disabled={!currentClip}
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/90 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-600/90 text-white shadow transition-all"
            title="WAV 음원 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">원본 WAV</span>
          </button>
          <button
            disabled={!currentClip || isExporting}
            onClick={handleDownloadWithEffects}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 border border-neutral-700 transition-colors"
            title="잔향·드론을 입힌 WAV (재생 속도는 포함하지 않음)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{isExporting ? '렌더 중…' : '효과 포함 WAV'}</span>
          </button>
        </div>
      </div>

      {/* PLATING 컷 길이 비교 */}
      {scriptLine && (
        <div
          className={`mt-3 px-3 py-2 rounded-lg text-xs flex flex-wrap gap-x-4 gap-y-1 border ${
            fit && !fit.fits
              ? 'bg-red-950/50 border-red-800/70 text-red-200'
              : 'bg-neutral-950 border-neutral-800 text-neutral-300'
          }`}
        >
          <span className="font-mono">{scriptLine.cut}</span>
          <span>컷 {scriptLine.cutSeconds}s</span>
          <span>음성 {fit ? (duration / playbackRate).toFixed(1) : '-'}s</span>
          {fit && (
            <span className="font-semibold">
              {fit.fits ? `여유 ${(-fit.overSeconds).toFixed(1)}s` : `초과 ${fit.overSeconds.toFixed(1)}s`}
            </span>
          )}
        </div>
      )}

      {/* Scrubber & Player Controls */}
      <div className="mt-4 space-y-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-neutral-400 w-9 text-right">
            {formatTime(currentTime)}
          </span>

          <div
            className="relative flex-1 h-3 bg-neutral-800 rounded-full cursor-pointer overflow-hidden group"
            onClick={(e) => {
              if (duration <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              onSeek(ratio * duration);
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-red-700 to-red-500 rounded-full group-hover:brightness-110 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Interactive scrub handle indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border border-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
          </div>

          <span className="text-xs font-mono text-neutral-400 w-9">
            {formatTime(duration)}
          </span>
        </div>

        {/* Playback Button Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={onReplay}
              disabled={!currentClip || isLoading}
              className="p-2 rounded-full bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 disabled:opacity-40 transition-colors"
              title="처음부터 다시 재생"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onPlayPause}
              disabled={!currentClip || isLoading}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all hover:scale-105 active:scale-95"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <span className="text-xs text-neutral-400 font-medium">
              {isPlaying ? '재생 중…' : '대기 중'}
            </span>
          </div>

          {/* Speed Preset Tabs */}
          <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800 text-xs font-mono">
            {[0.85, 1.0, 1.15].map((rate) => (
              <button
                key={rate}
                onClick={() => onChangeRate(rate)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  playbackRate === rate
                    ? 'bg-red-600 text-white font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {rate === 0.85 ? '0.85x (음산)' : rate === 1.0 ? '1.0x (표준)' : '1.15x (다급)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsible Audio Effect Rack */}
      {showEffects && (
        <div className="mt-4 pt-4 border-t border-neutral-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
          {/* Reverb Slider */}
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-red-400" />
                시네마 공간 잔향 (Cinematic Hall Reverb)
              </span>
              <span className="font-mono text-neutral-400">
                {Math.round(reverbAmount * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={reverbAmount}
              onChange={(e) => onChangeReverb(parseFloat(e.target.value))}
              className="w-full accent-red-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-neutral-500">
              극장에서 울려 퍼지는 듯한 웅장하고 서늘한 공간감을 조절합니다.
            </p>
          </div>

          {/* Suspense Atmosphere Drone */}
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                서스펜스 서브 드론 (Sub-bass Drone)
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                긴장감을 극대화하는 55Hz 저주파 암흑 음향을 더빙 배경에 깝니다.
              </p>
            </div>
            <button
              onClick={onToggleDrone}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                atmosphereDrone
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {atmosphereDrone ? '활성화됨' : '꺼짐'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
