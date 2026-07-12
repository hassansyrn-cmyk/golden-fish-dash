/**
 * Power-Up System
 * Adds special collectibles that grant temporary abilities
 */

export type PowerUpType = 'shield' | 'speedBoost' | 'magnet' | 'slowTime';

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  active: boolean;
  collectedAt: number;
  duration: number;
}

export interface ActivePowerUp {
  type: PowerUpType;
  startTime: number;
  duration: number;
  remainingTime: number;
}

export class PowerUpSystem {
  private powerUps: PowerUp[] = [];
  private activePowerUps: Map<PowerUpType, ActivePowerUp> = new Map();
  private spawnProbability = 0.02; // 2% chance per frame
  private nextId = 0;

  /**
   * Check if a specific power-up is active
   */
  isActive(type: PowerUpType): boolean {
    const powerUp = this.activePowerUps.get(type);
    return powerUp ? powerUp.remainingTime > 0 : false;
  }

  /**
   * Get remaining time for a power-up
   */
  getRemainingTime(type: PowerUpType): number {
    const powerUp = this.activePowerUps.get(type);
    return powerUp ? Math.max(0, powerUp.remainingTime) : 0;
  }

  /**
   * Activate a power-up when collected
   */
  activatePowerUp(type: PowerUpType) {
    const duration = this.getDuration(type);
    this.activePowerUps.set(type, {
      type,
      startTime: Date.now(),
      duration,
      remainingTime: duration,
    });
  }

  private getDuration(type: PowerUpType): number {
    switch (type) {
      case 'shield': return 8000; // 8 seconds
      case 'speedBoost': return 6000; // 6 seconds
      case 'magnet': return 10000; // 10 seconds
      case 'slowTime': return 5000; // 5 seconds
      default: return 5000;
    }
  }

  /**
   * Spawn power-ups randomly in game area
   */
  spawnPowerUp(x: number, y: number): PowerUp | null {
    if (Math.random() > this.spawnProbability) return null;

    const types: PowerUpType[] = ['shield', 'speedBoost', 'magnet', 'slowTime'];
    const type = types[Math.floor(Math.random() * types.length)];

    const powerUp: PowerUp = {
      id: `powerup-${this.nextId++}`,
      x,
      y,
      type,
      active: true,
      collectedAt: 0,
      duration: this.getDuration(type),
    };

    this.powerUps.push(powerUp);
    return powerUp;
  }

  /**
   * Check collision with fish and collect power-ups
   */
  checkCollisions(fishX: number, fishY: number, fishRadius: number): PowerUpType[] {
    const collected: PowerUpType[] = [];

    this.powerUps = this.powerUps.filter(powerUp => {
      if (!powerUp.active) return false;

      const dx = fishX - powerUp.x;
      const dy = fishY - powerUp.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < fishRadius + 12) {
        this.activatePowerUp(powerUp.type);
        collected.push(powerUp.type);
        return false; // Remove from list
      }

      return true;
    });

    return collected;
  }

  /**
   * Update active power-ups
   */
  update() {
    this.activePowerUps.forEach((powerUp, type) => {
      const elapsed = Date.now() - powerUp.startTime;
      powerUp.remainingTime = powerUp.duration - elapsed;

      if (powerUp.remainingTime <= 0) {
        this.activePowerUps.delete(type);
      }
    });
  }

  /**
   * Render power-ups on canvas
   */
  render(ctx: CanvasRenderingContext2D) {
    this.powerUps.forEach(powerUp => {
      if (!powerUp.active) return;

      ctx.save();

      // Animated rotation
      const rotation = (Date.now() * 0.003) % (Math.PI * 2);
      ctx.translate(powerUp.x, powerUp.y);
      ctx.rotate(rotation);

      // Glow effect
      ctx.shadowColor = this.getPowerUpColor(powerUp.type);
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Draw power-up icon
      this.drawPowerUpIcon(ctx, powerUp.type, 12);

      ctx.restore();

      // Draw aura/pulse
      ctx.strokeStyle = this.getPowerUpColor(powerUp.type);
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.beginPath();
      ctx.arc(powerUp.x, powerUp.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  private drawPowerUpIcon(ctx: CanvasRenderingContext2D, type: PowerUpType, size: number) {
    ctx.fillStyle = this.getPowerUpColor(type);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    switch (type) {
      case 'shield':
        // Shield icon
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, -size * 0.5);
        ctx.lineTo(size * 0.6, size * 0.8);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.6, size * 0.8);
        ctx.lineTo(-size, -size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'speedBoost':
        // Lightning bolt
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.4, -size * 0.3);
        ctx.lineTo(size * 0.2, size * 0.4);
        ctx.lineTo(size * 0.6, size * 0.2);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.4, size * 0.3);
        ctx.lineTo(-size * 0.2, -size * 0.4);
        ctx.lineTo(-size * 0.6, -size * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'magnet':
        // Magnet icon
        ctx.fillRect(-size * 0.3, -size, size * 0.6, size * 0.8);
        ctx.fillRect(-size * 0.3, size * 0.2, size * 0.6, size * 0.8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-size * 0.15, -size * 0.2, size * 0.3, size * 0.4);
        break;

      case 'slowTime':
        // Hourglass/clock
        ctx.beginPath();
        ctx.arc(0, -size * 0.5, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, size * 0.5, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeRect(-size * 0.2, -size * 0.1, size * 0.4, size * 0.2);
        break;
    }
  }

  private getPowerUpColor(type: PowerUpType): string {
    switch (type) {
      case 'shield': return '#00d9ff';
      case 'speedBoost': return '#ff9500';
      case 'magnet': return '#ff00ff';
      case 'slowTime': return '#4fe3c1';
      default: return '#ffd60a';
    }
  }

  /**
   * Render active power-up indicators in HUD
   */
  renderHUD(ctx: CanvasRenderingContext2D, x: number, y: number) {
    let offsetX = 0;
    this.activePowerUps.forEach((powerUp, type) => {
      if (powerUp.remainingTime > 0) {
        // Draw icon
        ctx.save();
        ctx.translate(x + offsetX, y);
        this.drawPowerUpIcon(ctx, type, 8);
        ctx.restore();

        // Draw timer
        const timeInSeconds = (powerUp.remainingTime / 1000).toFixed(1);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(timeInSeconds, x + offsetX - 8, y + 18);

        offsetX += 30;
      }
    });
  }

  /**
   * Get modifier values for active power-ups
   */
  getModifiers() {
    return {
      speedMultiplier: this.isActive('speedBoost') ? 1.5 : 1,
      hasShield: this.isActive('shield'),
      magnetRange: this.isActive('magnet') ? 80 : 30,
      timeScale: this.isActive('slowTime') ? 0.5 : 1,
    };
  }

  /**
   * Clear all power-ups
   */
  reset() {
    this.powerUps = [];
    this.activePowerUps.clear();
  }
}
