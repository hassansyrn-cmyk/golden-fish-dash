/**
 * Game Systems (SpawningSystem, CollisionSystem, DifficultySystem, ParticleSystem, etc.)
 * Phase 1 skeleton - will be populated in Phase 2
 */

export interface System {
  update(dt: number, state: any): void;
  reset?(): void;
}
