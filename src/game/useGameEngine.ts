import { useCallback, useEffect, useRef, useState } from 'react';
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
  incrementMissionProgress,
  addXP,
  getUpgradeLevel,
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
import { audioManager } from './managers/AudioManager';
import type { SoundName } from './managers/AudioManager';

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

    // Apply upgrade levels directly to starting engine configurations
    const shieldLvl = getUpgradeLevel('shield');
    const magnetLvl = getUpgradeLevel('magnet');
    const gemLvl = getUpgradeLevel('gemBoost');

    stateRef.current = engine;

    // === AUTO-APPLY SHOP BOOSTS ON NEW RUN START ===
    // This runs every time a new engine is created for a run.
    // It checks current inventory, applies the boosts, and consumes the items.
    const inv = getShopInventory();

    if (inv.shield > 0 || shieldLvl > 0) {
      if (inv.shield > 0) consumeShopItem('shield');
      // Upgrade increases starting shield charges
      engine.shieldCharges = 1 + shieldLvl;
      incrementMissionProgress('m_shield', 1);
    }

    // Moorish Idol legendary skin ability: 15% chance to start with a free shield if no shield is active
    if (skin === 'legendary' && engine.shieldCharges === 0) {
      if (Math.random() < 0.15) {
        engine.shieldCharges = 1;
      }
    }

    if (inv.magnet > 0 || magnetLvl > 0) {
      if (inv.magnet > 0) consumeShopItem('magnet');
      // Upgrade increases starting magnet duration (8s base + 3s per level)
      engine.magnetUntil = engine.timeMs + 8000 + (magnetLvl * 3000);
    }
    if (inv.gemBoost > 0 || gemLvl > 0) {
      if (inv.gemBoost > 0) consumeShopItem('gemBoost');
      // Upgrade increases gem spawn rate even further
      engine.gemBoostActive = true;
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

    const settings = getSettings();
    const fishX = state.width * FISH_X_RATIO;

    state.running = true;
    state.fishY = state.height / 2;
    state.fishVY = 0;
    state.invincibleUntil = state.timeMs + invincibleMs;
    state.shakeIntensity = 0; // Reset any camera shake so revive countdown is smooth (no background tremble)

    state.obstacles = state.obstacles.filter((obs) => {
      const approximateHalfObstacleWidth = 20;
      const obsRight = obs.x + approximateHalfObstacleWidth;
      const obsLeft = obs.x - approximateHalfObstacleWidth;

      const safelyBehindFish = obsRight < fishX - state.width * 0.25;
      const farAhead = obsLeft > state.width + 140;

      return safelyBehindFish || farAhead;
    });

    state.sharks = state.sharks.filter((shark) => {
      return shark.x < fishX - 80 || shark.x > state.width + 100;
    });

    state.seaMines = state.seaMines.filter((mine) => {
      return mine.x < fishX - 80 || mine.x > state.width + 100;
    });

    state.jellyfish = state.jellyfish.filter((jelly) => {
      return jelly.x < fishX - 80 || jelly.x > state.width + 100;
    });

    state.elapsedSinceSpawn = -850;

    audioManager.playSound('reward', settings.sound);
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
                  audioManager.playSound('milestone', settings.sound);
                  safeVibrate(25, settings.vibration);
                }
              },

              onCoinCollect: (amount) => {
                // Apply Coin Multiplier Upgrade level directly to coin earnings (+1 coin per level)
                const multLevel = getUpgradeLevel('coinMultiplier');
                const bonusCoins = multLevel;
                let finalAmount = amount + bonusCoins;

                // Goldfish skin ability: +10% Bonus Coins
                if (skin === 'golden') {
                  finalAmount = Math.ceil(finalAmount * 1.1);
                }

                roundCoinsRef.current += finalAmount;
                setRoundCoins(roundCoinsRef.current);

                let total = addCoins(finalAmount);

                audioManager.playSound('coin', settings.sound);
                safeVibrate(18, settings.vibration);

                // If massive coin amount collected (e.g. 15 from treasure chest)
                if (amount >= 15) {
                  unlockAchievement('treasure_hunter');
                }

                const { state: challengeState, justCompleted } = updateDailyChallengeProgress(
                  'coins',
                  finalAmount,
                );

                if (justCompleted) {
                  total = addCoins(challengeState.challenge.rewardCoins);
                  audioManager.playSound('achievement', settings.sound);
                  safeVibrate([25, 25, 35], settings.vibration);
                }

                incrementMissionProgress('m_coins', finalAmount);

                // Check coin combos for combo master achievement
                if (stateRef.current && stateRef.current.coinStreakCount >= 20) {
                  unlockAchievement('combo_master');
                }

                setCoins(total);

                if (total >= 50) {
                  unlockAchievement('coin_collector');
                }
              },

              onGemCollect: (currentLives) => {
                setLives(currentLives);
                audioManager.playSound('gem', settings.sound);
                safeVibrate([35, 25, 55], settings.vibration);
                incrementMissionProgress('m_gems', 1);
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

                audioManager.playSound('gameover', settings.sound);
                safeVibrate([80, 50, 120], settings.vibration);

                if (finalScore > best) {
                  setPersonalBest(finalScore);
                  audioManager.playSound('achievement', settings.sound);
                }

                if (finalScore >= 10) unlockAchievement('getting_better');
                if (finalScore >= 25) unlockAchievement('deep_diver');
                if (finalScore >= 50) unlockAchievement('ocean_master');
                if (finalScore >= 100) unlockAchievement('legendary_swimmer');

                // Perfect Run (Survivor) achievement check: score >= 20 and full remaining lives
                if (finalScore >= 20 && state.lives === state.maxLives) {
                  unlockAchievement('no_damage');
                }

                const scoreProgress = updateDailyChallengeProgress('score', finalScore);

                if (scoreProgress.justCompleted) {
                  const total = addCoins(scoreProgress.state.challenge.rewardCoins);
                  setCoins(total);
                  audioManager.playSound('achievement', settings.sound);
                  safeVibrate([25, 25, 45], settings.vibration);
                }

                if (finalScore >= 26) {
                  const hardModeProgress = updateDailyChallengeProgress('hardMode', 1);

                  if (hardModeProgress.justCompleted) {
                    const total = addCoins(hardModeProgress.state.challenge.rewardCoins);
                    setCoins(total);
                    audioManager.playSound('achievement', settings.sound);
                    safeVibrate([25, 25, 45], settings.vibration);
                  }
                }

                // Award Player progression XP based on performance: final score & coins
                const xpAward = Math.floor(finalScore * 2.5 + roundCoinsRef.current * 1.5);
                addXP(xpAward);

                incrementMissionProgress('m_rounds', 1);

                onGameOverRef.current(finalScore);
              },

              onShake: (intensity) => {
                state.shakeIntensity = intensity;

                if (intensity >= 4) {
                  audioManager.playSound('hit', settings.sound);
                  safeVibrate(55, settings.vibration);
                }
              },

              onRedFlash: () => {
                state.isRedFlashing = true;
                state.redFlashTimer = 180; // flash screen in ms
              },

              onNearMiss: () => {
                audioManager.playSound('milestone', settings.sound);
                safeVibrate(22, settings.vibration);
              },

              onFeverStart: () => {
                audioManager.playSound('reward', settings.sound);
                setTimeout(() => audioManager.playSound('achievement', settings.sound), 150);
                safeVibrate([30, 20, 50], settings.vibration);
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

    audioManager.playSound('jump', settings.sound);
    safeVibrate(10, settings.vibration);

    jumpEngine(state, { vibration: settings.vibration });
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
    engineStateRef: stateRef,
  };
}
