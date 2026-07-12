// -----------------------------------------------------------------------
// Sound effects for Golden Fish Rush.
//
// Small procedural WebAudio tones (no audio files/assets needed). Split
// out of useGameEngine.ts so the game-loop hook only orchestrates state,
// and audio is its own self-contained module — pure move, same tones,
// same timings, same public playSound(name, enabled) signature.
// -----------------------------------------------------------------------

type SoundName =
  | 'jump'
  | 'coin'
  | 'gem'
  | 'reward'
  | 'achievement'
  | 'hit'
  | 'gameover'
  | 'milestone';

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function playTone(frequency: number, durationMs: number, type: OscillatorType, gainValue = 0.045) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.02);
  } catch {
    // Ignore audio errors.
  }
}

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;

  switch (name) {
    case 'jump':
      playTone(520, 70, 'sine', 0.035);
      break;

    case 'coin':
      playTone(880, 75, 'triangle', 0.045);
      setTimeout(() => playTone(1180, 65, 'triangle', 0.035), 55);
      break;

    case 'gem':
      playTone(960, 90, 'triangle', 0.045);
      setTimeout(() => playTone(1280, 100, 'sine', 0.04), 80);
      setTimeout(() => playTone(1600, 130, 'triangle', 0.035), 170);
      break;

    case 'reward':
      playTone(740, 80, 'triangle', 0.045);
      setTimeout(() => playTone(980, 80, 'triangle', 0.04), 70);
      setTimeout(() => playTone(1320, 110, 'triangle', 0.035), 140);
      break;

    case 'achievement':
      playTone(660, 80, 'sine', 0.045);
      setTimeout(() => playTone(880, 90, 'sine', 0.04), 80);
      setTimeout(() => playTone(1100, 120, 'sine', 0.035), 165);
      break;

    case 'hit':
      playTone(180, 120, 'sawtooth', 0.04);
      break;

    case 'gameover':
      playTone(260, 130, 'sawtooth', 0.04);
      setTimeout(() => playTone(170, 180, 'sawtooth', 0.035), 130);
      break;

    case 'milestone':
      playTone(600, 75, 'square', 0.035);
      setTimeout(() => playTone(900, 90, 'square', 0.03), 80);
      break;

    default:
      break;
  }
}
