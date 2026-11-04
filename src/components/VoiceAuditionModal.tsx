// 화자별 목소리 비교. 후보마다 같은 대사·같은 지시문으로 한국어와 영어를 생성해 들어 보고 하나를 고른다.
// 영어는 대본 줄의 textEn이 있을 때만 생성할 수 있다(영어 대사는 지어 넣지 않는다).
// 생성 버튼 한 번이 TTS 호출 1회다. 같은 조건으로 이미 만든 음성은 다시 부르지 않고 재생만 한다.
// 만든 음성은 recordStore(깃허브 또는 이 브라우저)에, 고른 결과는 이 브라우저 localStorage에 저장된다. 결과는 "결과 복사"로 옮겨 적는다.

import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Square, Loader2, Check, Copy, Mic2 } from 'lucide-react';
import { PLATING_SCRIPT, SPEAKERS, SpeakerId, lineText } from '../data/platingScript';
import { DialogueLanguage, LANGUAGES } from '../shared/language';
import { GENDER_LABEL, SPEAKER_AUDITIONS, voiceOwner } from '../data/voiceCandidates';
import { openRecordStore } from '../storage/recordStore';

interface VoiceAuditionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHOICE_KEY = 'plating-voice-audition-choices';
/** 생성 조건을 이은 키(화자|목소리|대본 줄|지시문|언어)와 음성 주소 */
interface StoredTake {
  key: string;
  url: string;
  createdAt: number;
}

const takeStore = openRecordStore<StoredTake>('takes', 'key', 'url');

/** 확정한 목소리와 그때의 지시문. 지시문을 고쳐 들어 보고 골랐다면 그 지시문까지가 선택이다. */
interface Choice {
  voiceName: string;
  style: string;
}

interface Take {
  url?: string;
  error?: string;
  loading?: boolean;
}

function loadChoices(): Partial<Record<SpeakerId, Choice>> {
  try {
    const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? '{}');
    // 예전 저장 형식(목소리 이름만)과 지금 후보에 없는 목소리(성별 변경 등으로 빠진 것)는 버린다.
    return Object.fromEntries(
      Object.entries(saved as Record<string, unknown>).filter(([id, v]) => {
        const voiceName = (v as Partial<Choice> | null)?.voiceName;
        const audition = SPEAKER_AUDITIONS.find((a) => a.speaker === id);
        return !!voiceName && !!audition?.candidates.some((c) => c.voiceName === voiceName);
      }),
    ) as Partial<Record<SpeakerId, Choice>>;
  } catch {
    return {};
  }
}

export const VoiceAuditionModal: React.FC<VoiceAuditionModalProps> = ({ isOpen, onClose }) => {
  const [lineBySpeaker, setLineBySpeaker] = useState<Partial<Record<SpeakerId, string>>>({});
  const [choices, setChoices] = useState(loadChoices);
  const [styleBySpeaker, setStyleBySpeaker] = useState<Partial<Record<SpeakerId, string>>>(() =>
    Object.fromEntries(Object.entries(choices).map(([id, c]) => [id, c!.style])),
  );
  // 키: 화자|목소리|대본 줄|지시문. 조건이 하나라도 바뀌면 새로 생성한다.
  const [takes, setTakes] = useState<Record<string, Take>>({});
  const [callCount, setCallCount] = useState(0);
  const [playingKey, setPlayingKey] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [storeTarget, setStoreTarget] = useState<string>();
  const [storeError, setStoreError] = useState<string>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 창을 닫은 뒤 도착한 생성 결과는 저장만 하고 재생하지 않는다.
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

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

  // 예전에 만든 테이크를 불러온다. 같은 조건으로 다시 누르면 새로 부르지 않고 이것을 재생한다.
  useEffect(() => {
    takeStore
      .then((store) => {
        setStoreTarget(store.target);
        return store.list();
      })
      .then((stored) =>
        setTakes((prev) => ({
          ...Object.fromEntries(stored.map((t) => [t.key, { url: t.url }])),
          ...prev,
        })),
      )
      .catch((e) => setStoreError(`저장된 음성을 불러오지 못했습니다: ${e?.message ?? e}`));
  }, []);

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

  const generate = async (key: string, text: string, voiceName: string, stylePrompt: string, language: DialogueLanguage) => {
    setTakes((prev) => ({ ...prev, [key]: { loading: true } }));
    setCallCount((n) => n + 1);
    try {
      const res = await fetch('/api/dubbing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName, stylePrompt, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `생성 실패 (${res.status})`);
      const url = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setTakes((prev) => ({ ...prev, [key]: { url } }));
      takeStore
        .then((store) => store.put({ key, url, createdAt: Date.now() }))
        .catch((e) => setStoreError(`음성 저장 실패(이번 화면에서만 들을 수 있음): ${e?.message ?? e}`));
      if (isOpenRef.current) play(key, url);
    } catch (err: any) {
      setTakes((prev) => ({ ...prev, [key]: { error: err.message || '생성 실패' } }));
    }
  };

  const resultText = SPEAKER_AUDITIONS.map((a) => {
    const choice = choices[a.speaker];
    if (!choice) return `${speakerName(a.speaker)}: (미정)`;
    return `${speakerName(a.speaker)}: ${choice.voiceName}${choice.style !== a.baseStyle ? ` / 지시문 수정: ${choice.style}` : ''}`;
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
                {storeTarget && ` · 저장 위치: ${storeTarget}`}
              </p>
              {storeError && <p className="text-[11px] text-red-400">{storeError}</p>}
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
                  <h3 className="text-sm font-bold text-white">
                    {speakerName(a.speaker)} <span className="text-[11px] font-normal text-neutral-500">({GENDER_LABEL[a.gender]})</span>
                  </h3>
                  <span className="text-[11px] text-neutral-500">확정: {choices[a.speaker]?.voiceName ?? '미정'}</span>
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
                <p className="text-[11px] text-neutral-500">
                  English: {line.textEn ?? '영어 대사가 아직 대본에 없습니다.'}
                </p>

                <textarea
                  value={style}
                  onChange={(e) => setStyleBySpeaker((prev) => ({ ...prev, [a.speaker]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-xs text-neutral-300"
                  aria-label={`${speakerName(a.speaker)} 연기 지시문`}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {a.candidates.map((c) => {
                    const chosen = choices[a.speaker]?.voiceName === c.voiceName && choices[a.speaker]?.style === style;
                    // 한 목소리는 한 화자만. 다른 화자가 확정했으면 여기서는 확정할 수 없다.
                    const owner = voiceOwner(choices, c.voiceName, a.speaker);
                    return (
                      <div
                        key={c.voiceName}
                        className={`rounded-lg border p-3 space-y-2 ${chosen ? 'border-red-500 bg-red-950/30' : 'border-neutral-800'}`}
                      >
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-bold text-white">{c.voiceName}</span>
                          <span className="text-[10px] text-neutral-500">{c.trait}</span>
                        </div>
                        {(Object.keys(LANGUAGES) as DialogueLanguage[]).map((lang) => {
                          // 같은 목소리로 한국어와 영어를 나란히 들어 비교한다. 키에 언어가 들어가 따로 보관된다.
                          const key = `${a.speaker}|${c.voiceName}|${line.id}|${style}|${lang}`;
                          const take = takes[key];
                          const text = lineText(line, lang);
                          return (
                            <div key={lang} className="space-y-1">
                              {take?.url ? (
                                <button
                                  onClick={() => (playingKey === key ? stop() : play(key, take.url!))}
                                  className="w-full flex items-center justify-center gap-1 rounded-md bg-neutral-800 hover:bg-neutral-700 py-1.5 text-[11px] text-white"
                                >
                                  {playingKey === key ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                  {LANGUAGES[lang].label} {playingKey === key ? '정지' : '재생'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => text && generate(key, text, c.voiceName, style, lang)}
                                  disabled={!text || take?.loading}
                                  className="w-full flex items-center justify-center gap-1 rounded-md bg-red-700 hover:bg-red-600 disabled:bg-neutral-800 disabled:text-neutral-500 py-1.5 text-[11px] text-white"
                                >
                                  {take?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                  {LANGUAGES[lang].label} {take?.loading ? '생성 중' : text ? '생성' : '대사 없음'}
                                </button>
                              )}
                              {take?.error && <p className="text-[10px] text-red-400 break-words">{take.error}</p>}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => setChoices((prev) => ({ ...prev, [a.speaker]: { voiceName: c.voiceName, style } }))}
                          disabled={!!owner}
                          className={`w-full flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] disabled:text-neutral-500 disabled:hover:bg-neutral-800 ${
                            chosen ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          {owner ? `${speakerName(owner)} 사용 중` : '확정'}
                        </button>
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
