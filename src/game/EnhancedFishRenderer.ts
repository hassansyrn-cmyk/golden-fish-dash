/**
 * Enhanced Fish Renderer with Advanced Graphics
 * Smooth animations, trails, and detailed visual effects
 */

export type FishSkinId = 
  | 'golden' 
  | 'silver' 
  | 'neon' 
  | 'rainbow' 
  | 'deep-sea' 
  | 'crystal';

export interface FishSkin {
  id: FishSkinId;
  primaryColor: string;
  accentColor: string;
  trailColor: string;
  glowColor: string;
}

const FISH_SKINS: Record<FishSkinId, FishSkin> = {
  golden: {
    id: 'golden',
    primaryColor: '#ffd60a',
    accentColor: '#ffb703',
    trailColor: 'rgba(255, 214, 10, 0.4)',
    glowColor: 'rgba(255, 214, 10, 0.6)',
  },
  silver: {
    id: 'silver',
    primaryColor: '#e0e0e0',
    accentColor: '#b0b0b0',
    trailColor: 'rgba(224, 224, 224, 0.3)',
    glowColor: 'rgba(200, 200, 200, 0.5)',
  },
  neon: {
    id: 'neon',
    primaryColor: '#00ff88',
    accentColor: '#00cc6a',
    trailColor: 'rgba(0, 255, 136, 0.3)',
    glowColor: 'rgba(0, 255, 136, 0.8)',
  },
  rainbow: {
    id: 'rainbow',
    primaryColor: '#ff00ff',
    accentColor: '#00ffff',
    trailColor: 'rgba(255, 0, 255, 0.3)',
    glowColor: 'rgba(0, 255, 255, 0.6)',
  },
  'deep-sea': {
    id: 'deep-sea',
    primaryColor: '#1a5f7a',
    accentColor: '#0d3d52',
    trailColor: 'rgba(79, 227, 193, 0.3)',
    glowColor: 'rgba(79, 227, 193, 0.5)',
  },
  crystal: {
    id: 'crystal',
    primaryColor: '#87ceeb',
    accentColor: '#4fa3d1',
    trailColor: 'rgba(135, 206, 235, 0.4)',
    glowColor: 'rgba(135, 206, 235, 0.7)',
  },
};

export class EnhancedFishRenderer {
  private skin: FishSkin;
  private animationTime = 0;
  private trailPoints: Array<{ x: number; y: number; age: number }> = [];
  private maxTrailPoints = 20;
  private damageFlash = 0;
  private damageFlashDuration = 150;

  constructor(skinId: FishSkinId = 'golden') {
    this.skin = FISH_SKINS[skinId];
  }

  /**
   * Update fish animation state
   */
  update(deltaTime: number = 16) {
    this.animationTime += deltaTime;
    
    // Age trail points
    this.trailPoints = this.trailPoints.map(p => ({
      ...p,
      age: p.age + 1,
    })).filter(p => p.age < 30);

    // Decrease damage flash
    if (this.damageFlash > 0) {
      this.damageFlash -= deltaTime;
    }
  }

  /**
   * Add point to trail
   */
  addTrailPoint(x: number, y: number) {
    this.trailPoints.push({ x, y, age: 0 });
    if (this.trailPoints.length > this.maxTrailPoints) {
      this.trailPoints.shift();
    }
  }

  /**
   * Trigger damage flash effect
   */
  triggerDamageFlash() {
    this.damageFlash = this.damageFlashDuration;
  }

  /**
   * Render fish with advanced graphics
   */
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    velocityX: number,
    isShielded: boolean = false
  ) {
    ctx.save();

    // Draw trail
    this.drawTrail(ctx, x, y);

    // Calculate rotation based on velocity
    const rotation = Math.atan2(velocityX, 1) * 0.3; // Subtle tilt

    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Draw glow effect
    this.drawGlow(ctx, radius, isShielded);

    // Draw main fish body
    this.drawFishBody(ctx, radius);

    // Draw fins
    this.drawFins(ctx, radius);

    // Draw eye
    this.drawEye(ctx, radius);

    // Draw damage flash overlay
    if (this.damageFlash > 0) {
      const flashOpacity = this.damageFlash / this.damageFlashDuration;
      ctx.fillStyle = `rgba(255, 100, 100, ${flashOpacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shield effect
    if (isShielded) {
      this.drawShield(ctx, radius);
    }

    ctx.restore();
  }

  private drawTrail(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (this.trailPoints.length < 2) return;

    for (let i = 0; i < this.trailPoints.length; i++) {
      const point = this.trailPoints[i];
      const opacity = 1 - point.age / 30;
      const size = (point.age / 30) * 4;

      ctx.fillStyle = this.skin.trailColor.replace('0.', `${opacity * 0.3}.`);
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGlow(ctx: CanvasRenderingContext2D, radius: number, isShielded: boolean) {
    const glowRadius = radius + 8;
    const gradient = ctx.createRadialGradient(0, 0, radius, 0, 0, glowRadius);
    
    if (isShielded) {
      gradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    } else {
      gradient.addColorStop(0, this.skin.glowColor);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFishBody(ctx: CanvasRenderingContext2D, radius: number) {
    // Main body ellipse
    ctx.fillStyle = this.skin.primaryColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.2, radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body accent
    ctx.fillStyle = this.skin.accentColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.8, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.3, -radius * 0.2, radius * 0.4, radius * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFins(ctx: CanvasRenderingContext2D, radius: number) {
    const time = this.animationTime * 0.01;
    const finWave = Math.sin(time) * 0.3;

    // Top fin
    ctx.fillStyle = this.skin.accentColor;
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(radius * 0.4, -radius * 1.2 + finWave * 5);
    ctx.lineTo(-radius * 0.4, -radius * 1.2 + finWave * 5);
    ctx.closePath();
    ctx.fill();

    // Bottom fin
    ctx.beginPath();
    ctx.moveTo(0, radius);
    ctx.lineTo(radius * 0.4, radius * 1.2 - finWave * 5);
    ctx.lineTo(-radius * 0.4, radius * 1.2 - finWave * 5);
    ctx.closePath();
    ctx.fill();

    // Side fins
    const sideFinWave = Math.sin(time * 0.5) * 0.2;
    ctx.fillStyle = this.skin.primaryColor;

    // Left fin
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, 0);
    ctx.lineTo(-radius * 1.3 - sideFinWave * 5, radius * 0.4);
    ctx.lineTo(-radius * 1.3 - sideFinWave * 5, -radius * 0.4);
    ctx.closePath();
    ctx.fill();

    // Right fin
    ctx.beginPath();
    ctx.moveTo(radius * 0.6, 0);
    ctx.lineTo(radius * 1.1 + sideFinWave * 3, radius * 0.35);
    ctx.lineTo(radius * 1.1 + sideFinWave * 3, -radius * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  private drawEye(ctx: CanvasRenderingContext2D, radius: number) {
    // Eye white
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(radius * 0.4, -radius * 0.2, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(radius * 0.45, -radius * 0.15, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(radius * 0.5, -radius * 0.2, radius * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawShield(ctx: CanvasRenderingContext2D, radius: number) {
    const shieldRadius = radius + 15;
    const time = (this.animationTime * 0.01) % (Math.PI * 2);

    // Shield glow
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Shield pulses
    ctx.strokeStyle = `rgba(0, 255, 255, ${Math.sin(time * 2) * 0.5 + 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius - 5, 0, Math.PI * 2);
    ctx.stroke();

    // Shield segments
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const x1 = Math.cos(angle) * radius;
      const y1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle) * shieldRadius;
      const y2 = Math.sin(angle) * shieldRadius;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  /**
   * Change fish skin
   */
  setSkin(skinId: FishSkinId) {
    if (FISH_SKINS[skinId]) {
      this.skin = FISH_SKINS[skinId];
    }
  }

  /**
   * Get current skin
   */
  getSkin(): FishSkin {
    return this.skin;
  }

  /**
   * Get available skins
   */
  static getAvailableSkins(): FishSkinId[] {
    return Object.keys(FISH_SKINS) as FishSkinId[];
  }

  /**
   * Reset animation state
   */
  reset() {
    this.animationTime = 0;
    this.trailPoints = [];
    this.damageFlash = 0;
  }
}
