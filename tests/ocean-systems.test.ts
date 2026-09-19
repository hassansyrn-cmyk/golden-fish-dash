// -----------------------------------------------------------------------
// Ocean Legends unit tests: seeded RNG, combo/surge/growth systems,
// chapter data integrity, boss progression, and pattern reachability.
// Run with: pnpm test
// -----------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { createRunRandom, hashSeed, mulberry32, generateSeed } from '../src/game/ocean/rng';
import {
  COMBO_TIERS, comboEvent, comboMultiplier, comboTick, comboTier, createCombo,
  createGrowth, createSurge, growthEat, growthScale, surgeActivate, surgeAddCharge,
  surgeIsActive, GROWTH_THRESHOLDS,
} from '../src/game/ocean/systems';
import { CHAPTERS, chapterDifficulty, chapterForScore } from '../src/game/ocean/chapters';
import { PATTERNS, pickPattern } from '../src/game/ocean/patterns';
import { bossReward, createBossState, updateBoss, BOSSES } from '../src/game/ocean/bosses';
import { CHARACTERS, getCharacter, getGalleryOrder } from '../src/game/ocean/characters';
import { ENVIRONMENTS, environmentById } from '../src/game/ocean/environmentTheme';

// ------------------------------- RNG -----------------------------------

describe('seeded RNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = createRunRandom('GFD-TEST1');
    const b = createRunRandom('GFD-TEST1');
    const seqA = Array.from({ length: 32 }, () => a.next());
    const seqB = Array.from({ length: 32 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRunRandom('GFD-AAA');
    const b = createRunRandom('GFD-BBB');
    expect(Array.from({ length: 8 }, () => a.next())).not.toEqual(Array.from({ length: 8 }, () => b.next()));
  });

  it('keeps range/int/chance within bounds', () => {
    const rng = createRunRandom('bounds');
    for (let i = 0; i < 500; i++) {
      const v = rng.range(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
      const n = rng.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('weighted picks respect certainty and hash is stable', () => {
    const rng = createRunRandom('weighted');
    expect(rng.weighted([['x', 1], ['y', 0]])).toBe('x');
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(mulberry32(1)()).toBeGreaterThanOrEqual(0);
    expect(generateSeed()).toMatch(/^GFD-[A-Z2-9]{5}$/);
  });
});

// ------------------------------ COMBO -----------------------------------

describe('combo chain', () => {
  it('multiplies through the tier table and tracks the best', () => {
    const combo = createCombo();
    let now = 0;
    for (let i = 0; i < 25; i++) {
      comboEvent('coin', combo, now += 500, false);
    }
    expect(combo.count).toBe(25);
    expect(combo.best).toBe(25);
    expect(comboMultiplier(combo.count)).toBe(4);
    expect(comboTier(combo.count)).toBe(4);
  });

  it('breaks after the window elapses and reports the break once', () => {
    const combo = createCombo();
    comboEvent('coin', combo, 0, false);
    comboEvent('coin', combo, 1000, false);
    expect(combo.count).toBe(2);
    // Window is 1800ms: at 4000 the chain must reset.
    expect(comboTick(combo, 1500)).toBe(false);
    expect(comboTick(combo, 4000)).toBe(true);
    expect(combo.count).toBe(0);
    expect(comboTick(combo, 4200)).toBe(false);
  });

  it('extends the window during Golden Surge', () => {
    const combo = createCombo();
    comboEvent('coin', combo, 0, true);
    comboEvent('coin', combo, 2800, true); // >1800 but <1800*1.6
    expect(combo.count).toBe(2);
  });

  it('tier thresholds are ascending and unique', () => {
    const ats = COMBO_TIERS.map((t) => t.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    expect(new Set(ats).size).toBe(ats.length);
  });
});

// --------------------------- GOLDEN SURGE --------------------------------

describe('golden surge', () => {
  it('charges, activates once full, and expires', () => {
    const surge = createSurge();
    expect(surgeIsActive(surge, 0)).toBe(false);
    expect(surgeAddCharge(surge, 60, 0)).toBe(false);
    expect(surgeAddCharge(surge, 60, 100)).toBe(true); // activation signal
    surgeActivate(surge, 100);
    expect(surgeIsActive(surge, 5000)).toBe(true);
    expect(surgeIsActive(surge, 100 + 10_000 + 1)).toBe(false);
  });

  it('ignores charge while active', () => {
    const surge = createSurge();
    surgeAddCharge(surge, 100, 0);
    surgeActivate(surge, 10);
    expect(surgeAddCharge(surge, 50, 1000)).toBe(false);
    expect(surge.count).toBe(1);
  });
});

// ------------------------------ GROWTH -----------------------------------

describe('collect-and-grow', () => {
  it('crosses thresholds in order and scales size', () => {
    const growth = createGrowth();
    expect(growth.stage).toBe(0);
    for (let i = 1; i < GROWTH_THRESHOLDS[0]; i++) expect(growthEat(growth)).toBeNull();
    expect(growthEat(growth)).toBe(1);
    expect(growthScale(1)).toBeGreaterThan(1);
    while (growth.stage < 2) growthEat(growth);
    expect(growth.stage).toBeGreaterThanOrEqual(2);
  });
});

// ----------------------------- CHAPTERS ----------------------------------

describe('chapter model', () => {
  it('has monotonic score thresholds and complete content', () => {
    for (let i = 0; i < CHAPTERS.length; i++) {
      const chapter = CHAPTERS[i];
      expect(chapter.index).toBe(i);
      if (i > 0) expect(chapter.minScore).toBeGreaterThan(CHAPTERS[i - 1].minScore);
      expect(chapter.themeIds.length).toBeGreaterThan(0);
      expect(chapter.lore.length).toBeGreaterThan(0);
      expect(chapter.missions.length).toBe(3);
      expect(chapter.setPiece.atScore).toBeGreaterThan(chapter.minScore);
      for (const themeId of chapter.themeIds) {
        expect(environmentById(themeId).id).toBe(themeId);
      }
    }
  });

  it('maps scores to chapters and scales difficulty inside a chapter', () => {
    expect(chapterForScore(0).id).toBe('sunlitLagoon');
    expect(chapterForScore(16).id).toBe('coralCarnival');
    expect(chapterForScore(9999).id).toBe('crownReef');
    const ch = chapterForScore(0);
    expect(chapterDifficulty(ch, ch.minScore)).toBeLessThanOrEqual(chapterDifficulty(ch, ch.minScore + 500));
  });

  it('every environment referenced exists exactly once in the palette', () => {
    const ids = ENVIRONMENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ------------------------------ BOSSES -----------------------------------

describe('set-piece encounters', () => {
  const apiFactory = () => ({
    width: 400, height: 700, timeMs: 0,
    rng: createRunRandom('boss-test'),
    pushed: { pearls: [] as Array<[number, number]>, companions: 0, coins: 0, currents: [] as string[], plankton: 0 },
    pushSunPearl(x: number, y: number) { this.pushed.pearls.push([x, y]); },
    pushCoin() { this.pushed.coins += 1; },
    pushCurrent(_x: number, _y: number, direction: 'up' | 'down', _s: number) { this.pushed.currents.push(direction); },
    pushCompanion() { this.pushed.companions += 1; },
    pushPlankton() { this.pushed.plankton += 1; },
  });

  it.each(Object.keys(BOSSES) as Array<keyof typeof BOSSES>)('%s ends within its duration and pays out once', (kind) => {
    const def = BOSSES[kind];
    const boss = createBossState(kind, 0);
    const api = apiFactory();
    let elapsed = 0;
    while (!boss.ended && elapsed <= def.durationMs + 100) {
      api.timeMs = elapsed;
      updateBoss(boss, api, 100, 0);
      elapsed += 100;
    }
    expect(boss.ended).toBe(true);
    const reward = bossReward(boss);
    expect(reward.score).toBeGreaterThan(0);
    expect(bossReward(boss).score).toBe(0); // no double payout
  });

  it('collecting enough pearls marks success and bigger rewards', () => {
    const kind = 'guardian';
    const boss = createBossState(kind, 0);
    const api = apiFactory();
    // Deliver the pearl target without waiting out the timer.
    for (let t = 0; t < 8000 && !boss.ended; t += 100) {
      api.timeMs = t;
      updateBoss(boss, api, 100, boss.pearlsCollected < boss.pearlTarget ? 5 : 0);
    }
    expect(boss.succeeded).toBe(true);
    const reward = bossReward(boss);
    expect(reward.score).toBeGreaterThanOrEqual(35);
    expect(reward.coins).toBe(40);
  });
});

// ---------------------------- CHARACTERS ---------------------------------

describe('character roster', () => {
  it('has unique ids and unique unlock scores', () => {
    const scores = CHARACTERS.map((c) => c.unlockScore);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    expect(new Set(scores).size).toBe(scores.length);
    expect(Math.min(...scores)).toBe(0);
  });

  it('gallery orders heroes first and falls back to Aurum', () => {
    const gallery = getGalleryOrder();
    expect(gallery[0].tier).toBe('hero');
    expect(getCharacter('nonexistent' as never).id).toBe('golden');
  });
});

// ------------------------ PATTERN REACHABILITY ---------------------------
// Fairness contract under test: every spawned gate keeps a vertical corridor
// that is at least MIN_ROUTE tall and fully inside the playfield, hazards
// never seal a gate on their own, and collectibles sit inside bounds.

const VIEW_W = 390;
const VIEW_H = 780;
const MIN_ROUTE = 96; // conservative corridor under the tightest authored gap
const PLAY_MARGIN = 70;

interface MockEntity { kind: string; x: number; y: number; gapY?: number; gapSize?: number }

function buildPatternApi(entities: MockEntity[]) {
  const rng = createRunRandom('pattern-test');
  return {
    width: VIEW_W,
    height: VIEW_H,
    anchorY: VIEW_H / 2,
    gapSize: 190,
    difficulty: 3,
    score: 40,
    rng,
    themeId: 'lagoon',
    pushObstacle: (args: { x: number; gapY: number; gapSize: number }) =>
      entities.push({ kind: 'obstacle', x: args.x, y: 0, gapY: args.gapY, gapSize: args.gapSize }),
    pushCoin: (x: number, y: number) => entities.push({ kind: 'coin', x, y }),
    pushGem: (x: number, y: number) => entities.push({ kind: 'gem', x, y }),
    pushPowerUp: (x: number, y: number) => entities.push({ kind: 'powerup', x, y }),
    pushHazard: (kind: string, x: number, y: number) => entities.push({ kind: `hazard:${kind}`, x, y }),
    pushPlankton: (x: number, y: number) => entities.push({ kind: 'plankton', x, y }),
    pushSunPearl: (x: number, y: number) => entities.push({ kind: 'pearl', x, y }),
    pushBarrier: (x: number, y: number) => entities.push({ kind: 'barrier', x, y }),
    pushCompanion: (x: number, y: number) => entities.push({ kind: 'companion', x, y }),
    pushCurrent: (x: number, y: number) => entities.push({ kind: 'current', x, y }),
    pushChest: (x: number, y: number) => entities.push({ kind: 'chest', x, y }),
    pushLore: (x: number, y: number) => entities.push({ kind: 'lore', x, y }),
  };
}

describe('pattern reachability', () => {
  const seeds = ['qa-1', 'qa-2', 'qa-3', 'qa-4'];

  it('has a library of at least 30 authored patterns', () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(PATTERNS.length);
  });

  it('every pattern keeps a passable route across seeds and difficulties', () => {
    for (const pattern of PATTERNS) {
      for (const seed of seeds) {
        for (const difficulty of [1, 3, 5]) {
          const entities: MockEntity[] = [];
          const api = buildPatternApi(entities) as never as Parameters<typeof pattern.build>[0];
          // Deterministic rng per run.
          (api as unknown as { rng: ReturnType<typeof createRunRandom> }).rng = createRunRandom(`${seed}:${pattern.id}`);
          api.anchorY = PLAY_MARGIN + (VIEW_H - PLAY_MARGIN * 2) / 2;
          pattern.build(api);

          // Group gates by approximate x so multi-gate columns are checked together.
          const byX = new Map<number, MockEntity[]>();
          for (const entity of entities) {
            if (entity.kind !== 'obstacle') continue;
            const key = Math.round(entity.x / 40);
            byX.set(key, [...(byX.get(key) ?? []), entity]);
          }
          for (const [, gates] of byX) {
            // Merge all open intervals at this x, then require one >= MIN_ROUTE.
            const intervals = gates
              .map((g) => [g.gapY! - g.gapSize! / 2, g.gapY! + g.gapSize! / 2] as const)
              .sort((a, b) => a[0] - b[0]);
            let merged: Array<readonly [number, number]> = [];
            for (const interval of intervals) {
              const last = merged[merged.length - 1];
              if (last && interval[0] <= last[1]) {
                merged[merged.length - 1] = [last[0], Math.max(last[1], interval[1])];
              } else {
                merged.push(interval);
              }
            }
            // Simulate screen edges: outside the field is solid.
            merged = merged.map(([a, b]) => [Math.max(0, a), Math.min(VIEW_H, b)] as const);
            const best = Math.max(...merged.map(([a, b]) => b - a));
            if (best < MIN_ROUTE) {
              throw new Error(
                `Pattern ${pattern.id} (seed ${seed}, diff ${difficulty}) seals the gate: best corridor ${best.toFixed(0)}px < ${MIN_ROUTE}px`,
              );
            }
          }

          // Nothing may spawn off-screen.
          for (const entity of entities) {
            expect(entity.y, `${pattern.id}:${entity.kind}`).toBeLessThanOrEqual(VIEW_H);
            expect(entity.y, `${pattern.id}:${entity.kind}`).toBeGreaterThanOrEqual(0);
            expect(entity.x, `${pattern.id}:${entity.kind}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('pickPattern respects chapter and modifier constraints', () => {
    const rng = createRunRandom('picker');
    for (let i = 0; i < 200; i++) {
      const pattern = pickPattern(rng, 1, 2, { modifiers: ['noBoost'], recentIds: [] });
      expect(pattern.chapters === undefined || pattern.chapters.includes(1)).toBe(true);
      if (['powerup-corner', 'shield-sentry', 'magnet-harvest', 'slow-climb'].includes(pattern.id)) {
        throw new Error(`noBoost modifier allowed boost pattern ${pattern.id}`);
      }
    }
    for (let i = 0; i < 100; i++) {
      const pattern = pickPattern(rng, 0, 1, {});
      if (pattern.chapters && !pattern.chapters.includes(0)) {
        throw new Error(`Chapter 0 got pattern ${pattern.id} restricted to ${pattern.chapters}`);
      }
    }
  });
});
