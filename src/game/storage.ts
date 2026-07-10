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
  LeaderboardEntry,
  Settings,
  SkinId,
  ShopInventory,
  ShopItemId,
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

// ---- Personal best ----
export function getPersonalBest(): number {
  return readJSON(STORAGE_KEYS.personalBest, 0);
}
export function setPersonalBest(score: number) {
  writeJSON(STORAGE_KEYS.personalBest, score);
}
export function resetPersonalBest() {
  writeJSON(STORAGE_KEYS.personalBest, 0);
}

// ---- Coins ----
export function getCoins(): number {
  return readJSON(STORAGE_KEYS.coins, 0);
}
export function addCoins(amount: number): number {
  const total = getCoins() + amount;
  writeJSON(STORAGE_KEYS.coins, total);
  return total;
}
export function spendCoins(amount: number): number {
  const current = getCoins();
  const newTotal = Math.max(0, current - Math.max(0, amount));
  writeJSON(STORAGE_KEYS.coins, newTotal);
  return newTotal;
}

// ---- Skins ----
export function getUnlockedSkins(): SkinId[] {
  return readJSON<SkinId[]>(STORAGE_KEYS.unlockedSkins, ['golden']);
}
export function getSelectedSkin(): SkinId {
  return readJSON<SkinId>(STORAGE_KEYS.selectedSkin, 'golden');
}
export function setSelectedSkin(skin: SkinId) {
  writeJSON(STORAGE_KEYS.selectedSkin, skin);
}
export function refreshUnlockedSkins(bestScore: number): SkinId[] {
  const unlocked = new Set(getUnlockedSkins());
  for (const skin of SKINS) {
    if (bestScore >= skin.unlockScore) unlocked.add(skin.id);
  }
  const result = Array.from(unlocked);
  writeJSON(STORAGE_KEYS.unlockedSkins, result);
  return result;
}

// ---- Achievements ----
export function getUnlockedAchievements(): string[] {
  return readJSON<string[]>(STORAGE_KEYS.achievements, []);
}
export function unlockAchievement(id: string): boolean {
  const unlocked = new Set(getUnlockedAchievements());
  if (unlocked.has(id)) return false;
  unlocked.add(id);
  writeJSON(STORAGE_KEYS.achievements, Array.from(unlocked));
  return true;
}
export function getAllAchievements() {
  const unlocked = new Set(getUnlockedAchievements());
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlocked.has(a.id) }));
}

// ---- Rounds played / second chance tracking ----
export function getRoundsPlayed(): number {
  return readJSON(STORAGE_KEYS.roundsPlayed, 0);
}
export function incrementRoundsPlayed(): number {
  const total = getRoundsPlayed() + 1;
  writeJSON(STORAGE_KEYS.roundsPlayed, total);
  return total;
}
export function hasUsedSecondChanceEver(): boolean {
  return readJSON(STORAGE_KEYS.usedSecondChanceEver, false);
}
export function markUsedSecondChanceEver() {
  writeJSON(STORAGE_KEYS.usedSecondChanceEver, true);
}

// ---- Interstitial ad cadence ----
export function getGameOverCount(): number {
  return readJSON(STORAGE_KEYS.gameOverCount, 0);
}
export function incrementGameOverCount(): number {
  const total = getGameOverCount() + 1;
  writeJSON(STORAGE_KEYS.gameOverCount, total);
  return total;
}

// ---- Settings ----
const DEFAULT_SETTINGS: Settings = { sound: true, music: true, vibration: true };
export function getSettings(): Settings {
  return readJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}
export function setSettings(settings: Settings) {
  writeJSON(STORAGE_KEYS.settings, settings);
}

// ---- Shop Inventory ----
const DEFAULT_SHOP_INVENTORY: ShopInventory = {
  shield: 0,
  magnet: 0,
  gemBoost: 0,
  continueToken: 0,
};

export function getShopInventory(): ShopInventory {
  return readJSON<ShopInventory>(STORAGE_KEYS.shopInventory, DEFAULT_SHOP_INVENTORY);
}

function saveShopInventory(inventory: ShopInventory) {
  writeJSON(STORAGE_KEYS.shopInventory, inventory);
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
