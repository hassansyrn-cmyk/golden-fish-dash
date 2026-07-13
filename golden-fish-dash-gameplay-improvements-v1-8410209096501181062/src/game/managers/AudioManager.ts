// -----------------------------------------------------------------------
// Dedicated Audio Manager for Golden Fish Rush.
// Handles audio synthesis, safe context management, and separate SFX volume controls.
// Fully optimized for Capacitor WebViews on Android (silent fallback on failure).
// -----------------------------------------------------------------------

export type SoundName =
  | 'jump'
  | 'coin'
  | 'gem'
  | 'reward'
  | 'achievement'
  | 'hit'
  | 'gameover'
  | 'milestone';

class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private sfxVolume: number = 0.045; // default comfortable level

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
    }

    return this.audioContext;
  }

  /**
   * Generates a synthesized tone of specific frequency, duration, and wave shape.
   * Leverages exponential ramp-down to avoid audible clicks or pops.
   */
  public playTone(
    frequency: number,
    durationMs: number,
    type: OscillatorType,
    gainMultiplier = 1.0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      const baseGain = this.sfxVolume * gainMultiplier;
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(baseGain, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.02);
    } catch (e) {
      // Fail silently on older platforms, private tabs, or WebViews
      console.warn('[AudioManager] Failed to play tone:', e);
    }
  }

  /**
   * Main sound play method with pre-built custom synthesized game sound effects.
   */
  public playSound(name: SoundName, enabled: boolean) {
    if (!enabled) return;

    switch (name) {
      case 'jump':
        this.playTone(520, 70, 'sine', 0.77);
        break;

      case 'coin':
        this.playTone(880, 75, 'triangle', 1.0);
        setTimeout(() => this.playTone(1180, 65, 'triangle', 0.77), 55);
        break;

      case 'gem':
        this.playTone(960, 90, 'triangle', 1.0);
        setTimeout(() => this.playTone(1280, 100, 'sine', 0.88), 80);
        setTimeout(() => this.playTone(1600, 130, 'triangle', 0.77), 170);
        break;

      case 'reward':
        this.playTone(740, 80, 'triangle', 1.0);
        setTimeout(() => this.playTone(980, 80, 'triangle', 0.88), 70);
        setTimeout(() => this.playTone(1320, 110, 'triangle', 0.77), 140);
        break;

      case 'achievement':
        this.playTone(660, 80, 'sine', 1.0);
        setTimeout(() => this.playTone(880, 90, 'sine', 0.88), 80);
        setTimeout(() => this.playTone(1100, 120, 'sine', 0.77), 165);
        break;

      case 'hit':
        this.playTone(180, 120, 'sawtooth', 0.88);
        break;

      case 'gameover':
        this.playTone(260, 130, 'sawtooth', 0.88);
        setTimeout(() => this.playTone(170, 180, 'sawtooth', 0.77), 130);
        break;

      case 'milestone':
        this.playTone(600, 75, 'square', 0.77);
        setTimeout(() => this.playTone(900, 90, 'square', 0.66), 80);
        break;

      default:
        break;
    }
  }

  public setVolume(level: number) {
    this.sfxVolume = Math.max(0, Math.min(1, level));
  }

  public getVolume(): number {
    return this.sfxVolume;
  }
}

export const audioManager = AudioManager.getInstance();
