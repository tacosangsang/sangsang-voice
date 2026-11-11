import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SCENES } from './defaultScenes';

test('기본 씬은 대본 사본으로 만들어지고 각 씬은 대표 대사를 가진다', () => {
  assert.ok(DEFAULT_SCENES.length > 0);
  for (const scene of DEFAULT_SCENES) assert.ok(scene.defaultQuote.trim(), scene.id);
});

test('대사가 빠진 S#10은 기본 씬에서 빠지고 옛 씬번호를 괄호에 둔 S#07은 남는다', () => {
  const ids = DEFAULT_SCENES.map((scene) => scene.id);
  assert.ok(!ids.includes('S#10'));
  assert.ok(ids.includes('S#07'));
});
