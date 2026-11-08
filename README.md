# sangsang-voice

PLATING(10분 AI 애니메이션)의 대사 녹음본을 Gemini TTS로 만드는 도구입니다.

## 준비

Node 24를 사용합니다(CI 기준). 저장소 루트에서 의존성을 설치합니다. 설치 정본은 `bun.lock`입니다.

```sh
bun install
```

Bun이 없으면 다음 명령을 사용합니다.

```sh
npm install --legacy-peer-deps
```

일반 `npm install`은 루트의 `esbuild ^0.25.0`과 Vite 8의 esbuild peer 요구(`^0.27.0 || ^0.28.0`)가 충돌합니다.

`.env.example`을 복사해 루트에 `.env`를 만들고 필요한 칸을 채웁니다. 키와 토큰 값은 출력하거나 커밋하지 않습니다.

| 이름 | 필수 | 용도 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 실제 음성 생성 시 필수 | Gemini TTS 호출. 사본 대본 점검과 `--dry-run`에는 불필요 |
| `APP_URL` | 아니요 | `.env.example`에 있는 호스팅 URL 칸. 현재 소스에서는 사용하지 않음 |
| `NOTION_TOKEN` | 노션 출처 사용 시 필수 | 노션 통합 토큰. 컷표 페이지를 해당 통합에 공유해야 읽을 수 있음 |
| `NOTION_SCRIPT_PAGE_ID` | 아니요 | 읽을 노션 컷표 페이지 지정. 비우면 코드에 지정된 PLATING 컷표 사용 |
| `GITHUB_TOKEN` | 아니요 | 브라우저에서 생성한 음성의 GitHub 저장·불러오기. 대상 저장소 Contents 읽기·쓰기 권한 필요. 없으면 브라우저 IndexedDB에 저장 |

## 실행

```sh
npm run dev
```

데스크톱 브라우저에서 `http://localhost:3000/`을 엽니다(기본 포트 3000).
대본을 읽고 줄을 고른 뒤 목소리와 연기 지시문을 정하고 생성합니다.
생성 음성은 저장된 음성 목록에 쌓이며, 목록의 듣기·저장으로 다시 듣거나 WAV를 내려받습니다.

브라우저는 `NOTION_TOKEN`이 없거나 노션 읽기에 실패하면 경고와 함께 저장소 사본을 씁니다. 아래 CLI는 기본 출처가 사본이며, `--source notion`으로 지정한 노션을 읽지 못하면 오류로 끝납니다.

## 터미널 자동화

저장소 루트에서 실행합니다. npm 명령 뒤의 `--` 다음에 CLI 인자를 적습니다.
두 CLI 모두 씬·컷 필터를 반복하면 OR, 서로 다른 종류의 필터를 함께 쓰면 AND로 고릅니다. 필터가 없으면 전체, 일치하는 줄이 없으면 0줄로 끝납니다.

### 대본 점검: `npm run script:lint`

```sh
npm run script:lint
npm run script:lint -- --source notion --scene "S#01" --json --strict
```

대본 출처 경고, 컷 길이 초과 예상, 빠진 대사, 잘못된 컷 길이, 모르는 화자, TTS 대사 불일치, 중복 id를 점검합니다. 기본 사본은 키 없이 점검합니다.
기본 출력은 문제 있는 줄만 담은 표와 전체 요약입니다. `--json`은 `lines`, `warnings`, `summary`를 출력하며, `--all`을 함께 써야 정상 줄도 포함합니다.
한국어 길이는 한글 음절 수를 초당 6음절로 나눈 예측입니다. 숫자는 세지 않으며 영어는 길이를 예측하지 않습니다.

인자는 `server/cli/scriptLintArgs.ts` 기준입니다.

| 인자 | 기본값 | 동작 |
| --- | --- | --- |
| `--source <출처>` | `bundled` | `bundled`(저장소 사본) 또는 `notion` |
| `--scene <씬>` | 전체 | 컷 번호 접두사로 선택. 예: `S#01`. 반복 가능 |
| `--cut <컷>` | 전체 | 컷 번호가 정확히 같은 줄 선택. 예: `S#01-C001`. 반복 가능 |
| `--speaker <id>` | 전체 | 화자 이름 대신 id로 선택. 예: `anchor`, `rabbit`. 반복 가능 |
| `--lang <언어>` | `ko` | `ko` 또는 `en`. 선택한 언어의 빠진 대사 점검 |
| `--json` | 꺼짐 | 결과를 JSON으로 출력 |
| `--strict` | 꺼짐 | 출처 경고나 줄 문제가 있으면 종료 코드 1 |
| `--all` | 꺼짐 | 정상 줄도 결과에 포함 |

종료 코드: **0**은 점검 완료(`--strict`가 없으면 문제가 있어도 0), **1**은 인자·필수 환경 변수 오류 또는 strict 점검 실패, **2**는 노션 읽기 실패 등 실행 오류입니다.

### 음성 생성: `npm run dub`

```sh
npm run dub -- --voice Kore --speaker anchor --scene "S#01" --dry-run
npm run dub -- --voice Kore --speaker anchor --scene "S#01" --style "Read calmly."
npm run dub -- --voice Kore --speaker anchor --source notion --scene "S#01" --lang en --dry-run
```

먼저 `--dry-run`으로 대상과 저장 이름을 확인합니다. 이때 TTS 호출과 파일 쓰기는 없습니다. 실제 생성에는 `GEMINI_API_KEY`가 필요하며 비용·일일 호출 제한을 고려해야 합니다.
한 목소리는 한 화자만 사용하므로 `--speaker`는 한 명만 지정하며, 선택된 줄에 화자가 둘 이상이면 `--dry-run`도 종료 코드 1로 거절합니다.
영어는 `textEn`이 있는 줄만 사용하고, 해당 언어 대사가 없으면 경고 후 건너뜁니다. 번역을 지어 넣지 말고 사용자가 정한 문장을 노션에 먼저 적습니다.

인자는 `server/cli/dubArgs.ts` 기준입니다.

| 인자 | 기본값 | 동작 |
| --- | --- | --- |
| `--source <출처>` | `bundled` | `bundled` 또는 `notion` |
| `--scene <씬>` | 전체 | 컷 번호 접두사로 선택. 반복 가능 |
| `--cut <컷>` | 전체 | 컷 번호가 정확히 같은 줄 선택. 반복 가능 |
| `--speaker <id>` | 전체 | 화자 id 한 명만 선택. 반복 지정 불가 |
| `--voice <이름>` | 없음, 필수 | TTS 목소리 이름. 예: `Kore` |
| `--style <지시문>` | 빈 문자열 | 연기 지시. 줄의 연기 지시가 뒤에 붙고 서버가 언어 지시를 추가 |
| `--lang <언어>` | `ko` | `ko` 또는 `en` |
| `--model-preference <이름>` | 기본 모델 | 현재 생성 코드는 `gemini-3.8-flash-lite-tts`만 별도 선택하며, 그 외에는 `gemini-3.8-flash-tts` 사용 |
| `--out <폴더>` | `out` | WAV 저장 폴더 |
| `--force` | 꺼짐 | 같은 저장 이름이 있어도 다음 버전으로 생성. 기존 파일을 덮어쓰지 않음 |
| `--dry-run` | 꺼짐 | 생성 없이 대상과 저장 이름 확인 |

저장 이름은 `src/data/recordName.ts`를 재사용합니다. 한국어는 `out/<씬>/<컷>-<인물>-<목소리>-v<버전>.wav`이며, `S#01-C001`은 `out/S01/S01-C001-앵커-Kore-v1.wav`가 됩니다. 영어는 목소리 뒤에 `-en`이 붙습니다. `--out`으로 맨 앞 폴더를 바꿉니다.
기존 파일은 기본적으로 건너뛰며, `--force`는 같은 이름의 가장 큰 버전 다음 번호로 저장합니다. 기존 파일 판단에는 지시문과 모델이 포함되지 않으므로 이를 바꿔 다시 생성하려면 `--force`를 사용합니다.

출력 표는 컷, 저장 이름, 실제 음성 길이, 컷 길이, 적합·초과·건너뜀·실패 판정을 담습니다. 초과 컷은 재생 속도가 아니라 대본이나 컷 길이를 고칠 문제입니다.
종료 코드: **0**은 생성·dry-run 완료(건너뜀과 컷 초과 포함), **1**은 인자·필수 환경 변수 오류, **2**는 생성·저장·노션 읽기 등 실행 오류입니다. 한 줄이 생성·저장에 실패해도 다음 줄은 계속 처리합니다.

CLI는 줄 단위로만 생성하고 지정 폴더에 저장합니다. 묶음 생성·무음 자르기는 브라우저에서만 가능합니다.

## 확인

```sh
npm run lint
npm test
npm run build
```

각각 TypeScript 타입 검사(`tsc --noEmit`), 소스 옆 `*.test.ts`의 node:test 실행, Vite 빌드입니다.
`.github/workflows/ci.yml`도 Node 24에서 같은 스크립트를 실행합니다. CI의 실제 명령은 `bun install --frozen-lockfile` 후 `bun run lint`, `bun run test`, `bun run build`입니다.

## 구조

파일별 역할과 알려진 한계는 [AGENTS.md](AGENTS.md)를 참고합니다.

## 저장소 규칙

- 답변과 주석은 한국어로 쓰고 이모지를 쓰지 않습니다.
- 새 출처·저장소·효과는 기존 인터페이스를 구현하며 깊은 의존을 피합니다.
- 대본 정본은 노션의 「녹음 대본 (인물별 대사)」 섹션입니다. 노션 내용과 번역을 지어내지 않습니다.
