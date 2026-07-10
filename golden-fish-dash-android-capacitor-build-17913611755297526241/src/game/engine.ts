// -----------------------------------------------------------------------
// Core canvas game engine for Golden Fish Rush.
// Pure logic + canvas rendering, framework-agnostic so it can run inside a
// single requestAnimationFrame loop driven by the React hook.
// -----------------------------------------------------------------------

import { BASE, SKINS, getDifficultyTier } from './constants';
import type { SkinId } from './types';

export interface Obstacle {
  x: number;
  gapY: number; // center of the gap
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
  bubbles: Bubble[];
  particles: Particle[];
  elapsedSinceSpawn: number;
  skin: SkinId;
  shakeIntensity: number;
  timeMs: number;
  legendaryPulse: number;
}

const FISH_X_RATIO = 0.28;

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
    bubbles,
    particles: [],
    elapsedSinceSpawn: 999999,
    skin,
    shakeIntensity: 0,
    timeMs: 0,
    legendaryPulse: 0,
  };
}

export function difficultyForScore(score: number) {
  // Speed increases gradually every 10 points, capped at maxSpeed.
  const speedSteps = Math.floor(score / 10);
  const speed = Math.min(BASE.maxSpeed, BASE.baseSpeed + speedSteps * 0.32);
  // Gap shrinks gradually but never below minGap.
  const gap = Math.max(BASE.minGap, BASE.baseGap - speedSteps * 6);
  const spawnInterval = Math.max(900, BASE.spawnInterval - speedSteps * 55);
  const tier = getDifficultyTier(score);
  return { speed, gap, spawnInterval, tier };
}

export function jump(state: EngineState, settings: { vibration: boolean }) {
  if (!state.running) return;
  state.fishVY = BASE.jumpVelocity;
  // Small splash/bubble burst on jump.
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

function spawnObstacle(state: EngineState, score: number) {
  const { gap } = difficultyForScore(score);
  const margin = 70;
  const gapY = margin + Math.random() * (state.height - margin * 2);
  const hardMode = score >= 26;
  const expertMode = score >= 51;
  const legendaryMode = score >= 100;
  const isDouble = expertMode && Math.random() < 0.18;
  state.obstacles.push({
    x: state.width + BASE.obstacleWidth,
    gapY,
    gapSize: gap,
    passed: false,
    bobbing: hardMode && Math.random() < 0.4,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmount: 22 + Math.random() * 18,
    glowing: legendaryMode,
    isDouble,
  });

  // Occasionally spawn a collectible coin in the gap.
  if (Math.random() < 0.55) {
    state.coins.push({
      x: state.width + BASE.obstacleWidth + 40,
      y: gapY + (Math.random() - 0.5) * (gap * 0.4),
      collected: false,
      bonus: legendaryMode && Math.random() < 0.25,
    });
  }
}

export function stepEngine(
  state: EngineState,
  dtMs: number,
  callbacks: EngineCallbacks,
  settings: { vibration: boolean },
) {
  if (!state.running) return;
  const dt = Math.min(2.2, dtMs / 16.67); // normalize to ~60fps steps, cap for tab-switch spikes
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
    if (!invincible) {
      state.fishY = Math.max(ceilingY + BASE.fishRadius, Math.min(groundY - BASE.fishRadius, state.fishY));
      callbacks.onShake(10);
      callbacks.onDeath();
      state.running = false;
      return;
    }
    state.fishY = Math.max(ceilingY + BASE.fishRadius, Math.min(groundY - BASE.fishRadius, state.fishY));
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
      obs.bobPhase += dtMs * 0.0028;
      obs.gapY += Math.sin(obs.bobPhase) * 0.35 * dt;
      obs.gapY = Math.max(90, Math.min(state.height - 90, obs.gapY));
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
          // Double obstacle pattern: two separate safe corridors (the main
          // gap plus a secondary gap below it). The fish must be fully
          // inside one of the two gaps to be safe -- everything else is a
          // solid pillar, matching the rendered geometry in drawObstacle.
          const secondTop = bottomGapEdge + 46;
          const secondBottom = secondTop + 40;
          const inGap1 = state.fishY - BASE.fishRadius >= topGapEdge && state.fishY + BASE.fishRadius <= bottomGapEdge;
          const inGap2 = state.fishY - BASE.fishRadius >= secondTop && state.fishY + BASE.fishRadius <= secondBottom;
          safe = inGap1 || inGap2;
        } else {
          const hitTop = state.fishY - BASE.fishRadius < topGapEdge;
          const hitBottom = state.fishY + BASE.fishRadius > bottomGapEdge;
          safe = !hitTop && !hitBottom;
        }

        if (!safe) {
          callbacks.onShake(14);
          callbacks.onDeath();
          state.running = false;
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
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 12) {
        coin.collected = true;
        const amount = coin.bonus ? 5 : 1;
        callbacks.onCoinCollect(amount);
        for (let i = 0; i < 10; i++) {
          state.particles.push({
            x: coin.x,
            y: coin.y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            life: 0,
            maxLife: 22 + Math.random() * 10,
            color: coin.bonus ? '#ff9500' : '#ffd60a',
            size: 2 + Math.random() * 3,
          });
        }
      }
    }
  }
  state.coins = state.coins.filter((c) => c.x > -40 && !(c.collected && Math.random() < 0));

  // --- Bubbles (ambient decoration) ---
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

  // Legendary golden shimmer overlay
  if (state.score >= 100) {
    const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
    ctx.fillStyle = `rgba(255, 214, 10, ${0.05 + pulse * 0.06})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Light rays
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

  // Bubbles
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

  // Simple coral silhouettes near the bottom for depth.
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

  // Ground + ceiling bands
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

  // Top spire
  ctx.fillRect(x, 0, w, topGapEdge);
  ctx.fillRect(x - 6, topGapEdge - 18, w + 12, 18);
  // Bottom spire
  ctx.fillRect(x, bottomGapEdge, w, height - bottomGapEdge);
  ctx.fillRect(x - 6, bottomGapEdge, w + 12, 18);

  if (obs.glowing) ctx.restore();

  // Double-obstacle: the bottom spire is split into a middle pillar and a
  // lower pillar with a second safe gap between them (matches the two-gap
  // collision logic in stepEngine).
  if (obs.isDouble) {
    const secondTop = bottomGapEdge + 46;
    const secondBottom = secondTop + 40;
    // Clear the gap band between the two pillars.
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

  // Glow aura
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
  const bob = Math.sin(timeMs * 0.005 + coin.x) * 3;
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
  ctx.fillText('$', 0, 0);
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = 1 - p.life / p.maxLife;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
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

  const fishX = width * FISH_X_RATIO;
  const invincible = state.timeMs < state.invincibleUntil;
  drawFish(ctx, state, fishX, invincible);

  for (const p of state.particles) drawParticle(ctx, p);

  ctx.restore();
}

export { FISH_X_RATIO };
