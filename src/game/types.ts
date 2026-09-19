// Shared type definitions for Golden Fish Rush

// Ocean Legends heroes (mako/ember/nyx) coexist with the production premium
// skins (sapphire/solar/poseidonsHeir) on one 11-skin roster.
export type SkinId = 'golden' | 'ruby' | 'emerald' | 'diamond' | 'legendary' | 'mako' | 'ember' | 'nyx' | 'sapphire' | 'solar' | 'poseidonsHeir';

export interface SkinDef {
  id: SkinId;
  name: string;
  unlockScore: number;
  unlockMethod?: 'score' | 'poseidon';
  colors: { body: string; belly: string; fin: string; glow: string };
  ability: string;
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

export type AppLanguage = 'en' | 'ar';

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  language: AppLanguage;
  // Ocean Legends accessibility & control options (optional for old saves).
  reducedMotion?: boolean;
  reducedFlashes?: boolean;
  highContrast?: boolean;
  colorblindShapes?: boolean;
  steerMode?: boolean;
  masterVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
}

export type ScreenName =
  | 'loading'
  | 'menu'
  | 'howto'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'continueAd'
  | 'gameover'
  | 'leaderboard'
  | 'settings'
  | 'shop'
  | 'dailyRewards'
  | 'luckySpin'
  | 'chapterMap'
  | 'gallery'
  | 'collection';

export type PowerUpType = 'shield' | 'magnet';

export interface PowerUpState {
  shieldCharges: number;
  magnetUntil: number; // timestamp when magnet expires, 0 if inactive
}

export type ShopItemId = 'shield' | 'magnet' | 'gemBoost' | 'continueToken';

export interface ShopInventory {
  shield: number;
  magnet: number;
  gemBoost: number;
  continueToken: number;
}

export interface DailyRewardState {
  lastClaimDate: string; // YYYY-MM-DD
  streakDay: number; // 1 to 7, loops back
}

// Extra details for custom enhancements:
export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  createdAt: number; // game time elapsed or timestamp
  durationMs: number;
}

export interface MissionDef {
  id: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardCoins: number;
  rewardXP: number;
  claimed: boolean;
}
