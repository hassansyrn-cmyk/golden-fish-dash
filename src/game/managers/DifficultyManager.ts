/**
 * DifficultyManager - Handles progressive difficulty scaling
 * Phase 1 foundation. Will be heavily used in Phase 2.
 * 
 * Current base values live in constants. This manager will calculate:
 * - speed multiplier
 * - gap size
 * - obstacle density
 * - obstacle variety
 * based on time or score.
 */

export interface DifficultyState {
  speedMultiplier: number;
  gapSize: number;
  spawnInterval: number;
  obstacleVariety: number; // 0-1
}

export function getDifficultyForScore(score: number): DifficultyState {
  // Placeholder logic - will be expanded in Phase 2
  if (score >= 100) {
    return { speedMultiplier: 2.2, gapSize: 118, spawnInterval: 900, obstacleVariety: 0.9 };
  }
  if (score >= 50) {
    return { speedMultiplier: 1.7, gapSize: 135, spawnInterval: 1100, obstacleVariety: 0.7 };
  }
  if (score >= 25) {
    return { speedMultiplier: 1.35, gapSize: 155, spawnInterval: 1300, obstacleVariety: 0.5 };
  }
  return { speedMultiplier: 1.0, gapSize: 190, spawnInterval: 1650, obstacleVariety: 0.2 };
}

/**
 * Future: getDifficultyForTime(elapsedSeconds)
 */
