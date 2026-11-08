import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliArgumentError, parseDubArgs } from './dubArgs';

test('필수 목소리가 없으면 한국어 인자 오류를 낸다', () => {
  assert.throws(() => parseDubArgs([]), (error) =>
    error instanceof CliArgumentError && error.message.includes('--voice'));
});

test('목소리만 주면 사본·한국어·out·빈 지시문을 쓴다', () => {
  assert.deepEqual(parseDubArgs(['--voice', 'Kore']), {
    source: 'bundled', scenes: [], cuts: [], speakers: [], voiceName: 'Kore',
    stylePrompt: '', language: 'ko', modelPreference: undefined, out: 'out', force: false, dryRun: false, batch: false, noUpload: false,
  });
});

test('씬·컷 반복 필터와 모든 선택 인자를 해석한다', () => {
  assert.deepEqual(parseDubArgs([
    '--voice', 'Kore', '--source', 'notion', '--scene', 'S#01', '--scene', 'S#05',
    '--cut', 'S#01-C001', '--cut', 'S#05-C003', '--speaker', 'anchor',
    '--style', 'Speak softly.', '--lang', 'en', '--model-preference', 'gemini-3.8-flash-lite-tts',
    '--out', '녹음', '--force', '--dry-run', '--batch', '--no-upload',
  ]), {
    source: 'notion', scenes: ['S#01', 'S#05'], cuts: ['S#01-C001', 'S#05-C003'],
    speakers: ['anchor'], voiceName: 'Kore', stylePrompt: 'Speak softly.', language: 'en',
    modelPreference: 'gemini-3.8-flash-lite-tts', out: '녹음', force: true, dryRun: true, batch: true, noUpload: true,
  });
});

test('--speaker를 둘 이상 지정하면 인자 오류를 낸다', () => {
  assert.throws(() => parseDubArgs(['--voice', 'Kore', '--speaker', 'anchor', '--speaker', 'rabbit']),
    CliArgumentError);
});

for (const args of [
  ['--source', 'other'], ['--lang', 'ja'], ['--voice', ' '], ['--scene', ''],
  ['--out', ' '], ['--unknown'], ['--cut'], ['위치인자'], ['--force=true'],
]) {
  test(`잘못된 인자는 거절한다: ${JSON.stringify(args)}`, () => {
    assert.throws(() => parseDubArgs(['--voice', 'Kore', ...args]), CliArgumentError);
  });
}
