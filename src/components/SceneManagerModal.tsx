import React, { useState, useRef } from 'react';
import { SceneItem } from '../types';
import SceneImage from './SceneImage';
import {
  X,
  Upload,
  Link as LinkIcon,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Check,
  Trash2,
  AlertCircle,
  Plus,
  Loader2,
  Film
} from 'lucide-react';

interface SceneManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: SceneItem[];
  activeSceneId: string;
  onSelectScene: (scene: SceneItem, applyQuote?: boolean) => void;
  onAddScene: (newScene: SceneItem) => void;
  onDeleteScene: (sceneId: string) => void;
}

const AI_PROMPT_SUGGESTIONS = [
  '어두운 주방 바닥에 산산조각 난 앤틱 접시와 흘러내린 붉은 소스',
  '하얀 정장과 토끼 가면을 쓴 남자가 붉은 와인잔을 들고 비웃는 모습',
  '새벽안개 낀 고딕 저택 앞, 빗속에서 마차를 기다리는 요리사',
  '금빛 촛대가 늘어선 비밀 연회장 문을 조용히 열어젖히는 하얀 장갑',
];

export const SceneManagerModal: React.FC<SceneManagerModalProps> = ({
  isOpen,
  onClose,
  scenes,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onDeleteScene,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'ai' | 'library'>('upload');

  // Form states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [speaker, setSpeaker] = useState('토끼 가면의 신사 (The White Rabbit)');
  const [quote, setQuote] = useState('신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.');
  const [directorsNote, setDirectorsNote] = useState('');
  const [previewImage, setPreviewImage] = useState<string>('');

  // URL tab state
  const [urlInput, setUrlInput] = useState('');

  // AI tab state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handle local file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('이미지 파일(PNG, JPG, WebP, GIF 등)만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFormError('파일 크기는 최대 15MB까지 지원됩니다.');
      return;
    }

    setFormError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewImage(result);
      if (!title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 20);
        setTitle(cleanName || '새로운 시네마틱 씬');
      }
      if (!subtitle) {
        setSubtitle(`SCENE 0${scenes.length + 1} • 커스텀 씬`);
      }
    };
    reader.onerror = () => {
      setFormError('파일을 읽는 도중 오류가 발생했습니다.');
    };
    reader.readAsDataURL(file);
  };

  // Handle URL fetch
  const handleLoadUrl = () => {
    if (!urlInput.trim()) {
      setFormError('이미지 URL을 입력해주세요.');
      return;
    }
    setFormError(null);
    setPreviewImage(urlInput.trim());
    if (!title) setTitle('웹 이미지 씬');
    if (!subtitle) setSubtitle(`SCENE 0${scenes.length + 1} • 커스텀 씬`);
  };

  // Handle AI scene generation
  const handleGenerateAiScene = async () => {
    if (!aiPrompt.trim()) {
      setAiError('생성할 씬의 분위기나 상황을 입력해주세요.');
      return;
    }

    setIsAiGenerating(true);
    setAiError(null);

    try {
      const res = await fetch('/api/scenes/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'AI 이미지 생성에 실패했습니다.');
      }

      const data = await res.json();
      setPreviewImage(data.imageUrl);
      if (!title) setTitle(aiPrompt.slice(0, 16));
      if (!subtitle) setSubtitle(`SCENE 0${scenes.length + 1} • AI 생성 씬`);
      if (!directorsNote) setDirectorsNote(`AI 생성 연출: ${aiPrompt}`);
    } catch (err: any) {
      setAiError(err.message || 'AI 씬 생성 중 문제가 발생했습니다.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Submit adding the scene
  const handleSaveScene = () => {
    if (!previewImage) {
      setFormError('씬에 사용할 이미지가 없습니다. 이미지를 업로드하거나 생성해주세요.');
      return;
    }

    const newScene: SceneItem = {
      id: `custom-scene-${Date.now()}`,
      title: title.trim() || `커스텀 씬 ${scenes.length + 1}`,
      subtitle: subtitle.trim() || `SCENE 0${scenes.length + 1} • 커스텀`,
      imageUrl: previewImage,
      defaultSpeaker: speaker.trim() || '토끼 가면의 신사',
      defaultQuote: quote.trim() || '신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.',
      characterTagLeft: '커스텀 씬',
      characterTagRight: speaker.trim() || '등장인물',
      directorsNote: directorsNote.trim() || '사용자가 직접 추가한 시네마틱 장면입니다.',
      isCustom: true,
      createdAt: Date.now(),
    };

    onAddScene(newScene);
    onSelectScene(newScene, false);
    onClose();
  };

  const resetForm = () => {
    setTitle('');
    setSubtitle('');
    setQuote('신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.');
    setSpeaker('토끼 가면의 신사 (The White Rabbit)');
    setDirectorsNote('');
    setPreviewImage('');
    setUrlInput('');
    setAiPrompt('');
    setFormError(null);
    setAiError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>시네마틱 씬 추가 및 관리</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-900/60">
                  Scene Director
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                더빙 화면의 배경 씬을 변경하거나 직접 만든 이미지, 웹 링크, AI 생성 씬을 추가하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-6 gap-2 pt-2">
          <button
            onClick={() => {
              setActiveTab('upload');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'upload'
                ? 'border-red-500 text-white bg-neutral-800/40 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>이미지 파일 업로드</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('url');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'url'
                ? 'border-red-500 text-white bg-neutral-800/40 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>이미지 URL 링크</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ai');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'ai'
                ? 'border-red-500 text-white bg-neutral-800/40 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Gemini AI 씬 생성</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('library');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ml-auto ${
              activeTab === 'library'
                ? 'border-red-500 text-white bg-neutral-800/40 rounded-t-lg'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>씬 보관함 ({scenes.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    previewImage
                      ? 'border-neutral-700 bg-neutral-950/40 hover:border-red-500/50'
                      : 'border-neutral-700 hover:border-red-500 bg-neutral-950/60 hover:bg-neutral-900/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-neutral-800/80 flex items-center justify-center text-neutral-300 mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">
                    클릭하여 이미지 파일 선택 또는 드래그앤드롭
                  </div>
                  <p className="text-xs text-neutral-400 max-w-xs">
                    PNG, JPG, WebP, GIF 파일 지원 (권장 화면비 16:9 또는 시네마스코프 2.35:1)
                  </p>
                </div>

                {/* Form Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">씬 제목</label>
                    <input
                      type="text"
                      placeholder="예: 파멸의 비밀 만찬"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">소제목 / 넘버</label>
                      <input
                        type="text"
                        placeholder="예: SCENE 06 • 결전"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">주요 화자</label>
                      <input
                        type="text"
                        placeholder="예: 토끼 가면의 신사"
                        value={speaker}
                        onChange={(e) => setSpeaker(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">기본 대사 / 독백</label>
                    <textarea
                      rows={2}
                      placeholder="이 장면에 어울리는 대사를 적어주세요."
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">연출 의도 및 해설 (선택)</label>
                    <textarea
                      rows={2}
                      placeholder="장면의 분위기나 배경 스토리를 기록해두세요."
                      value={directorsNote}
                      onChange={(e) => setDirectorsNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <div>
                  <div className="text-xs font-semibold text-neutral-400 mb-2 flex items-center justify-between">
                    <span>미리보기</span>
                    {previewImage && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> 이미지 등록 준비 완료
                      </span>
                    )}
                  </div>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                    {previewImage ? (
                      <img src={previewImage} alt="Scene Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6 text-neutral-500">
                        <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">이미지를 업로드하면 여기에 미리보기가 나타납니다.</p>
                      </div>
                    )}
                  </div>
                  {previewImage && (
                    <div className="mt-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs">
                      <div className="font-bold text-white mb-0.5">{title || '새로운 씬'}</div>
                      <div className="text-neutral-400 italic mb-1">“{quote}”</div>
                      <div className="text-[10px] text-red-400 uppercase tracking-wider">{speaker}</div>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-neutral-800 mt-4">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white transition-colors"
                  >
                    초기화
                  </button>
                  <button
                    onClick={handleSaveScene}
                    disabled={!previewImage}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg transition-all"
                  >
                    이 씬 등록하고 바로 적용
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Image URL */}
          {activeTab === 'url' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">이미지 웹 URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/... or https://..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={handleLoadUrl}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                    >
                      불러오기
                    </button>
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">씬 제목</label>
                    <input
                      type="text"
                      placeholder="예: 어둠의 회랑"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">소제목 / 넘버</label>
                      <input
                        type="text"
                        placeholder="예: SCENE 06 • 결전"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1">주요 화자</label>
                      <input
                        type="text"
                        placeholder="예: 토끼 가면의 신사"
                        value={speaker}
                        onChange={(e) => setSpeaker(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">기본 대사 / 독백</label>
                    <textarea
                      rows={2}
                      value={quote}
                      onChange={(e) => setQuote(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Preview Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <div>
                  <div className="text-xs font-semibold text-neutral-400 mb-2">미리보기</div>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={() => setFormError('이미지를 불러오지 못했습니다. 올바른 URL인지 확인해주세요.')}
                      />
                    ) : (
                      <div className="text-center p-6 text-neutral-500">
                        <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">URL을 입력하고 불러오기를 누르면 표시됩니다.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-neutral-800 mt-4">
                  <button
                    onClick={handleSaveScene}
                    disabled={!previewImage}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white shadow-lg transition-all"
                  >
                    이 씬 등록하고 바로 적용
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI Scene Generator */}
          {activeTab === 'ai' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gemini AI 씬 프롬프트</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="원하는 장면의 상황과 분위기를 한국어 또는 영어로 입력하세요. (스톱모션 클레이 스릴러 풍으로 자동 최적화됩니다)"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>

                {/* Prompt suggestions */}
                <div>
                  <div className="text-[11px] font-semibold text-neutral-400 mb-1.5">추천 프롬프트 예시</div>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_PROMPT_SUGGESTIONS.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setAiPrompt(sug);
                          setTitle(sug.slice(0, 16));
                        }}
                        className="px-2.5 py-1 text-[11px] rounded-md bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 text-left transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGenerateAiScene}
                  disabled={isAiGenerating || !aiPrompt.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 text-white shadow-lg transition-all"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>스톱모션 시네마틱 씬 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Gemini AI로 씬 생성하기</span>
                    </>
                  )}
                </button>

                {aiError && (
                  <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-xs text-red-300">
                    {aiError}
                  </div>
                )}
              </div>

              {/* Preview Box */}
              <div className="flex flex-col justify-between p-4 rounded-xl bg-neutral-950 border border-neutral-800">
                <div>
                  <div className="text-xs font-semibold text-neutral-400 mb-2">생성된 씬 미리보기</div>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                    {isAiGenerating ? (
                      <div className="text-center p-6 text-neutral-400 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                        <p className="text-xs font-medium">스톱모션 다크 시네마 씬 렌더링 중...</p>
                        <p className="text-[11px] text-neutral-500 mt-1">약 5~10초 소요됩니다.</p>
                      </div>
                    ) : previewImage ? (
                      <img src={previewImage} alt="AI Generated Scene" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-6 text-neutral-500">
                        <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
                        <p className="text-xs">프롬프트를 입력하고 생성 버튼을 누르면 여기에 나타납니다.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-neutral-800 mt-4">
                  <button
                    onClick={handleSaveScene}
                    disabled={!previewImage || isAiGenerating}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white shadow-lg transition-all"
                  >
                    이 AI 씬 등록하고 바로 적용
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Scene Library */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenes.map((scene) => {
                  const isActive = scene.id === activeSceneId;
                  return (
                    <div
                      key={scene.id}
                      className={`group relative rounded-xl overflow-hidden border transition-all ${
                        isActive
                          ? 'border-red-500 ring-2 ring-red-500/30 bg-neutral-950'
                          : 'border-neutral-800 bg-neutral-950/80 hover:border-neutral-700'
                      }`}
                    >
                      <div className="relative aspect-video overflow-hidden">
                        <SceneImage
                          scene={scene}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              scene.isCustom
                                ? 'bg-amber-950/80 border border-amber-700/60 text-amber-300'
                                : 'bg-neutral-900/80 border border-neutral-700/60 text-neutral-300'
                            }`}
                          >
                            {scene.isCustom ? '커스텀' : '스토리 씬'}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-600 text-white">
                              현재 선택됨
                            </span>
                          )}
                        </div>

                        {scene.isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteScene(scene.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 hover:bg-red-600 text-neutral-400 hover:text-white transition-colors"
                            title="씬 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="p-3">
                        <div className="text-[11px] font-mono text-red-400 mb-0.5">{scene.subtitle}</div>
                        <div className="text-xs font-bold text-white truncate mb-1">{scene.title}</div>
                        <p className="text-[11px] text-neutral-400 line-clamp-2 italic mb-3">
                          “{scene.defaultQuote}”
                        </p>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onSelectScene(scene, false);
                              onClose();
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isActive
                                ? 'bg-red-600 text-white'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                            }`}
                          >
                            {isActive ? '적용 중' : '이 씬으로 전환'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>총 {scenes.length}개의 시네마틱 씬 사용 가능</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
