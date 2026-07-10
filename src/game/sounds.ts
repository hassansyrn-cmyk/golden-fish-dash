import { getSettings } from './storage';

class SoundManager {
  private ctx: AudioContext | null = null;

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  private playTone(freqs: number[], durationSec: number, type: OscillatorType = 'sine', slideTo?: number) {
    this.init();
    if (!this.ctx) return;

    // Check settings
    const settings = getSettings();
    if (!settings.sound) return;

    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;

    if (freqs.length === 1) {
      osc.frequency.setValueAtTime(freqs[0], now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, now + durationSec);
      }
    } else {
      // Multiple notes in sequence (chime)
      let t = now;
      const noteDuration = durationSec / freqs.length;
      freqs.forEach((f) => {
        osc.frequency.setValueAtTime(f, t);
        t += noteDuration;
      });
    }

    // Envelope
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec);
  }

  playButtonClick() {
    this.playTone([600], 0.08, 'triangle', 400);
  }

  playGameStart() {
    // Upward sweep/arpeggio
    this.playTone([261.63, 329.63, 392.00, 523.25], 0.35, 'sine');
  }

  playCoinCollected() {
    // Retro dual tone coin sound
    this.playTone([987.77, 1318.51], 0.25, 'sine');
  }

  playGemCollected() {
    // Magical multi-tone chime
    this.playTone([880, 1100, 1320, 1760], 0.4, 'triangle');
  }

  playObstacleHit() {
    // Noise explosion/crunch using sawtooth with fast sweep down to 40Hz
    this.playTone([220], 0.18, 'sawtooth', 40);
  }

  playGameOver() {
    // Descending sad tone
    this.playTone([400], 0.5, 'sine', 100);
  }

  playSkinUnlocked() {
    // Uplifting arpeggio
    this.playTone([523.25, 659.25, 783.99, 1046.50, 1318.51], 0.5, 'triangle');
  }

  playScoreMilestone() {
    // Double bell ring
    this.playTone([880, 1760, 880, 1760], 0.35, 'sine');
  }
}

export const sounds = new SoundManager();
