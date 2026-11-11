# sangsang-voice

PLATING(10분 AI 애니메이션)의 대사 녹음본을 Gemini TTS로 만드는 도구. 답변과 주석은 한국어, 이모지 금지.

사용법은 [README.md](README.md), Claude 스킬은 [.claude/skills/sangsang-voice/SKILL.md](.claude/skills/sangsang-voice/SKILL.md)를 참고한다.

## 구조
- `server.ts`: 환경 변수로 의존을 만들고 Vite·정적 파일·서버 시작을 맡는다. `server/app.ts`의 `createApp(deps)`가 모든 API 라우트를 등록한다. `server/recordingsConfig.ts`는 전달받은 환경 값으로 녹음 저장소 설정을 만든다.
- `server/dubbing.ts`: `generateDubbing(ai, request)`가 언어 지시·TTS 모델 선택·경량 모델 재시도·WAV 변환을 맡는다. 음성 없는 응답은 `NoAudioError`로 구분한다.
- `server/cli/`: `npm run dub` 진입점과 인자 해석, 대본 줄 선택·생성·판정 표, `FileStore` 인터페이스와 폴더 저장 구현. `dubBatch.ts`는 `--batch` 묶음 계획·생성·무음 자르기와 실패 원본 이름을 맡는다. 기존 TTS·저장 이름 규칙을 재사용한다.
- `src/shared/wav.ts`: 서버·브라우저 공용 WAV 유틸(raw PCM에 헤더 씌우기, float 채널 인코딩, PCM 16bit WAV 디코딩).
- `src/audio/effects.ts`: `AudioEffect` 인터페이스와 잔향·드론 구현. 실시간 재생과 내보내기가 같은 정의를 쓴다. 새 효과는 이 인터페이스를 구현한다.
- `src/audio/offlineRender.ts`: OfflineAudioContext로 효과를 입혀 WAV를 만든다("효과 포함 WAV" 버튼).
- `src/utils/audioEngine.ts`: 실시간 재생 엔진(MediaElementSource 기반).
- `src/script/`: 대본 읽기. `ScriptSource` 인터페이스(`source.ts`)와 저장소 사본(`bundledSource.ts`), 노션 섹션 파서(`notionRecordingScript.ts`, 네트워크 없음), 화면용 훅(`useScript.ts`). 새 출처는 `ScriptSource`를 구현한다.
- `server/notionScriptSource.ts`: 노션 API로 컷표 페이지 블록을 읽어 파서에 넘긴다. `/api/script`가 `NOTION_TOKEN`이 있으면 매번 노션에서 읽고, 없거나 실패하면 저장소 사본과 경고를 돌려준다.
- `src/data/platingScript.ts`: 대본 줄 타입, 아는 화자 8명, 노션을 못 읽을 때 쓰는 사본(2026-11-11 노션 기준 21줄), 컷 길이 비교 `checkFit`, TTS 대사 검사 `ttsTextMatches`.
- `src/shared/recording.ts`, `server/githubRecordingRepository.ts`, `src/storage/recordStore.ts`: 생성 음성 저장. 서버 `RecordingRepository`(깃허브 구현)와 브라우저 `RecordStore`(서버 또는 IndexedDB). 다른 저장소는 이 인터페이스를 구현한다.
- `src/script/lineGroups.ts`, `src/audio/takeSplitter.ts`: 묶음 생성. 같은 씬·같은 화자·같은 감정(노션 "감정" 칸, 비면 묶지 않음)으로 이어 말하는 줄을 TTS 한 번으로 뽑고(무료 등급 하루 호출 제한 때문), 대사 음절 수(한글 음절이 없으면 글자 수) 비율에 맞는 무음 구간에서 잘라 컷마다 저장한다. 자르기 실패 시 통째로 저장. 다른 자르기 방법은 `TakeSplitter`를 구현한다.
- 앞 줄 대사가 `…` 또는 `...`로 끝나거나 다음 줄 대사가 `…` 또는 `...`로 시작하면 같은 묶음에 넣지 않는다.
- `src/data/generationCache.ts`: 같은 조건(대사·목소리·지시문·언어)으로 만든 음성은 다시 부르지 않는다. 화면마다 "듣기"(호출 없음)와 "생성/다시 생성"(호출 1회)을 나눈다. 저장된 음성 목록은 `src/components/ClipLibrary.tsx`(플레이어 바로 아래, 항목마다 듣기·저장).
- `src/shared/language.ts`: 대사 언어(한국어·영어). 서버가 연기 지시문 끝에 언어 지시를 붙인다. 프리셋 지시문에는 언어를 적지 않는다.

## PLATING 대본 규칙
- 정본은 노션「스토리보드/컷표」(https://app.notion.com/p/3eb339339b9b8007bf8afbdd52102e49) 맨 끝 "녹음 대본 (인물별 대사)" 섹션. 앱이 이 섹션을 직접 읽는다. `platingScript.ts`는 사본(2026-11-11 노션 기준 21줄)이라 노션이 바뀌면 맞춰 둔다. 노션 내용을 지어내지 않는다.
- 섹션 모양: 제목 아래 "굵은 글씨 한 줄 = 화자 이름", 그 아래 표. 표 머리 칸 이름으로 칸을 찾는다: 컷, TC, 길이, 대사, 상황, 영어 대사, TTS 대사, 연기 지시, 감정. 컷과 대사 칸은 꼭 있어야 한다. 화자 이름이 `SPEAKERS`의 name과 다르면 새 화자(`notion:이름`)로 잡히고 경고가 뜬다.
- "TTS 대사"는 대사에 `<sigh>` `<short pause>` 같은 태그만 넣은 문장이다. 태그를 빼고 원래 대사와 다르면 쓰지 않고 경고한다. "연기 지시"는 그 줄의 디렉션으로, 화자 지시문 뒤에 붙는다.
- 영어 대사(`textEn`)는 아직 정본이 없다. 번역을 지어 넣지 말고, 사용자가 정한 문장을 노션에 먼저 적은 뒤 옮긴다. 컷 길이 비교는 실제 음성 길이로 하므로 언어와 상관없이 동작한다.
- 한국어 대사 속도 기준은 초당 약 6음절. 컷 길이를 넘는 대사는 대본이나 컷을 고칠 문제이지 재생 속도로 맞출 문제가 아니다.
- 화자: 앵커(하층 방송, 존댓말), 토끼(흰 토끼 가면, 낮고 공손, 높낮이 거의 없음, S#11-C015·S#14-C008은 같은 높낮이), 정화파 수장(공작), 보존파 수장(독수리), 정화파 귀족(백조, 성별 미정), 상류층 홍학(뒷방, 반말), 문틈 너머 상류층, 진우(대사 한 줄).
- 화자 성별(사용자 지정): 앵커·상류층 홍학·문틈 너머 상류층은 여자, 토끼·정화파 수장(공작)·보존파 수장(독수리)·진우는 남자. 정화파 귀족(백조)은 성별 미정이므로 목소리 후보를 두지 않는다. 목소리 성별은 Google Cloud Gemini-TTS 문서 표를 따른다. 한 목소리는 한 화자만 쓴다(`src/data/voiceCandidates.ts`의 후보도 겹치지 않게, 확정도 `voiceOwner`로 막는다).
- 이미지 프롬프트에 스톱모션·클레이·인형·미니어처, photoreal 같은 실사 연상 단어를 쓰지 않는다(부정문으로도 쓰지 않는다).

## 알려진 한계 (다음 작업 후보)
- 재생 속도는 내보내기에 들어가지 않는다. 브라우저 재생은 음높이를 유지하지만 Web Audio playbackRate는 음높이가 바뀌기 때문. 넣으려면 타임 스트레치(예: SoundTouch 계열)가 필요하다.
- 잔향은 기본 0(`DEFAULT_REVERB`, 실시간 엔진과 화면이 함께 쓴다). 슬라이더로 올리면 "효과 포함 WAV"에 잔향 꼬리 2.5초가 붙어 컷 길이보다 길어진다. 컷 길이 비교는 원본 기준이다. 생성 음성(저장·"원본 WAV")에는 원래 효과가 들어가지 않는다.
- 화자별 기본 목소리·연기 지시문이 정해지지 않았다. 지금 프리셋 4개는 토끼용 시안이다.
- 기본 씬(`src/data/defaultScenes.ts`)은 대사 있는 8개 씬이고 그림이 아직 없다.
- 생성 클립(목소리 비교 음성 포함, `auditionKey`로 구분)은 `GITHUB_TOKEN`이 있으면 깃허브 `recordings` 브랜치(`server/githubRecordingRepository.ts`, `clips/index.json` + `clips/<씬>/<컷>-<인물>-<프리셋>-v<버전>.wav`, 이름 규칙은 `src/data/recordName.ts`이고 내려받기 이름도 같다. 프리셋 없이 만든 음성은 프리셋 자리에 목소리 이름, 대본 줄 없는 음성은 `기타/` 폴더. 버전은 같은 이름 중 다음 번호이고 저장할 때 정해 index.json의 `path`에 적는다. 이름 없는 예전 음성만 `<id 해시>.wav`)에, 없거나 저장소에 닿지 못하면 그 브라우저 IndexedDB에 남는다(`src/storage/recordStore.ts`). 꺼진 이유는 `/api/recordings/status`의 `reason`으로 "저장된 음성" 머리에 보인다(환경 변수 값은 되풀이하지 않는다). `GITHUB_RECORDINGS_REPO`·`GITHUB_RECORDINGS_BRANCH`는 기본값을 바꿀 때만 넣고 `.env.example`에 칸을 두지 않는다(AI Studio가 칸마다 Secret 입력을 띄워 토큰을 잘못 넣은 일이 있었다). 깃허브 저장이 켜진 뒤 앱을 열면 그 브라우저에만 있던 클립을 하나씩 깃허브로 옮긴다(브라우저 사본은 지우지 않는다). index.json이 1MB를 넘으면 Contents API로 못 읽으니(클립 약 2000개) 그때는 나눠야 한다. 커스텀 씬 이미지는 localStorage(용량 약 5MB)에 base64로 저장된다.
- 사용 모델 이름(`gemini-3.8-flash-tts` 등)과 응답 오디오 형식은 실제 키로 확인하지 않았다. `sourceMimeType`이 응답에 함께 오니 첫 실행 때 확인한다.

## 확인
- `npm run lint`, `npm run build`
- `npm test` (node:test, 소스 옆 `*.test.ts`. 새 모듈은 테스트를 같이 둔다)
- 실행: `.env`에 `GEMINI_API_KEY`(필수), `NOTION_TOKEN`(노션에서 대본 읽기, 없으면 사본)을 넣고 `npm run dev` (기본 포트 3000). 노션 통합에 컷표 페이지를 공유해야 읽힌다.
- 의존성 설치는 `bun install`(npm은 peer 충돌로 실패한다)

## 자동화
인자·환경 변수·저장 이름·종료 코드·한계는 [README.md의 터미널 자동화](README.md#터미널-자동화)를 참고한다.

줄 단위 또는 묶음 음성 생성:

```sh
npm run dub -- --voice Kore --speaker anchor
npm run dub -- --voice Kore --speaker anchor --style "Read calmly." --scene "S#01"
npm run dub -- --voice Kore --speaker anchor --scene "S#01" --dry-run
npm run dub -- --voice Kore --speaker anchor --scene "S#01" --batch
npm run dub -- --voice Kore --speaker anchor --scene "S#01" --no-upload
```

CLI는 실행하는 PC의 `.env`에 `GITHUB_TOKEN`이 있으면 로컬 `out/` 저장 뒤 앱과 같은 깃허브 `recordings` 브랜치에도 저장하며, 앱의 "저장된 음성" 목록에 그대로 보인다. 토큰에는 대상 저장소 Contents 읽기·쓰기 권한이 필요하고 브랜치가 미리 있어야 한다. 앱 서버의 토큰만으로 PC의 CLI가 저장할 수는 없다. `--no-upload`는 깃허브 확인·목록 읽기·업로드를 모두 끈다. `--out`은 로컬 위치만 바꾼다.
실행 시작에 접속 확인 한 번과 기존 목록 읽기를 한다. 토큰·설정·접속·목록 읽기 문제는 이유를 표시하고 로컬 생성만 계속한다. 켜져 있으면 로컬과 깃허브 이름의 합집합으로 버전과 건너뜀을 판단한다. 로컬 저장 후 업로드 실패는 경고와 판정 "깃허브 저장 실패", 종료 코드 2를 남기며 로컬 파일과 다음 줄 처리를 유지한다. 업로드만 재시도하는 기능은 없다. `--dry-run`도 접속 확인·목록 읽기는 하며 업로드는 하지 않고, 첫 줄에 저장 대상 또는 꺼진 이유를 출력한다. 설정 값은 출력하지 않는다.

`--batch`는 같은 씬·화자·감정으로 이어지는 줄을 한 번에 생성해 무음에서 자른다. 감정 칸이 비면 묶이지 않는다. `--batch --dry-run`은 묶음 id·줄 수·호출 예정 횟수를 표 앞에 출력한다. 일부 줄만 저장되어 있으면 전체를 다시 생성하고 기존 파일은 다음 버전으로 보존한다. 자르기 실패 원본은 첫 줄 이름에 `-batch`를 붙여 별도 버전으로 저장하고 종료 코드 2를 반환한다. 실제 Gemini 음성으로 자르기는 아직 검증하지 않았다.
깃허브 저장이 켜져 있으면 분할 컷과 통째 저장 원본 모두 업로드한다. 통째 저장 원본은 `scriptLineId` 없이 명시한 `recordName`으로 올려 `기타/`가 아닌 첫 줄의 씬 폴더에 둔다.

녹음 전 대본 점검:

```sh
npm run script:lint
npm run script:lint -- --source notion --strict
```
