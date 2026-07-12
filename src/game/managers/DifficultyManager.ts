/**
 * DifficultyManager - Progressive Difficulty System
 * Phase 2: Core gameplay improvement.
 * 
 * Scales:
 * - Speed
 * - Gap size (safe space between obstacles)
 * - Spawn rate
 * - Obstacle variety
 * - Reward value
 * 
 * Driven primarily by elapsed time for the classic "every 30 seconds it gets harder" feel.
 */

export interface DifficultyState {
  speedMultiplier: number;
  gapSize: number;
  spawnInterval: number;
  obstacleVariety: number;
  rewardMultiplier: number;
}

/**
 * Get difficulty based on elapsed time in seconds.
 * Designed so the game feels noticeably harder every ~25 seconds.
 */
export function getDifficultyForTime(elapsedSeconds: number): DifficultyState {
  const tier = Math.floor(elapsedSeconds / 25);

  switch (tier) {
    case 0: // First 25 seconds - welcoming
      return { speedMultiplier: 1.0, gapSize: 185, spawnInterval: 1550, obstacleVariety: 0.15, rewardMultiplier: 1.0 };
    case 1:
      return { speedMultiplier: 1.28, gapSize: 162, spawnInterval: 1320, obstacleVariety: 0.38, rewardMultiplier: 1.12 };
    case 2:
      return { speedMultiplier: 1.58, gapSize: 142, spawnInterval: 1120, obstacleVariety: 0.58, rewardMultiplier: 1.28 };
    case 3:
      return { speedMultiplier: 1.88, gapSize: 128, spawnInterval: 980, obstacleVariety: 0.72, rewardMultiplier: 1.45 };
    default:
      const extra = tier - 3;
      return {
        speedMultiplier: Math.min(2.5, 1.88 + extra * 0.18),
        gapSize: Math.max(108, 128 - extra * 7),
        spawnInterval: Math.max(720, 980 - extra * 70),
        obstacleVariety: Math.min(0.95, 0.72 + extra * 0.07),
        rewardMultiplier: Math.min(2.2, 1.45 + extra * 0.18),
      };
  }
}

/**
 * Fallback / hybrid difficulty based on score (kept for compatibility).
 */
export function getDifficultyForScore(score: number): DifficultyState {
  if (score >= 120) return { speedMultiplier: 2.35, gapSize: 112, spawnInterval: 760, obstacleVariety: 0.92, rewardMultiplier: 1.85 };
  if (score >= 80)  return { speedMultiplier: 1.92, gapSize: 126, spawnInterval: 900, obstacleVariety: 0.78, rewardMultiplier: 1.55 };
  if (score >= 45)  return { speedMultiplier: 1.58, gapSize: 140, spawnInterval: 1060, obstacleVariety: 0.58, rewardMultiplier: 1.28 };
  if (score >= 20)  return { speedMultiplier: 1.28, gapSize: 158, spawnInterval: 1260, obstacleVariety: 0.38, rewardMultiplier: 1.12 };
  return { speedMultiplier: 1.0, gapSize: 185, spawnInterval: 1550, obstacleVariety: 0.15, rewardMultiplier: 1.0 };
}

/**
 * Main function used by the game. Prefers time-based for better player feel.
 */
export function getCurrentDifficulty(elapsedSeconds: number, score: number = 0): DifficultyState {
  return getDifficultyForTime(elapsedSeconds);
}
