// PLATING 기본 씬: 녹음 대본에 대사가 있는 씬만 둔다.
// 씬 이름·요약·장소는 노션 씬 목록(컷표 페이지의 씬 DB) 그대로다. 대표 대사는 지어내지 않고 대본의 그 씬 첫 줄을 쓴다.
// 씬 그림은 아직 없다(imageUrl 빈 값). 확정된 그림이 생기면 public/assets/scenes/에 넣고 여기에 경로를 적는다.

import { SceneItem } from '../types';
import { PLATING_SCRIPT, SPEAKERS } from './platingScript';

interface PlatingScene {
  /** 노션 씬번호, 예: S#01. 대본 줄 id의 앞부분과 같다. */
  number: string;
  title: string;
  location: string;
  summary: string;
}

const PLATING_SCENES: PlatingScene[] = [
  {
    number: 'S#01',
    title: '오프닝',
    location: '하층 골목, HOPE 푸드트럭',
    summary: '검은 화면 위 TV 기후 뉴스. 반쯤 잠긴 하층 골목, 뜨거운 배수. 골목 끝 HOPE 푸드트럭, 타이틀 〈PLATING〉, 진우의 손.',
  },
  {
    number: 'S#05',
    title: '토끼 가면 — 미끼',
    location: '털린 HOPE 앞, 검은 차',
    summary: '흰 토끼 가면의 제안. 검은 차의 손자국과 팔찌 실로 진우는 함정임을 반쯤 알면서도 아이를 위해 차에 탄다.',
  },
  {
    number: 'S#07',
    title: '신의 식탁',
    location: '새장 스탠드, 접시 아래 통로, 연회장(조리대 1, 2, 나무 공물대)',
    summary:
      '새장 스탠드. 상류층은 엘리베이터, 진우는 계단. 토끼가 진우를 정화파 수장에게 넘겨 스파이 요리사로 심는다. 두 파벌 요리사가 공물을 만들고(진우 조리대 1, 보존파 요리사 조리대 2), 계시는 보존파. 방송에는 진우의 접시가 편집되어 선동으로 나간다.',
  },
  {
    number: 'S#08',
    title: '바지사장',
    location: '고목 속 빈 방(뒷방)',
    summary:
      '고목 속 뒷방. 상류층이 가면을 젌히고 "새가 뭘 알겠소". 계시를 얻은 보존파가 배급량을 정한다. 배급표 3 → 2, 상층 몸은 그대로. 발표 문구는 "신의 시험". 진우가 서쪽 문 틈으로 본다.',
  },
  {
    number: 'S#09',
    title: '정치싸움',
    location: '연회장 테이블, 나선 계단, 지하 철창',
    summary: '보존파와 정화파의 싸움. 토끼의 지시. 지하 철창에서 실 팔찌로 아이를 찾고 노란 구슬을 쥐여 준다. "꺼내 줄게."',
  },
  {
    number: 'S#10',
    title: '타협',
    location: '지하 철창, 연회장(나무 공물대 아래 단, 카메라 레일), 하층 HOPE',
    summary:
      '진우가 보존파 요리사의 흰 접시에서 색 있는 요소를 몰래 빼고, 포투는 회색 접시를 외면한다. 계시가 정화파로, 토끼가 심은 패가 작동한다. 보존파 수장은 지하 철창으로. 하층에선 도둑이 방송을 보며 진우를 흉내 낸다.',
  },
  {
    number: 'S#11',
    title: '인간 공물',
    location: '연회장(나무 공물대, 조리대 1, 2), 하층 TV',
    summary:
      '정화파가 권력을 잡고 "더 큰 공물". 진우는 조리대 2로, 보존파 요리사는 조리대 1로. 지하 철창의 사람들이 공물대 위에 나란히 눕혀진다. 그 사이에 가면 벗겨진 보존파 수장, 맨 앞은 아이. "마무리는 장인께서."',
  },
  {
    number: 'S#14',
    title: '마지막 공물 / 엔딩',
    location: '연회장(공물대, 조리대 2), 하층 HOPE',
    summary:
      '공물대 위 접시에 진우. 진우의 앞치마를 입고 진우의 조리대 2에 선 도둑(같은 얼굴의 하층민)이 진우를 플레이팅하고 노란 구슬을 올린다. 포투 시점의 지네. 하층의 통조림은 둘, HOPE에 다시 불, 줄 끝의 토끼. 〈PLATING〉',
  },
];

function toSceneItem(scene: PlatingScene): SceneItem {
  const firstLine = PLATING_SCRIPT.find((line) => line.id.startsWith(`${scene.number}-`));
  if (!firstLine) throw new Error(`${scene.number}에 대사가 없습니다. 대사 있는 씬만 기본 씬에 둡니다.`);
  const speakerName = SPEAKERS.find((s) => s.id === firstLine.speaker)?.name ?? firstLine.speaker;
  return {
    id: scene.number,
    title: scene.title,
    subtitle: `${scene.number} · ${scene.location}`,
    imageUrl: '',
    defaultSpeaker: speakerName,
    defaultQuote: firstLine.text,
    characterTagRight: speakerName,
    directorsNote: scene.summary,
  };
}

export const DEFAULT_SCENES: SceneItem[] = PLATING_SCENES.map(toSceneItem);
