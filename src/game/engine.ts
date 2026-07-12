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
  luckyCatchActive: boolean; // Phase 8: Golden fish ability
}

const FISH_X_RATIO = 0.28;
const MAX_EXTRA_LIVES = 2;
const GEM_SPAWN_CHANCE = 0.09;
const HIT_INVINCIBILITY_MS = 1700;
const SAFE_REVIVE_DELAY_MS = 900;

export function createEngine(width: number, height: number, skin: SkinId): EngineState {
  const bubbles: Bubble[] = Array.from({ length: 18 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 3 + Math.random() * 7,
    speed: 0.3 + Math.random() * 0.9,
    drift: (Math.random() - 0.5) * 0.4,
  }));
  return {
    width, height, fishY: height / 2, fishVY: 0, fishRotation: 0, score: 0, running: true,
    invincibleUntil: 0, obstacles: [], coins: [], gems: [], powerUps: [], bubbles, particles: [],
    elapsedSinceSpawn: 999999, skin, shakeIntensity: 0, timeMs: 0, legendaryPulse: 0,
    lives: 0, maxLives: MAX_EXTRA_LIVES, shieldCharges: 0, magnetUntil: 0, gemBoostActive: false,
    luckyCatchActive: false,
  };
}

export function difficultyForScore(score: number) {
  const speedSteps = Math.floor(score / 12);
  const speed = Math.min(BASE.maxSpeed * 0.9, BASE.baseSpeed * 0.86 + speedSteps * 0.22);
  const gap = Math.max(BASE.minGap + 24, BASE.baseGap + 24 - speedSteps * 4);
  const spawnInterval = Math.max(1080, BASE.spawnInterval + 180 - speedSteps * 38);
  const tier = getDifficultyTier(score);
  return { speed, gap, spawnInterval, tier };
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
  });

  // Base coin spawn chance
  let coinChance = 0.68;

  // === Phase 8: Lucky Catch ability (Golden fish) ===
  if (state.luckyCatchActive) {
    coinChance = 0.82; // Significantly higher chance for coins
  }

  if (Math.random() < coinChance) {
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
  const { speed, spawnInterval } = difficultyForScore(state.score);
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

        // === Phase 7: Progressive coin value ===
        let baseAmount = coin.bonus ? 5 : 1;
        let multiplier = 1;
        if (state.score >= 200) multiplier = 1.5;
        else if (state.score >= 100) multiplier = 1.25;

        const amount = Math.floor(baseAmount * multiplier);

        state.score += amount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(amount);
        addBurst(state, coin.x, coin.y, coin.bonus ? '#ff9500' : '#ffd60a', 12, 2);
      }
    }
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
        } else {
          state.score += 5;
          callbacks.onScore(state.score);
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

  // === Phase 7: Distant fish shadows (subtle background life) ===
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const x = ((state.timeMs * 0.008 + i * 180) % (width + 120)) - 60;
    const y = 80 + (i % 3) * 95;
    const size = 18 + (i % 4) * 6;

    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.quadraticCurveTo(x - size * 1.6, y - size * 0.4, x - size * 2.1, y);
    ctx.quadraticCurveTo(x - size * 1.6, y + size * 0.4, x - size, y);
    ctx.fill();
  }
  ctx.restore();

  // === Phase 7: Seaweed at the bottom ===
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#0a4d3c';
  for (let i = 0; i < 9; i++) {
    const baseX = (width / 9) * i + 15;
    const sway = Math.sin(state.timeMs * 0.0015 + i) * 8;

    ctx.beginPath();
    ctx.moveTo(baseX, height);
    ctx.quadraticCurveTo(baseX + sway * 0.6, height - 55, baseX - sway * 0.4, height - 95);
    ctx.quadraticCurveTo(baseX + sway, height - 130, baseX - sway * 0.7, height - 165);
    ctx.lineTo(baseX - 4, height);
    ctx.closePath();
    ctx.fill();

    // Second smaller seaweed next to it
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(baseX + 18, height);
      ctx.quadraticCurveTo(baseX + 22 + sway * 0.5, height - 40, baseX + 14, height - 75);
      ctx.lineTo(baseX + 14, height);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

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
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, height - 8, width, 8);
  ctx.fillRect(0, 0, width, 8);
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, height: number, score: number) {
  const topGapEdge = obs.gapY - obs.gapSize / 2;
  const bottomGapEdge = obs.gapY + obs.gapSize / 2;
  const w = BASE.obstacleWidth;
  const x = obs.x - w / 2;

  // === Phase 7: Progressive luxurious pipe design ===
  let colorTop, colorBottom, glowColor, accentColor;

  if (score >= 200) {
    // Luxurious tier (200+)
    colorTop = '#c9a227';
    colorBottom = '#8b5e00';
    glowColor = '#ffe066';
    accentColor = '#ffeb3b';
  } else if (score >= 100) {
    // Mid tier (100-199)
    colorTop = '#e07b39';
    colorBottom = '#b85c2e';
    glowColor = '#ffb74d';
    accentColor = '#ffcc80';
  } else {
    // Early game (0-99)
    colorTop = '#2a9d8f';
    colorBottom = '#1d7870';
    glowColor = '#4dd0e1';
    accentColor = '#80deea';
  }

  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);

  ctx.fillStyle = grad;

  if (obs.glowing || score >= 200) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = score >= 200 ? 28 : 18;
  }

  ctx.fillRect(x, 0, w, topGapEdge);
  ctx.fillRect(x - 6, topGapEdge - 18, w + 12, 18);
  ctx.fillRect(x, bottomGapEdge, w, height - bottomGapEdge);
  ctx.fillRect(x - 6, bottomGapEdge, w + 12, 18);

  if (obs.glowing || score >= 200) ctx.restore();

  // Accent line for luxury feel
  if (score >= 100) {
    ctx.fillStyle = accentColor;
    ctx.fillRect(x + 4, topGapEdge - 8, w - 8, 4);
    ctx.fillRect(x + 4, bottomGapEdge + 4, w - 8, 4);
  }

  if (obs.isDouble) {
    const secondTop = bottomGapEdge + 58;
    const secondBottom = secondTop + 52;

    // Fixed: Draw gap properly instead of clearRect (prevents black square bug)
    ctx.fillStyle = '#0a1929'; // Match background color
    ctx.fillRect(x - 6, secondTop, w + 12, secondBottom - secondTop);

    ctx.fillStyle = '#e63946';
    ctx.fillRect(x - 6, secondBottom, w + 12, 8);
  }
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
    ctx.ellipse(0, 0, r * 1.95, r * 1.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.globalAlpha = 0.5 + pulse * 0.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.65, r * 1.15, 0, 0, Math.PI * 2);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = id === 'legendary' ? 32 : id === 'diamond' ? 26 : 18;

  // === Improved Tail (more elegant and realistic) ===
  if (id === 'ruby') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.quadraticCurveTo(-r * 1.7, -r * 1.35, -r * 2.45, -r * 0.65);
    ctx.quadraticCurveTo(-r * 2.0, 0, -r * 2.45, r * 0.65);
    ctx.quadraticCurveTo(-r * 1.7, r * 1.35, -r * 0.9, 0);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
  } else if (id === 'legendary') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, 0);
    ctx.quadraticCurveTo(-r * 1.85, -r * 1.35, -r * 2.55, -r * 0.5);
    ctx.lineTo(-r * 1.9, 0);
    ctx.quadraticCurveTo(-r * 2.55, r * 0.5, -r * 1.85, r * 1.35);
    ctx.closePath();
    ctx.fillStyle = '#111111';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.quadraticCurveTo(-r * 1.55, -r * 1.05, -r * 2.1, -r * 0.4);
    ctx.quadraticCurveTo(-r * 1.65, 0, -r * 2.1, r * 0.4);
    ctx.quadraticCurveTo(-r * 1.55, r * 1.05, -r * 0.9, 0);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
  }

  // === Improved Body with better shading ===
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, 0);
  ctx.quadraticCurveTo(-r * 0.6, -r * 1.0, r * 0.2, -r * 0.92);
  ctx.quadraticCurveTo(r * 1.0, -r * 0.55, r * 1.12, 0);
  ctx.quadraticCurveTo(r * 1.0, r * 0.55, r * 0.2, r * 0.92);
  ctx.quadraticCurveTo(-r * 0.6, r * 1.0, -r * 0.95, 0);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(-r * 0.9, -r, r * 1.1, r);
  if (id === 'legendary') {
    bodyGrad.addColorStop(0, '#1a1a1a');
    bodyGrad.addColorStop(0.35, '#ffe066');
    bodyGrad.addColorStop(0.65, '#ffd60a');
    bodyGrad.addColorStop(1, '#1a1a1a');
  } else {
    bodyGrad.addColorStop(0, belly);
    bodyGrad.addColorStop(0.35, body);
    bodyGrad.addColorStop(0.75, fin);
    bodyGrad.addColorStop(1, '#1a3a4a');
  }
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Subtle scale highlight
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(r * 0.15, -r * 0.15, r * 0.55, r * 0.35, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1;

  // === Belly (more natural) ===
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.32, r * 0.58, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = belly;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;

  // === Dorsal Fin (improved shape) ===
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.72);
  ctx.quadraticCurveTo(r * 0.3, -r * 1.35, r * 0.75, -r * 0.6);
  ctx.quadraticCurveTo(r * 0.35, -r * 0.85, 0, -r * 0.72);
  ctx.closePath();
  ctx.fillStyle = id === 'legendary' ? '#ffe066' : fin;
  ctx.fill();

  // === Pectoral Fin ===
  ctx.beginPath();
  ctx.moveTo(r * 0.28, r * 0.12);
  ctx.quadraticCurveTo(r * 1.15, -r * 0.22, r * 1.2, r * 0.38);
  ctx.quadraticCurveTo(r * 0.75, r * 0.32, r * 0.28, r * 0.12);
  ctx.closePath();
  ctx.fillStyle = fin;
  ctx.fill();

  // === Eye (more lively and detailed) ===
  ctx.beginPath();
  ctx.arc(r * 0.58, -r * 0.18, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#0f0a00';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(r * 0.6, -r * 0.2, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Small reflection in eye
  ctx.beginPath();
  ctx.arc(r * 0.62, -r * 0.24, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

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
  for (const obs of state.obstacles) drawObstacle(ctx, obs, height, state.score);
  for (const coin of state.coins) drawCoin(ctx, coin, state.timeMs);
  for (const gem of state.gems) drawGem(ctx, gem, state.timeMs);
  for (const pu of state.powerUps) drawPowerUp(ctx, pu, state.timeMs);
  const fishX = width * FISH_X_RATIO;
  const invincible = state.timeMs < state.invincibleUntil;
  drawFish(ctx, state, fishX, invincible);
  for (const particle of state.particles) drawParticle(ctx, particle);
  ctx.restore();
}

export { FISH_X_RATIO };
