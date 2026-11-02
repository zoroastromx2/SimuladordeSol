import type { Vector3 } from 'three';

export class SolarAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private isInitialized: boolean = false;

  // Master Gain
  private masterGain: GainNode | null = null;

  // Solar Low-Frequency Humming
  private humGain: GainNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private oscSub1: OscillatorNode | null = null;
  private oscSub2: OscillatorNode | null = null;
  private oscWarm: OscillatorNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  // Spatial Thermal Crackle
  private crackleGain: GainNode | null = null;
  private crackleFilter: BiquadFilterNode | null = null;
  private cracklePanner: PannerNode | null = null;
  private crackleSource: AudioBufferSourceNode | null = null;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  public init(): void {
    if (this.isInitialized) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupHummingSynth();
      this.setupCrackleSynth();

      this.isInitialized = true;
    } catch {
      // AudioContext unavailable or blocked
    }
  }

  private setupHummingSynth(): void {
    if (!this.ctx || !this.masterGain) return;

    // Filter for deep rumble
    this.humFilter = this.ctx.createBiquadFilter();
    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.setValueAtTime(90, this.ctx.currentTime);
    this.humFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.humGain = this.ctx.createGain();
    this.humGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    // Deep sub oscillators creating acoustic beating
    this.oscSub1 = this.ctx.createOscillator();
    this.oscSub1.type = 'sine';
    this.oscSub1.frequency.setValueAtTime(45, this.ctx.currentTime);

    this.oscSub2 = this.ctx.createOscillator();
    this.oscSub2.type = 'triangle';
    this.oscSub2.frequency.setValueAtTime(50.5, this.ctx.currentTime);

    // Warm overtone
    this.oscWarm = this.ctx.createOscillator();
    this.oscWarm.type = 'sine';
    this.oscWarm.frequency.setValueAtTime(92, this.ctx.currentTime);
    const warmGain = this.ctx.createGain();
    warmGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.oscWarm.connect(warmGain);
    warmGain.connect(this.humFilter);

    // LFO for breathing magma undulation
    this.lfoOsc = this.ctx.createOscillator();
    this.lfoOsc.type = 'sine';
    this.lfoOsc.frequency.setValueAtTime(0.22, this.ctx.currentTime);

    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.setValueAtTime(25, this.ctx.currentTime);
    this.lfoOsc.connect(this.lfoGain);
    this.lfoGain.connect(this.humFilter.frequency);

    this.oscSub1.connect(this.humFilter);
    this.oscSub2.connect(this.humFilter);
    this.humFilter.connect(this.humGain);
    this.humGain.connect(this.masterGain);

    this.oscSub1.start();
    this.oscSub2.start();
    this.oscWarm.start();
    this.lfoOsc.start();
  }

  private setupCrackleSynth(): void {
    if (!this.ctx || !this.masterGain) return;

    // 3D Spatial Panner for probe crackle
    this.cracklePanner = this.ctx.createPanner();
    this.cracklePanner.panningModel = 'HRTF';
    this.cracklePanner.distanceModel = 'inverse';
    this.cracklePanner.refDistance = 1.5;
    this.cracklePanner.maxDistance = 25;
    this.cracklePanner.rolloffFactor = 1.0;

    // Resonant bandpass for electrical / thermal ionization sizzle
    this.crackleFilter = this.ctx.createBiquadFilter();
    this.crackleFilter.type = 'bandpass';
    this.crackleFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    this.crackleFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    // Generate stochastic thermal crackle buffer
    const sampleRate = this.ctx.sampleRate;
    const bufferLength = sampleRate * 3; // 3-second seamless loop
    const buffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferLength; i++) {
      // Sparse heavy-tailed Poisson/Cauchy distribution for crackle spikes
      const r = Math.random();
      if (r > 0.985) {
        // High intensity micro-pop
        data[i] = (Math.random() * 2 - 1) * Math.pow(Math.random(), 3);
      } else if (r > 0.94) {
        // Subtle sizzling grain
        data[i] = (Math.random() * 2 - 1) * 0.15;
      } else {
        data[i] = 0;
      }
    }

    this.crackleSource = this.ctx.createBufferSource();
    this.crackleSource.buffer = buffer;
    this.crackleSource.loop = true;

    this.crackleSource.connect(this.crackleFilter);
    this.crackleFilter.connect(this.cracklePanner);
    this.cracklePanner.connect(this.crackleGain);
    this.crackleGain.connect(this.masterGain);

    this.crackleSource.start();
  }

  /**
   * Updates audio parameters dynamically based on probe position, camera, and heat
   */
  public update(
    probePosition: Vector3,
    cameraPosition: Vector3,
    heatPercentage: number,
    distanceFromSunRadii: number,
  ): void {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    const now = this.ctx.currentTime;
    const heat01 = Math.max(0, Math.min(1, heatPercentage / 100));

    // 1. Modulate Low-Frequency Solar Hum with proximity to the Sun
    if (this.humGain && this.humFilter) {
      // As probe/camera is near the sun, deep rumble gets louder and opens up
      const proximity = Math.max(0, Math.min(1, 1.0 - distanceFromSunRadii / 4.5));
      const targetHumGain = 0.04 + 0.22 * proximity;
      const targetFilterFreq = 80 + 240 * proximity;

      this.humGain.gain.setTargetAtTime(targetHumGain, now, 0.1);
      this.humFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.1);
    }

    // 2. Modulate Spatial Thermal Crackle with Heat
    if (this.crackleGain && this.crackleFilter && this.cracklePanner) {
      // Exponential crackle intensity curve: silent at cold, violent at 98%+
      const crackleIntensity = Math.pow(heat01, 2.2);
      const targetCrackleGain = crackleIntensity * 0.55;

      // Higher heat shifts resonance to higher frequency and sharpness
      const targetCrackleFreq = 1600 + heat01 * 3200;
      const targetCrackleQ = 3.0 + heat01 * 5.0;

      this.crackleGain.gain.setTargetAtTime(targetCrackleGain, now, 0.08);
      this.crackleFilter.frequency.setTargetAtTime(targetCrackleFreq, now, 0.08);
      this.crackleFilter.Q.setTargetAtTime(targetCrackleQ, now, 0.08);

      // Update 3D Panner relative to camera
      if (this.cracklePanner.positionX) {
        this.cracklePanner.positionX.setTargetAtTime(probePosition.x, now, 0.05);
        this.cracklePanner.positionY.setTargetAtTime(probePosition.y, now, 0.05);
        this.cracklePanner.positionZ.setTargetAtTime(probePosition.z, now, 0.05);
      } else {
        // Fallback for older Web Audio implementations
        this.cracklePanner.setPosition(
          probePosition.x,
          probePosition.y,
          probePosition.z,
        );
      }

      // Update AudioListener position
      const listener = this.ctx.listener;
      if (listener.positionX) {
        listener.positionX.setTargetAtTime(cameraPosition.x, now, 0.05);
        listener.positionY.setTargetAtTime(cameraPosition.y, now, 0.05);
        listener.positionZ.setTargetAtTime(cameraPosition.z, now, 0.05);
      } else {
        listener.setPosition(
          cameraPosition.x,
          cameraPosition.y,
          cameraPosition.z,
        );
      }
    }
  }

  /**
   * Triggers an explosive thermal shock sound when the probe disintegrates
   */
  public triggerExplosionSound(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Sub-bass boom oscillator sweeping 90Hz -> 25Hz
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(110, now);
      boomOsc.frequency.exponentialRampToValueAtTime(24, now + 1.4);

      boomGain.gain.setValueAtTime(0.8, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      boomOsc.connect(boomGain);
      boomGain.connect(this.masterGain);
      boomOsc.start(now);
      boomOsc.stop(now + 1.9);

      // 2. White noise explosive burst with resonant sweep
      const noiseBuffer = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate * 2.0,
        this.ctx.sampleRate,
      );
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(3200, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 1.6);
      noiseFilter.Q.setValueAtTime(4.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.65, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noiseSource.start(now);
      noiseSource.stop(now + 1.7);
    } catch {
      // Audio operation error ignored
    }
  }

  public toggleMute(): boolean {
    if (!this.isInitialized) {
      this.init();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : 0.85,
        this.ctx.currentTime,
        0.05,
      );
    }

    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public dispose(): void {
    try {
      if (this.ctx) {
        this.ctx.close();
      }
    } catch {
      // Ignored
    }
    this.ctx = null;
    this.isInitialized = false;
  }
}
