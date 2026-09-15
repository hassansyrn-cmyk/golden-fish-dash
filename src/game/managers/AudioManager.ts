// -----------------------------------------------------------------------
// Dedicated Audio Manager for Golden Fish Dash.
// Handles procedural background music synthesis and sound effects via
// Web Audio API. Zero external audio asset dependencies.
// Optimized for mobile WebViews on Android (silent fallback on failure).
// -----------------------------------------------------------------------

export type SoundName =
  | 'jump'
  | 'coin'
  | 'gem'
  | 'reward'
  | 'achievement'
  | 'hit'
  | 'gameover'
  | 'milestone'
  | 'shield'
  | 'powerup'
  | 'back'
  | 'bossAlert'
  | 'torpedo'
  | 'shockwave'
  | 'zap'
  | 'splash';

// Pentatonic musical scale for coin combo ascension (C5, D5, E5, G5, A5, C6)
const COIN_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

// Procedural music chord definitions (frequencies in Hz)
const CHORD_PROGRESSIONS = {
  calm: [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [130.81, 164.81, 196.0, 246.94], // Cmaj7
    [146.83, 174.61, 220.0, 261.63], // Dm7
    [110.0, 138.59, 164.81, 220.0],  // A7sus
  ],
  abyss: [
    [130.81, 155.56, 196.0, 233.08], // Cm7
    [116.54, 138.59, 174.61, 207.65], // Bbm7
    [103.83, 130.81, 155.56, 196.0],  // Abmaj7
    [98.0, 123.47, 146.83, 174.61],   // G7
  ],
  fever: [
    [261.63, 329.63, 392.0, 523.25], // C fast
    [293.66, 349.23, 440.0, 587.33], // Dm fast
    [329.63, 392.0, 493.88, 659.25], // Em fast
    [349.23, 440.0, 523.25, 698.46], // F fast
  ],
};

class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private sfxVolume: number = 0.06;
  private musicVolume: number = 0.04;
  private musicEnabled: boolean = true;
  private isMusicRunning: boolean = false;
  private musicStepTimer: ReturnType<typeof setInterval> | null = null;
  private currentChordIndex: number = 0;
  private currentMood: 'calm' | 'abyss' | 'fever' = 'calm';

  private readonly lastPlayedAt = new Map<SoundName, number>();
  private readonly cooldownMs: Partial<Record<SoundName, number>> = {
    jump: 45,
    coin: 40,
    gem: 100,
    hit: 170,
    back: 140,
    zap: 120,
    splash: 90,
  };

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
    } catch {
      // Fail silently on older platforms, private tabs, or WebViews
    }
  }

  private canPlay(name: SoundName): boolean {
    const cooldown = this.cooldownMs[name] ?? 0;
    if (cooldown <= 0) return true;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastPlayed = this.lastPlayedAt.get(name) ?? -Infinity;
    if (now - lastPlayed < cooldown) return false;

    this.lastPlayedAt.set(name, now);
    return true;
  }

  /**
   * Plays a pitch-scaled coin chime for combo streaks.
   */
  public playCoinChime(comboStreak: number, enabled: boolean) {
    if (!enabled) return;
    const noteIndex = Math.min(COIN_SCALE.length - 1, Math.floor(comboStreak / 2));
    const freq = COIN_SCALE[noteIndex];

    this.playTone(freq, 65, 'triangle', 0.65);
    setTimeout(() => {
      this.playTone(freq * 1.5, 55, 'sine', 0.45);
    }, 28);
  }

  /**
   * Main sound play method with handcrafted synthesized game sound effects.
   */
  public playSound(name: SoundName, enabled: boolean) {
    if (!enabled || !this.canPlay(name)) return;

    switch (name) {
      case 'jump':
        this.playTone(470, 48, 'sine', 0.62);
        setTimeout(() => this.playTone(660, 58, 'sine', 0.48), 34);
        break;

      case 'coin':
        this.playTone(880, 48, 'triangle', 0.62);
        setTimeout(() => this.playTone(1240, 52, 'sine', 0.46), 34);
        break;

      case 'gem':
        this.playTone(780, 62, 'sine', 0.62);
        setTimeout(() => this.playTone(1040, 72, 'triangle', 0.56), 52);
        setTimeout(() => this.playTone(1420, 95, 'sine', 0.46), 112);
        break;

      case 'reward':
        this.playTone(660, 65, 'triangle', 0.72);
        setTimeout(() => this.playTone(880, 75, 'triangle', 0.62), 58);
        setTimeout(() => this.playTone(1180, 100, 'sine', 0.54), 122);
        break;

      case 'achievement':
        this.playTone(620, 72, 'sine', 0.72);
        setTimeout(() => this.playTone(830, 82, 'sine', 0.64), 68);
        setTimeout(() => this.playTone(1120, 112, 'sine', 0.56), 142);
        break;

      case 'hit':
        this.playTone(165, 95, 'triangle', 0.72);
        setTimeout(() => this.playTone(120, 70, 'sine', 0.42), 55);
        break;

      case 'gameover':
        this.playTone(250, 105, 'triangle', 0.66);
        setTimeout(() => this.playTone(185, 145, 'triangle', 0.54), 100);
        break;

      case 'milestone':
        this.playTone(680, 62, 'sine', 0.58);
        setTimeout(() => this.playTone(920, 82, 'sine', 0.50), 56);
        break;

      case 'shield':
        this.playTone(360, 72, 'sine', 0.60);
        setTimeout(() => this.playTone(540, 78, 'sine', 0.52), 48);
        setTimeout(() => this.playTone(760, 96, 'triangle', 0.42), 104);
        break;

      case 'powerup':
        this.playTone(520, 55, 'triangle', 0.58);
        setTimeout(() => this.playTone(740, 65, 'sine', 0.50), 46);
        setTimeout(() => this.playTone(980, 86, 'sine', 0.42), 98);
        break;

      case 'back':
        this.playTone(390, 44, 'triangle', 0.46);
        setTimeout(() => this.playTone(310, 58, 'sine', 0.38), 38);
        break;

      case 'bossAlert':
        // Dramatic low warning submarine horn
        this.playTone(146.83, 380, 'sawtooth', 0.45);
        this.playTone(110.0, 420, 'triangle', 0.65);
        setTimeout(() => {
          this.playTone(174.61, 320, 'sawtooth', 0.5);
        }, 180);
        break;

      case 'torpedo':
        // High-velocity rushing cavitation whoosh
        this.playTone(300, 180, 'sine', 0.7);
        setTimeout(() => this.playTone(650, 220, 'triangle', 0.6), 50);
        setTimeout(() => this.playTone(920, 260, 'sine', 0.5), 110);
        break;

      case 'shockwave':
        // Deep bass detonation + resonant crystalline ring
        this.playTone(65, 260, 'triangle', 0.85);
        setTimeout(() => this.playTone(440, 140, 'sine', 0.45), 40);
        break;

      case 'zap':
        // Electric buzz
        this.playTone(580, 75, 'sawtooth', 0.35);
        setTimeout(() => this.playTone(420, 65, 'sawtooth', 0.4), 30);
        break;

      case 'splash':
        this.playTone(520, 40, 'sine', 0.45);
        setTimeout(() => this.playTone(840, 50, 'triangle', 0.35), 25);
        break;

      default:
        break;
    }
  }

  // =======================================================================
  // PROCEDURAL BACKGROUND MUSIC SYNTHESIS
  // =======================================================================

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else if (!this.isMusicRunning) {
      this.startMusic();
    }
  }

  public isMusicOn(): boolean {
    return this.musicEnabled;
  }

  public setBiomeMood(score: number, isFever: boolean, isBoss: boolean) {
    if (isFever || isBoss) {
      this.currentMood = 'fever';
    } else if (score >= 85) {
      this.currentMood = 'abyss';
    } else {
      this.currentMood = 'calm';
    }
  }

  public startMusic() {
    if (!this.musicEnabled || this.isMusicRunning) return;
    this.isMusicRunning = true;

    // Step every 2.4 seconds for calm chords, or 1.2s for fever/boss
    const playChordStep = () => {
      if (!this.musicEnabled || !this.isMusicRunning) return;
      const ctx = this.getContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const chords = CHORD_PROGRESSIONS[this.currentMood] || CHORD_PROGRESSIONS.calm;
      const chord = chords[this.currentChordIndex % chords.length];
      this.currentChordIndex++;

      const isFast = this.currentMood === 'fever';
      const durationMs = isFast ? 1100 : 2200;

      // Play each note of the chord gently in ambient pad style
      chord.forEach((freq, idx) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = idx === 0 ? 'triangle' : 'sine';
          // Detune slightly for lush chorus spread
          osc.frequency.setValueAtTime(freq + (idx - 1) * 0.4, ctx.currentTime);

          const vol = this.musicVolume * (idx === 0 ? 0.9 : 0.65);
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.35);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
        } catch {
          // ignore
        }
      });
    };

    playChordStep();
    const intervalMs = this.currentMood === 'fever' ? 1200 : 2400;
    this.musicStepTimer = setInterval(playChordStep, intervalMs);
  }

  public stopMusic() {
    this.isMusicRunning = false;
    if (this.musicStepTimer) {
      clearInterval(this.musicStepTimer);
      this.musicStepTimer = null;
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
