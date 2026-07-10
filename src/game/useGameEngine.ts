import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addCoins,
  getCoins,
  getPersonalBest,
  getSettings,
  incrementRoundsPlayed,
  setPersonalBest,
  unlockAchievement,
  updateDailyChallengeProgress,
} from './storage';
import {
  FISH_X_RATIO,
  createEngine,
  jump as jumpEngine,
  renderEngine,
  stepEngine,
} from './engine';
import type { EngineState } from './engine';
import type { SkinId } from './types';

interface UseGameEngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  active: boolean;
  paused: boolean;
  skin: SkinId;
  onGameOver: (finalScore: number) => void;
}

function safeVibrate(pattern: number | number[], enabled: boolean) {
  if (!enabled) return;
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore unsupported vibration errors.
  }
}

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

function playSound(name: SoundName, enabled: boolean) {
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

export function useGameEngine({ canvasRef, active, paused, skin, onGameOver }: UseGameEngineOptions) {
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(() => getCoins());
  const [roundCoins, setRoundCoins] = useState(0);
  const [lives, setLives] = useState(0);

  const stateRef = useRef<EngineState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const roundCoinsRef = useRef(0);
  const lastMilestoneRef = useRef(0);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    const engine = createEngine(width, height, skin);
    stateRef.current = engine;

    roundCoinsRef.current = 0;
    lastMilestoneRef.current = 0;

    setScore(0);
    setRoundCoins(0);
    setCoins(getCoins());
    setLives(engine.lives ?? 0);
  }, [canvasRef, skin]);

  const reviveAt = useCallback((invincibleMs: number) => {
    const state = stateRef.current;
    if (!state) return;

    const settings = getSettings();
    const fishX = state.width * FISH_X_RATIO;

    state.running = true;
    state.fishY = state.height / 2;
    state.fishVY = 0;
    state.invincibleUntil = state.timeMs + invincibleMs;

    /*
      Clear dangerous obstacles around the revive area.

      Before this fix, the fake rewarded-ad revive could return the player
      beside an obstacle or inside an almost impossible gap. Keeping the
      run alive is correct, but the player also needs a safe recovery lane.
    */
    state.obstacles = state.o*stacles.filter((obs) => {
      co*st approximateHalfObstacleWidth = *0;
      const obsRight = obs.x + *pproximateHalfObstacleWidth;
     *const obsLeft = obs.x - approximat*HalfObstacleWidth;

      const sa*elyBehindFish = obsRight < fishX -*state.width * 0.25;
      const fa*Ahead = obsLeft > state.width + 14*;

      return safelyBehindFish |* farAhead;
    });

    // Give th* player a short breathing room before the next obstacle.
    state.elapsedSinceSpawn = -850;

    playSound('reward', settings.sound);
    safeVibrate([45, 35, 45], settings.vibration);
  }, []);

  useEffect(() => {
    if (!active) return;

    setup();
    incrementRoundsPlayed();
    unlockAchievement('first_flight');

    let mounted = true;
    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      if (!mounted) return;

      const dt = Math.min(48, now - lastTimeRef.current);
      lastTimeRef.current = now;

      const state = stateRef.current;
      const canvas = canvasRef.current;

      if (state && canvas) {
        if (!pausedRef.current && state.running) {
          const settings = getSettings();

          stepEngine(
            state,
            dt,
            {
              onScore: (newScore) => {
                setScore(newScore);

                const milestone = Math.floor(newScore / 25);

                if (milestone > lastMilestoneRef.current && newScore > 0) {
                  lastMilestoneRef.current = milestone;
                  playSound('milestone', settings.sound);
                  safeVibrate(25, settings.vibration);
                }
              },

              onCoinCollect: (amount) => {
                roundCoinsRef.current += amount;
                setRoundCoins(roundCoinsRef.current);

                let total = addCoins(amount);

                playSound('coin', settings.sound);
                safeVibrate(18, settings.vibration);

                const { state: challengeState, justCompleted } = updateDailyChallengeProgress(
                  'coins',
                  amount,
                );

                if (justCompleted) {
                  total = addCoins(challengeState.challenge.rewardCoins);
                  playSound('achievement', settings.sound);
                  safeVibrate([25, 25, 35], settings.vibration);
                }

                setCoins(total);

                if (total >= 50) {
                  unlockAchievement('coin_collector');
                }
              },

              onGemCollect: (currentLives) => {
                setLives(currentLives);
                playSound('gem', settings.sound);
                safeVibrate([35, 25, 55], settings.vibration);
              },

              onLifeChange: (currentLives) => {
                setLives(currentLives);

                if (currentLives <= 0) {
                  safeVibrate(35, settings.vibration);
                }
              },

              onDeath: () => {
                const finalScore = state.score;
                const best = getPersonalBest();

                playSound('gameover', settings.sound);
                safeVibrate([80, 50, 120], settings.vibration);

                if (finalScore > best) {
                  setPersonalBest(finalScore);
                  playSound('achievement', settings.sound);
                }

                if (finalScore >= 10) unlockAchievement('getting_better');
                if (finalScore >= 25) unlockAchievement('deep_diver');
                if (finalScore >= 50) unlockAchievement('ocean_master');
                if (finalScore >= 100) unlockAchievement('legendary_swimmer');

                const scoreProgress = updateDailyChallengeProgress('score', finalScore);

                if (scoreProgress.justCompleted) {
                  const total = addCoins(scoreProgress.state.challenge.rewardCoins);
                  setCoins(total);
                  playSound('achievement', settings.sound);
                  safeVibrate([25, 25, 45], settings.vibration);
                }

                if (finalScore >= 26) {
                  const hardModeProgress = updateDailyChallengeProgress('hardMode', 1);

                  if (hardModeProgress.justCompleted) {
                    const total = addCoins(hardModeProgress.state.challenge.rewardCoins);
                    setCoins(total);
                    playSound('achievement', settings.sound);
                    safeVibrate([25, 25, 45], settings.vibration);
                  }
                }

                onGameOverRef.current(finalScore);
              },

              onShake: (intensity) => {
                state.shakeIntensity = intensity;

                if (intensity >= 4) {
                  playSound('hit', settings.sound);
                  safeVibrate(55, settings.vibration);
                }
              },
            },
            { vibration: settings.vibration },
          );
        }

        const ctx = canvas.getContext('2d');

        if (ctx) {
          renderEngine(ctx, state);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const handleResize = () => {
      const canvas = canvasRef.current;
      const state = stateRef.current;

      if (!canvas || !state) return;

      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? window.innerWidth;
      const height = parent?.clientHeight ?? window.innerHeight;

      canvas.width = width;
      canvas.height = height;

      state.width = width;
      state.height = height;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      mounted = false;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      window.removeEventListener('resize', handleResize);
    };
  }, [active, setup, canvasRef]);

  const doJump = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;

    const settings = getSettings();

    playSound('jump', settings.sound);
    safeVibrate(10, settings.vibration);

    jumpEngine(state, { vibration: settings.vibration });
  }, []);

  return {
    score,
    coins,
    roundCoins,
    lives,
    doJump,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
  };
}
