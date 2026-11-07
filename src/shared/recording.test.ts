import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRecordingStore, recordingAudioUrl } from './recording';

for (const [label, value, expected] of [
  ['클립 저장소', 'clips', true], ['다른 저장소', 'auditions', false],
  ['빈 이름', '', false], ['대문자 이름', 'CLIPS', false],
] as const) {
  test(`저장소 이름 판별: ${label}`, () => {
    assert.equal(isRecordingStore(value), expected);
  });
}

for (const [label, id, encoded] of [
  ['구분자', 'a|b', 'a%7Cb'], ['한글', '음성', '%EC%9D%8C%EC%84%B1'],
  ['경로 구분자', 'a/b', 'a%2Fb'],
] as const) {
  test(`음성 주소에서 식별자를 인코딩한다: ${label}`, () => {
    assert.equal(recordingAudioUrl('clips', id), `/api/recordings/clips/${encoded}/audio`);
  });
}
