# sangsang-voice

PLATING(10분 AI 애니메이션)의 대사 녹음본을 Gemini TTS로 만드는 도구. 답변과 주석은 한국어, 이모지 금지.

## 구조
- `server.ts`: Express. `/api/dubbing/generate`가 Gemini TTS를 부르고, 응답 오디오를 `extractWavAudio`로 WAV로 바꿔 base64로 돌려준다. `/api/scenes/ai-generate`는 씬 이미지 생성.
- `src/shared/wav.ts`: 서버·브라우저 공용 WAV 유틸(raw PCM에 헤더 씌우기, float 채널 인코딩).
- `src/audio/effects.ts`: `AudioEffect` 인터페이스와 잔향·드론 구현. 실시간 재생과 내보내기가 같은 정의를 쓴다. 새 효과는 이 인터페이스를 구현한다.
- `src/audio/offlineRender.ts`: OfflineAudioContext로 효과를 입혀 WAV를 만든다("효과 포함 WAV" 버튼).
- `src/utils/audioEngine.ts`: 실시간 재생 엔진(MediaElementSource 기반).
- `src/data/platingScript.ts`: PLATING 녹음 대본 29줄(컷 번호, TC, 컷 길이, 화자, 대사, 상황)과 컷 길이 비교 `checkFit`.
- `src/shared/language.ts`: 대사 언어(한국어·영어). 서버가 연기 지시문 끝에 언어 지시를 붙인다. 프리셋 지시문에는 언어를 적지 않는다.

## PLATING 대본 규칙
- 정본은 노션「스토리보드/컷표」(https://app.notion.com/p/3eb339339b9b8007bf8afbdd52102e49) 맨 끝 "녹음 대본 (인물별 대사)" 섹션. `platingScript.ts`는 그 사본이다. 대사를 바꿀 때는 노션을 먼저 확인하고 이 파일을 맞춘다. 노션 내용을 지어내지 않는다.
- 영어 대사(`textEn`)는 아직 정본이 없다. 번역을 지어 넣지 말고, 사용자가 정한 문장을 노션에 먼저 적은 뒤 옮긴다. 컷 길이 비교는 실제 음성 길이로 하므로 언어와 상관없이 동작한다.
- 한국어 대사 속도 기준은 초당 약 6음절. 컷 길이를 넘는 대사는 대본이나 컷을 고칠 문제이지 재생 속도로 맞출 문제가 아니다.
- 화자: 앵커(하층 방송, 존댓말), 토끼(흰 토끼 가면, 낮고 공손, 높낮이 거의 없음, S#11-C015·S#14-C008은 같은 높낮이), 정화파 수장(공작), 보존파 수장(독수리), 상류층 홍학(뒷방, 반말), 문틈 너머 상류층, 진우(대사 한 줄).
- 이미지 프롬프트에 스톱모션·클레이·인형·미니어처, photoreal 같은 실사 연상 단어를 쓰지 않는다(부정문으로도 쓰지 않는다).

## 알려진 한계 (다음 작업 후보)
- 재생 속도는 내보내기에 들어가지 않는다. 브라우저 재생은 음높이를 유지하지만 Web Audio playbackRate는 음높이가 바뀌기 때문. 넣으려면 타임 스트레치(예: SoundTouch 계열)가 필요하다.
- "효과 포함 WAV"는 잔향 꼬리 2.5초가 붙어 컷 길이보다 길다. 컷 길이 비교는 원본 기준이다.
- 화자별 기본 목소리·연기 지시문이 정해지지 않았다. 지금 프리셋 4개는 토끼용 시안이다.
- 기본 씬 5개(`src/data/defaultScenes.ts`)는 PLATING 설정이 아니다(붉은 눈, 은쟁반, 심판관).
- 생성 기록은 메모리에만 있어 새로고침하면 사라진다. 씬 이미지는 localStorage(용량 약 5MB)에 base64로 저장된다.
- 사용 모델 이름(`gemini-3.8-flash-tts` 등)과 응답 오디오 형식은 실제 키로 확인하지 않았다. `sourceMimeType`이 응답에 함께 오니 첫 실행 때 확인한다.

## 확인
- `npx tsc --noEmit`, `npx vite build`
- 실행: `.env`에 `GEMINI_API_KEY`를 넣고 `npm run dev` (기본 포트 3000)
