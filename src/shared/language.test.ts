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

test('상속된 속성 이름은 언어로 보지 않는다', () => {
  assert.equal(toLanguage('toString'), 'ko');
});
