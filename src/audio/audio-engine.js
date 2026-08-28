export class AudioEngine {
  constructor() {
    this.muted = false;
    this.context = null;
    this.master = null;
    this.lastCollisionAt = 0;
    this.lastSlotTickAt = 0;
  }

  get isMuted() {
    return this.muted;
  }

  async unlock() {
    if (this.muted) return false;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }
    return this.context.state === 'running';
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72, now, 0.012);
    }
    return this.muted;
  }

  toggleMuted() {
    return this.setMuted(!this.muted);
  }

  #tone({ frequency = 440, duration = 0.04, gain = 0.04, type = 'square', endFrequency = null }) {
    if (this.muted || !this.context || !this.master || this.context.state !== 'running') return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + Math.min(0.008, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  playCollision(impact = 0) {
    if (this.muted) return;
    const strength = Math.abs(Number(impact) || 0);
    if (strength < 0.55) return;

    const nowMs = performance.now();
    if (nowMs - this.lastCollisionAt < 30) return;
    this.lastCollisionAt = nowMs;

    const normalized = Math.min(1, strength / 8);
    this.#tone({
      frequency: 105 + Math.random() * 55 + normalized * 35,
      endFrequency: 72 + normalized * 20,
      duration: 0.026 + normalized * 0.022,
      gain: 0.018 + normalized * 0.055,
      type: 'triangle',
    });
  }

  playRollCue() {
    if (this.muted) return;
    this.#tone({ frequency: 145, endFrequency: 92, duration: 0.055, gain: 0.028, type: 'square' });
  }

  playSlotTick({ final = false } = {}) {
    if (this.muted) return;
    const nowMs = performance.now();
    if (!final && nowMs - this.lastSlotTickAt < 28) return;
    this.lastSlotTickAt = nowMs;

    this.#tone(final
      ? { frequency: 330, endFrequency: 660, duration: 0.11, gain: 0.055, type: 'square' }
      : { frequency: 620, endFrequency: 540, duration: 0.026, gain: 0.022, type: 'square' });
  }
}

export const audioEngine = new AudioEngine();
