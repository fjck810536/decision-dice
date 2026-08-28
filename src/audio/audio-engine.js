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

  get status() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return 'UNSUPPORTED';
    if (!this.context) return 'LOCKED';
    return this.context.state === 'running' ? 'READY' : String(this.context.state || 'LOCKED').toUpperCase();
  }

  #primeIOSAudio() {
    if (!this.context) return;
    try {
      const buffer = this.context.createBuffer(1, 1, 22050);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start(0);
    } catch {
      // The silent prime is only an iOS compatibility assist.
    }
  }

  async unlock() {
    if (this.muted) return false;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return false;

    if (!this.context) {
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.context.destination);
      this.#primeIOSAudio();
    }

    if (this.context.state !== 'running') {
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
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, now, 0.012);
    }
    return this.muted;
  }

  toggleMuted() {
    return this.setMuted(!this.muted);
  }

  #tone({ frequency = 440, duration = 0.04, gain = 0.08, type = 'square', endFrequency = null }) {
    if (this.muted || !this.context || !this.master || this.context.state !== 'running') return false;

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
    return true;
  }

  async playTestSound() {
    const ready = await this.unlock();
    if (!ready || this.muted) return false;
    this.#tone({ frequency: 440, endFrequency: 720, duration: 0.14, gain: 0.18, type: 'square' });
    return true;
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
      frequency: 120 + Math.random() * 70 + normalized * 45,
      endFrequency: 78 + normalized * 24,
      duration: 0.03 + normalized * 0.025,
      gain: 0.045 + normalized * 0.09,
      type: 'triangle',
    });
  }

  playRollCue() {
    if (this.muted) return;
    this.#tone({ frequency: 190, endFrequency: 105, duration: 0.075, gain: 0.11, type: 'square' });
  }

  playSlotTick({ final = false } = {}) {
    if (this.muted) return;
    const nowMs = performance.now();
    if (!final && nowMs - this.lastSlotTickAt < 28) return;
    this.lastSlotTickAt = nowMs;

    this.#tone(final
      ? { frequency: 390, endFrequency: 780, duration: 0.13, gain: 0.14, type: 'square' }
      : { frequency: 760, endFrequency: 620, duration: 0.03, gain: 0.075, type: 'square' });
  }
}

export const audioEngine = new AudioEngine();
