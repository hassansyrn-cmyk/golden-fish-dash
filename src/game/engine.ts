// -----------------------------------------------------------------------
// Core canvas game engine for Golden Fish Rush (Polished v1)
// Based on Claude's version + targeted visual & gameplay fixes
// - Fixed Shark direction (nose left, tail right)
// - Removed Near Miss completely
// - Removed black squares on pipes
// - Smoother drops movement
// - Gem changed to Heart shape
// - Magnet improved to U-shape
// - Better ocean background
// - Smoother player fish
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
}

export interface Shark {
  x: number;
  y: number;
  baseY: number;
  bobPhase: number;
  speedMult: number;
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
const BUBBLE_BOOST_MAGNET_MS = 5000;
const BUBBLE_BOOST_BONUS_COINS = 3;

export function createEngine(width: number, height: number, skin: SkinId): EngineState {
  const bubbles: Bubble[] = Array.from({ length: 20 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 2.8 + Math.random() * 7.5,
    speed: 0.28 + Math.random() * 0.85,
    drift: (Math.random() - 0.5) * 0.38,
  }));
  const distantFish: DistantFish[] = Array.from({ length: 6 }, () => ({
    x: Math.random() * width,
    y: height * 0.12 + Math.random() * height * 0.55,
    scale: 0.45 + Math.random() * 0.65,
    speed: 0.09 + Math.random() * 0.14,
    flip: Math.random() < 0.5,
  }));
  return {
    width, height, fishY: height / 2, fishVY: 0, fishRotation: 0, score: 0, running: true,
    invincibleUntil: 0, obstacles: [], coins: [], gems: [], powerUps: [], bubbles, particles: [],
    elapsedSinceSpawn: 999999, skin, shakeIntensity: 0, timeMs: 0, legendaryPulse: 0,
    lives: 0, maxLives: MAX_EXTRA_LIVES, shieldCharges: 0, magnetUntil: 0, gemBoostActive: false,
    sharks: [], bubbleBoosts: [], treasures: [], floatingTexts: [], distantFish,
    elapsedSinceSharkSpawn: 2800, elapsedSinceBubbleBoostSpawn: 4200, elapsedSinceTreasureSpawn: 6200,
    comboCount: 0, comboWindowEnd: 0, comboStage: 0, comboBadge: null, hitFlashUntil: 0,
  };
}

export function difficultyForScore(score: number) {
  const difficultyMultiplier = Math.min(1 + score / 600, 2.3);
  const speedSteps = Math.floor(score / 13);
  const speed = Math.min(BASE.maxSpeed, BASE.baseSpeed * 0.85 * difficultyMultiplier + speedSteps * 0.04);
  const gap = Math.max(BASE.minGap + 22, BASE.baseGap + 22 - (difficultyMultiplier - 1) * 72);
  const spawnInterval = Math.max(980, BASE.spawnInterval + 170 - (difficultyMultiplier - 1) * 410);
  const tier = getDifficultyTier(score);
  return { speed, gap, spawnInterval, tier, difficultyMultiplier };
}

export function jump(state: EngineState, settings: { vibration: boolean }) {
  if (!state.running) return;
  state.fishVY = BASE.jumpVelocity;
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: state.width * FISH_X_RATIO, y: state.fishY + BASE.fishRadius * 0.6,
      vx: (Math.random() - 0.5) * 2.3, vy: 1.05 + Math.random() * 1.55,
      life: 0, maxLife: 25 + Math.random() * 13, color: 'rgba(255,255,255,0.88)', size: 2.1 + Math.random() * 3.1,
    });
  }
  if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(11); } catch {}
  }
}

function clampGapY(state: EngineState, gapY: number, gapSize: number) {
  const safeMargin = Math.max(90, gapSize * 0.44);
  return Math.max(safeMargin, Math.min(state.height - safeMargin, gapY));
}

function spawnObstacle(state: EngineState, score: number) {
  const { gap } = difficultyForScore(score);
  const margin = Math.max(92, gap * 0.47);
  const rawGapY = margin + Math.random() * Math.max(1, state.height - margin * 2);
  const gapY = clampGapY(state, rawGapY, gap);
  const hardMode = score >= 34;
  const expertMode = score >= 68;
  const legendaryMode = score >= 118;
  const isDouble = expertMode && Math.random() < 0.095;

  state.obstacles.push({
    x: state.width + BASE.obstacleWidth,
    gapY,
    gapSize: gap,
    passed: false,
    bobbing: hardMode && Math.random() < 0.21,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmount: 11 + Math.random() * 9.5,
    glowing: legendaryMode,
    isDouble,
  });

  if (Math.random() < 0.66) {
    state.coins.push({
      x: state.width + BASE.obstacleWidth + 43,
      y: gapY + (Math.random() - 0.5) * (gap * 0.31),
      collected: false,
      bonus: score >= 58 && Math.random() < 0.21,
    });
  }

  const gemChance = state.gemBoostActive ? GEM_SPAWN_CHANCE * 1.75 : GEM_SPAWN_CHANCE;
  if (Math.random() < gemChance) {
    state.gems.push({
      x: state.width + BASE.obstacleWidth + 86,
      y: gapY + (Math.random() - 0.5) * (gap * 0.27),
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  if (Math.random() < 0.055) {
    const type: 'shield' | 'magnet' = Math.random() < 0.5 ? 'shield' : 'magnet';
    const puY = gapY + (Math.random() - 0.5) * (gap * 0.24);
    state.powerUps.push({
      x: state.width + BASE.obstacleWidth + 122,
      y: puY,
      type,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

function spawnShark(state: EngineState, difficultyMultiplier: number) {
  const margin = 68;
  const baseY = margin + Math.random() * Math.max(1, state.height - margin * 2);
  state.sharks.push({
    x: state.width + SHARK_RADIUS * 2.1,
    y: baseY,
    baseY,
    bobPhase: Math.random() * Math.PI * 2,
    speedMult: 1 + Math.random() * 0.32 + (difficultyMultiplier - 1) * 0.12,
  });
}

function spawnBubbleBoost(state: EngineState) {
  const margin = 88;
  state.bubbleBoosts.push({
    x: state.width + 32,
    y: margin + Math.random() * Math.max(1, state.height - margin * 2),
    collected: false,
    pulse: Math.random() * Math.PI * 2,
  });
}

function spawnTreasure(state: EngineState) {
  const margin = 88;
  state.treasures.push({
    x: state.width + 32,
    y: margin + Math.random() * Math.max(1, state.height - margin * 2),
    collected: false,
    pulse: Math.random() * Math.PI * 2,
    amount: Math.random() < 0.5 ? 10 : 18,
  });
}

function spawnFloatingText(state: EngineState, x: number, y: number, text: string, color: string) {
  state.floatingTexts.push({
    x, y, text, color,
    life: 0,
    maxLife: 620 + Math.random() * 80,
    vy: -1.85,
  });
  if (state.floatingTexts.length > 22) state.floatingTexts.shift();
}

function addBurst(state: EngineState, x: number, y: number, color: string, count: number, sizeBase = 2) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 3.5,
      vy: (Math.random() - 0.5) * 3.5,
      life: 0,
      maxLife: 21 + Math.random() * 11,
      color,
      size: sizeBase + Math.random() * 3.1,
    });
  }
}

function clearDangerousReviveArea(state: EngineState) {
  const fishX = state.width * FISH_X_RATIO;
  const safeLeft = fishX - BASE.obstacleWidth * 2.1;
  const safeRight = state.width + BASE.obstacleWidth * 1.3;

  state.obstacles = state.obstacles.filter(o => o.x + BASE.obstacleWidth / 2 < safeLeft || o.x - BASE.obstacleWidth / 2 > safeRight);
  state.coins = state.coins.filter(c => c.x < safeLeft || c.x > safeRight);
  state.gems = state.gems.filter(g => g.x < safeLeft || g.x > safeRight);
  state.powerUps = state.powerUps.filter(p => p.x < safeLeft || p.x > safeRight);
  state.sharks = state.sharks.filter(s => s.x < safeLeft || s.x > safeRight);
  state.bubbleBoosts = state.bubbleBoosts.filter(b => b.x < safeLeft || b.x > safeRight);
  state.treasures = state.treasures.filter(t => t.x < safeLeft || t.x > safeRight);
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
  callbacks.onShake(6.5);
  addBurst(state, state.width * FISH_X_RATIO, state.fishY, 'rgba(85, 225, 255, 0.92)', 23, 3);
  return true;
}

function killOrUseLife(state: EngineState, callbacks: EngineCallbacks) {
  state.hitFlashUntil = state.timeMs + 210;
  if (spendExtraLife(state, callbacks)) return;
  callbacks.onShake(13.5);
  callbacks.onDeath();
  state.running = false;
}

export function stepEngine(state: EngineState, dtMs: number, callbacks: EngineCallbacks, settings: { vibration: boolean }) {
  if (!state.running) return;

  const dt = Math.min(2.25, dtMs / 16.6);
  state.timeMs += dtMs;
  state.legendaryPulse = (state.legendaryPulse + dtMs * 0.0021) % (Math.PI * 2);

  state.fishVY = Math.min(BASE.maxFallSpeed, state.fishVY + BASE.gravity * dt);
  state.fishY += state.fishVY * dt;
  state.fishRotation = Math.max(-0.48, Math.min(0.88, state.fishVY * 0.057));

  const groundY = state.height - 7;
  const ceilingY = 7;
  const invincible = state.timeMs < state.invincibleUntil;

  if (state.fishY + BASE.fishRadius >= groundY || state.fishY - BASE.fishRadius <= ceilingY) {
    state.fishY = Math.max(ceilingY + BASE.fishRadius, Math.min(groundY - BASE.fishRadius, state.fishY));
    if (!invincible) {
      killOrUseLife(state, callbacks);
      return;
    }
    state.fishVY = 0;
  }

  const { speed, spawnInterval, difficultyMultiplier } = difficultyForScore(state.score);

  state.elapsedSinceSpawn += dtMs;
  if (state.elapsedSinceSpawn >= spawnInterval) {
    spawnObstacle(state, state.score);
    state.elapsedSinceSpawn = 0;
  }

  const fishX = state.width * FISH_X_RATIO;

  // === Obstacles ===
  for (const obs of state.obstacles) {
    obs.x -= speed * dt;
    if (obs.bobbing) {
      obs.bobPhase += dtMs * 0.002;
      obs.gapY += Math.sin(obs.bobPhase) * 1.15 * dt;
      obs.gapY = clampGapY(state, obs.gapY, obs.gapSize);
    }
    if (!obs.passed && obs.x + BASE.obstacleWidth / 2 < fishX) {
      obs.passed = true;
      state.score += 1;
      callbacks.onScore(state.score);
    }

    if (!invincible) {
      const withinX = fishX + BASE.fishRadius > obs.x - BASE.obstacleWidth / 2 &&
                      fishX - BASE.fishRadius < obs.x + BASE.obstacleWidth / 2;
      if (withinX) {
        const topGapEdge = obs.gapY - obs.gapSize / 2;
        const bottomGapEdge = obs.gapY + obs.gapSize / 2;
        let safe: boolean;
        if (obs.isDouble) {
          const secondTop = bottomGapEdge + 56;
          const secondBottom = secondTop + 50;
          safe = (state.fishY - BASE.fishRadius >= topGapEdge && state.fishY + BASE.fishRadius <= bottomGapEdge) ||
                 (state.fishY - BASE.fishRadius >= secondTop && state.fishY + BASE.fishRadius <= secondBottom);
        } else {
          safe = state.fishY - BASE.fishRadius >= topGapEdge && state.fishY + BASE.fishRadius <= bottomGapEdge;
        }

        if (!safe) {
          if (state.shieldCharges > 0) {
            state.shieldCharges = Math.max(0, state.shieldCharges - 1);
            state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
            callbacks.onShake(7);
            addBurst(state, fishX, state.fishY, 'rgba(100, 215, 255, 0.92)', 17, 3);
            spawnFloatingText(state, fishX + 28, state.fishY - 28, 'Shield Block!', '#67e8f9');
          } else {
            killOrUseLife(state, callbacks);
            return;
          }
        }
      }
    }
  }
  state.obstacles = state.obstacles.filter(o => o.x > -BASE.obstacleWidth * 2);

  // === Coins + Combo ===
  for (const coin of state.coins) {
    coin.x -= speed * dt;
    if (!coin.collected) {
      const dx = coin.x - fishX;
      const dy = coin.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 12.5) {
        coin.collected = true;
        const amount = coin.bonus ? 5 : 1;
        state.score += amount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(amount);
        addBurst(state, coin.x, coin.y, coin.bonus ? '#ff9500' : '#fde047', 12, 2);
        spawnFloatingText(state, coin.x, coin.y - 17, coin.bonus ? '+5' : '+1', coin.bonus ? '#fbbf24' : '#fef08c');

        // Combo
        if (state.timeMs <= state.comboWindowEnd) {
          state.comboCount += 1;
        } else {
          state.comboCount = 1;
        }
        state.comboWindowEnd = state.timeMs + COMBO_WINDOW_MS;

        if (state.comboCount === COMBO_STAGE_2_COUNT) {
          state.score += 2;
          callbacks.onScore(state.score);
          spawnFloatingText(state, coin.x, coin.y - 32, 'Combo x2', '#fbbf24');
          state.comboBadge = { text: 'Combo x2', until: state.timeMs + 850 };
        } else if (state.comboCount >= COMBO_STAGE_3_COUNT) {
          state.score += 3;
          callbacks.onScore(state.score);
          spawnFloatingText(state, coin.x, coin.y - 32, 'Combo x3', '#f59e0b');
          state.comboBadge = { text: 'Combo x3', until: state.timeMs + 850 };
          state.comboCount = 0;
        }
      }
    }
  }

  if (state.comboCount > 0 && state.timeMs > state.comboWindowEnd) {
    state.comboCount = 0;
  }

  // Magnet pull
  if (state.magnetUntil > state.timeMs) {
    const fishXMag = state.width * FISH_X_RATIO;
    const fishYMag = state.fishY;
    for (const coin of state.coins) {
      if (!coin.collected) {
        const dx = coin.x - fishXMag;
        const dy = coin.y - fishYMag;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 4 && dist < 128) {
          const pull = 0.23 * dt;
          coin.x -= dx * pull;
          coin.y -= dy * pull;
        }
      }
    }
  }
  state.coins = state.coins.filter(c => c.x > -42 && !c.collected);

  // === Gems (now Heart) ===
  for (const gem of state.gems) {
    gem.x -= speed * dt;
    gem.pulse += dtMs * 0.0044;
    if (!gem.collected) {
      const dx = gem.x - fishX;
      const dy = gem.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 15) {
        gem.collected = true;
        if (state.lives < state.maxLives) {
          state.lives += 1;
          callbacks.onGemCollect?.(state.lives);
          callbacks.onLifeChange?.(state.lives);
          spawnFloatingText(state, gem.x, gem.y - 18, '+Life', '#f472b6');
        } else {
          state.score += 5;
          callbacks.onScore(state.score);
          spawnFloatingText(state, gem.x, gem.y - 18, '+5', '#f472b6');
        }
        callbacks.onShake(5);
        addBurst(state, gem.x, gem.y, '#f472b6', 23, 3);
      }
    }
  }
  state.gems = state.gems.filter(g => g.x > -52 && !g.collected);

  // Power-ups
  for (const pu of state.powerUps) {
    pu.x -= speed * dt;
    if (!pu.collected) {
      const dx = pu.x - fishX;
      const dy = pu.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 17) {
        pu.collected = true;
        if (pu.type === 'shield') {
          state.shieldCharges = Math.min(3, state.shieldCharges + 1);
          callbacks.onShake?.(4);
          addBurst(state, pu.x, pu.y, 'rgba(103, 232, 249, 0.9)', 20, 3);
          spawnFloatingText(state, pu.x, pu.y - 20, 'Shield', '#67e8f9');
        } else if (pu.type === 'magnet') {
          state.magnetUntil = state.timeMs + 7800;
          addBurst(state, pu.x, pu.y, 'rgba(251, 146, 60, 0.9)', 18, 3);
          spawnFloatingText(state, pu.x, pu.y - 20, 'Magnet', '#fb923c');
        }
      }
    }
  }
  state.powerUps = state.powerUps.filter(p => p.x > -62 && !p.collected);

  // === Shark ===
  const sharkInterval = Math.max(3800, 6800 - (difficultyMultiplier - 1) * 2200);
  state.elapsedSinceSharkSpawn += dtMs;
  if (state.score >= 7 && state.elapsedSinceSharkSpawn > sharkInterval) {
    state.elapsedSinceSharkSpawn = 0;
    if (Math.random() < 0.82) spawnShark(state, difficultyMultiplier);
  }

  const sharkSpeed = speed * (1.08 + (difficultyMultiplier - 1) * 0.18);
  for (const shark of state.sharks) {
    shark.x -= sharkSpeed * shark.speedMult * dt;
    shark.bobPhase += dtMs * 0.0021;
    shark.y = shark.baseY + Math.sin(shark.bobPhase) * 15;

    if (!invincible) {
      const dx = shark.x - fishX;
      const dy = shark.y - state.fishY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BASE.fishRadius + SHARK_RADIUS * 0.7) {
        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;
          callbacks.onShake(7);
          addBurst(state, fishX, state.fishY, 'rgba(103, 232, 249, 0.92)', 17, 3);
          spawnFloatingText(state, fishX, state.fishY - 28, 'Shield Block!', '#67e8f9');
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.sharks = state.sharks.filter(s => s.x > -SHARK_RADIUS * 3);

  // === Bubble Boost ===
  state.elapsedSinceBubbleBoostSpawn += dtMs;
  if (state.elapsedSinceBubbleBoostSpawn > 8800 && Math.random() < 0.38) {
    state.elapsedSinceBubbleBoostSpawn = 0;
    spawnBubbleBoost(state);
  }
  for (const boost of state.bubbleBoosts) {
    boost.x -= speed * dt;
    boost.pulse += dtMs * 0.0038;
    if (!boost.collected) {
      const dx = boost.x - fishX;
      const dy = boost.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 19) {
        boost.collected = true;
        state.magnetUntil = Math.max(state.magnetUntil, state.timeMs + BUBBLE_BOOST_MAGNET_MS);
        callbacks.onCoinCollect(BUBBLE_BOOST_BONUS_COINS);
        callbacks.onShake(4);
        addBurst(state, boost.x, boost.y, 'rgba(180, 240, 255, 0.88)', 19, 3);
        spawnFloatingText(state, boost.x, boost.y - 17, 'Boost!', '#a5f3fc');
      }
    }
  }
  state.bubbleBoosts = state.bubbleBoosts.filter(b => b.x > -52 && !b.collected);

  // === Treasure ===
  state.elapsedSinceTreasureSpawn += dtMs;
  if (state.elapsedSinceTreasureSpawn > 15500 && Math.random() < 0.28) {
    state.elapsedSinceTreasureSpawn = 0;
    spawnTreasure(state);
  }
  for (const chest of state.treasures) {
    chest.x -= speed * dt;
    chest.pulse += dtMs * 0.0032;
    if (!chest.collected) {
      const dx = chest.x - fishX;
      const dy = chest.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 17) {
        chest.collected = true;
        state.score += chest.amount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(chest.amount);
        callbacks.onShake(5);
        addBurst(state, chest.x, chest.y, '#fcd34d', 25, 3);
        spawnFloatingText(state, chest.x, chest.y - 17, `Treasure +${chest.amount}`, '#fde047');
      }
    }
  }
  state.treasures = state.treasures.filter(t => t.x > -52 && !t.collected);

  // Floating texts
  for (const ft of state.floatingTexts) {
    ft.life += dt;
    ft.y += ft.vy * dt;
    ft.vy *= 0.982;
  }
  state.floatingTexts = state.floatingTexts.filter(ft => ft.life < ft.maxLife);

  if (state.comboBadge && state.timeMs > state.comboBadge.until) {
    state.comboBadge = null;
  }

  // Distant fish (decorative)
  for (const df of state.distantFish) {
    df.x -= df.speed * speed * dt;
    if (df.x < -45) {
      df.x = state.width + 45;
      df.y = state.height * 0.13 + Math.random() * state.height * 0.52;
    }
  }

  // Bubbles
  for (const b of state.bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(state.timeMs * 0.001 + b.x) * b.drift * dt;
    if (b.y < -22) {
      b.y = state.height + 12;
      b.x = Math.random() * state.width;
    }
  }

  // Particles
  for (const p of state.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.048 * dt;
  }
  state.particles = state.particles.filter(p => p.life < p.maxLife);

  state.shakeIntensity = Math.max(0, state.shakeIntensity - dtMs * 0.048);
  void settings;
}

// ==================== DRAWING ====================

function drawBackground(ctx: CanvasRenderingContext2D, state: EngineState) {
  const { width, height } = state;
  const tier = getDifficultyTier(state.score);

  // Beautiful ocean gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0a3d62');
  grad.addColorStop(0.28, '#0c5a7a');
  grad.addColorStop(0.55, '#0a4d6b');
  grad.addColorStop(0.82, '#083d58');
  grad.addColorStop(1, '#052c42');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft light rays from top
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 5; i++) {
    const x = width * (0.12 + i * 0.17);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 28, height * 0.65);
    ctx.lineTo(x + 42, height * 0.65);
    ctx.lineTo(x + 18, 0);
    ctx.closePath();
    ctx.fillStyle = '#7dd3fc';
    ctx.fill();
  }
  ctx.restore();

  // Distant silhouettes (rocks / hills)
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#052c42';
  for (let i = 0; i < 3; i++) {
    const bx = width * (0.22 + i * 0.28);
    ctx.beginPath();
    ctx.moveTo(bx, height);
    ctx.quadraticCurveTo(bx + 75, height - 48, bx + 155, height);
    ctx.fill();
  }
  ctx.restore();

  // Bubbles
  ctx.save();
  for (const b of state.bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.23)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.restore();

  // Bottom seaweed & corals
  ctx.save();
  ctx.globalAlpha = 0.52;
  ctx.fillStyle = '#0f766e';
  for (let i = 0; i < 8; i++) {
    const sx = (width / 8) * i + 12;
    const h = 36 + ((i * 19) % 38);
    ctx.beginPath();
    ctx.moveTo(sx, height);
    ctx.quadraticCurveTo(sx - 11, height - h * 0.55, sx + 7, height - h);
    ctx.quadraticCurveTo(sx + 19, height - h * 0.52, sx + 12, height);
    ctx.fill();

    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(sx + 5, height - h * 0.32, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#134e4a';
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, height - 6, width, 6);
  ctx.fillRect(0, 0, width, 5);
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, height: number) {
  const topGapEdge = obs.gapY - obs.gapSize / 2;
  const bottomGapEdge = obs.gapY + obs.gapSize / 2;
  const w = BASE.obstacleWidth;
  const x = obs.x - w / 2;

  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  if (obs.glowing) {
    grad.addColorStop(0, '#fef08c');
    grad.addColorStop(0.5, '#fcd34d');
    grad.addColorStop(1, '#f59e0b');
  } else {
    grad.addColorStop(0, '#14b8a6');
    grad.addColorStop(0.48, '#0f766e');
    grad.addColorStop(1, '#134e4a');
  }

  ctx.save();
  ctx.shadowColor = obs.glowing ? '#fef08c' : 'rgba(15, 23, 42, 0.45)';
  ctx.shadowBlur = obs.glowing ? 24 : 10;
  ctx.shadowOffsetX = obs.glowing ? 0 : 1.5;
  ctx.fillStyle = grad;
  ctx.fillRect(x, 0, w, topGapEdge);
  ctx.fillRect(x, bottomGapEdge, w, height - bottomGapEdge);
  ctx.restore();

  // Clean rounded lips
  const lipR = 8;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x - 5, topGapEdge - 15, w + 10, 15, lipR);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 5, bottomGapEdge, w + 10, 15, lipR);
  ctx.fill();

  if (obs.isDouble) {
    const secondTop = bottomGapEdge + 55;
    const secondBottom = secondTop + 48;
    ctx.clearRect(x - 5, secondTop, w + 10, secondBottom - secondTop);
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.roundRect(x - 5, secondBottom, w + 10, 7, 3);
    ctx.fill();
  }
}

// Fixed Shark - nose points left (moving left), tail on right
function drawShark(ctx: CanvasRenderingContext2D, shark: Shark) {
  const r = SHARK_RADIUS;
  ctx.save();
  ctx.translate(shark.x, shark.y);

  // Body - nose on left side
  ctx.beginPath();
  ctx.moveTo(-r * 1.55, 0);
  ctx.quadraticCurveTo(-r * 1.05, -r * 0.52, -r * 0.05, -r * 0.48);
  ctx.quadraticCurveTo(r * 0.95, -r * 0.38, r * 1.4, -r * 0.05);
  ctx.quadraticCurveTo(r * 0.95, r * 0.38, -r * 0.05, r * 0.48);
  ctx.quadraticCurveTo(-r * 1.05, r * 0.52, -r * 1.55, 0);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(-r * 1.55, -r * 0.5, r * 1.4, r * 0.5);
  bodyGrad.addColorStop(0, '#64748b');
  bodyGrad.addColorStop(0.48, '#475569');
  bodyGrad.addColorStop(1, '#334155');
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.5)';
  ctx.shadowBlur = 9;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Belly
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, r * 0.26, r * 0.82, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e0e7ff';
  ctx.globalAlpha = 0.82;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Tail (right side)
  ctx.beginPath();
  ctx.moveTo(-r * 1.48, 0);
  ctx.lineTo(-r * 2.2, -r * 0.52);
  ctx.lineTo(-r * 1.78, 0);
  ctx.lineTo(-r * 2.2, r * 0.52);
  ctx.closePath();
  ctx.fillStyle = '#475569';
  ctx.fill();

  // Dorsal fin
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.45);
  ctx.lineTo(r * 0.15, -r * 1.12);
  ctx.lineTo(r * 0.55, -r * 0.38);
  ctx.closePath();
  ctx.fillStyle = '#334155';
  ctx.fill();

  // Eye (near nose/left)
  ctx.beginPath();
  ctx.arc(-r * 1.0, -r * 0.1, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.95, -r * 0.12, 1.0, 0, Math.PI * 2);
  ctx.fillStyle = '#f87171';
  ctx.fill();

  // Simple mouth
  ctx.strokeStyle = '#1e2937';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-r * 1.45, r * 0.06);
  ctx.quadraticCurveTo(-r * 1.15, r * 0.22, -r * 0.82, r * 0.08);
  ctx.stroke();

  ctx.restore();
}

function drawBubbleBoost(ctx: CanvasRenderingContext2D, boost: BubbleBoost, timeMs: number) {
  if (boost.collected) return;
  const pulse = (Math.sin(boost.pulse) + 1) / 2;
  const r = 14.5 + pulse * 2.8;

  ctx.save();
  ctx.translate(boost.x, boost.y + Math.sin(timeMs * 0.0032 + boost.x) * 1.8);

  ctx.globalAlpha = 0.25 + pulse * 0.18;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#bae6fd';
  ctx.fill();

  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.28, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  ctx.restore();
}

function drawTreasure(ctx: CanvasRenderingContext2D, chest: Treasure, timeMs: number) {
  if (chest.collected) return;
  const bob = Math.sin(timeMs * 0.0026 + chest.x) * 1.6;
  const glow = (Math.sin(chest.pulse) + 1) / 2;

  ctx.save();
  ctx.translate(chest.x, chest.y + bob);
  ctx.shadowColor = '#fcd34d';
  ctx.shadowBlur = 11 + glow * 5;

  ctx.fillStyle = '#854d0e';
  ctx.beginPath();
  ctx.roundRect(-12, -3, 24, 13, 3);
  ctx.fill();

  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.moveTo(-12, -3);
  ctx.quadraticCurveTo(0, -14, 12, -3);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fde047';
  ctx.fillRect(-2, -12, 4, 22);

  ctx.beginPath();
  ctx.arc(0, -1, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = '#fef08c';
  ctx.fill();

  ctx.restore();
}

function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const progress = ft.life / ft.maxLife;
  const alpha = Math.max(0.15, 1 - progress * 0.82);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 14.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ft.color;
  ctx.fillText(ft.text, ft.x, ft.y);
  ctx.restore();
}

function drawComboBadge(ctx: CanvasRenderingContext2D, state: EngineState) {
  if (!state.comboBadge) return;
  const remain = Math.max(0, state.comboBadge.until - state.timeMs);
  const alpha = Math.min(1, remain / 280);

  ctx.save();
  ctx.globalAlpha = alpha;
  const cx = state.width / 2;
  const cy = 102;

  ctx.font = 'bold 15.5px system-ui, sans-serif';
  const textWidth = ctx.measureText(state.comboBadge.text).width;
  const pad = 13;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
  ctx.beginPath();
  ctx.roundRect(cx - textWidth / 2 - pad, cy - 14, textWidth + pad * 2, 28, 14);
  ctx.fill();

  ctx.fillStyle = '#fde047';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.comboBadge.text, cx, cy);
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
    ctx.globalAlpha = 0.26 + pulse * 0.18;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.85, r * 1.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = id === 'legendary' ? 26 : id === 'diamond' ? 20 : 14;

  // Tail
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.quadraticCurveTo(-r * 1.5, -r * 1.1, -r * 2.1, -r * 0.32);
  ctx.quadraticCurveTo(-r * 1.72, 0, -r * 2.1, r * 0.32);
  ctx.quadraticCurveTo(-r * 1.5, r * 1.1, -r * 0.8, 0);
  ctx.closePath();
  ctx.fillStyle = fin;
  ctx.fill();

  // Body with better gradient
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, 0);
  ctx.quadraticCurveTo(-r * 0.48, -r * 0.88, r * 0.18, -r * 0.8);
  ctx.quadraticCurveTo(r * 0.92, -r * 0.42, r * 0.98, 0);
  ctx.quadraticCurveTo(r * 0.92, r * 0.42, r * 0.18, r * 0.8);
  ctx.quadraticCurveTo(-r * 0.48, r * 0.88, -r * 0.85, 0);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(-r * 0.9, -r * 0.8, r * 0.95, r * 0.8);
  bodyGrad.addColorStop(0, belly);
  bodyGrad.addColorStop(0.42, body);
  bodyGrad.addColorStop(1, fin);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Belly highlight
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.25, r * 0.48, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fillStyle = belly;
  ctx.globalAlpha = 0.78;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Eye
  ctx.beginPath();
  ctx.arc(r * 0.52, -r * 0.11, 3.7, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1200';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.13, 1.3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Shield
  if (state.shieldCharges > 0) {
    const shieldPulse = (Math.sin(state.legendaryPulse * 1.7) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.2 + shieldPulse * 0.17;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.58, 0, Math.PI * 2);
    ctx.fillStyle = '#67e8f9';
    ctx.fill();
    ctx.globalAlpha = 0.58 + shieldPulse * 0.22;
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 3.1 + shieldPulse * 1.0;
    ctx.stroke();
    ctx.restore();
  }

  // Magnet
  if (state.magnetUntil > state.timeMs) {
    const magPulse = (Math.sin(state.timeMs * 0.008) + 1) / 2;
    ctx.save();
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 26 + magPulse * 11;
    ctx.globalAlpha = 0.32 + magPulse * 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.38, 0, Math.PI * 2);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2.1;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, timeMs: number) {
  if (coin.collected) return;
  const bob = Math.sin(timeMs * 0.0036 + coin.x) * 1.05;
  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
  ctx.beginPath();
  ctx.arc(0, 0, coin.bonus ? 11 : 9, 0, Math.PI * 2);
  ctx.fillStyle = coin.bonus ? '#fbbf24' : '#fde047';
  ctx.shadowColor = coin.bonus ? '#f59e0b' : '#fef08c';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = '#854d0e';
  ctx.font = `${coin.bonus ? 9.5 : 8}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(coin.bonus ? '+5' : '+1', 0, 0);
  ctx.restore();
}

// Changed to Heart shape for lives
function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, timeMs: number) {
  if (gem.collected) return;
  const bob = Math.sin(timeMs * 0.0027 + gem.x) * 1.3;
  const pulse = (Math.sin(gem.pulse) + 1) / 2;
  const s = 11 + pulse * 1.2;

  ctx.save();
  ctx.translate(gem.x, gem.y + bob);
  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 15;

  // Heart shape
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 0.9, -s * 0.3, -s * 0.9, -s * 0.85, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.9, -s * 0.85, s * 0.9, -s * 0.3, 0, s * 0.35);
  ctx.closePath();

  ctx.fillStyle = '#f472b6';
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fda4af';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+♥', 0, 2);
  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, timeMs: number) {
  if (pu.collected) return;
  const bob = Math.sin(timeMs * 0.0024 + pu.x) * 1.15;

  ctx.save();
  ctx.translate(pu.x, pu.y + bob);

  if (pu.type === 'shield') {
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 9.2, 0, Math.PI * 2);
    ctx.fillStyle = '#67e8f9';
    ctx.fill();
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11.5px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', 0, 0);
  } else {
    // Improved Magnet (U-shape)
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fb923c';

    // U shape
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.lineTo(-7, 6);
    ctx.quadraticCurveTo(0, 9, 7, 6);
    ctx.lineTo(7, -6);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#fb923c';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -7, 6, 3);
    ctx.fillRect(-3, 4, 6, 3);
  }
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  const alpha = 1 - particle.life / particle.maxLife;
  ctx.save();
  ctx.globalAlpha = Math.max(0.12, alpha);
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

  if (state.shakeIntensity > 0.12) {
    const dx = (Math.random() - 0.5) * state.shakeIntensity * 0.7;
    const dy = (Math.random() - 0.5) * state.shakeIntensity * 0.7;
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
    const remain = (state.hitFlashUntil - state.timeMs) / 210;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.18 * Math.max(0, remain)})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

export { FISH_X_RATIO };
