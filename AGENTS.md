# sangsang-voice

PLATING(10분 AI 애니메이션)의 대사 녹음본을 Gemini TTS로 만드는 도구. 답변과 주석은 한국어, 이모지 금지.

## 구조
- `server.ts`: Express. `/api/dubbing/generate`가 Gemini TTS를 부르고, 응답 오디오를 `extractWavAudio`로 WAV로 바꿔 base64로 돌려준다. `/api/scenes/ai-generate`는 씬 이미지 생성.
- `src/shared/wav.ts`: 서버·브라우저 공용 WAV 유틸(raw PCM에 헤더 씌우기, float 채널 인코딩).
- `src/audio/effects.ts`: `AudioEffect` 인터페이스와 잔향·드론 구현. 실시간 재생과 내보내기가 같은 정의를 쓴다. 새 효과는 이 인터페이스를 구현한다.
- `src/audio/offlineRender.ts`: OfflineAudioContext로 효과를 입혀 WAV를 만든다("효과 포함 WAV" 버튼).
- `src/utils/audioEngine.ts`: 실시간 재생 엔진(MediaElementSource 기반).
- `src/script/`: 대본 읽기. `ScriptSource` 인터페이스(`source.ts`)와 저장소 사본(`bundledSource.ts`), 노션 섹션 파서(`notionRecordingScript.ts`, 네트워크 없음), 화면용 훅(`useScript.ts`). 새 출처는 `ScriptSource`를 구현한다.
- `server/notionScriptSource.ts`: 노션 API로 컷표 페이지 블록을 읽어 파서에 넘긴다. `/api/script`가 `NOTION_TOKEN`이 있으면 매번 노션에서 읽고, 없거나 실패하면 저장소 사본과 경고를 돌려준다.
- `src/data/platingScript.ts`: 대본 줄 타입, 아는 화자 7명, 노션을 못 읽을 때 쓰는 사본 29줄, 컷 길이 비교 `checkFit`, TTS 대사 검사 `ttsTextMatches`.
- `src/shared/language.ts`: 대사 언어(한국어·영어). 서버가 연기 지시문 끝에 언어 지시를 붙인다. 프리셋 지시문에는 언어를 적지 않는다.

## PLATING 대본 규칙
- 정본은 노션「스토리보드/컷표」(https://app.notion.com/p/3eb339339b9b8007bf8afbdd52102e49) 맨 끝 "녹음 대본 (인물별 대사)" 섹션. 앱이 이 섹션을 직접 읽는다. `platingScript.ts`의 29줄은 사본이라 노션이 바뀌면 맞춰 둔다. 노션 내용을 지어내지 않는다.
- 섹션 모양: 제목 아래 "굵은 글씨 한 줄 = 화자 이름", 그 아래 표. 표 머리 칸 이름으로 칸을 찾는다: 컷, TC, 길이, 대사, 상황, 영어 대사, TTS 대사, 연기 지시. 컷과 대사 칸은 꼭 있어야 한다. 화자 이름이 `SPEAKERS`의 name과 다르면 새 화자(`notion:이름`)로 잡히고 경고가 뜬다.
- "TTS 대사"는 대사에 `<sigh>` `<short pause>` 같은 태그만 넣은 문장이다. 태그를 빼고 원래 대사와 다르면 쓰지 않고 경고한다. "연기 지시"는 그 줄의 디렉션으로, 화자 지시문 뒤에 붙는다.
- 영어 대사(`textEn`)는 아직 정본이 없다. 번역을 지어 넣지 말고, 사용자가 정한 문장을 노션에 먼저 적은 뒤 옮긴다. 컷 길이 비교는 실제 음성 길이로 하므로 언어와 상관없이 동작한다.
- 한국어 대사 속도 기준은 초당 약 6음절. 컷 길이를 넘는 대사는 대본이나 컷을 고칠 문제이지 재생 속도로 맞출 문제가 아니다.
- 화자: 앵커(하층 방송, 존댓말), 토끼(흰 토끼 가면, 낮고 공손, 높낮이 거의 없음, S#11-C015·S#14-C008은 같은 높낮이), 정화파 수장(공작), 보존파 수장(독수리), 상류층 홍학(뒷방, 반말), 문틈 너머 상류층, 진우(대사 한 줄).
- 화자 성별(사용자 지정): 앵커·상류층 홍학·문틈 너머 상류층은 여자, 나머지는 남자. 목소리 성별은 Google Cloud Gemini-TTS 문서 표를 따른다. 한 목소리는 한 화자만 쓴다(`src/data/voiceCandidates.ts`의 후보도 겹치지 않게, 확정도 `voiceOwner`로 막는다).
- 이미지 프롬프트에 스톱모션·클레이·인형·미니어처, photoreal 같은 실사 연상 단어를 쓰지 않는다(부정문으로도 쓰지 않는다).

## 알려진 한계 (다음 작업 후보)
- 재생 속도는 내보내기에 들어가지 않는다. 브라우저 재생은 음높이를 유지하지만 Web Audio playbackRate는 음높이가 바뀌기 때문. 넣으려면 타임 스트레치(예: SoundTouch 계열)가 필요하다.
- "효과 포함 WAV"는 잔향 꼬리 2.5초가 붙어 컷 길이보다 길다. 컷 길이 비교는 원본 기준이다.
- 화자별 기본 목소리·연기 지시문이 정해지지 않았다. 지금 프리셋 4개는 토끼용 시안이다.
- 기본 씬(`src/data/defaultScenes.ts`)은 대사 있는 8개 씬이고 그림이 아직 없다.
- 생성 클립과 목소리 비교 테이크는 이 브라우저의 IndexedDB(`src/storage/recordStore.ts`)에 개수 제한 없이 남는다. 다른 기기와는 공유되지 않는다. 커스텀 씬 이미지는 localStorage(용량 약 5MB)에 base64로 저장된다.
- 사용 모델 이름(`gemini-3.8-flash-tts` 등)과 응답 오디오 형식은 실제 키로 확인하지 않았다. `sourceMimeType`이 응답에 함께 오니 첫 실행 때 확인한다.

## 확인
- `npx tsc --noEmit`, `npx vite build`
- 실행: `.env`에 `GEMINI_API_KEY`(필수), `NOTION_TOKEN`(노션에서 대본 읽기, 없으면 사본)을 넣고 `npm run dev` (기본 포트 3000). 노션 통합에 컷표 페이지를 공유해야 읽힌다.
- 의존성 설치는 `bun install`(npm은 peer 충돌로 실패한다)
