import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliArgumentError } from './dubArgs';
import { parseScriptLintArgs } from './scriptLintArgs';

test('인자가 없으면 사본·한국어·문제 줄만 점검한다', () => {
  assert.deepEqual(parseScriptLintArgs([]), {
    source: 'bundled', scenes: [], cuts: [], speakers: [], language: 'ko',
    json: false, strict: false, all: false,
  });
});

test('반복 필터와 노션·영어·JSON·strict·all을 해석한다', () => {
  assert.deepEqual(parseScriptLintArgs([
    '--source', 'notion', '--scene', 'S#01', '--scene', 'S#05',
    '--cut', 'S#01-C001', '--cut', 'S#05-C003',
    '--speaker', 'anchor', '--speaker', 'rabbit', '--lang', 'en', '--json', '--strict', '--all',
  ]), {
    source: 'notion', scenes: ['S#01', 'S#05'], cuts: ['S#01-C001', 'S#05-C003'],
    speakers: ['anchor', 'rabbit'], language: 'en', json: true, strict: true, all: true,
  });
});

for (const args of [
  ['--source', 'other'], ['--lang', 'ja'], ['--scene', ''], ['--cut', ' '],
  ['--speaker', ' '], ['--unknown'], ['--cut'], ['위치인자'], ['--strict=true'],
]) {
  test(`잘못된 점검 인자를 거절한다: ${JSON.stringify(args)}`, () => {
    assert.throws(() => parseScriptLintArgs(args), CliArgumentError);
  });
}
