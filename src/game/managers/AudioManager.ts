// -----------------------------------------------------------------------
// Ocean Legends audio system for Golden Fish Rush.
// Layered on the classic tone synth but upgraded to a bus architecture:
//   master -> { music, ambience, sfx, ui }
// with per-chapter ambient beds, adaptive music layers (intro / explore /
// danger / surge / boss) crossfaded by game state, material-specific SFX,
// pitch-varied collectible chimes held to a musical scale, and brief
// ducking for important cues. Everything degrades silently when WebAudio
// is unavailable (older WebViews, private tabs).
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
  // Ocean Legends additions:
  | 'pearl'
  | 'plankton'
  | 'rescue'
  | 'companionLost'
  | 'coralBreak'
  | 'barrierBlocked'
  | 'stone'
  | 'eel'
  | 'mineWarn'
  | 'treasure'
  | 'comboTier'
  | 'surge'
  | 'chapter'
  | 'bossRoar'
  | 'bossEnd'
  | 'lore'
  | 'current'
  | 'growthUp'
  | 'uiTap'
  // Production video-boss encounter sounds:
  | 'bossWarning'
  | 'bossAttack'
  | 'bossSummon'
  | 'bossDefeated';

export type BusName = 'music' | 'ambience' | 'sfx' | 'ui';
export type MusicState = 'intro' | 'explore' | 'danger' | 'surge' | 'boss';
export type AudioTheme = 'lagoon' | 'coral' | 'kelp' | 'ruins' | 'vents' | 'crystal' | 'trench' | 'crown';

/** Pentatonic-ish scale (Hz) so repeated chimes always sound intentional. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

interface BusLevels {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  ui: number;
}

class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  private sfxVolume = 0.05;
  private busLevels: BusLevels = { master: 1, music: 0.7, ambience: 0.55, sfx: 1, ui: 0.8 };
  private buses: Partial<Record<BusName, GainNode>> = {};
  private masterGain: GainNode | null = null;
  private ambienceNodes: { osc: OscillatorNode[]; gain: GainNode; lfo?: OscillatorNode } | null = null;
  private ambienceTheme: AudioTheme | null = null;
  private musicState: MusicState = 'explore';
  private musicLayer: { osc: OscillatorNode[]; gain: GainNode; timer: ReturnType<typeof setInterval> | null } | null = null;
  private duckUntil = 0;
  private musicStep = 0;
  /** Production boss danger loop (HTMLAudio; volume follows the music bus). */
  private bossMusic: HTMLAudioElement | null = null;
  private bossMusicActive = false;
  private readonly lastPlayedAt = new Map<SoundName, number>();
  private readonly cooldownMs: Partial<Record<SoundName, number>> = {
    jump: 45, coin: 58, gem: 110, hit: 170, back: 140, pearl: 70, plankton: 90,
    rescue: 200, coralBreak: 240, treasure: 300, comboTier: 260, surge: 500,
    chapter: 900, bossRoar: 1500, eel: 400, mineWarn: 500, current: 260, growthUp: 500, uiTap: 90,
    bossAttack: 180, bossSummon: 650,
  };
  private coinChainIndex = 0;
  private lastCoinAt = 0;

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
      this.buildBuses();
    }
    return this.audioContext;
  }

  /** Build the master -> bus routing graph. */
  private buildBuses() {
    const ctx = this.audioContext;
    if (!ctx || this.masterGain) return;
    try {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.busLevels.master;
      this.masterGain.connect(ctx.destination);
      for (const name of ['music', 'ambience', 'sfx', 'ui'] as const) {
        const gain = ctx.createGain();
        gain.gain.value = this.busLevels[name];
        gain.connect(this.masterGain);
        this.buses[name] = gain;
      }
    } catch {
      this.masterGain = null;
    }
  }

  private bus(name: BusName): AudioNode {
    return this.buses[name] ?? this.audioContext!.destination;
  }

  /** Update persisted user volumes; instantly reflected on the live graph. */
  public setVolumes(levels: { master?: number; music?: number; sfx?: number; enabled: boolean }) {
    this.busLevels.master = Math.max(0, Math.min(1, levels.master ?? 1));
    this.busLevels.music = Math.max(0, Math.min(1, levels.music ?? 0.7));
    this.busLevels.sfx = Math.max(0, Math.min(1, levels.sfx ?? 1));
    if (!levels.enabled) this.busLevels.master = 0;
    const ctx = this.audioContext;
    if (ctx && this.masterGain) {
      try {
        this.masterGain.gain.setTargetAtTime(this.busLevels.master, ctx.currentTime, 0.05);
        this.buses.music?.gain.setTargetAtTime(this.busLevels.music, ctx.currentTime, 0.05);
        this.buses.sfx?.gain.setTargetAtTime(this.busLevels.sfx, ctx.currentTime, 0.05);
        this.buses.ambience?.gain.setTargetAtTime(this.busLevels.ambience * this.busLevels.music, ctx.currentTime, 0.05);
      } catch { /* ignore */ }
    }
  }

  /** Briefly duck music/ambience under important cues. */
  private duck(ms: number) {
    const ctx = this.audioContext;
    if (!ctx || !this.masterGain) return;
    this.duckUntil = performance.now() + ms;
    try {
      this.buses.music?.gain.setTargetAtTime(this.busLevels.music * 0.45, ctx.currentTime, 0.03);
      this.buses.ambience?.gain.setTargetAtTime(this.busLevels.ambience * 0.4, ctx.currentTime, 0.03);
      const release = () => {
        if (performance.now() >= this.duckUntil) {
          this.buses.music?.gain.setTargetAtTime(this.busLevels.music, ctx.currentTime, 0.15);
          this.buses.ambience?.gain.setTargetAtTime(this.busLevels.ambience * this.busLevels.music, ctx.currentTime, 0.15);
        } else {
          setTimeout(release, 80);
        }
      };
      setTimeout(release, ms);
    } catch { /* ignore */ }
  }

  /**
   * Synthesized tone routed through a bus. Exponential ramp-down avoids
   * audible clicks; optional frequency sweep gives SFX a material feel.
   */
  public playTone(
    frequency: number,
    durationMs: number,
    type: OscillatorType,
    gainMultiplier = 1.0,
    busName: BusName = 'sfx',
    sweepTo?: number,
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      if (sweepTo) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), ctx.currentTime + durationMs / 1000);
      }
      const baseGain = this.sfxVolume * gainMultiplier;
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(baseGain, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      oscillator.connect(gainNode);
      gainNode.connect(this.bus(busName));
      oscillator.start();
      oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.02);
    } catch (e) {
      console.warn('[AudioManager] Failed to play tone:', e);
    }
  }

  /** Filtered noise burst for material sounds (coral shatter, bubbles). */
  private playNoise(durationMs: number, filterHz: number, gainMultiplier = 1, busName: BusName = 'sfx') {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * durationMs / 1000));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterHz;
      const gain = ctx.createGain();
      gain.gain.value = this.sfxVolume * 0.7 * gainMultiplier;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.bus(busName));
      source.start();
    } catch { /* ignore */ }
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
   * Main SFX entry point. Collectible chimes climb a musical scale with a
   * slight detune so long chains sound intentional instead of noisy.
   */
  public playSound(name: SoundName, enabled: boolean) {
    if (!enabled || !this.canPlay(name)) return;
    const T = this.playTone.bind(this);

    switch (name) {
      case 'jump':
        T(470, 48, 'sine', 0.62, 'sfx', 660);
        break;

      case 'coin': {
        // Ascending chain through the scale; resets when the chain breaks.
        const now = performance.now();
        if (now - this.lastCoinAt > 1900) this.coinChainIndex = 0;
        this.lastCoinAt = now;
        const freq = SCALE[Math.min(SCALE.length - 1, this.coinChainIndex)] * (1 + (Math.random() - 0.5) * 0.012);
        this.coinChainIndex = (this.coinChainIndex + 1) % SCALE.length;
        T(freq, 48, 'triangle', 0.62);
        T(freq * 1.5, 52, 'sine', 0.4);
        break;
      }

      case 'pearl':
        T(1040, 60, 'sine', 0.5);
        T(1560, 80, 'sine', 0.34);
        this.playNoise(60, 5200, 0.4);
        break;

      case 'plankton':
        T(620, 40, 'sine', 0.34, 'sfx', 760);
        break;

      case 'gem':
        T(780, 62, 'sine', 0.62);
        setTimeout(() => T(1040, 72, 'triangle', 0.56), 52);
        setTimeout(() => T(1420, 95, 'sine', 0.46), 112);
        break;

      case 'reward':
        T(660, 65, 'triangle', 0.72);
        setTimeout(() => T(880, 75, 'triangle', 0.62), 58);
        setTimeout(() => T(1180, 100, 'sine', 0.54), 122);
        break;

      case 'achievement':
        T(620, 72, 'sine', 0.72);
        setTimeout(() => T(830, 82, 'sine', 0.64), 68);
        setTimeout(() => T(1120, 112, 'sine', 0.56), 142);
        break;

      case 'hit':
        T(165, 95, 'triangle', 0.72);
        setTimeout(() => T(120, 70, 'sine', 0.42), 55);
        this.duck(220);
        break;

      case 'gameover':
        T(250, 105, 'triangle', 0.66);
        setTimeout(() => T(185, 145, 'triangle', 0.54), 100);
        setTimeout(() => T(140, 220, 'sine', 0.4), 220);
        break;

      case 'milestone':
        T(680, 62, 'sine', 0.58);
        setTimeout(() => T(920, 82, 'sine', 0.5), 56);
        break;

      case 'shield':
        T(360, 72, 'sine', 0.6);
        setTimeout(() => T(540, 78, 'sine', 0.52), 48);
        setTimeout(() => T(760, 96, 'triangle', 0.42), 104);
        break;

      case 'powerup':
        T(520, 55, 'triangle', 0.58);
        setTimeout(() => T(740, 65, 'sine', 0.5), 46);
        setTimeout(() => T(980, 86, 'sine', 0.42), 98);
        break;

      case 'back':
        T(390, 44, 'triangle', 0.46, 'ui');
        setTimeout(() => T(310, 58, 'sine', 0.38, 'ui'), 38);
        break;

      case 'uiTap':
        T(540, 36, 'sine', 0.32, 'ui');
        break;

      case 'rescue':
        T(720, 70, 'sine', 0.5);
        setTimeout(() => T(1080, 90, 'triangle', 0.46), 70);
        break;

      case 'companionLost':
        T(520, 90, 'sine', 0.44, 'sfx', 260);
        break;

      case 'coralBreak':
        this.playNoise(180, 900, 0.9);
        T(300, 90, 'triangle', 0.4, 'sfx', 140);
        break;

      case 'barrierBlocked':
        T(200, 70, 'square', 0.22, 'sfx', 160);
        break;

      case 'stone':
        T(150, 160, 'triangle', 0.5);
        this.playNoise(140, 500, 0.5);
        break;

      case 'eel':
        T(1800, 60, 'sawtooth', 0.2, 'sfx', 700);
        setTimeout(() => T(1600, 50, 'sawtooth', 0.16, 'sfx', 900), 70);
        break;

      case 'mineWarn':
        T(880, 90, 'square', 0.14);
        setTimeout(() => T(880, 90, 'square', 0.14), 130);
        break;

      case 'treasure':
        T(660, 70, 'triangle', 0.6);
        setTimeout(() => T(990, 80, 'triangle', 0.55), 66);
        setTimeout(() => T(1320, 110, 'sine', 0.5), 140);
        this.duck(320);
        break;

      case 'comboTier':
        T(880, 70, 'triangle', 0.5);
        setTimeout(() => T(1174, 90, 'triangle', 0.48), 64);
        break;

      case 'surge':
        this.duck(500);
        T(523, 200, 'sawtooth', 0.22, 'sfx', 1046);
        setTimeout(() => T(784, 240, 'sawtooth', 0.2, 'sfx', 1568), 120);
        setTimeout(() => T(1046, 320, 'triangle', 0.42), 260);
        break;

      case 'chapter':
        this.duck(600);
        T(523, 160, 'sine', 0.4);
        setTimeout(() => T(659, 180, 'sine', 0.4), 140);
        setTimeout(() => T(880, 260, 'sine', 0.4), 300);
        break;

      case 'bossWarning':
        this.duck(500);
        T(148, 280, 'sawtooth', 0.7);
        setTimeout(() => T(196, 270, 'sawtooth', 0.6), 170);
        setTimeout(() => T(294, 360, 'triangle', 0.56), 350);
        break;

      case 'bossAttack':
        T(230, 140, 'sawtooth', 0.52);
        setTimeout(() => T(150, 190, 'triangle', 0.5), 55);
        break;

      case 'bossSummon':
        T(125, 250, 'sine', 0.64);
        setTimeout(() => T(250, 180, 'triangle', 0.48), 140);
        break;

      case 'bossDefeated':
        T(440, 90, 'triangle', 0.68);
        setTimeout(() => T(660, 105, 'triangle', 0.6), 76);
        setTimeout(() => T(990, 130, 'sine', 0.52), 168);
        this.duck(400);
        break;

      case 'bossRoar':
        this.duck(900);
        T(90, 500, 'sawtooth', 0.3, 'sfx', 45);
        this.playNoise(400, 240, 0.5);
        setTimeout(() => T(120, 320, 'triangle', 0.3, 'sfx', 70), 160);
        break;

      case 'bossEnd':
        T(523, 140, 'triangle', 0.5);
        setTimeout(() => T(659, 150, 'triangle', 0.5), 130);
        setTimeout(() => T(784, 160, 'triangle', 0.5), 270);
        setTimeout(() => T(1046, 340, 'sine', 0.5), 420);
        break;

      case 'lore':
        T(1174, 90, 'sine', 0.42);
        setTimeout(() => T(1568, 130, 'sine', 0.4), 90);
        break;

      case 'current':
        this.playNoise(140, 1400, 0.32);
        break;

      case 'growthUp':
        T(660, 90, 'triangle', 0.5);
        setTimeout(() => T(880, 110, 'triangle', 0.5), 90);
        setTimeout(() => T(1320, 160, 'sine', 0.44), 200);
        break;

      default:
        break;
    }
  }

  // ------------------------------------------------------------------
  // Ambient beds: a slow drone + filtered noise per chapter identity.
  // ------------------------------------------------------------------
  public startAmbience(theme: AudioTheme, enabled: boolean) {
    const ctx = this.getContext();
    if (!ctx || !enabled) { this.stopAmbience(); return; }
    if (this.ambienceTheme === theme && this.ambienceNodes) return;
    this.stopAmbience();
    this.ambienceTheme = theme;

    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.bus('ambience'));
      gain.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);

      const droneHz: Record<AudioTheme, number> = {
        lagoon: 98, coral: 110, kelp: 87.3, ruins: 82.4, vents: 65.4, crystal: 130.8, trench: 55, crown: 123.5,
      };
      const oscs: OscillatorNode[] = [];
      const base = droneHz[theme];
      for (const [mult, type, level] of [[1, 'sine', 0.5], [1.5, 'sine', 0.22], [2.02, 'triangle', 0.1]] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = base * mult;
        const oscGain = ctx.createGain();
        oscGain.gain.value = level;
        osc.connect(oscGain);
        oscGain.connect(gain);
        osc.start();
        oscs.push(osc);
      }
      // Slow LFO swell so the bed breathes instead of sitting flat.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.1;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      this.ambienceNodes = { osc: oscs, gain, lfo };
    } catch {
      this.ambienceNodes = null;
    }
  }

  public stopAmbience() {
    if (!this.ambienceNodes) return;
    const nodes = this.ambienceNodes;
    this.ambienceNodes = null;
    this.ambienceTheme = null;
    try {
      const ctx = this.audioContext;
      if (ctx) nodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => {
        nodes.osc.forEach((o) => { try { o.stop(); } catch { /* ignore */ } });
        try { nodes.lfo?.stop(); } catch { /* ignore */ }
      }, 900);
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------
  // Adaptive music: a lightweight sequencer that crossfades pattern
  // density/intensity by game state instead of restarting tracks.
  // ------------------------------------------------------------------
  public setMusicState(state: MusicState, enabled: boolean) {
    if (!enabled) { this.stopMusic(); return; }
    if (this.musicState === state && this.musicLayer) return;
    this.musicState = state;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!this.musicLayer) {
      try {
        const gain = ctx.createGain();
        gain.gain.value = 0.0;
        gain.connect(this.bus('music'));
        gain.gain.setTargetAtTime(0.32, ctx.currentTime, 1.0);
        this.musicLayer = { osc: [], gain, timer: null };
      } catch {
        return;
      }
    }

    // Restart the sequencer with the new state's pattern.
    if (this.musicLayer.timer) clearInterval(this.musicLayer.timer);
    this.musicStep = 0;
    const rootByState: Record<MusicState, number[]> = {
      intro: [261.6, 329.6, 392.0],
      explore: [293.7, 370.0, 440.0],
      danger: [220.0, 261.6, 311.1],
      surge: [392.0, 493.9, 587.3],
      boss: [196.0, 233.1, 293.7],
    };
    const stepMs: Record<MusicState, number> = { intro: 600, explore: 480, danger: 380, surge: 300, boss: 340 };
    const chords = rootByState[state];
    const layer = this.musicLayer;
    layer.timer = setInterval(() => {
      const ctx2 = this.audioContext;
      if (!ctx2 || !this.musicLayer) return;
      try {
        const step = this.musicStep++;
        const note = chords[step % chords.length];
        const playPad = (freq: number, dur: number, level: number, type: OscillatorType) => {
          const osc = ctx2.createOscillator();
          osc.type = type;
          osc.frequency.value = freq;
          const g = ctx2.createGain();
          g.gain.setValueAtTime(0, ctx2.currentTime);
          g.gain.linearRampToValueAtTime(level * this.sfxVolume * 0.5, ctx2.currentTime + 0.08);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx2.currentTime + dur / 1000);
          osc.connect(g);
          g.connect(this.musicLayer!.gain);
          osc.start();
          osc.stop(ctx2.currentTime + dur / 1000 + 0.05);
        };
        // Bass pulse + arpeggio; surge adds an octave shimmer.
        playPad(note / 2, stepMs[state] * 1.8, 0.5, 'triangle');
        playPad(note * (state === 'surge' ? 4 : 2), stepMs[state] * 0.9, 0.16, 'sine');
        if (state === 'boss' && step % 4 === 2) playPad(note / 2, 120, 0.7, 'sawtooth');
        if (state === 'danger' && step % 8 === 6) playPad(note * 1.06, 200, 0.2, 'square');
      } catch { /* ignore */ }
    }, stepMs[state]);
  }

  public stopMusic() {
    if (!this.musicLayer) return;
    const layer = this.musicLayer;
    this.musicLayer = null;
    try {
      const ctx = this.audioContext;
      if (ctx) layer.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      if (layer.timer) clearInterval(layer.timer);
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------
  // Production boss danger loop (keeps working with the bus volumes).
  // ------------------------------------------------------------------
  public startBossMusic(enabled: boolean) {
    if (!enabled || typeof Audio === 'undefined') return;
    try {
      if (!this.bossMusic) {
        this.bossMusic = new Audio('/audio/boss-danger-loop.mp3');
        this.bossMusic.loop = true;
        this.bossMusic.preload = 'auto';
      }
      this.bossMusicActive = true;
      this.bossMusic.volume = Math.min(1, 0.2 * this.busLevels.master * this.busLevels.music);
      void this.bossMusic.play().catch(() => undefined);
    } catch {
      // A browser or WebView may block media playback until the first user gesture.
    }
  }

  public pauseBossMusic() {
    if (this.bossMusicActive) this.bossMusic?.pause();
  }

  public resumeBossMusic() {
    if (this.bossMusicActive && this.bossMusic?.paused) {
      void this.bossMusic.play().catch(() => undefined);
    }
  }

  public stopBossMusic() {
    this.bossMusicActive = false;
    if (!this.bossMusic) return;
    this.bossMusic.pause();
    this.bossMusic.currentTime = 0;
  }

  /** Called on visibility resume / user gesture; safe no-op elsewhere. */
  public resumeContext() {
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  public setVolume(level: number) {
    this.sfxVolume = Math.max(0, Math.min(1, level));
  }

  public getVolume(): number {
    return this.sfxVolume;
  }
}

export const audioManager = AudioManager.getInstance();
