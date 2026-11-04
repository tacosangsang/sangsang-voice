import { SceneItem } from '../types';

export const DEFAULT_SCENES: SceneItem[] = [
  {
    id: 'scene-whisper',
    title: '토끼 가면의 속삭임',
    subtitle: 'SCENE 02 • 유혹의 시작',
    imageUrl: '/assets/aistudio/image_207cebbc.png',
    defaultSpeaker: '토끼 가면의 신사 (The White Rabbit)',
    defaultQuote: '신은 두 접시 중 하나만 고릅니다. 다른 하나가 초라하면 더 쉽겠지요.',
    characterTagLeft: '고뇌하는 셰프 (The Weary Chef)',
    characterTagRight: '토끼 가면의 신사 (The White Rabbit)',
    redEyeGlowPosition: { top: '38%', right: '28%' },
    directorsNote:
      '하얀 정장을 입고 붉은 눈의 토끼 가면을 쓴 의문의 신사가 지친 요리사의 귀에 다가가 냉소적인 제안을 건네는 순간. 스스로의 완벽함 대신 경쟁자를 파멸시키라는 악마의 제안.',
  },
  {
    id: 'scene-silver-platters',
    title: '두 접시의 시험',
    subtitle: 'SCENE 01 • 은쟁반의 비밀',
    imageUrl: '/assets/scenes/scene_silver_platters.jpg',
    defaultSpeaker: '토끼 가면의 신사 (The White Rabbit)',
    defaultQuote: '두 개의 은쟁반. 하나는 완벽해야 하고, 다른 하나는 비참하게 망가져야 합니다.',
    characterTagLeft: '선택받을 접시 (Divine Platter)',
    characterTagRight: '희생될 접시 (The Sacrificial)',
    directorsNote:
      '어두운 주방 조리대 위에 놓인 두 개의 앤틱 은쟁반. 뚜껑 사이로 뿜어져 나오는 붉은 기운과 심판의 순간을 앞둔 서늘한 정적.',
  },
  {
    id: 'scene-rabbit-closeup',
    title: '붉은 눈의 정체',
    subtitle: 'SCENE 03 • 가면 뒤의 미소',
    imageUrl: '/assets/scenes/scene_rabbit_closeup.jpg',
    defaultSpeaker: '토끼 가면의 신사 (The White Rabbit)',
    defaultQuote: '눈을 피하지 마세요. 당신이 원하던 승리가 바로 눈앞에 있습니다.',
    characterTagLeft: '새하얀 턱시도 (White Suit)',
    characterTagRight: '붉은 루비 눈동자 (Ruby Eyes)',
    redEyeGlowPosition: { top: '39%', right: '37%' },
    directorsNote:
      '새하얀 정장과 붉은 유리 눈알을 번뜩이며 차갑게 응시하는 토끼 가면의 초근접 클로즈업. 거부할 수 없는 악마적 매혹과 냉혹한 응시.',
  },
  {
    id: 'scene-chef-despair',
    title: '셰프의 고뇌와 칼날',
    subtitle: 'SCENE 04 • 떨리는 손',
    imageUrl: '/assets/scenes/scene_chef_despair.jpg',
    defaultSpeaker: '고뇌하는 셰프 (The Weary Chef)',
    defaultQuote: '이 손으로... 내가 평생 쌓아온 모든 것을 더럽혀야 한단 말인가?',
    characterTagLeft: '식칼을 쥔 떨리는 손',
    characterTagRight: '촛불 아래의 번민',
    directorsNote:
      '땀과 밀가루로 얼룩진 옷을 입고 칼을 든 채 번민하는 클레이 애니메이션 셰프. 도덕적 순수성과 승리의 유혹 사이에서의 처절한 내적 갈등.',
  },
  {
    id: 'scene-judgment-hall',
    title: '어둠 속 심판관의 만찬',
    subtitle: 'SCENE 05 • 최후의 만찬',
    imageUrl: '/assets/scenes/scene_judgment_hall.jpg',
    defaultSpeaker: '어둠의 심판관 (The Grand Judge)',
    defaultQuote: '촛불이 꺼지기 전에 올려라. 단 하나의 완벽한 접시만을 탐할지니.',
    characterTagLeft: '침묵하는 귀족들 (Silent Guests)',
    characterTagRight: '심판관의 옥좌 (The Throne)',
    directorsNote:
      '검은 벨벳 식탁과 촛대 너머로 어둠 속에 앉아 요리를 기다리는 미지의 심판관들. 자비 없는 판결과 운명의 갈림길.',
  },
];
