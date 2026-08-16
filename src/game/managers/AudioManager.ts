// -----------------------------------------------------------------------
// Dedicated Audio Manager for Golden Fish Rush.
// Handles audio synthesis, safe context management, and separate SFX volume controls.
// Fully optimized for Capacitor WebViews on Android (silent fallback on failure).
// -----------------------------------------------------------------------

export type BossAudioId = 'abyssalOctopus' | 'electricManta' | 'abyssalAnglerfish' | 'leviathan' | 'coralKraken';

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
  | 'bossWarning'
  | 'bossAttack'
  | 'bossSummon'
  | 'bossDefeated';

class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private sfxVolume: number = 0.05;
  private bossMusic: HTMLAudioElement | null = null;
  private bossMusicId: BossAudioId | null = null;
  private bossMusicEnabled = false;
  private readonly bossMusicPaths: Record<BossAudioId, string> = {
    abyssalOctopus: '/audio/boss-octopus-danger-loop.mp3',
    electricManta: '/audio/boss-manta-danger-loop.mp3',
    abyssalAnglerfish: '/audio/boss-anglerfish-danger-loop.mp3',
    leviathan: '/audio/boss-leviathan-danger-loop.mp3',
    coralKraken: '/audio/boss-kraken-danger-loop.mp3',
  };
  private readonly lastPlayedAt = new Map<SoundName, number>();
  private readonly cooldownMs: Partial<Record<SoundName, number>> = {
    jump: 45,
    coin: 58,
    gem: 110,
    hit: 170,
    back: 140,
    bossAttack: 180,
    bossSummon: 650,
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
    } catch (e) {
      // Fail silently on older platforms, private tabs, or WebViews
      console.warn('[AudioManager] Failed to play tone:', e);
    }
  }

  private getBossMusic(bossId: BossAudioId): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.bossMusic || this.bossMusicId !== bossId) {
      this.bossMusic?.pause();
      this.bossMusic = new Audio(this.bossMusicPaths[bossId]);
      this.bossMusic.loop = true;
      this.bossMusic.preload = 'auto';
      this.bossMusicId = bossId;
    }
    return this.bossMusic;
  }

  public startBossMusic(bossId: BossAudioId, enabled: boolean) {
    if (!enabled) return;
    const music = this.getBossMusic(bossId);
    if (!music) return;

    try {
      music.volume = Math.max(0.045, Math.min(0.16, this.sfxVolume * 2.2));
      music.currentTime = 0;
      this.bossMusicEnabled = true;
      void music.play().catch(() => undefined);
    } catch {
      // A muted or older WebView may reject media playback; gameplay continues.
    }
  }

  public pauseBossMusic() {
    this.bossMusic?.pause();
  }

  public resumeBossMusic(enabled: boolean) {
    if (!enabled || !this.bossMusicEnabled || !this.bossMusic) return;
    try {
      void this.bossMusic.play().catch(() => undefined);
    } catch {
      // Safe fallback for media-restricted WebViews.
    }
  }

  public stopBossMusic() {
    this.bossMusicEnabled = false;
    if (!this.bossMusic) return;
    this.bossMusic.pause();
    this.bossMusic.currentTime = 0;
  }

  public playBossRoar(bossId: BossAudioId, enabled: boolean) {
    if (!enabled) return;
    switch (bossId) {
      case 'abyssalOctopus':
        this.playTone(92, 520, 'sawtooth', 0.82);
        setTimeout(() => this.playTone(68, 620, 'triangle', 0.68), 180);
        setTimeout(() => this.playTone(142, 340, 'sine', 0.44), 410);
        break;
      case 'electricManta':
        this.playTone(188, 110, 'square', 0.62);
        setTimeout(() => this.playTone(330, 95, 'square', 0.56), 80);
        setTimeout(() => this.playTone(610, 145, 'sawtooth', 0.46), 160);
        break;
      case 'abyssalAnglerfish':
        this.playTone(74, 740, 'sine', 0.82);
        setTimeout(() => this.playTone(104, 430, 'triangle', 0.52), 260);
        setTimeout(() => this.playTone(48, 560, 'sine', 0.44), 420);
        break;
      case 'leviathan':
        this.playTone(56, 780, 'sawtooth', 0.94);
        setTimeout(() => this.playTone(82, 640, 'triangle', 0.72), 170);
        setTimeout(() => this.playTone(126, 420, 'sine', 0.48), 430);
        break;
      case 'coralKraken':
        this.playTone(118, 520, 'sawtooth', 0.86);
        setTimeout(() => this.playTone(164, 480, 'square', 0.64), 145);
        setTimeout(() => this.playTone(238, 300, 'triangle', 0.56), 330);
        break;
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
   * Main sound play method with handcrafted synthesized game sound effects.
   * Fast repeatable sounds are lightly throttled to keep long runs comfortable.
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

      case 'bossWarning':
        this.playTone(148, 280, 'sawtooth', 0.70);
        setTimeout(() => this.playTone(196, 270, 'sawtooth', 0.60), 170);
        setTimeout(() => this.playTone(294, 360, 'triangle', 0.56), 350);
        break;

      case 'bossAttack':
        this.playTone(230, 140, 'sawtooth', 0.52);
        setTimeout(() => this.playTone(150, 190, 'triangle', 0.50), 55);
        break;

      case 'bossSummon':
        this.playTone(125, 250, 'sine', 0.64);
        setTimeout(() => this.playTone(250, 180, 'triangle', 0.48), 140);
        break;

      case 'bossDefeated':
        this.playTone(440, 90, 'triangle', 0.68);
        setTimeout(() => this.playTone(660, 105, 'triangle', 0.60), 76);
        setTimeout(() => this.playTone(990, 130, 'sine', 0.52), 168);
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
