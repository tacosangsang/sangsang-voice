import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toLanguage } from './language';

for (const [label, value, expected] of [
  ['한국어', 'ko', 'ko'], ['영어', 'en', 'en'], ['모르는 문자열', 'fr', 'ko'],
  ['없는 값', undefined, 'ko'], ['숫자', 7, 'ko'],
] as const) {
  test(`언어 선택: ${label}`, () => {
    assert.equal(toLanguage(value), expected);
  });
}

test('상속된 속성 이름도 언어로 통과시키는 현재 동작을 기록한다', () => {
  // 의심 버그: 지원하지 않는 언어이므로 한국어가 기대되지만 원문이 반환된다.
  assert.equal(toLanguage('toString'), 'toString');
});
