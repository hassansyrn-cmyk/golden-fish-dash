import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addCoins,
  consumeShopItem,
  getCoins,
  getPersonalBest,
  getSettings,
  getShopInventory,
  incrementRoundsPlayed,
  markLoreFound,
  recordRunChapters,
  recordRunTotals,
  setPersonalBest,
  unlockAchievement,
  updateDailyChallengeProgress,
  incrementMissionProgress,
  addXP,
  getUpgradeLevel,
  getChapterProgress,
} from './storage';
import {
  FISH_X_RATIO,
  createEngine,
  jump as jumpEngine,
  renderEngine,
  stepEngine,
} from './engine';
import type { EngineState } from './engine';
import type { RunStats } from './engine';
import type { SkinId } from './types';
import { audioManager } from './managers/AudioManager';
import { seedFromQuery } from './ocean/rng';
import { parseLaunchFlags, type RunModifiers } from './ocean/runConfig';

interface UseGameEngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  active: boolean;
  paused: boolean;
  skin: SkinId;
  modifiers: RunModifiers;
  demo: boolean;
  onGameOver: (finalScore: number) => void;
  onChapterTransition?: (chapterIndex: number, chapterId: string) => void;
  onSetPieceStart?: (kind: string, nameKey: string) => void;
}

interface HudState {
  shieldCharges: number;
  magnetRemainingMs: number;
  feverRemainingMs: number;
  hourglassRemainingMs: number;
  dropRushRemainingMs: number;
  comboCount: number;
  comboTier: number;
  comboMeter: number;
  surgeCharge: number;
  surgeActive: boolean;
  schoolCount: number;
  growthStage: number;
  chapterIndex: number;
  chapterId: string;
  bossActive: boolean;
  bossKind: string | null;
  bossPearls: number;
  bossTarget: number;
  bossRemainingMs: number;
}

type MiniChallengeKind = 'coins' | 'combo';
type MiniChallengeStatus = 'active' | 'complete' | 'failed';

interface MiniChallengeTemplate {
  id: string;
  label: string;
  objective: string;
  kind: MiniChallengeKind;
  target: number;
  durationMs: number;
  rewardCoins: number;
}

export interface MiniChallengeState extends MiniChallengeTemplate {
  progress: number;
  remainingMs: number;
  startedAt: number;
  status: MiniChallengeStatus;
  resolvedAt?: number;
}

export interface RunSummary {
  score: number;
  roundCoins: number;
  stats: RunStats;
  chaptersVisited: number[];
  improvedChapters: string[];
  medalBefore: Record<string, number>;
  seed: string;
}

const MINI_CHALLENGE_TEMPLATES: MiniChallengeTemplate[] = [
  { id: 'coin-sprint', label: 'COIN SPRINT', objective: 'Collect coins', kind: 'coins', target: 8, durationMs: 15_000, rewardCoins: 25 },
  { id: 'combo-rush', label: 'COMBO RUSH', objective: 'Build a combo', kind: 'combo', target: 8, durationMs: 16_000, rewardCoins: 30 },
];

const EMPTY_HUD_STATE: HudState = {
  shieldCharges: 0,
  magnetRemainingMs: 0,
  feverRemainingMs: 0,
  hourglassRemainingMs: 0,
  dropRushRemainingMs: 0,
  comboCount: 0,
  comboTier: 0,
  comboMeter: 0,
  surgeCharge: 0,
  surgeActive: false,
  schoolCount: 0,
  growthStage: 0,
  chapterIndex: 0,
  chapterId: 'sunlitLagoon',
  bossActive: false,
  bossKind: null,
  bossPearls: 0,
  bossTarget: 0,
  bossRemainingMs: 0,
};

function readHudState(engine: EngineState): HudState {
  const boss = engine.boss;
  return {
    shieldCharges: Math.max(0, Math.min(2, engine.shieldCharges)),
    magnetRemainingMs: Math.max(0, engine.magnetUntil - engine.timeMs),
    feverRemainingMs: Math.max(0, engine.feverUntil - engine.timeMs),
    hourglassRemainingMs: Math.max(0, engine.hourglassUntil - engine.timeMs),
    dropRushRemainingMs: Math.max(0, engine.boostUntil - engine.timeMs),
    comboCount: engine.combo.count,
    comboTier: engine.combo.count >= 6 ? 1 + Math.min(3, Math.floor(engine.combo.count / 10)) : 0,
    comboMeter: engine.combo.meter,
    surgeCharge: engine.surge.charge,
    surgeActive: engine.surge.activeUntil > engine.timeMs,
    schoolCount: engine.companions.filter((c) => c.rescued).length,
    growthStage: engine.growth.stage,
    chapterIndex: engine.chapter.index,
    chapterId: engine.chapter.id,
    bossActive: !!boss && !boss.ended,
    bossKind: boss ? boss.kind : null,
    bossPearls: boss ? boss.pearlsCollected : 0,
    bossTarget: boss ? boss.pearlTarget : 0,
    bossRemainingMs: boss ? Math.max(0, boss.durationMs - (engine.timeMs - boss.startedAtMs)) : 0,
  };
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

function sizeCanvasForDisplay(canvas: HTMLCanvasElement, width: number, height: number) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  const context = canvas.getContext('2d');
  context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

export function useGameEngine({ canvasRef, active, paused, skin, modifiers, demo, onGameOver, onChapterTransition, onSetPieceStart }: UseGameEngineOptions) {
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(() => getCoins());
  const [roundCoins, setRoundCoins] = useState(0);
  const [lives, setLives] = useState(0);
  const [hudState, setHudState] = useState<HudState>(EMPTY_HUD_STATE);
  const [miniChallenge, setMiniChallenge] = useState<MiniChallengeState | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  const stateRef = useRef<EngineState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const roundCoinsRef = useRef(0);
  const lastMilestoneRef = useRef(0);
  const lastHudRefreshRef = useRef(0);
  const miniChallengeRef = useRef<MiniChallengeState | null>(null);
  const lastComboTierRef = useRef(0);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const onGameOverRef = useRef(onGameOver);
  const onChapterTransitionRef = useRef(onChapterTransition);
  const onSetPieceStartRef = useRef(onSetPieceStart);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
    onChapterTransitionRef.current = onChapterTransition;
    onSetPieceStartRef.current = onSetPieceStart;
  }, [onGameOver, onChapterTransition, onSetPieceStart]);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;

    sizeCanvasForDisplay(canvas, width, height);

    const settings = getSettings();
    const engine = createEngine(width, height, skin, {
      seed: seedFromQuery() ?? undefined,
      modifiers,
      demo,
      accessibility: {
        reducedMotion: settings.reducedMotion ?? false,
        reducedFlashes: settings.reducedFlashes ?? false,
        highContrast: settings.highContrast ?? false,
        colorblindShapes: settings.colorblindShapes ?? false,
        steerMode: settings.steerMode ?? false,
      },
    });

    // Apply upgrade levels directly to starting engine configurations
    const shieldLvl = getUpgradeLevel('shield');
    const magnetLvl = getUpgradeLevel('magnet');
    const gemLvl = getUpgradeLevel('gemBoost');

    stateRef.current = engine;

    // === AUTO-APPLY SHOP BOOSTS ON NEW RUN START ===
    const inv = getShopInventory();
    const noBoostModifier = modifiers.includes('noBoost');

    if (!noBoostModifier && (inv.shield > 0 || shieldLvl > 0)) {
      if (inv.shield > 0) consumeShopItem('shield');
      engine.shieldCharges = Math.min(2, 1 + shieldLvl);
      incrementMissionProgress('m_shield', 1);
    }

    // Free starting shield chance (Reef Regent character ability).
    if (skin === 'legendary' && engine.shieldCharges === 0 && !noBoostModifier) {
      if (engine.rng.chance(0.15)) {
        engine.shieldCharges = 1;
      }
    }

    if (!noBoostModifier && (inv.magnet > 0 || magnetLvl > 0)) {
      if (inv.magnet > 0) consumeShopItem('magnet');
      engine.magnetUntil = engine.timeMs + 12000 + (magnetLvl * 3000);
    }
    if (!noBoostModifier && (inv.gemBoost > 0 || gemLvl > 0)) {
      if (inv.gemBoost > 0) consumeShopItem('gemBoost');
      engine.gemBoostActive = true;
    }

    roundCoinsRef.current = 0;
    lastMilestoneRef.current = 0;
    lastComboTierRef.current = 0;

    setScore(0);
    setRoundCoins(0);
    setCoins(getCoins());
    setLives(engine.lives ?? 0);
    setHudState(readHudState(engine));
    setMiniChallenge(null);
    setRunSummary(null);
    miniChallengeRef.current = null;
    lastHudRefreshRef.current = 0;
  }, [canvasRef, skin, modifiers, demo]);

  const reviveAt = useCallback((invincibleMs: number) => {
    const state = stateRef.current;
    if (!state) return;

    const settings = getSettings();
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

    state.sharks = state.sharks.filter((shark) => {
      return shark.x < fishX - 80 || shark.x > state.width + 100;
    });

    state.seaMines = state.seaMines.filter((mine) => {
      return mine.x < fishX - 80 || mine.x > state.width + 100;
    });

    state.jellyfish = state.jellyfish.filter((jelly) => {
      return jelly.x < fishX - 80 || jelly.x > state.width + 100;
    });

    state.barriers = state.barriers.filter((b) => b.x < fishX - 80 || b.x > state.width + 100);

    state.elapsedSinceSpawn = -850;

    audioManager.playSound('reward', settings.sound);
    safeVibrate([45, 35, 45], settings.vibration);
  }, []);

  useEffect(() => {
    if (!active) return;

    setup();
    incrementRoundsPlayed();
    unlockAchievement('first_flight');

    // Debug/QA hook (?debug=1): exposes the live engine for the overlay and
    // for browser-automation screenshots of specific game states.
    if (parseLaunchFlags().debug && typeof window !== 'undefined') {
      (window as unknown as { __gfrEngine?: unknown }).__gfrEngine = stateRef;
    }

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

                if (!miniChallengeRef.current && newScore >= 8) {
                  const template = MINI_CHALLENGE_TEMPLATES[state.rng.int(0, MINI_CHALLENGE_TEMPLATES.length - 1)];
                  const challenge: MiniChallengeState = {
                    ...template,
                    progress: 0,
                    remainingMs: template.durationMs,
                    startedAt: state.timeMs,
                    status: 'active',
                  };
                  miniChallengeRef.current = challenge;
                  setMiniChallenge(challenge);
                  audioManager.playSound('milestone', settings.sound);
                  safeVibrate([16, 22], settings.vibration);
                }

                const milestone = Math.floor(newScore / 25);

                if (milestone > lastMilestoneRef.current && newScore > 0) {
                  lastMilestoneRef.current = milestone;
                  audioManager.playSound('milestone', settings.sound);
                  safeVibrate(25, settings.vibration);
                }
              },

              onCoinCollect: (amount) => {
                const challenge = miniChallengeRef.current;
                if (challenge?.status === 'active') {
                  const progress = challenge.kind === 'coins'
                    ? Math.min(challenge.target, challenge.progress + amount)
                    : Math.min(challenge.target, Math.max(challenge.progress, state.combo.count));
                  const updatedChallenge: MiniChallengeState = { ...challenge, progress };

                  if (progress >= challenge.target) {
                    updatedChallenge.status = 'complete';
                    updatedChallenge.remainingMs = 0;
                    updatedChallenge.resolvedAt = state.timeMs;
                    const rewardTotal = addCoins(challenge.rewardCoins);
                    roundCoinsRef.current += challenge.rewardCoins;
                    setRoundCoins(roundCoinsRef.current);
                    setCoins(rewardTotal);
                    audioManager.playSound('achievement', settings.sound);
                    safeVibrate([25, 18, 35], settings.vibration);
                  }

                  miniChallengeRef.current = updatedChallenge;
                  setMiniChallenge(updatedChallenge);
                }

                // Apply Coin Multiplier Upgrade level directly to coin earnings.
                const multLevel = getUpgradeLevel('coinMultiplier');
                const treasureTideBonus = modifiers.includes('treasureTide') ? Math.ceil(amount * 0.2) : 0;
                let finalAmount = amount + multLevel + treasureTideBonus;

                // Aurum's coin affinity (+10%).
                if (skin === 'golden') {
                  finalAmount = Math.ceil(finalAmount * 1.1);
                }

                roundCoinsRef.current += finalAmount;
                setRoundCoins(roundCoinsRef.current);

                let total = addCoins(finalAmount);

                const coinSound = amount >= 5 ? 'treasure' : 'coin';
                audioManager.playSound(coinSound, settings.sound);
                safeVibrate(18, settings.vibration);

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

                if (stateRef.current && stateRef.current.combo.count >= 20) {
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

                const xpAward = Math.floor(finalScore * 2.5 + roundCoinsRef.current * 1.5);
                addXP(xpAward);

                incrementMissionProgress('m_rounds', 1);

                // Fold chapter progress + lore into persistent collections.
                const medalBefore: Record<string, number> = {};
                const progress = getChapterProgress();
                for (const [id, p] of Object.entries(progress)) {
                  medalBefore[id] = p.setPieceCleared ? 3 : p.setPieceReached ? 2 : p.bestScore > 0 ? 1 : 0;
                }
                const improvedChapters = recordRunChapters(
                  state.runStats.chaptersVisited,
                  finalScore,
                  state.runStats.setPiecesCleared,
                );
                recordRunTotals({
                  surges: state.runStats.surges,
                  rescues: state.runStats.rescues,
                  barriersBroken: state.runStats.barriersBroken,
                  planktonEaten: state.runStats.planktonEaten,
                  pearlsCollected: state.runStats.pearlsCollected,
                  bestCombo: state.runStats.bestCombo,
                });
                for (const loreId of state.runStats.loreFound) {
                  markLoreFound(loreId);
                }
                setRunSummary({
                  score: finalScore,
                  roundCoins: roundCoinsRef.current,
                  stats: { ...state.runStats, loreFound: [...state.runStats.loreFound] },
                  chaptersVisited: [...state.runStats.chaptersVisited],
                  improvedChapters,
                  medalBefore,
                  seed: state.seed,
                });

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
                state.redFlashTimer = 180;
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

              onPowerUpCollect: (type) => {
                if (type === 'shield') {
                  audioManager.playSound('shield', settings.sound);
                  safeVibrate([18, 20, 28], settings.vibration);
                } else if (type !== 'fever') {
                  audioManager.playSound('powerup', settings.sound);
                  safeVibrate(20, settings.vibration);
                }
              },

              onCombo: (count, tier) => {
                if (tier > lastComboTierRef.current) {
                  lastComboTierRef.current = tier;
                  audioManager.playSound('comboTier', settings.sound);
                  safeVibrate([20, 14, 30], settings.vibration);
                }
                void count;
              },

              onComboBreak: () => {
                lastComboTierRef.current = 0;
              },

              onSurgeStart: () => {
                audioManager.playSound('surge', settings.sound);
                safeVibrate([40, 30, 40, 30, 80], settings.vibration);
              },

              onSurgeEnd: () => {
                audioManager.playSound('milestone', settings.sound);
              },

              onCompanionRescued: () => {
                audioManager.playSound('rescue', settings.sound);
                safeVibrate([15, 20, 25], settings.vibration);
              },

              onCompanionLost: () => {
                audioManager.playSound('companionLost', settings.sound);
                safeVibrate([30, 40], settings.vibration);
              },

              onGrowthUp: (stage) => {
                audioManager.playSound('growthUp', settings.sound);
                safeVibrate([25, 20, 45], settings.vibration);
                void stage;
              },

              onChapterTransition: (chapterIndex, chapterId) => {
                audioManager.playSound('chapter', settings.sound);
                safeVibrate([20, 25, 20], settings.vibration);
                onChapterTransitionRef.current?.(chapterIndex, chapterId);
              },

              onSetPieceStart: (kind, nameKey) => {
                audioManager.playSound(kind === 'spectacle' ? 'chapter' : 'bossRoar', settings.sound);
                safeVibrate([50, 40, 90], settings.vibration);
                onSetPieceStartRef.current?.(kind, nameKey);
              },

              onSetPieceEnd: (kind, succeeded) => {
                if (succeeded) {
                  audioManager.playSound('bossEnd', settings.sound);
                  safeVibrate([30, 25, 30, 25, 60], settings.vibration);
                } else {
                  audioManager.playSound('milestone', settings.sound);
                }
                void kind;
              },

              onLoreFound: (loreId) => {
                audioManager.playSound('lore', settings.sound);
                safeVibrate([15, 15, 40], settings.vibration);
                void loreId;
              },

              onCurrentPush: () => {
                audioManager.playSound('current', settings.sound);
              },

              onBarrierBreak: () => {
                audioManager.playSound('coralBreak', settings.sound);
                safeVibrate(30, settings.vibration);
              },
            },
            { vibration: settings.vibration },
          );

          if (now - lastHudRefreshRef.current >= 100) {
            lastHudRefreshRef.current = now;
            setHudState(readHudState(state));

            const challenge = miniChallengeRef.current;
            if (challenge?.status === 'active') {
              const remainingMs = Math.max(0, challenge.durationMs - (state.timeMs - challenge.startedAt));
              if (remainingMs <= 0) {
                const failedChallenge: MiniChallengeState = { ...challenge, remainingMs: 0, status: 'failed', resolvedAt: state.timeMs };
                miniChallengeRef.current = failedChallenge;
                setMiniChallenge(failedChallenge);
              } else {
                const tickingChallenge: MiniChallengeState = { ...challenge, remainingMs };
                miniChallengeRef.current = tickingChallenge;
                setMiniChallenge(tickingChallenge);
              }
            } else if (challenge?.resolvedAt && state.timeMs - challenge.resolvedAt > 2500) {
              miniChallengeRef.current = null;
              setMiniChallenge(null);
            }

            // Adaptive music + ambience follow the run state.
            if (state.boss) {
              audioManager.setMusicState('boss', settings.music);
            } else if (state.surge.activeUntil > state.timeMs) {
              audioManager.setMusicState('surge', settings.music);
            } else if (state.score >= 26) {
              audioManager.setMusicState('danger', settings.music);
            } else {
              audioManager.setMusicState('explore', settings.music);
            }
          }
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

      sizeCanvasForDisplay(canvas, width, height);

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

  /** Steering mode: glide gently toward the held pointer's Y position. */
  const doSteer = useCallback((clientY: number) => {
    const state = stateRef.current;
    if (!state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.height <= 0) return;
    state.steerTargetY = ((clientY - rect.top) / rect.height) * state.height;
  }, [canvasRef]);

  const releaseSteer = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    state.steerTargetY = null;
  }, []);

  return {
    score,
    coins,
    roundCoins,
    lives,
    shieldCharges: hudState.shieldCharges,
    magnetRemainingMs: hudState.magnetRemainingMs,
    feverRemainingMs: hudState.feverRemainingMs,
    hourglassRemainingMs: hudState.hourglassRemainingMs,
    dropRushRemainingMs: hudState.dropRushRemainingMs,
    comboCount: hudState.comboCount,
    comboTier: hudState.comboTier,
    comboMeter: hudState.comboMeter,
    surgeCharge: hudState.surgeCharge,
    surgeActive: hudState.surgeActive,
    schoolCount: hudState.schoolCount,
    growthStage: hudState.growthStage,
    chapterIndex: hudState.chapterIndex,
    chapterId: hudState.chapterId,
    bossActive: hudState.bossActive,
    bossKind: hudState.bossKind,
    bossPearls: hudState.bossPearls,
    bossTarget: hudState.bossTarget,
    bossRemainingMs: hudState.bossRemainingMs,
    miniChallenge,
    runSummary,
    doJump,
    doSteer,
    releaseSteer,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
    engineStateRef: stateRef,
  };
}
