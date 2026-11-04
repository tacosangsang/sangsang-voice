import { AudioEffect, DroneEffect, ReverbEffect, REVERB_TAIL_SEC } from './effects';
import { encodeFloatChannelsToWav } from '../shared/wav';
import { AudioFilterSettings } from '../types';

/** 화면의 효과 설정을 내보내기용 효과 목록으로 바꾼다. 재생 속도는 포함하지 않는다(아래 주석). */
export function effectsFromSettings(settings: Pick<AudioFilterSettings, 'reverb' | 'darkDrone'>): AudioEffect[] {
  const effects: AudioEffect[] = [new ReverbEffect(settings.reverb)];
  if (settings.darkDrone) effects.push(new DroneEffect());
  return effects;
}

/**
 * 음성 파일에 효과를 입혀 WAV로 렌더링한다.
 * 재생 속도는 굽지 않는다: 브라우저 audio 재생은 음높이를 유지한 채 속도만 바꾸지만,
 * Web Audio의 playbackRate는 음높이까지 바뀌어 들은 것과 다른 파일이 나온다.
 * 속도를 파일에 넣으려면 타임 스트레치 라이브러리가 필요하다.
 */
export async function renderWithEffects(audioUrl: string, effects: AudioEffect[]): Promise<Blob> {
  const encoded = await (await fetch(audioUrl)).arrayBuffer();

  // decodeAudioData는 OfflineAudioContext에서도 동작하지만 길이를 알아야 해서 한 번 디코드한다.
  const probe = new OfflineAudioContext(1, 1, 48000);
  const voice = await probe.decodeAudioData(encoded);

  const hasReverb = effects.some((e) => e.id === 'reverb');
  const durationSec = voice.duration + (hasReverb ? REVERB_TAIL_SEC : 0);
  const ctx = new OfflineAudioContext(2, Math.ceil(durationSec * voice.sampleRate), voice.sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = voice;
  for (const effect of effects) effect.attach(ctx, source, ctx.destination, durationSec);
  source.start(0);

  const rendered = await ctx.startRendering();
  const channels = Array.from({ length: rendered.numberOfChannels }, (_, i) => rendered.getChannelData(i));
  const wav = encodeFloatChannelsToWav(channels, rendered.sampleRate);
  return new Blob([wav], { type: 'audio/wav' });
}
