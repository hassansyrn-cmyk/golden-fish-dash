// -----------------------------------------------------------------------
// Ocean Legends run systems: combo chains, Golden Surge, school of
// companions, and collect-and-grow. All are plain simulation helpers the
// engine steps each frame — no React, no rendering.
// -----------------------------------------------------------------------

// ============================== COMBO ====================================

export const COMBO_WINDOW_MS = 1800;
export const COMBO_TIERS = [
  { at: 6, multiplier: 2, labelKey: 'combo.tier2' },
  { at: 12, multiplier: 3, labelKey: 'combo.tier3' },
  { at: 20, multiplier: 4, labelKey: 'combo.tier4' },
  { at: 32, multiplier: 5, labelKey: 'combo.tier5' },
] as const;

export interface ComboState {
  count: number;
  best: number;
  lastEventAt: number;
  /** 0..1 meter fill toward the next tier. */
  meter: number;
}

export function createCombo(): ComboState {
  return { count: 0, best: 0, lastEventAt: -Infinity, meter: 0 };
}

export type ComboEventKind = 'coin' | 'plankton' | 'pearl' | 'nearMiss' | 'gem' | 'chest' | 'rescue';

/** Register a combo-eligible event; returns the active multiplier. */
export function comboEvent(kind: ComboEventKind, state: ComboState, now: number, surgeActive: boolean): number {
  void kind;
  const withinWindow = now - state.lastEventAt <= COMBO_WINDOW_MS * (surgeActive ? 1.6 : 1);
  state.count = withinWindow ? state.count + 1 : 1;
  state.lastEventAt = now;
  state.best = Math.max(state.best, state.count);
  const next = COMBO_TIERS.find((t) => t.at > state.count);
  const currentTierAt = [...COMBO_TIERS].reverse().find((t) => t.at <= state.count)?.at ?? 0;
  state.meter = next ? Math.min(1, (state.count - currentTierAt) / Math.max(1, next.at - currentTierAt)) : 1;
  return comboMultiplier(state.count);
}

export function comboTier(count: number): number {
  let tier = 0;
  for (const t of COMBO_TIERS) if (count >= t.at) tier = t.multiplier;
  return tier;
}

export function comboMultiplier(count: number): number {
  let mult = 1;
  for (const t of COMBO_TIERS) if (count >= t.at) mult = t.multiplier;
  return mult;
}

/** Call each step; returns true on the frame the chain breaks (for feedback). */
export function comboTick(state: ComboState, now: number): boolean {
  if (state.count > 0 && now - state.lastEventAt > COMBO_WINDOW_MS) {
    state.count = 0;
    state.meter = 0;
    return true;
  }
  return false;
}

// ============================ GOLDEN SURGE ================================

export const SURGE_TARGET = 100;
export const SURGE_DURATION_MS = 10_000;

export interface SurgeState {
  charge: number;
  activeUntil: number;
  count: number;
}

export function createSurge(): SurgeState {
  return { charge: 0, activeUntil: 0, count: 0 };
}

export function surgeAddCharge(surge: SurgeState, amount: number, now: number): boolean {
  if (surge.activeUntil > now) return false;
  const before = surge.charge;
  surge.charge = Math.min(SURGE_TARGET, surge.charge + amount);
  return before < SURGE_TARGET && surge.charge >= SURGE_TARGET;
}

export function surgeActivate(surge: SurgeState, now: number) {
  surge.charge = 0;
  surge.activeUntil = now + SURGE_DURATION_MS;
  surge.count += 1;
}

export function surgeIsActive(surge: SurgeState, now: number): boolean {
  return surge.activeUntil > now;
}

// ============================== SCHOOL ====================================

export const MAX_COMPANIONS = 5;
export const COMPANION_SCORE_BONUS = 0.08; // +8% score events per companion

export interface CompanionFish {
  id: string;
  /** Orbit angle phase. */
  phase: number;
  /** Spring position used for the follow animation. */
  x: number;
  y: number;
  rescued: boolean;
  spawnAt: number;
}

export function companionMultiplier(count: number): number {
  return 1 + count * COMPANION_SCORE_BONUS;
}

// ============================== GROWTH ====================================

export const GROWTH_THRESHOLDS = [24, 60, 120] as const;

export interface GrowthState {
  eaten: number;
  stage: number; // 0..3
  /** Visual size multiplier eased by the renderer. */
  displayScale: number;
}

export function createGrowth(): GrowthState {
  return { eaten: 0, stage: 0, displayScale: 1 };
}

/** Returns the new stage if a threshold was just crossed, else null. */
export function growthEat(growth: GrowthState): number | null {
  growth.eaten += 1;
  const stage = GROWTH_THRESHOLDS.filter((t) => growth.eaten >= t).length;
  if (stage > growth.stage) {
    growth.stage = stage;
    return stage;
  }
  return null;
}

export function growthScale(stage: number): number {
  return 1 + stage * 0.09;
}
