/**
 * Game Managers (PowerUpManager, AudioManager, DifficultyManager, EconomyManager, etc.)
 * Phase 1: Foundation for clean architecture
 */

export interface Manager {
  init(): void;
  update?(dt: number): void;
  reset(): void;
}
