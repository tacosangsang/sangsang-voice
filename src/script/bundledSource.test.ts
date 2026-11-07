import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLATING_SCRIPT, SPEAKERS } from '../data/platingScript';
import { BundledScriptSource } from './bundledSource';

test('저장소 사본 출처는 bundled이다', () => {
  assert.equal(new BundledScriptSource().origin, 'bundled');
});

test('저장소 사본은 기존 화자와 대본 객체를 경고 없이 반환한다', async () => {
  const snapshot = await new BundledScriptSource().load();
  assert.equal(snapshot.origin, 'bundled');
  assert.equal(snapshot.speakers, SPEAKERS);
  assert.equal(snapshot.lines, PLATING_SCRIPT);
  assert.deepEqual(snapshot.warnings, []);
});

test('저장소 사본을 읽은 시각은 호출 시작과 종료 사이에 있다', async () => {
  const before = Date.now();
  const snapshot = await new BundledScriptSource().load();
  const after = Date.now();
  assert.ok(snapshot.loadedAt >= before && snapshot.loadedAt <= after);
});
