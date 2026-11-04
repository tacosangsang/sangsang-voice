// 실시간 재생(AudioContext)과 내보내기(OfflineAudioContext)가 같은 효과 정의를 쓰도록 하는 인터페이스.
// 새 효과(EQ, 라디오 필터 등)는 AudioEffect를 구현해 EFFECT 목록에 더하면 내보내기에도 그대로 들어간다.

export interface AudioEffect {
  readonly id: string;
  /** input(대사 신호)을 받아 output에 섞는다. durationSec은 렌더 길이(오실레이터 정지 시각용). */
  attach(ctx: BaseAudioContext, input: AudioNode, output: AudioNode, durationSec: number): void;
}

export function buildImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * decay);
    }
  }
  return impulse;
}

export const REVERB_TAIL_SEC = 2.5;

/** 원음(dry)은 그대로 두고 잔향(wet)만 amount 비율로 더한다. 실시간 엔진의 setReverb와 같은 계수. */
export class ReverbEffect implements AudioEffect {
  readonly id = 'reverb';
  constructor(private readonly amount: number) {}

  attach(ctx: BaseAudioContext, input: AudioNode, output: AudioNode): void {
    const dry = ctx.createGain();
    dry.gain.value = 1;
    input.connect(dry).connect(output);

    if (this.amount <= 0) return;
    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulseResponse(ctx, REVERB_TAIL_SEC, 2.0);
    const wet = ctx.createGain();
    wet.gain.value = Math.min(Math.max(this.amount, 0), 1) * 0.8;
    input.connect(convolver).connect(wet).connect(output);
  }
}

/** 55Hz 저음 드론. 대사 신호와 무관하게 output에 직접 더한다. */
export class DroneEffect implements AudioEffect {
  readonly id = 'drone';

  attach(ctx: BaseAudioContext, _input: AudioNode, output: AudioNode, durationSec: number): void {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.exponentialRampToValueAtTime(0.12, Math.min(1.5, durationSec));
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 54.6;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(output);
    osc1.start(0);
    osc2.start(0);
    osc1.stop(durationSec);
    osc2.stop(durationSec);
  }
}
