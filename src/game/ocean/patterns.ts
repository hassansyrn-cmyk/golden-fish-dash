// -----------------------------------------------------------------------
// Ocean Legends authored pattern library.
// Patterns are data-driven templates the engine picks from (seeded RNG).
// Each pattern consumes a horizontal span and must always reserve an
// obvious, reachable route — fairness rules live inside the helpers so a
// pattern cannot accidentally seal the only path.
// -----------------------------------------------------------------------

import type { RunRandom } from './rng';

export type PowerUpKind = 'shield' | 'magnet' | 'fever' | 'hourglass';
export type HazardKind = 'shark' | 'mine' | 'jelly' | 'eel';

/** Minimal spawn surface the engine provides to pattern builders. */
export interface PatternSpawnApi {
  readonly width: number;
  readonly height: number;
  /** Anchor route center for this pattern slot (already clamped). */
  anchorY: number;
  gapSize: number;
  difficulty: number;
  score: number;
  rng: RunRandom;
  themeId: string;
  pushObstacle(args: { x: number; gapY: number; gapSize: number }): void;
  pushCoin(x: number, y: number, bonus?: boolean): void;
  pushGem(x: number, y: number): void;
  pushPowerUp(x: number, y: number, type: PowerUpKind): void;
  pushHazard(kind: HazardKind, x: number, y: number): void;
  pushPlankton(x: number, y: number): void;
  pushSunPearl(x: number, y: number): void;
  pushBarrier(x: number, y: number, gapSize: number): void;
  pushCompanion(x: number, y: number): void;
  pushCurrent(x: number, y: number, direction: 'up' | 'down', strength: number): void;
  pushChest(x: number, y: number): void;
  pushLore(x: number, y: number): void;
}

export interface PatternDef {
  id: string;
  /** Authored difficulty 1 (gentle) .. 5 (expert). */
  difficulty: number;
  weight: number;
  /** Chapter indexes; omit to allow everywhere. */
  chapters?: number[];
  /** Horizontal span consumed (used to schedule the next pattern). */
  build: (api: PatternSpawnApi) => number;
}

const BASE_W = 64;

/** Clamp a route center inside the playfield with a fair margin. */
function clampY(api: PatternSpawnApi, y: number): number {
  const margin = Math.max(92, api.gapSize * 0.45);
  return Math.max(margin, Math.min(api.height - margin, y));
}

/** Offset a hazard off the route center while leaving the opposite side clear. */
function sideLane(api: PatternSpawnApi, y: number, half: number): number {
  const min = Math.max(half + 20, api.gapSize * 0.23);
  const max = Math.max(min, api.gapSize / 2 - half - 20);
  const offset = min + api.rng.next() * Math.max(4, max - min);
  return y + (api.rng.chance(0.5) ? -offset : offset);
}

function gate(api: PatternSpawnApi, x: number, y: number, gap = api.gapSize) {
  api.pushObstacle({ x, gapY: clampY(api, y), gapSize: gap });
}

/** Coin arc between two points (readable collectible trail). */
function coinArc(api: PatternSpawnApi, x0: number, y0: number, x1: number, y1: number, count = 5, bonusChance = 0) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    api.pushCoin(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, api.rng.chance(bonusChance));
  }
}

function planktonCluster(api: PatternSpawnApi, x: number, y: number, count = 4) {
  for (let i = 0; i < count; i++) {
    api.pushPlankton(x + api.rng.spread(26), y + api.rng.spread(34));
  }
}

// ---------------------------------------------------------------------------
// Pattern table. Spans assume the world scrolls ~3px/frame at 60fps.
// ---------------------------------------------------------------------------
export const PATTERNS: PatternDef[] = [
  {
    id: 'gentle-gate', difficulty: 1, weight: 10,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      coinArc(api, api.width + BASE_W + 44, api.anchorY, api.width + BASE_W + 44, api.anchorY, 1);
      return 320;
    },
  },
  {
    id: 'gate-gem', difficulty: 1, weight: 6,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushGem(api.width + BASE_W + 88, api.anchorY + api.rng.spread(api.gapSize * 0.2));
      return 340;
    },
  },
  {
    id: 'plankton-meadow', difficulty: 1, weight: 7, chapters: [0, 1],
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      planktonCluster(api, api.width + BASE_W + 120, api.anchorY, 5);
      return 340;
    },
  },
  {
    id: 'companion-call', difficulty: 1, weight: 4,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushCompanion(api.width + BASE_W + 120, api.anchorY + api.rng.spread(40));
      planktonCluster(api, api.width + BASE_W + 170, api.anchorY, 3);
      return 380;
    },
  },
  {
    id: 'coin-lane', difficulty: 2, weight: 8,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      coinArc(api, api.width + BASE_W + 44, api.anchorY, api.width + BASE_W + 220, api.anchorY + api.rng.spread(50), 6, 0.12);
      return 420;
    },
  },
  {
    id: 'current-elevator', difficulty: 2, weight: 7,
    build: (api) => {
      const dir = api.rng.chance(0.5) ? 'up' : 'down';
      const y = clampY(api, api.anchorY + (dir === 'up' ? -70 : 70));
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushCurrent(api.width + BASE_W + 110, y, dir, 1);
      coinArc(api, api.width + BASE_W + 110, y, api.width + BASE_W + 260, dir === 'up' ? y - 60 : y + 60, 4);
      gate(api, api.width + BASE_W + 330, clampY(api, dir === 'up' ? y - 90 : y + 90));
      return 560;
    },
  },
  {
    id: 'twin-gates', difficulty: 2, weight: 8,
    build: (api) => {
      const y1 = clampY(api, api.anchorY - 40);
      const y2 = clampY(api, api.anchorY + 40);
      gate(api, api.width + BASE_W, y1);
      gate(api, api.width + BASE_W + 300, y2);
      coinArc(api, api.width + BASE_W + 44, y1, api.width + BASE_W + 344, y2, 5, 0.1);
      return 520;
    },
  },
  {
    id: 'mine-side', difficulty: 2, weight: 7,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushHazard('mine', api.width + 86, sideLane(api, api.anchorY, 14));
      return 340;
    },
  },
  {
    id: 'jelly-drift', difficulty: 2, weight: 6, chapters: [1, 2, 5, 6],
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushHazard('jelly', api.width + 72, sideLane(api, api.anchorY, 12));
      return 340;
    },
  },
  {
    id: 'slalom', difficulty: 3, weight: 8,
    build: (api) => {
      const s = api.rng.chance(0.5) ? 1 : -1;
      gate(api, api.width + BASE_W, clampY(api, api.anchorY - 55 * s));
      gate(api, api.width + BASE_W + 260, clampY(api, api.anchorY + 55 * s));
      gate(api, api.width + BASE_W + 520, clampY(api, api.anchorY - 55 * s));
      coinArc(api, api.width + BASE_W + 60, api.anchorY - 55 * s, api.width + BASE_W + 580, api.anchorY - 55 * s, 7, 0.1);
      return 720;
    },
  },
  {
    id: 'shark-patrol', difficulty: 3, weight: 6,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushHazard('shark', api.width + 150, sideLane(api, api.anchorY, 19));
      return 380;
    },
  },
  {
    id: 'eel-ambush', difficulty: 4, weight: 5, chapters: [2, 3, 6, 7],
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushHazard('eel', api.width + 100, sideLane(api, api.anchorY, 15));
      planktonCluster(api, api.width + BASE_W + 130, api.anchorY, 3);
      return 380;
    },
  },
  {
    id: 'pearl-run', difficulty: 2, weight: 6,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushSunPearl(api.width + BASE_W + 90, api.anchorY);
      api.pushSunPearl(api.width + BASE_W + 150, api.anchorY + api.rng.spread(40));
      return 360;
    },
  },
  {
    id: 'surge-gauntlet', difficulty: 3, weight: 4,
    build: (api) => {
      // Sun pearls placed on the risky line guarded by a fragile coral barrier.
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushBarrier(api.width + BASE_W + 120, api.anchorY, api.gapSize);
      api.pushSunPearl(api.width + BASE_W + 120, api.anchorY);
      api.pushSunPearl(api.width + BASE_W + 170, api.anchorY + 20);
      coinArc(api, api.width + BASE_W + 210, api.anchorY - 60, api.width + BASE_W + 210, api.anchorY - 60, 3);
      return 420;
    },
  },
  {
    id: 'treasure-pocket', difficulty: 3, weight: 4,
    build: (api) => {
      // Safe route above, barrier-guarded treasure pocket below.
      const safeY = clampY(api, api.anchorY - 70);
      gate(api, api.width + BASE_W, safeY, api.gapSize * 0.92);
      api.pushBarrier(api.width + BASE_W + 170, clampY(api, safeY + 95), api.gapSize * 0.8);
      api.pushChest(api.width + BASE_W + 170, clampY(api, safeY + 95));
      coinArc(api, api.width + BASE_W + 44, safeY, api.width + BASE_W + 44, safeY, 2);
      return 420;
    },
  },
  {
    id: 'risky-riches', difficulty: 4, weight: 4,
    build: (api) => {
      // Hazard-dense center line visibly loaded with bonus coins.
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushHazard('mine', api.width + 92, clampY(api, api.anchorY - 52));
      api.pushCoin(api.width + BASE_W + 60, api.anchorY + 48, true);
      api.pushCoin(api.width + BASE_W + 100, api.anchorY + 48, true);
      coinArc(api, api.width + BASE_W + 140, api.anchorY + 40, api.width + BASE_W + 260, api.anchorY + 40, 4, 0.3);
      return 480;
    },
  },
  {
    id: 'current-gauntlet', difficulty: 3, weight: 5,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushCurrent(api.width + BASE_W + 120, clampY(api, api.anchorY - 60), 'up', 1);
      api.pushCurrent(api.width + BASE_W + 280, clampY(api, api.anchorY + 60), 'down', 1);
      gate(api, api.width + BASE_W + 420, clampY(api, api.anchorY));
      coinArc(api, api.width + BASE_W + 460, api.anchorY, api.width + BASE_W + 460, api.anchorY, 2);
      return 640;
    },
  },
  {
    id: 'powerup-corner', difficulty: 2, weight: 5,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      const type = api.rng.weighted<PowerUpKind>([['shield', 3], ['magnet', 3], ['fever', 2], ['hourglass', 2]]);
      api.pushPowerUp(api.width + BASE_W + 125, api.anchorY + api.rng.spread(api.gapSize * 0.2), type);
      return 360;
    },
  },
  {
    id: 'double-gap', difficulty: 3, weight: 6,
    build: (api) => {
      const top = clampY(api, api.anchorY - 65);
      const bottom = clampY(api, api.anchorY + 65);
      api.pushObstacle({ x: api.width + BASE_W, gapY: top, gapSize: api.gapSize * 0.8 });
      api.pushObstacle({ x: api.width + BASE_W, gapY: bottom, gapSize: api.gapSize * 0.8 });
      api.pushCoin(api.width + BASE_W + 40, bottom, true);
      return 360;
    },
  },
  {
    id: 'breather', difficulty: 1, weight: 6,
    build: (api) => {
      planktonCluster(api, api.width + 120, api.anchorY, 6);
      coinArc(api, api.width + 90, api.anchorY - 30, api.width + 260, api.anchorY + 20, 4);
      return 420;
    },
  },
  {
    id: 'stone-doors', difficulty: 3, weight: 6, chapters: [3, 7],
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY, api.gapSize * 1.06);
      gate(api, api.width + BASE_W + 240, api.anchorY + api.rng.spread(30), api.gapSize * 0.9);
      api.pushLore(api.width + BASE_W + 330, api.anchorY + api.rng.spread(40));
      return 520;
    },
  },
  {
    id: 'kelp-corridor', difficulty: 3, weight: 6, chapters: [2, 6],
    build: (api) => {
      // Narrow-ish band with pearls rewarding precise centering.
      const y = clampY(api, api.anchorY);
      gate(api, api.width + BASE_W, y, api.gapSize * 0.9);
      api.pushSunPearl(api.width + BASE_W + 44, y);
      gate(api, api.width + BASE_W + 250, clampY(api, y + api.rng.spread(24)), api.gapSize * 0.9);
      return 480;
    },
  },
  {
    id: 'vent-burst', difficulty: 4, weight: 5, chapters: [4, 7],
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushHazard('mine', api.width + 96, sideLane(api, api.anchorY, 14));
      api.pushHazard('jelly', api.width + 180, sideLane(api, api.anchorY, 12));
      coinArc(api, api.width + BASE_W + 60, api.anchorY - 40, api.width + BASE_W + 240, api.anchorY - 60, 4, 0.2);
      return 500;
    },
  },
  {
    id: 'crystal-shatter', difficulty: 3, weight: 5, chapters: [5, 7],
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushBarrier(api.width + BASE_W + 130, api.anchorY + 55, api.gapSize * 0.85);
      api.pushGem(api.width + BASE_W + 130, api.anchorY - 45);
      planktonCluster(api, api.width + BASE_W + 200, api.anchorY, 3);
      return 460;
    },
  },
  {
    id: 'biolum-maze', difficulty: 4, weight: 5, chapters: [5, 6, 7],
    build: (api) => {
      const s = api.rng.chance(0.5) ? 1 : -1;
      gate(api, api.width + BASE_W, clampY(api, api.anchorY + 45 * s), api.gapSize * 0.92);
      api.pushHazard('jelly', api.width + BASE_W + 160, clampY(api, api.anchorY - 40 * s));
      gate(api, api.width + BASE_W + 300, clampY(api, api.anchorY - 50 * s), api.gapSize * 0.92);
      api.pushSunPearl(api.width + BASE_W + 340, clampY(api, api.anchorY - 50 * s));
      return 620;
    },
  },
  {
    id: 'leviathan-lane', difficulty: 4, weight: 3, chapters: [3, 6],
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushHazard('shark', api.width + 170, clampY(api, api.anchorY - 55));
      api.pushHazard('mine', api.width + 170, clampY(api, api.anchorY + 55));
      coinArc(api, api.width + BASE_W + 60, api.anchorY, api.width + BASE_W + 60, api.anchorY, 1);
      return 480;
    },
  },
  {
    id: 'crown-procession', difficulty: 5, weight: 5, chapters: [7],
    build: (api) => {
      gate(api, api.width + BASE_W, clampY(api, api.anchorY - 40), api.gapSize * 0.88);
      gate(api, api.width + BASE_W + 230, clampY(api, api.anchorY + 40), api.gapSize * 0.88);
      gate(api, api.width + BASE_W + 460, clampY(api, api.anchorY), api.gapSize * 0.82);
      api.pushSunPearl(api.width + BASE_W + 500, api.anchorY);
      return 700;
    },
  },
  {
    id: 'school-gauntlet', difficulty: 5, weight: 4, chapters: [6, 7],
    build: (api) => {
      gate(api, api.width + BASE_W, clampY(api, api.anchorY));
      api.pushHazard('eel', api.width + 120, clampY(api, api.anchorY - 45));
      api.pushHazard('shark', api.width + 260, clampY(api, api.anchorY + 45));
      api.pushCompanion(api.width + BASE_W + 380, api.anchorY);
      coinArc(api, api.width + BASE_W + 410, api.anchorY, api.width + BASE_W + 410, api.anchorY, 2, 0.4);
      return 640;
    },
  },
  {
    id: 'gate-rush', difficulty: 4, weight: 6,
    build: (api) => {
      gate(api, api.width + BASE_W, clampY(api, api.anchorY - 25));
      gate(api, api.width + BASE_W + 210, clampY(api, api.anchorY + 25), api.gapSize * 0.94);
      coinArc(api, api.width + BASE_W + 44, api.anchorY - 25, api.width + BASE_W + 254, api.anchorY + 25, 5, 0.1);
      return 480;
    },
  },
  {
    id: 'magnet-harvest', difficulty: 2, weight: 5,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushPowerUp(api.width + BASE_W + 100, api.anchorY, 'magnet');
      coinArc(api, api.width + BASE_W + 160, api.anchorY + 70, api.width + BASE_W + 320, api.anchorY - 70, 7, 0.15);
      return 520;
    },
  },
  {
    id: 'shield-sentry', difficulty: 3, weight: 4,
    build: (api) => {
      gate(api, api.width + BASE_W, api.anchorY);
      api.pushPowerUp(api.width + BASE_W + 90, api.anchorY - 30, 'shield');
      api.pushHazard('mine', api.width + 200, sideLane(api, api.anchorY, 14));
      return 420;
    },
  },
  {
    id: 'slow-climb', difficulty: 2, weight: 5,
    build: (api) => {
      api.pushCurrent(api.width + 120, clampY(api, api.anchorY - 40), 'up', 0.8);
      gate(api, api.width + 300, clampY(api, api.anchorY - 60));
      api.pushPowerUp(api.width + 340, clampY(api, api.anchorY - 70), 'hourglass');
      planktonCluster(api, api.width + 420, clampY(api, api.anchorY - 50), 4);
      return 560;
    },
  },
];

/** Weighted pattern selection constrained by chapter + difficulty. */
export function pickPattern(
  rng: RunRandom,
  chapterIndex: number,
  difficulty: number,
  options: { modifiers?: string[]; recentIds?: string[] } = {},
): PatternDef {
  const recent = new Set(options.recentIds ?? []);
  const noBoost = options.modifiers?.includes('noBoost');
  const treasureTide = options.modifiers?.includes('treasureTide');

  const eligible = PATTERNS.filter((p) => {
    if (p.chapters && !p.chapters.includes(chapterIndex)) return false;
    if (p.difficulty > difficulty + 1) return false;
    if (p.difficulty < difficulty - 2) return false;
    if (noBoost && (p.id === 'powerup-corner' || p.id === 'shield-sentry' || p.id === 'magnet-harvest' || p.id === 'slow-climb')) return false;
    if (treasureTide && (p.id === 'treasure-pocket' || p.id === 'risky-riches' || p.id === 'surge-gauntlet')) return false; // always-on instead
    return true;
  });

  const pool = eligible.length > 0 ? eligible : PATTERNS.filter((p) => p.difficulty <= 2);
  const weighted = pool.map((p) => {
    let w = p.weight;
    if (recent.has(p.id)) w *= 0.25; // avoid immediate repeats
    if (treasureTide && (p.id === 'treasure-pocket' || p.id === 'risky-riches' || p.id === 'surge-gauntlet')) w *= 2.5;
    return [p, w] as const;
  });
  return rng.weighted(weighted);
}

export const PATTERN_COUNT = PATTERNS.length;
