// -----------------------------------------------------------------------
// Local persistence layer for Golden Fish Rush.
// Everything here is localStorage-backed for now. Each function is written
// so it can be swapped for real backend calls later without touching
// call sites — see submitScoreToServer / fetchGlobalLeaderboard below.
// -----------------------------------------------------------------------

import {
  ACHIEVEMENTS,
  DAILY_CHALLENGE_POOL,
  SAMPLE_GLOBAL_SCORES,
  SKINS,
  STORAGE_KEYS,
  dateKey,
} from './constants';
import type {
  DailyChallengeState,
  DailyRewardState,
  LeaderboardEntry,
  Settings,
  ShopInventory,
  ShopItemId,
  SkinId,
} from './types';
import { submitLeaderboardScore as submitToFirebase, fetchGlobalLeaderboard as fetchFromFirebase } from './firebaseLeaderboard';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode, quota). Fail silently —
    // gameplay should never crash because persistence failed.
  }
}

// -----------------------------------------------------------------------
// PERF + DRY: every simple "read a value / write a value" pair below used
// to hand-roll its own readJSON/writeJSON calls. Two problems with that:
//   1. Duplication — the same three lines repeated ~12 times.
//   2. Every read re-parsed localStorage/JSON even for values (coins,
//      personal best, unlocked skins...) that are read constantly across
//      screens in a single session and only change on a handful of
//      explicit events.
// createStore() wraps a key in a tiny in-memory cache: the first read
// parses localStorage once, every read after that returns the cached
// value directly, and writes update the cache immediately so callers
// never see stale data. This is the exact pattern already proven for
// getSettings()/setSettings(); it's now the one shared implementation
// instead of a one-off. Public function signatures below are unchanged,
// so no call site anywhere else in the app needed to change.
// -----------------------------------------------------------------------
function createStore<T>(key: string, fallback: T) {
  let cache: T | null = null;
  return {
    get(): T {
      if (cache === null) cache = readJSON(key, fallback);
      return cache;
    },
    set(value: T) {
      cache = value;
      writeJSON(key, value);
    },
  };
}

// ---- Personal best ----
const personalBestStore = createStore(STORAGE_KEYS.personalBest, 0);
export function getPersonalBest(): number {
  return personalBestStore.get();
}
export function setPersonalBest(score: number) {
  personalBestStore.set(score);
}
export function resetPersonalBest() {
  personalBestStore.set(0);
}

// ---- Coins ----
const coinsStore = createStore(STORAGE_KEYS.coins, 0);
export function getCoins(): number {
  return coinsStore.get();
}
export function addCoins(amount: number): number {
  const total = getCoins() + amount;
  coinsStore.set(total);
  return total;
}
export function spendCoins(amount: number): number {
  const current = getCoins();
  const newTotal = Math.max(0, current - Math.max(0, amount));
  coinsStore.set(newTotal);
  return newTotal;
}

// ---- Skins ----
const unlockedSkinsStore = createStore<SkinId[]>(STORAGE_KEYS.unlockedSkins, ['golden']);
const selectedSkinStore = createStore<SkinId>(STORAGE_KEYS.selectedSkin, 'golden');
export function getUnlockedSkins(): SkinId[] {
  return unlockedSkinsStore.get();
}
export function getSelectedSkin(): SkinId {
  return selectedSkinStore.get();
}
export function setSelectedSkin(skin: SkinId) {
  selectedSkinStore.set(skin);
}
export function refreshUnlockedSkins(bestScore: number): SkinId[] {
  const unlocked = new Set(getUnlockedSkins());
  for (const skin of SKINS) {
    if (bestScore >= skin.unlockScore) unlocked.add(skin.id);
  }
  const result = Array.from(unlocked);
  unlockedSkinsStore.set(result);
  return result;
}

// ---- Achievements ----
const achievementsStore = createStore<string[]>(STORAGE_KEYS.achievements, []);
export function getUnlockedAchievements(): string[] {
  return achievementsStore.get();
}
export function unlockAchievement(id: string): boolean {
  const unlocked = new Set(getUnlockedAchievements());
  if (unlocked.has(id)) return false;
  unlocked.add(id);
  achievementsStore.set(Array.from(unlocked));
  return true;
}
export function getAllAchievements() {
  const unlocked = new Set(getUnlockedAchievements());
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlocked.has(a.id) }));
}

// ---- Rounds played / second chance tracking ----
const roundsPlayedStore = createStore(STORAGE_KEYS.roundsPlayed, 0);
const usedSecondChanceStore = createStore(STORAGE_KEYS.usedSecondChanceEver, false);
export function getRoundsPlayed(): number {
  return roundsPlayedStore.get();
}
export function incrementRoundsPlayed(): number {
  const total = getRoundsPlayed() + 1;
  roundsPlayedStore.set(total);
  return total;
}
export function hasUsedSecondChanceEver(): boolean {
  return usedSecondChanceStore.get();
}
export function markUsedSecondChanceEver() {
  usedSecondChanceStore.set(true);
}

// ---- Interstitial ad cadence ----
const gameOverCountStore = createStore(STORAGE_KEYS.gameOverCount, 0);
export function getGameOverCount(): number {
  return gameOverCountStore.get();
}
export function incrementGameOverCount(): number {
  const total = getGameOverCount() + 1;
  gameOverCountStore.set(total);
  return total;
}

// ---- Settings ----
const DEFAULT_SETTINGS: Settings = { sound: true, music: true, vibration: true };
// PERF: getSettings() is called from inside the game's requestAnimationFrame
// loop (once per frame, ~60x/sec) to read sound/vibration flags — this was
// the original motivating case for createStore()'s cache above.
const settingsStore = createStore<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
export function getSettings(): Settings {
  return settingsStore.get();
}
export function setSettings(settings: Settings) {
  settingsStore.set(settings);
}

// ---- Shop Inventory ----
const DEFAULT_SHOP_INVENTORY: ShopInventory = {
  shield: 0,
  magnet: 0,
  gemBoost: 0,
  continueToken: 0,
};
const shopInventoryStore = createStore<ShopInventory>(STORAGE_KEYS.shopInventory, DEFAULT_SHOP_INVENTORY);

export function getShopInventory(): ShopInventory {
  return shopInventoryStore.get();
}

function saveShopInventory(inventory: ShopInventory) {
  shopInventoryStore.set(inventory);
}

export function getShopItemCount(itemId: ShopItemId): number {
  const inv = getShopInventory();
  return inv[itemId] ?? 0;
}
export function buyShopItem(itemId: ShopItemId, cost: number): boolean {
  const currentCoins = getCoins();
  if (currentCoins < cost) {
    return false;
  }
  const inv = getShopInventory();
  const newInv: ShopInventory = { ...inv, [itemId]: (inv[itemId] ?? 0) + 1 };
  spendCoins(cost);
  saveShopInventory(newInv);
  return true;
}
export function consumeShopItem(itemId: ShopItemId): boolean {
  const inv = getShopInventory();
  const current = inv[itemId] ?? 0;
  if (current <= 0) {
    return false;
  }
  const newInv: ShopInventory = { ...inv, [itemId]: current - 1 };
  saveShopInventory(newInv);
  return true;
}

// Helper to add free shop item (used by daily rewards)
function addShopItem(itemId: ShopItemId, count: number = 1): ShopInventory {
  const inv = getShopInventory();
  const newInv: ShopInventory = { ...inv, [itemId]: (inv[itemId] ?? 0) + count };
  saveShopInventory(newInv);
  return newInv;
}

// ---- Local leaderboard ----
// Seeded once with sample "global" scores so the board never looks empty.
// Structured to be a drop-in replacement target for a real backend: once
// a server exists, fetchGlobalLeaderboard() below can fetch a merged list
// instead of reading localStorage.
function ensureLeaderboardSeeded(): LeaderboardEntry[] {
  const existing = readJSON<LeaderboardEntry[] | null>(STORAGE_KEYS.leaderboard, null);
  if (existing) return existing;
  const seeded: LeaderboardEntry[] = SAMPLE_GLOBAL_SCORES.map((s) => ({
    name: s.name,
    score: s.score,
    date: dateKey(),
  }));
  writeJSON(STORAGE_KEYS.leaderboard, seeded);
  return seeded;
}

export function getLocalLeaderboard(): LeaderboardEntry[] {
  return ensureLeaderboardSeeded()
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
export function getGlobalBestScore(): number {
  const board = ensureLeaderboardSeeded();
  return board.reduce((max, e) => Math.max(max, e.score), 0);
}
export function addLocalLeaderboardEntry(name: string, score: number): LeaderboardEntry[] {
  const board = ensureLeaderboardSeeded();
  board.push({ name: name.slice(0, 16) || 'Player', score, date: dateKey() });
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, 50); // keep some history beyond the visible top 10
  writeJSON(STORAGE_KEYS.leaderboard, trimmed);
  return trimmed;
}

export function qualifiesForLeaderboard(score: number): boolean {
  const board = getLocalLeaderboard();
  return score > 0 && (board.length < 10 || score > board[board.length - 1].score);
}
export function estimateGlobalRank(score: number): number {
  const board = ensureLeaderboardSeeded();
  const better = board.filter((e) => e.score > score).length;
  return better + 1;
}

// -----------------------------------------------------------------------
// Backend functions now powered by Firebase Firestore.
// Falls back to local storage on any error so the game never crashes.
// -----------------------------------------------------------------------

export async function submitScoreToServer(playerName: string, score: number): Promise<{ rank: number }> {
  const trimmed = (playerName || 'Player').trim().slice(0, 16) || 'Player';
  const safeScore = Math.floor(Math.max(0, score || 0));

  try {
    await submitToFirebase(trimmed, safeScore);
    return { rank: estimateGlobalRank(safeScore) };
  } catch (firebaseError) {
    console.warn('[Storage] Firebase submit failed, falling back to local.', firebaseError);
    addLocalLeaderboardEntry(trimmed, safeScore);
    return { rank: estimateGlobalRank(safeScore) };
  }
}

export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const remote = await fetchFromFirebase(10);
    if (remote && remote.length > 0) {
      return remote;
    }
  } catch (e) {
    console.warn('[Storage] Firebase fetch failed, using local leaderboard.', e);
  }
  return getLocalLeaderboard();
}

export async function fetchGlobalBestFromServer(): Promise<number> {
  try {
    const board = await fetchGlobalLeaderboard();
    if (board.length > 0) {
      return board[0].score;
    }
  } catch {
    // ignore
  }
  return getGlobalBestScore();
}

// ---- Daily challenge ----
function pickChallengeForDate(key: string) {
  // Deterministic pseudo-random pick based on the date string so every
  // player sees the same challenge on the same day without a server.
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return DAILY_CHALLENGE_POOL[hash % DAILY_CHALLENGE_POOL.length];
}

export function getDailyChallenge(): DailyChallengeState {
  const today = dateKey();
  const stored = readJSON<DailyChallengeState | null>(STORAGE_KEYS.dailyChallenge, null);
  if (stored && stored.dateKey === today) return stored;
  const fresh: DailyChallengeState = {
    dateKey: today,
    challenge: pickChallengeForDate(today),
    progress: 0,
    completed: false,
  };
  writeJSON(STORAGE_KEYS.dailyChallenge, fresh);
  return fresh;
}

export function updateDailyChallengeProgress(metric: 'score' | 'coins' | 'hardMode', value: number): {
  state: DailyChallengeState;
  justCompleted: boolean;
} {
  const state = getDailyChallenge();
  if (state.completed || state.challenge.metric !== metric) {
    return { state, justCompleted: false };
  }
  const progress = metric === 'coins' ? state.progress + value : Math.max(state.progress, value);
  const completed = progress >= state.challenge.target;
  const next: DailyChallengeState = { ...state, progress, completed };
  writeJSON(STORAGE_KEYS.dailyChallenge, next);
  return { state: next, justCompleted: completed };
}

// ---- Daily Rewards (7-day cycle) ----
// Rewards cycle: Day 1-7 then loop
// Uses dateKey for calendar day check. Safe reset on corruption.

const DAILY_REWARDS: Array<{ day: number; type: 'coins' | ShopItemId; amount: number; label: string }> = [
  { day: 1, type: 'coins', amount: 10, label: '10 Coins' },
  { day: 2, type: 'coins', amount: 15, label: '15 Coins' },
  { day: 3, type: 'shield', amount: 1, label: 'Shield' },
  { day: 4, type: 'coins', amount: 25, label: '25 Coins' },
  { day: 5, type: 'magnet', amount: 1, label: 'Coin Magnet' },
  { day: 6, type: 'gemBoost', amount: 1, label: 'Gem Boost' },
  { day: 7, type: 'continueToken', amount: 1, label: 'Continue Token' },
];

const DEFAULT_DAILY_REWARD: DailyRewardState = { lastClaimDate: '', streakDay: 1 };
const dailyRewardStore = createStore<DailyRewardState>(STORAGE_KEYS.dailyReward, DEFAULT_DAILY_REWARD);

export function getDailyRewardState(): DailyRewardState {
  return dailyRewardStore.get();
}

export function canClaimDailyReward(): boolean {
  const state = getDailyRewardState();
  const today = dateKey();
  return state.lastClaimDate !== today;
}

export function getCurrentDailyReward(): { day: number; label: string; type: string; amount: number } {
  const state = getDailyRewardState();
  const day = ((state.streakDay - 1) % 7) + 1;
  const reward = DAILY_REWARDS.find((r) => r.day === day) || DAILY_REWARDS[0];
  return { day, label: reward.label, type: reward.type, amount: reward.amount };
}

export function claimDailyReward(): { success: boolean; day: number; label: string; message: string } {
  if (!canClaimDailyReward()) {
    return { success: false, day: 0, label: '', message: 'Already claimed today' };
  }

  const today = dateKey();
  const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const state = getDailyRewardState();
  let newStreak = 1;
  if (state.lastClaimDate === yesterday) {
    newStreak = state.streakDay + 1;
    if (newStreak > 7) newStreak = 1;
  }

  const day = ((state.streakDay - 1) % 7) + 1; // reward for current streak position
  const rewardDef = DAILY_REWARDS.find((r) => r.day === day) || DAILY_REWARDS[0];

  let message = '';

  if (rewardDef.type === 'coins') {
    addCoins(rewardDef.amount);
    message = `+${rewardDef.amount} Coins added!`;
  } else {
    const itemId = rewardDef.type as ShopItemId;
    addShopItem(itemId, rewardDef.amount);
    const itemName = rewardDef.label;
    message = `${itemName} added to your inventory!`;
  }

  const newState: DailyRewardState = {
    lastClaimDate: today,
    streakDay: newStreak,
  };
  dailyRewardStore.set(newState);

  return {
    success: true,
    day,
    label: rewardDef.label,
    message,
  };
}
