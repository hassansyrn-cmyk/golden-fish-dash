// -----------------------------------------------------------------------
// Core canvas game engine for Golden Fish Rush: Ocean Legends.
// Power-ups: Shield, Magnet, Fever, Hourglass. Shop boosts supported.
// Ocean Legends adds: authored chapter/pattern system, combo chains,
// Golden Surge, rescue school, collect-and-grow, current zones, coral
// barriers, lore drops, set-piece boss encounters, seeded runs, and an
// accessibility layer (reduced motion / high contrast / steer mode).
// -----------------------------------------------------------------------

import { BASE } from './constants';
import type { SkinId, FloatingText } from './types';
import { translate } from './i18n';
import { ENVIRONMENTS, environmentById, type EnvironmentId, type EnvironmentTheme } from './ocean/environmentTheme';
import { chapterForScore, chapterDifficulty, type ChapterDef } from './ocean/chapters';
import { getCharacter, getCharacterAbility } from './ocean/characters';
import { pickPattern, type PatternSpawnApi, type PowerUpKind, type HazardKind } from './ocean/patterns';
import { VFXPool, VFX_COLORS } from './ocean/vfx';
import {
  createCombo, comboEvent, comboTick, comboTier,
  createSurge, surgeAddCharge, surgeActivate, surgeIsActive,
  createGrowth, growthEat, growthScale,
  MAX_COMPANIONS, type CompanionFish,
  type ComboState, type SurgeState, type GrowthState,
} from './ocean/systems';
import { createBossState, updateBoss, bossReward, type BossState, type BossKind } from './ocean/bosses';
import { createRunRandom, type RunRandom } from './ocean/rng';
import type { RunModifiers, AccessibilityOptions } from './ocean/runConfig';
import { DEFAULT_ACCESSIBILITY } from './ocean/runConfig';

export interface Plankton {
  x: number;
  y: number;
  collected: boolean;
  drift: number;
}

export interface SunPearl {
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
}

export interface CoralBarrier {
  x: number;
  y: number;
  width: number;
  height: number;
  broken: boolean;
  breakProgress: number;
}

export interface CurrentZone {
  x: number;
  y: number;
  halfHeight: number;
  direction: 'up' | 'down';
  strength: number;
  /** Set by the Mirror Current modifier. */
  mirrored: boolean;
}

export interface LoreDrop {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  pulse: number;
}

export interface RunStats {
  surges: number;
  rescues: number;
  companionsLost: number;
  barriersBroken: number;
  planktonEaten: number;
  pearlsCollected: number;
  loreFound: string[];
  bestCombo: number;
  chaptersVisited: number[];
  setPiecesCleared: number;
}

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
  gravity?: number;
}

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
  passed: boolean;
  /** 'eel' renders as an electric eel (Kelp Labyrinth ambush predator). */
  variant?: 'shark' | 'eel';
}

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
  onCombo?: (count: number, tier: number) => void;
  onComboBreak?: (best: number) => void;
  onSurgeStart?: () => void;
  onSurgeEnd?: () => void;
  onCompanionRescued?: (schoolSize: number) => void;
  onCompanionLost?: (schoolSize: number) => void;
  onGrowthUp?: (stage: number) => void;
  onChapterTransition?: (chapterIndex: number, chapterId: string) => void;
  onSetPieceStart?: (kind: BossKind, nameKey: string) => void;
  onSetPieceEnd?: (kind: BossKind, succeeded: boolean, score: number, coins: number) => void;
  onLoreFound?: (loreId: string) => void;
  onCurrentPush?: (direction: 'up' | 'down') => void;
  onBarrierBreak?: () => void;
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

  // === Ocean Legends ===
  seed: string;
  rng: RunRandom;
  modifiers: RunModifiers;
  accessibility: AccessibilityOptions;
  chapter: ChapterDef;
  lastChapterIndex: number;
  /** Fractional score accumulator from companion bonuses. */
  scoreCarry: number;
  combo: ComboState;
  surge: SurgeState;
  growth: GrowthState;
  companions: CompanionFish[];
  plankton: Plankton[];
  sunPearls: SunPearl[];
  barriers: CoralBarrier[];
  currents: CurrentZone[];
  loreDrops: LoreDrop[];
  boss: BossState | null;
  runStats: RunStats;
  emberWardUsed: boolean;
  hitStopUntil: number;
  steerTargetY: number | null;
  /** Set-piece chapters already triggered this run. */
  setPiecesTriggered: number[];
  currentPatternId: string;
  recentPatterns: string[];
  demo: boolean;
  demoJumpCooldown: number;
  elapsedSincePattern: number;
  patternDelayMs: number;
  vfx: VFXPool;
  nextAmbientVfxAt: number;
}

const FISH_X_RATIO = 0.28;
const MAX_EXTRA_LIVES = 2;
const DROP_RUSH_DURATION_MS = 20_000;
const MAGNET_DURATION_MS = 12_000;
const HIT_INVINCIBILITY_MS = 1700;
const SAFE_REVIVE_DELAY_MS = 900;
// The artwork intentionally extends beyond the gameplay body. A smaller,
// circular contact zone makes collisions match what players can see.
const FAIR_FISH_HITBOX_RADIUS = BASE.fishRadius * 0.82;

const ENVIRONMENT_CHANGE_SPAN = 18;

/**
 * Chapter-aware environment selection: the active chapter defines its
 * sub-themes, and the world alternates between them as the run deepens.
 */
function environmentForScore(score: number): EnvironmentTheme {
  const chapter = chapterForScore(score);
  const themes = chapter.themeIds;
  const step = Math.floor((score - chapter.minScore) / ENVIRONMENT_CHANGE_SPAN);
  return environmentById(themes[step % themes.length]);
}

let waterTexture: HTMLImageElement | null = null;
let heartDropImage: HTMLImageElement | null = null;

function getHeartDropImage() {
  if (typeof Image === 'undefined') return null;
  if (!heartDropImage) {
    heartDropImage = new Image();
    heartDropImage.src = '/assets/heart-drop.svg';
  }
  return heartDropImage;
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

const getInvincibilityDuration = (state: EngineState) => {
  const base = HIT_INVINCIBILITY_MS;
  if (state.skin === 'ruby') {
    return Math.round(base * 1.30); // Betta skin: +30% duration
  }
  return base;
};

export interface CreateEngineOptions {
  seed?: string;
  modifiers?: RunModifiers;
  accessibility?: Partial<AccessibilityOptions>;
  demo?: boolean;
}

export function createEngine(width: number, height: number, skin: SkinId, options: CreateEngineOptions = {}): EngineState {
  const rng = options.seed ? createRunRandom(options.seed) : createRunRandom(Math.floor(Math.random() * 2 ** 31));
  const bubbles: Bubble[] = Array.from({ length: 30 }, () => ({
    x: rng.next() * width,
    y: rng.next() * height,
    r: 2 + rng.next() * 8,
    speed: 0.25 + rng.next() * 0.95,
    drift: (rng.next() - 0.5) * 0.45,
  }));
  const accessibility: AccessibilityOptions = { ...DEFAULT_ACCESSIBILITY, ...options.accessibility };
  if (options.demo) {
    // Deterministic QA passes always render the calmest experience.
    accessibility.reducedMotion = true;
    accessibility.reducedFlashes = true;
  }
  return {
    width, height, fishY: height / 2, fishVY: 0, fishRotation: 0, score: 0, running: true,
    invincibleUntil: 0, obstacles: [], coins: [], gems: [], powerUps: [], bubbles, particles: [],
    elapsedSinceSpawn: 999999, skin, shakeIntensity: 0, timeMs: 0, legendaryPulse: 0,
    lives: 0, maxLives: MAX_EXTRA_LIVES, shieldCharges: 0, magnetUntil: 0, gemBoostActive: false,

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

    // Ocean Legends
    seed: options.seed ?? '',
    rng,
    modifiers: options.modifiers ?? [],
    accessibility,
    chapter: chapterForScore(0),
    lastChapterIndex: 0,
    scoreCarry: 0,
    combo: createCombo(),
    surge: createSurge(),
    growth: createGrowth(),
    companions: [],
    plankton: [],
    sunPearls: [],
    barriers: [],
    currents: [],
    loreDrops: [],
    boss: null,
    runStats: {
      surges: 0, rescues: 0, companionsLost: 0, barriersBroken: 0, planktonEaten: 0,
      pearlsCollected: 0, loreFound: [], bestCombo: 0, chaptersVisited: [0], setPiecesCleared: 0,
    },
    emberWardUsed: false,
    hitStopUntil: 0,
    steerTargetY: null,
    setPiecesTriggered: [],
    currentPatternId: 'none',
    recentPatterns: [],
    demo: options.demo ?? false,
    demoJumpCooldown: 0,
    elapsedSincePattern: 999999,
    patternDelayMs: BASE.spawnInterval,
    vfx: new VFXPool(),
    nextAmbientVfxAt: 0,
  };
}

export function difficultyForScore(score: number, timeMs: number = 0) {
  // Constant speed of 3.0 as requested to prevent the game from becoming too fast / impossible.
  const speed = 3.0;

  const speedSteps = Math.floor(score / 12);

  // The minimum opening remains deliberately generous even in late runs.
  // Difficulty comes from visual variety and route choice, not tiny corridors.
  const baseGapVal = BASE.baseGap + 30 - speedSteps * 2 - Math.floor(timeMs / 45000) * 3;
  const gap = Math.max(146, baseGapVal);

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

let companionCounter = 0;

function nextLoreId(state: EngineState): string | null {
  const chapterLore = state.chapter.lore;
  const remaining = chapterLore.filter((l) => !state.runStats.loreFound.includes(l.id));
  if (remaining.length === 0) return null;
  return state.rng.pick(remaining).id;
}

/**
 * Pattern-driven spawner. Replaces the old single-gate spawn with authored
 * pattern templates chosen by seeded RNG, chapter and difficulty.
 */
function spawnPattern(state: EngineState) {
  const chapter = chapterForScore(state.score);
  const difficulty = chapterDifficulty(chapter, state.score);
  const { gap, speed } = difficultyForScore(state.score, state.timeMs);
  const margin = Math.max(95, gap * 0.48);
  const anchorY = margin + state.rng.next() * Math.max(1, state.height - margin * 2);
  const theme = environmentForScore(state.score);
  const score = state.score;
  const legendaryMode = score >= 120;

  const api: PatternSpawnApi = {
    width: state.width,
    height: state.height,
    anchorY,
    gapSize: gap,
    difficulty,
    score,
    rng: state.rng,
    themeId: theme.id,
    pushObstacle: ({ x, gapY, gapSize }) => {
      state.obstacles.push({
        x, gapY, gapSize, passed: false,
        bobbing: false, bobPhase: state.rng.next() * Math.PI * 2,
        bobAmount: 0, glowing: legendaryMode, isDouble: false, environment: theme.id,
      });
    },
    pushCoin: (x, y, bonus) => {
      state.coins.push({ x, y, collected: false, bonus: bonus ?? (score >= 60 && state.rng.chance(0.2)) });
    },
    pushGem: (x, y) => {
      state.gems.push({ x, y, collected: false, pulse: state.rng.next() * Math.PI * 2 });
    },
    pushPowerUp: (x, y, type: PowerUpKind) => {
      state.powerUps.push({ x, y, type, collected: false, pulse: state.rng.next() * Math.PI * 2 });
    },
    pushHazard: (kind: HazardKind, x, y) => {
      if (kind === 'shark') {
        state.sharks.push({
          id: 'shark_' + state.rng.next(), x, y, baseY: y,
          width: 85, height: 38,
          bobPhase: state.rng.next() * Math.PI * 2,
          bobSpeed: 0.003 + state.rng.next() * 0.002,
          bobAmount: 8 + state.rng.next() * 5, passed: false,
        });
      } else if (kind === 'eel') {
        state.sharks.push({
          id: 'eel_' + state.rng.next(), x, y, baseY: y,
          width: 95, height: 24, variant: 'eel',
          bobPhase: state.rng.next() * Math.PI * 2,
          bobSpeed: 0.004 + state.rng.next() * 0.003,
          bobAmount: 14 + state.rng.next() * 8, passed: false,
        });
      } else if (kind === 'mine') {
        state.seaMines.push({
          id: 'mine_' + state.rng.next(), x, y, radius: 14,
          pulsePhase: state.rng.next() * Math.PI * 2, exploded: false,
        });
      } else {
        state.jellyfish.push({
          id: 'jelly_' + state.rng.next(), x, y, baseY: y, radius: 12,
          bobPhase: state.rng.next() * Math.PI * 2,
          bobSpeed: 0.002 + state.rng.next() * 0.0015,
          bobAmount: 8 + state.rng.next() * 5,
        });
      }
    },
    pushPlankton: (x, y) => {
      state.plankton.push({ x, y, collected: false, drift: state.rng.next() * Math.PI * 2 });
    },
    pushSunPearl: (x, y) => {
      state.sunPearls.push({ x, y, collected: false, pulse: state.rng.next() * Math.PI * 2 });
    },
    pushBarrier: (x, y, gapSize) => {
      state.barriers.push({
        x, y, width: 24, height: Math.max(90, gapSize * 0.42),
        broken: false, breakProgress: 0,
      });
    },
    pushCompanion: (x, y) => {
      if (state.companions.length >= MAX_COMPANIONS + 3) return;
      state.companions.push({
        id: 'comp_' + (companionCounter++),
        phase: state.rng.next() * Math.PI * 2,
        x, y, rescued: false, spawnAt: state.timeMs,
      });
    },
    pushCurrent: (x, y, direction, strength) => {
      state.currents.push({
        x, y, halfHeight: 74, direction, strength,
        mirrored: state.modifiers.includes('mirrorCurrent'),
      });
    },
    pushChest: (x, y) => {
      state.chests.push({ x, y, width: 36, height: 30, collected: false });
    },
    pushLore: (x, y) => {
      const loreId = nextLoreId(state);
      if (!loreId) {
        // All chapter lore found — a magenta treasure spark appears instead.
        state.sunPearls.push({ x, y, collected: false, pulse: state.rng.next() * Math.PI * 2 });
        return;
      }
      state.loreDrops.push({ id: loreId, x, y, collected: false, pulse: state.rng.next() * Math.PI * 2 });
    },
  };

  const pattern = pickPattern(state.rng, chapter.index, difficulty, {
    modifiers: state.modifiers,
    recentIds: state.recentPatterns,
  });
  const span = pattern.build(api);

  // Rare bubble boost ring, unchanged from the classic spawn behavior.
  if (state.rng.chance(0.05)) {
    state.boostRings.push({
      x: state.width + BASE.obstacleWidth + 180,
      y: 100 + state.rng.next() * (state.height - 200),
      radius: 25, collected: false,
    });
  }

  state.currentPatternId = pattern.id;
  state.recentPatterns = [...state.recentPatterns.slice(-3), pattern.id];
  // Wait until the whole pattern (plus a breather) has scrolled past.
  const spanMs = span / Math.max(0.5, speed * 0.06);
  state.patternDelayMs = Math.max(700, spanMs + 260);
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
  state.plankton = state.plankton.filter((p) => p.x < fishX - 60 || p.x > state.width + 60);
  state.sunPearls = state.sunPearls.filter((p) => p.x < fishX - 60 || p.x > state.width + 60);
  state.barriers = state.barriers.filter((b) => b.broken || b.x < fishX - 80 || b.x > state.width + 80);
  state.currents = state.currents.filter((c) => c.x < fishX - 60 || c.x > state.width + 60);
  state.loreDrops = state.loreDrops.filter((l) => l.x < fishX - 60 || l.x > state.width + 60);
  state.elapsedSinceSpawn = -SAFE_REVIVE_DELAY_MS;
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
  callbacks.onShake(state.accessibility.reducedMotion ? 0 : 4); // Shaking is light & non-distracting
  if (!state.accessibility.reducedFlashes) callbacks.onRedFlash?.();
  state.hitStopUntil = state.timeMs + 45;
  addBurst(state, state.width * FISH_X_RATIO, state.fishY, 'rgba(80, 220, 255, 0.95)', 22, 3);
  return true;
}

/**
 * Hazard damage resolution order (fairness ladder):
 * 1. Ember's one-time heat ward (character ability).
 * 2. A rescued companion absorbs the hit and swims away.
 * 3. An extra life is spent.
 * 4. Death.
 */
function killOrUseLife(state: EngineState, callbacks: EngineCallbacks) {
  const fishX = state.width * FISH_X_RATIO;
  const ability = getCharacterAbility(state.skin);

  if (ability.firstHazardWard && !state.emberWardUsed) {
    state.emberWardUsed = true;
    state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
    callbacks.onShake(3);
    triggerFloatingText(state, translate('engine.emberWard'), fishX, state.fishY - 34, '#ffba08', true);
    state.vfx.emit('heatAsh', state.particles, fishX, state.fishY, { scale: 1.4 });
    return;
  }

  if (state.companions.some((c) => c.rescued)) {
    // The last rescued companion sacrifices itself and darts away.
    const index = state.companions.map((c) => c.rescued).lastIndexOf(true);
    const lost = state.companions[index];
    state.companions.splice(index, 1);
    state.runStats.companionsLost += 1;
    state.invincibleUntil = state.timeMs + Math.round(getInvincibilityDuration(state) * 0.6);
    callbacks.onShake(2);
    callbacks.onCompanionLost?.(state.companions.filter((c) => c.rescued).length);
    triggerFloatingText(state, translate('engine.companionLost'), fishX, state.fishY - 34, VFX_COLORS.cyan, true);
    state.vfx.emit('rescueSpark', state.particles, lost.x, lost.y, { scale: 1.2 });
    return;
  }

  if (spendExtraLife(state, callbacks)) return;
  callbacks.onShake(state.accessibility.reducedMotion ? 0 : 8);
  if (!state.accessibility.reducedFlashes) callbacks.onRedFlash?.();
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

/** Chapter intro card + set-piece (boss/finale) triggering on score bands. */
function maybeTransitionChapter(state: EngineState, callbacks: EngineCallbacks) {
  const chapter = chapterForScore(state.score);
  if (chapter.index !== state.lastChapterIndex) {
    state.chapter = chapter;
    state.lastChapterIndex = chapter.index;
    if (!state.runStats.chaptersVisited.includes(chapter.index)) {
      state.runStats.chaptersVisited.push(chapter.index);
    }
    const cx = state.width * 0.5;
    triggerFloatingText(state, `✦ ${translate(chapter.nameKey)}`, cx, state.height * 0.28, chapter.lighting.accent, true);
    triggerFloatingText(state, translate(chapter.introKey), cx, state.height * 0.36, chapter.lighting.accent, false);
    state.vfx.emit('biolumMotes', state.particles, cx, state.height * 0.4, { scale: 1.6 });
    callbacks.onChapterTransition?.(chapter.index, chapter.id);
  }

  const sp = chapter.setPiece;
  if (!state.boss && !state.setPiecesTriggered.includes(chapter.index) && state.score >= sp.atScore) {
    state.setPiecesTriggered.push(chapter.index);
    // Clear incoming gates so the set piece opens on a clean stage.
    clearDangerousReviveArea(state);
    state.elapsedSinceSpawn = -1200;
    state.boss = createBossState(sp.kind, state.timeMs);
    callbacks.onSetPieceStart?.(state.boss.kind, sp.nameKey);
  }
}

export function stepEngine(state: EngineState, dtMs: number, callbacks: EngineCallbacks, settings: { vibration: boolean }) {
  if (!state.running) return;
  let dt = Math.min(2.2, dtMs / 16.67);
  state.timeMs += dtMs;
  state.legendaryPulse = (state.legendaryPulse + dtMs * 0.002) % (Math.PI * 2);

  // Hit-stop: briefly freeze most world motion on major impacts so the hit
  // reads clearly. Input responsiveness is unaffected (jump is applied below).
  const wasSurgeActive = surgeIsActive(state.surge, state.timeMs);
  if (state.hitStopUntil > state.timeMs && !state.accessibility.reducedMotion) {
    dt *= 0.08;
  }

  // Combo decay + break feedback.
  if (comboTick(state.combo, state.timeMs)) {
    callbacks.onComboBreak?.(state.combo.best);
  }

  // Steering mode (optional): the fish glides gently toward the held pointer
  // instead of free-falling. Tap-to-flap stays available in both modes.
  if (state.accessibility.steerMode && state.steerTargetY !== null) {
    const targetVY = Math.max(-4.6, Math.min(4.6, (state.steerTargetY - state.fishY) * 0.11));
    state.fishVY += (targetVY - state.fishVY) * Math.min(1, 0.2 * dt);
  } else {
    state.fishVY = Math.min(BASE.maxFallSpeed, state.fishVY + BASE.gravity * dt);
  }
  state.fishY += state.fishVY * dt;
  state.fishRotation = Math.max(-0.5, Math.min(0.9, state.fishVY * 0.06));

  // Collect-and-grow visual scale eases toward the growth stage size.
  const targetScale = growthScale(state.growth.stage);
  if (Math.abs(state.growth.displayScale - targetScale) > 0.001) {
    state.growth.displayScale += (targetScale - state.growth.displayScale) * Math.min(1, 0.1 * dt);
  }

  if (state.demo) updateDemoPilot(state, dtMs);
  const groundY = state.height - 8;
  const ceilingY = 8;
  const invincible = state.timeMs < state.invincibleUntil;
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

  const { speed: baseSpeed } = difficultyForScore(state.score, state.timeMs);
  const isHourglassActive = state.hourglassUntil > state.timeMs;
  const speed = isHourglassActive ? baseSpeed * 0.6 : baseSpeed;
  const fishX = state.width * FISH_X_RATIO;

  state.elapsedSinceSpawn += dtMs;
  // Keep enough horizontal breathing room between pattern groups. The timer
  // stays armed until the previous pattern has scrolled through.
  const gateSpacingClear = state.obstacles.every((obstacle) => obstacle.x < state.width * 0.52);
  if (!state.boss && state.elapsedSinceSpawn >= state.patternDelayMs && gateSpacingClear) {
    spawnPattern(state);
    state.elapsedSinceSpawn = 0;
  }

  // Chapter boundaries can also be crossed by score jumps (chests, lore) so
  // the check runs per frame; it acts only on actual band changes.
  maybeTransitionChapter(state, callbacks);

  // === FEVER MODE STREAM SPANNING ===
  const isFeverActive = state.feverUntil > state.timeMs;
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
        bonus: state.rng.chance(0.15),
      });
      // Spawn extra air bubbles for a festive environment
      state.bubbles.push({
        x: state.width + 20,
        y: state.rng.next() * state.height,
        r: 3 + state.rng.next() * 5,
        speed: 1.5 + state.rng.next() * 2.0,
        drift: state.rng.spread(0.3),
      });
    }
  }

  // The magnet attracts every reward object, never enemies or obstacles.
  // Fever retains its stronger vacuum behavior while the normal magnet is more generous.
  const hasMagnet = state.magnetUntil > state.timeMs || isFeverActive;
  const magnetRange = isFeverActive ? 220 : hasMagnet ? 175 : 0;
  const magnetPull = isFeverActive ? 0.35 : 0.28;
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
      obs.bobPhase += dtMs * 0.002;
      obs.gapY += Math.sin(obs.bobPhase) * 1.18 * dt;
      obs.gapY = clampGapY(state, obs.gapY, obs.gapSize);
    }
    if (!obs.passed && obs.x + BASE.obstacleWidth / 2 < fishX) {
      obs.passed = true;
      // Companion school multiplies gate score through a fractional carry so
      // gains stay whole numbers.
      const rescued = state.companions.filter((c) => c.rescued).length;
      state.score += 1;
      if (rescued > 0) {
        state.scoreCarry += rescued * 0.08;
        if (state.scoreCarry >= 1) {
          const whole = Math.floor(state.scoreCarry);
          state.score += whole;
          state.scoreCarry -= whole;
        }
      }
      if (surgeIsActive(state.surge, state.timeMs)) state.score += 1;
      callbacks.onScore(state.score);
      maybeTransitionChapter(state, callbacks);
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
        const ability = getCharacterAbility(state.skin);
        comboEvent('nearMiss', state.combo, state.timeMs, surgeIsActive(state.surge, state.timeMs));
        state.runStats.bestCombo = Math.max(state.runStats.bestCombo, state.combo.count);
        const bonus = Math.round(2 * (ability.nearMissMultiplier ?? 1));
        state.score += bonus;
        callbacks.onScore(state.score);
        callbacks.onNearMiss?.();
        triggerFloatingText(state, `+${bonus} ${translate('engine.nearMiss')}`, fishX, state.fishY - 28, VFX_COLORS.cyan, true);
        // Spray a beautiful trail of teal particles
        state.vfx.emit('currentStreak', state.particles, fishX, state.fishY, { scale: 1.4 });
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
    const sharkSpeed = (speed + 0.8) * dt;
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
    mine.x -= speed * dt;
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
    jelly.x -= (speed - 0.5) * dt;
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

  // Coin collection — feeds the shared combo chain (coins, plankton, pearls,
  // near misses all build one meter with big break feedback).
  for (const coin of state.coins) {
    coin.x -= speed * dt;
    pullCollectable(coin);
    if (!coin.collected) {
      const dx = coin.x - fishX;
      const dy = coin.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 13) {
        coin.collected = true;
        const surgeActive = surgeIsActive(state.surge, state.timeMs);
        const multiplier = comboEvent('coin', state.combo, state.timeMs, surgeActive);
        state.runStats.bestCombo = Math.max(state.runStats.bestCombo, state.combo.count);
        const baseAmount = coin.bonus ? 5 : 1;
        const finalAmount = Math.round(baseAmount * multiplier * (surgeActive ? 2 : 1));
        state.score += finalAmount;
        callbacks.onScore(state.score);
        callbacks.onCoinCollect(finalAmount);

        const txtColor = coin.bonus ? '#ffd54f' : '#fff59d';
        triggerFloatingText(state, `+${finalAmount}`, coin.x, coin.y - 12, txtColor, false);
        if (multiplier >= 2) {
          callbacks.onCombo?.(state.combo.count, comboTier(state.combo.count));
          state.vfx.emit('pearlGlitter', state.particles, coin.x, coin.y, { scale: 1.1 });
        } else {
          state.vfx.emit('planktonDust', state.particles, coin.x, coin.y, { scale: 0.8 });
        }
      }
    }
  }

  state.coins = state.coins.filter((c) => c.x > -40 && !c.collected);

  // Plankton — harmless prey driving collect-and-grow.
  for (const p of state.plankton) {
    p.x -= speed * dt;
    p.y += Math.sin(state.timeMs * 0.002 + p.drift) * 0.3 * dt;
    pullCollectable(p);
    if (!p.collected) {
      const dx = p.x - fishX;
      const dy = p.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 11) {
        p.collected = true;
        state.runStats.planktonEaten += 1;
        const stageUp = growthEat(state.growth);
        comboEvent('plankton', state.combo, state.timeMs, surgeIsActive(state.surge, state.timeMs));
        state.runStats.bestCombo = Math.max(state.runStats.bestCombo, state.combo.count);
        if (stageUp !== null) {
          callbacks.onGrowthUp?.(stageUp);
          triggerFloatingText(state, translate('engine.growthUp', undefined, { stage: stageUp + 1 }), fishX, state.fishY - 34, VFX_COLORS.gold, true);
          state.vfx.emit('bubbleBurst', state.particles, fishX, state.fishY, { scale: 1.6 });
        } else {
          state.vfx.emit('planktonDust', state.particles, p.x, p.y, { scale: 0.7 });
        }
      }
    }
  }
  state.plankton = state.plankton.filter((p) => p.x > -30 && !p.collected);

  // Sun Pearls — Golden Surge fuel; double as boss objective drops.
  let bossPearlDelta = 0;
  for (const pearl of state.sunPearls) {
    pearl.x -= speed * dt;
    pearl.pulse += dtMs * 0.004;
    pullCollectable(pearl);
    if (!pearl.collected) {
      const dx = pearl.x - fishX;
      const dy = pearl.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 15) {
        pearl.collected = true;
        state.runStats.pearlsCollected += 1;
        if (state.boss && !state.boss.ended) bossPearlDelta += 1;
        const ability = getCharacterAbility(state.skin);
        const charge = 12 * (ability.surgeChargeMultiplier ?? 1);
        comboEvent('pearl', state.combo, state.timeMs, surgeIsActive(state.surge, state.timeMs));
        state.vfx.emit('pearlGlitter', state.particles, pearl.x, pearl.y, { scale: 1.2 });
        if (surgeAddCharge(state.surge, charge, state.timeMs)) {
          surgeActivate(state.surge, state.timeMs);
          state.runStats.surges += 1;
          state.hitStopUntil = state.timeMs + 55;
          callbacks.onSurgeStart?.();
          triggerFloatingText(state, translate('engine.surge'), fishX, state.fishY - 40, VFX_COLORS.gold, true);
          state.vfx.emit('treasureBeam', state.particles, fishX, state.fishY, { scale: 2 });
        }
      }
    }
  }
  state.sunPearls = state.sunPearls.filter((p) => p.x > -30 && !p.collected);

  // Lore fragments — magenta archive drops for the collection book.
  for (const lore of state.loreDrops) {
    lore.x -= speed * dt;
    lore.pulse += dtMs * 0.0035;
    if (!lore.collected) {
      const dx = lore.x - fishX;
      const dy = lore.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 16) {
        lore.collected = true;
        state.runStats.loreFound.push(lore.id);
        callbacks.onLoreFound?.(lore.id);
        triggerFloatingText(state, translate('engine.loreFound'), lore.x, lore.y - 16, VFX_COLORS.magenta, true);
        state.vfx.emit('treasureBeam', state.particles, lore.x, lore.y, { scale: 1.4 });
        state.score += 3;
        callbacks.onScore(state.score);
      }
    }
  }
  state.loreDrops = state.loreDrops.filter((l) => l.x > -30 && !l.collected);

  // Current zones — telegraphed up/down push bands. The Mirror Current run
  // modifier inverts the push while the arrows stay authored-honest because
  // the zone renders with an inverted-color marker when `mirrored` is set.
  for (const zone of state.currents) {
    zone.x -= speed * dt;
    const withinX = Math.abs(zone.x - fishX) < 58;
    const withinY = Math.abs(state.fishY - zone.y) < zone.halfHeight;
    if (withinX && withinY) {
      const dir = zone.direction;
      const push = zone.strength * 0.16 * dt;
      state.fishVY += dir === 'up' ? -push : push;
      if (state.rng.chance(0.05)) {
        state.vfx.emit('currentStreak', state.particles, fishX, state.fishY, { scale: 0.6 });
      }
      callbacks.onCurrentPush?.(dir);
    }
  }
  state.currents = state.currents.filter((c) => c.x > -80);

  // Fragile coral barriers — breakable during Golden Surge or when grown.
  for (const barrier of state.barriers) {
    barrier.x -= speed * dt;
    if (barrier.broken) continue;
    const canBreak = surgeIsActive(state.surge, state.timeMs) || state.growth.stage >= 2;
    const withinX = Math.abs(barrier.x - fishX) < 18 + BASE.fishRadius * 0.6;
    const withinY = Math.abs(barrier.y - state.fishY) < barrier.height / 2 + BASE.fishRadius * 0.6;
    if (withinX && withinY) {
      if (canBreak) {
        barrier.broken = true;
        state.runStats.barriersBroken += 1;
        state.vfx.emit('coralShards', state.particles, barrier.x, barrier.y, { scale: 1.5 });
        triggerFloatingText(state, translate('engine.barrierBreak'), barrier.x, barrier.y - 20, VFX_COLORS.amber, true);
        callbacks.onBarrierBreak?.();
        state.score += 2;
        callbacks.onScore(state.score);
      } else if (!invincible) {
        // Solid coral acts like any other obstacle for an un-supercharged fish.
        if (state.shieldCharges > 0) {
          state.shieldCharges = Math.max(0, state.shieldCharges - 1);
          barrier.broken = true;
          state.invincibleUntil = state.timeMs + getInvincibilityDuration(state);
          callbacks.onShake(3);
          state.vfx.emit('shieldShatter', state.particles, barrier.x, state.fishY, { scale: 1.3 });
          triggerFloatingText(state, translate('engine.shieldBlock'), fishX, state.fishY - 30, '#80d8ff', true);
        } else {
          killOrUseLife(state, callbacks);
          return;
        }
      }
    }
  }
  state.barriers = state.barriers.filter((b) => b.x > -60 && !b.broken);

  // Companion school — unrescued fish wait ahead; rescued fish orbit behind.
  for (const companion of state.companions) {
    companion.x -= (companion.rescued ? 0 : speed) * dt;
    if (companion.rescued) {
      const orbitR = 46 + (companion.phase % Math.PI) * 6;
      const targetX = fishX - 34 - Math.cos(companion.phase) * orbitR * 0.5;
      const targetY = state.fishY + Math.sin(companion.phase) * 26;
      companion.x += (targetX - companion.x) * Math.min(1, 0.14 * dt);
      companion.y += (targetY - companion.y) * Math.min(1, 0.14 * dt);
      companion.phase += 0.05 * dt;
    } else {
      const dx = companion.x - fishX;
      const dy = companion.y - state.fishY;
      if (Math.sqrt(dx * dx + dy * dy) < BASE.fishRadius + 16) {
        companion.rescued = true;
        companion.y = companion.y ?? state.fishY;
        state.runStats.rescues += 1;
        if (state.boss && !state.boss.ended) state.boss.companionsRescued += 1;
        comboEvent('rescue', state.combo, state.timeMs, surgeIsActive(state.surge, state.timeMs));
        callbacks.onCompanionRescued?.(state.companions.filter((c) => c.rescued).length);
        triggerFloatingText(state, translate('engine.rescued'), companion.x, companion.y - 18, VFX_COLORS.cyan, true);
        state.vfx.emit('rescueSpark', state.particles, companion.x, companion.y, { scale: 1.3 });
        state.score += 2;
        callbacks.onScore(state.score);
      }
    }
  }
  state.companions = state.companions.filter((c) => c.rescued || c.x > -40);

  // Boss / set-piece encounter stepping.
  if (state.boss) {
    const boss = state.boss;
    const bossApi = {
      width: state.width,
      height: state.height,
      timeMs: state.timeMs,
      rng: state.rng,
      pushSunPearl: (x: number, y: number) => state.sunPearls.push({ x, y, collected: false, pulse: 0 }),
      pushCoin: (x: number, y: number, bonus?: boolean) => state.coins.push({ x, y, collected: false, bonus: bonus ?? false }),
      pushCurrent: (x: number, y: number, direction: 'up' | 'down', strength: number) =>
        state.currents.push({ x, y, halfHeight: 74, direction, strength, mirrored: false }),
      pushCompanion: (x: number, y: number) => {
        if (state.companions.filter((c) => !c.rescued).length < 3) {
          state.companions.push({ id: 'comp_b_' + (companionCounter++), phase: state.rng.next() * Math.PI * 2, x, y, rescued: false, spawnAt: state.timeMs });
        }
      },
      pushPlankton: (x: number, y: number) => state.plankton.push({ x, y, collected: false, drift: state.rng.next() * Math.PI * 2 }),
    };
    const pearlTarget = boss.pearlTarget;
    const before = boss.pearlsCollected;
    updateBoss(boss, bossApi, dtMs, bossPearlDelta);
    void pearlTarget; void before;
    if (boss.ended) {
      const reward = bossReward(boss);
      state.score += reward.score;
      callbacks.onCoinCollect(reward.coins);
      callbacks.onScore(state.score);
      state.runStats.setPiecesCleared += 1;
      callbacks.onSetPieceEnd?.(boss.kind, boss.succeeded, reward.score, reward.coins);
      triggerFloatingText(state, boss.succeeded ? translate('engine.setPieceCleared') : translate('engine.setPieceSurvived'), state.width * 0.5, state.height * 0.3, VFX_COLORS.gold, true);
      state.vfx.emit('treasureBeam', state.particles, state.width * 0.5, state.height * 0.4, { scale: 2.2 });
      state.boss = null;
      state.elapsedSinceSpawn = -600;
    }
  }

  // Golden Surge end feedback.
  if (wasSurgeActive && !surgeIsActive(state.surge, state.timeMs)) {
    callbacks.onSurgeEnd?.();
  }
  // Golden Surge trail.
  if (surgeIsActive(state.surge, state.timeMs) && state.rng.chance(0.4)) {
    state.vfx.emit('surgeTrail', state.particles, fishX - BASE.fishRadius, state.fishY, { scale: 1 });
  }

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
          state.shieldCharges = Math.min(2, state.shieldCharges + 1);
          callbacks.onShake?.(1); // Light non-distracting shake
          triggerFloatingText(state, translate('engine.shield'), pu.x, pu.y - 15, '#29b6f6', true);
          addBurst(state, pu.x, pu.y, 'rgba(70, 180, 255, 0.9)', 20, 3);
        } else if (pu.type === 'magnet') {
          const duration = state.skin === 'emerald' ? MAGNET_DURATION_MS * 1.25 : MAGNET_DURATION_MS;
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
        state.boostUntil = state.timeMs + DROP_RUSH_DURATION_MS;
        triggerFloatingText(state, translate('engine.dropRush', undefined, { seconds: 20 }), ring.x, ring.y - 15, '#ffd54f', true);
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

  // Particle updates (pooled VFX + legacy burst particles share one array).
  VFXPool.update(state.particles, dt);
  state.vfx.tick(state.timeMs);
  // Ambient biome motes keep dark chapters alive without gameplay clutter.
  if (state.timeMs > state.nextAmbientVfxAt) {
    state.nextAmbientVfxAt = state.timeMs + 900 + state.rng.next() * 1400;
    state.vfx.emit(
      state.chapter.lighting.dark ? 'biolumMotes' : 'planktonDust',
      state.particles,
      state.rng.next() * state.width,
      state.rng.next() * state.height,
      { scale: 0.6 },
    );
  }
  state.shakeIntensity = Math.max(0, state.shakeIntensity - dtMs * 0.05);
  void settings;
}

/**
 * Deterministic demo pilot for QA/screenshot mode: a lookahead controller
 * that steers toward the nearest gap center. Uses only the seeded RNG so
 * identical seeds produce identical runs. Canvas y grows downward, so a
 * negative dy means the target is ABOVE the fish and a jump is needed.
 */
function updateDemoPilot(state: EngineState, dtMs: number) {
  state.demoJumpCooldown -= dtMs;
  if (state.demoJumpCooldown > 0) return;

  const fishX = state.width * FISH_X_RATIO;
  // Nearest upcoming gate center (falls back to pearls, then mid-screen).
  let targetY: number | null = null;
  let bestX = Infinity;
  for (const obs of state.obstacles) {
    if (obs.x > fishX - 10 && obs.x < bestX) {
      bestX = obs.x;
      // For stacked gates pick the opening closest to the current altitude.
      const candidates = state.obstacles.filter((o) => Math.abs(o.x - obs.x) < 30);
      targetY = candidates.reduce(
        (best, o) => (Math.abs(o.gapY - state.fishY) < Math.abs(best - state.fishY) ? o.gapY : best),
        candidates[0].gapY,
      );
    }
  }
  if (targetY === null) {
    for (const pearl of state.sunPearls) {
      if (!pearl.collected && pearl.x > fishX) {
        targetY = pearl.y;
        break;
      }
    }
  }
  if (targetY === null) targetY = state.height / 2;

  const dy = targetY - state.fishY;
  const nearCeiling = state.fishY < 140;
  const falling = state.fishVY > 0.4;
  if (!nearCeiling && falling && dy < -18) {
    state.fishVY = BASE.jumpVelocity;
    state.demoJumpCooldown = 150 + state.rng.next() * 70;
  }
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

function drawFish(ctx: CanvasRenderingContext2D, state: EngineState, fishX: number, invincible: boolean) {
  const character = getCharacter(state.skin);
  const isFever = state.feverUntil > state.timeMs;
  const isSurge = surgeIsActive(state.surge, state.timeMs);
  const blink = (invincible || isFever) && Math.floor(state.timeMs / 100) % 2 === 0;
  if (blink) return;
  const r = BASE.fishRadius * state.growth.displayScale;
  const id = character.id;
  const profile = character.profile;
  const pulse = (Math.sin(state.legendaryPulse) + 1) / 2;
  const { body, belly, fin, glow } = character.colors;
  const swimBob = Math.sin(state.timeMs * 0.007) * 0.75;
  const accent = profile.accent;

  // Squash-and-stretch: stretch along velocity, squash on flap impulses.
  const stretch = Math.min(0.14, Math.abs(state.fishVY) * 0.016);
  const scaleY = 1 - stretch * 0.6;
  const scaleX = 1 + stretch * 0.5;

  // A stronger tail wave, small body bob, and independent front-fin flap make
  // the player read as a living fish even at high game speed.
  const wag = Math.sin(state.timeMs * (isFever || isSurge ? 0.027 : 0.014)) * 0.16;

  ctx.save();
  ctx.translate(fishX, state.fishY + swimBob);
  ctx.rotate(state.fishRotation);
  ctx.scale(scaleX * profile.bodyLength, scaleY * profile.bodyHeight);

  {
    // The hero keeps its clean silhouette; circular auras are reserved for
    // temporary states (Fever, Golden Surge) so they always communicate power.
    if (isFever || isSurge) {
      ctx.save();
      ctx.globalAlpha = 0.28 + pulse * 0.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.9, r * 1.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = isSurge ? VFX_COLORS.gold : `hsl(${(state.timeMs / 4) % 360}, 100%, 75%)`;
      ctx.fill();
      ctx.globalAlpha = 0.5 + pulse * 0.25;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.6, r * 1.12, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isSurge ? VFX_COLORS.goldSoft : `hsl(${(state.timeMs / 4) % 360}, 100%, 75%)`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = isFever ? '#e040fb' : isSurge ? VFX_COLORS.gold : glow;
    ctx.shadowBlur = isFever || isSurge ? 32 : id === 'legendary' ? 30 : id === 'diamond' ? 24 : 16;

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

    // Dynamic Tail with Wag — silhouette varies by character fin style.
    ctx.save();
    ctx.translate(-r * 0.8, 0);
    ctx.rotate(wag);
    if (profile.finStyle === 'veil') {
      // Long ribbon fins (Coral the betta, Pearl the discus).
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.8, -r * 1.3, -r * 1.5, -r * 0.6);
      ctx.quadraticCurveTo(-r * 1.1, 0, -r * 1.5, r * 0.6);
      ctx.quadraticCurveTo(-r * 0.8, r * 1.3, 0, 0);
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    } else if (profile.finStyle === 'crescent') {
      // Sickle tail for the sprinters (Mako, Reef Regent).
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.9, -r * 1.25, -r * 1.6, -r * 0.45);
      ctx.lineTo(-r * 1.0, 0);
      ctx.quadraticCurveTo(-r * 1.6, r * 0.45, -r * 0.9, r * 1.25);
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    } else if (profile.finStyle === 'spiked') {
      // Spiky lionfish fan (Ember).
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let ray = 0; ray <= 5; ray++) {
        const spread = (ray / 5 - 0.5) * 2;
        ctx.lineTo(-r * (1.15 + (ray % 2) * 0.25), spread * r * 0.85);
      }
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    } else if (profile.finStyle === 'lure') {
      // Nyx's tattered deep-sea tail.
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.7, -r * 0.9, -r * 1.3, -r * 0.7);
      ctx.lineTo(-r * 0.95, -r * 0.2);
      ctx.lineTo(-r * 1.4, r * 0.2);
      ctx.lineTo(-r * 0.95, r * 0.55);
      ctx.quadraticCurveTo(-r * 0.7, r * 0.9, 0, 0);
      ctx.closePath();
      ctx.fillStyle = fin;
      ctx.fill();
    } else {
      // Elegant streamlined tail (Aurum and friends).
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
    } else if (isSurge) {
      // Golden Surge: radiant gold body with white-hot core.
      bodyGrad.addColorStop(0, '#fff8e1');
      bodyGrad.addColorStop(0.45, VFX_COLORS.gold);
      bodyGrad.addColorStop(1, '#ff8f00');
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

    // Dorsal Fin — Aurum's crown-like three-point crest marks the guardian.
    ctx.beginPath();
    if (id === 'golden') {
      ctx.moveTo(-r * 0.15, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.02, -r * 1.35, r * 0.18, -r * 0.85);
      ctx.quadraticCurveTo(r * 0.32, -r * 1.45, r * 0.48, -r * 0.8);
      ctx.quadraticCurveTo(r * 0.62, -r * 1.3, r * 0.7, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.3, -r * 0.8, 0, -r * 0.7);
    } else if (profile.finStyle === 'spiked') {
      ctx.moveTo(-r * 0.2, -r * 0.7);
      for (let spike = 0; spike <= 4; spike++) {
        ctx.lineTo(-r * 0.2 + spike * r * 0.24, -r * (0.7 + 0.55 + (spike % 2) * 0.15));
      }
      ctx.lineTo(r * 0.7, -r * 0.55);
    } else {
      ctx.moveTo(-r * 0.15, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.25, -r * 1.25, r * 0.7, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.3, -r * 0.8, 0, -r * 0.7);
    }
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

    // Expressive glossy eye (scaled per character), cheek and gill line give
    // the fish a characterful face without visual noise at mobile scale.
    const eyeR = 5.3 * profile.eyeSize;
    ctx.beginPath();
    ctx.arc(r * 0.56, -r * 0.16, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#fffdf3';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.72, -r * 0.14, eyeR * 0.63, 0, Math.PI * 2);
    ctx.fillStyle = isFever ? '#7c4dff' : id === 'nyx' ? '#b388ff' : '#125d82';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.86, -r * 0.12, eyeR * 0.33, 0, Math.PI * 2);
    ctx.fillStyle = '#081923';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.11 + r * 0.60, -r * 0.16 - 2.0, 1.35 * profile.eyeSize, 0, Math.PI * 2);
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

    // Nyx's bioluminescent lure: a glowing bulb on a stalk above the head.
    if (profile.finStyle === 'lure') {
      const lurePhase = state.timeMs * 0.004;
      ctx.save();
      ctx.strokeStyle = '#4a2f7a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.75);
      ctx.quadraticCurveTo(r * 0.55, -r * 1.5, r * 0.95, -r * 1.35 + Math.sin(lurePhase) * 2);
      ctx.stroke();
      ctx.shadowColor = VFX_COLORS.violet;
      ctx.shadowBlur = 14 + pulse * 8;
      ctx.fillStyle = VFX_COLORS.violet;
      ctx.beginPath();
      ctx.arc(r * 0.95, -r * 1.35 + Math.sin(lurePhase) * 2, 3.4 + pulse * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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

function drawSeaMine(ctx: CanvasRenderingContext2D, mine: SeaMine, timeMs: number) {
  if (mine.exploded) return;
  ctx.save();
  ctx.translate(mine.x, mine.y);

  const glowAmount = (Math.sin(mine.pulsePhase + timeMs * 0.01) + 1) / 2;
  ctx.rotate(Math.sin(timeMs * 0.0018 + mine.pulsePhase) * 0.08);
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

function drawPlankton(ctx: CanvasRenderingContext2D, p: Plankton, timeMs: number) {
  if (p.collected) return;
  const bob = Math.sin(timeMs * 0.002 + p.drift) * 2;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.shadowColor = VFX_COLORS.goldSoft;
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#f6ff9c';
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.4, 2.2, p.drift, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-0.8, -0.6, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSunPearl(ctx: CanvasRenderingContext2D, pearl: SunPearl, timeMs: number) {
  if (pearl.collected) return;
  const pulse = (Math.sin(timeMs * 0.004 + pearl.pulse) + 1) / 2;
  const bob = Math.sin(timeMs * 0.0013 + pearl.pulse) * 1.2;
  ctx.save();
  ctx.translate(pearl.x, pearl.y + bob);

  // Halo rays mark the pearl as surge fuel (gold, not pink treasure-magenta).
  ctx.globalAlpha = 0.2 + pulse * 0.18;
  ctx.strokeStyle = VFX_COLORS.gold;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + timeMs * 0.0008;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 9, Math.sin(angle) * 9);
    ctx.lineTo(Math.cos(angle) * (12 + pulse * 3), Math.sin(angle) * (12 + pulse * 3));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.shadowColor = VFX_COLORS.gold;
  ctx.shadowBlur = 12 + pulse * 6;
  const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7.5);
  grad.addColorStop(0, '#fffde7');
  grad.addColorStop(0.5, '#ffd60a');
  grad.addColorStop(1, '#ff8f00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-2.2, -2.4, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoralBarrier(ctx: CanvasRenderingContext2D, barrier: CoralBarrier, timeMs: number) {
  if (barrier.broken) return;
  const pulse = (Math.sin(timeMs * 0.003) + 1) / 2;
  ctx.save();
  ctx.translate(barrier.x, barrier.y);

  // Fragile coral lattice: visibly breakable, warm amber tones (danger kin).
  ctx.shadowColor = VFX_COLORS.amber;
  ctx.shadowBlur = 8 + pulse * 5;
  ctx.strokeStyle = '#ff8a65';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  const h = barrier.height / 2;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(0, h);
  ctx.moveTo(-7, -h * 0.55);
  ctx.quadraticCurveTo(7, -h * 0.3, 0, -h * 0.12);
  ctx.moveTo(7, h * 0.4);
  ctx.quadraticCurveTo(-7, h * 0.62, 0, h * 0.85);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,224,178,0.8)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const y = -h + (i / 3) * barrier.height;
    ctx.beginPath();
    ctx.arc(0, y, 4.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCurrentZone(ctx: CanvasRenderingContext2D, zone: CurrentZone, timeMs: number) {
  ctx.save();
  ctx.translate(zone.x, zone.y);
  const h = zone.halfHeight;
  const flow = (timeMs * 0.06 * zone.strength) % 26;
  const dirSign = zone.direction === 'up' ? -1 : 1;

  // Faint band + animated arrow chevrons clearly telegraph direction.
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = zone.mirrored ? VFX_COLORS.magenta : VFX_COLORS.cyanSoft;
  ctx.fillRect(-34, -h, 68, h * 2);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = zone.mirrored ? VFX_COLORS.magenta : VFX_COLORS.cyan;
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = ((i * 26 + flow * dirSign) % (h * 2) + h * 2) % (h * 2) - h;
    ctx.beginPath();
    ctx.moveTo(-10, y - 5 * dirSign);
    ctx.lineTo(0, y + 5 * dirSign);
    ctx.lineTo(10, y - 5 * dirSign);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLoreDrop(ctx: CanvasRenderingContext2D, lore: LoreDrop, timeMs: number) {
  if (lore.collected) return;
  const pulse = (Math.sin(timeMs * 0.0035 + lore.pulse) + 1) / 2;
  ctx.save();
  ctx.translate(lore.x, lore.y + Math.sin(timeMs * 0.0012 + lore.pulse) * 1.4);
  ctx.rotate(Math.sin(timeMs * 0.001 + lore.pulse) * 0.12);

  // Magenta shell tablet = legendary lore (VFX color language).
  ctx.shadowColor = VFX_COLORS.magenta;
  ctx.shadowBlur = 14 + pulse * 8;
  ctx.fillStyle = '#6a1b5c';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.quadraticCurveTo(10, -8, 9, 2);
  ctx.quadraticCurveTo(8, 10, 0, 12);
  ctx.quadraticCurveTo(-8, 10, -9, 2);
  ctx.quadraticCurveTo(-10, -8, 0, -11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = VFX_COLORS.magenta;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,190,240,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -4); ctx.lineTo(4, -4);
  ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
  ctx.moveTo(-4, 4); ctx.lineTo(1, 4);
  ctx.stroke();
  ctx.restore();
}

function drawCompanion(ctx: CanvasRenderingContext2D, companion: CompanionFish, timeMs: number) {
  const rescued = companion.rescued;
  ctx.save();
  ctx.translate(companion.x, companion.y);
  const wag = Math.sin(timeMs * 0.016 + companion.phase) * 0.3;
  if (!rescued) {
    // Waiting fish blink a soft help glow.
    const pulse = (Math.sin(timeMs * 0.005 + companion.phase) + 1) / 2;
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = VFX_COLORS.cyanSoft;
    ctx.beginPath();
    ctx.arc(0, 0, 16 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.rotate(Math.sin(timeMs * 0.003 + companion.phase) * 0.1);
  ctx.shadowColor = VFX_COLORS.cyan;
  ctx.shadowBlur = 8;

  // Tiny companion fish: simple readable silhouette with a wagging tail.
  ctx.save();
  ctx.rotate(wag);
  ctx.fillStyle = rescued ? '#7df9ff' : '#9adbe8';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-12, -5);
  ctx.lineTo(-12, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = rescued ? '#4dd0e1' : '#8fd3e8';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b2a30';
  ctx.beginPath();
  ctx.arc(4, -1, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoss(ctx: CanvasRenderingContext2D, state: EngineState) {
  const boss = state.boss;
  if (!boss || boss.ended) return;
  if (boss.kind === 'spectacle') return; // no silhouette; pearls carry the show
  const timeMs = state.timeMs;
  const pulse = (Math.sin(timeMs * 0.003) + 1) / 2;

  ctx.save();
  ctx.translate(boss.bodyX, boss.bodyY);
  const swim = Math.sin(timeMs * 0.002) * 0.06;
  ctx.rotate(swim);

  if (boss.kind === 'guardian') {
    // Benevolent manta guardian: wide wings, calm glow, crown pattern.
    const wing = Math.sin(timeMs * 0.0035) * 0.25;
    ctx.shadowColor = VFX_COLORS.cyan;
    ctx.shadowBlur = 26 + pulse * 14;
    ctx.fillStyle = 'rgba(58,123,168,0.88)';
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.quadraticCurveTo(-10, -95 * (1 + wing), -80, -40 * (1 + wing));
    ctx.quadraticCurveTo(-40, -6, -80, 0);
    ctx.quadraticCurveTo(-40, 6, -80, 40 * (1 + wing));
    ctx.quadraticCurveTo(-10, 95 * (1 + wing), 30, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,244,255,0.75)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // Crown marking.
    ctx.strokeStyle = VFX_COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -14); ctx.lineTo(-2, -26); ctx.lineTo(4, -16); ctx.lineTo(9, -28); ctx.lineTo(13, -14);
    ctx.stroke();
    // Gentle eyes.
    ctx.fillStyle = '#e0fbff';
    ctx.beginPath();
    ctx.arc(16, -8, 3.4, 0, Math.PI * 2);
    ctx.arc(16, 8, 3.4, 0, Math.PI * 2);
    ctx.fill();
    // Tail streamers.
    ctx.strokeStyle = 'rgba(125,249,255,0.6)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-70, (i - 1) * 10);
      ctx.quadraticCurveTo(-100, (i - 1) * 16 + Math.sin(timeMs * 0.004 + i) * 8, -130, (i - 1) * 22);
      ctx.stroke();
    }
  } else if (boss.kind === 'leviathan') {
    // Trench Leviathan: long dark serpentine body with sonar spots.
    ctx.shadowColor = VFX_COLORS.violet;
    ctx.shadowBlur = 20 + pulse * 16;
    ctx.fillStyle = 'rgba(28,20,52,0.92)';
    ctx.beginPath();
    ctx.moveTo(40, 0);
    for (let seg = 0; seg <= 8; seg++) {
      const sx = 40 - seg * 22;
      const sy = Math.sin(timeMs * 0.003 + seg * 0.7) * 14 * (seg / 8 + 0.2);
      const w = 20 - seg * 1.6;
      ctx.lineTo(sx, sy - w);
      void sy;
    }
    for (let seg = 8; seg >= 0; seg--) {
      const sx = 40 - seg * 22;
      const w = 20 - seg * 1.6;
      ctx.lineTo(sx, Math.sin(timeMs * 0.003 + seg * 0.7) * 14 * (seg / 8 + 0.2) + w);
    }
    ctx.closePath();
    ctx.fill();
    // Sonar spots pulse in sequence — the "reveal" rhythm.
    for (let seg = 0; seg <= 8; seg++) {
      const sx = 40 - seg * 22;
      const sy = Math.sin(timeMs * 0.003 + seg * 0.7) * 14 * (seg / 8 + 0.2);
      const active = (Math.floor(timeMs / 300) + seg) % 4 === 0;
      ctx.fillStyle = active ? VFX_COLORS.violet : 'rgba(90,70,140,0.5)';
      ctx.beginPath();
      ctx.arc(sx, sy, active ? 4.5 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Head eye.
    ctx.fillStyle = VFX_COLORS.violet;
    ctx.beginPath();
    ctx.arc(34, -6, 3.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Crown Reef finale guardian: radiant sea-dragon with three phase crowns.
    ctx.shadowColor = VFX_COLORS.gold;
    ctx.shadowBlur = 30 + pulse * 20;
    const grad = ctx.createLinearGradient(-90, 0, 50, 0);
    grad.addColorStop(0, '#7b2ff7');
    grad.addColorStop(0.6, '#f107a3');
    grad.addColorStop(1, VFX_COLORS.gold);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.quadraticCurveTo(10, -60, -60, -30);
    ctx.quadraticCurveTo(-30, 0, -60, 30);
    ctx.quadraticCurveTo(10, 60, 50, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,0.8)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // Crown.
    ctx.strokeStyle = VFX_COLORS.gold;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-4, -30); ctx.lineTo(4, -48); ctx.lineTo(12, -32); ctx.lineTo(20, -52); ctx.lineTo(26, -30);
    ctx.stroke();
    // Phase pips show encounter progress.
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < boss.phase ? VFX_COLORS.gold : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(-40 + i * 14, 40, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
  if (!state.accessibility.reducedMotion && state.shakeIntensity > 0.2) {
    // A deterministic, easing sway avoids the harsh frame-to-frame jitter of
    // random camera offsets while preserving clear hit feedback.
    const dx = Math.sin(state.timeMs * 0.045) * state.shakeIntensity * 0.28;
    const dy = Math.cos(state.timeMs * 0.052) * state.shakeIntensity * 0.20;
    ctx.translate(dx, dy);
  }
  drawBackground(ctx, state);
  for (const zone of state.currents) drawCurrentZone(ctx, zone, state.timeMs);
  for (const obs of state.obstacles) drawObstacle(ctx, obs, height);
  for (const barrier of state.barriers) drawCoralBarrier(ctx, barrier, state.timeMs);
  for (const shark of state.sharks) drawShark(ctx, shark, state.timeMs);
  for (const mine of state.seaMines) drawSeaMine(ctx, mine, state.timeMs);
  for (const jelly of state.jellyfish) drawJellyfish(ctx, jelly, state.timeMs);
  for (const coin of state.coins) drawCoin(ctx, coin, state.timeMs);
  for (const gem of state.gems) drawGem(ctx, gem, state.timeMs);
  for (const pu of state.powerUps) drawPowerUp(ctx, pu, state.timeMs);
  for (const ring of state.boostRings) drawBubbleBoostRing(ctx, ring, state.timeMs);
  for (const chest of state.chests) drawTreasureChest(ctx, chest, state.timeMs);
  for (const p of state.plankton) drawPlankton(ctx, p, state.timeMs);
  for (const pearl of state.sunPearls) drawSunPearl(ctx, pearl, state.timeMs);
  for (const lore of state.loreDrops) drawLoreDrop(ctx, lore, state.timeMs);
  for (const companion of state.companions) drawCompanion(ctx, companion, state.timeMs);

  const fishX = width * FISH_X_RATIO;
  const invincible = state.timeMs < state.invincibleUntil;
  drawFish(ctx, state, fishX, invincible);
  drawBoss(ctx, state);
  for (const particle of state.particles) drawParticle(ctx, particle);

  for (const text of state.floatingTexts) {
    drawFloatingText(ctx, text, state.timeMs);
  }

  ctx.restore();

  if (!state.accessibility.reducedFlashes && state.isRedFlashing) {
    ctx.save();
    ctx.fillStyle = 'rgba(211, 47, 47, 0.22)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Golden Surge fullscreen treatment: warm vignette + speed lines.
  if (surgeIsActive(state.surge, state.timeMs) && !state.accessibility.reducedMotion) {
    ctx.save();
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, 'rgba(255, 214, 10, 0)');
    vignette.addColorStop(1, 'rgba(255, 160, 0, 0.22)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 243, 166, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const y = ((i * 97 + state.timeMs * 0.24) % (height + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(width * 0.06, y);
      ctx.lineTo(width * 0.02, y + 26);
      ctx.stroke();
    }
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

  // High-contrast accessibility mode: sharpen obstacle edges with an outline.
  if (state.accessibility.highContrast) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (const obs of state.obstacles) {
      const w = BASE.obstacleWidth;
      ctx.strokeRect(obs.x - w / 2, 0, w, obs.gapY - obs.gapSize / 2);
      ctx.strokeRect(obs.x - w / 2, obs.gapY + obs.gapSize / 2, w, height - (obs.gapY + obs.gapSize / 2));
    }
    ctx.beginPath();
    ctx.arc(fishX, state.fishY, BASE.fishRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export { FISH_X_RATIO };
