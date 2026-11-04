// 화자별 목소리 비교. 후보마다 같은 대사·같은 지시문으로 생성해 들어 보고 하나를 고른다.
// 생성 버튼 한 번이 TTS 호출 1회다. 같은 조건으로 이미 만든 음성은 다시 부르지 않고 재생만 한다.
// 고른 결과는 이 브라우저에만 저장되므로 "결과 복사"로 옮겨 적는다.

import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Square, Loader2, Check, Copy, Mic2 } from 'lucide-react';
import { PLATING_SCRIPT, SPEAKERS, SpeakerId } from '../data/platingScript';
import { SPEAKER_AUDITIONS } from '../data/voiceCandidates';

interface VoiceAuditionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHOICE_KEY = 'plating-voice-audition-choices';

interface Take {
  url?: string;
  error?: string;
  loading?: boolean;
}

function loadChoices(): Partial<Record<SpeakerId, string>> {
  try {
    return JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export const VoiceAuditionModal: React.FC<VoiceAuditionModalProps> = ({ isOpen, onClose }) => {
  const [lineBySpeaker, setLineBySpeaker] = useState<Partial<Record<SpeakerId, string>>>({});
  const [styleBySpeaker, setStyleBySpeaker] = useState<Partial<Record<SpeakerId, string>>>({});
  const [choices, setChoices] = useState(loadChoices);
  // 키: 화자|목소리|대본 줄|지시문. 조건이 하나라도 바뀌면 새로 생성한다.
  const [takes, setTakes] = useState<Record<string, Take>>({});
  const [callCount, setCallCount] = useState(0);
  const [playingKey, setPlayingKey] = useState<string>();
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(choices));
    } catch {
      // 저장이 막힌 브라우저에서는 화면에만 남긴다.
    }
  }, [choices]);

  useEffect(() => {
    if (!isOpen) audioRef.current?.pause();
  }, [isOpen]);

  if (!isOpen) return null;

  const speakerName = (id: SpeakerId) => SPEAKERS.find((s) => s.id === id)?.name ?? id;

  const play = (key: string, url: string) => {
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingKey(key);
    audio.onended = () => setPlayingKey(undefined);
    audio.play().catch(() => setPlayingKey(undefined));
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlayingKey(undefined);
  };

  const generate = async (key: string, text: string, voiceName: string, stylePrompt: string) => {
    setTakes((prev) => ({ ...prev, [key]: { loading: true } }));
    setCallCount((n) => n + 1);
    try {
      const res = await fetch('/api/dubbing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName, stylePrompt, language: 'ko' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `생성 실패 (${res.status})`);
      const url = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setTakes((prev) => ({ ...prev, [key]: { url } }));
      play(key, url);
    } catch (err: any) {
      setTakes((prev) => ({ ...prev, [key]: { error: err.message || '생성 실패' } }));
    }
  };

  const resultText = SPEAKER_AUDITIONS.map((a) => {
    const voice = choices[a.speaker];
    const style = styleBySpeaker[a.speaker] ?? a.baseStyle;
    return `${speakerName(a.speaker)}: ${voice ?? '(미정)'}${style !== a.baseStyle ? ` / 지시문 수정: ${style}` : ''}`;
  }).join('\n');

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <Mic2 className="w-4 h-4 text-red-400" />
            <div>
              <h2 className="text-sm font-bold text-white">화자별 목소리 비교</h2>
              <p className="text-[11px] text-neutral-500">
                생성 버튼 1번 = TTS 호출 1회. 이번에 부른 횟수: {callCount}회
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {SPEAKER_AUDITIONS.map((a) => {
            const lines = PLATING_SCRIPT.filter((l) => l.speaker === a.speaker);
            const lineId = lineBySpeaker[a.speaker] ?? lines[0]?.id;
            const line = lines.find((l) => l.id === lineId);
            const style = styleBySpeaker[a.speaker] ?? a.baseStyle;
            if (!line) return null;

            return (
              <section key={a.speaker} className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-white">{speakerName(a.speaker)}</h3>
                  <span className="text-[11px] text-neutral-500">확정: {choices[a.speaker] ?? '미정'}</span>
                </div>

                <select
                  value={lineId}
                  onChange={(e) => setLineBySpeaker((prev) => ({ ...prev, [a.speaker]: e.target.value }))}
                  className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-xs text-neutral-200"
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.cut} ({l.cutSeconds}s) {l.text}
                    </option>
                  ))}
                </select>

                <textarea
                  value={style}
                  onChange={(e) => setStyleBySpeaker((prev) => ({ ...prev, [a.speaker]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-xs text-neutral-300"
                  aria-label={`${speakerName(a.speaker)} 연기 지시문`}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {a.candidates.map((c) => {
                    const key = `${a.speaker}|${c.voiceName}|${line.id}|${style}`;
                    const take = takes[key];
                    const chosen = choices[a.speaker] === c.voiceName;
                    return (
                      <div
                        key={c.voiceName}
                        className={`rounded-lg border p-3 space-y-2 ${chosen ? 'border-red-500 bg-red-950/30' : 'border-neutral-800'}`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-bold text-white">{c.voiceName}</span>
                          <span className="text-[10px] text-neutral-500">{c.trait}</span>
                        </div>
                        <div className="flex gap-1.5">
                          {take?.url ? (
                            <button
                              onClick={() => (playingKey === key ? stop() : play(key, take.url!))}
                              className="flex-1 flex items-center justify-center gap-1 rounded-md bg-neutral-800 hover:bg-neutral-700 py-1.5 text-[11px] text-white"
                            >
                              {playingKey === key ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              {playingKey === key ? '정지' : '재생'}
                            </button>
                          ) : (
                            <button
                              onClick={() => generate(key, line.text, c.voiceName, style)}
                              disabled={take?.loading}
                              className="flex-1 flex items-center justify-center gap-1 rounded-md bg-red-700 hover:bg-red-600 disabled:opacity-60 py-1.5 text-[11px] text-white"
                            >
                              {take?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                              {take?.loading ? '생성 중' : '생성'}
                            </button>
                          )}
                          <button
                            onClick={() => setChoices((prev) => ({ ...prev, [a.speaker]: c.voiceName }))}
                            className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${
                              chosen ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            확정
                          </button>
                        </div>
                        {take?.error && <p className="text-[10px] text-red-400 break-words">{take.error}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="border-t border-neutral-800 bg-neutral-950/60 p-4 space-y-2">
          <pre className="text-[11px] text-neutral-300 whitespace-pre-wrap">{resultText}</pre>
          <button
            onClick={copyResult}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 text-xs text-white"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? '복사됨' : '결과 복사'}
          </button>
        </div>
      </div>
    </div>
  );
};
