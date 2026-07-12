// -----------------------------------------------------------------------
// Core canvas game engine for Golden Fish Rush.
// Power-ups: Shield (protects one hit + invincibility) and Magnet (pulls nearby coins)
// Gem/Life improvement: full lives -> +5 score
// Shop boosts supported: initial shield/magnet/gemBoostActive
// Visual feedback: Shield bubble + Magnet glow added
// -----------------------------------------------------------------------

import { BASE, SKINS, getDifficultyTier } from './constants';
import type { SkinId, FloatingText } from './types';

export interface Obstacle {
  x: number;
  gapY: number;
  gapSize: number;
  passed: boolean;
  bobbing: boolean;
  bobPhase: number;
  bobAmount: number;
  glowing: boolean;
  isDouble: boolean;
  nearMissChecked?: boolean;
}

export interface Coin {
  x: number;
  y: number;
  collected: boolean;
  bonus: boolean;
}

export interface Gem {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
}

export interface PowerUp {
  x: number;
  y: number;
  type: 'shield' | 'magnet' | 'fever';
  collected: boolean;
  pulse: number;
}

export interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface PredatorShark {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmount: number;
  passed: boolean;
}

export interface BubbleBoostRing {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export interface TreasureChest {
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
}

export interface SeaMine {
  id: string;
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  exploded: boolean;
}

export interface Jellyfish {
  id: string;
  x: number;
  y: number;
  radius: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmount: number;
}

export interface EngineCallbacks {
  onScore: (score: number) => void;
  onCoinCollect: (total: number) => void;
  onDeath: () => void;
  onShake: (intensity: number) => void;
  onGemCollect?: (lives: number) => void;
  onLifeChange?: (lives: number) => void;
  onFloatingText?: (text: string, x: number, y: number, color: string, isBig?: boolean) => void;
  onRedFlash?: () => void;
  onNearMiss?: () => void;
  onFeverStart?: () => void;
}

export interface EngineState {
  width: number;
  height: number;
  fishY: number;
  fishVY: number;
  fishRotation: number;
  score: number;
  running: boolean;
  invincibleUntil: number;
  obstacles: Obstacle[];
  coins: Coin[];
  gems: Gem[];
  powerUps: PowerUp[];
  bubbles: Bubble[];
  particles: Particle[];
  elapsedSinceSpawn: number;
  skin: SkinId;
  shakeIntensity: number;
  timeMs: number;
  legendaryPulse: number;
  lives: number;
  maxLives: number;
  shieldCharges: number;
  magnetUntil: number;
  gemBoostActive: boolean;

  // Enhancements
  floatingTexts: FloatingText[];
  sharks: PredatorShark[];
  boostRings: BubbleBoostRing[];
  chests: TreasureChest[];
  boostUntil: number; // game time until boost ends
  coinStreakCount: number;
  lastCoinCollectedTime: number;
  isRedFlashing?: boolean;
  redFlashTimer?: number;

  // Phase 2 features
  seaMines: SeaMine[];
  jellyfish: Jellyfish[];
  feverUntil: number;
  elapsedSinceFeverCoinSpawn: number;
}

const FISH_X_RATIO = 0.28;
const MAX_EXTRA_LIVES = 2;
const GEM_SPAWN_CHANCE = 0.09;
const HIT_INVINCIBILITY_MS = 1700;
const SAFE_REVIVE_DELAY_MS = 900;

export function createEngine(width: number, height: number, skin: SkinId): EngineState {
  const bubbles: Bubble[] = Array.from({ length: 30 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 2 + Math.random() * 8,
    speed: 0.25 + Math.random() * 0.95,
    drift: (Math.random() - 0.5) * 0.45,
  }));
  return {
    width, height, fishY: height / 2, fishVY: 0, fishRotation: 0, score: 0, running: true,
    invincibleUntil: 0, obstacles: [], coins: [], gems: [], powerUps: [], bubbles, particles: [],
    elapsedSinceSpawn: 999999, skin, shakeIntensity: 0, timeMs: 0, legendaryPulse: 0,
    lives: 0, maxLives: MAX_EXTRA_LIVES, shieldCharges: 0, magnetUntil: 0, gemBoostActive: false,

    floatingTexts: [],
    sharks: [],
    boostRings: [],
    chests: [],
    boostUntil: 0,
    coinStreakCount: 0,
    lastCoinCollectedTime: 0,
    isRedFlashing: false,
    redFlashTimer: 0,

    // Phase 2
    seaMines: [],
    jellyfish: [],
    feverUntil: 0,
    elapsedSinceFeverCoinSpawn: 0,
  };
}

export function difficultyForScore(score: number, timeMs: number = 0) {
  // Gradual difficulty multiplier based on score and elapsed run time (every 30 seconds)
  const timeFactor = Math.min(1 + Math.floor(timeMs / 30000) * 0.12, 1.8);
  const diffMultiplier = Math.min(1 + score / 600, 2.3) * timeFactor;

  const speedSteps = Math.floor(score / 12);
  const baseSpeedVal = BASE.baseSpeed * 0.86 + speedSteps * 0.22;
  const speed = Math.min(BASE.maxSpeed * 0.9, baseSpeedVal) * diffMultiplier;

  // Reduce gap size based on score and run time for progressive pressure
  const baseGapVal = BASE.baseGap + 24 - speedSteps * 4 - Math.floor(timeMs / 30000) * 8;
  const gap = Math.max(BASE.minGap, baseGapVal);

  const baseSpawnInterval = Math.max(1080, BASE.spawnInterval + 180 - speedSteps * 38);
  const spawnInterval = Math.max(750, baseSpawnInterval / diffMultiplier);

  const tier = getDifficultyTier(score);
  return { speed, gap, spawnInterval, tier, diffMultiplier };
}

export function jump(state: EngineState, settings: { vibration: boolean }) {
  if (!state.running) return;
  state.fishVY = BASE.jumpVelocity;
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: state.width * FISH_X_RATIO, y: state.fishY + BASE.fishRadius * 0.6,
      vx: (Math.random() - 0.5) * 2.2, vy: 1 + Math.random() * 1.5,
      life: 0, maxLife: 26 + Math.random() * 14, color: 'rgba(255,255,255,0.85)', size: 2 + Math.random() * 3,
    });
  }
  if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(12); } catch {}
  }
}

function clampGapY(state: EngineState, gapY: number, gapSize: number) {
  const safeMargin = Math.max(92, gapSize * 0.45);
  return Math.max(safeMargin, Math.min(state.height - safeMargin, gapY));
}

function spawnObstacle(state: EngineState, score: number) {
  const { gap, diffMultiplier } = difficultyForScore(score, state.timeMs);
  const margin = Math.max(95, gap * 0.48);
  const rawGapY = margin + Math.random() * Math.max(1, state.height - margin * 2);
  const gapY = clampGapY(state, rawGapY, gap);
  const hardMode = score >= 35;
  const expertMode = score >= 70;
  const legendaryMode = score >= 120;
  const isDouble = expertMode && Math.random() < 0.1;
  state.obstacles.push({
    x: state.width + BASE.obstacleWidth, gapY, gapSize: gap, passed: false,
    bobbing: hardMode && Math.random() < 0.22, bobPhase: Math.random() * Math.PI * 2,
    bobAmount: 12 + Math.random() * 10, glowing: legendaryMode, isDouble,
  });

  // Regular coin spawn if Fever mode is not active
  const isFever = state.feverUntil > state.timeMs;
  if (!isFever && Math.random() < 0.68) {
    state.coins.push({
      x: state.width + BASE.obstacleWidth + 44, y: gapY + (Math.random() - 0.5) * (gap * 0.32),
      collected: false, bonus: score >= 60 && Math.random() < 0.22,
    });
  }
  // Gem (now beautiful Heart) spawn (boosted if shop gemBoostActive)
  const gemChance = state.gemBoostActive ? GEM_SPAWN_CHANCE * 1.8 : GEM_SPAWN_CHANCE;
  if (Math.random() < gemChance) {
    state.gems.push({
      x: state.width + BASE.obstacleWidth + 88, y: gapY + (Math.random() - 0.5) * (gap * 0.28),
      collected: false, pulse: Math.random() * Math.PI * 2,
    });
  }
  // Power-up spawn (shield, magnet, or Fever mode Star!)
  if (Math.random() < 0.08) {
    const roll = Math.random();
    const type: 'shield' | 'magnet' | 'fever' = roll < 0.35 ? 'shield' : roll < 0.70 ? 'magnet' : 'fever';
    const puY = gapY + (Math.random() - 0.5) * (gap * 0.25);
    state.powerUps.push({
      x: state.width + BASE.obstacleWidth + 125,
      y: puY,
      type,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  // Shark enemy spawn after score >= 20
  if (score >= 20) {
    const sharkChance = 0.15 * diffMultiplier;
    if (state.sharks.length < 2 && Math.random() < sharkChance) {
      const sharkY = 60 + Math.random() * (state.height - 120);
      state.sharks.push({
        id: 'shark_' + Math.random(),
        x: state.width + 150,
        y: sharkY,
        width: 85,
        height: 38,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.005 + Math.random() * 0.004,
        bobAmount: 18 + Math.random() * 12,
        passed: false,
      });
    }
  }

  // Spawn Sea Mine (ألغام بحرية) - drifts left and pulsates red (after score >= 10)
  if (score >= 10 && Math.random() < 0.24 * diffMultiplier) {
    const mineY = 60 + Math.random() * (state.height - 120);
    state.seaMines.push({
      id: 'mine_' + Math.random(),
      x: state.width + 80,
      y: mineY,
      radius: 14,
      pulsePhase: Math.random() * Math.PI * 2,
      exploded: false,
    });
  }

  // Spawn Jellyfish (قنديل البحر) - waves vertically with tentacles (after score >= 15)
  if (score >= 15 && Math.random() < 0.20 * diffMultiplier) {
    const jellyY = 80 + Math.random() * (state.height - 160);
    state.jellyfish.push({
      id: 'jelly_' + Math.random(),
      x: state.width + 60,
      y: jellyY,
      radius: 12,
      bobPhase: Math.random() * Math.PI * 2,
      bobSpeed: 0.0035 + Math.random() * 0.002,
      bobAmount: 25 + Math.random() * 15,
    });
  }

  // Bubble Boost Ring spawn (very rare)
  if (Math.random() < 0.04) {
    const ringY = 100 + Math.random() * (state.height - 200);
    state.boostRings.push({
      x: state.width + BASE.obstacleWidth + 180,
      y: ringY,
      radius: 25,
      collected: false,
    });
  }

  // Treasure Chest spawn (extremely rare)
  if (Math.random() < 0.02) {
    const chestY = state.height - 45; // resting near bottom
    state.chests.push({
      x: state.width + BASE.obstacleWidth + 240,
      y: chestY,
      width: 36,
      height: 30,
      collected: false,
    });
  }
}

function addBurst(state: EngineState, x: number, y: number, color: string, count: number, sizeBase = 2) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y, vx: (Math.random() - 0.5) * 3.6, vy: (Math.random() - 0.5) * 3.6,
      life: 0, maxLife: 22 + Math.random() * 12, color, size: sizeBase + Math.random() * 3,
    });
  }
}

function clearDangerousReviveArea(state: EngineState) {
  const fishX = state.width * FISH_X_RATIO;
  state.obstacles = state.obstacles.filter((obs) => {
    const halfWidth = BASE.obstacleWidth / 2;
    const obsLeft = obs.x - halfWidth;
    const obsRight = obs.x + halfWidth;
    return obsRight < fishX - BASE.obstacleWidth * 2.2 || obsLeft > state.width + BASE.obstacleWidth * 1.4;
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
  state.coins = state.coins.filter((coin) => coin.x < fishX - BASE.obstacleWidth * 2 || coin.x > state.width + BASE.obstacleWidth);
  state.gems = state.gems.filter((gem) => gem.x < fishX - BASE.obstacleWidth * 2 || gem.x > state.width + BASE.obstacleWidth);
  state.powerUps = state.powerUps.filter((pu) => pu.x < fishX - BASE.obstacleWidth * 2 || pu.x > state.width + BASE.obstacleWidth);
  state.boostRings = state.boostRings.filter((ring) => ring.x < fishX - 60 || ring.x > state.width + 60);
  state.chests = state.chests.filter((chest) => chest.x < fishX - 60 || chest.x > state.width + 60);
  state.elapsedSinceSpawn = -SAFE_REVIVE_DELAY_MS;
}

function spendExtraLife(state: EngineState, callbacks: EngineCallbacks) {
  if (state.lives <= 0) return false;
  state.lives -= 1;
  state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
  state.fishY = state.height / 2;
  state.fishVY = 0;
  state.fishRotation = 0;
  clearDangerousReviveArea(state);
  callbacks.onLifeChange?.(state.lives);
  callbacks.onShake(4); // Shaking is light & non-distracting
  callbacks.onRedFlash?.();
  addBurst(state, state.width * FISH_X_RATIO, state.fishY, 'rgba(80, 220, 255, 0.95)', 22, 3);
  return true;
}

function killOrUseLife(state: EngineState, callbacks: EngineCallbacks) {
  if (spendExtraLife(state, callbacks)) return;
  callbacks.onShake(8); // Reduced shake on gameover/death
  callbacks.onRedFlash?.();
  callbacks.onDeath();
  state.running = false;
}

function triggerFloatingText(state: EngineState, text: string, x: number, y: number, color: string, isBig = false) {
  const durationMs = isBig ? 900 : 700;
  state.floatingTexts.push({
    id: 'txt_' + Math.random(),
    x,
    y,
    text,
    color,
    size: isBig ? 18 : 13,
    createdAt: state.timeMs,
    durationMs,
  });
}

export function stepEngine(state: EngineState, dtMs: number, callbacks: EngineCallbacks, settings: { vibration: boolean }) {
  if (!state.running) return;
  const dt = Math.min(2.2, dtMs / 16.67);
  state.timeMs += dtMs;
  state.legendaryPulse = (state.legendaryPulse + dtMs * 0.002) % (Math.PI * 2);
  state.fishVY = Math.min(BASE.maxFallSpeed, state.fishVY + BASE.gravity * dt);
  state.fishY += state.fishVY * dt;
  state.fishRotation = Math.max(-0.5, Math.min(0.9, state.fishVY * 0.06));
  const groundY = state.height - 8;
  const ceilingY = 8;
  const invincible = state.timeMs < state.invincibleUntil;
  if (state.fishY + BASE.fishRadius >= groundY || state.fishY - BASE.fishRadius <= ceilingY) {
    state.fishY = Math.max(ceilingY + BASE.fishRadius, Math.min(groundY - BASE.fishRadius, state.fishY));
    if (!invincible) { killOrUseLife(state, callbacks); return; }
    state.fishVY = 0;
  }

  // Red flash screen timer update
  if (state.isRedFlashing && state.redFlashTimer !== undefined) {
    state.redFlashTimer -= dtMs;
    if (state.redFlashTimer <= 0) {
      state.isRedFlashing = false;
    }
  }

  // Update floating text list
  state.floatingTexts = state.floatingTexts.filter((t) => {
    return state.timeMs - t.createdAt < t.durationMs;
  });

  const { speed, spawnInterval } = difficultyForScore(state.score, state.timeMs);
  state.elapsedSinceSpawn += dtMs;
  if (state.elapsedSinceSpawn >= spawnInterval) {
    spawnObstacle(state, state.score);
    state.elapsedSinceSpawn = 0;
  }
  const fishX = state.width * FISH_X_RATIO;

  // === FEVER MODE STREAM SPANNING ===
  const isFeverActive = state.feverUntil > state.timeMs;
  if (isFeverActive) {
    state.elapsedSinceFeverCoinSpawn += dtMs;
    if (state.elapsedSinceFeverCoinSpawn >= 180) {
      state.elapsedSinceFeverCoinSpawn = 0;
      // Spawn beautifully dense pattern of coins directly ahead
      const angle = (state.timeMs * 0.005) % (Math.PI * 2);
      const coinY = state.height / 2 + Math.sin(angle) * (state.height * 0.28);
      state.coins.push({
        x: state.width + 40,
        y: coinY,
        collected: false,
        bonus: Math.random() < 0.15,
      });
      // Spawn extra air bubbles for a festive environment
      state.bubbles.push({
        x: state.width + 20,
        y: Math.random() * state.height,
        r: 3 + Math.random() * 5,
        speed: 1.5 + Math.random() * 2.0,
        drift: (Math.random() - 0.5) * 0.6,
      });
    }
  }

  // Obstacle movement, collision, and Near Miss tracking
  for (const obs of state.obstacles) {
    obs.x -= speed * dt;
    if (obs.bobbing) {
      obs.bobPhase += dtMs * 0.002;
      obs.gapY += Math.sin(obs.bobPhase) * 1.18 * dt;
      obs.gapY = clampGapY(state, obs.gapY, obs.gapSize);
    }
    if (!obs.passed && obs.x + BASE.obstacleWidth / 2 < fishX) {
      obs.passed = true;
      state.score += 1;
      callbacks.onScore(state.score);
    }

    // Near Miss system
    if (!obs.nearMissChecked && obs.x < fishX && obs.x > fishX - 25) {
      obs.nearMissChecked = true;
      const topGapEdge = obs.gapY - obs.gapSize / 2;
      const bottomGapEdge = obs.gapY + obs.gapSize / 2;

      // Check if player passed through without collision but extremely close to top/bottom boundaries
      const spaceToTop = (state.fishY - BASE.fishRadius) - topGapEdge;
      const spaceToBottom = bottomGapEdge - (state.fishY + BASE.fishRadius);

      const withinGap = state.fishY - BASE.fishRadius >= topGapEdge && state.fishY + BASE.fishRadius <= bottomGapEdge;
      const isExtremeClose = spaceToTop < 25 || spaceToBottom < 25;

      if (withinGap && isExtremeClose && !invincible && state.running) {
        state.score += 2;
        callbacks.onScore(state.score);
        callbacks.onNearMiss?.();
        triggerFloatingText(state, '+2 Near Miss! 🔥', fishX, state.fishY - 28, '#00e5ff', true);
        // Spray a beautiful trail of teal particles
        addBurst(state, fishX, state.fishY, 'rgba(0, 229, 255, 0.85)', 15, 2.5);
      }
    }

    if (!invincible && !isFeverActive) {
      const withinX = fishX + BASE.fishRadius > obs.x - BASE.obstacleWidth / 2 && fishX - BASE.fishRadius < obs.x + BASE.obstacleWidth / 2;
      if (withinX) {
        const topGapEdge = obs.gapY - obs.gapSize / 2;
        const bottomGapEdge = obs.gapY + obs.gapSize / 2;
        let safe: boolean;
        if (obs.isDouble) {
          const secondTop = bottomGapEdge + 58;
          const secondBottom = secondTop + 52;
          const inGap1 = state.fishY - BASE.fishRadius >= topGapEdge && state.fishY + BASE.fishRadius <= bottomGapEdge;
          const inGap2 = state.fishY - BASE.fishRadius >= secondTop && state.fishY + BASE.fishRadius <= secondBottom;
          safe = inGap1 || inGap2;
        } else {
          safe = !(state.fishY - BASE.fishRadius < topGapEdge || state.fishY + BASE.fishRadius > bottomGapEdge);
        }
        if (!safe) {
          if (state.shieldCharges > 0) {
            state.shieldCharges = Math.max(0, state.shieldCharges - 1);
            state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
            callbacks.onShake(3); // Screen shake is very light & minor
            triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
            addBurst(state, fishX, state.fishY, 'rgba(100, 210, 255, 0.95)', 25, 3);
          } else {
            killOrUseLife(state, callbacks);
            return;
          }
        }
      }
    }
  }
  state.obstacles = state.obstacles.filter((o) => o.x > -BASE.obstacleWidth * 2);

  // Shark movement and collision
  for (const shark of state.sharks) {
    const sharkSpeed = (speed + 0.8) * dt;
    shark.x -= sharkSpeed;
    shark.bobPhase += shark.bobSpeed * dtMs;
    shark.y += Math.sin(shark.bobPhase) * 1.5 * dt;

    if (!shark.passed && shark.x + shark.width / 2 < fishX) {
      shark.passed = true;
    }

    // Collision with Shark
    if (!invincible && !isFeverActive) {
      const withinX = fishX + BASE.fishRadius > shark.x - shark.width / 2 && fishX - BASE.fishRadius < shark.x + shark.width / 2;
      const withinY = state.fishY + BASE.fishRadius > shark.y - shark.height / 2 && state.fishY - BASE.fishRadius < shark.y + shark.height / 2;
      if (withinX && withinY) {
        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
          callbacks.onShake(3); // Light non-distracting screen shake
          triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
          addBurst(state, fishX, state.fishY, 'rgba(100, 210, 255, 0.95)', 25, 3);
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.sharks = state.sharks.filter((s) => s.x > -150);

  // Sea Mine movement and collision
  for (const mine of state.seaMines) {
    mine.x -= speed * dt;
    mine.pulsePhase += dtMs * 0.0075;

    if (!mine.exploded && !invincible && !isFeverActive) {
      const dx = mine.x - fishX;
      const dy = mine.y - state.fishY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < BASE.fishRadius + mine.radius) {
        mine.exploded = true;
        // Explode!
        callbacks.onShake(12);
        callbacks.onRedFlash?.();
        addBurst(state, mine.x, mine.y, '#ff3d00', 30, 4);
        addBurst(state, mine.x, mine.y, '#ffc107', 20, 2.5);

        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
          triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.seaMines = state.seaMines.filter((m) => m.x > -100 && !m.exploded);

  // Jellyfish movement and collision
  for (const jelly of state.jellyfish) {
    jelly.x -= (speed - 0.5) * dt;
    jelly.bobPhase += jelly.bobSpeed * dtMs;
    jelly.y += Math.sin(jelly.bobPhase) * 1.6 * dt;

    if (!invincible && !isFeverActive) {
      const dx = jelly.x - fishX;
      const dy = jelly.y - state.fishY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < BASE.fishRadius + jelly.radius) {
        // Shock!
        callbacks.onShake(6);
        callbacks.onRedFlash?.();
        addBurst(state, jelly.x, jelly.y, '#e040fb', 22, 3);
        addBurst(state, jelly.x, jelly.y, '#00e5ff', 15, 2);

        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
          triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.jellyfish = state.jellyfish.filter((j) => j.x > -100);

  // Coin collect streak / combo logic & coin collection
  for (const coin of state.coins) {
    coin.x -= speed * dt;
    if (!coin.collected) {
      const dx = coin.x - fishX;
      const dy = coin.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 13) {
        coin.collected = true;
        const baseAmount = coin.bonus ? 5 : 1;

        // Combo / Streak multiplier system
        const now = state.timeMs;
        let finalAmount = baseAmount;
        if (now - state.lastCoinCollectedTime < 1800) {
          state.coinStreakCount++;
        } else {
          state.coinStreakCount = 1;
        }
        state.lastCoinCollectedTime = now;

        let comboText = '';
        if (state.coinStreakCount >= 30) {
          finalAmount *= 4;
          comboText = '🔥 COMBO x4 🔥';
        } else if (state.coinStreakCount >= 20) {
          finalAmount *= 3;
          comboText = '✨ COMBO x3 ✨';
        } else if (state.coinStreakCount >= 10) {
          finalAmount *= 2;
          comboText = '⭐ COMBO x2 ⭐';
        }

        state.score += finalAmount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(finalAmount);

        // Render Combo & collection text (No shaking or jitter on collection)
        const txtColor = coin.bonus ? '#ffd54f' : '#fff59d';
        triggerFloatingText(state, `+${finalAmount}`, coin.x, coin.y - 12, txtColor, false);
        if (comboText) {
          triggerFloatingText(state, comboText, fishX, state.fishY - 28, '#ffca28', true);
          // Sparkle golden burst stars for combos
          addBurst(state, coin.x, coin.y, '#ffd60a', 15, 3.5);
        } else {
          addBurst(state, coin.x, coin.y, coin.bonus ? '#ff9500' : '#ffd60a', 12, 2);
        }
      }
    }
  }

  // Magnet effect (wide-range pull when Fever is active)
  const hasMagnet = state.magnetUntil > state.timeMs || isFeverActive;
  if (hasMagnet) {
    const fishXMag = state.width * FISH_X_RATIO;
    const fishYMag = state.fishY;
    for (const coin of state.coins) {
      if (!coin.collected) {
        const dx = coin.x - fishXMag;
        const dy = coin.y - fishYMag;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const activeRange = isFeverActive ? 220 : (state.magnetUntil > state.timeMs) ? 130 : 90;
        if (dist > 5 && dist < activeRange) {
          const pull = (isFeverActive ? 0.35 : 0.22) * dt;
          coin.x -= dx * pull;
          coin.y -= dy * pull;
        }
      }
    }
  }
  state.coins = state.coins.filter((c) => c.x > -40 && !c.collected);

  // Gem (Heart) collection
  for (const gem of state.gems) {
    gem.x -= speed * dt;
    gem.pulse += dtMs * 0.0045;
    if (!gem.collected) {
      const dx = gem.x - fishX;
      const dy = gem.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 16) {
        gem.collected = true;
        if (state.lives < state.maxLives) {
          state.lives += 1;
          callbacks.onGemCollect?.(state.lives);
          callbacks.onLifeChange?.(state.lives);
          triggerFloatingText(state, '+1 Life', gem.x, gem.y - 15, '#81c784', true);
        } else {
          state.score += 5;
          callbacks.onScore(state.score);
          triggerFloatingText(state, '+5', gem.x, gem.y - 15, '#ff4081', true);
        }
        callbacks.onShake(1); // Very light non-distracting shake
        addBurst(state, gem.x, gem.y, '#ffd1d1', 22, 3);
      }
    }
  }
  state.gems = state.gems.filter((g) => g.x > -50 && !g.collected);

  // Power-up collection (including Fever mode Star!)
  for (const pu of state.powerUps) {
    pu.x -= speed * dt;
    if (pu.pulse !== undefined) pu.pulse += dtMs * 0.004;
    if (!pu.collected) {
      const dx = pu.x - fishX;
      const dy = pu.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 18) {
        pu.collected = true;
        if (pu.type === 'shield') {
          state.shieldCharges = Math.min(3, state.shieldCharges + 1);
          callbacks.onShake?.(1); // Light non-distracting shake
          triggerFloatingText(state, 'Shield', pu.x, pu.y - 15, '#29b6f6', true);
          addBurst(state, pu.x, pu.y, 'rgba(70, 180, 255, 0.9)', 20, 3);
        } else if (pu.type === 'magnet') {
          state.magnetUntil = state.timeMs + 8000;
          triggerFloatingText(state, 'Magnet', pu.x, pu.y - 15, '#ffa726', true);
          addBurst(state, pu.x, pu.y, 'rgba(255, 140, 0, 0.9)', 18, 3);
        } else if (pu.type === 'fever') {
          state.feverUntil = state.timeMs + 6000;
          state.elapsedSinceFeverCoinSpawn = 180; // trigger immediate coin spawn
          callbacks.onFeverStart?.();
          triggerFloatingText(state, '⚡ FEVER MODE ⚡', pu.x, pu.y - 15, '#e040fb', true);
          addBurst(state, pu.x, pu.y, 'rgba(224, 64, 251, 0.95)', 26, 3);
        }
      }
    }
  }
  state.powerUps = state.powerUps.filter((p) => p.x > -60 && !p.collected);

  // Bubble Boost Ring collection
  for (const ring of state.boostRings) {
    ring.x -= speed * dt;
    if (!ring.collected) {
      const dx = ring.x - fishX;
      const dy = ring.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + ring.radius) {
        ring.collected = true;
        state.boostUntil = state.timeMs + 5000;
        triggerFloatingText(state, 'Boost!', ring.x, ring.y - 15, '#00e5ff', true);
        callbacks.onShake(1); // Very minor shake
        addBurst(state, ring.x, ring.y, '#00e5ff', 18, 2);
      }
    }
  }
  state.boostRings = state.boostRings.filter((br) => br.x > -60 && !br.collected);

  // Treasure Chest collection
  for (const chest of state.chests) {
    chest.x -= speed * dt;
    if (!chest.collected) {
      const dx = chest.x - fishX;
      const dy = chest.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 22) {
        chest.collected = true;
        callbacks.onCoinCollect(15);
        triggerFloatingText(state, 'Treasure +15', chest.x, chest.y - 20, '#ffd54f', true);
        callbacks.onShake(1); // Very minor shake
        addBurst(state, chest.x, chest.y, '#ffd54f', 24, 3);
      }
    }
  }
  state.chests = state.chests.filter((c) => c.x > -60 && !c.collected);

  // Bubble animations
  for (const b of state.bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(state.timeMs * 0.001 + b.x) * b.drift * dt;
    if (b.y < -20) { b.y = state.height + 10; b.x = Math.random() * state.width; }
  }

  // Particle updates
  for (const p of state.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.05 * dt;
  }
  state.particles = state.particles.filter((p) => p.life < p.maxLife);
  state.shakeIntensity = Math.max(0, state.shakeIntensity - dtMs * 0.05);
  void settings;
}

function drawBackground(ctx: CanvasRenderingContext2D, state: EngineState) {
  const { width, height } = state;
  const tier = getDifficultyTier(state.score);

  // Custom beautiful, radiant sea-blue background gradients
  const [c1, c2] = tier.bg;
  const grad = ctx.createLinearGradient(0, 0, 0, height);

  // Check if Fever Mode is active to shift background into shifting rainbow color space
  const isFever = state.feverUntil > state.timeMs;
  if (isFever) {
    const feverHue = (state.timeMs / 10) % 360;
    grad.addColorStop(0, `hsl(${feverHue}, 80%, 30%)`);
    grad.addColorStop(0.5, `hsl(${(feverHue + 120) % 360}, 75%, 20%)`);
    grad.addColorStop(1, '#000814');
  } else {
    grad.addColorStop(0, '#0277bd'); // Beautiful lighter marine blue at top
    grad.addColorStop(0.4, c1);
    grad.addColorStop(1, '#001021'); // Deep sea dark blue
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (state.score >= 100 && !isFever) {
    const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
    ctx.fillStyle = `rgba(255, 214, 10, ${0.05 + pulse * 0.06})`;
    ctx.fillRect(0, 0, width, height);
  }

  // 1. Light Rays from the top
  ctx.save();
  ctx.globalAlpha = isFever ? 0.25 : 0.15;
  for (let i = 0; i < 5; i++) {
    const rx = (width / 5) * i + Math.sin(state.timeMs * 0.00015 + i) * 35;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + 75, 0);
    ctx.lineTo(rx - 30, height);
    ctx.lineTo(rx - 140, height);
    ctx.closePath();
    const rayGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (isFever) {
      rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      rayGrad.addColorStop(1, 'transparent');
    } else {
      rayGrad.addColorStop(0, '#e0f7fa');
      rayGrad.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = rayGrad;
    ctx.fill();
  }
  ctx.restore();

  // 2. Far fish shadows (floating silhouettes with parallax)
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#011124';
  for (let i = 0; i < 4; i++) {
    const fx = ((state.timeMs * 0.018 * (1 + i * 0.1) + i * 250) % (width + 300)) - 150;
    const fy = 80 + ((i * 123) % (height - 200)) + Math.sin(state.timeMs * 0.001 + i) * 15;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx - 15, fy);
    ctx.lineTo(fx - 22, fy - 5);
    ctx.lineTo(fx - 22, fy + 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Bubbles floating
  ctx.save();
  for (const b of state.bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // 4. Seaweeds & beautiful coral decor at the bottom
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = tier.name === 'Easy' ? '#004d40' : '#002d3f';
  for (let i = 0; i < 10; i++) {
    const cx = (width / 9) * i + Math.sin(state.timeMs * 0.0006 + i) * 10;
    const h = 40 + ((i * 47) % 65);
    ctx.beginPath();
    ctx.moveTo(cx, height);
    ctx.quadraticCurveTo(cx - 16, height - h, cx, height - h - 15);
    ctx.quadraticCurveTo(cx + 16, height - h, cx, height);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 10, height);
    ctx.quadraticCurveTo(cx + 2, height - h * 0.7, cx + 8, height - h * 0.7 - 8);
    ctx.quadraticCurveTo(cx + 18, height - h * 0.7, cx + 10, height);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, height - 8, width, 8);
  ctx.fillRect(0, 0, width, 8);
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, height: number) {
  const topGapEdge = obs.gapY - obs.gapSize / 2;
  const bottomGapEdge = obs.gapY + obs.gapSize / 2;
  const w = BASE.obstacleWidth;
  const x = obs.x - w / 2;

  // High quality gradient for the pillars
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  if (obs.glowing) {
    grad.addColorStop(0, '#ffd60a');
    grad.addColorStop(0.5, '#fff066');
    grad.addColorStop(1, '#ff9500');
  } else {
    grad.addColorStop(0, '#1d7870');
    grad.addColorStop(0.5, '#40c4b4');
    grad.addColorStop(1, '#0e4d46');
  }

  ctx.fillStyle = grad;
  if (obs.glowing) {
    ctx.save();
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 22;
  }

  // Draw TOP Pillar with nice rounded cap
  ctx.fillRect(x, 0, w, topGapEdge - 15);
  ctx.fillStyle = obs.glowing ? '#ffd60a' : '#5cd6c6';
  ctx.fillRect(x - 5, topGapEdge - 18, w + 10, 18);

  // Draw BOTTOM Pillar with nice rounded cap
  if (obs.isDouble) {
    const secondTop = bottomGapEdge + 58;
    const secondBottom = secondTop + 52;

    // Draw the middle segment pillar
    ctx.fillStyle = grad;
    ctx.fillRect(x, bottomGapEdge + 15, w, secondTop - (bottomGapEdge + 15));
    // Caps for the middle segment
    ctx.fillStyle = obs.glowing ? '#ffd60a' : '#5cd6c6';
    ctx.fillRect(x - 5, bottomGapEdge, w + 10, 15);
    ctx.fillRect(x - 5, secondTop - 15, w + 10, 15);

    // Draw the bottommost segment pillar
    ctx.fillStyle = grad;
    ctx.fillRect(x, secondBottom + 15, w, height - (secondBottom + 15));
    ctx.fillStyle = '#e63946'; // Red visual warning indicator
    ctx.fillRect(x - 5, secondBottom, w + 10, 15);
  } else {
    // Normal single bottom pillar
    ctx.fillStyle = grad;
    ctx.fillRect(x, bottomGapEdge + 15, w, height - bottomGapEdge - 15);
    ctx.fillStyle = obs.glowing ? '#ffd60a' : '#5cd6c6';
    ctx.fillRect(x - 5, bottomGapEdge, w + 10, 18);
  }

  if (obs.glowing) ctx.restore();
}

function drawFish(ctx: CanvasRenderingContext2D, state: EngineState, fishX: number, invincible: boolean) {
  const skin = SKINS.find((s) => s.id === state.skin) ?? SKINS[0];
  const isFever = state.feverUntil > state.timeMs;
  const blink = (invincible || isFever) && Math.floor(state.timeMs / 100) % 2 === 0;
  if (blink) return;
  const r = BASE.fishRadius;
  const id = skin.id;
  const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
  const { body, belly, fin, glow } = skin.colors;

  // Real fish dynamic tail wagging based on game time (wagging much faster in Fever mode!)
  const wag = Math.sin(state.timeMs * (isFever ? 0.024 : 0.012)) * 0.12;

  ctx.save();
  ctx.translate(fishX, state.fishY);
  ctx.rotate(state.fishRotation);

  {
    if (id === 'legendary' || isFever) {
      ctx.save();
      ctx.globalAlpha = 0.28 + pulse * 0.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.9, r * 1.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = isFever ? `hsl(${(state.timeMs / 4) % 360}, 100%, 75%)` : glow;
      ctx.fill();
      ctx.globalAlpha = 0.5 + pulse * 0.25;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.6, r * 1.12, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isFever ? `hsl(${(state.timeMs / 4) % 360}, 100%, 75%)` : glow;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = isFever ? '#e040fb' : glow;
    ctx.shadowBlur = isFever ? 32 : id === 'legendary' ? 30 : id === 'diamond' ? 24 : 16;

    // Dynamic Tail with Wag
    ctx.save();
    ctx.translate(-r * 0.8, 0);
    ctx.rotate(wag);
    if (id === 'ruby') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.8, -r * 1.3, -r * 1.5, -r * 0.6);
      ctx.quadraticCurveTo(-r * 1.1, 0, -r * 1.5, r * 0.6);
      ctx.quadraticCurveTo(-r * 0.8, r * 1.3, 0, 0);
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    } else if (id === 'legendary') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.9, -r * 1.25, -r * 1.6, -r * 0.45);
      ctx.lineTo(-r * 1.0, 0);
      ctx.quadraticCurveTo(-r * 1.6, r * 0.45, -r * 0.9, r * 1.25);
      ctx.closePath();
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
    } else {
      // Elegant streamlined tail shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.65, -r * 0.95, -r * 1.15, -r * 0.35);
      ctx.quadraticCurveTo(-r * 0.75, 0, -r * 1.15, r * 0.35);
      ctx.quadraticCurveTo(-r * 0.65, r * 0.95, 0, 0);
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    }
    ctx.restore();

    // Body
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.95, r * 0.15, -r * 0.88);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.5, r * 1.05, 0);
    ctx.quadraticCurveTo(r * 0.95, r * 0.5, r * 0.15, r * 0.88);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.95, -r * 0.9, 0);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
    if (isFever) {
      bodyGrad.addColorStop(0, '#e040fb');
      bodyGrad.addColorStop(0.5, '#00e5ff');
      bodyGrad.addColorStop(1, '#ffeb3b');
    } else if (id === 'legendary') {
      bodyGrad.addColorStop(0, '#1a1a1a');
      bodyGrad.addColorStop(0.5, '#ffd60a');
      bodyGrad.addColorStop(1, '#1a1a1a');
    } else {
      bodyGrad.addColorStop(0, belly);
      bodyGrad.addColorStop(0.4, body);
      bodyGrad.addColorStop(1, fin);
    }
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Highlight Gloss
    const glossGrad = ctx.createLinearGradient(0, -r, 0, r);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glossGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
    glossGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glossGrad;
    ctx.beginPath();
    ctx.ellipse(r * 0.1, -r * 0.25, r * 0.6, r * 0.25, Math.PI / 10, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.beginPath();
    ctx.ellipse(r * 0.1, r * 0.28, r * 0.55, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = belly;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.25, -r * 1.25, r * 0.7, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.3, -r * 0.8, 0, -r * 0.7);
    ctx.closePath();
    ctx.fillStyle = id === 'legendary' ? '#ffd60a' : fin;
    ctx.fill();

    // Pectoral Fin with subtle dynamic rotation
    ctx.save();
    ctx.translate(r * 0.25, r * 0.1);
    ctx.rotate(Math.sin(state.timeMs * 0.01) * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.3, r * 0.85, r * 0.25);
    ctx.quadraticCurveTo(r * 0.45, r * 0.2, 0, 0);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
    ctx.restore();

    // Eye
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.15, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1200';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.55 + 1.2, -r * 0.15 - 1.2, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  // === VISUAL POWER-UP INDICATORS ===
  if (state.shieldCharges > 0) {
    const shieldPulse = (Math.sin(state.legendaryPulse * 1.8) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.22 + shieldPulse * 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
    ctx.fillStyle = '#4fc3f7';
    ctx.fill();
    ctx.globalAlpha = 0.65 + shieldPulse * 0.25;
    ctx.strokeStyle = '#e3f2fd';
    ctx.lineWidth = 3.5 + shieldPulse * 1.2;
    ctx.stroke();
    ctx.restore();
  }

  if (state.magnetUntil > state.timeMs || isFever) {
    const magPulse = (Math.sin(state.timeMs * 0.009) + 1) / 2;
    ctx.save();
    ctx.shadowColor = isFever ? '#e040fb' : '#ff6d00';
    ctx.shadowBlur = isFever ? 44 : 32 + magPulse * 14;
    ctx.globalAlpha = 0.4 + magPulse * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, r * (isFever ? 1.85 : 1.45), 0, Math.PI * 2);
    ctx.strokeStyle = isFever ? '#e040fb' : '#ff9500';
    ctx.lineWidth = isFever ? 4.0 : 2.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawShark(ctx: CanvasRenderingContext2D, shark: PredatorShark, timeMs: number) {
  ctx.save();
  ctx.translate(shark.x, shark.y);

  const pulse = (Math.sin(timeMs * 0.005) + 1) / 2;
  ctx.shadowColor = '#d32f2f';
  ctx.shadowBlur = 15 + pulse * 6;

  // Shark Body
  const sharkBodyGrad = ctx.createLinearGradient(-shark.width / 2, 0, shark.width / 2, 0);
  sharkBodyGrad.addColorStop(0, '#263238');
  sharkBodyGrad.addColorStop(0.4, '#546e7a');
  sharkBodyGrad.addColorStop(1, '#37474f');

  ctx.fillStyle = sharkBodyGrad;
  ctx.beginPath();
  ctx.moveTo(-shark.width / 2, -2);
  ctx.quadraticCurveTo(0, -shark.height / 2 - 4, shark.width / 2 - 15, -5);
  ctx.lineTo(shark.width / 2, 0);
  ctx.quadraticCurveTo(0, shark.height / 2 + 4, -shark.width / 2, 5);
  ctx.closePath();
  ctx.fill();

  // White Belly
  ctx.fillStyle = '#eceff1';
  ctx.beginPath();
  ctx.moveTo(-shark.width / 2 + 10, 0);
  ctx.quadraticCurveTo(0, shark.height / 2 + 1, shark.width / 2 - 20, 0);
  ctx.closePath();
  ctx.fill();

  // Top Fin
  ctx.fillStyle = '#37474f';
  ctx.beginPath();
  ctx.moveTo(10, -shark.height / 2 + 3);
  ctx.quadraticCurveTo(5, -shark.height / 2 - 14, -8, -shark.height / 2 - 10);
  ctx.quadraticCurveTo(-2, -shark.height / 2 + 1, 5, -shark.height / 2 + 5);
  ctx.closePath();
  ctx.fill();

  // Lateral Fin
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(-2, 14);
  ctx.lineTo(6, 8);
  ctx.closePath();
  ctx.fill();

  // Tail Fin
  ctx.fillStyle = '#37474f';
  ctx.beginPath();
  ctx.moveTo(shark.width / 2, 0);
  ctx.quadraticCurveTo(shark.width / 2 + 10, -shark.height / 2 - 10, shark.width / 2 + 20, -shark.height / 2 - 12);
  ctx.quadraticCurveTo(shark.width / 2 + 12, 0, shark.width / 2 + 20, shark.height / 2 + 12);
  ctx.quadraticCurveTo(shark.width / 2 + 10, shark.height / 2 + 10, shark.width / 2, 0);
  ctx.closePath();
  ctx.fill();

  // Gills
  ctx.strokeStyle = '#212121';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-14 + i * 4, -4);
    ctx.lineTo(-12 + i * 4, 3);
    ctx.stroke();
  }

  // Evil Red Eye
  ctx.fillStyle = '#ff1744';
  ctx.beginPath();
  ctx.arc(-shark.width / 2 + 16, -5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-shark.width / 2 + 15, -6, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Sharp Teeth
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-shark.width / 2 + 15, 3);
  ctx.lineTo(-shark.width / 2 + 18, 6);
  ctx.lineTo(-shark.width / 2 + 21, 3);
  ctx.lineTo(-shark.width / 2 + 24, 6);
  ctx.lineTo(-shark.width / 2 + 27, 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSeaMine(ctx: CanvasRenderingContext2D, mine: SeaMine, timeMs: number) {
  if (mine.exploded) return;
  ctx.save();
  ctx.translate(mine.x, mine.y);

  const glowAmount = (Math.sin(mine.pulsePhase + timeMs * 0.01) + 1) / 2;
  ctx.shadowColor = '#ff1744';
  ctx.shadowBlur = 10 + glowAmount * 12;

  // Draw core sphere of the naval mine
  const mineGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, mine.radius);
  mineGrad.addColorStop(0, '#78909c');
  mineGrad.addColorStop(0.5, '#37474f');
  mineGrad.addColorStop(1, '#212121');
  ctx.fillStyle = mineGrad;
  ctx.beginPath();
  ctx.arc(0, 0, mine.radius, 0, Math.PI * 2);
  ctx.fill();

  // Spikes protruding out of the sea mine
  ctx.strokeStyle = '#212121';
  ctx.lineWidth = 3;
  const spikeCount = 6;
  const spikeLen = 8;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i * Math.PI * 2) / spikeCount + timeMs * 0.0004;
    const sx = Math.cos(angle) * mine.radius;
    const sy = Math.sin(angle) * mine.radius;
    const ex = Math.cos(angle) * (mine.radius + spikeLen);
    const ey = Math.sin(angle) * (mine.radius + spikeLen);

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Spiky tips
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blinking red indicator light in the center
  ctx.fillStyle = `rgba(255, 23, 68, ${0.4 + glowAmount * 0.6})`;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawJellyfish(ctx: CanvasRenderingContext2D, jelly: Jellyfish, timeMs: number) {
  ctx.save();
  ctx.translate(jelly.x, jelly.y);

  const pulse = (Math.sin(timeMs * 0.004) + 1) / 2;
  ctx.shadowColor = '#e040fb';
  ctx.shadowBlur = 12 + pulse * 8;

  // Jellyfish semi-translucent dome body (umbrella)
  ctx.fillStyle = 'rgba(224, 64, 251, 0.72)';
  ctx.beginPath();
  ctx.arc(0, 0, jelly.radius, Math.PI, 0, false);
  ctx.quadraticCurveTo(jelly.radius * 0.5, 3, 0, 0);
  ctx.quadraticCurveTo(-jelly.radius * 0.5, 3, -jelly.radius, 0);
  ctx.closePath();
  ctx.fill();

  // Highlight on the dome
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-jelly.radius * 0.3, -jelly.radius * 0.4, jelly.radius * 0.4, jelly.radius * 0.2, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  // Animated glowing trailing tentacles
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
  ctx.lineWidth = 1.6;
  const tentacleCount = 3;
  for (let i = 0; i < tentacleCount; i++) {
    const tx = -jelly.radius * 0.6 + (i * jelly.radius * 1.2) / (tentacleCount - 1);
    const waveOffset = i * Math.PI * 0.5 + timeMs * 0.009;

    ctx.beginPath();
    ctx.moveTo(tx, 0);
    ctx.bezierCurveTo(
      tx + Math.sin(waveOffset) * 6, jelly.radius * 0.8,
      tx - Math.sin(waveOffset) * 6, jelly.radius * 1.6,
      tx + Math.sin(waveOffset * 1.2) * 4, jelly.radius * 2.2
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, timeMs: number) {
  if (coin.collected) return;
  const angle = (timeMs * 0.0035) % (Math.PI * 2);
  const scaleX = Math.abs(Math.cos(angle));

  ctx.save();
  ctx.translate(coin.x, coin.y + Math.sin(timeMs * 0.0018 + coin.x) * 1.5);
  ctx.scale(scaleX, 1);

  ctx.beginPath();
  ctx.arc(0, 0, coin.bonus ? 12 : 9, 0, Math.PI * 2);
  ctx.fillStyle = coin.bonus ? '#ff9500' : '#ffd60a';
  ctx.shadowColor = coin.bonus ? '#ffb347' : '#fff275';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#a97400';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff8e0';
  ctx.font = `bold ${coin.bonus ? 10 : 8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(coin.bonus ? '+5' : '+1', 0, 0);
  ctx.restore();
}

function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, timeMs: number) {
  if (gem.collected) return;
  const angle = (timeMs * 0.002) % (Math.PI * 2);
  const scaleX = Math.abs(Math.cos(angle));
  const bobY = Math.sin(timeMs * 0.002 + gem.x) * 1.6;

  ctx.save();
  ctx.translate(gem.x, gem.y + bobY);
  ctx.scale(scaleX, 1);
  ctx.shadowColor = '#ff4d6d';
  ctx.shadowBlur = 16;

  const size = 11;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.35);
  ctx.bezierCurveTo(-size * 0.45, -size * 0.65, -size * 1.25, -size * 0.35, 0, size * 0.95);
  ctx.bezierCurveTo(size * 1.25, -size * 0.35, size * 0.45, -size * 0.65, 0, size * 0.35);
  ctx.closePath();

  const heartGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, size);
  heartGrad.addColorStop(0, '#ffccd5');
  heartGrad.addColorStop(0.5, '#ff4d6d');
  heartGrad.addColorStop(1, '#c1121f');
  ctx.fillStyle = heartGrad;
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, timeMs: number) {
  if (pu.collected) return;
  const bob = Math.sin(timeMs * 0.0018 + pu.x) * 1.5;
  ctx.save();
  ctx.translate(pu.x, pu.y + bob);

  if (pu.type === 'shield') {
    ctx.shadowColor = '#4fc3f7';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#4fc3f7';
    ctx.fill();
    ctx.strokeStyle = '#e3f2fd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', 0, 1);
  } else if (pu.type === 'magnet') {
    ctx.shadowColor = '#ff3d00';
    ctx.shadowBlur = 12;

    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -2, 7, 0, Math.PI, false);
    ctx.stroke();

    ctx.fillStyle = '#cfd8dc';
    ctx.fillRect(-9.5, -6, 5, 4);
    ctx.fillStyle = '#0288d1';
    ctx.fillRect(4.5, -6, 5, 4);
  } else if (pu.type === 'fever') {
    // Shimmering rainbow star icon
    const starPulse = (Math.sin(timeMs * 0.01) + 1) / 2;
    ctx.shadowColor = '#e040fb';
    ctx.shadowBlur = 15 + starPulse * 8;
    ctx.fillStyle = `hsl(${(timeMs / 10) % 360}, 100%, 72%)`;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐', 0, 1);
  }
  ctx.restore();
}

function drawBubbleBoostRing(ctx: CanvasRenderingContext2D, ring: BubbleBoostRing, timeMs: number) {
  if (ring.collected) return;
  const bob = Math.sin(timeMs * 0.0018 + ring.x) * 1.5;
  ctx.save();
  ctx.translate(ring.x, ring.y + bob);

  const pulse = (Math.sin(timeMs * 0.008) + 1) / 2;
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 16 + pulse * 8;

  ctx.strokeStyle = '#e0f7fa';
  ctx.lineWidth = 4 + pulse * 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawTreasureChest(ctx: CanvasRenderingContext2D, chest: TreasureChest, timeMs: number) {
  if (chest.collected) return;
  const wobble = Math.sin(timeMs * 0.0015 + chest.x) * 1.1;
  ctx.save();
  ctx.translate(chest.x + chest.width / 2, chest.y + chest.height / 2 + wobble);

  const pulse = (Math.sin(timeMs * 0.006) + 1) / 2;
  ctx.shadowColor = '#ffb300';
  ctx.shadowBlur = 12 + pulse * 6;

  ctx.fillStyle = '#5d4037';
  ctx.fillRect(-chest.width / 2, -chest.height / 2 + 8, chest.width, chest.height - 8);

  ctx.fillStyle = '#8d6e63';
  ctx.beginPath();
  ctx.moveTo(-chest.width / 2, -chest.height / 2 + 8);
  ctx.quadraticCurveTo(0, -chest.height / 2 - 6, chest.width / 2, -chest.height / 2 + 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(-chest.width / 2 + 4, -chest.height / 2 + 6, 4, chest.height - 6);
  ctx.fillRect(chest.width / 2 - 8, -chest.height / 2 + 6, 4, chest.height - 6);

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-1.2, 2, 2.4, 5);

  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  const alpha = 1 - particle.life / particle.maxLife;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fillStyle = particle.color;
  ctx.fill();
  ctx.restore();
}

function drawFloatingText(ctx: CanvasRenderingContext2D, text: FloatingText, timeMs: number) {
  const elapsed = timeMs - text.createdAt;
  const progress = elapsed / text.durationMs;

  const alpha = 1 - progress;
  const currentY = text.y - progress * 40;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = text.color;
  ctx.font = `bold ${text.size}px sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.text, text.x, currentY);
  ctx.restore();
}

export function renderEngine(ctx: CanvasRenderingContext2D, state: EngineState) {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (state.shakeIntensity > 0.2) {
    const dx = (Math.random() - 0.5) * state.shakeIntensity;
    const dy = (Math.random() - 0.5) * state.shakeIntensity;
    ctx.translate(dx, dy);
  }
  drawBackground(ctx, state);
  for (const obs of state.obstacles) drawObstacle(ctx, obs, height);
  for (const shark of state.sharks) drawShark(ctx, shark, state.timeMs);
  for (const mine of state.seaMines) drawSeaMine(ctx, mine, state.timeMs);
  for (const jelly of state.jellyfish) drawJellyfish(ctx, jelly, state.timeMs);
  for (const coin of state.coins) drawCoin(ctx, coin, state.timeMs);
  for (const gem of state.gems) drawGem(ctx, gem, state.timeMs);
  for (const pu of state.powerUps) drawPowerUp(ctx, pu, state.timeMs);
  for (const ring of state.boostRings) drawBubbleBoostRing(ctx, ring, state.timeMs);
  for (const chest of state.chests) drawTreasureChest(ctx, chest, state.timeMs);

  const fishX = width * FISH_X_RATIO;
  const invincible = state.timeMs < state.invincibleUntil;
  drawFish(ctx, state, fishX, invincible);
  for (const particle of state.particles) drawParticle(ctx, particle);

  for (const text of state.floatingTexts) {
    drawFloatingText(ctx, text, state.timeMs);
  }

  ctx.restore();

  if (state.isRedFlashing) {
    ctx.save();
    ctx.fillStyle = 'rgba(211, 47, 47, 0.22)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export { FISH_X_RATIO };
