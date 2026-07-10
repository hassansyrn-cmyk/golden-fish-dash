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

export interface Gem {
  x: number;
  y: number;
  collected: boolean;
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
  onGemCollect: () => void;
  onLifeLost: (remainingLives: number) => void;
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
  gems: Gem[];
  bubbles: Bubble[];
  particles: Particle[];
  elapsedSinceSpawn: number;
  skin: SkinId;
  shakeIntensity: number;
  timeMs: number;
  legendaryPulse: number;
  lives: number; // 💖 Extra lives from gems
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
    gems: [],
    bubbles,
    particles: [],
    elapsedSinceSpawn: 999999,
    skin,
    shakeIntensity: 0,
    timeMs: 0,
    legendaryPulse: 0,
    lives: 1, // Start with 1 standard life
  };
}

export function difficultyForScore(score: number) {
  // Speed increases gradually every 10 points, capped at maxSpeed. Made smoother.
  const speedSteps = Math.floor(score / 10);
  const speed = Math.min(BASE.maxSpeed, BASE.baseSpeed + speedSteps * 0.22);
  // Gap shrinks gradually but never below minGap. Made wider.
  const gap = Math.max(BASE.minGap, BASE.baseGap - speedSteps * 4);
  const spawnInterval = Math.max(1000, BASE.spawnInterval - speedSteps * 45);
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
  const isDouble = expertMode && Math.random() < 0.10; // Lower double obstacle spawn rate for balance
  state.obstacles.push({
    x: state.width + BASE.obstacleWidth,
    gapY,
    gapSize: gap,
    passed: false,
    bobbing: hardMode && Math.random() < 0.35, // Smoother bobbing chances
    bobPhase: Math.random() * Math.PI * 2,
    bobAmount: 18 + Math.random() * 12, // Lower bobbing extremes
    glowing: legendaryMode,
    isDouble,
  });

  // Decide what item to spawn inside the gap (exclusive spawn for cleaner layouts)
  const itemRoll = Math.random();
  if (itemRoll < 0.08) {
    // 8% chance to spawn a Rare Gem!
    state.gems.push({
      x: state.width + BASE.obstacleWidth + 40,
      y: gapY + (Math.random() - 0.5) * (gap * 0.3),
      collected: false,
    });
  } else if (itemRoll < 0.58) {
    // 50% chance to spawn a coin
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
  const dt = Math.min(2.2, dtMs / 16.67); // normalize to ~60fps steps
  state.timeMs += dtMs;
  state.legendaryPulse = (state.legendaryPulse + dtMs * 0.002) % (Math.PI * 2);

  // --- Fish physics ---
  state.fishVY = Math.min(BASE.maxFallSpeed, state.fishVY + BASE.gravity * dt);
  state.fishY += state.fishVY * dt;
  state.fishRotation = Math.max(-0.5, Math.min(0.9, state.fishVY * 0.06));

  const groundY = state.height - 8;
  const ceilingY = 8;
  const invincible = state.timeMs < state.invincibleUntil;

  // Bound collisions
  if (state.fishY + BASE.fishRadius >= groundY || state.fishY - BASE.fishRadius <= ceilingY) {
    state.fishY = Math.max(ceilingY + BASE.fishRadius, Math.min(groundY - BASE.fishRadius, state.fishY));
    if (!invincible) {
      if (state.lives > 1) {
        state.lives -= 1;
        state.invincibleUntil = state.timeMs + 2000; // Invincibility grace period
        state.fishVY = -4.0; // Small upward bounce
        callbacks.onShake(12);
        callbacks.onLifeLost(state.lives);
      } else {
        callbacks.onShake(10);
        callbacks.onDeath();
        state.running = false;
        return;
      }
    } else {
      state.fishVY = 0;
    }
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
      obs.bobPhase += dtMs * 0.0022; // Slower, smoother bobbing speed
      obs.gapY += Math.sin(obs.bobPhase) * 0.28 * dt;
      obs.gapY = Math.max(100, Math.min(state.height - 100, obs.gapY));
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
          if (state.lives > 1) {
            state.lives -= 1;
            state.invincibleUntil = state.timeMs + 2000; // 2s invincibility
            callbacks.onShake(15);
            callbacks.onLifeLost(state.lives);
            // Push this obstacle out of the way so the fish can swim through
            obs.x = -BASE.obstacleWidth * 2;
          } else {
            callbacks.onShake(14);
            callbacks.onDeath();
            state.running = false;
            return;
          }
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
  state.coins = state.coins.filter((c) => c.x > -40);

  // --- Gems ---
  for (const gem of state.gems) {
    gem.x -= speed * dt;
    if (!gem.collected) {
      const dx = gem.x - fishX;
      const dy = gem.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 14) {
        gem.collected = true;
        state.lives += 1;
        callbacks.onGemCollect();
        for (let i = 0; i < 15; i++) {
          state.particles.push({
            x: gem.x,
            y: gem.y,
            vx: (Math.random() - 0.5) * 3.5,
            vy: (Math.random() - 0.5) * 3.5,
            life: 0,
            maxLife: 24 + Math.random() * 12,
            color: '#e040fb', // Sparkling neon pink/magenta
            size: 2.5 + Math.random() * 3,
          });
        }
      }
    }
  }
  state.gems = state.gems.filter((g) => g.x > -40);

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
  // lower pillar with a second safe gap between them
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

  // Custom Skin Characteristics (making skins visually distinct like real fish)
  if (state.skin === 'ruby') {
    // --- RUBY FISH: Wavy, flowing double-tail fin (Betta Fish style) ---
    ctx.beginPath();
    ctx.moveTo(-BASE.fishRadius - 2, -2);
    ctx.quadraticCurveTo(-BASE.fishRadius - 14, -18, -BASE.fishRadius - 25, -12);
    ctx.quadraticCurveTo(-BASE.fishRadius - 18, -2, -BASE.fishRadius - 4, -1);
    ctx.moveTo(-BASE.fishRadius - 2, 2);
    ctx.quadraticCurveTo(-BASE.fishRadius - 14, 18, -BASE.fishRadius - 25, 12);
    ctx.quadraticCurveTo(-BASE.fishRadius - 18, 2, -BASE.fishRadius - 4, 1);
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();

    // Elegant long flowing belly fin
    ctx.beginPath();
    ctx.moveTo(-4, BASE.fishRadius * 0.6);
    ctx.quadraticCurveTo(-14, BASE.fishRadius * 1.6, -18, BASE.fishRadius * 1.2);
    ctx.quadraticCurveTo(-8, BASE.fishRadius * 0.5, 0, BASE.fishRadius * 0.4);
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();
  } else if (state.skin === 'emerald') {
    // --- EMERALD FISH: Sleek pointy fins (Angelfish style) ---
    // Tail
    ctx.beginPath();
    ctx.moveTo(-BASE.fishRadius - 2, 0);
    ctx.lineTo(-BASE.fishRadius - 24, -18);
    ctx.lineTo(-BASE.fishRadius - 18, 0);
    ctx.lineTo(-BASE.fishRadius - 24, 18);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();

    // Very long vertical pointy top fin
    ctx.beginPath();
    ctx.moveTo(-6, -BASE.fishRadius * 0.6);
    ctx.lineTo(-12, -BASE.fishRadius * 2.2);
    ctx.lineTo(4, -BASE.fishRadius * 0.5);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();

    // Long vertical pointy bottom fin
    ctx.beginPath();
    ctx.moveTo(-6, BASE.fishRadius * 0.6);
    ctx.lineTo(-12, BASE.fishRadius * 2.2);
    ctx.lineTo(4, BASE.fishRadius * 0.5);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();
  } else if (state.skin === 'diamond') {
    // --- DIAMOND FISH: Geometric/Crystal Crown Fin style ---
    // Tail
    ctx.beginPath();
    ctx.moveTo(-BASE.fishRadius - 2, 0);
    ctx.lineTo(-BASE.fishRadius - 20, -12);
    ctx.lineTo(-BASE.fishRadius - 12, -4);
    ctx.lineTo(-BASE.fishRadius - 20, 0);
    ctx.lineTo(-BASE.fishRadius - 12, 4);
    ctx.lineTo(-BASE.fishRadius - 20, 12);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();

    // Crystal spiky crown dorsal fin
    ctx.beginPath();
    ctx.moveTo(-6, -BASE.fishRadius * 0.5);
    ctx.lineTo(-12, -BASE.fishRadius * 1.3);
    ctx.lineTo(-2, -BASE.fishRadius * 1.0);
    ctx.lineTo(4, -BASE.fishRadius * 1.5);
    ctx.lineTo(8, -BASE.fishRadius * 0.5);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();
  } else if (state.skin === 'legendary') {
    // --- LEGENDARY DRAGON FISH: Whiskers + Majestic Long Glowing Fins (Arowana style) ---
    // Tail
    ctx.beginPath();
    ctx.moveTo(-BASE.fishRadius - 2, 0);
    ctx.quadraticCurveTo(-BASE.fishRadius - 20, -16, -BASE.fishRadius - 28, 0);
    ctx.quadraticCurveTo(-BASE.fishRadius - 20, 16, -BASE.fishRadius - 2, 0);
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();

    // Flowing top fin
    ctx.beginPath();
    ctx.moveTo(-10, -BASE.fishRadius * 0.5);
    ctx.quadraticCurveTo(2, -BASE.fishRadius * 1.6, 12, -BASE.fishRadius * 0.5);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();

    // Whiskers (Barbels) on the snout
    ctx.beginPath();
    ctx.moveTo(BASE.fishRadius * 0.8, -2);
    ctx.quadraticCurveTo(BASE.fishRadius * 1.5, -10, BASE.fishRadius * 1.7, -4);
    ctx.moveTo(BASE.fishRadius * 0.8, 2);
    ctx.quadraticCurveTo(BASE.fishRadius * 1.5, 10, BASE.fishRadius * 1.7, 4);
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  } else {
    // --- GOLDEN FISH (Default): Classical Fan Tail ---
    ctx.beginPath();
    ctx.moveTo(-BASE.fishRadius - 2, 0);
    ctx.lineTo(-BASE.fishRadius - 16, -10);
    ctx.lineTo(-BASE.fishRadius - 16, 10);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();

    // Top fin
    ctx.beginPath();
    ctx.moveTo(-2, -BASE.fishRadius * 0.7);
    ctx.lineTo(6, -BASE.fishRadius * 1.25);
    ctx.lineTo(12, -BASE.fishRadius * 0.55);
    ctx.closePath();
    ctx.fillStyle = skin.colors.fin;
    ctx.fill();
  }

  // Draw main fish oval body (Common to all fish skins)
  ctx.beginPath();
  ctx.ellipse(0, 0, BASE.fishRadius, BASE.fishRadius * 0.78, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.colors.body;
  ctx.fill();

  // Draw belly highlight
  ctx.beginPath();
  ctx.ellipse(2, 5, BASE.fishRadius * 0.6, BASE.fishRadius * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.colors.belly;
  ctx.fill();

  ctx.restore(); // Restore aura

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
  ctx.font = `bold ${coin.bonus ? 11 : 9}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, 0);
  ctx.restore();
}

function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, timeMs: number) {
  if (gem.collected) return;
  const bob = Math.sin(timeMs * 0.006 + gem.x) * 4;
  ctx.save();
  ctx.translate(gem.x, gem.y + bob);

  // Diamond/Crystal shape
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 11);
  ctx.lineTo(-8, 0);
  ctx.closePath();

  ctx.fillStyle = '#e040fb'; // Neon pink/purple
  ctx.shadowColor = '#f50057';
  ctx.shadowBlur = 12;
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Sparkle glint
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-2, -3, 1.8, 0, Math.PI * 2);
  ctx.fill();

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
  for (const gem of state.gems) drawGem(ctx, gem, state.timeMs);

  const fishX = width * FISH_X_RATIO;
  const invincible = state.timeMs < state.invincibleUntil;
  drawFish(ctx, state, fishX, invincible);

  for (const p of state.particles) drawParticle(ctx, p);

  ctx.restore();
}

export { FISH_X_RATIO };
