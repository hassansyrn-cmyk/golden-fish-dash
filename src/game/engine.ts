// -----------------------------------------------------------------------
// Core simulation for Golden Fish Rush: spawning, physics, collisions,
// scoring, and all gameplay state transitions (stepEngine). No canvas
// drawing lives here — see render.ts for that. Entity shapes and tuning
// constants live in entities.ts.
//
// Power-ups: Shield (protects one hit + invincibility) and Magnet (pulls nearby coins)
// Gem improvement: full lives -> +5 score
// Shop boosts supported: initial shield/magnet/gemBoostActive
// Visual feedback: Shield bubble + Magnet glow added
// -----------------------------------------------------------------------

import { BASE, getDifficultyTier } from './constants';
import type { SkinId } from './types';
import {
  FISH_X_RATIO,
  MAX_EXTRA_LIVES,
  GEM_SPAWN_CHANCE,
  HIT_INVINCIBILITY_MS,
  SAFE_REVIVE_DELAY_MS,
  SHARK_RADIUS,
  COMBO_WINDOW_MS,
  COMBO_STAGE_2_COUNT,
  COMBO_STAGE_3_COUNT,
  COMBO_STAGE_4_COUNT,
  NEAR_MISS_MARGIN,
  BUBBLE_BOOST_MAGNET_MS,
  BUBBLE_BOOST_BONUS_COINS,
} from './entities';
import type {
  Bubble,
  Particle,
  FloatingText,
  DistantFish,
  EngineCallbacks,
  EngineState,
} from './entities';

export type {
  Obstacle,
  Shark,
  BubbleBoost,
  Treasure,
  FloatingText,
  DistantFish,
  Coin,
  Gem,
  PowerUp,
  Bubble,
  Particle,
  EngineCallbacks,
  EngineState,
} from './entities';
export { FISH_X_RATIO } from './entities';
export { renderEngine } from './render';

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

// PERF: stepEngine runs every animation frame and used to do
// `state.xs = state.xs.filter(predicate)` for ~9 arrays every single frame,
// each call allocating a brand new array even when nothing needed removing.
// On mid-range Android that's steady, avoidable GC pressure. pruneInPlace
// does the same "keep items matching predicate" job by compacting the
// array in place (single pass, no allocation), so hot-path cleanup below
// no longer creates garbage every frame. Behavior/order is unchanged.
function pruneInPlace<T>(arr: T[], keep: (item: T) => boolean) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (keep(arr[read])) {
      if (write !== read) arr[write] = arr[read];
      write++;
    }
  }
  arr.length = write;
}

// Same compaction as pruneInPlace, but returns removed items to a pool's
// free list for reuse instead of letting them become garbage.
function pruneAndRecycle<T>(arr: T[], pool: T[], keep: (item: T) => boolean) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    const item = arr[read];
    if (keep(item)) {
      if (write !== read) arr[write] = item;
      write++;
    } else {
      pool.push(item);
    }
  }
  arr.length = write;
}

function spawnFloatingText(state: EngineState, x: number, y: number, text: string, color: string) {
  const ft = acquireFloatingText();
  ft.x = x;
  ft.y = y;
  ft.text = text;
  ft.color = color;
  ft.life = 0;
  ft.maxLife = 34 + Math.random() * 12;
  ft.vy = -0.55;
  state.floatingTexts.push(ft);
  // Keep the list bounded so a busy screen never accumulates unbounded work.
  if (state.floatingTexts.length > 24) {
    const dropped = state.floatingTexts.shift();
    if (dropped) floatingTextPool.push(dropped);
  }
}

// PERF: particle bursts are the highest-churn allocation in the game —
// every coin/gem/hit/shield-block event spawns 12-24 new particle objects,
// and previously the dead ones were simply dropped for the GC to collect.
// This free-list pool reuses the same objects: acquireParticle() pops a
// recycled object (or allocates once if the pool is empty), and
// releaseParticle() returns dead particles to the pool instead of
// discarding them. Net effect: steady-state particle churn allocates ~0
// new objects after the pool warms up.
const particlePool: Particle[] = [];

function acquireParticle(): Particle {
  return particlePool.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '', size: 0 };
}

function addBurst(state: EngineState, x: number, y: number, color: string, count: number, sizeBase = 2) {
  for (let i = 0; i < count; i++) {
    const p = acquireParticle();
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 3.6;
    p.vy = (Math.random() - 0.5) * 3.6;
    p.life = 0;
    p.maxLife = 22 + Math.random() * 12;
    p.color = color;
    p.size = sizeBase + Math.random() * 3;
    state.particles.push(p);
  }
}

// Same pooling idea for floating texts (lower churn than particles, but
// free to reuse with the same pattern).
const floatingTextPool: FloatingText[] = [];

function acquireFloatingText(): FloatingText {
  return floatingTextPool.pop() ?? { x: 0, y: 0, text: '', color: '', life: 0, maxLife: 0, vy: 0 };
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
  pruneInPlace(state.obstacles, (o) => o.x > -BASE.obstacleWidth * 2);
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
        // the streak. 3 coins -> Combo x2, 6 coins -> Combo x3, 10 coins -> Combo
        // x4 (the streak then resets, capping the max tier). Bonuses stay small
        // so they never meaningfully inflate the coin economy.
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
        } else if (state.comboCount === COMBO_STAGE_3_COUNT) {
          const bonus = 3;
          state.score += bonus;
          callbacks.onScore(state.score);
          callbacks.onCoinCollect(bonus);
          spawnFloatingText(state, coin.x, coin.y - 34, 'Combo x3', '#ff9500');
          state.comboBadge = { text: 'Combo x3', until: state.timeMs + 900 };
        } else if (state.comboCount >= COMBO_STAGE_4_COUNT) {
          const bonus = 5;
          state.score += bonus;
          callbacks.onScore(state.score);
          callbacks.onCoinCollect(bonus);
          spawnFloatingText(state, coin.x, coin.y - 34, 'Combo x4!', '#ff5c5c');
          state.comboBadge = { text: 'Combo x4!', until: state.timeMs + 1100 };
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
  pruneInPlace(state.coins, (c) => c.x > -40 && !c.collected);
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
          spawnFloatingText(state, gem.x, gem.y - 16, '+Life', '#ff7d9a');
        } else {
          state.score += 5;
          callbacks.onScore(state.score);
          spawnFloatingText(state, gem.x, gem.y - 16, '+Gem', '#ff7d9a');
        }
        addBurst(state, gem.x, gem.y, '#ff7d9a', 22, 3);
      }
    }
  }
  pruneInPlace(state.gems, (g) => g.x > -50 && !g.collected);
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
  pruneInPlace(state.powerUps, (p) => p.x > -60 && !p.collected);

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
  pruneInPlace(state.sharks, (s) => s.x > -SHARK_RADIUS * 3);

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
        addBurst(state, boost.x, boost.y, 'rgba(180, 240, 255, 0.9)', 18, 3);
        spawnFloatingText(state, boost.x, boost.y - 18, 'Boost!', '#b4f0ff');
      }
    }
  }
  pruneInPlace(state.bubbleBoosts, (b) => b.x > -50 && !b.collected);

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
        addBurst(state, chest.x, chest.y, '#ffd60a', 24, 3);
        spawnFloatingText(state, chest.x, chest.y - 18, `Treasure +${chest.amount}`, '#ffd60a');
      }
    }
  }
  pruneInPlace(state.treasures, (t) => t.x > -50 && !t.collected);

  // --- Floating text + combo badge lifecycle ---
  for (const ft of state.floatingTexts) {
    ft.life += dt;
    ft.y += ft.vy * dt;
  }
  pruneAndRecycle(state.floatingTexts, floatingTextPool, (ft) => ft.life < ft.maxLife);
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
  pruneAndRecycle(state.particles, particlePool, (p) => p.life < p.maxLife);
  state.shakeIntensity = Math.max(0, state.shakeIntensity - dtMs * 0.05);
  void settings;
}

