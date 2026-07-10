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
import { sounds } from './sounds';
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
  const [lives, setLives] = useState(1); // Expose extra lives state to React HUD
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
    setLives(1);
  }, [canvasRef, skin]);

  const reviveAt = useCallback((invincibleMs: number) => {
    const state = stateRef.current;
    if (!state) return;
    state.running = true;
    state.fishY = state.height / 2;
    state.fishVY = 0;
    state.lives = 1; // Reset to 1 life on revive/continue ad
    setLives(1);
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

    // Play Game Start sound!
    sounds.playGameStart();

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
              onScore: (s) => {
                setScore(s);
                // Score Milestone sound! Plays every 10 points
                if (s > 0 && s % 10 === 0) {
                  sounds.playScoreMilestone();
                }
              },
              onCoinCollect: (amount) => {
                roundCoinsRef.current += amount;
                let total = addCoins(amount);

                // Play Coin Collected sound & light vibration
                sounds.playCoinCollected();
                if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try { navigator.vibrate(15); } catch {}
                }

                const { state: challengeState, justCompleted } = updateDailyChallengeProgress('coins', amount);
                if (justCompleted) {
                  total = addCoins(challengeState.challenge.rewardCoins);
                }
                setCoins(total);
                if (total >= 50) unlockAchievement('coin_collector');
              },
              onGemCollect: () => {
                // Expose new lives counter to React UI
                setLives(state.lives);

                // Play Gem Collected sound & medium vibration
                sounds.playGemCollected();
                if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try { navigator.vibrate(40); } catch {}
                }
              },
              onLifeLost: (remainingLives) => {
                setLives(remainingLives);

                // Play Obstacle Hit sound & stronger vibration
                sounds.playObstacleHit();
                if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try { navigator.vibrate(100); } catch {}
                }
              },
              onDeath: () => {
                const finalScore = state.score;
                const best = getPersonalBest();

                // Play Game Over sound & strongest vibration
                sounds.playGameOver();
                if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try { navigator.vibrate(150); } catch {}
                }

                if (finalScore > best) {
                  setPersonalBest(finalScore);
                  // Check if we just unlocked a skin based on personal best
                  const thresholds = [25, 50, 100, 200];
                  const unlockedNow = thresholds.some(t => best < t && finalScore >= t);
                  if (unlockedNow) {
                    sounds.playSkinUnlocked();
                  }
                }

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
    lives, // Return lives state to React component
    roundCoins: roundCoinsRef.current,
    doJump,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
  };
}
