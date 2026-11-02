export interface SoundscapeState {
  isActive: boolean;
  frequencyHz: number;
  flareRate: number;
  currentSeverity: string;
  volume: number;
  peakFlux: number;
}

export class SolarSoundscapeGenerator {
  private ctx: AudioContext | null = null;
  private isActive: boolean = false;
  private volume: number = 0.45;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Harmonic Drone Oscillators
  private oscRoot: OscillatorNode | null = null;
  private oscFifth: OscillatorNode | null = null;
  private oscOctave: OscillatorNode | null = null;
  private oscShimmer: OscillatorNode | null = null;
  private lfoFilter: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  // Real-time Audio Spectrum buffer
  private dataArray: Uint8Array<ArrayBuffer> | null = null;

  // State metrics
  private baseFreq: number = 130.81; // C3
  private flareRate: number = 1;
  private currentSeverity: string = 'B';
  private peakFlux: number = 2.5e-7;

  constructor() {
    // Initialized on user gesture
  }

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isActive ? this.volume : 0, this.ctx.currentTime);

      // Analyser Node for visual spectrum display
      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.8;
      const bufferLength = this.analyserNode.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Resonant Lowpass Filter with solar frequency mapping
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(280, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(3.5, this.ctx.currentTime);

      // LFO for breathing cosmic undulation
      this.lfoFilter = this.ctx.createOscillator();
      this.lfoFilter.type = 'sine';
      this.lfoFilter.frequency.setValueAtTime(0.18, this.ctx.currentTime);

      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(60, this.ctx.currentTime);

      this.lfoFilter.connect(this.lfoGain);
      this.lfoGain.connect(this.filterNode.frequency);
      this.lfoFilter.start();

      this.setupDrones();

      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.analyserNode);
      this.analyserNode.connect(this.ctx.destination);
    } catch {
      // Audio context unavailable
    }
  }

  private setupDrones(): void {
    if (!this.ctx || !this.filterNode) return;
    const now = this.ctx.currentTime;

    // Root fundamental
    this.oscRoot = this.ctx.createOscillator();
    this.oscRoot.type = 'sine';
    this.oscRoot.frequency.setValueAtTime(this.baseFreq, now);

    // Harmonic fifth (3:2 ratio)
    this.oscFifth = this.ctx.createOscillator();
    this.oscFifth.type = 'triangle';
    this.oscFifth.frequency.setValueAtTime(this.baseFreq * 1.5, now);
    const fifthGain = this.ctx.createGain();
    fifthGain.gain.setValueAtTime(0.35, now);
    this.oscFifth.connect(fifthGain);
    fifthGain.connect(this.filterNode);

    // Octave overtone
    this.oscOctave = this.ctx.createOscillator();
    this.oscOctave.type = 'sine';
    this.oscOctave.frequency.setValueAtTime(this.baseFreq * 2, now);
    const octaveGain = this.ctx.createGain();
    octaveGain.gain.setValueAtTime(0.2, now);
    this.oscOctave.connect(octaveGain);
    octaveGain.connect(this.filterNode);

    // Sub-bass warmth
    this.oscShimmer = this.ctx.createOscillator();
    this.oscShimmer.type = 'sine';
    this.oscShimmer.frequency.setValueAtTime(this.baseFreq * 0.5, now);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.4, now);
    this.oscShimmer.connect(subGain);
    subGain.connect(this.filterNode);

    this.oscRoot.connect(this.filterNode);

    this.oscRoot.start();
    this.oscFifth.start();
    this.oscOctave.start();
    this.oscShimmer.start();
  }

  /**
   * Update synth frequencies based on current flare activity frequency and intensity
   */
  public updateFlareActivity(
    flaresPerHour: number,
    severity: string,
    flux: number,
  ): void {
    this.flareRate = Math.max(1, flaresPerHour);
    this.currentSeverity = severity;
    this.peakFlux = flux;

    // Map flare class to musical pitch:
    // Quiet (A/B): C3 (130.81 Hz)
    // Minor (C): D3 (146.83 Hz) - E3 (164.81 Hz)
    // Moderate (M): G3 (196.00 Hz) - A3 (220.00 Hz)
    // Extreme (X): C4 (261.63 Hz) - E4 (329.63 Hz)
    let targetFreq = 130.81; // C3
    let targetFilter = 260 + this.flareRate * 35;
    let targetQ = 3.0;

    if (severity.startsWith('X') || flux >= 1e-4) {
      targetFreq = 261.63; // C4
      targetFilter = 1800 + Math.min(2000, this.flareRate * 120);
      targetQ = 6.5;
    } else if (severity.startsWith('M') || flux >= 1e-5) {
      targetFreq = 196.0; // G3
      targetFilter = 850 + this.flareRate * 80;
      targetQ = 4.5;
    } else if (severity.startsWith('C') || flux >= 1e-6) {
      targetFreq = 146.83; // D3
      targetFilter = 480 + this.flareRate * 50;
      targetQ = 3.5;
    }

    this.baseFreq = targetFreq;

    if (this.ctx && this.oscRoot && this.filterNode) {
      const now = this.ctx.currentTime;
      this.oscRoot.frequency.setTargetAtTime(targetFreq, now, 0.4);
      if (this.oscFifth) this.oscFifth.frequency.setTargetAtTime(targetFreq * 1.5, now, 0.4);
      if (this.oscOctave) this.oscOctave.frequency.setTargetAtTime(targetFreq * 2, now, 0.4);
      if (this.oscShimmer) this.oscShimmer.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.4);

      this.filterNode.frequency.setTargetAtTime(targetFilter, now, 0.5);
      this.filterNode.Q.setTargetAtTime(targetQ, now, 0.5);
    }
  }

  /**
   * Triggers a momentary celestial chime tone when a flare event is detected or tested
   */
  public triggerFlareChime(_magnitude: string, severity: string): void {
    if (!this.isActive) return;
    if (!this.ctx) this.init();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const chimeOsc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      const chimeFilter = this.ctx.createBiquadFilter();

      // Pitch mapped to flare severity
      let pitch = 392.0; // G4
      if (severity === 'X') pitch = 880.0; // A5
      else if (severity === 'M') pitch = 587.33; // D5
      else if (severity === 'C') pitch = 440.0; // A4

      chimeOsc.type = severity === 'X' ? 'sawtooth' : 'sine';
      chimeOsc.frequency.setValueAtTime(pitch, now);
      chimeOsc.frequency.exponentialRampToValueAtTime(pitch * 0.85, now + 1.2);

      chimeFilter.type = 'bandpass';
      chimeFilter.frequency.setValueAtTime(pitch * 1.2, now);
      chimeFilter.Q.setValueAtTime(severity === 'X' ? 7.0 : 4.0, now);

      const duration = severity === 'X' ? 1.8 : 1.2;
      chimeGain.gain.setValueAtTime(0.001, now);
      chimeGain.gain.linearRampToValueAtTime(severity === 'X' ? 0.35 : 0.22, now + 0.04);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      chimeOsc.connect(chimeFilter);
      chimeFilter.connect(chimeGain);
      chimeGain.connect(this.masterGain);

      chimeOsc.start(now);
      chimeOsc.stop(now + duration + 0.1);
    } catch {
      // Ignored
    }
  }

  public toggle(): boolean {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isActive = !this.isActive;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isActive ? this.volume : 0,
        this.ctx.currentTime,
        0.08,
      );
    }

    return this.isActive;
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && this.isActive) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getByteFrequencyData(): Uint8Array<ArrayBuffer> | null {
    if (!this.analyserNode || !this.dataArray) return null;
    this.analyserNode.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }

  public getState(): SoundscapeState {
    return {
      isActive: this.isActive,
      frequencyHz: Math.round(this.baseFreq),
      flareRate: this.flareRate,
      currentSeverity: this.currentSeverity,
      volume: this.volume,
      peakFlux: this.peakFlux,
    };
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
    this.isActive = false;
  }
}
