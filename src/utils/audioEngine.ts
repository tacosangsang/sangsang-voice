export class CinematicAudioEngine {
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private masterGain: GainNode | null = null;

  // Atmospheric drone nodes
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneActive = false;

  public init(audioEl: HTMLAudioElement) {
    if (this.audioElement === audioEl && this.ctx) return;
    this.audioElement = audioEl;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    try {
      this.sourceNode = this.ctx.createMediaElementSource(audioEl);
    } catch {
      // already attached or failed
      return;
    }

    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();

    // Create algorithmic impulse response for cinematic hall reverb
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this.buildImpulseResponse(this.ctx, 2.5, 2.0);

    // Route: source -> dryGain -> analyser -> master -> destination
    //        source -> convolver -> wetGain -> analyser
    this.sourceNode.connect(this.dryGain);
    this.sourceNode.connect(this.convolver);
    this.convolver.connect(this.wetGain);

    this.dryGain.connect(this.analyserNode);
    this.wetGain.connect(this.analyserNode);
    this.analyserNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.setReverb(0.35); // Default subtle cinematic room reverb
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setReverb(amount: number) {
    if (!this.wetGain || !this.dryGain || !this.ctx) return;
    const wetVal = Math.min(Math.max(amount, 0), 1) * 0.8;
    this.wetGain.gain.setValueAtTime(wetVal, this.ctx.currentTime);
    this.dryGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
  }

  public toggleDrone(enable: boolean) {
    if (!this.ctx) return;
    if (enable && !this.droneActive) {
      this.startDrone();
    } else if (!enable && this.droneActive) {
      this.stopDrone();
    }
  }

  private startDrone() {
    if (!this.ctx) return;
    this.resume();

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.droneGain.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 1.5);

    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.setValueAtTime(54.6, this.ctx.currentTime); // subtle beating

    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);

    this.droneOsc1.start();
    this.droneOsc2.start();
    this.droneActive = true;
  }

  private stopDrone() {
    if (!this.ctx || !this.droneGain) return;
    this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, this.ctx.currentTime);
    this.droneGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
    setTimeout(() => {
      try {
        this.droneOsc1?.stop();
        this.droneOsc2?.stop();
        this.droneOsc1?.disconnect();
        this.droneOsc2?.disconnect();
        this.droneGain?.disconnect();
      } catch {}
      this.droneActive = false;
    }, 850);
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyserNode) {
      return new Uint8Array(32);
    }
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  private buildImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const factor = Math.exp(-n * decay);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }
    return impulse;
  }
}

export const audioEngine = new CinematicAudioEngine();
