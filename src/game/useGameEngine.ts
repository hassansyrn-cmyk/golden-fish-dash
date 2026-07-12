import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCoins,
  consumeShopItem,
  getCoins,
  getPersonalBest,
  getSettings,
  getShopInventory,
  getUpgradeLevel,
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
import { getLevelInfo, addXP, getLevelRewards } from './managers/ProgressionManager';
import { getDailyMissions, updateMissionProgress, getMissionRewards, type Mission } from './managers/MissionManager';
import { analytics } from './managers/AnalyticsManager';
import { adManager } from './managers/AdManager';
import { debounce } from '../utils/performance';
import type { EngineState } from './engine';
import type { ShopItemId, SkinId } from './types';

import { SKINS } from './constants';

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

  // === PHASE 3 + 4 + 5 ===
  const totalXPRef = useRef(0);
  const missionsRef = useRef<Mission[]>(getDailyMissions());
  const gamesPlayedRef = useRef(0);

  // === PHASE 2 ===
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

  // Get current skin ability
  const currentSkin = SKINS.find(s => s.id === skin);
  const skinAbility = currentSkin?.ability || 'lucky_catch';

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
    if (inv.dash > 0) {
      consumeShopItem('dash');
      const now = performance.now();
      const dashDuration = 1600;
      powerUpManager.activate({ type: 'dash', endTime: now + dashDuration, strength: 1.7 });
      engine.invincibleUntil = now + dashDuration;
      applied = true;
    }

    // === Phase 8: Apply skin passive abilities ===
    if (skinAbility === 'royal_presence') {
      engine.shieldCharges = Math.max(engine.shieldCharges, 1);
    }

    if (skinAbility === 'precious') {
      engine.gemBoostActive = true;
    }

    if (skinAbility === 'lucky_catch') {
      engine.luckyCatchActive = true; // Golden fish - higher coin spawn
    }

    roundCoinsRef.current = 0;
    lastMilestoneRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    nearMissCountRef.current = 0;
    gamesPlayedRef.current = 0;
    startTimeRef.current = performance.now();
    difficultyRef.current = getCurrentDifficulty(0);
    powerUpManager.reset();
    missionsRef.current = getDailyMissions();

    analytics.track('game_start');

    setScore(0);
    setRoundCoins(0);
    setCoins(getCoins());
    setLives(engine.lives ?? 0);
  }, [canvasRef, skin, skinAbility]);

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

  const activateDash = useCallback((durationMs = 1400, strength = 1.8) => {
    const state = stateRef.current;
    if (!state) return false;

    const now = performance.now();
    powerUpManager.activate({ type: 'dash', endTime: now + durationMs, strength });

    state.invincibleUntil = now + durationMs;
    state.fishVY = -13;

    playSoundEffect('reward');
    safeVibrate([30, 20, 50], getSettings().vibration);

    const { updatedMissions } = updateMissionProgress(missionsRef.current, 'use_dash', 1);
    missionsRef.current = updatedMissions;

    analytics.track('powerup_activated', { type: 'dash' });

    return true;
  }, []);

  const activateSlowMotion = useCallback((durationMs = 2500) => {
    const now = performance.now();
    powerUpManager.activate({ type: 'slowMotion', endTime: now + durationMs });

    playSoundEffect('milestone');
    safeVibrate([20, 40, 20], getSettings().vibration);

    analytics.track('powerup_activated', { type: 'slowMotion' });

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

        const { updatedMissions, justCompleted } = updateMissionProgress(missionsRef.current, 'reach_score', newScore);
        missionsRef.current = updatedMissions;

        if (justCompleted) {
          const mission = missionsRef.current.find(m => m.id === justCompleted);
          if (mission) {
            const rewards = getMissionRewards(mission);
            if (rewards.coins) {
              const newTotal = addCoins(rewards.coins);
              setCoins(newTotal);
            }
            playSoundEffect('achievement');
            safeVibrate([30, 25, 40], getSettings().vibration);
            analytics.track('mission_completed', { missionId: justCompleted });
          }
        }
      },

      onCoinCollect: (amount: number) => {
        comboRef.current += 1;
        if (comboRef.current > maxComboRef.current) {
          maxComboRef.current = comboRef.current;
        }

        const diff = difficultyRef.current;
        let finalAmount = Math.floor(amount * diff.rewardMultiplier * powerUpManager.getCoinMultiplier());

        // === Phase 8: Collector skin bonus ===
        if (skinAbility === 'collector') {
          finalAmount = Math.floor(finalAmount * 1.2); // 20% more value
        }

        const combo = comboRef.current;

        // === PHASE 5: Extra coin bonus on high combos (final polish) ===
        if (combo === 15) finalAmount += 5;
        if (combo === 25) finalAmount += 8;
        if (combo === 35) finalAmount += 12;

        if (combo >= 30) finalAmount = Math.floor(finalAmount * 2.5);
        else if (combo >= 20) finalAmount = Math.floor(finalAmount * 2.0);
        else if (combo >= 10) finalAmount = Math.floor(finalAmount * 1.5);

        roundCoinsRef.current += finalAmount;
        setRoundCoins(roundCoinsRef.current);

        let total = addCoins(finalAmount);

        if (combo === 10 || combo === 20 || combo === 30 || combo === 15 || combo === 25 || combo === 35) {
          playSoundEffect('achievement');
          safeVibrate([40, 30, 40], getSettings().vibration);
        } else {
          playSoundEffect('coin');
          safeVibrate(18, getSettings().vibration);
        }

        const { state: challengeState, justCompleted: challengeJustCompleted } = updateDailyChallengeProgress(
          'coins',
          finalAmount,
        );

        if (challengeJustCompleted) {
          total = addCoins(challengeState.challenge.rewardCoins);
          playSoundEffect('achievement');
          safeVibrate([25, 25, 35], getSettings().vibration);
        }

        const { updatedMissions, justCompleted } = updateMissionProgress(missionsRef.current, 'collect_coins', finalAmount);
        missionsRef.current = updatedMissions;

        if (justCompleted) {
          const mission = missionsRef.current.find(m => m.id === justCompleted);
          if (mission) {
            const rewards = getMissionRewards(mission);
            if (rewards.coins) {
              const newTotal = addCoins(rewards.coins);
              setCoins(newTotal);
            }
            playSoundEffect('achievement');
            safeVibrate([30, 25, 40], getSettings().vibration);
            analytics.track('mission_completed', { missionId: justCompleted });
          }
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

        const xpGained = Math.floor(finalScore * 0.8) + 20;
        const result = addXP(totalXPRef.current, xpGained);
        totalXPRef.current = result.newTotal;

        if (result.leveledUp && result.newLevel) {
          const rewards = getLevelRewards(result.newLevel);
          if (rewards.coins) addCoins(rewards.coins);
          playSoundEffect('achievement');
          safeVibrate([50, 30, 50], getSettings().vibration);

          analytics.track('level_up', { level: result.newLevel, xp: totalXPRef.current });
        }

        gamesPlayedRef.current += 1;
        const { updatedMissions, justCompleted } = updateMissionProgress(missionsRef.current, 'play_games', 1);
        missionsRef.current = updatedMissions;

        if (justCompleted) {
          const mission = missionsRef.current.find(m => m.id === justCompleted);
          if (mission) {
            const rewards = getMissionRewards(mission);
            if (rewards.coins) {
              const newTotal = addCoins(rewards.coins);
              setCoins(newTotal);
            }
            playSoundEffect('achievement');
            safeVibrate([30, 25, 40], getSettings().vibration);
            analytics.track('mission_completed', { missionId: justCompleted });
          }
        }

        playSoundEffect('gameover');
        safeVibrate([80, 50, 120], getSettings().vibration);

        analytics.track('game_over', { score: finalScore, level: getLevelInfo(totalXPRef.current).level });

        if (adManager.shouldShowInterstitial()) {
          analytics.track('ad_watched', { type: 'interstitial' });
        }

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

          analytics.track('near_miss', { intensity });
        }
      },

      // === Phase 8: Fighter skin - bonus score when passing obstacles ===
      onObstaclePassed: (baseScore: number) => {
        if (skinAbility === 'fighter') {
          return baseScore + 1; // +1 bonus point per obstacle
        }
        return baseScore;
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
  const levelInfo = getLevelInfo(totalXPRef.current);

  const shieldLevel = getUpgradeLevel('shield');
  const magnetLevel = getUpgradeLevel('magnet');
  const gemBoostLevel = getUpgradeLevel('gemBoost');
  const dashLevel = getUpgradeLevel('dash');

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
    activateSlowMotion,
    // === PHASE 3 ===
    level: levelInfo.level,
    levelProgress: levelInfo.progress,
    currentXP: levelInfo.currentXP,
    xpToNextLevel: levelInfo.xpToNextLevel,
    missions: missionsRef.current,
    shieldLevel,
    magnetLevel,
    gemBoostLevel,
    dashLevel,
    shieldCharges: stateRef.current?.shieldCharges ?? 0,
    magnetRemainingMs: Math.max(0, (stateRef.current?.magnetUntil ?? 0) - (stateRef.current?.timeMs ?? 0)),
    doJump,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
    skinAbility,
  };
}
