// -----------------------------------------------------------------------
// Core canvas game engine for Golden Fish Rush.
// Power-ups: Shield (protects one hit + invincibility) and Magnet (pulls nearby coins)
// Gem improvement: full lives -> +5 score
// Shop boosts supported: initial shield/magnet/gemBoostActive
// Visual feedback: Shield bubble + Magnet glow added
// -----------------------------------------------------------------------

import { BASE, SKINS, getDifficultyTier } from './constants';
import type { SkinId } from './types';

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
  nearMissAwarded: boolean;
}

export interface Shark {
  x: number;
  y: number;
  baseY: number;
  bobPhase: number;
  speedMult: number;
  minDist: number;
  nearMissAwarded: boolean;
}

export interface BubbleBoost {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
}

export interface Treasure {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
  amount: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export interface DistantFish {
  x: number;
  y: number;
  scale: number;
  speed: number;
  flip: boolean;
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
  type: 'shield' | 'magnet';
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

export interface EngineCallbacks {
  onScore: (score: number) => void;
  onCoinCollect: (total: number) => void;
  onDeath: () => void;
  onShake: (intensity: number) => void;
  onGemCollect?: (lives: number) => void;
  onLifeChange?: (lives: number) => void;
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
  // --- New gameplay systems ---
  sharks: Shark[];
  bubbleBoosts: BubbleBoost[];
  treasures: Treasure[];
  floatingTexts: FloatingText[];
  distantFish: DistantFish[];
  elapsedSinceSharkSpawn: number;
  elapsedSinceBubbleBoostSpawn: number;
  elapsedSinceTreasureSpawn: number;
  comboCount: number;
  comboWindowEnd: number;
  comboStage: number;
  comboBadge: { text: string; until: number } | null;
  hitFlashUntil: number;
}

const FISH_X_RATIO = 0.28;
const MAX_EXTRA_LIVES = 2;
const GEM_SPAWN_CHANCE = 0.09;
const HIT_INVINCIBILITY_MS = 1700;
const SAFE_REVIVE_DELAY_MS = 900;
const SHARK_RADIUS = 26;
const COMBO_WINDOW_MS = 1700;
const COMBO_STAGE_2_COUNT = 3;
const COMBO_STAGE_3_COUNT = 6;
const NEAR_MISS_MARGIN = 22;
const BUBBLE_BOOST_MAGNET_MS = 5000;
const BUBBLE_BOOST_BONUS_COINS = 3;

export function createEngine(width: number, height: number, skin: SkinId): EngineState {
  const bubbles: Bubble[] = Array.from({ length: 18 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 3 + Math.random() * 7,
    speed: 0.3 + Math.random() * 0.9,
    drift: (Math.random() - 0.5) * 0.4,
  }));
  const distantFish: DistantFish[] = Array.from({ length: 5 }, () => ({
    x: Math.random() * width,
    y: height * 0.15 + Math.random() * height * 0.5,
    scale: 0.5 + Math.random() * 0.7,
    speed: 0.12 + Math.random() * 0.16,
    flip: Math.random() < 0.5,
  }));
  return {
    width, height, fishY: height / 2, fishVY: 0, fishRotation: 0, score: 0, running: true,
    invincibleUntil: 0, obstacles: [], coins: [], gems: [], powerUps: [], bubbles, particles: [],
    elapsedSinceSpawn: 999999, skin, shakeIntensity: 0, timeMs: 0, legendaryPulse: 0,
    lives: 0, maxLives: MAX_EXTRA_LIVES, shieldCharges: 0, magnetUntil: 0, gemBoostActive: false,
    sharks: [], bubbleBoosts: [], treasures: [], floatingTexts: [], distantFish,
    elapsedSinceSharkSpawn: 2600, elapsedSinceBubbleBoostSpawn: 4000, elapsedSinceTreasureSpawn: 6000,
    comboCount: 0, comboWindowEnd: 0, comboStage: 0, comboBadge: null, hitFlashUntil: 0,
  };
}

// Gradual, capped difficulty ramp so the game never spikes suddenly or
// becomes impossible. difficultyMultiplier grows smoothly with score and
// tops out at 2.3x, and every derived value (obstacle speed, spawn rate,
// shark speed) is scaled off it while staying within safe bounds.
export function difficultyForScore(score: number) {
  const difficultyMultiplier = Math.min(1 + score / 600, 2.3);
  const speedSteps = Math.floor(score / 12);
  const speed = Math.min(BASE.maxSpeed, BASE.baseSpeed * 0.86 * difficultyMultiplier + speedSteps * 0.05);
  const gap = Math.max(BASE.minGap + 24, BASE.baseGap + 24 - (difficultyMultiplier - 1) * 78);
  const spawnInterval = Math.max(1000, BASE.spawnInterval + 180 - (difficultyMultiplier - 1) * 430);
  const tier = getDifficultyTier(score);
  return { speed, gap, spawnInterval, tier, difficultyMultiplier };
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
  const { gap } = difficultyForScore(score);
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
    nearMissAwarded: false,
  });
  if (Math.random() < 0.68) {
    state.coins.push({
      x: state.width + BASE.obstacleWidth + 44, y: gapY + (Math.random() - 0.5) * (gap * 0.32),
      collected: false, bonus: score >= 60 && Math.random() < 0.22,
    });
  }
  // Gem spawn (boosted if shop gemBoostActive)
  const gemChance = state.gemBoostActive ? GEM_SPAWN_CHANCE * 1.8 : GEM_SPAWN_CHANCE;
  if (Math.random() < gemChance) {
    state.gems.push({
      x: state.width + BASE.obstacleWidth + 88, y: gapY + (Math.random() - 0.5) * (gap * 0.28),
      collected: false, pulse: Math.random() * Math.PI * 2,
    });
  }
  // Rare power-up spawn (shield or magnet) - increased slightly for better shop value
  if (Math.random() < 0.06) {
    const type: 'shield' | 'magnet' = Math.random() < 0.5 ? 'shield' : 'magnet';
    const puY = gapY + (Math.random() - 0.5) * (gap * 0.25);
    state.powerUps.push({
      x: state.width + BASE.obstacleWidth + 125,
      y: puY,
      type,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

function spawnShark(state: EngineState, difficultyMultiplier: number) {
  const margin = 70;
  const baseY = margin + Math.random() * Math.max(1, state.height - margin * 2);
  state.sharks.push({
    x: state.width + SHARK_RADIUS * 2,
    y: baseY,
    baseY,
    bobPhase: Math.random() * Math.PI * 2,
    speedMult: 1 + Math.random() * 0.35 + (difficultyMultiplier - 1) * 0.15,
    minDist: Infinity,
    nearMissAwarded: false,
  });
}

function spawnBubbleBoost(state: EngineState) {
  const margin = 90;
  state.bubbleBoosts.push({
    x: state.width + 30,
    y: margin + Math.random() * Math.max(1, state.height - margin * 2),
    collected: false,
    pulse: Math.random() * Math.PI * 2,
  });
}

function spawnTreasure(state: EngineState) {
  const margin = 90;
  state.treasures.push({
    x: state.width + 30,
    y: margin + Math.random() * Math.max(1, state.height - margin * 2),
    collected: false,
    pulse: Math.random() * Math.PI * 2,
    amount: Math.random() < 0.5 ? 10 : 20,
  });
}

function spawnFloatingText(state: EngineState, x: number, y: number, text: string, color: string) {
  state.floatingTexts.push({ x, y, text, color, life: 0, maxLife: 34 + Math.random() * 12, vy: -0.55 });
  // Keep the list bounded so a busy screen never accumulates unbounded work.
  if (state.floatingTexts.length > 24) state.floatingTexts.shift();
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
  state.coins = state.coins.filter((coin) => coin.x < fishX - BASE.obstacleWidth * 2 || coin.x > state.width + BASE.obstacleWidth);
  state.gems = state.gems.filter((gem) => gem.x < fishX - BASE.obstacleWidth * 2 || gem.x > state.width + BASE.obstacleWidth);
  state.powerUps = state.powerUps.filter((pu) => pu.x < fishX - BASE.obstacleWidth * 2 || pu.x > state.width + BASE.obstacleWidth);
  state.sharks = state.sharks.filter((s) => s.x < fishX - BASE.obstacleWidth * 2 || s.x > state.width + BASE.obstacleWidth);
  state.bubbleBoosts = state.bubbleBoosts.filter((b) => b.x < fishX - BASE.obstacleWidth * 2 || b.x > state.width + BASE.obstacleWidth);
  state.treasures = state.treasures.filter((t) => t.x < fishX - BASE.obstacleWidth * 2 || t.x > state.width + BASE.obstacleWidth);
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
  callbacks.onShake(6);
  addBurst(state, state.width * FISH_X_RATIO, state.fishY, 'rgba(80, 220, 255, 0.95)', 22, 3);
  return true;
}

function killOrUseLife(state: EngineState, callbacks: EngineCallbacks) {
  // Brief red flash + shake on any unshielded hit (revive or final death).
  state.hitFlashUntil = state.timeMs + 220;
  if (spendExtraLife(state, callbacks)) return;
  callbacks.onShake(14);
  callbacks.onDeath();
  state.running = false;
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
  const { speed, spawnInterval, difficultyMultiplier } = difficultyForScore(state.score);
  state.elapsedSinceSpawn += dtMs;
  if (state.elapsedSinceSpawn >= spawnInterval) {
    spawnObstacle(state, state.score);
    state.elapsedSinceSpawn = 0;
  }
  const fishX = state.width * FISH_X_RATIO;
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
      // Near Miss bonus: reward passing close to the gap edge without a collision.
      // Only checked once per obstacle (nearMissAwarded) and only for standard
      // (non-double) gaps to keep the check simple and unmistakably fair.
      if (!obs.nearMissAwarded) {
        obs.nearMissAwarded = true;
        if (!obs.isDouble) {
          const topGapEdge = obs.gapY - obs.gapSize / 2;
          const bottomGapEdge = obs.gapY + obs.gapSize / 2;
          const distTop = state.fishY - BASE.fishRadius - topGapEdge;
          const distBottom = bottomGapEdge - (state.fishY + BASE.fishRadius);
          const minEdgeDist = Math.min(distTop, distBottom);
          if (minEdgeDist >= 0 && minEdgeDist < NEAR_MISS_MARGIN) {
            state.score += 5;
            callbacks.onScore(state.score);
            spawnFloatingText(state, fishX, state.fishY - 30, 'Near Miss +5', '#7CFC9A');
          }
        }
      }
    }
    if (!invincible) {
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
            callbacks.onShake(7);
            addBurst(state, fishX, state.fishY, 'rgba(100, 210, 255, 0.95)', 16, 3);
            spawnFloatingText(state, fishX, state.fishY - 30, 'Shield Block!', '#7fdcff');
          } else {
            killOrUseLife(state, callbacks);
            return;
          }
        }
      }
    }
  }
  state.obstacles = state.obstacles.filter((o) => o.x > -BASE.obstacleWidth * 2);
  for (const coin of state.coins) {
    coin.x -= speed * dt;
    if (!coin.collected) {
      const dx = coin.x - fishX;
      const dy = coin.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 13) {
        coin.collected = true;
        const amount = coin.bonus ? 5 : 1;
        state.score += amount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(amount);
        addBurst(state, coin.x, coin.y, coin.bonus ? '#ff9500' : '#ffd60a', 12, 2);
        spawnFloatingText(state, coin.x, coin.y - 16, coin.bonus ? '+5' : '+1', '#ffe066');

        // --- Coin Combo / Streak ---
        // A short rolling window: consecutive coins within COMBO_WINDOW_MS build
        // the streak. Reaching 3 coins grants a small Combo x2 bonus, 6 coins
        // grants Combo x3 (the streak then resets). Bonuses are intentionally
        // small so they never meaningfully inflate the coin economy.
        if (state.timeMs <= state.comboWindowEnd) {
          state.comboCount += 1;
        } else {
          state.comboCount = 1;
        }
        state.comboWindowEnd = state.timeMs + COMBO_WINDOW_MS;
        if (state.comboCount === COMBO_STAGE_2_COUNT) {
          const bonus = 2;
          state.score += bonus;
          callbacks.onScore(state.score);
          callbacks.onCoinCollect(bonus);
          spawnFloatingText(state, coin.x, coin.y - 34, 'Combo x2', '#ffd60a');
          state.comboBadge = { text: 'Combo x2', until: state.timeMs + 900 };
        } else if (state.comboCount >= COMBO_STAGE_3_COUNT) {
          const bonus = 3;
          state.score += bonus;
          callbacks.onScore(state.score);
          callbacks.onCoinCollect(bonus);
          spawnFloatingText(state, coin.x, coin.y - 34, 'Combo x3', '#ff9500');
          state.comboBadge = { text: 'Combo x3', until: state.timeMs + 900 };
          state.comboCount = 0;
        }
      }
    }
  }
  if (state.comboCount > 0 && state.timeMs > state.comboWindowEnd) {
    state.comboCount = 0;
  }
  // Magnet: pull nearby uncollected coins toward fish
  if (state.magnetUntil > state.timeMs) {
    const fishXMag = state.width * FISH_X_RATIO;
    const fishYMag = state.fishY;
    for (const coin of state.coins) {
      if (!coin.collected) {
        const dx = coin.x - fishXMag;
        const dy = coin.y - fishYMag;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5 && dist < 130) {
          const pull = 0.22 * dt;
          coin.x -= dx * pull;
          coin.y -= dy * pull;
        }
      }
    }
  }
  state.coins = state.coins.filter((c) => c.x > -40 && !c.collected);
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
          spawnFloatingText(state, gem.x, gem.y - 16, '+Life', '#7df9ff');
        } else {
          state.score += 5;
          callbacks.onScore(state.score);
          spawnFloatingText(state, gem.x, gem.y - 16, '+Gem', '#7df9ff');
        }
        callbacks.onShake(5);
        addBurst(state, gem.x, gem.y, '#7df9ff', 22, 3);
      }
    }
  }
  state.gems = state.gems.filter((g) => g.x > -50 && !g.collected);
  // Power-up movement, collection (shield charges / magnet activate)
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
          callbacks.onShake?.(4);
          addBurst(state, pu.x, pu.y, 'rgba(70, 180, 255, 0.9)', 20, 3);
        } else if (pu.type === 'magnet') {
          state.magnetUntil = state.timeMs + 8000;
          addBurst(state, pu.x, pu.y, 'rgba(255, 140, 0, 0.9)', 18, 3);
        }
      }
    }
  }
  state.powerUps = state.powerUps.filter((p) => p.x > -60 && !p.collected);

  // --- Shark (predator) spawn + movement + collision ---
  const sharkInterval = Math.max(3500, 7200 - (difficultyMultiplier - 1) * 2400);
  state.elapsedSinceSharkSpawn += dtMs;
  if (state.score >= 8 && state.elapsedSinceSharkSpawn > sharkInterval) {
    state.elapsedSinceSharkSpawn = 0;
    if (Math.random() < 0.85) spawnShark(state, difficultyMultiplier);
  }
  const sharkSpeed = speed * (1.1 + (difficultyMultiplier - 1) * 0.2);
  for (const shark of state.sharks) {
    shark.x -= sharkSpeed * shark.speedMult * dt;
    shark.bobPhase += dtMs * 0.0022;
    shark.y = shark.baseY + Math.sin(shark.bobPhase) * 16;
    const dx = shark.x - fishX;
    const dy = shark.y - state.fishY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(dx) < 100) shark.minDist = Math.min(shark.minDist, dist);
    if (!invincible) {
      if (dist < BASE.fishRadius + SHARK_RADIUS * 0.72) {
        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
          callbacks.onShake(7);
          addBurst(state, fishX, state.fishY, 'rgba(100, 210, 255, 0.95)', 16, 3);
          spawnFloatingText(state, fishX, state.fishY - 30, 'Shield Block!', '#7fdcff');
          shark.nearMissAwarded = true;
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
    if (!shark.nearMissAwarded && shark.x < fishX - SHARK_RADIUS) {
      shark.nearMissAwarded = true;
      const closeCall = shark.minDist < BASE.fishRadius + SHARK_RADIUS * 0.72 + 26;
      if (closeCall) {
        state.score += 5;
        callbacks.onScore(state.score);
        spawnFloatingText(state, fishX, state.fishY - 30, 'Near Miss +5', '#7CFC9A');
      }
    }
  }
  state.sharks = state.sharks.filter((s) => s.x > -SHARK_RADIUS * 3);

  // --- Bubble Boost (rare, short-lived buff) ---
  state.elapsedSinceBubbleBoostSpawn += dtMs;
  if (state.elapsedSinceBubbleBoostSpawn > 9000 && Math.random() < 0.4) {
    state.elapsedSinceBubbleBoostSpawn = 0;
    spawnBubbleBoost(state);
  }
  for (const boost of state.bubbleBoosts) {
    boost.x -= speed * dt;
    boost.pulse += dtMs * 0.004;
    if (!boost.collected) {
      const dx = boost.x - fishX;
      const dy = boost.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 20) {
        boost.collected = true;
        state.magnetUntil = Math.max(state.magnetUntil, state.timeMs + BUBBLE_BOOST_MAGNET_MS);
        callbacks.onCoinCollect(BUBBLE_BOOST_BONUS_COINS);
        callbacks.onShake(4);
        addBurst(state, boost.x, boost.y, 'rgba(180, 240, 255, 0.9)', 18, 3);
        spawnFloatingText(state, boost.x, boost.y - 18, 'Boost!', '#b4f0ff');
      }
    }
  }
  state.bubbleBoosts = state.bubbleBoosts.filter((b) => b.x > -50 && !b.collected);

  // --- Treasure Chest (very rare coin bonus) ---
  state.elapsedSinceTreasureSpawn += dtMs;
  if (state.elapsedSinceTreasureSpawn > 16000 && Math.random() < 0.3) {
    state.elapsedSinceTreasureSpawn = 0;
    spawnTreasure(state);
  }
  for (const chest of state.treasures) {
    chest.x -= speed * dt;
    chest.pulse += dtMs * 0.0035;
    if (!chest.collected) {
      const dx = chest.x - fishX;
      const dy = chest.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 18) {
        chest.collected = true;
        state.score += chest.amount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(chest.amount);
        callbacks.onShake(5);
        addBurst(state, chest.x, chest.y, '#ffd60a', 24, 3);
        spawnFloatingText(state, chest.x, chest.y - 18, `Treasure +${chest.amount}`, '#ffd60a');
      }
    }
  }
  state.treasures = state.treasures.filter((t) => t.x > -50 && !t.collected);

  // --- Floating text + combo badge lifecycle ---
  for (const ft of state.floatingTexts) {
    ft.life += dt;
    ft.y += ft.vy * dt;
  }
  state.floatingTexts = state.floatingTexts.filter((ft) => ft.life < ft.maxLife);
  if (state.comboBadge && state.timeMs > state.comboBadge.until) state.comboBadge = null;

  // --- Distant fish silhouettes (decorative parallax, no collision) ---
  for (const df of state.distantFish) {
    df.x -= df.speed * speed * dt;
    if (df.x < -40) {
      df.x = state.width + 40;
      df.y = state.height * 0.15 + Math.random() * state.height * 0.5;
    }
  }

  for (const b of state.bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(state.timeMs * 0.001 + b.x) * b.drift * dt;
    if (b.y < -20) { b.y = state.height + 10; b.x = Math.random() * state.width; }
  }
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
  const [c1, c2] = tier.bg;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  if (state.score >= 100) {
    const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
    ctx.fillStyle = `rgba(255, 214, 10, ${0.05 + pulse * 0.06})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 4; i++) {
    const rx = (width / 4) * i + Math.sin(state.timeMs * 0.0002 + i) * 20;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + 60, 0);
    ctx.lineTo(rx - 40, height);
    ctx.lineTo(rx - 130, height);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  for (const b of state.bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // Distant fish silhouettes: slow parallax layer, purely decorative.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#dff6ff';
  for (const df of state.distantFish) {
    ctx.save();
    ctx.translate(df.x, df.y);
    ctx.scale(df.flip ? -df.scale : df.scale, df.scale);
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(0, -6, 12, 0);
    ctx.quadraticCurveTo(0, 6, -10, 0);
    ctx.moveTo(-10, 0);
    ctx.lineTo(-17, -5);
    ctx.lineTo(-17, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = tier.name === 'Easy' ? '#0a6ea8' : '#04203f';
  for (let i = 0; i < 6; i++) {
    const cx = (width / 6) * i + 20;
    const h = 30 + ((i * 37) % 50);
    ctx.beginPath();
    ctx.moveTo(cx, height);
    ctx.quadraticCurveTo(cx - 14, height - h, cx, height - h - 10);
    ctx.quadraticCurveTo(cx + 14, height - h, cx, height);
    ctx.fill();
  }
  // Light wisps of seaweed between the coral blobs for a little extra life.
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = tier.name === 'Easy' ? '#0a8f6e' : '#0a5c42';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const bx = (width / 4) * i + 55 + Math.sin(state.timeMs * 0.0006 + i) * 6;
    ctx.beginPath();
    ctx.moveTo(bx, height);
    ctx.quadraticCurveTo(bx + 10, height - 26, bx - 4, height - 46);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, height - 8, width, 8);
  ctx.fillRect(0, 0, width, 8);
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, height: number) {
  const topGapEdge = obs.gapY - obs.gapSize / 2;
  const bottomGapEdge = obs.gapY + obs.gapSize / 2;
  const w = BASE.obstacleWidth;
  const x = obs.x - w / 2;
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  if (obs.glowing) {
    grad.addColorStop(0, '#ffe066');
    grad.addColorStop(0.5, '#ffd60a');
    grad.addColorStop(1, '#ff9500');
  } else {
    grad.addColorStop(0, '#38b5a4');
    grad.addColorStop(0.45, '#2a9d8f');
    grad.addColorStop(1, '#155e56');
  }
  ctx.save();
  ctx.shadowColor = obs.glowing ? '#ffe066' : 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = obs.glowing ? 22 : 9;
  ctx.shadowOffsetX = obs.glowing ? 0 : 2;
  ctx.fillStyle = grad;
  ctx.fillRect(x, 0, w, topGapEdge);
  ctx.fillRect(x, bottomGapEdge, w, height - bottomGapEdge);
  ctx.restore();
  // Rounded lip at the gap edges, plus a subtle lighter rim highlight for depth.
  ctx.fillStyle = grad;
  const lipR = 9;
  drawRoundedRect(ctx, x - 6, topGapEdge - 18, w + 12, 18, lipR);
  drawRoundedRect(ctx, x - 6, bottomGapEdge, w + 12, 18, lipR);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 4, 0, 5, topGapEdge);
  ctx.fillRect(x + 4, bottomGapEdge, 5, height - bottomGapEdge);
  ctx.restore();
  if (obs.isDouble) {
    const secondTop = bottomGapEdge + 58;
    const secondBottom = secondTop + 52;
    ctx.clearRect(x - 6, secondTop, w + 12, secondBottom - secondTop);
    ctx.fillStyle = '#e63946';
    drawRoundedRect(ctx, x - 6, secondBottom, w + 12, 8, 3);
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}

function drawShark(ctx: CanvasRenderingContext2D, shark: Shark) {
  const r = SHARK_RADIUS;
  ctx.save();
  ctx.translate(shark.x, shark.y);
  // Body (side profile, moving right-to-left so the nose points left).
  ctx.beginPath();
  ctx.moveTo(-r * 1.5, 0);
  ctx.quadraticCurveTo(-r * 1.1, -r * 0.55, -r * 0.1, -r * 0.5);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.42, r * 1.35, -r * 0.08);
  ctx.quadraticCurveTo(r * 0.9, r * 0.36, -r * 0.1, r * 0.5);
  ctx.quadraticCurveTo(-r * 1.1, r * 0.55, -r * 1.5, 0);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(-r * 1.5, -r * 0.55, r * 1.35, r * 0.5);
  bodyGrad.addColorStop(0, '#7d93a3');
  bodyGrad.addColorStop(0.5, '#54697c');
  bodyGrad.addColorStop(1, '#2f3d4a');
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  // Pale belly.
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, r * 0.28, r * 0.85, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#dfe9ee';
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  // Tail fin.
  ctx.beginPath();
  ctx.moveTo(-r * 1.45, 0);
  ctx.lineTo(-r * 2.15, -r * 0.55);
  ctx.lineTo(-r * 1.75, 0);
  ctx.lineTo(-r * 2.15, r * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#3d4d5c';
  ctx.fill();
  // Dorsal fin (the tell-tale triangle on top).
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.48);
  ctx.lineTo(r * 0.1, -r * 1.15);
  ctx.lineTo(r * 0.5, -r * 0.42);
  ctx.closePath();
  ctx.fillStyle = '#4a5c6c';
  ctx.fill();
  // Pectoral fin underneath.
  ctx.beginPath();
  ctx.moveTo(r * 0.05, r * 0.25);
  ctx.lineTo(-r * 0.25, r * 0.85);
  ctx.lineTo(r * 0.35, r * 0.4);
  ctx.closePath();
  ctx.fillStyle = '#3d4d5c';
  ctx.fill();
  // Gill lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(r * 0.35 + i * 5, -r * 0.32);
    ctx.lineTo(r * 0.28 + i * 5, r * 0.1);
    ctx.stroke();
  }
  // Eye.
  ctx.beginPath();
  ctx.arc(-r * 0.98, -r * 0.12, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1116';
  ctx.fill();
  // Mouth with a hint of teeth.
  ctx.beginPath();
  ctx.moveTo(-r * 1.42, r * 0.08);
  ctx.quadraticCurveTo(-r * 1.1, r * 0.28, -r * 0.75, r * 0.14);
  ctx.strokeStyle = '#1c2530';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 1.32 + i * 0.2 * r, r * 0.1);
    ctx.lineTo(-r * 1.28 + i * 0.2 * r, r * 0.2);
    ctx.lineTo(-r * 1.24 + i * 0.2 * r, r * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBubbleBoost(ctx: CanvasRenderingContext2D, boost: BubbleBoost, timeMs: number) {
  if (boost.collected) return;
  const pulse = (Math.sin(boost.pulse) + 1) / 2;
  const r = 15 + pulse * 3;
  ctx.save();
  ctx.translate(boost.x, boost.y + Math.sin(timeMs * 0.0035 + boost.x) * 2);
  ctx.globalAlpha = 0.28 + pulse * 0.15;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#bff2ff';
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#e8feff';
  ctx.lineWidth = 2.4;
  ctx.shadowColor = '#7fe8ff';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.32, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.restore();
}

function drawTreasure(ctx: CanvasRenderingContext2D, chest: Treasure, timeMs: number) {
  if (chest.collected) return;
  const bob = Math.sin(timeMs * 0.0028 + chest.x) * 1.8;
  const glow = (Math.sin(chest.pulse) + 1) / 2;
  ctx.save();
  ctx.translate(chest.x, chest.y + bob);
  ctx.shadowColor = '#ffd60a';
  ctx.shadowBlur = 10 + glow * 6;
  // Chest base.
  ctx.fillStyle = '#8a5a2b';
  drawRoundedRect(ctx, -13, -4, 26, 14, 3);
  // Chest lid.
  ctx.beginPath();
  ctx.moveTo(-13, -4);
  ctx.quadraticCurveTo(0, -16, 13, -4);
  ctx.closePath();
  ctx.fillStyle = '#a86f34';
  ctx.fill();
  ctx.shadowBlur = 0;
  // Metal bands.
  ctx.fillStyle = '#ffd60a';
  ctx.fillRect(-2, -14, 4, 24);
  // Lock.
  ctx.beginPath();
  ctx.arc(0, -2, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe066';
  ctx.fill();
  ctx.restore();
}

function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
  ctx.fillStyle = ft.color;
  ctx.fillText(ft.text, ft.x, ft.y);
  ctx.restore();
}

function drawComboBadge(ctx: CanvasRenderingContext2D, state: EngineState) {
  if (!state.comboBadge) return;
  const remain = Math.max(0, state.comboBadge.until - state.timeMs);
  const alpha = Math.min(1, remain / 300);
  ctx.save();
  ctx.globalAlpha = alpha;
  const cx = state.width / 2;
  const cy = 108;
  ctx.font = 'bold 16px sans-serif';
  const textWidth = ctx.measureText(state.comboBadge.text).width;
  const padX = 14;
  ctx.fillStyle = 'rgba(4, 20, 34, 0.55)';
  drawRoundedRect(ctx, cx - textWidth / 2 - padX, cy - 15, textWidth + padX * 2, 30, 15);
  ctx.fillStyle = '#ffd60a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.comboBadge.text, cx, cy + 1);
  ctx.restore();
}

function drawFish(ctx: CanvasRenderingContext2D, state: EngineState, fishX: number, invincible: boolean) {
  const skin = SKINS.find((s) => s.id === state.skin) ?? SKINS[0];
  const blink = invincible && Math.floor(state.timeMs / 100) % 2 === 0;
  if (blink) return;
  const r = BASE.fishRadius;
  const id = skin.id;
  const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
  const { body, belly, fin, glow } = skin.colors;
  ctx.save();
  ctx.translate(fishX, state.fishY);
  ctx.rotate(state.fishRotation);
  if (id === 'legendary') {
    ctx.save();
    ctx.globalAlpha = 0.28 + pulse * 0.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.9, r * 1.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.globalAlpha = 0.5 + pulse * 0.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.6, r * 1.12, 0, 0, Math.PI * 2);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = id === 'legendary' ? 30 : id === 'diamond' ? 24 : 16;
  // Tail
  if (id === 'ruby') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, 0);
    ctx.quadraticCurveTo(-r * 1.6, -r * 1.3, -r * 2.3, -r * 0.6);
    ctx.quadraticCurveTo(-r * 1.9, 0, -r * 2.3, r * 0.6);
    ctx.quadraticCurveTo(-r * 1.6, r * 1.3, -r * 0.85, 0);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
  } else if (id === 'legendary') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.quadraticCurveTo(-r * 1.7, -r * 1.25, -r * 2.4, -r * 0.45);
    ctx.lineTo(-r * 1.8, 0);
    ctx.quadraticCurveTo(-r * 2.4, r * 0.45, -r * 1.7, r * 1.25);
    ctx.closePath();
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, 0);
    ctx.quadraticCurveTo(-r * 1.45, -r * 0.95, -r * 1.95, -r * 0.35);
    ctx.quadraticCurveTo(-r * 1.55, 0, -r * 1.95, r * 0.35);
    ctx.quadraticCurveTo(-r * 1.45, r * 0.95, -r * 0.85, 0);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
  }
  // Body
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.quadraticCurveTo(-r * 0.55, -r * 0.95, r * 0.15, -r * 0.88);
  ctx.quadraticCurveTo(r * 0.95, -r * 0.5, r * 1.05, 0);
  ctx.quadraticCurveTo(r * 0.95, r * 0.5, r * 0.15, r * 0.88);
  ctx.quadraticCurveTo(-r * 0.55, r * 0.95, -r * 0.9, 0);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
  if (id === 'legendary') {
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
  // Belly
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.28, r * 0.55, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = belly;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  // Dorsal
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.7);
  ctx.quadraticCurveTo(r * 0.25, -r * 1.25, r * 0.7, -r * 0.55);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.8, 0, -r * 0.7);
  ctx.closePath();
  ctx.fillStyle = id === 'legendary' ? '#ffd60a' : fin;
  ctx.fill();
  // Pectoral
  ctx.beginPath();
  ctx.moveTo(r * 0.25, r * 0.1);
  ctx.quadraticCurveTo(r * 1.05, -r * 0.2, r * 1.1, r * 0.35);
  ctx.quadraticCurveTo(r * 0.7, r * 0.3, r * 0.25, r * 0.1);
  ctx.closePath();
  ctx.fillStyle = fin;
  ctx.fill();
  // Eye
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.15, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1200';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.55 + 1.2, -r * 0.15 - 1.2, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // === VISUAL POWER-UP INDICATORS ===
  // Shield active: pulsing blue protective bubble
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

  // Magnet active: enhanced orange magnetic glow + field
  if (state.magnetUntil > state.timeMs) {
    const magPulse = (Math.sin(state.timeMs * 0.009) + 1) / 2;
    ctx.save();
    ctx.shadowColor = '#ff6d00';
    ctx.shadowBlur = 32 + magPulse * 14;
    ctx.globalAlpha = 0.4 + magPulse * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, timeMs: number) {
  if (coin.collected) return;
  const bob = Math.sin(timeMs * 0.004 + coin.x) * 1.2;
  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
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
  ctx.font = `${coin.bonus ? 11 : 9}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(coin.bonus ? '+5' : '+1', 0, 0);
  ctx.restore();
}

function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, timeMs: number) {
  if (gem.collected) return;
  const bob = Math.sin(timeMs * 0.003 + gem.x) * 1.5;
  const pulse = (Math.sin(gem.pulse) + 1) / 2;
  const size = 12 + pulse * 1.4;
  ctx.save();
  ctx.translate(gem.x, gem.y + bob);
  ctx.shadowColor = '#7df9ff';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size, -2);
  ctx.lineTo(size * 0.55, size);
  ctx.lineTo(-size * 0.55, size);
  ctx.lineTo(-size, -2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-size, -size, size, size);
  grad.addColorStop(0, '#e8ffff');
  grad.addColorStop(0.45, '#7df9ff');
  grad.addColorStop(1, '#2176ff');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+♥', 0, 2);
  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, timeMs: number) {
  if (pu.collected) return;
  const bob = Math.sin(timeMs * 0.003 + pu.x) * 1.3;
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
  } else {
    ctx.shadowColor = '#ff6d00';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.ellipse(-2, -3, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2, 3, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-5, -7, 6, 14);
    ctx.fillStyle = '#ff6d00';
    ctx.fillRect(-4, -6, 4, 12);
  }
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
  for (const shark of state.sharks) drawShark(ctx, shark);
  for (const coin of state.coins) drawCoin(ctx, coin, state.timeMs);
  for (const gem of state.gems) drawGem(ctx, gem, state.timeMs);
  for (const pu of state.powerUps) drawPowerUp(ctx, pu, state.timeMs);
  for (const boost of state.bubbleBoosts) drawBubbleBoost(ctx, boost, state.timeMs);
  for (const chest of state.treasures) drawTreasure(ctx, chest, state.timeMs);
  const fishX = width * FISH_X_RATIO;
  const invincible = state.timeMs < state.invincibleUntil;
  drawFish(ctx, state, fishX, invincible);
  for (const particle of state.particles) drawParticle(ctx, particle);
  for (const ft of state.floatingTexts) drawFloatingText(ctx, ft);
  drawComboBadge(ctx, state);
  if (state.timeMs < state.hitFlashUntil) {
    const remain = (state.hitFlashUntil - state.timeMs) / 220;
    ctx.fillStyle = `rgba(255, 40, 40, ${0.22 * Math.max(0, remain)})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

export { FISH_X_RATIO };
