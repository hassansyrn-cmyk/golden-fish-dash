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
} from './types';

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
// Backend placeholder functions.
//
// TODO(backend): Replace the bodies below with real network calls once a
// server exists. Suggested REST contract:
//   POST /api/score            { name, score }  -> { rank }
//   GET  /api/leaderboard      -> LeaderboardEntry[] (top N)
//   GET  /api/global-best      -> { score }
//
// SECURITY NOTE: never trust a client-submitted score in production. The
// server must validate that a score is plausible (e.g. bounded by max
// possible score for elapsed play time) before accepting it, and ideally
// require a signed/session-scoped play token per run.
// -----------------------------------------------------------------------

export async function submitScoreToServer(playerName: string, score: number): Promise<{ rank: number }> {
  // TODO(backend): POST /api/score { name: playerName, score }
  // For now, fall back to the local leaderboard so the UI keeps working.
  addLocalLeaderboardEntry(playerName, score);
  return { rank: estimateGlobalRank(score) };
}

export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  // TODO(backend): GET /api/leaderboard, merge/replace local results.
  return getLocalLeaderboard();
}

export async function fetchGlobalBestFromServer(): Promise<number> {
  // TODO(backend): GET /api/global-best
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
