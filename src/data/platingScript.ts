// PLATING 녹음 대본. 정본은 노션「스토리보드/컷표」페이지 맨 끝의 "녹음 대본 (인물별 대사)" 섹션이다.
// 2026-11-11 노션 기준
// 앱은 노션에서 바로 읽는다(src/script/). 이 파일은 노션 토큰이 없거나 읽기에 실패했을 때 쓰는 사본이다.
// 이 파일을 먼저 고치지 않는다. 영어 대사(textEn)도 노션 표의 "영어 대사" 칸에서 읽는다.

import { DialogueLanguage } from '../shared/language';

/** 아는 화자는 아래 SPEAKERS의 id, 노션에 새로 생긴 화자는 "notion:이름" */
export type SpeakerId = string;

export interface Speaker {
  id: SpeakerId;
  /** 노션 섹션의 화자 이름(굵은 글씨)과 똑같아야 노션 줄이 이 화자로 묶인다 */
  name: string;
}

export interface ScriptLine {
  /** 컷 번호 (예: S#09-C004). 한 컷에 대사 하나라 id로 쓴다. */
  id: string;
  cut: string;
  tc: string;
  /** 컷표의 컷 길이(초) */
  cutSeconds: number;
  speaker: SpeakerId;
  /** 한국어 대사 (정본) */
  text: string;
  /** 영어 대사. 없으면 직접 입력 */
  textEn?: string;
  situation: string;
  /** 노션 "TTS 대사" 칸: 한국어 대사에 <sigh> <short pause> 같은 태그만 넣은 문장. 태그를 빼면 text와 같아야 한다. */
  ttsText?: string;
  /** 노션 "연기 지시" 칸: 이 줄만의 디렉션. 화자 프리셋 지시문 뒤에 붙는다. */
  direction?: string;
  /** 노션 "감정" 칸: 짧은 감정 이름. 같은 씬·같은 화자·같은 감정이 이어지는 줄만 TTS 한 번으로 묶어 뽑는다. */
  mood?: string;
}

export const SPEAKERS: Speaker[] = [
  { id: 'anchor', name: '앵커' },
  { id: 'rabbit', name: '토끼' },
  { id: 'purist-peacock', name: '정화파 수장(공작)' },
  { id: 'preserver-eagle', name: '보존파 수장(독수리)' },
  { id: 'purist-swan', name: '정화파 귀족(백조)' },
  { id: 'flamingo', name: '상류층 홍학' },
  { id: 'backroom-voice', name: '상류층(뒷방, 문틈 너머)' },
  { id: 'jinwoo', name: '진우' },
];

export const PLATING_SCRIPT: ScriptLine[] = [
  { id: "S#01-C001", cut: "S#01-C001", tc: "00:00.0–00:04.0", cutSeconds: 4, speaker: "anchor", text: "다음 소식입니다. 어제 낮 기온이 37도까지 치솟으며…", textEn: "Next tonight: temperatures soared to 37 degrees yesterday…", situation: "암전 위 TV 뉴스 시작, 하이컷 필터", mood: "건조한 뉴스" },
  { id: "S#01-C002", cut: "S#01-C002", tc: "00:04.0–00:07.6", cutSeconds: 3.6, speaker: "anchor", text: "…올여름 최고기온 기록을 또다시 경신했습니다.", textEn: "…breaking this summer's record high once again.", situation: "한낮 열기에 바랜 빈 도시 거리, 필터가 빠지며 또렷해짐", mood: "건조한 뉴스" },
  { id: "S#01-C003", cut: "S#01-C003", tc: "00:07.6–00:13.9", cutSeconds: 6.3, speaker: "anchor", text: "밤사이 바닷물이 밀려들면서 해안 구역 세 곳이 추가로 물에 잠겼습니다.", textEn: "Overnight, rising seas flooded three more coastal districts.", situation: "잠긴 해안 마을 항공, 지붕 위 인물", mood: "건조한 뉴스" },
  { id: "S#01-C004", cut: "S#01-C004", tc: "00:13.9–00:17.0", cutSeconds: 3.1, speaker: "anchor", text: "피난민이 몰리면서 43년째 이어진 영토 분쟁도 격화되고 있습니다.", textEn: "As evacuees pour inland, a 43-year territorial dispute is flaring again.", situation: "철조망 앞 판초 후드 군중", mood: "건조한 뉴스" },
  { id: "S#01-C005", cut: "S#01-C005", tc: "00:17.0–00:24.7", cutSeconds: 7.7, speaker: "anchor", text: "농업 당국은 올해도 곡물 수확량이 0이라고 밝혔습니다. 정부는 사육 곤충 배급을 유지할 방침입니다.", textEn: "Agriculture officials report another zero grain harvest. The government will keep insect rations in place.", situation: "국경 길 항공 부감, 배급 트럭 앞 군중", mood: "건조한 뉴스" },
  { id: "S#01-C006-2A", cut: "S#01-C006-2A", tc: "00:24.7–00:31.6", cutSeconds: 6.9, speaker: "anchor", text: "한편 하층 구역에서는 절도와 실종 신고가 급증하고 있습니다.", textEn: "Meanwhile, reports of theft and missing persons are surging in the lower district.", situation: "쓰레기 더미 속 TV에서 빠지며 골목으로. 방송 음질에서 낡은 스피커 음질로 (대안 C006-1은 8s)", mood: "건조한 뉴스" },
  { id: "S#01-C007", cut: "S#01-C007", tc: "00:31.6–00:35.0", cutSeconds: 3.4, speaker: "anchor", text: "당국은 야간 외출 자제를 당부했습니다.", textEn: "Residents are urged to stay in after dark.", situation: "잠긴 구역을 스치는 트럭 숏, TV 음성이 멀어짐", mood: "건조한 뉴스" },
  { id: "S#05-C003", cut: "S#05-C003", tc: "00:12.8–00:16.0", cutSeconds: 3.2, speaker: "rabbit", text: "잠시, 시간 좀 내주시겠습니까.", textEn: "Excuse me. Could you spare a moment?", situation: "털린 HOPE 앞. 낮고 공손한 톤, 주변 소리가 한 단계 낮아짐", mood: "낮고 공손" },
  { id: "S#05-C006", cut: "S#05-C006", tc: "00:21.0–00:28.6", cutSeconds: 7.6, speaker: "rabbit", text: "당신의 손이 필요한 곳이 있습니다. 같이 가시죠, 위쪽으로.", textEn: "There's a place that needs your hands. Come along, up above.", situation: "낮고 공손한 톤, 주변 소리가 한 단계 낮아짐", mood: "낮고 공손" },
  { id: "RS01-C002 (S#07-C008)", cut: "RS01-C002 (S#07-C008)", tc: "00:06.0–00:11.7", cutSeconds: 5.7, speaker: "rabbit", text: "저희가 찾은 요리사입니다.", textEn: "This is the chef we found.", situation: "공작에게 몸을 숙여 속삭임. 낮게" },
  { id: "RS01-C007-A2 (S#09-C004)", cut: "RS01-C007-A2 (S#09-C004)", tc: "00:39.1–00:50.0", cutSeconds: 10.9, speaker: "rabbit", text: "신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.", textEn: "God picks one plate of two. A poor rival makes it easier.", situation: "조리대 1, 진우 귓가에 속삭임. 진우를 보지 않고 공물대를 봄. 주변음 거의 없음" },
  { id: "RS03-C010 (S#11-C016)", cut: "RS03-C010 (S#11-C016)", tc: "-", cutSeconds: 0, speaker: "rabbit", text: "마무리는 장인께서.", textEn: "The finishing touch, master.", situation: "시계 틱 뒤, 진우에게 금색 의식 핀셋을 내밂" },
  { id: "RS06-C004 (S#14-C008)", cut: "RS06-C004 (S#14-C008)", tc: "27.0–29.5", cutSeconds: 2.5, speaker: "rabbit", text: "마무리는 장인께서.", textEn: "The finishing touch, master.", situation: "도둑에게 핀셋과 금 간 구슬을 건넴. RS03-C010과 같은 높낮이" },
  { id: "RS01-C005", cut: "RS01-C005", tc: "00:16.3–00:24.4", cutSeconds: 8, speaker: "purist-peacock", text: "알고 있겠죠, 신이 등 돌린 자에겐 더 이상 식탁에 앉을 자격이 없다는걸.", textEn: "You know, don't you: whoever God has spurned has no right to sit at His table.", situation: "독수리의 말에 응수 (MCU 리버스, 약간 하이)" },
  { id: "RS01-C006-A2 (S#07-C018)", cut: "RS01-C006-A2 (S#07-C018)", tc: "00:28.7–00:35.7", cutSeconds: 7, speaker: "purist-peacock", text: "날 우습게 만들지 말아야할겁니다.", textEn: "Don't you dare make a fool of me.", situation: "토끼 쪽을 보고 경고" },
  { id: "RS02-C003-A1 (S#08-C002)", cut: "RS02-C003-A1 (S#08-C002)", tc: "00:12.2–00:17.3", cutSeconds: 5.1, speaker: "purist-peacock", text: "이제 방해하는 사람도 없어졌으니, 한결 수월하겠네요,", textEn: "Now that no one's in the way, this should be much easier.", situation: "뒷방 원탁. 흡족한 미소, \"수월하겠네요\"에 손끝으로 탁자를 톡 침" },
  { id: "RS03-C001 (S#11-C002)", cut: "RS03-C001 (S#11-C002)", tc: "-", cutSeconds: 0, speaker: "purist-peacock", text: "신은 더 큰 공물을 원하십니다.", textEn: "God desires a greater offering.", situation: "북쪽 줄 가운데서 선언하며 지하를 가리킴. 새장 내 긴 잔향" },
  { id: "RS01-C004 (S#09-C002-A1)", cut: "RS01-C004 (S#09-C002-A1)", tc: "00:11.7–00:16.3", cutSeconds: 4.6, speaker: "preserver-eagle", text: "준비 되셨으면, 이제 시작하시죠.", textEn: "If you're ready, let's begin.", situation: "MCU 정면" },
  { id: "RS02-C003-A2 (S#08-C002)", cut: "RS02-C003-A2 (S#08-C002)", tc: "00:17.3–00:23.9", cutSeconds: 6.6, speaker: "purist-swan", text: "포투만 우리 생각대로 움직여준다면 다행일텐데요.", textEn: "If only Potoo moves the way we want, that would be fortunate.", situation: "뒷방 원탁. 찻잔을 보며 말하다 \"다행일텐데요\"에 눈을 듦. 이어 화면 밖 홍학의 짧은 코웃음" },
  { id: "RS02-C003-A3 (S#08-C002)", cut: "RS02-C003-A3 (S#08-C002)", tc: "00:23.9–00:29.8", cutSeconds: 5.9, speaker: "flamingo", text: "그냥~ 새가 뭘 알겠어? 그래봤자 새대가리지.", textEn: "What does a bird know? Birdbrain, after all.", situation: "홀더를 만지작거리다 백조를 힐끗 보고 비웃음. 화면에 입이 안 보여 녹음 음성을 편집에서 얹음. 낮은 웃음이 원탁을 돎" },
  { id: "RS02-C011 (S#09-C012)", cut: "RS02-C011 (S#09-C012)", tc: "01:28.3–01:45.7", cutSeconds: 17.5, speaker: "jinwoo", text: "내가 꼭 꺼내 줄게.", textEn: "I'll get you out. I promise.", situation: "지하 철창, 아이 손에 노란 구슬을 쥐여 줌. 낮게" },
];

/** 대사 속도 기준: 초당 약 6음절 */
export const SYLLABLES_PER_SECOND = 6;

/** 한글 음절 수. 숫자는 읽는 법이 제각각이라 세지 않는다(필요하면 대본에 한글로 적는다). */
export function countSyllables(text: string): number {
  return (text.match(/[가-힣]/g) ?? []).length;
}

export interface FitResult {
  /** 실제 음성 길이 - 컷 길이. 양수면 넘침 */
  overSeconds: number;
  fits: boolean;
}

/** 생성된 음성 길이를 컷 길이와 비교한다. */
export function checkFit(line: ScriptLine, audioSeconds: number): FitResult {
  const overSeconds = audioSeconds - line.cutSeconds;
  return { overSeconds, fits: overSeconds <= 0 };
}

/** TTS에 넣을 언어별 대사. 한국어는 태그가 들어간 TTS 대사를 먼저 쓴다. 그 언어 대사가 없으면 undefined */
export function lineText(line: ScriptLine, language: DialogueLanguage): string | undefined {
  return language === 'en' ? line.textEn : line.ttsText ?? line.text;
}

const TAG = /<[^<>]*>/g;
// 태그가 글자나 문장부호에 붙어 있어도, 띄어 쓰여 있어도 같게 보도록 공백은 모두 빼고 비교한다.
const withoutSpaces = (s: string) => s.replace(/\s+/g, '');

/** 태그를 뺀 문장이 원래 대사와 같은지(띄어쓰기는 보지 않는다). 다르면 TTS 대사가 대사를 바꾼 것이다. */
export function ttsTextMatches(text: string, ttsText: string): boolean {
  return withoutSpaces(ttsText.replace(TAG, '')) === withoutSpaces(text);
}

export function findScriptLine(lines: ScriptLine[], id: string | undefined): ScriptLine | undefined {
  return id ? lines.find((l) => l.id === id) : undefined;
}
