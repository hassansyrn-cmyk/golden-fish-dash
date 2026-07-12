import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCoins,
  consumeShopItem,
  getCoins,
  getPersonalBest,
  getSettings,
  getShopInventory,
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
import { playSoundEffect, ensureAudioContext } from './managers/AudioManager';
import { debounce } from '../utils/performance';
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

    // === AUTO-APPLY SHOP BOOSTS ON NEW RUN START ===
    const inv = getShopInventory();
    let applied = false;

    if (inv.shield > 0) {
      consumeShopItem('shield');
      engine.shieldCharges = 1;
      applied = true;
    }
    if (inv.magnet > 0) {
      consumeShopItem('magnet');
      engine.magnetUntil = engine.timeMs + 8000;
      applied = true;
    }
    if (inv.gemBoost > 0) {
      consumeShopItem('gemBoost');
      engine.gemBoostActive = true;
      applied = true;
    }

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

    const fishX = state.width * FISH_X_RATIO;

    state.running = true;
    state.fishY = state.height / 2;
    state.fishVY = 0;
    state.invincibleUntil = state.timeMs + invincibleMs;
    state.shakeIntensity = 0;

    state.obstacles = state.obstacles.filter((obs) => {
      const approximateHalfObstacleWidth = 20;
      const obsRight = obs.x + approximateHalfObstacleWidth;
      const obsLeft = obs.x - approximateHalfObstacleWidth;

      const safelyBehindFish = obsRight < fishX - state.width * 0.25;
      const farAhead = obsLeft > state.width + 140;

      return safelyBehindFish || farAhead;
    });

    state.elapsedSinceSpawn = -850;

    playSoundEffect('reward');
    safeVibrate([45, 35, 45], getSettings().vibration);
  }, []);

  // === PERFORMANCE OPTIMIZATION (Phase 1) ===
  const stepCallbacksRef = useRef<any>(null);

  if (!stepCallbacksRef.current) {
    stepCallbacksRef.current = {
      onScore: (newScore: number) => {
        setScore(newScore);

        const milestone = Math.floor(newScore / 25);
        if (milestone > lastMilestoneRef.current && newScore > 0) {
          lastMilestoneRef.current = milestone;
          playSoundEffect('milestone');
          safeVibrate(25, getSettings().vibration);
        }
      },

      onCoinCollect: (amount: number) => {
        roundCoinsRef.current += amount;
        setRoundCoins(roundCoinsRef.current);

        let total = addCoins(amount);

        playSoundEffect('coin');
        safeVibrate(18, getSettings().vibration);

        const { state: challengeState, justCompleted } = updateDailyChallengeProgress(
          'coins',
          amount,
        );

        if (justCompleted) {
          total = addCoins(challengeState.challenge.rewardCoins);
          playSoundEffect('achievement');
          safeVibrate([25, 25, 35], getSettings().vibration);
        }

        setCoins(total);

        if (total >= 50) {
          unlockAchievement('coin_collector');
        }
      },

      onGemCollect: (currentLives: number) => {
        setLives(currentLives);
        playSoundEffect('gem');
        safeVibrate([35, 25, 55], getSettings().vibration);
      },

      onLifeChange: (currentLives: number) => {
        setLives(currentLives);
        if (currentLives <= 0) {
          safeVibrate(35, getSettings().vibration);
        }
      },

      onDeath: () => {
        const state = stateRef.current;
        if (!state) return;
        const finalScore = state.score;
        const best = getPersonalBest();

        playSoundEffect('gameover');
        safeVibrate([80, 50, 120], getSettings().vibration);

        if (finalScore > best) {
          setPersonalBest(finalScore);
          playSoundEffect('achievement');
        }

        if (finalScore >= 10) unlockAchievement('getting_better');
        if (finalScore >= 25) unlockAchievement('deep_diver');
        if (finalScore >= 50) unlockAchievement('ocean_master');
        if (finalScore >= 100) unlockAchievement('legendary_swimmer');

        const scoreProgress = updateDailyChallengeProgress('score', finalScore);

        if (scoreProgress.justCompleted) {
          const total = addCoins(scoreProgress.state.challenge.rewardCoins);
          setCoins(total);
          playSoundEffect('achievement');
          safeVibrate([25, 25, 45], getSettings().vibration);
        }

        if (finalScore >= 26) {
          const hardModeProgress = updateDailyChallengeProgress('hardMode', 1);
          if (hardModeProgress.justCompleted) {
            const total = addCoins(hardModeProgress.state.challenge.rewardCoins);
            setCoins(total);
            playSoundEffect('achievement');
            safeVibrate([25, 25, 45], getSettings().vibration);
          }
        }

        onGameOverRef.current(finalScore);
      },

      onShake: (intensity: number) => {
        const state = stateRef.current;
        if (!state) return;
        state.shakeIntensity = intensity;

        if (intensity >= 4) {
          playSoundEffect('hit');
          safeVibrate(55, getSettings().vibration);
        }
      },
    };
  }

  useEffect(() => {
    if (!active) return;

    setup();
    incrementRoundsPlayed();
    unlockAchievement('first_flight');
    ensureAudioContext();

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
          stepEngine(
            state,
            dt,
            stepCallbacksRef.current,
            { vibration: getSettings().vibration },
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

    // PERFORMANCE: Debounced resize for better mobile/orientation stability
    const debouncedResize = debounce(() => {
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
    }, 150);

    window.addEventListener('resize', debouncedResize);

    return () => {
      mounted = false;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      window.removeEventListener('resize', debouncedResize);
    };
  }, [active, setup, canvasRef]);

  const doJump = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;

    playSoundEffect('jump');
    safeVibrate(10, getSettings().vibration);

    jumpEngine(state, { vibration: getSettings().vibration });
  }, []);

  return {
    score,
    coins,
    roundCoins,
    lives,
    shieldCharges: stateRef.current?.shieldCharges ?? 0,
    magnetRemainingMs: Math.max(0, (stateRef.current?.magnetUntil ?? 0) - (stateRef.current?.timeMs ?? 0)),
    doJump,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
  };
}
