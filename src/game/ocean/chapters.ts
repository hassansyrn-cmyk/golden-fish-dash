// -----------------------------------------------------------------------
// Ocean Legends chapter model.
// Eight authored chapters replace flat score bands. Each chapter owns its
// gameplay identity, environment sub-themes, pattern difficulty curve,
// lore fragments, mission set and a set-piece finale (boss or spectacle).
// -----------------------------------------------------------------------

import type { EnvironmentId } from './environmentTheme';

export type SetPieceKind = 'guardian' | 'leviathan' | 'crownFinale' | 'spectacle';

export interface LoreFragment {
  id: string;
  /** i18n key: `lore.<id>` */
  titleKey: string;
  textKey: string;
}

export interface ChapterMission {
  id: string;
  /** i18n key: `chapterMission.<id>` */
  descriptionKey: string;
  metric: 'chapterScore' | 'surges' | 'rescues' | 'lore' | 'barriers' | 'plankton' | 'pearls';
  target: number;
  rewardCoins: number;
}

export interface ChapterDef {
  id: string;
  index: number; // 0-based
  nameKey: string;
  introKey: string;
  identityKey: string;
  /** Score at which the chapter begins. */
  minScore: number;
  /** Environment sub-themes alternated within the chapter. */
  themeIds: EnvironmentId[];
  /** Base pattern difficulty weight curve 1..5 across the chapter. */
  difficultyRange: [number, number];
  /** Ambient + music identity passed to the audio buses. */
  audioTheme: 'lagoon' | 'coral' | 'kelp' | 'ruins' | 'vents' | 'crystal' | 'trench' | 'crown';
  /** Fog density 0..1 and dominant accent for lighting behavior. */
  lighting: { fog: number; accent: string; dark: boolean };
  /** Set-piece that closes the chapter, triggered at maxScore. */
  setPiece: { kind: SetPieceKind; atScore: number; nameKey: string };
  lore: LoreFragment[];
  missions: ChapterMission[];
}

const LORE_POOL: LoreFragment[] = [
  { id: 'tide-heart', titleKey: 'lore.tideHeart.title', textKey: 'lore.tideHeart.text' },
  { id: 'coral-vow', titleKey: 'lore.coralVow.title', textKey: 'lore.coralVow.text' },
  { id: 'kelp-whisper', titleKey: 'lore.kelpWhisper.title', textKey: 'lore.kelpWhisper.text' },
  { id: 'first-keystone', titleKey: 'lore.firstKeystone.title', textKey: 'lore.firstKeystone.text' },
  { id: 'ember-song', titleKey: 'lore.emberSong.title', textKey: 'lore.emberSong.text' },
  { id: 'prism-oath', titleKey: 'lore.prismOath.title', textKey: 'lore.prismOath.text' },
  { id: 'trench-lullaby', titleKey: 'lore.trenchLullaby.title', textKey: 'lore.trenchLullaby.text' },
  { id: 'crown-legend', titleKey: 'lore.crownLegend.title', textKey: 'lore.crownLegend.text' },
  { id: 'school-bond', titleKey: 'lore.schoolBond.title', textKey: 'lore.schoolBond.text' },
  { id: 'pearl-promise', titleKey: 'lore.pearlPromise.title', textKey: 'lore.pearlPromise.text' },
  { id: 'current-map', titleKey: 'lore.currentMap.title', textKey: 'lore.currentMap.text' },
  { id: 'guardian-gift', titleKey: 'lore.guardianGift.title', textKey: 'lore.guardianGift.text' },
];

const mkMissions = (chapterIndex: number): ChapterMission[] => [
  { id: `ch${chapterIndex}_reach`, descriptionKey: `chapterMission.ch${chapterIndex}_reach`, metric: 'chapterScore', target: 1, rewardCoins: 40 },
  { id: `ch${chapterIndex}_surge`, descriptionKey: `chapterMission.ch${chapterIndex}_surge`, metric: 'surges', target: 2, rewardCoins: 35 },
  { id: `ch${chapterIndex}_rescue`, descriptionKey: `chapterMission.ch${chapterIndex}_rescue`, metric: 'rescues', target: 3, rewardCoins: 35 },
];

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'sunlitLagoon', index: 0, nameKey: 'chapter.sunlitLagoon.name', introKey: 'chapter.sunlitLagoon.intro',
    identityKey: 'chapter.sunlitLagoon.identity', minScore: 0, themeIds: ['lagoon'],
    difficultyRange: [1, 2], audioTheme: 'lagoon',
    lighting: { fog: 0.05, accent: '#d8fbff', dark: false },
    setPiece: { kind: 'spectacle', atScore: 14, nameKey: 'setpiece.schoolHomecoming' },
    lore: [LORE_POOL[0], LORE_POOL[8]], missions: mkMissions(0),
  },
  {
    id: 'coralCarnival', index: 1, nameKey: 'chapter.coralCarnival.name', introKey: 'chapter.coralCarnival.intro',
    identityKey: 'chapter.coralCarnival.identity', minScore: 15, themeIds: ['coral'],
    difficultyRange: [1, 3], audioTheme: 'coral',
    lighting: { fog: 0.08, accent: '#ffd39a', dark: false },
    setPiece: { kind: 'guardian', atScore: 34, nameKey: 'setpiece.reefGuardian' },
    lore: [LORE_POOL[1], LORE_POOL[9]], missions: mkMissions(1),
  },
  {
    id: 'kelpLabyrinth', index: 2, nameKey: 'chapter.kelpLabyrinth.name', introKey: 'chapter.kelpLabyrinth.intro',
    identityKey: 'chapter.kelpLabyrinth.identity', minScore: 35, themeIds: ['kelp'],
    difficultyRange: [2, 3], audioTheme: 'kelp',
    lighting: { fog: 0.14, accent: '#c6ffba', dark: false },
    setPiece: { kind: 'spectacle', atScore: 58, nameKey: 'setpiece.kelpDance' },
    lore: [LORE_POOL[2], LORE_POOL[10]], missions: mkMissions(2),
  },
  {
    id: 'sunkenRuins', index: 3, nameKey: 'chapter.sunkenRuins.name', introKey: 'chapter.sunkenRuins.intro',
    identityKey: 'chapter.sunkenRuins.identity', minScore: 60, themeIds: ['ruins', 'sunkenCity', 'moonlit'],
    difficultyRange: [2, 4], audioTheme: 'ruins',
    lighting: { fog: 0.18, accent: '#aeb6ff', dark: false },
    setPiece: { kind: 'leviathan', atScore: 92, nameKey: 'setpiece.trenchLeviathan' },
    lore: [LORE_POOL[3], LORE_POOL[11]], missions: mkMissions(3),
  },
  {
    id: 'emberVents', index: 4, nameKey: 'chapter.emberVents.name', introKey: 'chapter.emberVents.intro',
    identityKey: 'chapter.emberVents.identity', minScore: 95, themeIds: ['volcanic'],
    difficultyRange: [3, 4], audioTheme: 'vents',
    lighting: { fog: 0.16, accent: '#ffcb76', dark: false },
    setPiece: { kind: 'spectacle', atScore: 138, nameKey: 'setpiece.ventChorus' },
    lore: [LORE_POOL[4]], missions: mkMissions(4),
  },
  {
    id: 'crystalGrotto', index: 5, nameKey: 'chapter.crystalGrotto.name', introKey: 'chapter.crystalGrotto.intro',
    identityKey: 'chapter.crystalGrotto.identity', minScore: 140, themeIds: ['crystal', 'temple'],
    difficultyRange: [3, 4], audioTheme: 'crystal',
    lighting: { fog: 0.12, accent: '#a8ffff', dark: false },
    setPiece: { kind: 'guardian', atScore: 195, nameKey: 'setpiece.reefGuardian' },
    lore: [LORE_POOL[5]], missions: mkMissions(5),
  },
  {
    id: 'auroraTrench', index: 6, nameKey: 'chapter.auroraTrench.name', introKey: 'chapter.auroraTrench.intro',
    identityKey: 'chapter.auroraTrench.identity', minScore: 200, themeIds: ['aurora', 'abyss'],
    difficultyRange: [4, 5], audioTheme: 'trench',
    lighting: { fog: 0.3, accent: '#d7b9ff', dark: true },
    setPiece: { kind: 'leviathan', atScore: 295, nameKey: 'setpiece.trenchLeviathan' },
    lore: [LORE_POOL[6]], missions: mkMissions(6),
  },
  {
    id: 'crownReef', index: 7, nameKey: 'chapter.crownReef.name', introKey: 'chapter.crownReef.intro',
    identityKey: 'chapter.crownReef.identity', minScore: 300, themeIds: ['crownReef', 'eternalTemple'],
    difficultyRange: [4, 5], audioTheme: 'crown',
    lighting: { fog: 0.1, accent: '#ffe3a0', dark: false },
    setPiece: { kind: 'crownFinale', atScore: 420, nameKey: 'setpiece.crownFinale' },
    lore: [LORE_POOL[7]], missions: mkMissions(7),
  },
];

export function chapterForScore(score: number): ChapterDef {
  for (let i = CHAPTERS.length - 1; i >= 0; i -= 1) {
    if (score >= CHAPTERS[i].minScore) return CHAPTERS[i];
  }
  return CHAPTERS[0];
}

/** Difficulty weight for authored patterns inside a chapter (1..5). */
export function chapterDifficulty(chapter: ChapterDef, score: number): number {
  const next = CHAPTERS[chapter.index + 1];
  const span = (next ? next.minScore : chapter.setPiece.atScore + 1) - chapter.minScore;
  const t = Math.max(0, Math.min(1, (score - chapter.minScore) / Math.max(1, span)));
  const [from, to] = chapter.difficultyRange;
  return Math.min(5, Math.round(from + t * (to - from)));
}

export const TOTAL_LORE_FRAGMENTS = LORE_POOL.length;
