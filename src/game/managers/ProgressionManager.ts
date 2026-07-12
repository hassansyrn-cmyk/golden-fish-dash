/**
 * ProgressionManager - Phase 3
 * Handles Player Level, XP, and Level Rewards.
 * 
 * Leveling gives long-term progression and retention.
 */

export interface LevelInfo {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  progress: number; // 0 to 1
}

const BASE_XP_PER_LEVEL = 100;

const LEVEL_REWARDS: Record<number, { coins: number; gems?: number; powerup?: string }> = {
  2: { coins: 50 },
  3: { coins: 80, powerup: 'dash' },
  5: { coins: 150, gems: 5 },
  10: { coins: 300, gems: 10, powerup: 'slowMotion' },
};

export function getLevelInfo(totalXP: number): LevelInfo {
  let level = 1;
  let xpForCurrentLevel = 0;

  while (totalXP >= xpForCurrentLevel + BASE_XP_PER_LEVEL * level) {
    xpForCurrentLevel += BASE_XP_PER_LEVEL * level;
    level++;
  }

  const xpToNext = BASE_XP_PER_LEVEL * level;
  const currentXP = totalXP - xpForCurrentLevel;
  const progress = Math.min(1, currentXP / xpToNext);

  return {
    level,
    currentXP,
    xpToNextLevel: xpToNext,
    progress,
  };
}

export function getLevelRewards(level: number) {
  return LEVEL_REWARDS[level] || { coins: 50 * level };
}

export function addXP(currentTotalXP: number, gainedXP: number): { newTotal: number; leveledUp: boolean; newLevel?: number } {
  const oldLevel = getLevelInfo(currentTotalXP).level;
  const newTotal = currentTotalXP + gainedXP;
  const newLevel = getLevelInfo(newTotal).level;

  return {
    newTotal,
    leveledUp: newLevel > oldLevel,
    newLevel: newLevel > oldLevel ? newLevel : undefined,
  };
}
