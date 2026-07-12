// -----------------------------------------------------------------------
// Entity shapes + tuning constants for the Golden Fish Rush game engine.
//
// This file only holds data: interfaces describing every moving piece on
// screen (obstacles, coins, sharks, particles, ...) and the small numeric
// constants that tune their behavior. No physics, no rendering — those
// live in engine.ts (simulation) and render.ts (drawing) respectively.
// Split out of engine.ts as a pure move (no logic changed) so the engine
// module isn't a 1000+ line catch-all.
// -----------------------------------------------------------------------

import type { SkinId } from './types';

export interface Obstacle {
  x: number;
  gapY: number;
  gapSize: number;
  passed: boolean;
  bobbing: boolean;
  bobPhase: number;
  bobAmount: number;
  glowing: boolean;
  isDouble: boolean;
  nearMissAwarded: boolean;
}

export interface Shark {
  x: number;
  y: number;
  baseY: number;
  bobPhase: number;
  speedMult: number;
  minDist: number;
  nearMissAwarded: boolean;
}

export interface BubbleBoost {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
}

export interface Treasure {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
  amount: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export interface DistantFish {
  x: number;
  y: number;
  scale: number;
  speed: number;
  flip: boolean;
}

export interface Coin {
  x: number;
  y: number;
  collected: boolean;
  bonus: boolean;
}

export interface Gem {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
}

export interface PowerUp {
  x: number;
  y: number;
  type: 'shield' | 'magnet';
  collected: boolean;
  pulse: number;
}

export interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface EngineCallbacks {
  onScore: (score: number) => void;
  onCoinCollect: (total: number) => void;
  onDeath: () => void;
  onShake: (intensity: number) => void;
  onGemCollect?: (lives: number) => void;
  onLifeChange?: (lives: number) => void;
}

export interface EngineState {
  width: number;
  height: number;
  fishY: number;
  fishVY: number;
  fishRotation: number;
  score: number;
  running: boolean;
  invincibleUntil: number;
  obstacles: Obstacle[];
  coins: Coin[];
  gems: Gem[];
  powerUps: PowerUp[];
  bubbles: Bubble[];
  particles: Particle[];
  elapsedSinceSpawn: number;
  skin: SkinId;
  shakeIntensity: number;
  timeMs: number;
  legendaryPulse: number;
  lives: number;
  maxLives: number;
  shieldCharges: number;
  magnetUntil: number;
  gemBoostActive: boolean;
  // --- New gameplay systems ---
  sharks: Shark[];
  bubbleBoosts: BubbleBoost[];
  treasures: Treasure[];
  floatingTexts: FloatingText[];
  distantFish: DistantFish[];
  elapsedSinceSharkSpawn: number;
  elapsedSinceBubbleBoostSpawn: number;
  elapsedSinceTreasureSpawn: number;
  comboCount: number;
  comboWindowEnd: number;
  comboStage: number;
  comboBadge: { text: string; until: number } | null;
  hitFlashUntil: number;
}

export const FISH_X_RATIO = 0.28;
export const MAX_EXTRA_LIVES = 2;
export const GEM_SPAWN_CHANCE = 0.09;
export const HIT_INVINCIBILITY_MS = 1700;
export const SAFE_REVIVE_DELAY_MS = 900;
export const SHARK_RADIUS = 26;
export const COMBO_WINDOW_MS = 1700;
export const COMBO_STAGE_2_COUNT = 3;
export const COMBO_STAGE_3_COUNT = 6;
export const COMBO_STAGE_4_COUNT = 10;
export const NEAR_MISS_MARGIN = 22;
export const BUBBLE_BOOST_MAGNET_MS = 5000;
export const BUBBLE_BOOST_BONUS_COINS = 3;
