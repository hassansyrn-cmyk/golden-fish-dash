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
import { createEngine, jump as jumpEngine, renderEngine, stepEngine } from './engine';
import type { EngineState } from './engine';
import type { SkinId } from './types';

interface UseGameEngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  active: boolean;
  paused: boolean;
  skin: SkinId;
  onGameOver: (finalScore: number) => void;
}

export function useGameEngine({ canvasRef, active, paused, skin, onGameOver }: UseGameEngineOptions) {
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(() => getCoins());
  const stateRef = useRef<EngineState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const roundCoinsRef = useRef(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    stateRef.current = createEngine(width, height, skin);
    roundCoinsRef.current = 0;
    setScore(0);
  }, [canvasRef, skin]);

  const reviveAt = useCallback((invincibleMs: number) => {
    const state = stateRef.current;
    if (!state) return;
    state.running = true;
    state.fishY = state.height / 2;
    state.fishVY = 0;
    state.invincibleUntil = state.timeMs + invincibleMs;
    // Push obstacles further out so the player has breathing room after revive.
    for (const obs of state.obstacles) {
      if (obs.x < state.width * 0.6) obs.x += state.width * 0.6;
    }
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
              onScore: (s) => setScore(s),
              onCoinCollect: (amount) => {
                roundCoinsRef.current += amount;
                let total = addCoins(amount);
                const { state: challengeState, justCompleted } = updateDailyChallengeProgress('coins', amount);
                if (justCompleted) {
                  total = addCoins(challengeState.challenge.rewardCoins);
                }
                setCoins(total);
                if (total >= 50) unlockAchievement('coin_collector');
              },
              onDeath: () => {
                const finalScore = state.score;
                const best = getPersonalBest();
                if (finalScore > best) setPersonalBest(finalScore);
                if (finalScore >= 10) unlockAchievement('getting_better');
                if (finalScore >= 25) unlockAchievement('deep_diver');
                if (finalScore >= 50) unlockAchievement('ocean_master');
                if (finalScore >= 100) unlockAchievement('legendary_swimmer');
                const scoreProgress = updateDailyChallengeProgress('score', finalScore);
                if (scoreProgress.justCompleted) {
                  const total = addCoins(scoreProgress.state.challenge.rewardCoins);
                  setCoins(total);
                }
                if (finalScore >= 26) {
                  const hardModeProgress = updateDailyChallengeProgress('hardMode', 1);
                  if (hardModeProgress.justCompleted) {
                    const total = addCoins(hardModeProgress.state.challenge.rewardCoins);
                    setCoins(total);
                  }
                }
                onGameOver(finalScore);
              },
              onShake: (intensity) => {
                state.shakeIntensity = intensity;
              },
            },
            { vibration: settings.vibration },
          );
        }
        const ctx = canvas.getContext('2d');
        if (ctx) renderEngine(ctx, state);
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, setup, onGameOver]);

  const doJump = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const settings = getSettings();
    jumpEngine(state, { vibration: settings.vibration });
  }, []);

  return {
    score,
    coins,
    roundCoins: roundCoinsRef.current,
    doJump,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
  };
}
