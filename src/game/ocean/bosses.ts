// -----------------------------------------------------------------------
// Ocean Legends set-piece encounters. Nonviolent spectacle: survive the
// pattern, follow the light, rescue creatures, collect exposed pearls and
// restore the reef. Bosses never collide with the player; danger comes
// from the same readable telegraphed currents the chapters already teach.
// -----------------------------------------------------------------------

import type { RunRandom } from './rng';

export type BossKind = 'guardian' | 'leviathan' | 'crownFinale' | 'spectacle';

export interface BossSpawnApi {
  readonly width: number;
  readonly height: number;
  readonly timeMs: number;
  rng: RunRandom;
  pushSunPearl(x: number, y: number): void;
  pushCoin(x: number, y: number, bonus?: boolean): void;
  pushCurrent(x: number, y: number, direction: 'up' | 'down', strength: number): void;
  pushCompanion(x: number, y: number): void;
  pushPlankton(x: number, y: number): void;
}

export interface BossDef {
  kind: BossKind;
  nameKey: string;
  durationMs: number;
  pearlTarget: number;
  phases: number;
  musicState: 'boss' | 'surge';
}

export const BOSSES: Record<BossKind, BossDef> = {
  guardian: { kind: 'guardian', nameKey: 'boss.reefGuardian', durationMs: 24_000, pearlTarget: 10, phases: 2, musicState: 'boss' },
  leviathan: { kind: 'leviathan', nameKey: 'boss.trenchLeviathan', durationMs: 28_000, pearlTarget: 12, phases: 2, musicState: 'boss' },
  crownFinale: { kind: 'crownFinale', nameKey: 'boss.crownFinale', durationMs: 40_000, pearlTarget: 16, phases: 3, musicState: 'boss' },
  // Chapter finale flurries (lagoon homecoming, kelp dance, vent chorus):
  // a dense reward spectacle without a boss silhouette.
  spectacle: { kind: 'spectacle', nameKey: 'setpiece.spectacle', durationMs: 14_000, pearlTarget: 6, phases: 1, musicState: 'surge' },
};

/** Runtime boss state living inside EngineState. */
export interface BossState {
  kind: BossKind;
  phase: number;
  startedAtMs: number;
  durationMs: number;
  pearlTarget: number;
  pearlsCollected: number;
  companionsRescued: number;
  /** Presentational motion params read by the renderer. */
  bodyX: number;
  bodyY: number;
  /** Telegraphed sweep: -1 rising, 1 sinking, 0 idle. */
  sweep: number;
  ended: boolean;
  succeeded: boolean;
  rewardGranted: boolean;
}

export function createBossState(kind: BossKind, now: number): BossState {
  const def = BOSSES[kind];
  return {
    kind,
    phase: 1,
    startedAtMs: now,
    durationMs: def.durationMs,
    pearlTarget: def.pearlTarget,
    pearlsCollected: 0,
    companionsRescued: 0,
    bodyX: 0,
    bodyY: 0,
    sweep: 0,
    ended: false,
    succeeded: false,
    rewardGranted: false,
  };
}

let spawnTimer = 0;

/** Step the encounter; spawns reward waves + telegraphed current sweeps. */
export function updateBoss(state: BossState, api: BossSpawnApi, dtMs: number, pearlsCollectedDelta: number) {
  if (state.ended) return;
  state.pearlsCollected += pearlsCollectedDelta;
  const def = BOSSES[state.kind];
  const elapsed = api.timeMs - state.startedAtMs;
  const progress = Math.min(1, elapsed / state.durationMs);
  state.phase = Math.min(def.phases, 1 + Math.floor(progress * def.phases));
  state.succeeded = state.pearlsCollected >= state.pearlTarget;

  if (elapsed >= state.durationMs) {
    state.ended = true;
    return;
  }

  // Boss silhouette glides at the far edge, telegraphing vertical sweeps.
  const sweepPeriod = state.kind === 'leviathan' ? 5200 : 4200;
  const sweepPhase = (elapsed % sweepPeriod) / sweepPeriod;
  state.bodyX = api.width - 70 - Math.sin(progress * Math.PI) * 26;
  state.bodyY = api.height / 2 + Math.sin(elapsed * 0.0009) * api.height * 0.22;
  state.sweep = sweepPhase < 0.16 ? (Math.sin(elapsed * 0.0009) > 0 ? 1 : -1) : 0;

  spawnTimer += dtMs;
  const interval = state.kind === 'crownFinale' && state.phase >= 3 ? 420 : 640;
  if (spawnTimer >= interval) {
    spawnTimer = 0;
    const waveY = api.height / 2 + Math.sin(elapsed * 0.0012) * api.height * 0.28;
    // Pearl trail the player should follow through the sweep.
    for (let i = 0; i < 3; i++) {
      api.pushSunPearl(api.width + 40 + i * 46, waveY + Math.sin(i * 0.9) * 26);
    }
    if (api.rng.chance(0.35)) api.pushCompanion(api.width + 120, waveY + 60);
    if (api.rng.chance(0.3)) api.pushCoin(api.width + 90, waveY - 60, true);
    // Telegraphed current matching the sweep direction.
    if (state.sweep !== 0) {
      api.pushCurrent(api.width + 60, state.sweep < 0 ? api.height * 0.3 : api.height * 0.7, state.sweep < 0 ? 'up' : 'down', 1.1);
    }
    if (state.kind === 'crownFinale' && state.phase >= 2) api.pushPlankton(api.width + 160, api.height / 2 + api.rng.spread(api.height * 0.3));
  }
}

/** Score/coin payout when the encounter ends; called once. */
export function bossReward(state: BossState): { score: number; coins: number } {
  if (state.rewardGranted) return { score: 0, coins: 0 };
  state.rewardGranted = true;
  const base = state.kind === 'crownFinale' ? 60 : 35;
  if (state.succeeded) {
    return { score: base + state.companionsRescued * 4, coins: 40 };
  }
  return { score: Math.round(base * 0.4), coins: 12 };
}
