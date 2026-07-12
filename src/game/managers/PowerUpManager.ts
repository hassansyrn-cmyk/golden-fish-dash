/**
 * PowerUpManager - Phase 2
 * Manages active power-ups during a run.
 * 
 * New power-ups added in Phase 2:
 * - Dash (temporary speed boost / forward dash)
 * - Extra Heart
 * - Coin Multiplier (already partially via difficulty + combo)
 * 
 * Future: Slow Motion, Ghost Mode, Invincibility, Fever Mode, etc.
 */

export type ActivePowerUp =
  | { type: 'dash'; endTime: number; strength: number }
  | { type: 'extraHeart'; amount: number }
  | { type: 'coinMultiplier'; multiplier: number; endTime: number }
  | { type: 'slowMotion'; endTime: number }
  | { type: 'invincibility'; endTime: number };

export class PowerUpManager {
  private active: ActivePowerUp[] = [];

  activate(powerUp: ActivePowerUp): void {
    this.active.push(powerUp);
  }

  update(now: number): void {
    this.active = this.active.filter(p => {
      if ('endTime' in p && p.endTime < now) return false;
      return true;
    });
  }

  has(type: string): boolean {
    return this.active.some(p => p.type === type);
  }

  getDashStrength(): number {
    const dash = this.active.find(p => p.type === 'dash') as any;
    return dash ? dash.strength : 1;
  }

  getCoinMultiplier(): number {
    const mult = this.active.find(p => p.type === 'coinMultiplier') as any;
    return mult ? mult.multiplier : 1;
  }

  isInvincible(): boolean {
    return this.active.some(p => p.type === 'invincibility');
  }

  reset(): void {
    this.active = [];
  }

  getActivePowerUps(): ActivePowerUp[] {
    return [...this.active];
  }
}

export const powerUpManager = new PowerUpManager();
