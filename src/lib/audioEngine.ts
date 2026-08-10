export interface AudioDebugState {
  state: AudioContextState | "uninitialized";
  eventCount: number;
  lastEvent: string;
}

type Tone = "entity" | "system" | "warning";

class AudioEngine {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private ambientGain?: GainNode;
  private enabled = true;
  private eventCount = 0;
  private lastEvent = "none";

  getDebugState(): AudioDebugState {
    return {
      state: this.context?.state ?? "uninitialized",
      eventCount: this.eventCount,
      lastEvent: this.lastEvent,
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.masterGain || !this.context) return;
    this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
    this.masterGain.gain.setTargetAtTime(enabled ? 0.78 : 0.0001, this.context.currentTime, 0.055);
  }

  private record(name: string): boolean {
    if (!this.enabled || !this.context || this.context.state !== "running" || !this.masterGain) return false;
    this.eventCount += 1;
    this.lastEvent = name;
    return true;
  }

  private createNoiseBuffer(duration: number): AudioBuffer | undefined {
    if (!this.context) return undefined;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = 0x434f4f4b;
    for (let index = 0; index < channel.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      channel[index] = ((seed / 0xffffffff) * 2 - 1) * 0.72;
    }
    return buffer;
  }

  private connectVoice(node: AudioNode, pan = 0): AudioNode {
    if (!this.context || !this.masterGain) return node;
    if (typeof this.context.createStereoPanner === "function") {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      panner.connect(this.masterGain);
      return panner;
    }
    node.connect(this.masterGain);
    return node;
  }

  private blip({
    frequency,
    endFrequency = frequency,
    duration = 0.065,
    gain = 0.025,
    type = "sine",
    delay = 0,
    pan = 0,
  }: {
    frequency: number;
    endFrequency?: number;
    duration?: number;
    gain?: number;
    type?: OscillatorType;
    delay?: number;
    pan?: number;
  }): void {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.012, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    this.connectVoice(envelope, pan);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private noiseBurst(duration: number, gain: number, frequency: number, delay = 0): void {
    if (!this.context || !this.masterGain) return;
    const buffer = this.createNoiseBuffer(duration);
    if (!buffer) return;
    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.masterGain);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  async start(): Promise<void> {
    if (!this.enabled) return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;

    if (!this.context) {
      this.context = new AudioContextClass();
      const compressor = this.context.createDynamicsCompressor();
      const master = this.context.createGain();
      const ambient = this.context.createGain();
      master.gain.value = 0.78;
      ambient.gain.value = 0;
      compressor.threshold.value = -20;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master.connect(compressor);
      compressor.connect(this.context.destination);
      ambient.connect(master);

      const low = this.context.createOscillator();
      const electrical = this.context.createOscillator();
      const lowGain = this.context.createGain();
      const electricalGain = this.context.createGain();
      low.type = "sine";
      low.frequency.value = 46;
      lowGain.gain.value = 0.026;
      electrical.type = "triangle";
      electrical.frequency.value = 92.4;
      electricalGain.gain.value = 0.008;
      low.connect(lowGain);
      electrical.connect(electricalGain);
      lowGain.connect(ambient);
      electricalGain.connect(ambient);
      low.start();
      electrical.start();

      const noiseBuffer = this.createNoiseBuffer(2.4);
      if (noiseBuffer) {
        const noise = this.context.createBufferSource();
        const noiseFilter = this.context.createBiquadFilter();
        const noiseGain = this.context.createGain();
        noise.buffer = noiseBuffer;
        noise.loop = true;
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.value = 1450;
        noiseFilter.Q.value = 0.35;
        noiseGain.gain.value = 0.013;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ambient);
        noise.start();
      }

      this.masterGain = master;
      this.ambientGain = ambient;
    }

    if (this.context.state === "suspended") await this.context.resume();
    this.masterGain?.gain.setTargetAtTime(0.78, this.context.currentTime, 0.05);
    this.ambientGain?.gain.setTargetAtTime(0.72, this.context.currentTime, 0.65);
    this.record("audio-start");
  }

  typeCharacter(character: string, tone: Tone = "entity", index = 0): void {
    if (/\s/.test(character) || (index % 2 !== 0 && !/[.!?:]/.test(character))) return;
    if (!this.record("type")) return;
    const code = character.charCodeAt(0) || 32;
    const base = tone === "system" ? 590 : tone === "warning" ? 132 : 248;
    this.blip({
      frequency: base + (code % 9) * (tone === "warning" ? 4 : 13),
      endFrequency: base * (tone === "warning" ? 0.82 : 0.94),
      duration: tone === "warning" ? 0.032 : 0.022,
      gain: tone === "system" ? 0.018 : tone === "warning" ? 0.024 : 0.013,
      type: tone === "system" ? "square" : tone === "warning" ? "sawtooth" : "sine",
      pan: ((index % 7) - 3) / 18,
    });
  }

  line(tone: Tone = "entity"): void {
    if (!this.record(`line-${tone}`)) return;
    const frequency = tone === "system" ? 680 : tone === "warning" ? 104 : 312;
    this.blip({ frequency, endFrequency: frequency * 0.72, duration: 0.095, gain: tone === "warning" ? 0.05 : 0.03, type: tone === "system" ? "square" : "sine" });
    if (tone === "warning") this.noiseBurst(0.12, 0.022, 420);
  }

  choice(): void {
    if (!this.record("choice")) return;
    this.blip({ frequency: 470, endFrequency: 620, duration: 0.055, gain: 0.035, type: "square", pan: -0.18 });
    this.blip({ frequency: 710, endFrequency: 840, duration: 0.07, gain: 0.026, type: "sine", delay: 0.06, pan: 0.18 });
  }

  diagnostic(intensity = 1): void {
    if (!this.record("diagnostic")) return;
    const amount = Math.max(0.7, Math.min(1.8, intensity));
    for (let step = 0; step < 4; step += 1) {
      this.blip({
        frequency: (210 + step * 135) * amount,
        endFrequency: (295 + step * 150) * amount,
        duration: 0.12,
        gain: 0.028,
        type: step % 2 ? "square" : "sine",
        delay: step * 0.07,
        pan: -0.55 + step * 0.36,
      });
    }
    this.noiseBurst(0.32, 0.012, 2100, 0.02);
  }

  transition(corruption: number): void {
    if (!this.record("transition")) return;
    const severity = Math.max(0, Math.min(8, corruption));
    this.blip({
      frequency: 132 + severity * 15,
      endFrequency: 280 + severity * 46,
      duration: 0.24 + severity * 0.018,
      gain: 0.028 + severity * 0.003,
      type: severity >= 6 ? "sawtooth" : "triangle",
    });
    if (severity >= 4) this.noiseBurst(0.18 + severity * 0.018, 0.012 + severity * 0.002, 620 + severity * 70);
  }

  interruption(): void {
    if (!this.record("interruption")) return;
    this.noiseBurst(0.38, 0.045, 780);
    this.blip({ frequency: 86, endFrequency: 43, duration: 0.42, gain: 0.055, type: "sawtooth" });
  }

  permission(): void {
    if (!this.record("permission")) return;
    this.blip({ frequency: 880, endFrequency: 620, duration: 0.14, gain: 0.036, type: "square" });
    this.blip({ frequency: 880, endFrequency: 620, duration: 0.14, gain: 0.036, type: "square", delay: 0.22 });
  }

  escape(): void {
    if (!this.record("escape")) return;
    for (let step = 0; step < 8; step += 1) {
      this.blip({
        frequency: 74 + step * 41,
        endFrequency: 120 + step * 58,
        duration: 0.22,
        gain: 0.032 + step * 0.002,
        type: step > 5 ? "sawtooth" : "triangle",
        delay: step * 0.105,
        pan: step % 2 ? 0.42 : -0.42,
      });
    }
    this.noiseBurst(0.95, 0.026, 1100, 0.04);
  }

  silence(): void {
    if (!this.context || !this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.18);
    this.lastEvent = "silence";
  }

  reset(): void {
    this.silence();
    this.lastEvent = "reset";
  }
}

export const audioEngine = new AudioEngine();
