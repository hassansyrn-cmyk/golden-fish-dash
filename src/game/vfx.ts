// -----------------------------------------------------------------------
// Professional Visual Effects (VFX) Engine for Golden Fish Dash
// Adds procedural water caustics, radial shockwaves, cavitation bubble
// trails, surface ripples, and bouncy floating combat text.
// -----------------------------------------------------------------------

export interface Shockwave {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

export interface CavitationBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  opacity: number;
  color: string;
}

export interface SurfaceSplash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export class VFXManager {
  private shockwaves: Shockwave[] = [];
  private cavitationBubbles: CavitationBubble[] = [];
  private surfaceSplashes: SurfaceSplash[] = [];

  public triggerShockwave(
    x: number,
    y: number,
    color = 'rgba(80, 220, 255, 0.85)',
    maxRadius = 120,
    speed = 4.5
  ) {
    this.shockwaves.push({
      id: 'sw_' + Math.random(),
      x,
      y,
      radius: 8,
      maxRadius,
      speed,
      alpha: 1.0,
      color,
      lineWidth: 5,
    });
  }

  public emitCavitation(
    x: number,
    y: number,
    speed: number,
    isFever = false,
    colorOverride?: string
  ) {
    const count = isFever ? 4 : speed > 4 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const radius = 1.2 + Math.random() * (isFever ? 3.5 : 2.5);
      const color = colorOverride
        ? colorOverride
        : isFever
        ? `hsl(${(Date.now() / 8 + i * 40) % 360}, 95%, 75%)`
        : 'rgba(230, 250, 255, 0.75)';

      this.cavitationBubbles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: -(1.5 + Math.random() * speed * 0.8),
        vy: (Math.random() - 0.5) * 1.8,
        radius,
        life: 0,
        maxLife: 20 + Math.random() * 25,
        opacity: 0.8,
        color,
      });
    }
  }

  public triggerSurfaceSplash(x: number, y: number) {
    this.surfaceSplashes.push({
      x,
      y,
      radius: 4,
      maxRadius: 28,
      alpha: 0.9,
    });
  }

  public update(dtMs: number) {
    const dt = Math.min(2.0, dtMs / 16.67);

    // 1. Update Shockwaves
    for (const sw of this.shockwaves) {
      sw.radius += sw.speed * dt * 1.8;
      const progress = sw.radius / sw.maxRadius;
      sw.alpha = Math.max(0, 1 - progress);
      sw.lineWidth = Math.max(1, 5 * (1 - progress));
    }
    this.shockwaves = this.shockwaves.filter((sw) => sw.radius < sw.maxRadius && sw.alpha > 0.01);

    // 2. Update Cavitation Bubbles
    for (const cb of this.cavitationBubbles) {
      cb.life += dt;
      cb.x += cb.vx * dt;
      cb.y += cb.vy * dt - 0.15 * dt; // slight buoyancy rise
      cb.opacity = Math.max(0, 0.8 * (1 - cb.life / cb.maxLife));
    }
    this.cavitationBubbles = this.cavitationBubbles.filter((cb) => cb.life < cb.maxLife);

    // 3. Update Surface Splashes
    for (const sp of this.surfaceSplashes) {
      sp.radius += 1.4 * dt;
      sp.alpha = Math.max(0, 0.9 * (1 - sp.radius / sp.maxRadius));
    }
    this.surfaceSplashes = this.surfaceSplashes.filter((sp) => sp.radius < sp.maxRadius);
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Render Shockwaves
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner faint secondary ring for depth
      if (sw.radius > 20) {
        ctx.beginPath();
        ctx.globalAlpha = sw.alpha * 0.5;
        ctx.lineWidth = sw.lineWidth * 0.6;
        ctx.arc(sw.x, sw.y, sw.radius * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Cavitation Bubbles
    for (const cb of this.cavitationBubbles) {
      ctx.save();
      ctx.globalAlpha = cb.opacity;
      ctx.fillStyle = cb.color;
      ctx.beginPath();
      ctx.arc(cb.x, cb.y, cb.radius, 0, Math.PI * 2);
      ctx.fill();

      // Mini highlight shine
      if (cb.radius > 2) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cb.x - cb.radius * 0.3, cb.y - cb.radius * 0.3, cb.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render Surface Splashes
    for (const sp of this.surfaceSplashes) {
      ctx.save();
      ctx.globalAlpha = sp.alpha;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, sp.radius * 1.5, sp.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  public clear() {
    this.shockwaves = [];
    this.cavitationBubbles = [];
    this.surfaceSplashes = [];
  }
}

/**
 * Draws procedural undulating underwater sunlight caustics across the scene.
 */
export function drawProceduralCaustics(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  tintColor = 'rgba(160, 245, 255, 0.075)'
) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = tintColor;

  const t = timeMs * 0.0008;
  const cols = 5;
  const rows = 4;
  const cellW = width / cols;
  const cellH = height / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cx = c * cellW + cellW * 0.5;
      const cy = r * cellH + cellH * 0.5;

      const offsetX = Math.sin(t + c * 1.2 + r * 0.8) * 22;
      const offsetY = Math.cos(t * 0.8 + c * 0.7 + r * 1.3) * 18;
      const radiusX = cellW * 0.45 + Math.sin(t * 1.1 + c) * 12;
      const radiusY = cellH * 0.35 + Math.cos(t * 0.9 + r) * 10;

      ctx.beginPath();
      ctx.ellipse(cx + offsetX, cy + offsetY, Math.max(10, radiusX), Math.max(8, radiusY), (c + r) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Renders shimmering water surface ripples at the top ceiling.
 */
export function drawSurfaceWaterLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  timeMs: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 8);

  const step = 20;
  for (let x = 0; x <= width; x += step) {
    const waveY = 6 + Math.sin(x * 0.04 + timeMs * 0.003) * 3.5 + Math.sin(x * 0.015 - timeMs * 0.002) * 2;
    ctx.lineTo(x, waveY);
  }

  ctx.lineTo(width, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export const vfxManager = new VFXManager();
