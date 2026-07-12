// -----------------------------------------------------------------------
// Pure rendering layer for the Golden Fish Rush game engine.
//
// Everything here draws to a CanvasRenderingContext2D from an EngineState
// snapshot. Nothing in this file mutates game state or contains gameplay
// logic — that all lives in engine.ts. Split out of engine.ts as a pure
// move (no behavior changed) so simulation and presentation aren't mixed
// in one 1000+ line file.
// -----------------------------------------------------------------------

import { BASE, SKINS, getDifficultyTier } from './constants';
import { FISH_X_RATIO, SHARK_RADIUS } from './entities';
import type {
  Obstacle,
  Shark,
  BubbleBoost,
  Treasure,
  FloatingText,
  Coin,
  Gem,
  PowerUp,
  Particle,
  EngineState,
} from './entities';

function drawBackground(ctx: CanvasRenderingContext2D, state: EngineState) {
  const { width, height } = state;
  const tier = getDifficultyTier(state.score);
  const [c1, c2] = tier.bg;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Extra depth wash: keeps the very top a touch brighter (sunlit surface)
  // and the bottom a touch darker (deep water), regardless of tier palette.
  const depthGrad = ctx.createLinearGradient(0, 0, 0, height);
  depthGrad.addColorStop(0, 'rgba(255,255,255,0.16)');
  depthGrad.addColorStop(0.32, 'rgba(255,255,255,0.03)');
  depthGrad.addColorStop(0.75, 'rgba(0,0,0,0)');
  depthGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = depthGrad;
  ctx.fillRect(0, 0, width, height);

  if (state.score >= 100) {
    const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
    ctx.fillStyle = `rgba(255, 214, 10, ${0.05 + pulse * 0.06})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Soft light shafts from above, each with its own fading gradient so the
  // edges feel like light rather than flat white wedges.
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const rx = (width / 4) * i + Math.sin(state.timeMs * 0.0002 + i) * 20;
    const rayGrad = ctx.createLinearGradient(rx, 0, rx, height * 0.85);
    rayGrad.addColorStop(0, 'rgba(255,255,255,0.16)');
    rayGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + 60, 0);
    ctx.lineTo(rx - 40, height * 0.85);
    ctx.lineTo(rx - 130, height * 0.85);
    ctx.closePath();
    ctx.fillStyle = rayGrad;
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  for (const b of state.bubbles) {
    // Larger bubbles read as closer/fainter, smaller ones crisper - a cheap
    // depth cue that also breaks up the uniform look of identical bubbles.
    const alpha = 0.32 - Math.min(0.18, b.r * 0.015);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  }
  ctx.restore();

  // Distant fish silhouettes: slow parallax layer, purely decorative.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#dff6ff';
  for (const df of state.distantFish) {
    ctx.save();
    ctx.translate(df.x, df.y + Math.sin(state.timeMs * 0.0007 + df.x) * 2);
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

  // Very slow background drift for the sea floor layer (coral + seaweed),
  // independent of obstacle speed, for a subtle parallax feel.
  const floorDrift = (state.timeMs * 0.004) % (width / 6);

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = tier.name === 'Easy' ? '#0a6ea8' : '#04203f';
  for (let i = 0; i < 6; i++) {
    const cx = (width / 6) * i + 20 - floorDrift;
    const h = 30 + ((i * 37) % 50);
    ctx.beginPath();
    ctx.moveTo(cx, height);
    ctx.quadraticCurveTo(cx - 14, height - h, cx, height - h - 10);
    ctx.quadraticCurveTo(cx + 14, height - h, cx, height);
    ctx.fill();
  }
  // Fuller seaweed blades between the coral blobs, swaying gently.
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = tier.name === 'Easy' ? '#0a8f6e' : '#0a5c42';
  for (let i = 0; i < 5; i++) {
    const bx = (width / 5) * i + 45 - floorDrift * 0.6;
    const sway = Math.sin(state.timeMs * 0.0009 + i * 1.7) * 8;
    ctx.beginPath();
    ctx.moveTo(bx - 4, height);
    ctx.quadraticCurveTo(bx + sway, height - 32, bx - 2, height - 54);
    ctx.quadraticCurveTo(bx + 3, height - 30, bx + 4, height);
    ctx.closePath();
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
  // Local coordinate convention: the shark travels right -> left, so the
  // HEAD/MOUTH sit at the leftmost (negative x) tip, and the TAIL trails
  // behind at the rightmost (positive x) tip. Every part below is placed
  // relative to that rule so nothing ends up facing the wrong way.
  const r = SHARK_RADIUS;
  ctx.save();
  ctx.translate(shark.x, shark.y);

  // Body: fusiform (torpedo) silhouette, nose to the left, tail base to the right.
  ctx.beginPath();
  ctx.moveTo(-r * 1.55, 0);
  ctx.quadraticCurveTo(-r * 1.2, -r * 0.5, -r * 0.35, -r * 0.5);
  ctx.quadraticCurveTo(r * 0.55, -r * 0.46, r * 1.25, -r * 0.14);
  ctx.quadraticCurveTo(r * 0.55, r * 0.4, -r * 0.35, r * 0.5);
  ctx.quadraticCurveTo(-r * 1.2, r * 0.5, -r * 1.55, 0);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(-r * 1.55, -r * 0.5, r * 1.25, r * 0.5);
  bodyGrad.addColorStop(0, '#8496a5');
  bodyGrad.addColorStop(0.5, '#54697c');
  bodyGrad.addColorStop(1, '#2f3d4a');
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Pale belly underside.
  ctx.beginPath();
  ctx.ellipse(-r * 0.05, r * 0.26, r * 0.95, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#dfe9ee';
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Tail fin (caudal fin): attaches at the tail base on the RIGHT, classic
  // shark shape with a taller upper lobe and a shorter lower lobe.
  ctx.beginPath();
  ctx.moveTo(r * 1.15, -r * 0.06);
  ctx.quadraticCurveTo(r * 1.55, -r * 0.7, r * 2.05, -r * 1.05);
  ctx.quadraticCurveTo(r * 1.75, -r * 0.35, r * 1.85, -r * 0.02);
  ctx.quadraticCurveTo(r * 1.7, r * 0.32, r * 2.0, r * 0.68);
  ctx.quadraticCurveTo(r * 1.5, r * 0.42, r * 1.15, r * 0.1);
  ctx.closePath();
  ctx.fillStyle = '#3d4d5c';
  ctx.fill();

  // Dorsal fin: centered above the midpoint of the body.
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r * 0.46);
  ctx.lineTo(-r * 0.02, -r * 1.18);
  ctx.lineTo(r * 0.32, -r * 0.4);
  ctx.closePath();
  ctx.fillStyle = '#4a5c6c';
  ctx.fill();

  // Pectoral fin: below and slightly behind the head, angled back toward the tail.
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, r * 0.22);
  ctx.lineTo(-r * 0.15, r * 0.85);
  ctx.lineTo(r * 0.15, r * 0.32);
  ctx.closePath();
  ctx.fillStyle = '#3d4d5c';
  ctx.fill();

  // Gill lines, just behind the head.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.95 + i * 5, -r * 0.3);
    ctx.lineTo(-r * 1.02 + i * 5, r * 0.08);
    ctx.stroke();
  }

  // Eye, near the nose.
  ctx.beginPath();
  ctx.arc(-r * 1.18, -r * 0.1, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1116';
  ctx.fill();

  // Mouth with a hint of teeth, right at the nose tip (leading edge).
  ctx.beginPath();
  ctx.moveTo(-r * 1.5, r * 0.06);
  ctx.quadraticCurveTo(-r * 1.28, r * 0.26, -r * 0.95, r * 0.16);
  ctx.strokeStyle = '#1c2530';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const tx = -r * 1.44 + i * 0.18 * r;
    ctx.beginPath();
    ctx.moveTo(tx, r * 0.08);
    ctx.lineTo(tx + r * 0.04, r * 0.18);
    ctx.lineTo(tx + r * 0.08, r * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBubbleBoost(ctx: CanvasRenderingContext2D, boost: BubbleBoost, timeMs: number) {
  if (boost.collected) return;
  const pulse = (Math.sin(boost.pulse * 0.5) + 1) / 2;
  const r = 15 + pulse * 2;
  const bob = Math.sin(timeMs * 0.0016 + boost.x) * 1.6;
  ctx.save();
  ctx.translate(boost.x, boost.y + bob);
  ctx.globalAlpha = 0.22 + pulse * 0.1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#bff2ff';
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#e8feff';
  ctx.lineWidth = 2.2;
  ctx.shadowColor = '#7fe8ff';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.32, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.restore();
}

function drawTreasure(ctx: CanvasRenderingContext2D, chest: Treasure, timeMs: number) {
  if (chest.collected) return;
  const bob = Math.sin(timeMs * 0.0014 + chest.x) * 1.4;
  const glow = (Math.sin(chest.pulse * 0.5) + 1) / 2;
  ctx.save();
  ctx.translate(chest.x, chest.y + bob);
  ctx.shadowColor = '#ffd60a';
  ctx.shadowBlur = 9 + glow * 3;
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
  // Gentle tail flutter: a small oscillating angle applied to the tail's
  // vertical spread, purely cosmetic (collision still uses BASE.fishRadius).
  const wag = Math.sin(state.timeMs * 0.009) * 0.12;
  ctx.save();
  ctx.rotate(wag);
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
  // Soft gloss highlight along the upper body for a bit of shine without
  // looking overly cartoonish.
  ctx.beginPath();
  ctx.ellipse(-r * 0.05, -r * 0.32, r * 0.42, r * 0.16, -0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();
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
    const magPulse = (Math.sin(state.timeMs * 0.003) + 1) / 2;
    ctx.save();
    ctx.shadowColor = '#ff6d00';
    ctx.shadowBlur = 26 + magPulse * 8;
    ctx.globalAlpha = 0.35 + magPulse * 0.15;
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
  // Gentle float + a slow horizontal "flip" (scaleX oscillation) so the coin
  // reads as spinning lazily in the water rather than jittering in place.
  const bob = Math.sin(timeMs * 0.0016 + coin.x) * 1.4;
  const spin = Math.cos(timeMs * 0.0011 + coin.x * 0.4);
  const radius = coin.bonus ? 12 : 9;
  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
  ctx.scale(Math.max(0.35, Math.abs(spin)), 1);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = coin.bonus ? '#ff9500' : '#ffd60a';
  ctx.shadowColor = coin.bonus ? '#ffb347' : '#fff275';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#a97400';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (spin > 0) {
    ctx.fillStyle = '#fff8e0';
    ctx.font = `${coin.bonus ? 11 : 9}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(coin.bonus ? '+5' : '+1', 0, 0);
  }
  ctx.restore();
}

function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, timeMs: number) {
  if (gem.collected) return;
  const bob = Math.sin(timeMs * 0.0015 + gem.x) * 1.4;
  const pulse = (Math.sin(gem.pulse * 0.6) + 1) / 2;
  const scale = 0.95 + pulse * 0.08;
  const wobble = Math.sin(timeMs * 0.0009 + gem.x) * 0.06;
  ctx.save();
  ctx.translate(gem.x, gem.y + bob);
  ctx.rotate(wobble);
  ctx.scale(scale, scale);
  ctx.shadowColor = '#ff5c7a';
  ctx.shadowBlur = 14;
  // A clean heart silhouette (two lobes + a point) so a "life" pickup reads
  // instantly, drawn with cubic curves rather than an emoji glyph.
  const s = 11;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.85);
  ctx.bezierCurveTo(-s * 1.35, s * 0.05, -s * 0.95, -s * 0.95, 0, -s * 0.35);
  ctx.bezierCurveTo(s * 0.95, -s * 0.95, s * 1.35, s * 0.05, 0, s * 0.85);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, '#ffe0e8');
  grad.addColorStop(0.45, '#ff7d9a');
  grad.addColorStop(1, '#e8365a');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Small glossy highlight for a bit of life.
  ctx.beginPath();
  ctx.ellipse(-s * 0.35, -s * 0.15, s * 0.22, s * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, timeMs: number) {
  if (pu.collected) return;
  const bob = Math.sin(timeMs * 0.0016 + pu.x) * 1.4;
  const glow = (Math.sin(timeMs * 0.0025 + pu.x) + 1) / 2;
  ctx.save();
  ctx.translate(pu.x, pu.y + bob);
  if (pu.type === 'shield') {
    ctx.shadowColor = '#4fc3f7';
    ctx.shadowBlur = 10 + glow * 5;
    // Vector shield badge: rounded-top pentagon, drawn (no emoji/external art).
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.quadraticCurveTo(8, -8, 8, -2);
    ctx.quadraticCurveTo(8, 6, 0, 11);
    ctx.quadraticCurveTo(-8, 6, -8, -2);
    ctx.quadraticCurveTo(-8, -8, 0, -10);
    ctx.closePath();
    const shieldGrad = ctx.createLinearGradient(0, -10, 0, 11);
    shieldGrad.addColorStop(0, '#bfeaff');
    shieldGrad.addColorStop(0.5, '#4fc3f7');
    shieldGrad.addColorStop(1, '#1c8fd4');
    ctx.fillStyle = shieldGrad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e3f2fd';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Small check-like accent in the middle.
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(-0.5, 3);
    ctx.lineTo(4, -3.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    ctx.shadowColor = '#ff6d00';
    ctx.shadowBlur = 8 + glow * 5;
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.ellipse(-2, -3, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2, 3, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
