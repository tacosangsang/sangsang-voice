// PLATING 녹음 대본. 정본은 노션「스토리보드/컷표」페이지 맨 끝의 "녹음 대본 (인물별 대사)" 섹션이다.
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
  { id: 'flamingo', name: '상류층 홍학' },
  { id: 'backroom-voice', name: '상류층(뒷방, 문틈 너머)' },
  { id: 'jinwoo', name: '진우' },
];

export const PLATING_SCRIPT: ScriptLine[] = [
  { id: "S#01-C001", cut: "S#01-C001", tc: "00:00–00:04", cutSeconds: 4, speaker: "anchor", text: "다음 소식입니다. 어제 낮 기온이 37도까지 치솟으며…", textEn: "Next tonight: temperatures soared to 37 degrees yesterday…", situation: "암전 위 TV 뉴스 시작, 하이컷 필터", mood: "건조한 뉴스" },
  { id: "S#01-C002", cut: "S#01-C002", tc: "00:04–00:08", cutSeconds: 4, speaker: "anchor", text: "…올여름 최고기온 기록을 또다시 경신했습니다.", textEn: "…breaking this summer's record high once again.", situation: "붉어지는 지형 모형, 필터가 빠지며 또렷해짐", mood: "건조한 뉴스" },
  { id: "S#01-C003", cut: "S#01-C003", tc: "00:08–00:14", cutSeconds: 6, speaker: "anchor", text: "밤사이 바닷물이 밀려들면서 해안 구역 세 곳이 추가로 물에 잠겼습니다.", textEn: "Overnight, rising seas flooded three more coastal districts.", situation: "잠긴 해안 마을, 피난 행렬", mood: "건조한 뉴스" },
  { id: "S#01-C004", cut: "S#01-C004", tc: "00:14–00:19", cutSeconds: 5, speaker: "anchor", text: "피난민이 몰리면서 43년째 이어진 영토 분쟁도 격화되고 있습니다.", textEn: "As evacuees pour inland, a 43-year territorial dispute is flaring again.", situation: "국경 철조망", mood: "건조한 뉴스" },
  { id: "S#01-C005", cut: "S#01-C005", tc: "00:19–00:26", cutSeconds: 7, speaker: "anchor", text: "농업 당국은 올해도 곡물 수확량이 0이라고 밝혔습니다. 정부는 사육 곤충 배급을 유지할 방침입니다.", textEn: "Agriculture officials report another zero grain harvest. The government will keep insect rations in place.", situation: "마른 밭, 사육 곤충, 통조림 컨베이어", mood: "건조한 뉴스" },
  { id: "S#01-C006-2A", cut: "S#01-C006-2A", tc: "00:26–00:33", cutSeconds: 7, speaker: "anchor", text: "한편 하층 구역에서는 절도와 실종 신고가 급증하고 있습니다.", textEn: "Meanwhile, reports of theft and missing persons are surging in the lower district.", situation: "쓰레기 더미 속 TV에서 빠지며 골목으로. 방송 음질 → 낡은 스피커 음질 (대안 C006-1은 8s)", mood: "건조한 뉴스" },
  { id: "S#01-C007", cut: "S#01-C007", tc: "00:33–00:36", cutSeconds: 3, speaker: "anchor", text: "당국은 야간 외출 자제를 당부했습니다.", textEn: "Residents are urged to stay in after dark.", situation: "잠긴 구역을 스치는 트럭 숏, TV 음성이 멀어짐", mood: "건조한 뉴스" },
  { id: "S#01-C008", cut: "S#01-C008", tc: "00:36–00:41", cutSeconds: 5, speaker: "anchor", text: "…이어서 날씨입니다. 내일도 전국에 폭염이 계속되겠습니다.", textEn: "…And now the weather. Another scorcher is on the way tomorrow.", situation: "배수 낙하 굉음에 묻히며 작아짐", mood: "날씨 전환" },
  { id: "S#05-C003", cut: "S#05-C003", tc: "05.5–09.5", cutSeconds: 4, speaker: "rabbit", text: "당신의 손이 필요한 곳이 있습니다.", textEn: "There's a place that needs your hands.", situation: "털린 HOPE 판매창 너머에서 진우를 올려다봄. 낮고 공손하게", mood: "낮고 공손" },
  { id: "S#05-C006", cut: "S#05-C006", tc: "13.0–18.5", cutSeconds: 5.5, speaker: "rabbit", text: "위에서는 배급량을 정합니다. 한 접시가 아니라, 이 동네 전체의 몫을요.", textEn: "Up there, they set the rations. Not for one plate. For this whole neighborhood.", situation: "흰 장갑이 멀리 상층 냉각 설비를 가리킴", mood: "낮고 공손" },
  { id: "S#07-C008", cut: "S#07-C008", tc: "19.5–22.5", cutSeconds: 3, speaker: "rabbit", text: "저희가 찾은 요리사입니다.", textEn: "This is the chef we found.", situation: "다른 상류층 눈을 피해 진우를 정화파 수장(공작)에게 넘김. 낮게" },
  { id: "S#07-C018", cut: "S#07-C018", tc: "40.5–43.5", cutSeconds: 3, speaker: "anchor", text: "신이 받은 식탁. 믿음이 배고픔을 이깁니다.", textEn: "The table God received. Faith conquers hunger.", situation: "조리대 옆 모니터, 진우 접시가 편집되어 하층으로 나감. 방송 음질, 작게" },
  { id: "S#08-C002", cut: "S#08-C002", tc: "03.5–07.0", cutSeconds: 3.5, speaker: "flamingo", text: "새가 뭘 알겠어, 그래봤자 새대가리지.", textEn: "What does a bird know? Birdbrain, after all.", situation: "가면을 반쯤 젖히고 웃음, 낮은 웃음이 원탁을 돎" },
  { id: "S#08-C006", cut: "S#08-C006", tc: "21.0–26.0", cutSeconds: 5, speaker: "backroom-voice", text: "…신의 시험이라…", textEn: "…a test from God, is it…", situation: "진우가 서쪽 문틈으로 엿봄. 누군가 되뇌며 웃음, 문 너머라 먹먹하게" },
  { id: "S#09-C001", cut: "S#09-C001", tc: "00:00–04.0", cutSeconds: 4, speaker: "purist-peacock", text: "하층이 본 건 우리 접시였소. 신의 식탁이라고 방송까지 나갔소.", textEn: "Below, they saw our plate. \"God's table,\" on every screen.", situation: "다음 의식 날 다툼. S#08-C008(7.5s)에서 사운드 선행으로 시작해 이 컷에서 끝남" },
  { id: "S#09-C002", cut: "S#09-C002", tc: "04.0–07.5", cutSeconds: 3.5, speaker: "preserver-eagle", text: "신의 눈은 우리 접시에서 커졌소. 방송은 방송일 뿐.", textEn: "God's eyes widened at our plate. Broadcasts mean nothing.", situation: "정화파 수장에게 반박" },
  { id: "S#09-C003", cut: "S#09-C003", tc: "07.5–13.0", cutSeconds: 5.5, speaker: "purist-peacock", text: "그럼 오늘 봅시다, 신이 어느 쪽을 고르는지. 신이 등 돌린 자는 식탁에 앉을 수 없소.", textEn: "We'll see today which one God chooses. Whoever He spurns leaves His table.", situation: "보존파 수장에게 응수" },
  { id: "S#09-C004", cut: "S#09-C004", tc: "13.0–17.5", cutSeconds: 4.5, speaker: "rabbit", text: "신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.", textEn: "God picks one plate of two. A poor rival makes it easier.", situation: "조리대 1, 진우 귓가에 속삭임. 진우를 보지 않고 공물대를 봄" },
  { id: "S#09-C012", cut: "S#09-C012", tc: "41.5–45.5", cutSeconds: 4, speaker: "jinwoo", text: "내가 꼭 꺼내 줄게.", textEn: "I'll get you out. I promise.", situation: "지하 철창, 아이 손에 노란 구슬을 쥐여 줌. 낮게" },
  { id: "S#10-C014", cut: "S#10-C014", tc: "41.7–45.9", cutSeconds: 4.2, speaker: "anchor", text: "버림받은 자가 식탁을 떠났습니다. 신의 뜻은 언제나 옳습니다.", textEn: "The forsaken has left God's table. God's will is always right.", situation: "V.O. 그날 밤 하층 공용 화면, 끌려가는 보존파 수장. 화면이 꺼지고 마지막 문장만 남음" },
  { id: "S#11-C002", cut: "S#11-C002", tc: "04.0–07.0", cutSeconds: 3, speaker: "purist-peacock", text: "신은 더 큰 공물을 원하십니다.", textEn: "God desires a greater offering.", situation: "북쪽 줄 가운데서 선언하며 지하를 가리킴. 생중계 시작, 새장 내 긴 잔향" },
  { id: "S#11-C006", cut: "S#11-C006", tc: "11.5–15.5", cutSeconds: 4, speaker: "anchor", text: "오늘의 공물이 정해졌습니다. 연쇄 절도·납치범들입니다.", textEn: "Today's offerings have been chosen: the serial thieves and kidnappers.", situation: "생중계, 하층 화면의 앵커", mood: "의식 발표" },
  { id: "S#11-C007", cut: "S#11-C007", tc: "15.5–19.5", cutSeconds: 4, speaker: "anchor", text: "이들은 여러분의 배급과 아이들을 빼앗았습니다.", textEn: "They stole your rations and your children.", situation: "V.O. 경비가 공물을 끌고 계단을 오름", mood: "고발" },
  { id: "S#11-C008", cut: "S#11-C008", tc: "19.5–23.5", cutSeconds: 4, speaker: "anchor", text: "현장 증거 사진입니다. 털린 트럭, 사라진 아이들, 이들의 얼굴.", textEn: "Scene evidence: a looted truck, missing children, their faces.", situation: "증거 사진 전환(HOPE, 실종 전단, 같은 얼굴들)", mood: "증거 제시" },
  { id: "S#11-C009", cut: "S#11-C009", tc: "23.5–28.0", cutSeconds: 4.5, speaker: "anchor", text: "신의 뜻을 거스른 자들입니다. 신께서 하층을 정화하실 것입니다.", textEn: "They defied God's will. God will cleanse the lower district.", situation: "V.O. 냅킨 링으로 묶여 공물대에 눕혀짐", mood: "경건한 결론" },
  { id: "S#11-C015", cut: "S#11-C015", tc: "41.0–45.0", cutSeconds: 4, speaker: "rabbit", text: "마무리는 장인께서.", textEn: "The finishing touch, master.", situation: "시계 '틱' 뒤, 진우에게 금색 의식 핀셋을 내밂" },
  { id: "S#14-C001", cut: "S#14-C001", tc: "00:00–08.0", cutSeconds: 8, speaker: "anchor", text: "신을 배신한 요리사가 신의 분노를 샀습니다. 그러나 신께서는 우리 인간을 품으셨습니다.", textEn: "The chef who betrayed God has earned His wrath. But God has embraced us, His humans.", situation: "편집된 선전 방송, 환호·효과음 섞임" },
  { id: "S#14-C008", cut: "S#14-C008", tc: "27.0–29.5", cutSeconds: 2.5, speaker: "rabbit", text: "마무리는 장인께서.", textEn: "The finishing touch, master.", situation: "도둑에게 핀셋과 금 간 구슬을 건넴. S#11-C015와 같은 높낮이" },
  { id: "S#14-C020", cut: "S#14-C020", tc: "62.0–67.0", cutSeconds: 5, speaker: "anchor", text: "신의 시험입니다. 믿음이 부족해 신께서 배급을 줄이셨습니다.", textEn: "A test from God. Our faith fell short, so He cut our rations.", situation: "하층 공용 화면 아래 배급 벌레를 씹는 같은 얼굴들. 다음 컷 통조림 둘로 이어짐" },
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
