/**
 * Enhanced Game Engine Hook - Integration Layer
 * Combines all new systems: particles, background, power-ups, obstacles, audio
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ParticleSystem } from './ParticleSystem';
import { BackgroundRenderer } from './BackgroundRenderer';
import { PowerUpSystem, type PowerUpType } from './PowerUpSystem';
import { AdvancedObstacleSystem } from './AdvancedObstacleSystem';
import { AudioSystem } from './AudioSystem';
import { EnhancedFishRenderer, type FishSkinId } from './EnhancedFishRenderer';
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
import type { EngineState } from './engine';
import type { SkinId } from './types';

interface UseGameEngineEnhancedOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  active: boolean;
  paused: boolean;
  skin: SkinId;
  onGameOver: (finalScore: number) => void;
}

interface GameSystems {
  particles: ParticleSystem;
  background: BackgroundRenderer;
  powerUps: PowerUpSystem;
  obstacles: AdvancedObstacleSystem;
  audio: AudioSystem;
  fishRenderer: EnhancedFishRenderer;
}

function safeVibrate(pattern: number | number[], enabled: boolean) {
  if (!enabled) return;
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore vibration errors
  }
}

export function useGameEngineEnhanced({
  canvasRef,
  active,
  paused,
  skin,
  onGameOver,
}: UseGameEngineEnhancedOptions) {
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(() => getCoins());
  const [roundCoins, setRoundCoins] = useState(0);
  const [lives, setLives] = useState(0);
  const [activePowerUps, setActivePowerUps] = useState<PowerUpType[]>([]);

  const stateRef = useRef<EngineState | null>(null);
  const systemsRef = useRef<GameSystems | null>(null);
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

    // Initialize all game systems
    const particles = new ParticleSystem();
    const background = new BackgroundRenderer(width, height);
    const powerUps = new PowerUpSystem();
    const obstacles = new AdvancedObstacleSystem(width, height);
    const audio = new AudioSystem();
    const fishRenderer = new EnhancedFishRenderer((skin as FishSkinId) || 'golden');

    systemsRef.current = {
      particles,
      background,
      powerUps,
      obstacles,
      audio,
      fishRenderer,
    };

    // Create engine
    const engine = createEngine(width, height, skin);
    stateRef.current = engine;

    // Auto-apply shop boosts
    const inv = getShopInventory();
    if (inv.shield > 0) {
      consumeShopItem('shield');
      engine.shieldCharges = 1;
    }
    if (inv.magnet > 0) {
      consumeShopItem('magnet');
      engine.magnetUntil = engine.timeMs + 8000;
    }
    if (inv.gemBoost > 0) {
      consumeShopItem('gemBoost');
      engine.gemBoostActive = true;
    }

    roundCoinsRef.current = 0;
    lastMilestoneRef.current = 0;

    setScore(0);
    setRoundCoins(0);
    setCoins(getCoins());
    setLives(engine.lives ?? 0);

    // Start background music
    audio.startBackgroundMusic();
  }, [canvasRef, skin]);

  const reviveAt = useCallback((invincibleMs: number) => {
    const state = stateRef.current;
    const systems = systemsRef.current;
    if (!state || !systems) return;

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

    state.elapsedSinceSpawn = -850;

    // Trigger particle burst
    systems.particles.starBurst(state.width / 2, state.height / 2, 12);

    systems.audio.playEffect('success');
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
      const systems = systemsRef.current;

      if (state && canvas && systems) {
        if (!pausedRef.current && state.running) {
          const settings = getSettings();

          // Update all systems
          systems.background.update(state.scrollSpeed ?? 3);
          systems.powerUps.update();
          systems.obstacles.update(state.scrollSpeed ?? 3);
          systems.particles.update();
          systems.fishRenderer.update(dt);

          // Get power-up modifiers
          const modifiers = systems.powerUps.getModifiers();

          stepEngine(
            state,
            dt * modifiers.timeScale,
            {
              onScore: (newScore) => {
                setScore(newScore);

                const milestone = Math.floor(newScore / 25);

                if (milestone > lastMilestoneRef.current && newScore > 0) {
                  lastMilestoneRef.current = milestone;
                  systems.audio.playEffect('levelUp');
                  systems.particles.starBurst(state.width / 2, 50, 10);
                  safeVibrate(25, settings.vibration);
                }
              },

              onCoinCollect: (amount) => {
                roundCoinsRef.current += amount;
                setRoundCoins(roundCoinsRef.current);

                let total = addCoins(amount);

                // Particle effect
                systems.particles.burstCoins(state.fishX || state.width / 2, state.fishY || state.height / 2, 8);
                systems.audio.playEffect('coinCollect');
                safeVibrate(18, settings.vibration);

                const { state: challengeState, justCompleted } = updateDailyChallengeProgress(
                  'coins',
                  amount,
                );

                if (justCompleted) {
                  total = addCoins(challengeState.challenge.rewardCoins);
                  systems.audio.playEffect('success');
                  systems.particles.starBurst(state.width / 2, state.height / 2, 15);
                  safeVibrate([25, 25, 35], settings.vibration);
                }

                setCoins(total);

                if (total >= 50) {
                  unlockAchievement('coin_collector');
                }
              },

              onGemCollect: (currentLives) => {
                setLives(currentLives);
                systems.particles.sparkHit(state.width / 2, state.height / 2, 6, '#4fe3c1');
                systems.audio.playEffect('powerUp');
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

                // Damage effect
                systems.fishRenderer.triggerDamageFlash();
                systems.particles.explosion(state.width / 2, state.height / 2, 15, '#ff6b6b');
                systems.audio.playEffect('gameOver');
                safeVibrate([80, 50, 120], settings.vibration);

                if (finalScore > best) {
                  setPersonalBest(finalScore);
                  systems.audio.playEffect('success');
                }

                if (finalScore >= 10) unlockAchievement('getting_better');
                if (finalScore >= 25) unlockAchievement('deep_diver');
                if (finalScore >= 50) unlockAchievement('ocean_master');
                if (finalScore >= 100) unlockAchievement('legendary_swimmer');

                const scoreProgress = updateDailyChallengeProgress('score', finalScore);

                if (scoreProgress.justCompleted) {
                  const total = addCoins(scoreProgress.state.challenge.rewardCoins);
                  setCoins(total);
                  systems.audio.playEffect('success');
                  safeVibrate([25, 25, 45], settings.vibration);
                }

                if (finalScore >= 26) {
                  const hardModeProgress = updateDailyChallengeProgress('hardMode', 1);

                  if (hardModeProgress.justCompleted) {
                    const total = addCoins(hardModeProgress.state.challenge.rewardCoins);
                    setCoins(total);
                    systems.audio.playEffect('success');
                    safeVibrate([25, 25, 45], settings.vibration);
                  }
                }

                systems.audio.stopBackgroundMusic();
                onGameOverRef.current(finalScore);
              },

              onShake: (intensity) => {
                state.shakeIntensity = intensity;

                if (intensity >= 4) {
                  systems.particles.sparkHit(state.width / 2, state.height / 2, 8, '#ff4d6d');
                  systems.audio.playEffect('hit');
                  safeVibrate(55, settings.vibration);
                }
              },
            },
            { vibration: settings.vibration },
          );
        }

        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Render background
          systems.background.render(ctx);

          // Render original engine (obstacles, coins, etc)
          renderEngine(ctx, state);

          // Render enhanced particles on top
          systems.particles.render(ctx);

          // Render power-up HUD
          systems.powerUps.renderHUD(ctx, 20, 60);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    const handleResize = () => {
      const canvas = canvasRef.current;
      const state = stateRef.current;
      const systems = systemsRef.current;

      if (!canvas || !state || !systems) return;

      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? window.innerWidth;
      const height = parent?.clientHeight ?? window.innerHeight;

      canvas.width = width;
      canvas.height = height;

      state.width = width;
      state.height = height;
      systems.background.setDimensions(width, height);
      systems.obstacles.setDimensions(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      mounted = false;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      if (systemsRef.current) {
        systemsRef.current.audio.stopBackgroundMusic();
      }

      window.removeEventListener('resize', handleResize);
    };
  }, [active, setup, canvasRef]);

  const doJump = useCallback(() => {
    const state = stateRef.current;
    const systems = systemsRef.current;
    if (!state || !systems) return;

    const settings = getSettings();

    systems.audio.playEffect('jump');
    systems.particles.addTrail(state.width * FISH_X_RATIO, state.height / 2);
    safeVibrate(10, settings.vibration);

    jumpEngine(state, { vibration: settings.vibration });
  }, []);

  return {
    score,
    coins,
    roundCoins,
    lives,
    activePowerUps,
    shieldCharges: stateRef.current?.shieldCharges ?? 0,
    magnetRemainingMs: Math.max(0, (stateRef.current?.magnetUntil ?? 0) - (stateRef.current?.timeMs ?? 0)),
    doJump,
    reviveAt,
    getFinalScore: () => stateRef.current?.score ?? 0,
  };
}
