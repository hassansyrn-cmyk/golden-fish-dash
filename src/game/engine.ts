// -----------------------------------------------------------------------
// Core canvas game engine for Golden Fish Rush.
// Pure logic + canvas rendering, framework-agnostic so it can run inside a
// single requestAnimationFrame loop driven by the React hook.
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

  // Optional callbacks for newer gameplay features.
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
  bubbles: Bubble[];
  particles: Particle[];
  elapsedSinceSpawn: number;
  skin: SkinId;
  shakeIntensity: number;
  timeMs: number;
  legendaryPulse: number;
  lives: number;
  maxLives: number;
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
    width,
    height,
    fishY: height / 2,
    fishVY: 0,
    fishRotation: 0,
    score: 0,
    running: true,
    invincibleUntil: 0,
    obstacles: [],
    coins: [],
    gems: [],
    bubbles,
    particles: [],
    elapsedSinceSpawn: 999999,
    skin,
    shakeIntensity: 0,
    timeMs: 0,
    legendaryPulse: 0,
    lives: 0,
    maxLives: MAX_EXTRA_LIVES,
  };
}

export function difficultyForScore(score: number) {
  // Easier balance:
  // - slower initial speed
  // - slower difficulty increase
  // - bigger gaps
  // - more time between obstacles
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
      x: state.width * FISH_X_RATIO,
      y: state.fishY + BASE.fishRadius * 0.6,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 1 + Math.random() * 1.5,
      life: 0,
      maxLife: 26 + Math.random() * 14,
      color: 'rgba(255,255,255,0.85)',
      size: 2 + Math.random() * 3,
    });
  }

  if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(12);
    } catch {
      // ignore devices without vibration support
    }
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
    x: state.width + BASE.obstacleWidth,
    gapY,
    gapSize: gap,
    passed: false,
    bobbing: hardMode && Math.random() < 0.22,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmount: 12 + Math.random() * 10,
    glowing: legendaryMode,
    isDouble,
  });

  // Coin in the gap.
  if (Math.random() < 0.68) {
    state.coins.push({
      x: state.width + BASE.obstacleWidth + 44,
      y: gapY + (Math.random() - 0.5) * (gap * 0.32),
      collected: false,
      bonus: score >= 60 && Math.random() < 0.22,
    });
  }

  // Rare gem: gives one extra life.
  if (Math.random() < GEM_SPAWN_CHANCE) {
    state.gems.push({
      x: state.width + BASE.obstacleWidth + 88,
      y: gapY + (Math.random() - 0.5) * (gap * 0.28),
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

function addBurst(
  state: EngineState,
  x: number,
  y: number,
  color: string,
  count: number,
  sizeBase = 2,
) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3.6,
      vy: (Math.random() - 0.5) * 3.6,
      life: 0,
      maxLife: 22 + Math.random() * 12,
      color,
      size: sizeBase + Math.random() * 3,
    });
  }
}

function clearDangerousReviveArea(state: EngineState) {
  const fishX = state.width * FISH_X_RATIO;

  /*
    Remove obstacles that are too close to the fish after revive.

    This is safer than only pushing obstacles forward, because pushing old
    obstacles can still leave a narrow or impossible corridor. The player
    should always revive into a fair lane.
  */
  state.obstacles = state.obstacles.filter((obs) => {
    const halfWidth = BASE.obstacleWidth / 2;
    const obsLeft = obs.x - halfWidth;
    const obsRight = obs.x + halfWidth;

    const safelyBehindFish = obsRight < fishX - BASE.obstacleWidth * 2.2;
    const safelyFarAhead = obsLeft > state.width + BASE.obstacleWidth * 1.4;

    return safelyBehindFish || safelyFarAhead;
  });

  // Remove collectibles from the unsafe revive corridor too.
  state.coins = state.coins.filter((coin) => {
    const safelyBehindFish = coin.x < fishX - BASE.obstacleWidth * 2;
    const safelyFarAhead = coin.x > state.width + BASE.obstacleWidth;

    return safelyBehindFish || safelyFarAhead;
  });

  state.gems = state.gems.filter((gem) => {
    const safelyBehindFish = gem.x < fishX - BASE.obstacleWidth * 2;
    const safelyFarAhead = gem.x > state.width + BASE.obstacleWidth;

    return safelyBehindFish || safelyFarAhead;
  });

  // Delay the next obstacle so the player can regain control.
  state.elapsedSinceSpawn = -SAFE_REVIVE_DELAY_MS;
}

function spendExtraLife(state: EngineState, callbacks: EngineCallbacks) {
  if (state.lives <= 0) return false;

  state.lives -= 1;
  state.invincibleUntil = state.timeMs + HIT_INVINCIBILITY_MS;

  // Put the fish in a safe middle position.
  state.fishY = state.height / 2;
  state.fishVY = 0;
  state.fishRotation = 0;

  clearDangerousReviveArea(state);

  callbacks.onLifeChange?.(state.lives);
  callbacks.onShake(6);

  addBurst(
    state,
    state.width * FISH_X_RATIO,
    state.fishY,
    'rgba(80, 220, 255, 0.95)',
    22,
    3,
  );

  return true;
}

function killOrUseLife(state: EngineState, callbacks: EngineCallbacks) {
  if (spendExtraLife(state, callbacks)) {
    return;
  }

  callbacks.onShake(14);
  callbacks.onDeath();
  state.running = false;
}

export function stepEngine(
  state: EngineState,
  dtMs: number,
  callbacks: EngineCallbacks,
  settings: { vibration: boolean },
) {
  if (!state.running) return;

  const dt = Math.min(2.2, dtMs / 16.67);
  state.timeMs += dtMs;
  state.legendaryPulse = (state.legendaryPulse + dtMs * 0.002) % (Math.PI * 2);

  // --- Fish physics ---
  state.fishVY = Math.min(BASE.maxFallSpeed, state.fishVY + BASE.gravity * dt);
  state.fishY += state.fishVY * dt;
  state.fishRotation = Math.max(-0.5, Math.min(0.9, state.fishVY * 0.06));

  const groundY = state.height - 8;
  const ceilingY = 8;
  const invincible = state.timeMs < state.invincibleUntil;

  if (state.fishY + BASE.fishRadius >= groundY || state.fishY - BASE.fishRadius <= ceilingY) {
    state.fishY = Math.max(
      ceilingY + BASE.fishRadius,
      Math.min(groundY - BASE.fishRadius, state.fishY),
    );

    if (!invincible) {
      killOrUseLife(state, callbacks);
      return;
    }

    state.fishVY = 0;
  }

  // --- Spawn obstacles ---
  const { speed, spawnInterval } = difficultyForScore(state.score);
  state.elapsedSinceSpawn += dtMs;

  if (state.elapsedSinceSpawn >= spawnInterval) {
    spawnObstacle(state, state.score);
    state.elapsedSinceSpawn = 0;
  }

  // --- Move obstacles + collision ---
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
      const withinX =
        fishX + BASE.fishRadius > obs.x - BASE.obstacleWidth / 2 &&
        fishX - BASE.fishRadius < obs.x + BASE.obstacleWidth / 2;

      if (withinX) {
        const topGapEdge = obs.gapY - obs.gapSize / 2;
        const bottomGapEdge = obs.gapY + obs.gapSize / 2;

        let safe: boolean;

        if (obs.isDouble) {
          const secondTop = bottomGapEdge + 58;
          const secondBottom = secondTop + 52;

          const inGap1 =
            state.fishY - BASE.fishRadius >= topGapEdge &&
            state.fishY + BASE.fishRadius <= bottomGapEdge;

          const inGap2 =
            state.fishY - BASE.fishRadius >= secondTop &&
            state.fishY + BASE.fishRadius <= secondBottom;

          safe = inGap1 || inGap2;
        } else {
          const hitTop = state.fishY - BASE.fishRadius < topGapEdge;
          const hitBottom = state.fishY + BASE.fishRadius > bottomGapEdge;
          safe = !hitTop && !hitBottom;
        }

        if (!safe) {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }

  state.obstacles = state.obstacles.filter((o) => o.x > -BASE.obstacleWidth * 2);

  // --- Coins ---
  for (const coin of state.coins) {
    coin.x -= speed * dt;

    if (!coin.collected) {
      const dx = coin.x - fishX;
      const dy = coin.y - state.fishY;

      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 13) {
        coin.collected = true;

        const amount = coin.bonus ? 5 : 1;

        // Coins now matter immediately:
        // normal coin = +1 score
        // bonus coin = +5 score
        state.score += amount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(amount);

        addBurst(state, coin.x, coin.y, coin.bonus ? '#ff9500' : '#ffd60a', 12, 2);
      }
    }
  }

  state.coins = state.coins.filter((c) => c.x > -40 && !c.collected);

  // --- Rare gems ---
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
        }

        callbacks.onGemCollect?.(state.lives);
        callbacks.onLifeChange?.(state.lives);
        callbacks.onShake(5);

        addBurst(state, gem.x, gem.y, '#7df9ff', 22, 3);
      }
    }
  }

  state.gems = state.gems.filter((g) => g.x > -50 && !g.collected);

  // --- Bubbles ---
  for (const b of state.bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(state.timeMs * 0.001 + b.x) * b.drift * dt;

    if (b.y < -20) {
      b.y = state.height + 10;
      b.x = Math.random() * state.width;
    }
  }

  // --- Particles ---
  for (const p of state.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.05 * dt;
  }

  state.particles = state.particles.filter((p) => p.life < p.maxLife);

  // --- Shake decay ---
  state.shakeIntensity = Math.max(0, state.shakeIntensity - dtMs * 0.05);

  // Keep TypeScript happy if stricter configs are enabled later.
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

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, height: number) {
  const topGapEdge = obs.gapY - obs.gapSize / 2;
  const bottomGapEdge = obs.gapY + obs.gapSize / 2;
  const w = BASE.obstacleWidth;
  const x = obs.x - w / 2;

  const grad = ctx.createLinearGradient(x, 0, x + w, 0);

  if (obs.glowing) {
    grad.addColorStop(0, '#ffd60a');
    grad.addColorStop(1, '#ff9500');
  } else {
    grad.addColorStop(0, '#2a9d8f');
    grad.addColorStop(1, '#1d7870');
  }

  ctx.fillStyle = grad;

  if (obs.glowing) {
    ctx.save();
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 22;
  }

  ctx.fillRect(x, 0, w, topGapEdge);
  ctx.fillRect(x - 6, topGapEdge - 18, w + 12, 18);

  ctx.fillRect(x, bottomGapEdge, w, height - bottomGapEdge);
  ctx.fillRect(x - 6, bottomGapEdge, w + 12, 18);

  if (obs.glowing) ctx.restore();

  if (obs.isDouble) {
    const secondTop = bottomGapEdge + 58;
    const secondBottom = secondTop + 52;

    ctx.clearRect(x - 6, secondTop, w + 12, secondBottom - secondTop);

    ctx.fillStyle = '#e63946';
    ctx.fillRect(x - 6, secondBottom, w + 12, 8);
  }
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  state: EngineState,
  fishX: number,
  invincible: boolean,
) {
  const skin = SKINS.find((s) => s.id === state.skin) ?? SKINS[0];
  const blink = invincible && Math.floor(state.timeMs / 100) % 2 === 0;

  if (blink) return;

  ctx.save();
  ctx.translate(fishX, state.fishY);
  ctx.rotate(state.fishRotation);

  ctx.save();
  ctx.shadowColor = skin.colors.glow;
  ctx.shadowBlur = state.score >= 100 ? 26 : 14;

  // Tail
  ctx.beginPath();
  ctx.moveTo(-BASE.fishRadius - 2, 0);
  ctx.lineTo(-BASE.fishRadius - 16, -10);
  ctx.lineTo(-BASE.fishRadius - 16, 10);
  ctx.closePath();
  ctx.fillStyle = skin.colors.fin;
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, BASE.fishRadius, BASE.fishRadius * 0.78, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.colors.body;
  ctx.fill();

  // Belly highlight
  ctx.beginPath();
  ctx.ellipse(2, 5, BASE.fishRadius * 0.6, BASE.fishRadius * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.colors.belly;
  ctx.fill();

  // Top fin
  ctx.beginPath();
  ctx.moveTo(-2, -BASE.fishRadius * 0.7);
  ctx.lineTo(6, -BASE.fishRadius * 1.25);
  ctx.lineTo(12, -BASE.fishRadius * 0.55);
  ctx.closePath();
  ctx.fillStyle = skin.colors.fin;
  ctx.fill();

  ctx.restore();

  // Eye
  ctx.beginPath();
  ctx.arc(BASE.fishRadius * 0.45, -BASE.fishRadius * 0.15, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1c1c';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(BASE.fishRadius * 0.55, -BASE.fishRadius * 0.25, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, timeMs: number) {
  if (coin.collected) return;

  // Gentle floating movement. Previously this was stronger and looked like shaking.
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

  // Gentle floating movement. This keeps it alive visually without annoying shaking.
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
  for (const coin of state.coins) drawCoin(ctx, coin, state.timeMs);
  for (const gem of state.gems) drawGem(ctx, gem, state.timeMs);

  const fishX = width * FISH_X_RATIO;
  const invincible = state.timeMs < state.invincibleUntil;

  drawFish(ctx, state, fishX, invincible);

  for (const particle of state.particles) drawParticle(ctx, particle);

  ctx.restore();
}

export { FISH_X_RATIO };
