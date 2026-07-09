// Shared type definitions for Golden Fish Rush

export type SkinId = 'golden' | 'ruby' | 'emerald' | 'diamond' | 'legendary';

export interface SkinDef {
  id: SkinId;
  name: string;
  unlockScore: number;
  colors: { body: string; belly: string; fin: string; glow: string };
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string; // ISO date
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
}

export interface DailyChallengeDef {
  id: string;
  description: string;
  target: number;
  metric: 'score' | 'coins' | 'hardMode';
  rewardCoins: number;
}

export interface DailyChallengeState {
  dateKey: string;
  challenge: DailyChallengeDef;
  progress: number;
  completed: boolean;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
}

export type ScreenName =
  | 'loading'
  | 'menu'
  | 'howto'
  | 'playing'
  | 'paused'
  | 'continueAd'
  | 'gameover'
  | 'leaderboard'
  | 'settings';
