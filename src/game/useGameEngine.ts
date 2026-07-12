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
import { getCurrentDifficulty, type DifficultyState } from './managers/DifficultyManager';
import { powerUpManager } from './managers/PowerUpManager';
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

  // === PHASE 2: COMBO + DIFFICULTY + POWERUPS + DASH ===
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const startTimeRef = useRef(0);
  const difficultyRef = useRef<DifficultyState>(getCurrentDifficulty(0));
  const nearMissCountRef = useRef(0);

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
    comboRef.current = 0;
    maxComboRef.current = 0;
    nearMissCountRef.current = 0;
    startTimeRef.current = performance.now();
    difficultyRef.current = getCurrentDifficulty(0);
    powerUpManager.reset();

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
    comboRef.current = 0;
    powerUpManager.reset();
  }, []);

  // Activate Dash (new Phase 2 power-up)
  const activateDash = useCallback((durationMs = 1200, strength = 1.8) => {
    const state = stateRef.current;
    if (!state) return false;

    const now = performance.now();
    powerUpManager.activate({
      type: 'dash',
      endTime: now + durationMs,
      strength,
    });

    // Give temporary invincibility + forward boost
    state.invincibleUntil = now + durationMs;
    state.fishVY = -12; // strong upward dash

    playSoundEffect('reward');
    safeVibrate([30, 20, 50], getSettings().vibration);

    return true;
  }, []);

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
        comboRef.current += 1;
        if (comboRef.current > maxComboRef.current) {
          maxComboRef.current = comboRef.current;
        }

        const diff = difficultyRef.current;
        let finalAmount = Math.floor(amount * diff.rewardMultiplier * powerUpManager.getCoinMultiplier());

        const combo = comboRef.current;
        if (combo >= 30) finalAmount = Math.floor(finalAmount * 2.5);
        else if (combo >= 20) finalAmount = Math.floor(finalAmount * 2.0);
        else if (combo >= 10) finalAmount = Math.floor(finalAmount * 1.5);

        roundCoinsRef.current += finalAmount;
        setRoundCoins(roundCoinsRef.current);

        let total = addCoins(finalAmount);

        if (combo === 10 || combo === 20 || combo === 30) {
          playSoundEffect('achievement');
          safeVibrate([40, 30, 40], getSettings().vibration);
        } else {
          playSoundEffect('coin');
          safeVibrate(18, getSettings().vibration);
        }

        const { state: challengeState, justCompleted } = updateDailyChallengeProgress(
          'coins',
          finalAmount,
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
        comboRef.current = 0;
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

        comboRef.current = 0;
        powerUpManager.reset();
        onGameOverRef.current(finalScore);
      },

      onShake: (intensity: number) => {
        const state = stateRef.current;
        if (!state) return;
        state.shakeIntensity = intensity;

        if (intensity >= 4) {
          playSoundEffect('hit');
          safeVibrate(55, getSettings().vibration);
          comboRef.current = 0;
        } else if (intensity > 0 && intensity < 3) {
          nearMissCountRef.current += 1;
          const bonus = Math.floor(3 + nearMissCountRef.current * 0.5);
          const total = addCoins(bonus);
          setCoins(total);

          if (nearMissCountRef.current % 3 === 0) {
            playSoundEffect('milestone');
            safeVibrate(25, getSettings().vibration);
          }
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
    startTimeRef.current = performance.now();

    const loop = (now: number) => {
      if (!mounted) return;

      const dt = Math.min(48, now - lastTimeRef.current);
      lastTimeRef.current = now;

      const state = stateRef.current;
      const canvas = canvasRef.current;

      if (state && canvas) {
        if (!pausedRef.current && state.running) {
          const elapsedSeconds = (now - startTimeRef.current) / 1000;
          difficultyRef.current = getCurrentDifficulty(elapsedSeconds, score);
          powerUpManager.update(now);

          // Apply dash strength if active (simple speed boost)
          if (powerUpManager.has('dash')) {
            // We can enhance fish speed here in future iterations
          }

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

  const currentDifficulty = difficultyRef.current;
  const elapsedSeconds = (performance.now() - startTimeRef.current) / 1000;

  return {
    score,
    coins,
    roundCoins,
    lives,
    combo: comboRef.current,
    maxCombo: maxComboRef.current,
    nearMissCount: nearMissCountRef.current,
    elapsedSeconds,
    currentDifficulty,
    activePowerUps: powerUpManager.getActivePowerUps(),
    activateDash,
    shieldCharges: stateRef.current?.shieldCharges ?? 0,
    magnetRemainingMs: Math.max(0, (stateRef.current?.magnetUntil ?? 0) - (stateRef.current?.timeMs ?? 0)),
    doJump,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
  };
}
