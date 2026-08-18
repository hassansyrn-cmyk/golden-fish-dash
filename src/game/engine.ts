// -----------------------------------------------------------------------
// Core canvas game engine for Golden Fish Rush.
// Power-ups: Shield (protects one hit + invincibility) and Magnet (pulls nearby coins)
// Gem/Life improvement: full lives -> +5 score
// Shop boosts supported: initial shield/magnet/gemBoostActive
// Visual feedback: Shield bubble + Magnet glow added
// -----------------------------------------------------------------------

import { BASE, SKINS } from './constants';
import type { SkinId, FloatingText } from './types';
import { translate } from './i18n';

type EnvironmentId = 'lagoon' | 'coral' | 'kelp' | 'ruins' | 'volcanic' | 'temple' | 'abyss' | 'crystal' | 'moonlit' | 'sunkenCity' | 'aurora' | 'crownReef' | 'eternalTemple';

interface EnvironmentTheme {
  id: EnvironmentId;
  minScore: number;
  label: string;
  top: string;
  mid: string;
  bottom: string;
  ray: string;
  pillarDark: string;
  pillarMid: string;
  pillarLight: string;
  cap: string;
  accent: string;
  speck: string;
}

export interface Obstacle {
  x: number;
  gapY: number;
  baseGapY: number;
  gapSize: number;
  passed: boolean;
  bobbing: boolean;
  bobPhase: number;
  bobAmount: number;
  glowing: boolean;
  isDouble: boolean;
  environment: EnvironmentId;
  nearMissChecked?: boolean;
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
  type: 'shield' | 'magnet' | 'fever' | 'hourglass';
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

type MinionArtId = 'inkJelly' | 'voltfinShark' | 'lureMine' | 'tideSerpent' | 'stormJelly' | 'coralHatchling' | 'abyssMine' | 'riftShark';

export interface PredatorShark {
  id: string;
  x: number;
  y: number;
  baseY: number;
  width: number;
  height: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmount: number;
  speedMultiplier?: number;
  minionArt?: MinionArtId;
  passed: boolean;
}

type BossSummonKind = 'shark' | 'jellyfish' | 'mine';

export interface BubbleBoostRing {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export interface TreasureChest {
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
}

export interface SeaMine {
  id: string;
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  exploded: boolean;
  speedMultiplier?: number;
  minionArt?: MinionArtId;
}

export interface Jellyfish {
  id: string;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmount: number;
  speedMultiplier?: number;
  minionArt?: MinionArtId;
}

type BossId = 'abyssalOctopus' | 'electricManta' | 'abyssalAnglerfish' | 'leviathan' | 'coralKraken' | 'abyssalRazorback' | 'poseidon';
type BossWeapon = 'ink' | 'plasma' | 'electric' | 'bubble' | 'surge' | 'coral' | 'trident';
type BossMotion = 'tentacles' | 'fins' | 'lure' | 'serpent' | 'coralTentacles';
type BossPhase = 'warning' | 'entering' | 'battle' | 'retreating';

interface BossShockwave {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: BossWeapon;
  projectileBossId: BossId;
  speedMultiplier: number;
  phase: 'warning' | 'active';
  activateAt: number;
}

interface BossAttackPattern {
  type: BossWeapon;
  lanes: number[];
  staggerMs: number;
  speedMultiplier: number;
}

interface BossConfig {
  id: BossId;
  milestone: number;
  alphaVideoPath?: string;
  spriteSheetPath?: string;
  spriteColumns?: number;
  spriteRows?: number;
  spriteFps?: number;
  spriteFlipX?: boolean;
  previewOnly?: boolean;
  nameKey: string;
  warningKey: string;
  motion: BossMotion;
  accent: string;
  secondaryAccent: string;
  widthCap: number;
  widthRatio: number;
  artScale?: number;
  battleDurationMs: number;
  waveIntervalMs: number;
  rewardCoins: number;
  rewardScore: number;
  patterns: BossAttackPattern[];
  summonPattern?: BossSummonKind[];
  summonLabelKey?: string;
  summonIntervalMs?: number;
  maxSummons?: number;
}

interface BossEncounter {
  config: BossConfig;
  x: number;
  y: number;
  baseY: number;
  width: number;
  height: number;
  startedAt: number;
  entryStartedAt: number;
  battleStartedAt: number;
  retreatStartedAt: number;
  phase: BossPhase;
  nextWaveAt: number;
  nextSummonAt: number;
  summonedSharks: number;
  lastAttackAt: number;
  waves: BossShockwave[];
}

export interface EngineCallbacks {
  onScore: (score: number) => void;
  onCoinCollect: (total: number) => void;
  onDeath: () => void;
  onShake: (intensity: number) => void;
  onGemCollect?: (lives: number) => void;
  onLifeChange?: (lives: number) => void;
  onFloatingText?: (text: string, x: number, y: number, color: string, isBig?: boolean) => void;
  onRedFlash?: () => void;
  onNearMiss?: () => void;
  onFeverStart?: () => void;
  onPowerUpCollect?: (type: PowerUp['type']) => void;
  onBossStart?: (bossId: BossId) => void;
  onBossAttack?: (weapon: BossShockwave['type']) => void;
  onBossSummon?: (bossId: BossId, kind: BossSummonKind) => void;
  onBossDefeated?: (bossId: BossId) => boolean | void;
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
  lateGameSafetyGranted: boolean;
  shieldCharges: number;
  magnetUntil: number;
  gemBoostActive: boolean;

  // Enhancements
  floatingTexts: FloatingText[];
  sharks: PredatorShark[];
  boostRings: BubbleBoostRing[];
  chests: TreasureChest[];
  boostUntil: number; // game time until boost ends
  coinStreakCount: number;
  lastCoinCollectedTime: number;
  isRedFlashing?: boolean;
  redFlashTimer?: number;

  // Phase 2 features
  seaMines: SeaMine[];
  jellyfish: Jellyfish[];
  feverUntil: number;
  elapsedSinceFeverCoinSpawn: number;
  hourglassUntil: number;

  // Multi-stage boss encounters
  boss: BossEncounter | null;
  defeatedBosses: BossId[];
  nextBossEligibleScore: number;
  previewMode?: boolean;
}

const FISH_X_RATIO = 0.28;
const MAX_EXTRA_LIVES = 2;
const LATE_GAME_MAX_EXTRA_LIVES = 3;
const MAX_SHIELD_CHARGES = 2;
const LATE_GAME_MAX_SHIELD_CHARGES = 3;
const LATE_GAME_SUPPORT_SCORE = 300;
const GEM_SPAWN_CHANCE = 0.09;
const DROP_RUSH_DURATION_MS = 20_000;
const MAGNET_DURATION_MS = 12_000;
const HIT_INVINCIBILITY_MS = 1700;
const SAFE_REVIVE_DELAY_MS = 900;
const BOSS_WARNING_MS = 1_450;
const BOSS_ENTRY_MS = 1_500;
const BOSS_RETREAT_MS = 1_650;
const BOSS_WAVE_WARNING_MS = 900;
const BOSS_WAVE_SPEED = 5.35;
const BOSS_SUMMON_INTERVAL_MS = 6_200;
const BOSS_MAX_SUMMONED_SHARKS = 3;
const BOSS_SCORE_BREATHER = 60;

// Every staged fight reserves the arena, provides a warning window, and keeps
// one broad vertical escape route in each deterministic attack sequence.
const BOSS_CONFIGS: BossConfig[] = [
  {
    id: 'abyssalOctopus', milestone: 100,
    alphaVideoPath: '/assets/boss-alpha-videos/test/deep-kraken-alpha-test.mp4', nameKey: 'engine.bossName.kraken', warningKey: 'engine.bossWarning.kraken', motion: 'coralTentacles',
    accent: '#c581ff', secondaryAccent: '#4ce6ff', widthCap: 205, widthRatio: 0.45, artScale: 1.0,
    battleDurationMs: 24_000, waveIntervalMs: 2_450, rewardCoins: 60, rewardScore: 30,
    summonPattern: ['jellyfish'], summonLabelKey: 'engine.bossSummon.jelly', summonIntervalMs: 5_200, maxSummons: 3,
    patterns: [
      { type: 'ink', lanes: [0.26], staggerMs: 0, speedMultiplier: 0.92 },
      { type: 'plasma', lanes: [0.74], staggerMs: 0, speedMultiplier: 1.20 },
      { type: 'ink', lanes: [0.32, 0.68], staggerMs: 290, speedMultiplier: 0.96 },
      { type: 'plasma', lanes: [0.50], staggerMs: 0, speedMultiplier: 1.30 },
      { type: 'ink', lanes: [0.22, 0.56], staggerMs: 310, speedMultiplier: 1.02 },
      { type: 'plasma', lanes: [0.78], staggerMs: 0, speedMultiplier: 1.35 },
    ],
  },
  {
    id: 'electricManta', milestone: 250,
    alphaVideoPath: '/assets/boss-alpha-videos/electric-manta-alpha.mp4', nameKey: 'engine.bossName.manta', warningKey: 'engine.bossWarning.manta', motion: 'fins',
    accent: '#62efff', secondaryAccent: '#4c78ff', widthCap: 210, widthRatio: 0.48,
    battleDurationMs: 27_000, waveIntervalMs: 1_720, rewardCoins: 80, rewardScore: 40,
    summonPattern: ['shark'], summonLabelKey: 'engine.bossSummon.shark', summonIntervalMs: 4_200, maxSummons: 4,
    patterns: [
      { type: 'electric', lanes: [0.18, 0.74], staggerMs: 150, speedMultiplier: 1.56 },
      { type: 'electric', lanes: [0.34, 0.64], staggerMs: 260, speedMultiplier: 1.62 },
      { type: 'plasma', lanes: [0.50], staggerMs: 0, speedMultiplier: 1.72 },
      { type: 'electric', lanes: [0.16, 0.48, 0.80], staggerMs: 190, speedMultiplier: 1.50 },
      { type: 'electric', lanes: [0.26, 0.70], staggerMs: 120, speedMultiplier: 1.70 },
    ],
  },
  {
    id: 'abyssalAnglerfish', milestone: 400,
    alphaVideoPath: '/assets/boss-alpha-videos/abyssal-anglerfish-alpha.mp4', nameKey: 'engine.bossName.anglerfish', warningKey: 'engine.bossWarning.anglerfish', motion: 'lure',
    accent: '#7cfaff', secondaryAccent: '#a764ff', widthCap: 205, widthRatio: 0.46,
    battleDurationMs: 29_000, waveIntervalMs: 1_920, rewardCoins: 105, rewardScore: 55,
    summonPattern: ['mine'], summonLabelKey: 'engine.bossSummon.mine', summonIntervalMs: 3_700, maxSummons: 5,
    patterns: [
      { type: 'bubble', lanes: [0.30, 0.70], staggerMs: 420, speedMultiplier: 0.92 },
      { type: 'plasma', lanes: [0.48], staggerMs: 0, speedMultiplier: 1.70 },
      { type: 'bubble', lanes: [0.18, 0.52, 0.82], staggerMs: 330, speedMultiplier: 1.08 },
      { type: 'plasma', lanes: [0.24, 0.72], staggerMs: 210, speedMultiplier: 1.60 },
    ],
  },
  {
    id: 'leviathan', milestone: 600,
    alphaVideoPath: '/assets/boss-alpha-videos/test/water-dragon-alpha-test.mp4', nameKey: 'engine.bossName.leviathan', warningKey: 'engine.bossWarning.leviathan', motion: 'serpent',
    accent: '#5dfff0', secondaryAccent: '#268dff', widthCap: 360, widthRatio: 0.78, artScale: 0.82,
    battleDurationMs: 31_000, waveIntervalMs: 1_720, rewardCoins: 135, rewardScore: 72,
    summonPattern: ['shark', 'jellyfish'], summonLabelKey: 'engine.bossSummon.mixed', summonIntervalMs: 3_150, maxSummons: 7,
    patterns: [
      { type: 'surge', lanes: [0.26], staggerMs: 0, speedMultiplier: 1.32 },
      { type: 'surge', lanes: [0.72], staggerMs: 0, speedMultiplier: 1.38 },
      { type: 'surge', lanes: [0.34, 0.66], staggerMs: 270, speedMultiplier: 1.34 },
      { type: 'plasma', lanes: [0.50], staggerMs: 0, speedMultiplier: 1.58 },
      { type: 'surge', lanes: [0.20, 0.54], staggerMs: 290, speedMultiplier: 1.42 },
    ],
  },
  {
    id: 'coralKraken', milestone: 500, previewOnly: true,
    alphaVideoPath: '/assets/boss-alpha-videos/abyssal-razorback-alpha.mp4', nameKey: 'engine.bossName.razorback', warningKey: 'engine.bossWarning.razorback', motion: 'fins',
    accent: '#00e7ff', secondaryAccent: '#8f5cff', widthCap: 224, widthRatio: 0.50,
    battleDurationMs: 30_000, waveIntervalMs: 1_620, rewardCoins: 195, rewardScore: 110,
    summonPattern: ['shark', 'jellyfish'], summonLabelKey: 'engine.bossSummon.mixed', summonIntervalMs: 2_950, maxSummons: 8,
    patterns: [
      { type: 'electric', lanes: [0.24, 0.72], staggerMs: 160, speedMultiplier: 1.56 },
      { type: 'surge', lanes: [0.48], staggerMs: 0, speedMultiplier: 1.64 },
      { type: 'electric', lanes: [0.18, 0.48, 0.80], staggerMs: 210, speedMultiplier: 1.58 },
      { type: 'plasma', lanes: [0.32, 0.68], staggerMs: 260, speedMultiplier: 1.70 },
    ],
  },
  {
    id: 'abyssalRazorback', milestone: 800,
    alphaVideoPath: '/assets/boss-alpha-videos/test/final-kraken-130221-alpha.mp4',
    nameKey: 'engine.bossName.kraken', warningKey: 'engine.bossWarning.kraken', motion: 'coralTentacles',
    accent: '#ff995d', secondaryAccent: '#ffdb64', widthCap: 310, widthRatio: 0.64, artScale: 0.72,
    battleDurationMs: 38_000, waveIntervalMs: 1_380, rewardCoins: 240, rewardScore: 140,
    summonPattern: ['shark', 'jellyfish', 'mine'], summonLabelKey: 'engine.bossSummon.all', summonIntervalMs: 2_400, maxSummons: 10,
    patterns: [
      { type: 'coral', lanes: [0.22, 0.70], staggerMs: 120, speedMultiplier: 1.46 },
      { type: 'plasma', lanes: [0.50], staggerMs: 0, speedMultiplier: 1.84 },
      { type: 'coral', lanes: [0.18, 0.48, 0.78], staggerMs: 180, speedMultiplier: 1.56 },
      { type: 'surge', lanes: [0.30, 0.66], staggerMs: 210, speedMultiplier: 1.68 },
      { type: 'coral', lanes: [0.24, 0.56, 0.82], staggerMs: 160, speedMultiplier: 1.62 },
    ],
  },
  {
    id: 'poseidon', milestone: 1000,
    alphaVideoPath: '/assets/boss-alpha-videos/test/poseidon-alpha.mp4',
    nameKey: 'engine.bossName.poseidon', warningKey: 'engine.bossWarning.poseidon', motion: 'serpent',
    accent: '#35ecff', secondaryAccent: '#ffd067', widthCap: 290, widthRatio: 0.60, artScale: 0.76,
    battleDurationMs: 42_000, waveIntervalMs: 1_200, rewardCoins: 320, rewardScore: 190,
    summonPattern: ['shark', 'jellyfish', 'mine'], summonLabelKey: 'engine.bossSummon.all', summonIntervalMs: 2_150, maxSummons: 12,
    patterns: [
      { type: 'trident', lanes: [0.22, 0.78], staggerMs: 250, speedMultiplier: 1.48 },
      { type: 'surge', lanes: [0.50], staggerMs: 0, speedMultiplier: 1.70 },
      { type: 'trident', lanes: [0.36, 0.68], staggerMs: 290, speedMultiplier: 1.56 },
      { type: 'surge', lanes: [0.24, 0.76], staggerMs: 260, speedMultiplier: 1.62 },
      { type: 'trident', lanes: [0.20, 0.80], staggerMs: 280, speedMultiplier: 1.64 },
    ],
  },
];
// The artwork intentionally extends beyond the gameplay body. A smaller,
// circular contact zone makes collisions match what players can see.
const FAIR_FISH_HITBOX_RADIUS = BASE.fishRadius * 0.82;

const ENVIRONMENTS: EnvironmentTheme[] = [
  { id: 'lagoon', minScore: 0, label: 'Sunlit Lagoon', top: '#35bce8', mid: '#087fb9', bottom: '#001b38', ray: '#d8fbff', pillarDark: '#0d716d', pillarMid: '#42d2ba', pillarLight: '#a4f5db', cap: '#62dccc', accent: '#d6fff7', speck: '#d8fbff' },
  { id: 'coral', minScore: 12, label: 'Coral Bloom', top: '#29a9d2', mid: '#146d9b', bottom: '#102b56', ray: '#b6f5ff', pillarDark: '#a84d65', pillarMid: '#ff8f7b', pillarLight: '#ffd0a6', cap: '#ffb37c', accent: '#ffd5b8', speck: '#ffd39a' },
  { id: 'kelp', minScore: 30, label: 'Kelp Canopy', top: '#287c78', mid: '#124f5b', bottom: '#06293b', ray: '#beffd0', pillarDark: '#236044', pillarMid: '#5ba853', pillarLight: '#b9df70', cap: '#8fcf68', accent: '#e6ff9a', speck: '#c6ffba' },
  { id: 'ruins', minScore: 55, label: 'Twilight Ruins', top: '#33468a', mid: '#172a68', bottom: '#080e30', ray: '#aeb6ff', pillarDark: '#252b69', pillarMid: '#5a56b0', pillarLight: '#8e9cff', cap: '#737ce8', accent: '#85f0ff', speck: '#c6d2ff' },
  { id: 'volcanic', minScore: 85, label: 'Ember Vents', top: '#4c3c72', mid: '#382346', bottom: '#180b22', ray: '#ffc0a1', pillarDark: '#3a2430', pillarMid: '#924550', pillarLight: '#ff845d', cap: '#e6634d', accent: '#ffcb76', speck: '#ffb25e' },
  { id: 'temple', minScore: 120, label: 'Bioluminescent Temple', top: '#163c77', mid: '#102452', bottom: '#05091d', ray: '#8cf6ff', pillarDark: '#18285b', pillarMid: '#265a82', pillarLight: '#4cf0e1', cap: '#4bd9dd', accent: '#7bfbff', speck: '#a6ffff' },
  { id: 'abyss', minScore: 170, label: 'Abyssal Current', top: '#1b2960', mid: '#111747', bottom: '#030414', ray: '#91a8ff', pillarDark: '#151a48', pillarMid: '#35408f', pillarLight: '#7386e4', cap: '#6576db', accent: '#aebdff', speck: '#849dff' },
  { id: 'crystal', minScore: 240, label: 'Crystal Grotto', top: '#1c6f88', mid: '#155064', bottom: '#071e3a', ray: '#a8ffff', pillarDark: '#194564', pillarMid: '#2c94ad', pillarLight: '#8affef', cap: '#64dacc', accent: '#c9ffff', speck: '#aafff4' },
  { id: 'moonlit', minScore: 330, label: 'Moonlit Tides', top: '#32447f', mid: '#252a65', bottom: '#0b1030', ray: '#edf0ff', pillarDark: '#293060', pillarMid: '#6870bb', pillarLight: '#bec5ff', cap: '#a5abed', accent: '#f0f2ff', speck: '#e0e4ff' },
  { id: 'sunkenCity', minScore: 460, label: 'Sunken City', top: '#17666e', mid: '#11474f', bottom: '#06242f', ray: '#b8fff0', pillarDark: '#1f504c', pillarMid: '#4e9b7b', pillarLight: '#b4d56b', cap: '#8ebf68', accent: '#e1ffac', speck: '#ccffbf' },
  { id: 'aurora', minScore: 650, label: 'Aurora Trench', top: '#25326e', mid: '#2b2162', bottom: '#100b2c', ray: '#d7b9ff', pillarDark: '#35215e', pillarMid: '#7c4aa1', pillarLight: '#ee8fe3', cap: '#c76fd1', accent: '#ffc5f3', speck: '#eeb6ff' },
  { id: 'crownReef', minScore: 850, label: 'Crown Reef', top: '#5c3b69', mid: '#69304f', bottom: '#210f2d', ray: '#ffe3a0', pillarDark: '#59303c', pillarMid: '#b15b58', pillarLight: '#ffc77b', cap: '#f49b62', accent: '#fff0b8', speck: '#ffd182' },
  { id: 'eternalTemple', minScore: 1000, label: 'Eternal Temple', top: '#162b72', mid: '#1a315f', bottom: '#050617', ray: '#b5fff6', pillarDark: '#163651', pillarMid: '#27738c', pillarLight: '#80fff0', cap: '#50d7cf', accent: '#d4fffb', speck: '#9cfff5' },
];

function environmentForScore(score: number): EnvironmentTheme {
  for (let index = ENVIRONMENTS.length - 1; index >= 0; index -= 1) {
    if (score >= ENVIRONMENTS[index].minScore) return ENVIRONMENTS[index];
  }
  return ENVIRONMENTS[0];
}

let waterTexture: HTMLImageElement | null = null;
let heartDropImage: HTMLImageElement | null = null;
const playerFishSpriteSheetCache = new Map<SkinId, HTMLImageElement>();
const bossVideoCache = new Map<BossId, HTMLVideoElement>();
const bossSpriteSheetCache = new Map<BossId, HTMLImageElement>();
const bossProjectileSheetCache = new Map<string, HTMLImageElement>();
const minionSpriteSheetCache = new Map<MinionArtId, HTMLImageElement>();

const PLAYER_FISH_SPRITE_SHEET_PATHS: Record<SkinId, string> = {
  golden: '/assets/player-fish/golden-hero-swim-sheet.png',
  ruby: '/assets/player-fish/ruby-betta-swim-sheet.png',
  emerald: '/assets/player-fish/emerald-mandarin-swim-sheet.png',
  diamond: '/assets/player-fish/diamond-discus-swim-sheet.png',
  legendary: '/assets/player-fish/legendary-royal-abyss-swim-sheet.png',
  sapphire: '/assets/player-fish/sapphire-crown-koi-swim-sheet.png',
  solar: '/assets/player-fish/solar-empress-lionfish-swim-sheet.png',
  poseidonsHeir: '/assets/player-fish/poseidons-heir-swim-sheet.png',
};

const BOSS_PROJECTILE_SHEET_PATHS: Record<BossId, string> = {
  abyssalOctopus: '/assets/boss-projectiles/octopus-ink-sheet.png',
  electricManta: '/assets/boss-projectiles/manta-electric-sheet.png',
  abyssalAnglerfish: '/assets/boss-projectiles/angler-abyss-sheet.png',
  leviathan: '/assets/boss-projectiles/leviathan-surge-sheet.png',
  coralKraken: '/assets/boss-projectiles/razorback-wave-sheet.png',
  abyssalRazorback: '/assets/boss-projectiles/kraken-coral-sheet.png',
  poseidon: '/assets/boss-projectiles/poseidon-trident-sheet.png',
};

const BOSS_WEAPON_PROJECTILE_SHEET_PATHS: Partial<Record<BossId, Partial<Record<BossWeapon, string>>>> = {
  poseidon: { surge: '/assets/boss-projectiles/leviathan-surge-sheet.png' },
};

const MINION_SPRITE_SHEET_PATHS: Record<MinionArtId, string> = {
  inkJelly: '/assets/minions/ink-jelly-minion.png',
  voltfinShark: '/assets/minions/voltfin-shark-minion.png',
  lureMine: '/assets/minions/lure-mine-minion.png',
  tideSerpent: '/assets/minions/tide-serpent-minion.png',
  stormJelly: '/assets/minions/storm-jelly-minion.png',
  coralHatchling: '/assets/minions/coral-hatchling-minion.png',
  abyssMine: '/assets/minions/abyss-mine-minion.png',
  riftShark: '/assets/minions/rift-shark-minion.png',
};

type BossMinionArtChoice = MinionArtId | MinionArtId[];

const BOSS_MINION_ART: Record<BossId, Partial<Record<BossSummonKind, BossMinionArtChoice>>> = {
  abyssalOctopus: { jellyfish: 'inkJelly' },
  electricManta: { shark: 'voltfinShark' },
  abyssalAnglerfish: { mine: 'lureMine' },
  leviathan: { shark: 'tideSerpent', jellyfish: 'stormJelly' },
  coralKraken: { shark: 'riftShark', jellyfish: 'inkJelly' },
  abyssalRazorback: { shark: 'coralHatchling', jellyfish: 'coralHatchling', mine: 'abyssMine' },
  poseidon: {
    shark: ['tideSerpent', 'riftShark', 'voltfinShark'],
    jellyfish: ['stormJelly', 'inkJelly', 'coralHatchling'],
    mine: ['lureMine', 'abyssMine'],
  },
};

function minionArtFor(bossId: BossId, kind: BossSummonKind, summonIndex: number, patternLength: number): MinionArtId | undefined {
  const choice = BOSS_MINION_ART[bossId][kind];
  if (!choice) return undefined;
  if (!Array.isArray(choice)) return choice;
  const round = Math.floor(summonIndex / Math.max(1, patternLength));
  return choice[round % choice.length];
}

interface BossVideoFrame {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  lastTime: number;
}

const bossVideoFrameCache = new Map<BossId, BossVideoFrame>();

function getHeartDropImage() {
  if (typeof Image === 'undefined') return null;
  if (!heartDropImage) {
    heartDropImage = new Image();
    heartDropImage.src = '/assets/heart-drop.svg';
  }
  return heartDropImage;
}

function getBossSpriteSheet(config: BossConfig) {
  if (typeof Image === 'undefined' || !config.spriteSheetPath) return null;
  let spriteSheet = bossSpriteSheetCache.get(config.id);
  if (!spriteSheet) {
    spriteSheet = new Image();
    spriteSheet.decoding = 'async';
    spriteSheet.src = config.spriteSheetPath;
    bossSpriteSheetCache.set(config.id, spriteSheet);
  }
  return spriteSheet;
}

function getPlayerFishSpriteSheet(skinId: SkinId) {
  if (typeof Image === 'undefined') return null;
  let sheet = playerFishSpriteSheetCache.get(skinId);
  if (!sheet) {
    sheet = new Image();
    sheet.decoding = 'async';
    sheet.src = PLAYER_FISH_SPRITE_SHEET_PATHS[skinId];
    playerFishSpriteSheetCache.set(skinId, sheet);
  }
  return sheet;
}

function getBossProjectileSheet(bossId: BossId, weaponType?: BossWeapon) {
  if (typeof Image === 'undefined') return null;
  const path = BOSS_WEAPON_PROJECTILE_SHEET_PATHS[bossId]?.[weaponType ?? 'ink'] ?? BOSS_PROJECTILE_SHEET_PATHS[bossId];
  let sheet = bossProjectileSheetCache.get(path);
  if (!sheet) {
    sheet = new Image();
    sheet.decoding = 'async';
    sheet.src = path;
    bossProjectileSheetCache.set(path, sheet);
  }
  return sheet;
}

function getMinionSpriteSheet(artId: MinionArtId) {
  if (typeof Image === 'undefined') return null;
  let sheet = minionSpriteSheetCache.get(artId);
  if (!sheet) {
    sheet = new Image();
    sheet.decoding = 'async';
    sheet.src = MINION_SPRITE_SHEET_PATHS[artId];
    minionSpriteSheetCache.set(artId, sheet);
  }
  return sheet;
}

function drawMinionSprite(ctx: CanvasRenderingContext2D, artId: MinionArtId, timeMs: number, phase: number, size: number) {
  const sheet = getMinionSpriteSheet(artId);
  if (!sheet?.complete || !sheet.naturalWidth || !sheet.naturalHeight) return false;
  const frameWidth = sheet.naturalWidth / 4;
  const frame = Math.floor(timeMs / 135 + phase) % 4;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, frame * frameWidth, 0, frameWidth, sheet.naturalHeight, -size / 2, -size / 2, size, size);
  return true;
}

function getBossVideo(config: BossConfig) {
  if (typeof document === 'undefined' || !config.alphaVideoPath) return null;
  let video = bossVideoCache.get(config.id);
  if (!video) {
    video = document.createElement('video');
    video.src = config.alphaVideoPath;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    bossVideoCache.set(config.id, video);
  }
  return video;
}

function startBossVideo(config: BossConfig) {
  const video = getBossVideo(config);
  if (!video) return;
  video.currentTime = 0;
  void video.play().catch(() => undefined);
}

function stopBossVideo(config: BossConfig) {
  const video = bossVideoCache.get(config.id);
  if (!video) return;
  video.pause();
  video.currentTime = 0;
}

function getBossVideoFrame(config: BossConfig, video: HTMLVideoElement) {
  const frameWidth = video.videoWidth;
  const frameHeight = Math.floor(video.videoHeight / 2);
  if (!frameWidth || !frameHeight || typeof document === 'undefined') return null;

  let frame = bossVideoFrameCache.get(config.id);
  if (!frame) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    frame = { canvas, context, lastTime: -1 };
    bossVideoFrameCache.set(config.id, frame);
  }

  if (frame.canvas.width !== frameWidth || frame.canvas.height !== video.videoHeight) {
    frame.canvas.width = frameWidth;
    frame.canvas.height = video.videoHeight;
    frame.lastTime = -1;
  }

  if (Math.abs(frame.lastTime - video.currentTime) > 0.0001) {
    frame.context.drawImage(video, 0, 0, frameWidth, video.videoHeight);
    const pixels = frame.context.getImageData(0, 0, frameWidth, video.videoHeight);
    const alphaOffset = frameWidth * frameHeight * 4;
    for (let index = 0; index < alphaOffset; index += 4) {
      // Use the matte only to separate the black video backdrop from the boss.
      // The boss itself stays fully opaque, preserving the rich original RGB
      // values instead of letting a soft matte darken it over the game world.
      const matte = pixels.data[alphaOffset + index];
      // H.264 compression leaves faint low-level matte residue at the bottom edge.
      // Treat it as transparent to prevent the thin dark line beneath every boss.
      if (matte <= 48) {
        pixels.data[index] = 0;
        pixels.data[index + 1] = 0;
        pixels.data[index + 2] = 0;
        pixels.data[index + 3] = 0;
        continue;
      }
      // The H.264 source is authored on black. A gentle gamma lift restores
      // the original perceived brightness on the underwater game background
      // without shifting the boss palette or blowing out its highlights.
      const lift = (channel: number) => Math.min(255, Math.round(255 * Math.pow(channel / 255, 0.60)));
      pixels.data[index] = lift(pixels.data[index]);
      pixels.data[index + 1] = lift(pixels.data[index + 1]);
      pixels.data[index + 2] = lift(pixels.data[index + 2]);
      pixels.data[index + 3] = 255;
    }
    frame.context.putImageData(pixels, 0, 0, 0, 0, frameWidth, frameHeight);
    // The canvas temporarily holds the stacked alpha matte below the artwork.
    // Clear it after extracting the top frame so browser interpolation cannot leak
    // its seam as a thin line beneath the rendered boss.
    frame.context.clearRect(0, frameHeight, frameWidth, video.videoHeight - frameHeight);
    frame.lastTime = video.currentTime;
  }

  return { canvas: frame.canvas, width: frameWidth, height: frameHeight };
}

function bossEncounterScale(state: EngineState) {
  const boss = state.boss;
  if (!boss || boss.phase === 'warning') return 1;
  // This scales only the player character during a boss encounter. The
  // background remains full-screen, creating a clean pull-back camera effect.
  const targetScale = 0.64;
  if (boss.phase === 'entering') {
    const progress = Math.max(0, Math.min(1, (state.timeMs - boss.entryStartedAt) / BOSS_ENTRY_MS));
    return 1 + (targetScale - 1) * (1 - Math.pow(1 - progress, 3));
  }
  if (boss.phase === 'retreating') {
    const progress = Math.max(0, Math.min(1, (state.timeMs - boss.retreatStartedAt) / BOSS_RETREAT_MS));
    return targetScale + (1 - targetScale) * (progress * progress * (3 - 2 * progress));
  }
  return targetScale;
}

function getWaterTexture() {
  if (typeof Image === 'undefined') return null;
  if (!waterTexture) {
    waterTexture = new Image();
    waterTexture.src = '/assets/cc0-stylized-water.jpg';
  }
  return waterTexture;
}

function drawWaterTexture(ctx: CanvasRenderingContext2D, state: EngineState) {
  const texture = getWaterTexture();
  if (!texture?.complete || !texture.naturalWidth) return;

  const tile = Math.max(state.width, state.height) * 0.78;
  const driftX = (state.timeMs * 0.009) % tile;
  const driftY = (state.timeMs * 0.004) % tile;

  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.globalCompositeOperation = 'soft-light';
  for (let x = -tile - driftX; x < state.width + tile; x += tile) {
    for (let y = -tile - driftY; y < state.height + tile; y += tile) {
      ctx.drawImage(texture, x, y, tile, tile);
    }
  }
  ctx.restore();
}

// A shield absorbs one hit and grants the same brief recovery window to every skin.
// Skin perks therefore improve real collection rewards instead of an invisible duration.
const getInvincibilityDuration = (_state: EngineState) => HIT_INVINCIBILITY_MS;

export function createEngine(width: number, height: number, skin: SkinId, selectedBossPreview?: number): EngineState {
  // The menu's temporary Boss Test panel can select a production-safe preview.
  // The query parameter remains available only for local development checks.
  const queryBossPreview = import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('bossPreview');
  const queryBossScore = queryBossPreview && typeof window !== 'undefined'
    ? Number(new URLSearchParams(window.location.search).get('bossPreview'))
    : 0;
  const bossPreviewScore = selectedBossPreview ?? queryBossScore;
  const bossPreview = Boolean(selectedBossPreview || queryBossPreview);
  const previewBoss = BOSS_CONFIGS.find((config) => config.milestone === bossPreviewScore) ?? BOSS_CONFIGS[0];
  const startingScore = bossPreview ? previewBoss.milestone : 0;
  const bubbles: Bubble[] = Array.from({ length: 30 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 2 + Math.random() * 8,
    speed: 0.25 + Math.random() * 0.95,
    drift: (Math.random() - 0.5) * 0.45,
  }));
  return {
    width, height, fishY: height / 2, fishVY: 0, fishRotation: 0, score: startingScore, running: true,
    invincibleUntil: bossPreview ? 25_000 : 0, obstacles: [], coins: [], gems: [], powerUps: [], bubbles, particles: [],
    elapsedSinceSpawn: 999999, skin, shakeIntensity: 0, timeMs: 0, legendaryPulse: 0,
    lives: 0, maxLives: MAX_EXTRA_LIVES, lateGameSafetyGranted: false, shieldCharges: 0, magnetUntil: 0, gemBoostActive: false,

    floatingTexts: [],
    sharks: [],
    boostRings: [],
    chests: [],
    boostUntil: 0,
    coinStreakCount: 0,
    lastCoinCollectedTime: 0,
    isRedFlashing: false,
    redFlashTimer: 0,

    // Phase 2
    seaMines: [],
    jellyfish: [],
    feverUntil: 0,
    elapsedSinceFeverCoinSpawn: 0,
    hourglassUntil: 0,
    boss: null,
    defeatedBosses: bossPreview
      ? BOSS_CONFIGS.filter((config) => config.milestone < previewBoss.milestone).map((config) => config.id)
      : [],
    nextBossEligibleScore: bossPreview ? startingScore : 0,
    previewMode: bossPreview,
  };
}

export function difficultyForScore(score: number, _timeMs: number = 0) {
  // Constant speed of 3.0 as requested to prevent the game from becoming too fast / impossible.
  const speed = 3.0;

  // The pipe opening stays constant throughout a run. Later difficulty comes
  // from readable moving gates and varied minions, never from a shrinking route.
  const gap = BASE.baseGap + 30;
  const speedSteps = Math.floor(score / 12);

  const baseSpawnInterval = Math.max(1200, BASE.spawnInterval + 180 - speedSteps * 25);
  // Spawn interval is fairly balanced
  const spawnInterval = Math.max(900, baseSpawnInterval);

  const tier = environmentForScore(score);
  return { speed, gap, spawnInterval, tier, diffMultiplier: 1.0 };
}

export function jump(state: EngineState, settings: { vibration: boolean }) {
  if (!state.running) return;
  state.fishVY = BASE.jumpVelocity;
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: state.width * FISH_X_RATIO, y: state.fishY + BASE.fishRadius * 0.6,
      vx: (Math.random() - 0.5) * 2.2, vy: 1 + Math.random() * 1.5,
      life: 0, maxLife: 26 + Math.random() * 14, color: 'rgba(255,255,255,0.85)', size: 2 + Math.random() * 3,
    });
  }
  if (settings.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(12); } catch {}
  }
}

function clampGapY(state: EngineState, gapY: number, gapSize: number) {
  const safeMargin = Math.max(92, gapSize * 0.45);
  return Math.max(safeMargin, Math.min(state.height - safeMargin, gapY));
}

/**
 * Place one hazard close to an edge of a pipe gap, while reserving a generous
 * lane on the opposite side. This prevents a hazard from sealing the only
 * route through a gate, especially on narrow high-score gaps.
 */
function safeHazardLane(gapY: number, gapSize: number, hazardHalfHeight: number) {
  // Put hazards in a randomized side lane inside the gate: never in the
  // center flight line, never glued to the pipe lip, and always leaving an
  // obvious open route on the other side.
  const minOffset = Math.max(hazardHalfHeight + 20, gapSize * 0.23);
  const maxOffset = Math.max(minOffset, gapSize / 2 - hazardHalfHeight - 20);
  const offset = minOffset + Math.random() * (maxOffset - minOffset);
  return gapY + (Math.random() < 0.5 ? -offset : offset);
}

const AMBIENT_MINION_ART: Record<BossSummonKind, MinionArtId[]> = {
  shark: ['voltfinShark', 'riftShark', 'tideSerpent'],
  jellyfish: ['inkJelly', 'stormJelly', 'coralHatchling'],
  mine: ['lureMine', 'abyssMine'],
};

function ambientMinionArtFor(kind: BossSummonKind, score: number): MinionArtId {
  const candidates = AMBIENT_MINION_ART[kind];
  return candidates[Math.floor(score / 100) % candidates.length];
}

function spawnObstacle(state: EngineState, score: number) {
  const { gap, diffMultiplier } = difficultyForScore(score, state.timeMs);
  const margin = Math.max(95, gap * 0.48);
  const rawGapY = margin + Math.random() * Math.max(1, state.height - margin * 2);
  const gapY = clampGapY(state, rawGapY, gap);
  const environment = environmentForScore(score);
  const legendaryMode = score >= 120;
  // After 200 points, some gates visibly glide up and down. Their opening size
  // is never changed, and the slow shared motion keeps the route readable.
  const movingGate = score >= 200 && Math.random() < 0.58;
  const bobAmount = movingGate ? Math.min(28, 14 + Math.floor(score / 100) * 2) : 0;
  const isDouble = false;
  state.obstacles.push({
    x: state.width + BASE.obstacleWidth, gapY, baseGapY: gapY, gapSize: gap, passed: false,
    bobbing: movingGate, bobPhase: Math.random() * Math.PI * 2,
    bobAmount, glowing: legendaryMode, isDouble, environment: environment.id,
  });

  // Drop Rush is awarded by the turquoise ring. It makes collectable drops
  // noticeably more frequent for 20 seconds without changing obstacle danger.
  const isFever = state.feverUntil > state.timeMs;
  const isDropRushActive = state.boostUntil > state.timeMs;
  const coinChance = isDropRushActive ? 0.92 : 0.68;
  let powerUpChance = isDropRushActive ? 0.18 : 0.09;
  let chestChance = isDropRushActive ? 0.055 : 0.025;
  if (state.skin === 'solar') powerUpChance *= 1.35;
  if (state.skin === 'ruby') chestChance *= 1.30;
  if (!isFever && Math.random() < coinChance) {
    state.coins.push({
      x: state.width + BASE.obstacleWidth + 44, y: gapY + (Math.random() - 0.5) * (gap * 0.32),
      collected: false, bonus: score >= 60 && Math.random() < 0.22,
    });
  }
  // Gem (now beautiful Heart) spawn (boosted if shop gemBoostActive, or Discus skin ability)
  let gemChance = state.gemBoostActive ? GEM_SPAWN_CHANCE * 1.8 : GEM_SPAWN_CHANCE;
  if (state.skin === 'poseidonsHeir') {
    gemChance *= 1.65; // Legendary reward: +65% Heart drop chance
  } else if (state.skin === 'diamond') {
    gemChance *= 1.30; // Discus skin: +30% Extra Life drop chance
  }
  if (isDropRushActive) {
    gemChance = Math.min(0.42, gemChance * 2.35);
  }
  if (Math.random() < gemChance) {
    state.gems.push({
      x: state.width + BASE.obstacleWidth + 88, y: gapY + (Math.random() - 0.5) * (gap * 0.28),
      collected: false, pulse: Math.random() * Math.PI * 2,
    });
  }
  // Power-up spawn (shield, magnet, Fever mode Star, or Hourglass!)
  if (Math.random() < powerUpChance) {
    const roll = Math.random();
    const type: 'shield' | 'magnet' | 'fever' | 'hourglass' =
      roll < 0.25 ? 'shield' :
      roll < 0.50 ? 'magnet' :
      roll < 0.75 ? 'fever' : 'hourglass';
    const puY = gapY + (Math.random() - 0.5) * (gap * 0.25);
    state.powerUps.push({
      x: state.width + BASE.obstacleWidth + 125,
      y: puY,
      type,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  // Ambient minions grow gradually after the first boss. The cap preserves a
  // clear escape lane and avoids stacking hazards in every pipe opening.
  const activeHazardCount = state.sharks.length + state.seaMines.length + state.jellyfish.length;
  const ambientMinionLimit = score >= 600 ? 3 : score >= 300 ? 2 : 1;
  const hazardLimit = score >= 120 ? ambientMinionLimit : 1;
  if (activeHazardCount < hazardLimit) {
    const hazardRoll = Math.random();

    // Shark enemy after score >= 20. It uses a short vertical bob, so the
    // reserved lane remains usable throughout the encounter.
    if (score >= 20 && hazardRoll < 0.12 * diffMultiplier) {
      const sharkY = safeHazardLane(gapY, gap, 19);
      state.sharks.push({
        id: 'shark_' + Math.random(),
        x: state.width + 150,
        y: sharkY,
        baseY: sharkY,
        width: 85,
        height: 38,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.003 + Math.random() * 0.002,
        bobAmount: 8 + Math.random() * 5,
        minionArt: score >= 120 ? ambientMinionArtFor('shark', score) : undefined,
        passed: false,
      });
    // Sea mine after score >= 10. Keep it away from the centerline so it
    // challenges route choice without blocking both paths.
    } else if (score >= 10 && hazardRoll < 0.35 * diffMultiplier) {
      state.seaMines.push({
        id: 'mine_' + Math.random(),
        x: state.width + 86,
        y: safeHazardLane(gapY, gap, 14),
        radius: 14,
        pulsePhase: Math.random() * Math.PI * 2,
        exploded: false,
        minionArt: score >= 120 ? ambientMinionArtFor('mine', score) : undefined,
      });
    // Jellyfish after score >= 15. Vertical movement is intentionally subtle
    // to keep the protected half of the pipe gap navigable.
    } else if (score >= 15 && hazardRoll < 0.55 * diffMultiplier) {
      const jellyY = safeHazardLane(gapY, gap, 12);
      state.jellyfish.push({
        id: 'jelly_' + Math.random(),
        x: state.width + 72,
        y: jellyY,
        baseY: jellyY,
        radius: 12,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.002 + Math.random() * 0.0015,
        bobAmount: 8 + Math.random() * 5,
        minionArt: score >= 120 ? ambientMinionArtFor('jellyfish', score) : undefined,
      });
    }
  }

  // Bubble Boost Ring spawn (very rare)
  if (Math.random() < 0.04) {
    const ringY = 100 + Math.random() * (state.height - 200);
    state.boostRings.push({
      x: state.width + BASE.obstacleWidth + 180,
      y: ringY,
      radius: 25,
      collected: false,
    });
  }

  // Treasure Chest spawn (rare, but always placed inside a readable gate).
  if (Math.random() < chestChance) {
    const chestY = gapY + (Math.random() - 0.5) * gap * 0.24;
    state.chests.push({
      x: state.width + BASE.obstacleWidth + 240,
      y: chestY,
      width: 36,
      height: 30,
      collected: false,
    });
  }
}

function addBurst(state: EngineState, x: number, y: number, color: string, count: number, sizeBase = 2) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y, vx: (Math.random() - 0.5) * 3.6, vy: (Math.random() - 0.5) * 3.6,
      life: 0, maxLife: 22 + Math.random() * 12, color, size: sizeBase + Math.random() * 3,
    });
  }
}

function clearDangerousReviveArea(state: EngineState) {
  const fishX = state.width * FISH_X_RATIO;
  state.obstacles = state.obstacles.filter((obs) => {
    const halfWidth = BASE.obstacleWidth / 2;
    const obsLeft = obs.x - halfWidth;
    const obsRight = obs.x + halfWidth;
    return obsRight < fishX - BASE.obstacleWidth * 2.2 || obsLeft > state.width + BASE.obstacleWidth * 1.4;
  });
  state.sharks = state.sharks.filter((shark) => {
    return shark.x < fishX - 80 || shark.x > state.width + 100;
  });
  state.seaMines = state.seaMines.filter((mine) => {
    return mine.x < fishX - 80 || mine.x > state.width + 100;
  });
  state.jellyfish = state.jellyfish.filter((jelly) => {
    return jelly.x < fishX - 80 || jelly.x > state.width + 100;
  });
  state.coins = state.coins.filter((coin) => coin.x < fishX - BASE.obstacleWidth * 2 || coin.x > state.width + BASE.obstacleWidth);
  state.gems = state.gems.filter((gem) => gem.x < fishX - BASE.obstacleWidth * 2 || gem.x > state.width + BASE.obstacleWidth);
  state.powerUps = state.powerUps.filter((pu) => pu.x < fishX - BASE.obstacleWidth * 2 || pu.x > state.width + BASE.obstacleWidth);
  state.boostRings = state.boostRings.filter((ring) => ring.x < fishX - 60 || ring.x > state.width + 60);
  state.chests = state.chests.filter((chest) => chest.x < fishX - 60 || chest.x > state.width + 60);
  state.elapsedSinceSpawn = -SAFE_REVIVE_DELAY_MS;
}

function startBossEncounter(state: EngineState, callbacks: EngineCallbacks, config: BossConfig) {
  clearDangerousReviveArea(state);
  // Keep the full background canvas untouched and reduce only the boss actor
  // so the encounter reads as a wider, more cinematic arena.
  const width = Math.min(config.widthCap, state.width * config.widthRatio) * 0.78;
  const entryStartedAt = state.timeMs + BOSS_WARNING_MS;
  const battleStartedAt = entryStartedAt + BOSS_ENTRY_MS;
  const boss: BossEncounter = {
    config,
    x: state.width + width * 0.72,
    y: state.height * 0.42,
    baseY: state.height * 0.42,
    width,
    height: width,
    startedAt: state.timeMs,
    entryStartedAt,
    battleStartedAt,
    retreatStartedAt: 0,
    phase: 'warning',
    nextWaveAt: battleStartedAt + 820,
    nextSummonAt: battleStartedAt + BOSS_SUMMON_INTERVAL_MS,
    summonedSharks: 0,
    lastAttackAt: 0,
    waves: [],
  };
  state.boss = boss;
  getBossProjectileSheet(config.id);
  Object.values(BOSS_MINION_ART[config.id]).forEach((artChoice) => {
    const artIds = Array.isArray(artChoice) ? artChoice : [artChoice];
    artIds.forEach((artId) => {
      if (artId) getMinionSpriteSheet(artId);
    });
  });
  startBossVideo(config);
  state.elapsedSinceSpawn = -(BOSS_WARNING_MS + BOSS_ENTRY_MS + config.battleDurationMs + BOSS_RETREAT_MS);
  const warning = translate(config.warningKey);
  triggerFloatingText(state, warning, state.width * 0.5, state.height * 0.25, config.accent, true);
  callbacks.onFloatingText?.(warning, state.width * 0.5, state.height * 0.25, config.accent, true);
    addBurst(state, state.width * 0.72, state.height * 0.42, config.accent, 28, 3.2);
  callbacks.onBossStart?.(config.id);
}

function absorbBossHit(state: EngineState, callbacks: EngineCallbacks, fishX: number) {
  callbacks.onShake(5);
  callbacks.onRedFlash?.();
  addBurst(state, fishX, state.fishY, '#73e8ff', 18, 2.8);
  if (state.shieldCharges > 0) {
    state.shieldCharges = Math.max(0, state.shieldCharges - 1);
    state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
    triggerFloatingText(state, translate('engine.shield'), fishX, state.fishY - 30, '#80d8ff', true);
    return false;
  }
  killOrUseLife(state, callbacks);
  return true;
}

function updateBossEncounter(state: EngineState, dt: number, callbacks: EngineCallbacks, fishX: number, invincible: boolean, isFeverActive: boolean) {
  const boss = state.boss;
  if (!boss) return false;

  const { config } = boss;
  // Pull the combatants apart inside the unchanged full-screen background.
  // The boss remains directly opposite the fish, but the arena now has a
  // wider cinematic gap for clearer attacks and less visual crowding.
  const targetX = state.width * 0.75;
  const entryX = state.width + boss.width * 0.72;
  const exitX = state.width + boss.width * 0.95;
  const motionAmplitude = config.motion === 'serpent' ? 22 : config.motion === 'fins' ? 17 : 14;
  const motionRate = config.motion === 'fins' ? 0.0032 : config.motion === 'serpent' ? 0.0028 : 0.0018;
  const livingY = boss.baseY + Math.sin(state.timeMs * motionRate) * Math.min(motionAmplitude, state.height * 0.052);

  if (boss.phase === 'warning' && state.timeMs >= boss.entryStartedAt) {
    boss.phase = 'entering';
    addBurst(state, state.width * 0.93, boss.baseY, config.accent, 22, 2.8);
  }

  if (boss.phase === 'entering') {
    const progress = Math.max(0, Math.min(1, (state.timeMs - boss.entryStartedAt) / BOSS_ENTRY_MS));
    const eased = 1 - Math.pow(1 - progress, 3);
    boss.x = entryX + (targetX - entryX) * eased;
    boss.y = livingY - Math.sin(progress * Math.PI) * Math.min(18, state.height * 0.045);
    if (progress >= 1) {
      boss.phase = 'battle';
      boss.x = targetX;
      boss.y = livingY;
      addBurst(state, boss.x, boss.y, config.secondaryAccent, 24, 2.6);
    }
    return false;
  }

  if (boss.phase === 'retreating') {
    const progress = Math.max(0, Math.min(1, (state.timeMs - boss.retreatStartedAt) / BOSS_RETREAT_MS));
    const eased = progress * progress * (3 - 2 * progress);
    boss.x = targetX + (exitX - targetX) * eased;
    boss.y = livingY - Math.sin(progress * Math.PI) * Math.min(30, state.height * 0.075);
    if (progress < 1) return false;

    const rewardX = Math.min(state.width * 0.75, boss.x);
    const rewardY = boss.y;
    stopBossVideo(config);
    state.boss = null;
    if (!state.defeatedBosses.includes(config.id)) state.defeatedBosses.push(config.id);
    state.score += config.rewardScore;
    // Winning a boss opens a calm score window before the next encounter,
    // preventing two boss warnings from appearing back-to-back.
    state.nextBossEligibleScore = state.score + BOSS_SCORE_BREATHER;
    callbacks.onScore(state.score);
    callbacks.onCoinCollect(config.rewardCoins);
    const rewardText = translate('engine.bossDefeated', undefined, { coins: config.rewardCoins, score: config.rewardScore });
    triggerFloatingText(state, rewardText, rewardX, rewardY - boss.height * 0.62, '#ffe082', true);
    callbacks.onFloatingText?.(rewardText, rewardX, rewardY - boss.height * 0.62, '#ffe082', true);
    addBurst(state, rewardX, rewardY, '#ffe082', 38, 3.9);
    addBurst(state, rewardX, rewardY, config.accent, 30, 3.4);
    callbacks.onShake(3);
    const unlockedBossReward = callbacks.onBossDefeated?.(config.id);
    if (config.id === 'poseidon' && unlockedBossReward) {
      const unlockText = translate('engine.poseidonsHeirUnlocked');
      triggerFloatingText(state, unlockText, state.width * 0.5, state.height * 0.34, '#ffd740', true);
      callbacks.onFloatingText?.(unlockText, state.width * 0.5, state.height * 0.34, '#ffd740', true);
      addBurst(state, state.width * 0.5, state.height * 0.40, '#35ecff', 34, 3.6);
    }
    state.elapsedSinceSpawn = -900;
    return false;
  }

  boss.x += (targetX - boss.x) * Math.min(1, dt * 0.052);
  boss.y = livingY;

  if (boss.phase === 'battle' && state.timeMs >= boss.nextWaveAt) {
    const sequenceIndex = Math.floor((state.timeMs - boss.battleStartedAt) / config.waveIntervalMs);
    const pattern = config.patterns[sequenceIndex % config.patterns.length];
    boss.lastAttackAt = state.timeMs;
    pattern.lanes.forEach((laneRatio, laneIndex) => {
      const isHeavy = pattern.type === 'ink' || pattern.type === 'bubble' || pattern.type === 'coral' || pattern.type === 'trident';
      boss.waves.push({
        id: `${pattern.type}_bolt_${state.timeMs}_${laneIndex}`,
        x: boss.x - boss.width * 0.42,
        y: state.height * laneRatio,
        radius: isHeavy
          ? Math.max(18, Math.min(28, state.width * 0.070))
          : Math.max(13, Math.min(20, state.width * 0.052)),
        type: pattern.type,
        projectileBossId: config.id,
        speedMultiplier: pattern.speedMultiplier,
        phase: 'warning',
        activateAt: state.timeMs + BOSS_WAVE_WARNING_MS + laneIndex * pattern.staggerMs,
      });
    });
    callbacks.onBossAttack?.(pattern.type);
    boss.nextWaveAt = state.timeMs + config.waveIntervalMs;
  }

  if (
    boss.phase === 'battle'
    && config.summonPattern?.length
    && state.timeMs >= boss.battleStartedAt
    && boss.summonedSharks < (config.maxSummons ?? BOSS_MAX_SUMMONED_SHARKS)
    && state.timeMs >= boss.nextSummonAt
  ) {
    const kind = config.summonPattern[boss.summonedSharks % config.summonPattern.length];
    const tier = Math.floor(config.milestone / 100);
    const summonLanes: Record<BossSummonKind, number[]> = {
      shark: [0.22, 0.78, 0.34, 0.66],
      jellyfish: [0.18, 0.76, 0.38, 0.64],
      mine: [0.26, 0.72, 0.42, 0.62, 0.20],
    };
    const lanes = summonLanes[kind];
    const lane = lanes[boss.summonedSharks % lanes.length];
    const summonY = state.height * lane;
    const speedScale = 0.95 + tier * 0.11;

    if (kind === 'shark') {
      state.sharks.push({
        id: `boss_shark_${state.timeMs}`,
        x: state.width + 110,
        y: summonY,
        baseY: summonY,
        width: 78 + tier * 2,
        height: 35 + tier,
        bobPhase: boss.summonedSharks * 1.7,
        bobSpeed: 0.0038 + tier * 0.00032,
        bobAmount: 6 + tier,
        speedMultiplier: speedScale,
        minionArt: minionArtFor(config.id, kind, boss.summonedSharks, config.summonPattern.length),
        passed: false,
      });
    } else if (kind === 'jellyfish') {
      state.jellyfish.push({
        id: `boss_jelly_${state.timeMs}`,
        x: state.width + 82,
        y: summonY,
        baseY: summonY,
        radius: 11 + tier,
        bobPhase: boss.summonedSharks * 1.5,
        bobSpeed: 0.0025 + tier * 0.00028,
        bobAmount: 7 + tier * 1.5,
        speedMultiplier: speedScale,
        minionArt: minionArtFor(config.id, kind, boss.summonedSharks, config.summonPattern.length),
      });
    } else {
      state.seaMines.push({
        id: `boss_mine_${state.timeMs}`,
        x: state.width + 94,
        y: summonY,
        radius: 13 + tier,
        pulsePhase: boss.summonedSharks * 1.3,
        exploded: false,
        speedMultiplier: 0.82 + tier * 0.10,
        minionArt: minionArtFor(config.id, kind, boss.summonedSharks, config.summonPattern.length),
      });
    }

    boss.summonedSharks += 1;
    boss.nextSummonAt += config.summonIntervalMs ?? BOSS_SUMMON_INTERVAL_MS;
    const summonText = translate(config.summonLabelKey ?? 'engine.bossSharks');
    triggerFloatingText(state, summonText, state.width * 0.62, summonY - 24, config.secondaryAccent, false);
    callbacks.onFloatingText?.(summonText, state.width * 0.62, summonY - 24, config.secondaryAccent, false);
    callbacks.onBossSummon?.(config.id, kind);
  }

  for (const wave of boss.waves) {
    if (wave.phase === 'warning' && state.timeMs >= wave.activateAt) wave.phase = 'active';
    if (wave.phase === 'active') {
      wave.x -= BOSS_WAVE_SPEED * wave.speedMultiplier * dt;
      if (!invincible && !isFeverActive) {
        const distance = Math.hypot(wave.x - fishX, wave.y - state.fishY);
        if (distance < FAIR_FISH_HITBOX_RADIUS + wave.radius * 0.55) {
          if (absorbBossHit(state, callbacks, fishX)) return true;
          wave.x = -100;
        }
      }
    }
  }
  boss.waves = boss.waves.filter((wave) => wave.phase === 'warning' || wave.x > -80);

  if (!state.previewMode && boss.phase === 'battle' && state.timeMs >= boss.battleStartedAt + config.battleDurationMs) {
    boss.phase = 'retreating';
    boss.retreatStartedAt = state.timeMs;
    boss.waves = [];
    state.sharks = [];
    state.seaMines = [];
    state.jellyfish = [];
    boss.lastAttackAt = state.timeMs;
    addBurst(state, boss.x, boss.y, config.secondaryAccent, 34, 3.1);
    callbacks.onShake(3);
  }
  return false;
}

function spendExtraLife(state: EngineState, callbacks: EngineCallbacks) {
  if (state.lives <= 0) return false;
  state.lives -= 1;
  state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
  state.fishY = state.height / 2;
  state.fishVY = 0;
  state.fishRotation = 0;
  clearDangerousReviveArea(state);
  callbacks.onLifeChange?.(state.lives);
  callbacks.onShake(4); // Shaking is light & non-distracting
  callbacks.onRedFlash?.();
  addBurst(state, state.width * FISH_X_RATIO, state.fishY, 'rgba(80, 220, 255, 0.95)', 22, 3);
  return true;
}

function killOrUseLife(state: EngineState, callbacks: EngineCallbacks) {
  if (spendExtraLife(state, callbacks)) return;
  if (state.boss) stopBossVideo(state.boss.config);
  callbacks.onShake(8); // Reduced shake on gameover/death
  callbacks.onRedFlash?.();
  callbacks.onDeath();
  state.running = false;
}

function triggerFloatingText(state: EngineState, text: string, x: number, y: number, color: string, isBig = false) {
  const durationMs = isBig ? 900 : 700;
  state.floatingTexts.push({
    id: 'txt_' + Math.random(),
    x,
    y,
    text,
    color,
    size: isBig ? 18 : 13,
    createdAt: state.timeMs,
    durationMs,
  });
}

function announceEnvironmentTransition(state: EngineState, callbacks: EngineCallbacks) {
  const theme = environmentForScore(state.score);
  if (theme.minScore === 0 || state.score !== theme.minScore) return;
  triggerFloatingText(state, `✦ ${theme.label}`, state.width * 0.5, state.height * 0.30, theme.accent, true);
  addBurst(state, state.width * 0.5, state.height * 0.36, theme.speck, 16, 1.8);
  callbacks.onFloatingText?.(`Entered ${theme.label}`, state.width * 0.5, state.height * 0.30, theme.accent, true);
}

function applyLateGameSafetySupport(state: EngineState, callbacks: EngineCallbacks) {
  if (state.lateGameSafetyGranted || state.score < LATE_GAME_SUPPORT_SCORE) return;
  state.lateGameSafetyGranted = true;
  state.maxLives = LATE_GAME_MAX_EXTRA_LIVES;
  state.lives = Math.min(state.maxLives, state.lives + 1);
  state.shieldCharges = Math.min(LATE_GAME_MAX_SHIELD_CHARGES, state.shieldCharges + 1);
  const message = translate('engine.lateGameSupport');
  triggerFloatingText(state, message, state.width * 0.5, state.height * 0.30, '#ffe082', true);
  callbacks.onFloatingText?.(message, state.width * 0.5, state.height * 0.30, '#ffe082', true);
  callbacks.onLifeChange?.(state.lives);
  callbacks.onShake(2);
  addBurst(state, state.width * 0.5, state.height * 0.36, '#ffe082', 22, 2.5);
}

export function stepEngine(state: EngineState, dtMs: number, callbacks: EngineCallbacks, settings: { vibration: boolean }) {
  if (!state.running) return;
  const dt = Math.min(2.2, dtMs / 16.67);
  state.timeMs += dtMs;
  state.legendaryPulse = (state.legendaryPulse + dtMs * 0.002) % (Math.PI * 2);
  state.fishVY = Math.min(BASE.maxFallSpeed, state.fishVY + BASE.gravity * dt);
  state.fishY += state.fishVY * dt;
  if (state.previewMode) {
    state.fishY = state.height * 0.5;
    state.fishVY = 0;
  }
  state.fishRotation = Math.max(-0.5, Math.min(0.9, state.fishVY * 0.06));
  const groundY = state.height - 8;
  const ceilingY = 8;
  const invincible = Boolean(state.previewMode) || state.timeMs < state.invincibleUntil;
  if (state.fishY + BASE.fishRadius >= groundY || state.fishY - BASE.fishRadius <= ceilingY) {
    state.fishY = Math.max(ceilingY + BASE.fishRadius, Math.min(groundY - BASE.fishRadius, state.fishY));
    if (!invincible) { killOrUseLife(state, callbacks); return; }
    state.fishVY = 0;
  }

  // Red flash screen timer update
  if (state.isRedFlashing && state.redFlashTimer !== undefined) {
    state.redFlashTimer -= dtMs;
    if (state.redFlashTimer <= 0) {
      state.isRedFlashing = false;
    }
  }

  // Update floating text list
  state.floatingTexts = state.floatingTexts.filter((t) => {
    return state.timeMs - t.createdAt < t.durationMs;
  });

  const { speed: baseSpeed, spawnInterval } = difficultyForScore(state.score, state.timeMs);
  const isHourglassActive = state.hourglassUntil > state.timeMs;
  const speed = isHourglassActive ? baseSpeed * 0.6 : baseSpeed;
  const fishX = state.width * FISH_X_RATIO;
  applyLateGameSafetySupport(state, callbacks);

  state.elapsedSinceSpawn += dtMs;
  const nextBoss = BOSS_CONFIGS.find((config) => (state.previewMode || !config.previewOnly) && !state.defeatedBosses.includes(config.id) && state.score >= config.milestone && state.score >= state.nextBossEligibleScore);
  if (!state.boss && nextBoss) {
    startBossEncounter(state, callbacks, nextBoss);
  }

  // The boss arena clears existing danger and temporarily pauses new gates.
  // This gives every ink-bolt pattern a deliberately readable escape route.
  const bossActive = state.boss !== null;
  const gateSpacingClear = state.obstacles.every((obstacle) => obstacle.x < state.width * 0.52);
  if (!bossActive && state.elapsedSinceSpawn >= spawnInterval && gateSpacingClear) {
    spawnObstacle(state, state.score);
    state.elapsedSinceSpawn = 0;
  }

  // === FEVER MODE STREAM SPANNING ===
  const isFeverActive = state.feverUntil > state.timeMs;
  if (updateBossEncounter(state, dt, callbacks, fishX, invincible, isFeverActive)) return;

  if (isFeverActive) {
    state.elapsedSinceFeverCoinSpawn += dtMs;
    if (state.elapsedSinceFeverCoinSpawn >= 180) {
      state.elapsedSinceFeverCoinSpawn = 0;
      // Spawn beautifully dense pattern of coins directly ahead
      const angle = (state.timeMs * 0.005) % (Math.PI * 2);
      const coinY = state.height / 2 + Math.sin(angle) * (state.height * 0.28);
      state.coins.push({
        x: state.width + 40,
        y: coinY,
        collected: false,
        bonus: Math.random() < 0.15,
      });
      // Spawn extra air bubbles for a festive environment
      state.bubbles.push({
        x: state.width + 20,
        y: Math.random() * state.height,
        r: 3 + Math.random() * 5,
        speed: 1.5 + Math.random() * 2.0,
        drift: (Math.random() - 0.5) * 0.6,
      });
    }
  }

  // The magnet attracts every reward object, never enemies or obstacles.
  // Fever retains its stronger vacuum behavior while the normal magnet is more generous.
  const hasMagnet = state.magnetUntil > state.timeMs || isFeverActive;
  const magnetRange = isFeverActive
    ? 220
    : hasMagnet
      ? state.skin === 'poseidonsHeir'
        ? 270
        : state.skin === 'sapphire'
          ? 230
          : 175
      : 0;
  const magnetPull = isFeverActive ? 0.35 : state.skin === 'poseidonsHeir' ? 0.42 : state.skin === 'sapphire' ? 0.34 : 0.28;
  const pullCollectable = (collectable: { x: number; y: number; collected: boolean }) => {
    if (!hasMagnet || collectable.collected) return;
    const dx = collectable.x - fishX;
    const dy = collectable.y - state.fishY;
    const distance = Math.hypot(dx, dy);
    if (distance > 5 && distance < magnetRange) {
      collectable.x -= dx * magnetPull * dt;
      collectable.y -= dy * magnetPull * dt;
    }
  };

  // Obstacle movement, collision, and Near Miss tracking
  for (const obs of state.obstacles) {
    obs.x -= speed * dt;
    if (obs.bobbing) {
      obs.bobPhase += dtMs * 0.00145;
      obs.gapY = clampGapY(state, obs.baseGapY + Math.sin(obs.bobPhase) * obs.bobAmount, obs.gapSize);
    }
    if (!obs.passed && obs.x + BASE.obstacleWidth / 2 < fishX) {
      obs.passed = true;
      state.score += 1;
      callbacks.onScore(state.score);
      announceEnvironmentTransition(state, callbacks);
    }

    // Near Miss system
    if (!obs.nearMissChecked && obs.x < fishX && obs.x > fishX - 25) {
      obs.nearMissChecked = true;
      const topGapEdge = obs.gapY - obs.gapSize / 2;
      const bottomGapEdge = obs.gapY + obs.gapSize / 2;

      // Check if player passed through without collision but extremely close to top/bottom boundaries
      const spaceToTop = (state.fishY - BASE.fishRadius) - topGapEdge;
      const spaceToBottom = bottomGapEdge - (state.fishY + BASE.fishRadius);

      const withinGap = state.fishY - BASE.fishRadius >= topGapEdge && state.fishY + BASE.fishRadius <= bottomGapEdge;
      const isExtremeClose = spaceToTop < 25 || spaceToBottom < 25;

      if (withinGap && isExtremeClose && !invincible && state.running) {
        state.score += 2;
        callbacks.onScore(state.score);
        callbacks.onNearMiss?.();
        triggerFloatingText(state, '+2 Near Miss! 🔥', fishX, state.fishY - 28, '#00e5ff', true);
        // Spray a beautiful trail of teal particles
        addBurst(state, fishX, state.fishY, 'rgba(0, 229, 255, 0.85)', 15, 2.5);
      }
    }

    if (!invincible && !isFeverActive) {
      const withinX = fishX + FAIR_FISH_HITBOX_RADIUS > obs.x - BASE.obstacleWidth / 2 && fishX - FAIR_FISH_HITBOX_RADIUS < obs.x + BASE.obstacleWidth / 2;
      if (withinX) {
        const topGapEdge = obs.gapY - obs.gapSize / 2;
        const bottomGapEdge = obs.gapY + obs.gapSize / 2;
        let safe: boolean;
        if (obs.isDouble) {
          const secondTop = bottomGapEdge + 58;
          const secondBottom = secondTop + 52;
          const inGap1 = state.fishY - FAIR_FISH_HITBOX_RADIUS >= topGapEdge && state.fishY + FAIR_FISH_HITBOX_RADIUS <= bottomGapEdge;
          const inGap2 = state.fishY - FAIR_FISH_HITBOX_RADIUS >= secondTop && state.fishY + FAIR_FISH_HITBOX_RADIUS <= secondBottom;
          safe = inGap1 || inGap2;
        } else {
          safe = !(state.fishY - FAIR_FISH_HITBOX_RADIUS < topGapEdge || state.fishY + FAIR_FISH_HITBOX_RADIUS > bottomGapEdge);
        }
        if (!safe) {
          if (state.shieldCharges > 0) {
            state.shieldCharges = Math.max(0, state.shieldCharges - 1);
            state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
            callbacks.onShake(3); // Screen shake is very light & minor
            triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
            addBurst(state, fishX, state.fishY, 'rgba(100, 210, 255, 0.95)', 25, 3);
          } else {
            killOrUseLife(state, callbacks);
            return;
          }
        }
      }
    }
  }
  state.obstacles = state.obstacles.filter((o) => o.x > -BASE.obstacleWidth * 2);

  // Shark movement and collision
  for (const shark of state.sharks) {
    const sharkSpeed = (speed + 0.8) * (shark.speedMultiplier ?? 1) * dt;
    shark.x -= sharkSpeed;
    shark.bobPhase += shark.bobSpeed * dtMs;
    shark.y = shark.baseY + Math.sin(shark.bobPhase) * shark.bobAmount;

    if (!shark.passed && shark.x + shark.width / 2 < fishX) {
      shark.passed = true;
    }

    // Collision with Shark
    if (!invincible && !isFeverActive) {
      const withinX = fishX + FAIR_FISH_HITBOX_RADIUS > shark.x - shark.width * 0.42 && fishX - FAIR_FISH_HITBOX_RADIUS < shark.x + shark.width * 0.42;
      const withinY = state.fishY + FAIR_FISH_HITBOX_RADIUS > shark.y - shark.height * 0.40 && state.fishY - FAIR_FISH_HITBOX_RADIUS < shark.y + shark.height * 0.40;
      if (withinX && withinY) {
        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
          callbacks.onShake(3); // Light non-distracting screen shake
          triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
          addBurst(state, fishX, state.fishY, 'rgba(100, 210, 255, 0.95)', 25, 3);
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.sharks = state.sharks.filter((s) => s.x > -150);

  // Sea Mine movement and collision
  for (const mine of state.seaMines) {
    mine.x -= speed * (mine.speedMultiplier ?? 1) * dt;
    mine.pulsePhase += dtMs * 0.0075;

    if (!mine.exploded && !invincible && !isFeverActive) {
      const dx = mine.x - fishX;
      const dy = mine.y - state.fishY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < FAIR_FISH_HITBOX_RADIUS + mine.radius * 0.78) {
        mine.exploded = true;
        // Explode!
        callbacks.onShake(12);
        callbacks.onRedFlash?.();
        addBurst(state, mine.x, mine.y, '#ff3d00', 30, 4);
        addBurst(state, mine.x, mine.y, '#ffc107', 20, 2.5);

        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
          triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.seaMines = state.seaMines.filter((m) => m.x > -100 && !m.exploded);

  // Jellyfish movement and collision
  for (const jelly of state.jellyfish) {
    jelly.x -= (speed - 0.5) * (jelly.speedMultiplier ?? 1) * dt;
    jelly.bobPhase += jelly.bobSpeed * dtMs;
    jelly.y = jelly.baseY + Math.sin(jelly.bobPhase) * jelly.bobAmount;

    if (!invincible && !isFeverActive) {
      const dx = jelly.x - fishX;
      const dy = jelly.y - state.fishY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < FAIR_FISH_HITBOX_RADIUS + jelly.radius * 0.76) {
        // Shock!
        callbacks.onShake(6);
        callbacks.onRedFlash?.();
        addBurst(state, jelly.x, jelly.y, '#e040fb', 22, 3);
        addBurst(state, jelly.x, jelly.y, '#00e5ff', 15, 2);

        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
          triggerFloatingText(state, 'Shield Block!', fishX, state.fishY - 30, '#80d8ff', true);
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.jellyfish = state.jellyfish.filter((j) => j.x > -100);

  // Coin collect streak / combo logic & coin collection
  for (const coin of state.coins) {
    coin.x -= speed * dt;
    pullCollectable(coin);
    if (!coin.collected) {
      const dx = coin.x - fishX;
      const dy = coin.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 13) {
        coin.collected = true;
        const baseAmount = coin.bonus ? 5 : 1;

        // Combo / Streak multiplier system
        const now = state.timeMs;
        let finalAmount = baseAmount;
        if (now - state.lastCoinCollectedTime < 1800) {
          state.coinStreakCount++;
        } else {
          state.coinStreakCount = 1;
        }
        state.lastCoinCollectedTime = now;

        let comboText = '';
        if (state.coinStreakCount >= 30) {
          finalAmount *= 4;
          comboText = '🔥 COMBO x4 🔥';
        } else if (state.coinStreakCount >= 20) {
          finalAmount *= 3;
          comboText = '✨ COMBO x3 ✨';
        } else if (state.coinStreakCount >= 10) {
          finalAmount *= 2;
          comboText = '⭐ COMBO x2 ⭐';
        }

        if (state.skin === 'poseidonsHeir') {
          finalAmount = Math.ceil(finalAmount * 1.50);
        } else if (state.skin === 'sapphire') {
          finalAmount = Math.ceil(finalAmount * 1.35);
        }

        state.score += finalAmount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(finalAmount);

        // Render Combo & collection text (No shaking or jitter on collection)
        const txtColor = coin.bonus ? '#ffd54f' : '#fff59d';
        triggerFloatingText(state, `+${finalAmount}`, coin.x, coin.y - 12, txtColor, false);
        if (comboText) {
          triggerFloatingText(state, comboText, fishX, state.fishY - 28, '#ffca28', true);
          // Sparkle golden burst stars for combos
          addBurst(state, coin.x, coin.y, '#ffd60a', 15, 3.5);
        } else {
          addBurst(state, coin.x, coin.y, coin.bonus ? '#ff9500' : '#ffd60a', 12, 2);
        }
      }
    }
  }

  state.coins = state.coins.filter((c) => c.x > -40 && !c.collected);

  // Gem (Heart) collection
  for (const gem of state.gems) {
    gem.x -= speed * dt;
    gem.pulse += dtMs * 0.0045;
    pullCollectable(gem);
    if (!gem.collected) {
      const dx = gem.x - fishX;
      const dy = gem.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 16) {
        gem.collected = true;
        if (state.lives < state.maxLives) {
          state.lives += 1;
          callbacks.onGemCollect?.(state.lives);
          callbacks.onLifeChange?.(state.lives);
          triggerFloatingText(state, translate('engine.life'), gem.x, gem.y - 15, '#81c784', true);
        } else {
          state.score += 5;
          callbacks.onScore(state.score);
          triggerFloatingText(state, '+5', gem.x, gem.y - 15, '#ff4081', true);
        }
        callbacks.onShake(1); // Very light non-distracting shake
        addBurst(state, gem.x, gem.y, '#ffd1d1', 22, 3);
      }
    }
  }
  state.gems = state.gems.filter((g) => g.x > -50 && !g.collected);

  // Power-up collection (including Fever mode Star!)
  for (const pu of state.powerUps) {
    pu.x -= speed * dt;
    if (pu.pulse !== undefined) pu.pulse += dtMs * 0.004;
    pullCollectable(pu);
    if (!pu.collected) {
      const dx = pu.x - fishX;
      const dy = pu.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 18) {
        pu.collected = true;
        callbacks.onPowerUpCollect?.(pu.type);
        if (pu.type === 'shield') {
          const shieldCapacity = state.score >= LATE_GAME_SUPPORT_SCORE ? LATE_GAME_MAX_SHIELD_CHARGES : MAX_SHIELD_CHARGES;
          state.shieldCharges = Math.min(shieldCapacity, state.shieldCharges + 1);
          callbacks.onShake?.(1); // Light non-distracting shake
          triggerFloatingText(state, translate('engine.shield'), pu.x, pu.y - 15, '#29b6f6', true);
          addBurst(state, pu.x, pu.y, 'rgba(70, 180, 255, 0.9)', 20, 3);
        } else if (pu.type === 'magnet') {
          const durationMultiplier = state.skin === 'poseidonsHeir'
            ? 1.75
            : state.skin === 'sapphire'
              ? 1.40
              : state.skin === 'emerald'
                ? 1.25
                : 1;
          const duration = MAGNET_DURATION_MS * durationMultiplier;
          state.magnetUntil = state.timeMs + duration;
          triggerFloatingText(state, translate('engine.magnet', undefined, { seconds: Math.round(duration / 1000) }), pu.x, pu.y - 15, '#ffa726', true);
          addBurst(state, pu.x, pu.y, 'rgba(255, 140, 0, 0.9)', 18, 3);
        } else if (pu.type === 'fever') {
          state.feverUntil = state.timeMs + 6000;
          state.elapsedSinceFeverCoinSpawn = 180; // trigger immediate coin spawn
          callbacks.onFeverStart?.();
          triggerFloatingText(state, translate('engine.fever'), pu.x, pu.y - 15, '#e040fb', true);
          addBurst(state, pu.x, pu.y, 'rgba(224, 64, 251, 0.95)', 26, 3);
        } else if (pu.type === 'hourglass') {
          state.hourglassUntil = state.timeMs + 5000;
          callbacks.onShake?.(1); // Light non-distracting shake
          triggerFloatingText(state, translate('engine.slowMo'), pu.x, pu.y - 15, '#00e5ff', true);
          addBurst(state, pu.x, pu.y, 'rgba(0, 229, 255, 0.95)', 20, 3);
        }
      }
    }
  }
  state.powerUps = state.powerUps.filter((p) => p.x > -60 && !p.collected);

  // Bubble Boost Ring collection
  for (const ring of state.boostRings) {
    ring.x -= speed * dt;
    pullCollectable(ring);
    if (!ring.collected) {
      const dx = ring.x - fishX;
      const dy = ring.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + ring.radius) {
        ring.collected = true;
        const dropRushDuration = state.skin === 'poseidonsHeir'
          ? 30_000
          : state.skin === 'solar'
            ? 25_000
            : DROP_RUSH_DURATION_MS;
        state.boostUntil = state.timeMs + dropRushDuration;
        triggerFloatingText(state, translate('engine.dropRush', undefined, { seconds: Math.round(dropRushDuration / 1000) }), ring.x, ring.y - 15, '#ffd54f', true);
        callbacks.onShake(1); // Very minor shake
        addBurst(state, ring.x, ring.y, '#00e5ff', 18, 2);
        addBurst(state, ring.x, ring.y, '#ffd54f', 12, 2.4);
      }
    }
  }
  state.boostRings = state.boostRings.filter((br) => br.x > -60 && !br.collected);

  // Treasure Chest collection
  for (const chest of state.chests) {
    chest.x -= speed * dt;
    pullCollectable(chest);
    if (!chest.collected) {
      const dx = chest.x - fishX;
      const dy = chest.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 22) {
        chest.collected = true;
        callbacks.onCoinCollect(25);
        state.score += 25;
        callbacks.onScore(state.score);
        triggerFloatingText(state, translate('engine.treasure'), chest.x, chest.y - 20, '#ffd54f', true);
        callbacks.onShake(1); // Very minor shake
        addBurst(state, chest.x, chest.y, '#ffd54f', 30, 3);
      }
    }
  }
  state.chests = state.chests.filter((c) => c.x > -60 && !c.collected);

  // Bubble animations
  for (const b of state.bubbles) {
    b.y -= b.speed * dt;
    b.x += Math.sin(state.timeMs * 0.001 + b.x) * b.drift * dt;
    if (b.y < -20) { b.y = state.height + 10; b.x = Math.random() * state.width; }
  }

  // Particle updates
  for (const p of state.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.05 * dt;
  }
  state.particles = state.particles.filter((p) => p.life < p.maxLife);
  state.shakeIntensity = Math.max(0, state.shakeIntensity - dtMs * 0.05);
  void settings;
}

function drawEnvironmentDecor(ctx: CanvasRenderingContext2D, state: EngineState, theme: EnvironmentTheme) {
  const { width, height } = state;
  const drift = state.timeMs * 0.00035;
  ctx.save();

  if (theme.id === 'coral') {
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 9; i++) {
      const x = (i * 71 + 24) % (width + 60) - 30;
      const y = height - 24 - ((i * 37) % 85);
      ctx.fillStyle = i % 2 ? '#ff856f' : '#ffbf80';
      ctx.beginPath();
      ctx.arc(x, y, 8 + (i % 3) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 8, y + 9, 5 + (i % 2) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (theme.id === 'kelp') {
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#77bd55';
    ctx.lineWidth = 6;
    for (let i = 0; i < 7; i++) {
      const x = (width / 6) * i - 10;
      const h = 95 + (i % 3) * 42;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.bezierCurveTo(x - 18, height - h * 0.35, x + 23, height - h * 0.70, x + Math.sin(drift + i) * 16, height - h);
      ctx.stroke();
    }
  } else if (theme.id === 'ruins' || theme.id === 'temple') {
    ctx.globalAlpha = theme.id === 'temple' ? 0.34 : 0.24;
    ctx.fillStyle = theme.id === 'temple' ? '#1d6080' : '#303d8b';
    for (let i = 0; i < 4; i++) {
      const x = 30 + i * (width / 3.2);
      const h = 72 + (i % 2) * 45;
      ctx.fillRect(x, height - h, 16, h);
      ctx.fillRect(x - 8, height - h - 9, 32, 10);
      if (theme.id === 'temple') {
        ctx.fillStyle = '#63eee2';
        ctx.fillRect(x + 6, height - h + 13, 3, h * 0.48);
        ctx.fillStyle = '#1d6080';
      }
    }
  } else if (theme.id === 'volcanic') {
    ctx.globalAlpha = 0.40;
    ctx.fillStyle = '#602938';
    for (let i = 0; i < 6; i++) {
      const x = i * (width / 5) - 20;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + 24, height - 58 - (i % 2) * 22);
      ctx.lineTo(x + 53, height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ff9e57';
    for (let i = 0; i < 12; i++) {
      const x = (i * 73 + 31) % width;
      const y = height - 40 - ((i * 61 + state.timeMs * 0.012) % (height * 0.62));
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3) * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, state: EngineState) {
  const { width, height } = state;
  const theme = environmentForScore(state.score);

  // Each score band changes the water palette and physical environment.
  const c1 = theme.mid;
  const grad = ctx.createLinearGradient(0, 0, 0, height);

  // Check if Fever Mode is active to shift background into shifting rainbow color space
  const isFever = state.feverUntil > state.timeMs;
  if (isFever) {
    const feverHue = (state.timeMs / 10) % 360;
    grad.addColorStop(0, `hsl(${feverHue}, 80%, 30%)`);
    grad.addColorStop(0.5, `hsl(${(feverHue + 120) % 360}, 75%, 20%)`);
    grad.addColorStop(1, '#000814');
  } else {
    grad.addColorStop(0, theme.top);
    grad.addColorStop(0.46, c1);
    grad.addColorStop(1, theme.bottom);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  drawWaterTexture(ctx, state);

  if (!isFever && theme.id === 'temple') {
    const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
    ctx.fillStyle = `rgba(76, 240, 225, ${0.035 + pulse * 0.045})`;
    ctx.fillRect(0, 0, width, height);
  }

  // 1. Light Rays from the top
  ctx.save();
  ctx.globalAlpha = isFever ? 0.25 : 0.15;
  for (let i = 0; i < 5; i++) {
    const rx = (width / 5) * i + Math.sin(state.timeMs * 0.00015 + i) * 35;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + 75, 0);
    ctx.lineTo(rx - 30, height);
    ctx.lineTo(rx - 140, height);
    ctx.closePath();
    const rayGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (isFever) {
      rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      rayGrad.addColorStop(1, 'transparent');
    } else {
      rayGrad.addColorStop(0, theme.ray);
      rayGrad.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = rayGrad;
    ctx.fill();
  }
  ctx.restore();

  drawEnvironmentDecor(ctx, state, theme);

  // 2. Far fish shadows (floating silhouettes with parallax)
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = theme.pillarDark;
  for (let i = 0; i < 4; i++) {
    const fx = ((state.timeMs * 0.018 * (1 + i * 0.1) + i * 250) % (width + 300)) - 150;
    const fy = 80 + ((i * 123) % (height - 200)) + Math.sin(state.timeMs * 0.001 + i) * 15;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx - 15, fy);
    ctx.lineTo(fx - 22, fy - 5);
    ctx.lineTo(fx - 22, fy + 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Bubbles floating
  ctx.save();
  for (const b of state.bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = theme.speck;
    ctx.fill();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = theme.speck;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // 4. Seaweeds & beautiful coral decor at the bottom
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = theme.id === 'coral' ? '#5a254f' : theme.id === 'kelp' ? '#164d36' : theme.pillarDark;
  for (let i = 0; i < 10; i++) {
    const cx = (width / 9) * i + Math.sin(state.timeMs * 0.0006 + i) * 10;
    const h = 40 + ((i * 47) % 65);
    ctx.beginPath();
    ctx.moveTo(cx, height);
    ctx.quadraticCurveTo(cx - 16, height - h, cx, height - h - 15);
    ctx.quadraticCurveTo(cx + 16, height - h, cx, height);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 10, height);
    ctx.quadraticCurveTo(cx + 2, height - h * 0.7, cx + 8, height - h * 0.7 - 8);
    ctx.quadraticCurveTo(cx + 18, height - h * 0.7, cx + 10, height);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, height - 8, width, 8);
  ctx.fillRect(0, 0, width, 8);
}

function drawColumnDetail(ctx: CanvasRenderingContext2D, x: number, yStart: number, yEnd: number, w: number, theme: EnvironmentTheme) {
  if (yEnd - yStart < 26) return;
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = theme.accent;
  ctx.fillStyle = theme.accent;
  ctx.lineWidth = 1.4;

  for (let y = yStart + 22; y < yEnd - 12; y += 34) {
    if (theme.id === 'coral') {
      ctx.beginPath();
      ctx.arc(x + w * 0.30, y, 4, 0, Math.PI * 2);
      ctx.arc(x + w * 0.58, y + 7, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.id === 'kelp') {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.28, y + 9);
      ctx.quadraticCurveTo(x + w * 0.52, y - 10, x + w * 0.70, y + 8);
      ctx.stroke();
    } else if (theme.id === 'ruins' || theme.id === 'temple') {
      ctx.strokeRect(x + w * 0.34, y - 5, w * 0.28, 10);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.40, y);
      ctx.lineTo(x + w * 0.56, y);
      ctx.stroke();
    } else if (theme.id === 'volcanic') {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.32, y - 8);
      ctx.lineTo(x + w * 0.58, y);
      ctx.lineTo(x + w * 0.42, y + 11);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.28, y);
      ctx.quadraticCurveTo(x + w * 0.50, y - 10, x + w * 0.72, y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, height: number) {
  const topGapEdge = obs.gapY - obs.gapSize / 2;
  const bottomGapEdge = obs.gapY + obs.gapSize / 2;
  const w = BASE.obstacleWidth;
  const x = obs.x - w / 2;
  const theme = ENVIRONMENTS.find((item) => item.id === obs.environment) ?? ENVIRONMENTS[0];

  // Material and palette now belong to the environment, not only a late-game
  // gold variant. The opening itself remains simple and high contrast.
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, theme.pillarDark);
  grad.addColorStop(0.5, theme.pillarMid);
  grad.addColorStop(1, theme.pillarDark);

  ctx.fillStyle = grad;
  if (theme.id === 'temple') {
    ctx.save();
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 12;
  }

  // Draw TOP Pillar with nice rounded cap
  ctx.fillRect(x, 0, w, topGapEdge - 15);
  ctx.fillStyle = theme.cap;
  ctx.fillRect(x - 5, topGapEdge - 18, w + 10, 18);

  // Draw BOTTOM Pillar with nice rounded cap
  if (obs.isDouble) {
    const secondTop = bottomGapEdge + 58;
    const secondBottom = secondTop + 52;

    // Draw the middle segment pillar
    ctx.fillStyle = grad;
    ctx.fillRect(x, bottomGapEdge + 15, w, secondTop - (bottomGapEdge + 15));
    // Caps for the middle segment
    ctx.fillStyle = theme.cap;
    ctx.fillRect(x - 5, bottomGapEdge, w + 10, 15);
    ctx.fillRect(x - 5, secondTop - 15, w + 10, 15);

    // Draw the bottommost segment pillar
    ctx.fillStyle = grad;
    ctx.fillRect(x, secondBottom + 15, w, height - (secondBottom + 15));
    ctx.fillStyle = theme.cap;
    ctx.fillRect(x - 5, secondBottom, w + 10, 15);
  } else {
    // Normal single bottom pillar
    ctx.fillStyle = grad;
    ctx.fillRect(x, bottomGapEdge + 15, w, height - bottomGapEdge - 15);
    ctx.fillStyle = theme.cap;
    ctx.fillRect(x - 5, bottomGapEdge, w + 10, 18);
  }

  drawColumnDetail(ctx, x, 0, topGapEdge - 18, w, theme);
  if (!obs.isDouble) drawColumnDetail(ctx, x, bottomGapEdge + 18, height, w, theme);

  if (theme.id === 'temple') ctx.restore();
}

function drawFishPowerUpIndicators(ctx: CanvasRenderingContext2D, state: EngineState, r: number, isFever: boolean) {
  if (state.shieldCharges > 0) {
    const shieldPulse = (Math.sin(state.legendaryPulse * 1.8) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.22 + shieldPulse * 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
    ctx.fillStyle = '#4fc3f7';
    ctx.fill();
    ctx.globalAlpha = 0.65 + shieldPulse * 0.25;
    ctx.strokeStyle = '#e3f2fd';
    ctx.lineWidth = 3.5 + shieldPulse * 1.2;
    ctx.stroke();
    ctx.restore();
  }

  if (state.magnetUntil > state.timeMs || isFever) {
    const magPulse = (Math.sin(state.timeMs * 0.009) + 1) / 2;
    ctx.save();
    ctx.shadowColor = isFever ? '#e040fb' : '#ff6d00';
    ctx.shadowBlur = isFever ? 44 : 32 + magPulse * 14;
    ctx.globalAlpha = 0.4 + magPulse * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, r * (isFever ? 1.85 : 1.45), 0, Math.PI * 2);
    ctx.strokeStyle = isFever ? '#e040fb' : '#ff9500';
    ctx.lineWidth = isFever ? 4.0 : 2.5;
    ctx.stroke();
    ctx.restore();
  }

  if (state.boostUntil > state.timeMs) {
    const rushPulse = (Math.sin(state.timeMs * 0.010) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.45 + rushPulse * 0.25;
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 14 + rushPulse * 10;
    ctx.strokeStyle = '#fff3a6';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -state.timeMs * 0.018;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0, 25, 48, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-31, -r * 2.65, 62, 14, 7);
    ctx.fill();
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff3a6';
    ctx.font = '700 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const secondsLeft = Math.max(1, Math.ceil((state.boostUntil - state.timeMs) / 1000));
    ctx.fillText(translate('engine.dropRush', undefined, { seconds: secondsLeft }), 0, -r * 2.65 + 7);
    ctx.restore();
  }
}

function drawFish(ctx: CanvasRenderingContext2D, state: EngineState, fishX: number, invincible: boolean) {
  const skin = SKINS.find((s) => s.id === state.skin) ?? SKINS[0];
  const isFever = state.feverUntil > state.timeMs;
  const blink = (invincible || isFever) && Math.floor(state.timeMs / 100) % 2 === 0;
  if (blink) return;
  const r = BASE.fishRadius;
  const id = skin.id;
  const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
  const { body, belly, fin, glow } = skin.colors;
  const swimBob = Math.sin(state.timeMs * 0.007) * 0.75;
  const accent = id === 'ruby' ? '#ffcc80' : id === 'diamond' ? '#b2ebf2' : id === 'legendary' ? '#ffe066' : '#2fe3e8';

  // A stronger tail wave, small body bob, and independent front-fin flap make
  // the player read as a living fish even at high game speed.
  const wag = Math.sin(state.timeMs * (isFever ? 0.027 : 0.014)) * 0.16;

  ctx.save();
  ctx.translate(fishX, state.fishY + swimBob);
  ctx.rotate(state.fishRotation);
  ctx.scale(bossEncounterScale(state), bossEncounterScale(state));

  {
    // The hero skin keeps its clean silhouette; the circular aura is reserved
    // for the temporary Fever power-up so it always communicates a state.
    if (isFever) {
      ctx.save();
      ctx.globalAlpha = 0.28 + pulse * 0.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.9, r * 1.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${(state.timeMs / 4) % 360}, 100%, 75%)`;
      ctx.fill();
      ctx.globalAlpha = 0.5 + pulse * 0.25;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.6, r * 1.12, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `hsl(${(state.timeMs / 4) % 360}, 100%, 75%)`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = isFever ? '#e040fb' : glow;
    ctx.shadowBlur = isFever ? 32 : id === 'legendary' ? 30 : id === 'diamond' ? 24 : 16;

    // Tiny bubble and sparkle wake: visual only, kept behind the fish so it
    // never obscures obstacles or changes collision behaviour.
    ctx.save();
    ctx.globalAlpha = 0.24 + pulse * 0.16;
    for (let i = 0; i < 3; i++) {
      const bubbleX = -r * (1.45 + i * 0.42);
      const bubbleY = Math.sin(state.timeMs * 0.012 + i * 2.1) * (3 + i * 1.4);
      ctx.beginPath();
      ctx.arc(bubbleX, bubbleY, 1.6 + i * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = i === 2 && isFever ? '#fff176' : '#b8f7ff';
      ctx.fill();
    }
    ctx.restore();

    // Every selectable player fish now uses its own premium 16-frame Sprite Sheet.
    const heroSheet = getPlayerFishSpriteSheet(id);
    if (heroSheet?.complete && heroSheet.naturalWidth && heroSheet.naturalHeight) {
      const frame = Math.floor(state.timeMs / 74) % 16;
      const sourceWidth = heroSheet.naturalWidth / 4;
      const sourceHeight = heroSheet.naturalHeight / 4;
      const sourceX = (frame % 4) * sourceWidth;
      const sourceY = Math.floor(frame / 4) * sourceHeight;
      const heroSize = r * 3.7;
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(heroSheet, sourceX, sourceY, sourceWidth, sourceHeight, -heroSize / 2, -heroSize / 2, heroSize, heroSize);
      drawFishPowerUpIndicators(ctx, state, r, isFever);
      ctx.restore();
      ctx.restore();
      return;
    }

    // Dynamic Tail with Wag
    ctx.save();
    ctx.translate(-r * 0.8, 0);
    ctx.rotate(wag);
    if (id === 'ruby') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.8, -r * 1.3, -r * 1.5, -r * 0.6);
      ctx.quadraticCurveTo(-r * 1.1, 0, -r * 1.5, r * 0.6);
      ctx.quadraticCurveTo(-r * 0.8, r * 1.3, 0, 0);
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    } else if (id === 'legendary') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.9, -r * 1.25, -r * 1.6, -r * 0.45);
      ctx.lineTo(-r * 1.0, 0);
      ctx.quadraticCurveTo(-r * 1.6, r * 0.45, -r * 0.9, r * 1.25);
      ctx.closePath();
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
    } else {
      // Elegant streamlined tail shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.65, -r * 0.95, -r * 1.15, -r * 0.35);
      ctx.quadraticCurveTo(-r * 0.75, 0, -r * 1.15, r * 0.35);
      ctx.quadraticCurveTo(-r * 0.65, r * 0.95, 0, 0);
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    }
    // Delicate tail rays make the tail read as a fin instead of a flat shape.
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, 0);
    ctx.lineTo(-r * 0.9, -r * 0.25);
    ctx.moveTo(-r * 0.18, 0);
    ctx.lineTo(-r * 0.9, r * 0.25);
    ctx.stroke();
    ctx.restore();

    // Body
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.95, r * 0.15, -r * 0.88);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.5, r * 1.05, 0);
    ctx.quadraticCurveTo(r * 0.95, r * 0.5, r * 0.15, r * 0.88);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.95, -r * 0.9, 0);
    ctx.closePath();
    const bodyGrad = ctx.createLinearGradient(-r, -r, r, r);
    if (isFever) {
      bodyGrad.addColorStop(0, '#e040fb');
      bodyGrad.addColorStop(0.5, '#00e5ff');
      bodyGrad.addColorStop(1, '#ffeb3b');
    } else if (id === 'legendary') {
      bodyGrad.addColorStop(0, '#1a1a1a');
      bodyGrad.addColorStop(0.5, '#ffd60a');
      bodyGrad.addColorStop(1, '#1a1a1a');
    } else {
      bodyGrad.addColorStop(0, belly);
      bodyGrad.addColorStop(0.4, body);
      bodyGrad.addColorStop(1, fin);
    }
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Turquoise scale-stripes are a stable visual signature for the player
    // and preserve a readable silhouette on all unlocked skins.
    ctx.save();
    ctx.globalAlpha = isFever ? 0.72 : 0.62;
    ctx.strokeStyle = isFever ? '#fff176' : accent;
    ctx.lineWidth = Math.max(1.6, r * 0.105);
    ctx.lineCap = 'round';
    for (let stripe = 0; stripe < 3; stripe++) {
      const stripeX = -r * 0.22 + stripe * r * 0.29;
      ctx.beginPath();
      ctx.moveTo(stripeX, -r * 0.58);
      ctx.quadraticCurveTo(stripeX - r * 0.10, 0, stripeX, r * 0.57);
      ctx.stroke();
    }
    ctx.restore();

    // Highlight Gloss
    const glossGrad = ctx.createLinearGradient(0, -r, 0, r);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glossGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
    glossGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glossGrad;
    ctx.beginPath();
    ctx.ellipse(r * 0.1, -r * 0.25, r * 0.6, r * 0.25, Math.PI / 10, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.beginPath();
    ctx.ellipse(r * 0.1, r * 0.28, r * 0.55, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = belly;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.25, -r * 1.25, r * 0.7, -r * 0.55);
    ctx.quadraticCurveTo(r * 0.3, -r * 0.8, 0, -r * 0.7);
    ctx.closePath();
    ctx.fillStyle = id === 'legendary' ? '#ffd60a' : fin;
    ctx.fill();

    // Pectoral Fin with subtle dynamic rotation
    ctx.save();
    ctx.translate(r * 0.25, r * 0.1);
    ctx.rotate(Math.sin(state.timeMs * 0.01) * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.3, r * 0.85, r * 0.25);
    ctx.quadraticCurveTo(r * 0.45, r * 0.2, 0, 0);
    ctx.closePath();
    ctx.fillStyle = fin;
    ctx.fill();
    ctx.restore();

    // Expressive glossy eye, cheek and gill line give the fish a characterful
    // face without making it visually noisy at mobile scale.
    ctx.beginPath();
    ctx.arc(r * 0.56, -r * 0.16, 5.3, 0, Math.PI * 2);
    ctx.fillStyle = '#fffdf3';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.72, -r * 0.14, 3.35, 0, Math.PI * 2);
    ctx.fillStyle = isFever ? '#7c4dff' : '#125d82';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.86, -r * 0.12, 1.75, 0, Math.PI * 2);
    ctx.fillStyle = '#081923';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.11 + r * 0.60, -r * 0.16 - 2.0, 1.35, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#ff8a80';
    ctx.beginPath();
    ctx.ellipse(r * 0.39, r * 0.19, r * 0.19, r * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#7a4d24';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(r * 0.18, -r * 0.02, r * 0.22, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // === VISUAL POWER-UP INDICATORS ===
  if (state.shieldCharges > 0) {
    const shieldPulse = (Math.sin(state.legendaryPulse * 1.8) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.22 + shieldPulse * 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
    ctx.fillStyle = '#4fc3f7';
    ctx.fill();
    ctx.globalAlpha = 0.65 + shieldPulse * 0.25;
    ctx.strokeStyle = '#e3f2fd';
    ctx.lineWidth = 3.5 + shieldPulse * 1.2;
    ctx.stroke();
    ctx.restore();
  }

  if (state.magnetUntil > state.timeMs || isFever) {
    const magPulse = (Math.sin(state.timeMs * 0.009) + 1) / 2;
    ctx.save();
    ctx.shadowColor = isFever ? '#e040fb' : '#ff6d00';
    ctx.shadowBlur = isFever ? 44 : 32 + magPulse * 14;
    ctx.globalAlpha = 0.4 + magPulse * 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, r * (isFever ? 1.85 : 1.45), 0, Math.PI * 2);
    ctx.strokeStyle = isFever ? '#e040fb' : '#ff9500';
    ctx.lineWidth = isFever ? 4.0 : 2.5;
    ctx.stroke();
    ctx.restore();
  }

  if (state.boostUntil > state.timeMs) {
    const rushPulse = (Math.sin(state.timeMs * 0.010) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.45 + rushPulse * 0.25;
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 14 + rushPulse * 10;
    ctx.strokeStyle = '#fff3a6';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -state.timeMs * 0.018;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0, 25, 48, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-31, -r * 2.65, 62, 14, 7);
    ctx.fill();
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff3a6';
    ctx.font = '700 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const secondsLeft = Math.max(1, Math.ceil((state.boostUntil - state.timeMs) / 1000));
    ctx.fillText(translate('engine.dropRush', undefined, { seconds: secondsLeft }), 0, -r * 2.65 + 7);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

function drawShark(ctx: CanvasRenderingContext2D, shark: PredatorShark, timeMs: number) {
  ctx.save();
  ctx.translate(shark.x, shark.y);
  ctx.rotate(Math.sin(timeMs * 0.004 + shark.bobPhase) * 0.045);

  const pulse = (Math.sin(timeMs * 0.005) + 1) / 2;
  if (shark.minionArt && drawMinionSprite(ctx, shark.minionArt, timeMs, shark.bobPhase, shark.width * 1.28)) {
    ctx.restore();
    return;
  }
  const tailSway = Math.sin(timeMs * 0.014 + shark.bobPhase) * 0.17;
  ctx.shadowColor = '#d32f2f';
  ctx.shadowBlur = 15 + pulse * 6;

  // Shark Body
  const sharkBodyGrad = ctx.createLinearGradient(-shark.width / 2, 0, shark.width / 2, 0);
  sharkBodyGrad.addColorStop(0, '#263238');
  sharkBodyGrad.addColorStop(0.4, '#546e7a');
  sharkBodyGrad.addColorStop(1, '#37474f');

  ctx.fillStyle = sharkBodyGrad;
  ctx.beginPath();
  ctx.moveTo(-shark.width / 2, -2);
  ctx.quadraticCurveTo(0, -shark.height / 2 - 4, shark.width / 2 - 15, -5);
  ctx.lineTo(shark.width / 2, 0);
  ctx.quadraticCurveTo(0, shark.height / 2 + 4, -shark.width / 2, 5);
  ctx.closePath();
  ctx.fill();

  // White Belly
  ctx.fillStyle = '#eceff1';
  ctx.beginPath();
  ctx.moveTo(-shark.width / 2 + 10, 0);
  ctx.quadraticCurveTo(0, shark.height / 2 + 1, shark.width / 2 - 20, 0);
  ctx.closePath();
  ctx.fill();

  // Top Fin
  ctx.fillStyle = '#37474f';
  ctx.beginPath();
  ctx.moveTo(10, -shark.height / 2 + 3);
  ctx.quadraticCurveTo(5, -shark.height / 2 - 14, -8, -shark.height / 2 - 10);
  ctx.quadraticCurveTo(-2, -shark.height / 2 + 1, 5, -shark.height / 2 + 5);
  ctx.closePath();
  ctx.fill();

  // Lateral Fin
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(-2, 14);
  ctx.lineTo(6, 8);
  ctx.closePath();
  ctx.fill();

  // Tail fin moves independently to sell the swimming motion.
  ctx.save();
  ctx.translate(shark.width / 2, 0);
  ctx.rotate(tailSway);
  ctx.fillStyle = '#37474f';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -shark.height / 2 - 10, 20, -shark.height / 2 - 12);
  ctx.quadraticCurveTo(12, 0, 20, shark.height / 2 + 12);
  ctx.quadraticCurveTo(10, shark.height / 2 + 10, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(207, 238, 245, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(15, -shark.height / 2 + 1);
  ctx.moveTo(2, 0);
  ctx.lineTo(15, shark.height / 2 - 1);
  ctx.stroke();
  ctx.restore();

  // Cool-water side stripe separates the shark silhouette from dark reefs.
  ctx.strokeStyle = 'rgba(139, 232, 255, 0.30)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-shark.width * 0.16, -shark.height * 0.20);
  ctx.quadraticCurveTo(shark.width * 0.12, -shark.height * 0.32, shark.width * 0.32, -shark.height * 0.10);
  ctx.stroke();

  // Gills
  ctx.strokeStyle = '#212121';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-14 + i * 4, -4);
    ctx.lineTo(-12 + i * 4, 3);
    ctx.stroke();
  }

  // A compact warning eye reads clearly but remains decorative only.
  ctx.save();
  ctx.globalAlpha = 0.26 + pulse * 0.22;
  ctx.fillStyle = '#ff1744';
  ctx.beginPath();
  ctx.arc(-shark.width / 2 + 16, -5, 7 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff5252';
  ctx.beginPath();
  ctx.arc(-shark.width / 2 + 16, -5, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#32050b';
  ctx.beginPath();
  ctx.arc(-shark.width / 2 + 16.8, -5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-shark.width / 2 + 15.2, -6.25, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sharp Teeth
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-shark.width / 2 + 15, 3);
  ctx.lineTo(-shark.width / 2 + 18, 6);
  ctx.lineTo(-shark.width / 2 + 21, 3);
  ctx.lineTo(-shark.width / 2 + 24, 6);
  ctx.lineTo(-shark.width / 2 + 27, 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function bossWeaponPalette(type: BossWeapon) {
  switch (type) {
    case 'electric': return { warning: '#7df6ff', core: 'rgba(230, 255, 255, 0.98)', mid: 'rgba(52, 225, 255, 0.86)', outer: 'rgba(40, 122, 255, 0)', stroke: '#b4fbff' };
    case 'bubble': return { warning: '#bd86ff', core: 'rgba(239, 232, 255, 0.98)', mid: 'rgba(158, 95, 255, 0.76)', outer: 'rgba(104, 67, 255, 0)', stroke: '#e6ceff' };
    case 'surge': return { warning: '#78fff0', core: 'rgba(230, 255, 252, 0.98)', mid: 'rgba(58, 236, 208, 0.82)', outer: 'rgba(34, 122, 255, 0)', stroke: '#a6fff4' };
    case 'coral': return { warning: '#ffbc75', core: 'rgba(255, 245, 214, 0.98)', mid: 'rgba(255, 126, 80, 0.82)', outer: 'rgba(255, 77, 58, 0)', stroke: '#ffe0a1' };
    case 'plasma': return { warning: '#78f4ff', core: 'rgba(231, 255, 255, 0.98)', mid: 'rgba(73, 238, 255, 0.86)', outer: 'rgba(45, 135, 255, 0)', stroke: '#9ff7ff' };
    case 'trident': return { warning: '#ffe183', core: 'rgba(255, 250, 222, 0.98)', mid: 'rgba(255, 193, 67, 0.88)', outer: 'rgba(38, 224, 255, 0)', stroke: '#ffe89a' };
    default: return { warning: '#e7a8ff', core: 'rgba(244, 220, 255, 0.94)', mid: 'rgba(169, 83, 255, 0.76)', outer: 'rgba(49, 145, 255, 0)', stroke: '#e8b8ff' };
  }
}

function drawBossEncounter(ctx: CanvasRenderingContext2D, state: EngineState) {
  const boss = state.boss;
  if (!boss) return;

  const { config } = boss;
  const isWarning = boss.phase === 'warning';
  const remaining = Math.max(0, boss.battleStartedAt + config.battleDurationMs - state.timeMs);
  const pulse = 0.62 + (Math.sin(state.timeMs * 0.007) + 1) * 0.19;

  if (isWarning) {
    const remainingSeconds = Math.max(1, Math.ceil((boss.battleStartedAt - state.timeMs) / 1000));
    ctx.save();
    ctx.fillStyle = 'rgba(9, 15, 42, 0.68)';
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = config.accent;
    ctx.shadowBlur = 14;
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillStyle = '#fff2ff';
    ctx.fillText('⚠', state.width * 0.5, state.height * 0.39);
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.fillStyle = config.accent;
    ctx.fillText(translate(config.warningKey), state.width * 0.5, state.height * 0.47);
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = config.secondaryAccent;
    ctx.fillText(`${remainingSeconds}`, state.width * 0.5, state.height * 0.52);
    ctx.restore();
    return;
  }

  ctx.save();
  const halo = ctx.createRadialGradient(boss.x, boss.y, boss.width * 0.16, boss.x, boss.y, boss.width * 0.9);
  halo.addColorStop(0, `${config.accent}52`);
  halo.addColorStop(0.48, `${config.secondaryAccent}22`);
  halo.addColorStop(1, `${config.secondaryAccent}00`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.width * 0.9, 0, Math.PI * 2);
  ctx.fill();

  const attackKick = Math.max(0, 1 - (state.timeMs - boss.lastAttackAt) / 420);
  const motionRate = config.motion === 'fins' ? 0.006 : config.motion === 'serpent' ? 0.0048 : 0.004;
  const entryProgress = boss.phase === 'entering'
    ? Math.max(0, Math.min(1, (state.timeMs - boss.entryStartedAt) / BOSS_ENTRY_MS))
    : 1;
  const retreatProgress = boss.phase === 'retreating'
    ? Math.max(0, Math.min(1, (state.timeMs - boss.retreatStartedAt) / BOSS_RETREAT_MS))
    : 0;
  const travelTilt = boss.phase === 'entering'
    ? 0.12 * (1 - entryProgress)
    : boss.phase === 'retreating' ? -0.12 * retreatProgress : 0;
  const rotation = Math.sin(state.timeMs * motionRate) * (config.motion === 'fins' ? 0.05 : 0.028) - attackKick * 0.055 + travelTilt;
  const swell = 1 + Math.sin(state.timeMs * (motionRate * 2.1)) * 0.022 + attackKick * 0.045;
  const cinematicScale = bossEncounterScale(state);
  ctx.translate(boss.x + attackKick * boss.width * 0.075, boss.y);
  ctx.rotate(rotation);
  ctx.scale(swell * cinematicScale, swell * cinematicScale);
  ctx.imageSmoothingEnabled = true;
  const bossVideo = getBossVideo(config);
  // A looping video resets currentTime to zero for its first frame. Do not hide
  // that valid frame: the old timing gate made the boss vanish at every loop seam.
  const videoReady = Boolean(
    bossVideo
      && bossVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && bossVideo.videoWidth,
  );
  const spriteSheet = getBossSpriteSheet(config);
  const spriteReady = Boolean(spriteSheet?.complete && spriteSheet.naturalWidth && spriteSheet.naturalHeight);
  const travelAlpha = boss.phase === 'retreating' ? Math.max(0.34, 1 - retreatProgress * 0.58) : 1;
  ctx.globalAlpha = travelAlpha;
  ctx.shadowColor = config.secondaryAccent;
  ctx.shadowBlur = 16 * pulse;
  const videoFrame = videoReady && bossVideo ? getBossVideoFrame(config, bossVideo) : null;
  if (videoFrame) {
    const animationSize = boss.width * 1.36 * (config.artScale ?? 1);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(videoFrame.canvas, 0, 0, videoFrame.width, videoFrame.height, -animationSize / 2, -animationSize / 2, animationSize, animationSize);
  } else if (spriteReady && spriteSheet) {
    const columns = config.spriteColumns ?? 1;
    const rows = config.spriteRows ?? 1;
    const frameCount = columns * rows;
    const frame = Math.floor((state.timeMs / 1000) * (config.spriteFps ?? 12)) % frameCount;
    const frameWidth = spriteSheet.naturalWidth / columns;
    const frameHeight = spriteSheet.naturalHeight / rows;
    const sourceX = (frame % columns) * frameWidth;
    const sourceY = Math.floor(frame / columns) * frameHeight;
    const animationSize = boss.width * 1.38 * (config.artScale ?? 1);
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    if (config.spriteFlipX) ctx.scale(-1, 1);
    ctx.drawImage(spriteSheet, sourceX, sourceY, frameWidth, frameHeight, -animationSize / 2, -animationSize / 2, animationSize, animationSize);
    ctx.restore();
  }

  if (videoFrame || spriteReady) {
    // The animated footage carries organic motion; this overlay keeps all supplied artwork
    // visually tied to the same active energy language during attacks.
    const flow = (Math.sin(state.timeMs * motionRate * 1.7) + 1) * 0.5;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.10 + flow * 0.10;
    const livingGlow = ctx.createRadialGradient(0, -boss.height * 0.04, boss.width * 0.06, 0, -boss.height * 0.04, boss.width * 0.54);
    livingGlow.addColorStop(0, config.secondaryAccent);
    livingGlow.addColorStop(0.45, `${config.secondaryAccent}48`);
    livingGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = livingGlow;
    ctx.beginPath();
    ctx.arc(0, -boss.height * 0.04, boss.width * 0.54, 0, Math.PI * 2);
    ctx.fill();
    const eyePulse = 0.18 + (Math.sin(state.timeMs * 0.011) + 1) * 0.12;
    ctx.globalAlpha = eyePulse;
    ctx.fillStyle = config.secondaryAccent;
    ctx.beginPath();
    ctx.arc(-boss.width * 0.15, -boss.height * 0.12, boss.width * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.fillStyle = '#eaffff';
  ctx.shadowColor = '#21002e';
  ctx.shadowBlur = 5;
  ctx.fillText(translate(config.nameKey), boss.x, boss.y - boss.height * 0.64);
  if (boss.phase === 'battle') {
    const barWidth = Math.min(96, boss.width * 0.72);
    const progress = Math.max(0, Math.min(1, remaining / config.battleDurationMs));
    ctx.fillStyle = 'rgba(0, 18, 38, 0.72)';
    ctx.fillRect(boss.x - barWidth / 2, boss.y - boss.height * 0.54, barWidth, 4);
    ctx.fillStyle = config.accent;
    ctx.fillRect(boss.x - barWidth / 2, boss.y - boss.height * 0.54, barWidth * progress, 4);
  }
  if (boss.phase === 'entering' || boss.phase === 'retreating') {
    const status = boss.phase === 'entering' ? 'INCOMING' : 'RETREATING';
    ctx.font = '800 8px system-ui, sans-serif';
    ctx.fillStyle = config.secondaryAccent;
    ctx.fillText(status, boss.x, boss.y + boss.height * 0.62);
  }
  ctx.restore();

  for (const wave of boss.waves) {
    ctx.save();
    const palette = bossWeaponPalette(wave.type);
    const projectileSheet = getBossProjectileSheet(wave.projectileBossId, wave.type);
    const projectileReady = Boolean(projectileSheet?.complete && projectileSheet.naturalWidth && projectileSheet.naturalHeight);
    if (wave.phase === 'warning') {
      const warningPulse = 0.45 + (Math.sin(state.timeMs * 0.012) + 1) * 0.23;
      ctx.globalAlpha = warningPulse;
      ctx.strokeStyle = palette.warning;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(state.width * 0.08, wave.y);
      ctx.lineTo(boss.x - boss.width * 0.2, wave.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (projectileReady && projectileSheet) {
        const horizontalFrames = projectileSheet.naturalWidth > projectileSheet.naturalHeight;
        const sourceWidth = horizontalFrames ? projectileSheet.naturalWidth / 4 : projectileSheet.naturalWidth;
        const sourceHeight = horizontalFrames ? projectileSheet.naturalHeight : projectileSheet.naturalHeight / 4;
        const previewSize = wave.radius * 1.8;
        ctx.globalAlpha = warningPulse * 0.56;
        ctx.drawImage(projectileSheet, 0, 0, sourceWidth, sourceHeight, wave.x - previewSize / 2, wave.y - previewSize / 2, previewSize, previewSize);
      }
    } else if (projectileReady && projectileSheet) {
      const frameCount = 4;
      const frame = Math.floor((state.timeMs - wave.activateAt) / 78) % frameCount;
      const horizontalFrames = projectileSheet.naturalWidth > projectileSheet.naturalHeight;
      const sourceWidth = horizontalFrames ? projectileSheet.naturalWidth / frameCount : projectileSheet.naturalWidth;
      const sourceHeight = horizontalFrames ? projectileSheet.naturalHeight : projectileSheet.naturalHeight / frameCount;
      const sourceX = horizontalFrames ? frame * sourceWidth : 0;
      const sourceY = horizontalFrames ? 0 : frame * sourceHeight;
      const projectileSize = wave.radius * 3.15;
      ctx.globalAlpha = 0.96;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(projectileSheet, sourceX, sourceY, sourceWidth, sourceHeight, wave.x - projectileSize / 2, wave.y - projectileSize / 2, projectileSize, projectileSize);
    }
    ctx.restore();
  }
}

function drawSeaMine(ctx: CanvasRenderingContext2D, mine: SeaMine, timeMs: number) {
  if (mine.exploded) return;
  ctx.save();
  ctx.translate(mine.x, mine.y);

  const glowAmount = (Math.sin(mine.pulsePhase + timeMs * 0.01) + 1) / 2;
  ctx.rotate(Math.sin(timeMs * 0.0018 + mine.pulsePhase) * 0.08);
  if (mine.minionArt && drawMinionSprite(ctx, mine.minionArt, timeMs, mine.pulsePhase, mine.radius * 3.25)) {
    ctx.restore();
    return;
  }
  ctx.shadowColor = '#ff8f00';
  ctx.shadowBlur = 10 + glowAmount * 12;

  // Compact amber sonar ring communicates danger without expanding the hitbox.
  ctx.save();
  ctx.globalAlpha = 0.12 + glowAmount * 0.16;
  ctx.strokeStyle = '#ffb300';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, mine.radius + 8 + glowAmount * 4, -Math.PI * 0.22, Math.PI * 1.1);
  ctx.stroke();
  ctx.restore();

  // Draw core sphere of the naval mine
  const mineGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, mine.radius);
  mineGrad.addColorStop(0, '#78909c');
  mineGrad.addColorStop(0.5, '#37474f');
  mineGrad.addColorStop(1, '#212121');
  ctx.fillStyle = mineGrad;
  ctx.beginPath();
  ctx.arc(0, 0, mine.radius, 0, Math.PI * 2);
  ctx.fill();

  // Spikes protruding out of the sea mine
  ctx.strokeStyle = '#212121';
  ctx.lineWidth = 3;
  const spikeCount = 6;
  const spikeLen = 8;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i * Math.PI * 2) / spikeCount + timeMs * 0.0004;
    const sx = Math.cos(angle) * mine.radius;
    const sy = Math.sin(angle) * mine.radius;
    const ex = Math.cos(angle) * (mine.radius + spikeLen);
    const ey = Math.sin(angle) * (mine.radius + spikeLen);

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Spiky tips
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blinking amber indicator light and tiny rising bubbles give the mine a
  // mechanical but underwater feel.
  ctx.fillStyle = `rgba(255, 152, 0, ${0.45 + glowAmount * 0.55})`;
  ctx.beginPath();
  ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(215, 250, 255, 0.34)';
  for (let bubble = 0; bubble < 2; bubble++) {
    const phase = timeMs * 0.003 + bubble * 2.3;
    ctx.beginPath();
    ctx.arc(4 + bubble * 3 + Math.sin(phase) * 2, -mine.radius - 5 - (phase % 5), 1.2 + bubble * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawJellyfish(ctx: CanvasRenderingContext2D, jelly: Jellyfish, timeMs: number) {
  ctx.save();
  ctx.translate(jelly.x, jelly.y);

  const pulse = (Math.sin(timeMs * 0.004) + 1) / 2;
  const bellSquash = 0.92 + pulse * 0.11;
  ctx.rotate(Math.sin(timeMs * 0.0027 + jelly.bobPhase) * 0.055);
  if (jelly.minionArt && drawMinionSprite(ctx, jelly.minionArt, timeMs, jelly.bobPhase, jelly.radius * 4.35)) {
    ctx.restore();
    return;
  }
  ctx.shadowColor = '#e040fb';
  ctx.shadowBlur = 12 + pulse * 11;

  // Soft outer aura makes a jellyfish visible against dense water without
  // widening its collision area.
  ctx.save();
  ctx.globalAlpha = 0.13 + pulse * 0.12;
  ctx.fillStyle = '#c44dff';
  ctx.beginPath();
  ctx.ellipse(0, 0, jelly.radius * 1.45, jelly.radius * 1.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Jellyfish semi-translucent dome body (umbrella)
  ctx.save();
  ctx.scale(1, bellSquash);
  ctx.fillStyle = 'rgba(224, 64, 251, 0.76)';
  ctx.beginPath();
  ctx.arc(0, 0, jelly.radius, Math.PI, 0, false);
  ctx.quadraticCurveTo(jelly.radius * 0.5, 3, 0, 0);
  ctx.quadraticCurveTo(-jelly.radius * 0.5, 3, -jelly.radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Cyan core and rim add depth to the translucent bell.
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#64ffda';
  ctx.beginPath();
  ctx.arc(0, -jelly.radius * 0.18, jelly.radius * (0.18 + pulse * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = '#ea80fc';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, jelly.radius, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Highlight on the dome
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-jelly.radius * 0.3, -jelly.radius * 0.4, jelly.radius * 0.4, jelly.radius * 0.2, Math.PI / 6, 0, Math.PI * 2);
  ctx.fill();

  // Animated glowing trailing tentacles
  ctx.strokeStyle = 'rgba(109, 255, 233, 0.86)';
  ctx.lineWidth = 1.7;
  const tentacleCount = 5;
  for (let i = 0; i < tentacleCount; i++) {
    const tx = -jelly.radius * 0.6 + (i * jelly.radius * 1.2) / (tentacleCount - 1);
    const waveOffset = i * Math.PI * 0.5 + timeMs * 0.009;

    ctx.beginPath();
    ctx.moveTo(tx, 0);
    ctx.bezierCurveTo(
      tx + Math.sin(waveOffset) * 6, jelly.radius * 0.8,
      tx - Math.sin(waveOffset) * 6, jelly.radius * 1.6,
      tx + Math.sin(waveOffset * 1.2) * 4, jelly.radius * 2.2
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: Coin, timeMs: number) {
  if (coin.collected) return;
  // Restore the pleasing spinning-coin read, but keep the cycle smooth and
  // slow enough that it never resembles a dropped frame.
  const spin = Math.abs(Math.cos(timeMs * 0.0025 + coin.x * 0.01));
  const scaleX = 0.22 + spin * 0.78;

  ctx.save();
  ctx.translate(coin.x, coin.y + Math.sin(timeMs * 0.00115 + coin.x) * 0.85);
  ctx.scale(scaleX, 1);

  ctx.beginPath();
  ctx.arc(0, 0, coin.bonus ? 12 : 9, 0, Math.PI * 2);
  ctx.fillStyle = coin.bonus ? '#ff9500' : '#ffd60a';
  ctx.shadowColor = coin.bonus ? '#ffb347' : '#fff275';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#a97400';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff8e0';
  ctx.font = `bold ${coin.bonus ? 10 : 8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(coin.bonus ? '+5' : '+1', 0, 0);
  ctx.restore();
}

function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, timeMs: number) {
  if (gem.collected) return;

  // Slow buoyant motion keeps life drops readable and calm.
  const pulse = 1.0 + 0.045 * Math.sin(timeMs * 0.003 + gem.x * 0.05);
  const bobY = Math.sin(timeMs * 0.0012 + gem.x) * 0.9;

  ctx.save();
  ctx.translate(gem.x, gem.y + bobY);
  ctx.scale(pulse, pulse);

  const heartImage = getHeartDropImage();
  if (heartImage?.complete && heartImage.naturalWidth) {
    const size = 18;
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 10;
    ctx.drawImage(heartImage, -size, -size * 0.93, size * 2, size * 1.8);
    ctx.restore();
    return;
  }

  // Fallback while the vector asset is loading.
  ctx.shadowColor = '#ff1744';
  ctx.shadowBlur = 12;

  const size = 15; // Beautiful larger radius

  ctx.beginPath();
  // Standard high-quality heart path starting from the center cleft going down and back around
  ctx.moveTo(0, size * 0.35);
  ctx.bezierCurveTo(-size * 0.45, -size * 0.65, -size * 1.25, -size * 0.35, 0, size * 0.95);
  ctx.bezierCurveTo(size * 1.25, -size * 0.35, size * 0.45, -size * 0.65, 0, size * 0.35);
  ctx.closePath();

  // Solid glossy 3D-style radial gradient (matching HUD heart)
  const heartGrad = ctx.createRadialGradient(-size * 0.25, -size * 0.25, 1, 0, 0, size * 1.2);
  heartGrad.addColorStop(0, '#ffccd5'); // bright center highlight
  heartGrad.addColorStop(0.35, '#ff4d6d'); // rich red
  heartGrad.addColorStop(0.85, '#ff0033'); // base red
  heartGrad.addColorStop(1, '#800f2f'); // deep shaded shadow edge
  ctx.fillStyle = heartGrad;
  ctx.fill();

  // Fine white stroke for high visibility on dark water
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Shimmer / white reflection highlight on the left lobe
  ctx.beginPath();
  ctx.ellipse(-size * 0.35, -size * 0.25, size * 0.28, size * 0.14, -Math.PI / 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill();

  // Animate a subtle diagonal silver/white shimmer band across the heart periodically
  const shimmerPos = ((timeMs * 0.0015) % 3) - 1.5; // moves from -1.5 to 1.5
  if (shimmerPos > -1.0 && shimmerPos < 1.0) {
    ctx.save();
    // Clip to heart path so shimmer stays inside
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(-size * 0.45, -size * 0.65, -size * 1.25, -size * 0.35, 0, size * 0.95);
    ctx.bezierCurveTo(size * 1.25, -size * 0.35, size * 0.45, -size * 0.65, 0, size * 0.35);
    ctx.closePath();
    ctx.clip();

    ctx.rotate(Math.PI / 4);
    const shimmerX = shimmerPos * size * 1.5;
    const shimGrad = ctx.createLinearGradient(shimmerX - 3, -size * 2, shimmerX + 3, size * 2);
    shimGrad.addColorStop(0, 'rgba(255,255,255,0)');
    shimGrad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    shimGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shimGrad;
    ctx.fillRect(shimmerX - 5, -size * 2, 10, size * 4);
    ctx.restore();
  }

  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, timeMs: number) {
  if (pu.collected) return;
  const bob = Math.sin(timeMs * 0.0011 + pu.x) * 0.75;
  ctx.save();
  ctx.translate(pu.x, pu.y + bob);

  if (pu.type === 'shield') {
    // Soft outer blue/cyan halo glow
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 15;

    const r = 13; // shield base bounding radius

    // 1. Draw outer silver/white border of shield
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.8, -r, r, -r * 0.3);
    ctx.quadraticCurveTo(r * 0.9, r * 0.5, 0, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.9, r * 0.5, -r, -r * 0.3);
    ctx.quadraticCurveTo(-r * 0.8, -r, 0, -r);
    ctx.closePath();

    const silverGrad = ctx.createLinearGradient(-r, -r, r, r);
    silverGrad.addColorStop(0, '#ffffff');
    silverGrad.addColorStop(0.5, '#cfd8dc');
    silverGrad.addColorStop(1, '#78909c');
    ctx.fillStyle = silverGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Draw inner cyan/blue glowing core
    const ri = r * 0.75;
    ctx.beginPath();
    ctx.moveTo(0, -ri);
    ctx.quadraticCurveTo(ri * 0.8, -ri, ri, -ri * 0.3);
    ctx.quadraticCurveTo(ri * 0.9, ri * 0.5, 0, ri * 1.1);
    ctx.quadraticCurveTo(-ri * 0.9, ri * 0.5, -ri, -ri * 0.3);
    ctx.quadraticCurveTo(-ri * 0.8, -ri, 0, -ri);
    ctx.closePath();

    const shieldGrad = ctx.createRadialGradient(0, -ri * 0.3, 1, 0, 0, ri);
    shieldGrad.addColorStop(0, '#e0f7fa');
    shieldGrad.addColorStop(0.4, '#00e5ff');
    shieldGrad.addColorStop(1, '#006064');
    ctx.fillStyle = shieldGrad;
    ctx.fill();

    // 3. Glossy highlight at top-left
    ctx.beginPath();
    ctx.ellipse(-ri * 0.3, -ri * 0.3, ri * 0.3, ri * 0.15, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();

  } else if (pu.type === 'magnet') {
    // Red horseshoe magnet with silver tips and animated magnetic waves
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 15;

    ctx.save();
    ctx.rotate(Math.PI * 0.15); // slightly tilted for dynamic cartoon feel

    // Draw background pulsating magnetic waves
    const wavePulse = (Math.sin(timeMs * 0.006) + 1) / 2;
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.3 + wavePulse * 0.4})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 11, 14 + wavePulse * 6, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 11, 8 + wavePulse * 4, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();

    // Draw Horseshoe magnet shape
    const outR = 12;
    const inR = 6.5;
    const armH = 7;

    ctx.beginPath();
    // Outer top curve (semi circle from -outR to +outR)
    ctx.arc(0, -2, outR, Math.PI, 0, false);
    // Right arm outer side going down
    ctx.lineTo(outR, armH);
    // Right tip going inwards
    ctx.lineTo(inR, armH);
    // Right arm inner side going up to the inner top curve
    ctx.lineTo(inR, -2);
    // Inner top curve
    ctx.arc(0, -2, inR, 0, Math.PI, true);
    // Left arm inner side going down
    ctx.lineTo(-inR, armH);
    // Left tip going outwards
    ctx.lineTo(-outR, armH);
    // Left arm outer side going up
    ctx.closePath();

    // Fill with glossy red gradient
    const redGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, outR + 2);
    redGrad.addColorStop(0, '#ff8a80');
    redGrad.addColorStop(0.4, '#ff1744');
    redGrad.addColorStop(1, '#b71c1c');
    ctx.fillStyle = redGrad;
    ctx.fill();

    // Draw Silver tips for magnetic poles
    // Left pole
    ctx.beginPath();
    ctx.rect(-outR, armH - 4, outR - inR, 4);
    const tipGrad = ctx.createLinearGradient(-outR, 0, -inR, 0);
    tipGrad.addColorStop(0, '#ffffff');
    tipGrad.addColorStop(0.5, '#cfd8dc');
    tipGrad.addColorStop(1, '#78909c');
    ctx.fillStyle = tipGrad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Right pole
    ctx.beginPath();
    ctx.rect(inR, armH - 4, outR - inR, 4);
    const tipGradR = ctx.createLinearGradient(inR, 0, outR, 0);
    tipGradR.addColorStop(0, '#78909c');
    tipGradR.addColorStop(0.5, '#cfd8dc');
    tipGradR.addColorStop(1, '#ffffff');
    ctx.fillStyle = tipGradR;
    ctx.fill();
    ctx.stroke();

    // Draw gloss reflection highlight on the curve
    ctx.beginPath();
    ctx.ellipse(-outR * 0.6, -outR * 0.6, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();

    ctx.restore();

  } else if (pu.type === 'fever') {
    // 3D yellow/gold lightning bolt with sparkles
    ctx.save();
    const starPulse = (Math.sin(timeMs * 0.015) + 1) / 2;
    ctx.shadowColor = '#ffd600';
    ctx.shadowBlur = 15 + starPulse * 8;

    // sparkles
    const sparkleAngle = timeMs * 0.005;
    ctx.fillStyle = '#ffffff';
    const sparkles = [
      { x: -12, y: -10, r: 2.5 },
      { x: 12, y: 8, r: 2 },
      { x: -8, y: 12, r: 1.5 },
    ];
    for (const s of sparkles) {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = sparkleAngle + (i * Math.PI) / 2;
        ctx.lineTo(s.x + Math.cos(ang) * s.r, s.y + Math.sin(ang) * s.r);
        ctx.lineTo(s.x + Math.cos(ang + Math.PI / 4) * (s.r * 0.4), s.y + Math.sin(ang + Math.PI / 4) * (s.r * 0.4));
      }
      ctx.closePath();
      ctx.fill();
    }

    // Draw lightning bolt
    ctx.beginPath();
    ctx.moveTo(3, -14);   // Top right
    ctx.lineTo(-9, -1);   // To middle-left indent
    ctx.lineTo(-2, -1);   // Middle horizontal step right
    ctx.lineTo(-6, 14);   // Bottom point
    ctx.lineTo(7, 1);     // Up to middle-right indent
    ctx.lineTo(0, 1);     // Middle horizontal step left
    ctx.closePath();

    const boltGrad = ctx.createLinearGradient(-6, -14, 7, 14);
    boltGrad.addColorStop(0, '#fffde7');
    boltGrad.addColorStop(0.3, '#ffd600');
    boltGrad.addColorStop(0.8, '#ffab00');
    boltGrad.addColorStop(1, '#ff6d00');
    ctx.fillStyle = boltGrad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Gloss highlight down the front facet
    ctx.beginPath();
    ctx.moveTo(1.5, -12);
    ctx.lineTo(-7.5, -1);
    ctx.lineTo(-2.5, -1);
    ctx.lineTo(-4, 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

  } else if (pu.type === 'hourglass') {
    // Hourglass with golden frames and cyan sand
    ctx.save();
    const pulse = (Math.sin(timeMs * 0.008) + 1) / 2;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 15 + pulse * 6;

    const w = 11; // Plate width
    const h = 13; // Half-height

    // Draw the glass body (figure 8 curve)
    ctx.beginPath();
    ctx.moveTo(-w * 0.7, -h + 2);
    ctx.bezierCurveTo(-w * 0.7, -h * 0.4, -2, -2, -2, 0);
    ctx.bezierCurveTo(-2, 2, -w * 0.7, h * 0.4, -w * 0.7, h - 2);
    ctx.lineTo(w * 0.7, h - 2);
    ctx.bezierCurveTo(w * 0.7, h * 0.4, 2, 2, 2, 0);
    ctx.bezierCurveTo(2, -2, w * 0.7, -h * 0.4, w * 0.7, -h + 2);
    ctx.closePath();

    const glassGrad = ctx.createLinearGradient(-w, 0, w, 0);
    glassGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
    glassGrad.addColorStop(0.5, 'rgba(0,229,255,0.15)');
    glassGrad.addColorStop(1, 'rgba(255,255,255,0.15)');
    ctx.fillStyle = glassGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw the glowing cyan sand inside (top)
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, -h + 3);
    ctx.lineTo(w * 0.55, -h + 3);
    ctx.bezierCurveTo(w * 0.3, -h * 0.3, 1, -1, 0, 0);
    ctx.bezierCurveTo(-1, -1, -w * 0.3, -h * 0.3, -w * 0.55, -h + 3);
    ctx.closePath();
    const sandGradTop = ctx.createLinearGradient(0, -h, 0, 0);
    sandGradTop.addColorStop(0, '#e0f7fa');
    sandGradTop.addColorStop(1, '#00e5ff');
    ctx.fillStyle = sandGradTop;
    ctx.fill();

    // Dripping sand line in center
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, h - 4);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Bottom sand (pile accumulating)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-1, 2, -w * 0.5, h * 0.5, -w * 0.6, h - 2.5);
    ctx.lineTo(w * 0.6, h - 2.5);
    ctx.bezierCurveTo(w * 0.5, h * 0.5, 1, 2, 0, 0);
    ctx.closePath();
    ctx.fillStyle = '#00e5ff';
    ctx.fill();

    // Draw top and bottom golden frames/plates
    ctx.fillStyle = '#ffd600';
    ctx.strokeStyle = '#ffab00';
    ctx.lineWidth = 1;

    // Top plate
    ctx.beginPath();
    ctx.roundRect(-w, -h, w * 2, 3, 1.5);
    ctx.fill();
    ctx.stroke();

    // Bottom plate
    ctx.beginPath();
    ctx.roundRect(-w, h - 3, w * 2, 3, 1.5);
    ctx.fill();
    ctx.stroke();

    // Golden frame side pillars
    ctx.strokeStyle = '#ffab00';
    ctx.lineWidth = 1.2;
    // Left pillar
    ctx.beginPath();
    ctx.moveTo(-w * 0.8, -h + 2);
    ctx.lineTo(-w * 0.8, h - 2);
    ctx.stroke();
    // Right pillar
    ctx.beginPath();
    ctx.moveTo(w * 0.8, -h + 2);
    ctx.lineTo(w * 0.8, h - 2);
    ctx.stroke();

    // Highlights on pillars
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.8 + 0.5, -h + 3);
    ctx.lineTo(-w * 0.8 + 0.5, h - 3);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();
}

function drawBubbleBoostRing(ctx: CanvasRenderingContext2D, ring: BubbleBoostRing, timeMs: number) {
  if (ring.collected) return;
  const bob = Math.sin(timeMs * 0.001 + ring.x) * 0.65;
  const pulse = (Math.sin(timeMs * 0.0042) + 1) / 2;
  const orbit = timeMs * 0.003;
  ctx.save();
  ctx.translate(ring.x, ring.y + bob);

  // A gold and aqua reward portal makes its purpose distinct from hazards.
  const halo = ctx.createRadialGradient(0, 0, ring.radius * 0.22, 0, 0, ring.radius * 1.32);
  halo.addColorStop(0, 'rgba(255, 213, 79, 0.26)');
  halo.addColorStop(0.58, 'rgba(0, 229, 255, 0.12)');
  halo.addColorStop(1, 'rgba(0, 229, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius * 1.34, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 18 + pulse * 12;
  ctx.strokeStyle = '#7df9ff';
  ctx.lineWidth = 4 + pulse * 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowColor = '#ffd54f';
  ctx.shadowBlur = 11 + pulse * 7;
  ctx.strokeStyle = '#fff3a6';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = -orbit * 12;
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius - 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Three orbiting reward sparks make the drop-focused effect legible at a glance.
  for (let index = 0; index < 3; index += 1) {
    const angle = orbit + (Math.PI * 2 * index) / 3;
    const sparkX = Math.cos(angle) * (ring.radius + 4);
    const sparkY = Math.sin(angle) * (ring.radius + 4);
    ctx.fillStyle = index === 1 ? '#ff6b8b' : '#ffd54f';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 2.6 + pulse * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(2, 27, 51, 0.86)';
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff7c2';
  ctx.font = '700 7px sans-serif';
  ctx.fillText('DROP', 0, -4);
  ctx.fillStyle = '#7df9ff';
  ctx.font = '700 6px sans-serif';
  ctx.fillText('RUSH', 0, 5);
  ctx.restore();
}

function drawTreasureChest(ctx: CanvasRenderingContext2D, chest: TreasureChest, timeMs: number) {
  if (chest.collected) return;
  const wobble = Math.sin(timeMs * 0.0009 + chest.x) * 0.5;
  ctx.save();
  ctx.translate(chest.x + chest.width / 2, chest.y + chest.height / 2 + wobble);

  const pulse = (Math.sin(timeMs * 0.0028) + 1) / 2;
  ctx.shadowColor = '#ffb300';
  ctx.shadowBlur = 12 + pulse * 6;

  ctx.fillStyle = '#5d4037';
  ctx.fillRect(-chest.width / 2, -chest.height / 2 + 8, chest.width, chest.height - 8);

  ctx.fillStyle = '#8d6e63';
  ctx.beginPath();
  ctx.moveTo(-chest.width / 2, -chest.height / 2 + 8);
  ctx.quadraticCurveTo(0, -chest.height / 2 - 6, chest.width / 2, -chest.height / 2 + 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(-chest.width / 2 + 4, -chest.height / 2 + 6, 4, chest.height - 6);
  ctx.fillRect(chest.width / 2 - 8, -chest.height / 2 + 6, 4, chest.height - 6);

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-1.2, 2, 2.4, 5);

  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  const alpha = 1 - particle.life / particle.maxLife;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fillStyle = particle.color;
  ctx.fill();
  ctx.restore();
}

function drawFloatingText(ctx: CanvasRenderingContext2D, text: FloatingText, timeMs: number) {
  const elapsed = timeMs - text.createdAt;
  const progress = elapsed / text.durationMs;

  const alpha = 1 - progress;
  const currentY = text.y - progress * 40;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = text.color;
  ctx.font = `bold ${text.size}px sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.text, text.x, currentY);
  ctx.restore();
}

export function renderEngine(ctx: CanvasRenderingContext2D, state: EngineState) {
  const { width, height } = state;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (state.shakeIntensity > 0.2) {
    // A deterministic, easing sway avoids the harsh frame-to-frame jitter of
    // random camera offsets while preserving clear hit feedback.
    const dx = Math.sin(state.timeMs * 0.045) * state.shakeIntensity * 0.28;
    const dy = Math.cos(state.timeMs * 0.052) * state.shakeIntensity * 0.20;
    ctx.translate(dx, dy);
  }
  drawBackground(ctx, state);
  for (const obs of state.obstacles) drawObstacle(ctx, obs, height);
  for (const shark of state.sharks) drawShark(ctx, shark, state.timeMs);
  for (const mine of state.seaMines) drawSeaMine(ctx, mine, state.timeMs);
  for (const jelly of state.jellyfish) drawJellyfish(ctx, jelly, state.timeMs);
  drawBossEncounter(ctx, state);
  for (const coin of state.coins) drawCoin(ctx, coin, state.timeMs);
  for (const gem of state.gems) drawGem(ctx, gem, state.timeMs);
  for (const pu of state.powerUps) drawPowerUp(ctx, pu, state.timeMs);
  for (const ring of state.boostRings) drawBubbleBoostRing(ctx, ring, state.timeMs);
  for (const chest of state.chests) drawTreasureChest(ctx, chest, state.timeMs);

  const fishX = width * FISH_X_RATIO;
  const invincible = Boolean(state.previewMode) || state.timeMs < state.invincibleUntil;
  drawFish(ctx, state, fishX, invincible);
  for (const particle of state.particles) drawParticle(ctx, particle);

  for (const text of state.floatingTexts) {
    drawFloatingText(ctx, text, state.timeMs);
  }

  ctx.restore();

  if (state.isRedFlashing) {
    ctx.save();
    ctx.fillStyle = 'rgba(211, 47, 47, 0.22)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (state.hourglassUntil > state.timeMs) {
    ctx.save();
    // Beautiful cyan vignette gradient
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.4, width / 2, height / 2, Math.max(width, height) * 0.7);
    vignette.addColorStop(0, 'rgba(0, 229, 255, 0)');
    vignette.addColorStop(1, 'rgba(0, 229, 255, 0.18)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export { FISH_X_RATIO };
