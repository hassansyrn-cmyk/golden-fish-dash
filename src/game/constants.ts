import type { AchievementDef, DailyChallengeDef, SkinDef } from './types';

export const VERSION = 'v1.0.0';

export const STORAGE_KEYS = {
  personalBest: 'gfr_personal_best',
  coins: 'gfr_coins',
  selectedSkin: 'gfr_selected_skin',
  unlockedSkins: 'gfr_unlocked_skins',
  achievements: 'gfr_achievements',
  leaderboard: 'gfr_leaderboard',
  settings: 'gfr_settings',
  dailyChallenge: 'gfr_daily_challenge',
  roundsPlayed: 'gfr_rounds_played',
  usedSecondChanceEver: 'gfr_used_second_chance_ever',
  gameOverCount: 'gfr_game_over_count',
  shopInventory: 'gfr_shop_inventory',
  dailyReward: 'gfr_daily_reward',
} as const;

// Base gameplay tuning. Difficulty scales off these values as score increases.
export const BASE = {
  gravity: 0.55,
  jumpVelocity: -8.6,
  maxFallSpeed: 11,
  fishRadius: 18,
  obstacleWidth: 64,
  baseGap: 190,
  minGap: 118,
  baseSpeed: 2.6,
  maxSpeed: 6.2,
  spawnInterval: 1650,
};

export const SKINS: SkinDef[] = [
  {
    id: 'golden',
    name: 'Goldfish',
    unlockScore: 0,
    colors: {
      body: '#ff9f1c',
      belly: '#fff0c2',
      fin: '#ff7b00',
      glow: '#ffd166',
    },
  },
  {
    id: 'ruby',
    name: 'Betta',
    unlockScore: 25,
    colors: {
      body: '#c1121f',
      belly: '#ffccd5',
      fin: '#780000',
      glow: '#ff4d6d',
    },
  },
  {
    id: 'emerald',
    name: 'Mandarin',
    unlockScore: 50,
    colors: {
      body: '#0077b6',
      belly: '#90e0ef',
      fin: '#00b4d8',
      glow: '#48cae4',
    },
  },
  {
    id: 'diamond',
    name: 'Discus',
    unlockScore: 100,
    colors: {
      body: '#4cc9f0',
      belly: '#f0f9ff',
      fin: '#4361ee',
      glow: '#a5d8ff',
    },
  },
  {
    id: 'legendary',
    name: 'Moorish Idol',
    unlockScore: 200,
    colors: {
      body: '#ffd60a',
      belly: '#fffbe6',
      fin: '#1a1a1a',
      glow: '#ffe066',
    },
  },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_flight', name: 'First Flight', description: 'Play your first game.' },
  { id: 'getting_better', name: 'Getting Better', description: 'Score 10 in a single run.' },
  { id: 'deep_diver', name: 'Deep Diver', description: 'Score 25 in a single run.' },
  { id: 'ocean_master', name: 'Ocean Master', description: 'Score 50 in a single run.' },
  { id: 'legendary_swimmer', name: 'Legendary Swimmer', description: 'Score 100 in a single run.' },
  { id: 'coin_collector', name: 'Coin Collector', description: 'Collect 50 coins total.' },
  { id: 'comeback', name: 'Comeback', description: 'Use a second chance once.' },
  { id: 'persistent_player', name: 'Persistent Player', description: 'Play 10 rounds.' },
];

// Pool of daily challenges; one is deterministically chosen per calendar day.
export const DAILY_CHALLENGE_POOL: DailyChallengeDef[] = [
  { id: 'score_20', description: 'Score 20 points today', target: 20, metric: 'score', rewardCoins: 15 },
  { id: 'collect_10_coins', description: 'Collect 10 coins today', target: 10, metric: 'coins', rewardCoins: 10 },
  { id: 'reach_hard_mode', description: 'Reach Hard Mode today (score 26+)', target: 1, metric: 'hardMode', rewardCoins: 12 },
];

// Sample seed data so the leaderboard doesn't look empty before a real
// backend exists. These are clearly fictional placeholder entries.
export const SAMPLE_GLOBAL_SCORES: { name: string; score: number }[] = [
  { name: 'AquaAce', score: 187 },
  { name: 'ReefRunner', score: 154 },
  { name: 'BubbleBaron', score: 132 },
  { name: 'CoralKing', score: 109 },
  { name: 'FinFlash', score: 96 },
  { name: 'PearlDiver', score: 81 },
  { name: 'TideTracer', score: 67 },
  { name: 'WaveWhiz', score: 54 },
  { name: 'ShoalStar', score: 41 },
  { name: 'DriftFish', score: 29 },
];

export function dateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function getDifficultyTier(score: number): {
  name: string;
  bg: [string, string];
} {
  if (score >= 100) return { name: 'Legendary', bg: ['#1a0f2e', '#3d1a5c'] };
  if (score >= 51) return { name: 'Expert', bg: ['#020c1b', '#04203f'] };
  if (score >= 26) return { name: 'Hard', bg: ['#032b3a', '#04425a'] };
  if (score >= 11) return { name: 'Medium', bg: ['#04395e', '#0a6ea8'] };
  return { name: 'Easy', bg: ['#4fc3e8', '#0a83c2'] };
}
