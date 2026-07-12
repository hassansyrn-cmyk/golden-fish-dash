/**
 * MissionManager - Phase 3
 * Handles Daily, Weekly, and Special Missions.
 * 
 * Builds on the existing daily challenge system.
 */

export interface Mission {
  id: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardCoins: number;
  rewardGems?: number;
  rewardXP?: number;
  type: 'daily' | 'weekly' | 'special';
}

const DAILY_MISSIONS_POOL = [
  { id: 'collect_coins', description: 'Collect 150 Coins', target: 150, rewardCoins: 40 },
  { id: 'play_games', description: 'Play 5 Games', target: 5, rewardCoins: 30 },
  { id: 'reach_score', description: 'Reach Score 80 in one run', target: 80, rewardCoins: 50 },
  { id: 'use_dash', description: 'Use Dash 2 times', target: 2, rewardCoins: 35 },
];

export function getDailyMissions(): Mission[] {
  // In a real implementation, this would be stored and rotated daily
  return DAILY_MISSIONS_POOL.map(m => ({
    ...m,
    progress: 0,
    completed: false,
    type: 'daily' as const,
  }));
}

export function updateMissionProgress(
  missions: Mission[],
  missionId: string,
  amount: number
): { updatedMissions: Mission[]; justCompleted: string | null } {
  let justCompleted: string | null = null;

  const updated = missions.map(mission => {
    if (mission.id === missionId && !mission.completed) {
      const newProgress = Math.min(mission.target, mission.progress + amount);
      const completed = newProgress >= mission.target;

      if (completed && !mission.completed) {
        justCompleted = mission.id;
      }

      return { ...mission, progress: newProgress, completed };
    }
    return mission;
  });

  return { updatedMissions: updated, justCompleted };
}

export function getMissionRewards(mission: Mission) {
  return {
    coins: mission.rewardCoins,
    gems: mission.rewardGems || 0,
    xp: mission.rewardXP || 0,
  };
}
