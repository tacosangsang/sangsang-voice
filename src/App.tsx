import React, { useState, useEffect, useRef } from 'react';
import { CinematicViewer } from './components/CinematicViewer';
import { VoiceSelector } from './components/VoiceSelector';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { CustomStudioModal } from './components/CustomStudioModal';
import { useScript } from './script/useScript';
import { SceneManagerModal } from './components/SceneManagerModal';
import { VoiceAuditionModal } from './components/VoiceAuditionModal';
import { DubbingPreset, DubbingItem, SceneItem } from './types';
import { DEFAULT_SCENES } from './data/defaultScenes';
import { audioEngine } from './utils/audioEngine';
import { DialogueLanguage } from './shared/language';
import {
  Sparkles,
  Film,
  History,
  Play,
  AlertCircle,
  Quote,
  Layers,
  Plus,
  Mic2
} from 'lucide-react';

const DEFAULT_PRESETS: DubbingPreset[] = [
  {
    id: 'charon-elegant',
    name: '우아한 악마 (Charon)',
    voiceName: 'Charon',
    badge: '추천 • 시네마틱',
    description: '서늘하고 여유로운 신사. 낮고 우아하며 비밀을 속삭이듯 냉정한 어조',
    stylePrompt:
      'A sophisticated, chillingly calm, polite yet deeply sinister gentleman in a tailored white suit whispering cynical philosophical truths with subtle breath pauses and cold elegance.',
    formattedText: '신은 두 접시 중 하나만 고릅니다. <breath> 다른 하나가 초라하면 더 쉽겠지요.',
    characterDescription:
      '하얀 정장을 입고 붉은 눈의 토끼 가면을 쓴 의문의 신사. 요리사의 귀에 다가가 냉소적인 제안을 건네는 순간',
  },
  {
    id: 'fenrir-cynical',
    name: '비정한 냉혈한 (Fenrir)',
    voiceName: 'Fenrir',
    badge: '다크 • 묵직함',
    description: '극도로 가라앉은 저음, 감정이 배제된 채 압박해오는 차가운 위압감',
    stylePrompt:
      'Deep, raspy, heavy, and cynical male voice, emotionally detached, dark psychological pressure with an unyielding cold cadence.',
    formattedText: '신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면, 더 쉽겠지요.',
    characterDescription:
      '요리사의 고뇌를 꿰뚫어 보며 선택의 잔인함을 차갑게 각인시키는 어두운 조언자',
  },
  {
    id: 'puck-eccentric',
    name: '기괴한 조소 (Puck)',
    voiceName: 'Puck',
    badge: '그로테스크 • 광기',
    description: '가면 뒤에서 번지는 옅은 조소와 비틀린 유머, 신경질적인 광기',
    stylePrompt:
      'Eccentric, slightly playful yet deeply eerie and twisted voice with a sarcastic sneer, unsettlingly casual about cruel fate.',
    formattedText: '신은 두 접시 중 하나만 고릅니다. <laugh> 다른 하나가 초라하면... 더 쉽겠지요?',
    characterDescription:
      '붉은 유리 눈알 뒤에서 비웃음을 머금고 세상의 비정함을 즐기듯 속삭이는 가면의 남자',
  },
  {
    id: 'zephyr-whisper',
    name: '스산한 환영 (Zephyr)',
    voiceName: 'Zephyr',
    badge: '미스터리 • 에코',
    description: '꿈결처럼 귓가를 맴돌며 유혹하는 나직하고 몽환적인 음성',
    stylePrompt:
      'Ethereal, haunting whisper, calm and smooth yet spine-chilling, delivered close to the microphone as if speaking into someone’s ear.',
    formattedText: '신은 두 접시 중 하나만 고릅니다... 다른 하나가 초라하면, 더 쉽겠지요.',
    characterDescription:
      '피할 수 없는 악마의 속삭임처럼 요리사의 귓가에 맴도는 유혹과 파멸의 계시',
  },
];

export default function App() {
  const { script, isLoading: isScriptLoading, reload: reloadScript } = useScript();
  const [presets, setPresets] = useState<DubbingPreset[]>(DEFAULT_PRESETS);
  const [activePresetId, setActivePresetId] = useState<string>('charon-elegant');
  const [currentClip, setCurrentClip] = useState<DubbingItem | null>(null);
  const [history, setHistory] = useState<DubbingItem[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scenes State
  const [scenes, setScenes] = useState<SceneItem[]>(() => {
    try {
      const saved = localStorage.getItem('bunny_dubbing_scenes_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with default scenes to guarantee defaults are always present
          const customOnly = parsed.filter((p: SceneItem) => p.isCustom);
          return [...DEFAULT_SCENES, ...customOnly];
        }
      }
    } catch (e) {
      console.warn('Failed to load saved scenes', e);
    }
    return DEFAULT_SCENES;
  });
  const [activeSceneId, setActiveSceneId] = useState<string>(DEFAULT_SCENES[0].id);

  // Audio Filters
  const [reverbAmount, setReverbAmount] = useState<number>(0.35);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [atmosphereDrone, setAtmosphereDrone] = useState<boolean>(false);
  const [frequencyLevel, setFrequencyLevel] = useState<number>(0);

  // Modals
  const [isCustomStudioOpen, setIsCustomStudioOpen] = useState<boolean>(false);
  const [isSceneManagerOpen, setIsSceneManagerOpen] = useState<boolean>(false);
  const [isAuditionOpen, setIsAuditionOpen] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Save custom scenes to localStorage whenever scenes change
  const saveScenesToStorage = (updatedScenes: SceneItem[]) => {
    try {
      localStorage.setItem('bunny_dubbing_scenes_v1', JSON.stringify(updatedScenes));
    } catch (e) {
      console.warn('Failed to save scenes to localStorage', e);
    }
  };

  const handleAddScene = (newScene: SceneItem) => {
    setScenes((prev) => {
      const updated = [newScene, ...prev];
      saveScenesToStorage(updated);
      return updated;
    });
    setActiveSceneId(newScene.id);
  };

  const handleDeleteScene = (sceneId: string) => {
    setScenes((prev) => {
      const updated = prev.filter((s) => s.id !== sceneId);
      saveScenesToStorage(updated);
      return updated;
    });
    if (activeSceneId === sceneId) {
      setActiveSceneId(DEFAULT_SCENES[0].id);
    }
  };

  const handleSelectScene = (scene: SceneItem, applyQuote = false) => {
    setActiveSceneId(scene.id);
    if (applyQuote && scene.defaultQuote) {
      // If user chooses to apply the scene quote to custom studio
    }
  };

  // Current active scene object
  const currentScene =
    scenes.find((s) => s.id === activeSceneId) || scenes[0] || DEFAULT_SCENES[0];

  // Initialize hidden audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.onerror = () => {
      setIsPlaying(false);
    };

    // Attach to Web Audio engine on first user interaction
    const initAudioGraph = () => {
      if (audioRef.current) {
        audioEngine.init(audioRef.current);
      }
      window.removeEventListener('click', initAudioGraph);
      window.removeEventListener('keydown', initAudioGraph);
    };
    window.addEventListener('click', initAudioGraph);
    window.addEventListener('keydown', initAudioGraph);

    // Fetch Presets from backend
    fetch('/api/dubbing/presets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.presets) {
          setPresets(data.presets);
        }
      })
      .catch(() => {});

    return () => {
      audio.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('click', initAudioGraph);
      window.removeEventListener('keydown', initAudioGraph);
    };
  }, []);

  // Update audio frequency animation loop
  useEffect(() => {
    const tick = () => {
      if (isPlaying) {
        const freqs = audioEngine.getFrequencyData();
        let sum = 0;
        const count = Math.min(freqs.length, 24);
        for (let i = 2; i < count; i++) {
          sum += freqs[i];
        }
        const avg = sum / (count * 255);
        setFrequencyLevel(avg);
      } else {
        setFrequencyLevel(0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  // Audio effect changes
  const handleReverbChange = (val: number) => {
    setReverbAmount(val);
    audioEngine.setReverb(val);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleToggleDrone = () => {
    const next = !atmosphereDrone;
    setAtmosphereDrone(next);
    audioEngine.toggleDrone(next);
  };

  // Generate Dubbing from Preset
  const handleGenerateDubbing = async (preset: DubbingPreset, autoPlay = true) => {
    setIsLoading(true);
    setErrorMsg(null);
    setActivePresetId(preset.id);

    try {
      const res = await fetch('/api/dubbing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: preset.formattedText,
          voiceName: preset.voiceName,
          stylePrompt: preset.stylePrompt,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `더빙 생성 요청 실패 (코드 ${res.status})`);
      }

      const data = await res.json();
      const base64 = data.audioBase64;
      const audioUrl = `data:${data.mimeType || 'audio/wav'};base64,${base64}`;

      const newClip: DubbingItem = {
        id: `${preset.id}-${Date.now()}`,
        presetId: preset.id,
        presetName: preset.name,
        voiceName: preset.voiceName,
        text: preset.formattedText,
        stylePrompt: preset.stylePrompt,
        audioBase64: base64,
        mimeType: data.mimeType || 'audio/wav',
        audioUrl,
        createdAt: Date.now(),
      };

      setCurrentClip(newClip);
      setHistory((prev) => [newClip, ...prev.slice(0, 9)]);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.load();

        if (autoPlay) {
          audioEngine.resume();
          await audioRef.current.play();
          setIsPlaying(true);
        }
      }
    } catch (err: any) {
      console.error('Failed to generate dubbing:', err);
      setErrorMsg(err.message || '더빙 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Studio Generation
  const handleCustomGenerate = async (customData: {
    text: string;
    voiceName: string;
    stylePrompt: string;
    presetName: string;
    scriptLineId?: string;
    language: DialogueLanguage;
  }) => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/dubbing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: customData.text,
          voiceName: customData.voiceName,
          stylePrompt: customData.stylePrompt,
          language: customData.language,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '커스텀 더빙 요청 실패');
      }

      const data = await res.json();
      const audioUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;

      const newClip: DubbingItem = {
        id: `custom-${Date.now()}`,
        presetName: customData.presetName,
        voiceName: customData.voiceName,
        text: customData.text,
        stylePrompt: customData.stylePrompt,
        scriptLineId: customData.scriptLineId,
        language: customData.language,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        audioUrl,
        createdAt: Date.now(),
      };

      setCurrentClip(newClip);
      setHistory((prev) => [newClip, ...prev.slice(0, 9)]);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.load();
        audioEngine.resume();
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '커스텀 더빙 생성 중 문제가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Play / Pause toggle
  const handlePlayPause = async () => {
    if (!audioRef.current || !currentClip) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioEngine.resume();
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (e) {
        console.error('Playback failed:', e);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleReplay = async () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioEngine.resume();
      await audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSelectHistoryClip = (clip: DubbingItem) => {
    setCurrentClip(clip);
    if (clip.presetId) {
      setActivePresetId(clip.presetId);
    }
    if (audioRef.current) {
      audioRef.current.src = clip.audioUrl;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.currentTime = 0;
      audioEngine.resume();
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const activePreset = presets.find((p) => p.id === activePresetId) || presets[0];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-neutral-900 bg-black/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-950">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>토끼 가면 더빙 스튜디오</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-normal">
                  Gemini 3.8 TTS
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Scene Manager Button in Header */}
            <button
              onClick={() => setIsSceneManagerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-semibold border border-neutral-700 hover:border-red-500/70 shadow-sm transition-all active:scale-95"
            >
              <Layers className="w-3.5 h-3.5 text-red-400" />
              <span>씬 변경 & 추가</span>
            </button>

            <button
              onClick={() => setIsAuditionOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white text-xs font-semibold border border-neutral-700 hover:border-red-500/70 shadow-sm transition-all active:scale-95"
            >
              <Mic2 className="w-3.5 h-3.5 text-red-400" />
              <span>목소리 비교</span>
            </button>

            {/* Custom Dubbing Button */}
            <button
              onClick={() => setIsCustomStudioOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>커스텀 대사 더빙</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex-1">{errorMsg}</div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-red-400 hover:text-white font-bold"
            >
              닫기
            </button>
          </div>
        )}

        {/* Cinematic Stage Viewer */}
        <CinematicViewer
          scene={currentScene}
          scenes={scenes}
          isPlaying={isPlaying}
          activeText={currentClip?.text || currentScene.defaultQuote || activePreset.formattedText}
          voiceName={currentClip?.voiceName || activePreset.voiceName}
          presetName={currentClip?.presetName || activePreset.name}
          frequencyLevel={frequencyLevel}
          atmosphereDrone={atmosphereDrone}
          onToggleDrone={handleToggleDrone}
          onTriggerPlay={handlePlayPause}
          onSelectScene={handleSelectScene}
          onOpenSceneManager={() => setIsSceneManagerOpen(true)}
        />

        {/* Audio Player Controls Bar */}
        <AudioPlayerBar
          currentClip={currentClip}
          scriptLines={script.lines}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          reverbAmount={reverbAmount}
          playbackRate={playbackRate}
          atmosphereDrone={atmosphereDrone}
          isLoading={isLoading}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onReplay={handleReplay}
          onChangeReverb={handleReverbChange}
          onChangeRate={handleRateChange}
          onToggleDrone={handleToggleDrone}
          onOpenCustomStudio={() => setIsCustomStudioOpen(true)}
        />

        {/* Character Voice Personas Grid */}
        <VoiceSelector
          presets={presets}
          activePresetId={activePresetId}
          isLoading={isLoading}
          onSelectPreset={(preset) => handleGenerateDubbing(preset, true)}
        />

        {/* Dialogue & Scene Insight Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Quote Analysis Card (Dynamically driven by active scene) */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                <Quote className="w-4 h-4" />
                <span>
                  대사 및 연출 의도 해설 • {currentScene.title} ({currentScene.subtitle})
                </span>
              </div>
              <button
                onClick={() => setIsSceneManagerOpen(true)}
                className="text-[11px] text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> 다른 씬 탐색
              </button>
            </div>

            <blockquote className="border-l-2 border-red-500 pl-4 py-1 text-base sm:text-lg font-serif italic text-neutral-200">
              “{currentScene.defaultQuote}”
            </blockquote>

            <p className="text-xs text-neutral-400 leading-relaxed">
              {currentScene.directorsNote}
            </p>

            <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-neutral-500 font-mono">
              <span className="px-2 py-0.5 rounded bg-neutral-800/80">#스톱모션스릴러</span>
              <span className="px-2 py-0.5 rounded bg-neutral-800/80">#토끼가면신사</span>
              <span className="px-2 py-0.5 rounded bg-neutral-800/80">
                #{currentScene.defaultSpeaker.split(' ')[0]}
              </span>
              <span className="px-2 py-0.5 rounded bg-neutral-800/80">#Gemini_TTS_Voicing</span>
            </div>
          </div>

          {/* Dubbing History Log */}
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                <History className="w-4 h-4 text-neutral-400" />
                <span>최근 생성 클립 ({history.length})</span>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">
                생성된 더빙 음원이 여기에 보관됩니다.
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {history.map((clip) => {
                  const isCurrent = currentClip?.id === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => handleSelectHistoryClip(clip)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        isCurrent
                          ? 'bg-red-950/40 border-red-500/80 text-white'
                          : 'bg-neutral-950 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <div className="font-semibold truncate">{clip.presetName}</div>
                        <div className="text-[10px] text-neutral-500 font-mono truncate">
                          {clip.voiceName} •{' '}
                          {new Date(clip.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </div>
                      <button
                        className={`p-1.5 rounded-lg shrink-0 ${
                          isCurrent ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-4 text-center text-xs text-neutral-600">
        토끼 가면 더빙 스튜디오 • Powered by Gemini 3.8 Flash TTS & Stop-Motion Cinema Engine
      </footer>

      {/* Custom Studio Modal */}
      <CustomStudioModal
        isOpen={isCustomStudioOpen}
        onClose={() => setIsCustomStudioOpen(false)}
        isLoading={isLoading}
        onGenerate={handleCustomGenerate}
        script={script}
        isScriptLoading={isScriptLoading}
        onReloadScript={reloadScript}
      />

      <VoiceAuditionModal isOpen={isAuditionOpen} onClose={() => setIsAuditionOpen(false)} />

      {/* Scene Manager Modal */}
      <SceneManagerModal
        isOpen={isSceneManagerOpen}
        onClose={() => setIsSceneManagerOpen(false)}
        scenes={scenes}
        activeSceneId={activeSceneId}
        onSelectScene={handleSelectScene}
        onAddScene={handleAddScene}
        onDeleteScene={handleDeleteScene}
      />
    </div>
  );
}
