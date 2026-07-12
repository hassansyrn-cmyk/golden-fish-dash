// Shared type definitions for Golden Fish Rush

export type SkinId = 'golden' | 'ruby' | 'emerald' | 'diamond' | 'legendary';

export type SkinAbility =
  | 'lucky_catch'      // More coins spawn
  | 'fighter'          // Bonus score from passing obstacles
  | 'collector'        // Higher coin value
  | 'precious'         // Higher gem spawn chance
  | 'royal_presence';  // Start with 1 shield charge

export interface SkinDef {
  id: SkinId;
  name: string;
  unlockScore: number;
  colors: { body: string; belly: string; fin: string; glow: string };
  ability: SkinAbility;
  abilityDescription: string;
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
  | 'settings'
  | 'shop'
  | 'dailyRewards';

export type PowerUpType = 'shield' | 'magnet';

export interface PowerUpState {
  shieldCharges: number;
  magnetUntil: number; // timestamp when magnet expires, 0 if inactive
}

export type ShopItemId = 'shield' | 'magnet' | 'gemBoost' | 'continueToken' | 'dash';

export interface ShopInventory {
  shield: number;
  magnet: number;
  gemBoost: number;
  continueToken: number;
  dash: number;
}

// === PHASE 3: Upgrade Levels ===
export interface UpgradeLevel {
  level: number;
  cost: number;
  effect: string; // description of what this level does
}

export const UPGRADE_LEVELS: Record<ShopItemId, UpgradeLevel[]> = {
  shield: [
    { level: 1, cost: 80, effect: '1 charge' },
    { level: 2, cost: 150, effect: '2 charges + longer duration' },
    { level: 3, cost: 280, effect: '3 charges + stronger protection' },
  ],
  magnet: [
    { level: 1, cost: 70, effect: '8 seconds' },
    { level: 2, cost: 130, effect: '12 seconds' },
    { level: 3, cost: 240, effect: '18 seconds + stronger pull' },
  ],
  gemBoost: [
    { level: 1, cost: 90, effect: 'Basic boost' },
    { level: 2, cost: 170, effect: 'Stronger boost' },
    { level: 3, cost: 320, effect: 'Maximum boost + extra life chance' },
  ],
  dash: [
    { level: 1, cost: 100, effect: 'Basic dash' },
    { level: 2, cost: 190, effect: 'Longer dash + stronger boost' },
    { level: 3, cost: 350, effect: 'Ultimate dash with invincibility' },
  ],
  continueToken: [
    { level: 1, cost: 60, effect: 'Basic continue' },
  ],
};

export interface DailyRewardState {
  lastClaimDate: string; // YYYY-MM-DD
  streakDay: number; // 1 to 7, loops back
}
