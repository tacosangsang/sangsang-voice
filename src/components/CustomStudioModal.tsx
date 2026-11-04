import React, { useState } from 'react';
import { X, Sparkles, Mic, Volume2, Wand2, Plus } from 'lucide-react';
import { PLATING_SCRIPT, SPEAKERS, findScriptLine } from '../data/platingScript';

interface CustomStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  onGenerate: (data: {
    text: string;
    voiceName: string;
    stylePrompt: string;
    presetName: string;
    scriptLineId?: string;
  }) => Promise<void>;
}

export const CustomStudioModal: React.FC<CustomStudioModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  onGenerate,
}) => {
  const [text, setText] = useState('신은 두 접시 중 하나만 고릅니다. <breath> 다른 하나가 초라하면 더 쉽겠지요.');
  const [voiceName, setVoiceName] = useState('Charon');
  const [stylePrompt, setStylePrompt] = useState(
    'A sophisticated, chillingly calm, polite yet deeply sinister gentleman in a tailored white suit whispering cynical philosophical truths in Korean with subtle breath pauses and cold elegance.'
  );

  const [scriptLineId, setScriptLineId] = useState<string>('');
  const scriptLine = findScriptLine(scriptLineId);

  if (!isOpen) return null;

  const handlePickLine = (id: string) => {
    setScriptLineId(id);
    const line = findScriptLine(id);
    if (line) setText(line.text);
  };

  const insertTag = (tag: string) => {
    setText((prev) => prev + ` ${tag} `);
  };

  const styleSuggestions = [
    {
      label: '우아한 악마',
      prompt: 'A sophisticated, chillingly calm, polite yet deeply sinister gentleman in a tailored white suit whispering cynical philosophical truths in Korean with subtle breath pauses and cold elegance.',
      voice: 'Charon',
    },
    {
      label: '비열한 조소',
      prompt: 'Eccentric, slightly playful yet deeply eerie and twisted voice with a sarcastic sneer, unsettlingly casual about cruel fate.',
      voice: 'Puck',
    },
    {
      label: '묵직한 위압감',
      prompt: 'Deep, raspy, heavy, and cynical male voice, emotionally detached, dark psychological pressure with an unyielding cold cadence.',
      voice: 'Fenrir',
    },
    {
      label: '은밀한 속삭임',
      prompt: 'Ethereal, haunting whisper, calm and smooth yet spine-chilling, delivered close to the microphone as if speaking into someone’s ear.',
      voice: 'Zephyr',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;

    await onGenerate({
      text: text.trim(),
      voiceName,
      stylePrompt,
      presetName: scriptLine ? `${scriptLine.cut} ${voiceName}` : `커스텀 더빙 (${voiceName})`,
      scriptLineId: scriptLine && text.trim() ? scriptLine.id : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-950/80 border border-red-800/80 text-red-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">더빙 커스텀 스튜디오</h3>
              <p className="text-xs text-neutral-400">
                대사를 수정하거나 연기 디렉션(스타일 프롬프트)을 직접 지시하세요.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* PLATING 대본 줄 선택 */}
          <div className="space-y-2">
            <label htmlFor="plating-line" className="text-xs font-semibold text-neutral-300">
              PLATING 대본에서 불러오기
            </label>
            <select
              id="plating-line"
              value={scriptLineId}
              onChange={(e) => handlePickLine(e.target.value)}
              className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-2.5 text-xs text-neutral-200 focus:outline-none focus:border-red-500/80"
            >
              <option value="">직접 입력 (대본 줄 없음)</option>
              {SPEAKERS.map((sp) => (
                <optgroup key={sp.id} label={sp.name}>
                  {PLATING_SCRIPT.filter((l) => l.speaker === sp.id).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.cut} ({l.cutSeconds}s) {l.text.slice(0, 28)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {scriptLine && (
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                {scriptLine.tc} · 컷 {scriptLine.cutSeconds}s · {scriptLine.situation}
              </p>
            )}
          </div>

          {/* Script Text Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300">
                대사 스크립트 (Dialogue Script)
              </label>
              {/* Quick Tag insertion buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-500 mr-1">연기 태그:</span>
                <button
                  type="button"
                  onClick={() => insertTag('<breath>')}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-300 border border-neutral-700"
                  title="숨소리 / 호흡 멈춤 삽입"
                >
                  + &lt;breath&gt;
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('<laugh>')}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-300 border border-neutral-700"
                  title="비웃음 / 실소 삽입"
                >
                  + &lt;laugh&gt;
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('<sigh>')}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-mono text-neutral-300 border border-neutral-700"
                  title="한숨 삽입"
                >
                  + &lt;sigh&gt;
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-red-500/80 focus:ring-1 focus:ring-red-500/50 resize-none font-medium leading-relaxed"
              placeholder="대사를 입력하세요..."
            />
          </div>

          {/* Voice Actor Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-300">
              성우 보이스 (Voice Actor)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { name: 'Charon', label: 'Charon (우아/냉정)', desc: '중저음' },
                { name: 'Fenrir', label: 'Fenrir (거친 위압)', desc: '극저음' },
                { name: 'Puck', label: 'Puck (광기/조소)', desc: '괴짜' },
                { name: 'Zephyr', label: 'Zephyr (몽환/속삭임)', desc: '스산함' },
              ].map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setVoiceName(v.name)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    voiceName === v.name
                      ? 'bg-red-950/40 border-red-500 text-white shadow-sm'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <div className="text-xs font-bold">{v.name}</div>
                  <div className="text-[10px] text-neutral-400 truncate">{v.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style Prompt Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-300">
                연기 디렉션 (Style & Persona Direction)
              </label>
              <span className="text-[11px] text-neutral-500">Gemini 3.8 speechMetadata</span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {styleSuggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setStylePrompt(s.prompt);
                    setVoiceName(s.voice);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 border border-neutral-700 transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              className="w-full rounded-xl bg-neutral-950 border border-neutral-800 p-3 text-xs text-neutral-300 font-mono focus:outline-none focus:border-red-500/80 focus:ring-1 focus:ring-red-500/50 resize-none leading-relaxed"
              placeholder="연기 톤, 분위기, 템포, 억양 등을 영어 또는 한국어로 묘사하세요..."
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || !text.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-red-900/30 transition-all active:scale-95"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>더빙 생성 중…</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>새로운 분위기로 더빙하기</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
