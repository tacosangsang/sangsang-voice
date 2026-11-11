import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ScriptLine } from '../data/platingScript';
import { lineText, PLATING_SCRIPT } from '../data/platingScript';
import { batchRequest, groupConsecutiveLines } from './lineGroups';
import type { ScriptLineGroup } from './lineGroups';

const first: ScriptLine = {
  id: 'S#01-C001', cut: 'S#01-C001', tc: '', cutSeconds: 4,
  speaker: 'anchor', text: '첫 대사.', situation: '', mood: '차분함',
};
const second: ScriptLine = { ...first, id: 'S#01-C002', cut: 'S#01-C002', text: '다음 대사.' };
const third: ScriptLine = { ...first, id: 'S#01-C003', cut: 'S#01-C003', text: '끝 대사.' };

test('입력이 섞여 있어도 식별자 순서로 줄을 묶는다', () => {
  const groups = groupConsecutiveLines([third, first, second]);
  assert.deepEqual(groups.flatMap((group) => group.lines.map((line) => line.id)), [first.id, second.id, third.id]);
});

test('같은 씬과 화자와 감정이 이어지면 한 묶음이다', () => {
  const groups = groupConsecutiveLines([first, second]);
  assert.deepEqual(groups, [{ id: `${first.id}~${second.id}`, scene: 'S#01', speaker: 'anchor', lines: [first, second] }]);
});

for (const ellipsis of ['…', '...']) {
  test(`앞 줄이 ${ellipsis}로 끝나면 묶음을 끊는다`, () => {
    const lines = [{ ...first, text: `첫 대사${ellipsis}  ` }, second, third];
    assert.deepEqual(groupConsecutiveLines(lines).map((group) => group.lines.map((line) => line.id)), [
      [first.id], [second.id, third.id],
    ]);
  });

  test(`다음 줄이 ${ellipsis}로 시작하면 묶음을 끊는다`, () => {
    const lines = [first, { ...second, text: `  ${ellipsis}다음 대사.` }, third];
    assert.deepEqual(groupConsecutiveLines(lines).map((group) => group.lines.map((line) => line.id)), [
      [first.id], [second.id, third.id],
    ]);
  });
}

test('문장 안의 말줄임표는 묶음을 끊지 않는다', () => {
  assert.deepEqual(groupConsecutiveLines([{ ...first, text: '첫… 대사.' }, second]).map((group) => group.lines.length), [2]);
});

test('사본 대본의 S#01 앵커는 C001, C002~C007, C008 세 묶음이다', () => {
  const lines = PLATING_SCRIPT.filter((line) => line.id.startsWith('S#01-') && line.speaker === 'anchor');
  assert.deepEqual(groupConsecutiveLines(lines).map((group) => group.lines.map((line) => line.id)), [
    ['S#01-C001'],
    ['S#01-C002', 'S#01-C003', 'S#01-C004', 'S#01-C005', 'S#01-C006-2A', 'S#01-C007'],
    ['S#01-C008'],
  ]);
});

for (const [label, mood] of [['없는 감정', undefined], ['빈 감정', '']] as const) {
  test(`${label}인 줄은 각각 혼자 묶인다`, () => {
    assert.deepEqual(groupConsecutiveLines([{ ...first, mood }, { ...second, mood }]).map((group) => group.lines.length), [1, 1]);
  });
}

test('감정이 바뀌면 묶음이 끊긴다', () => {
  assert.equal(groupConsecutiveLines([first, { ...second, mood: '불안' }]).length, 2);
});

test('다른 화자가 끼면 같은 화자의 대사도 떨어진다', () => {
  assert.deepEqual(groupConsecutiveLines([first, { ...second, speaker: 'rabbit' }, third]).map((group) => group.lines.length), [1, 1, 1]);
});

test('씬이 바뀌면 묶음이 끊긴다', () => {
  assert.equal(groupConsecutiveLines([first, { ...second, id: 'S#02-C001' }]).length, 2);
});

test('한 줄 묶음도 첫 식별자와 끝 식별자를 물결표로 잇는다', () => {
  assert.equal(groupConsecutiveLines([first])[0].id, `${first.id}~${first.id}`);
});

test('빈 대본은 빈 묶음 목록이다', () => {
  assert.deepEqual(groupConsecutiveLines([]), []);
});

const group: ScriptLineGroup = {
  id: `${first.id}~${third.id}`, scene: 'S#01', speaker: 'anchor',
  lines: [
    { ...first, ttsText: '<sigh> 첫 대사.', textEn: 'First.', direction: '낮게' },
    second,
    { ...third, textEn: 'Last.', direction: '또렷하게' },
  ],
};
const batchInstruction = 'These are separate lines read one after another. Leave a clear silence of about one second between lines.';

for (const language of ['ko', 'en'] as const) {
  test(`묶음 대사는 ${language === 'ko' ? '한국어' : '영어'} 줄별 선택 결과와 같다`, () => {
    assert.deepEqual(batchRequest(group, '', language).texts, group.lines.map((line) => lineText(line, language)));
  });
}

test('지시문은 앞뒤 공백을 빼고 묶음 지시와 연기 지시를 줄 순서로 잇는다', () => {
  assert.equal(batchRequest(group, '  차분하게\n', 'ko').stylePrompt,
    `차분하게 ${batchInstruction} Line 1: 낮게 Line 3: 또렷하게`);
});

test('빈 지시문은 앞에 빈 조각을 남기지 않는다', () => {
  assert.equal(batchRequest({ ...group, lines: [first] }, ' \n ', 'ko').stylePrompt, batchInstruction);
});
