/**
 * Audio System with Web Audio API
 * Procedural sound generation for game effects
 */

export type SoundEffect = 
  | 'coinCollect' 
  | 'hit' 
  | 'powerUp' 
  | 'jump' 
  | 'levelUp' 
  | 'gameOver'
  | 'success';

export class AudioSystem {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.3;
  private isMuted = false;
  private backgroundMusicOscillator: OscillatorNode | null = null;
  private backgroundMusicGain: GainNode | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    if (typeof window !== 'undefined' && !this.audioContext) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    }
  }

  /**
   * Resume audio context on user interaction (required by browsers)
   */
  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(e => console.warn('Failed to resume audio context:', e));
    }
  }

  /**
   * Play coin collection sound (ascending beep)
   */
  playCoinCollect() {
    if (!this.audioContext || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    
    gain.gain.setValueAtTime(this.masterVolume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Play hit/collision sound
   */
  playHit() {
    if (!this.audioContext || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    
    filter.type = 'highpass';
    filter.frequency.value = 100;
    
    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Play power-up activation sound
   */
  playPowerUp() {
    if (!this.audioContext || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5 - happy chord
    
    notes.forEach((freq, index) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.connect(gain);
      gain.connect(this.audioContext!.destination);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(this.masterVolume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  /**
   * Play jump/dodge sound
   */
  playJump() {
    if (!this.audioContext || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.05);
    
    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Play achievement/level up sound
   */
  playLevelUp() {
    if (!this.audioContext || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const notes = [523, 587, 659, 784, 880]; // Ascending scale
    const duration = 0.1;
    
    notes.forEach((freq, index) => {
      const startTime = now + index * (duration + 0.05);
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.connect(gain);
      gain.connect(this.audioContext!.destination);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(this.masterVolume * 0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Play game over sound (descending sad beep)
   */
  playGameOver() {
    if (!this.audioContext || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
    
    gain.gain.setValueAtTime(this.masterVolume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Play success/win sound
   */
  playSuccess() {
    if (!this.audioContext || this.isMuted) return;
    
    const now = this.audioContext.currentTime;
    const notes = [523, 659, 784]; // Happy major chord
    
    notes.forEach((freq) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.connect(gain);
      gain.connect(this.audioContext!.destination);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  /**
   * Play effect based on type
   */
  playEffect(effect: SoundEffect) {
    this.resumeAudioContext();
    
    switch (effect) {
      case 'coinCollect':
        this.playCoinCollect();
        break;
      case 'hit':
        this.playHit();
        break;
      case 'powerUp':
        this.playPowerUp();
        break;
      case 'jump':
        this.playJump();
        break;
      case 'levelUp':
        this.playLevelUp();
        break;
      case 'gameOver':
        this.playGameOver();
        break;
      case 'success':
        this.playSuccess();
        break;
    }
  }

  /**
   * Start background music
   */
  startBackgroundMusic() {
    if (!this.audioContext || this.isMuted) return;
    
    // Stop existing music
    if (this.backgroundMusicOscillator) {
      this.backgroundMusicOscillator.stop();
    }

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    // Ambient underwater tone
    osc.type = 'sine';
    osc.frequency.value = 110; // A2 note

    filter.type = 'lowpass';
    filter.frequency.value = 200;

    gain.gain.setValueAtTime(this.masterVolume * 0.1, now);

    osc.start(now);

    this.backgroundMusicOscillator = osc;
    this.backgroundMusicGain = gain;

    // Subtle volume modulation
    this.modulateBackgroundMusic();
  }

  private modulateBackgroundMusic() {
    if (!this.backgroundMusicGain || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();

    lfo.frequency.value = 0.5; // 0.5 Hz modulation
    lfoGain.gain.setValueAtTime(this.masterVolume * 0.02, now);

    lfo.connect(lfoGain);
    lfoGain.connect(this.backgroundMusicGain.gain);

    lfo.start(now);

    // Keep modulation going
    setTimeout(() => this.modulateBackgroundMusic(), 2000);
  }

  /**
   * Stop background music
   */
  stopBackgroundMusic() {
    if (this.backgroundMusicOscillator) {
      this.backgroundMusicOscillator.stop();
      this.backgroundMusicOscillator = null;
    }
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBackgroundMusic();
    }
    return this.isMuted;
  }

  /**
   * Check if muted
   */
  getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Get master volume
   */
  getVolume(): number {
    return this.masterVolume;
  }
}
