import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
  Sparkles,
  Film,
} from 'lucide-react';
import { SceneItem } from '../types';

interface CinematicViewerProps {
  scene: SceneItem;
  scenes: SceneItem[];
  isPlaying: boolean;
  activeText: string;
  voiceName: string;
  presetName: string;
  frequencyLevel: number; // 0 to 1
  atmosphereDrone: boolean;
  onToggleDrone: () => void;
  onTriggerPlay: () => void;
  onSelectScene: (scene: SceneItem) => void;
  onOpenSceneManager: () => void;
}

export const CinematicViewer: React.FC<CinematicViewerProps> = ({
  scene,
  scenes,
  isPlaying,
  activeText,
  voiceName,
  presetName,
  frequencyLevel,
  atmosphereDrone,
  onToggleDrone,
  onTriggerPlay,
  onSelectScene,
  onOpenSceneManager,
}) => {
  const [isWidescreen, setIsWidescreen] = useState(true);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);

  // Clean text from vocal tags like <breath> or <laugh> for display
  const displaySubtitle = activeText
    .replace(/<breath>/gi, '… (숨) …')
    .replace(/<laugh>/gi, '… (실소) …')
    .replace(/<sigh>/gi, '… (한숨) …')
    .replace(/\|mhm\|/gi, '')
    .trim();

  // Eye glow intensity based on voice activity
  const redEyeGlow = isPlaying ? Math.min(0.4 + frequencyLevel * 0.9, 1) : 0.35;

  // Previous & Next scene navigation
  const currentIndex = scenes.findIndex((s) => s.id === scene.id);
  const handlePrevScene = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevIdx = (currentIndex - 1 + scenes.length) % scenes.length;
    onSelectScene(scenes[prevIdx]);
  };

  const handleNextScene = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (currentIndex + 1) % scenes.length;
    onSelectScene(scenes[nextIdx]);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl transition-all duration-500">
      {/* Top Bar / Scene Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/85 via-black/50 to-transparent">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-200">
            {scene.subtitle || 'CINEMATIC DUBBING'}
          </span>
          <span className="hidden sm:inline-block rounded bg-red-950/80 border border-red-800/60 px-2 py-0.5 text-[11px] font-medium text-red-200">
            {presetName} ({voiceName})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Change scene button */}
          <button
            onClick={onOpenSceneManager}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 hover:border-red-500/70 shadow-sm transition-all active:scale-95"
            title="다른 씬 선택 / 새 씬 추가하기"
          >
            <Layers className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">씬 변경 & 추가</span>
            <span className="sm:hidden">씬 변경</span>
          </button>

          {/* Drone atmosphere switch */}
          <button
            onClick={onToggleDrone}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              atmosphereDrone
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
            title="미스터리 배경 앰비언스 드론 토글"
          >
            {atmosphereDrone ? (
              <Volume2 className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">서스펜스 앰비언스</span>
          </button>

          {/* Subtitles switch */}
          <button
            onClick={() => setSubtitlesVisible(!subtitlesVisible)}
            className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
              subtitlesVisible
                ? 'bg-neutral-800/80 text-white border-neutral-700'
                : 'bg-neutral-900/60 text-neutral-400 border-neutral-800'
            }`}
            title="자막 켜기/끄기"
          >
            자막
          </button>

          {/* Aspect ratio */}
          <button
            onClick={() => setIsWidescreen(!isWidescreen)}
            className="p-1.5 rounded-md bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800 transition-colors"
            title="화면비 전환 (시네마스코프 / 16:9)"
          >
            {isWidescreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Movie Frame */}
      <div
        className={`relative w-full select-none flex items-center justify-center overflow-hidden transition-all duration-700 ${
          isWidescreen ? 'aspect-[2.35/1] max-h-[580px]' : 'aspect-[16/9] max-h-[640px]'
        }`}
      >
        <img
          key={scene.imageUrl}
          src={scene.imageUrl}
          alt={scene.title}
          className={`w-full h-full object-cover object-center filter transition-all duration-700 ${
            isPlaying ? 'brightness-105 contrast-[1.08] scale-[1.01]' : 'brightness-95 contrast-100'
          }`}
        />

        {/* Cinematic Vignette & Lighting overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.75)_95%)]" />

        {/* Film grain / subtle texture overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Previous Scene Overlay Button */}
        <button
          onClick={handlePrevScene}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/50 hover:bg-red-600/90 text-white/70 hover:text-white backdrop-blur-md border border-neutral-700/60 transition-all hover:scale-110 active:scale-95"
          title="이전 씬으로 전환"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next Scene Overlay Button */}
        <button
          onClick={handleNextScene}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/50 hover:bg-red-600/90 text-white/70 hover:text-white backdrop-blur-md border border-neutral-700/60 transition-all hover:scale-110 active:scale-95"
          title="다음 씬으로 전환"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Character Pinpoint: Rabbit Mask Red Eye Flare (if configured) */}
        {scene.redEyeGlowPosition && (
          <div
            className="absolute pointer-events-none transition-opacity duration-300"
            style={{
              top: scene.redEyeGlowPosition.top,
              right: scene.redEyeGlowPosition.right,
              left: scene.redEyeGlowPosition.left,
              opacity: redEyeGlow,
            }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className="w-16 h-16 rounded-full bg-red-600/40 blur-xl animate-pulse"
                style={{
                  transform: `scale(${1 + frequencyLevel * 0.8})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Character tags floating on top of characters */}
        {scene.characterTagLeft && (
          <div className="absolute bottom-24 left-6 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-neutral-700/60 text-xs text-neutral-300 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-neutral-400" />
            <span>{scene.characterTagLeft}</span>
          </div>
        )}

        {scene.characterTagRight && (
          <div className="absolute bottom-24 right-6 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-red-900/60 text-xs text-red-200 pointer-events-none">
            <Eye className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span className="font-semibold text-white">{scene.characterTagRight}</span>
            <span className="text-red-400 text-[11px]">• 화자</span>
          </div>
        )}

        {/* Play trigger button in center if paused */}
        {!isPlaying && (
          <button
            onClick={onTriggerPlay}
            className="group absolute z-20 flex items-center gap-3 px-6 py-3.5 rounded-full bg-neutral-900/80 hover:bg-red-600/90 text-white backdrop-blur-md border border-neutral-700 hover:border-red-500 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-red-500/20 group-hover:bg-white/20 flex items-center justify-center text-red-400 group-hover:text-white transition-colors">
              <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-xs uppercase tracking-wider text-neutral-400 group-hover:text-red-100 font-semibold">
                클릭하여 대사 듣기
              </div>
              <div className="text-sm font-bold text-white truncate max-w-[240px] sm:max-w-none">
                “{displaySubtitle.slice(0, 32)}...”
              </div>
            </div>
          </button>
        )}

        {/* Subtitles Overlay */}
        {subtitlesVisible && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex flex-col items-center justify-center px-6 pointer-events-none">
            <div
              className={`max-w-2xl px-6 py-3 rounded-xl backdrop-blur-md transition-all duration-300 text-center ${
                isPlaying
                  ? 'bg-black/85 border border-red-500/50 shadow-[0_0_24px_rgba(239,68,68,0.25)] scale-[1.02]'
                  : 'bg-black/70 border border-neutral-800'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-widest text-red-400 mb-1 flex items-center justify-center gap-2">
                <span>{scene.defaultSpeaker}</span>
                {isPlaying && (
                  <span className="flex items-center gap-0.5">
                    <span className="w-1 h-3 bg-red-500 animate-pulse rounded-full" />
                    <span className="w-1 h-4 bg-red-400 animate-pulse delay-75 rounded-full" />
                    <span className="w-1 h-2 bg-red-600 animate-pulse delay-150 rounded-full" />
                  </span>
                )}
              </div>
              <p
                className={`text-lg sm:text-xl font-medium tracking-tight leading-relaxed transition-all duration-300 ${
                  isPlaying
                    ? 'text-amber-100 drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)]'
                    : 'text-neutral-200'
                }`}
              >
                “{displaySubtitle}”
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filmstrip Scene Navigation Carousel Bar */}
      <div className="border-t border-neutral-800/80 bg-neutral-950/90 px-4 py-3 flex items-center gap-3 overflow-x-auto">
        <div className="text-xs font-semibold text-neutral-400 shrink-0 flex items-center gap-1.5 pl-1">
          <Film className="w-3.5 h-3.5 text-red-500" />
          <span>씬 선택</span>
          <span className="text-[10px] text-neutral-500 font-mono">({currentIndex + 1}/{scenes.length})</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {scenes.map((s, idx) => {
            const isSelected = s.id === scene.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectScene(s)}
                className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs shrink-0 transition-all ${
                  isSelected
                    ? 'bg-red-950/60 border-red-500/80 text-white shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                    : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                }`}
              >
                <div className="w-8 h-6 rounded overflow-hidden shrink-0 bg-neutral-800">
                  <img src={s.imageUrl} alt={s.title} className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-mono text-neutral-500 group-hover:text-neutral-400">
                    0{idx + 1}
                  </div>
                  <div className="font-semibold text-xs leading-none truncate max-w-[100px] sm:max-w-[130px]">
                    {s.title}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Quick Add Scene Pill Button */}
          <button
            onClick={onOpenSceneManager}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-red-500/60 hover:border-red-400 bg-red-950/20 hover:bg-red-950/40 text-red-300 hover:text-white text-xs font-semibold shrink-0 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ 씬 추가하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
