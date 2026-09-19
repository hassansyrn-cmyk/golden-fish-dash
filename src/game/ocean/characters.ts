// -----------------------------------------------------------------------
// Ocean Legends character cast.
// Legacy skin ids (golden/ruby/emerald/diamond/legendary) stay valid so no
// save data ever breaks; each is now presented as an authored character.
// 'mako', 'ember' and 'nyx' are new heroes layered on the same system.
// -----------------------------------------------------------------------

import type { SkinId } from '../types';

export type CharacterAbility = {
  /** Multiplier applied to coins earned during a run. */
  coinMultiplier?: number;
  /** Multiplier applied to shield-driven invincibility windows. */
  shieldDurationMultiplier?: number;
  /** Multiplier applied to magnet duration. */
  magnetDurationMultiplier?: number;
  /** Multiplier applied to gem (extra life) spawn chance. */
  gemDropMultiplier?: number;
  /** Multiplier applied to Golden Surge charge rate. */
  surgeChargeMultiplier?: number;
  /** Multiplier applied to near-miss score rewards. */
  nearMissMultiplier?: number;
  /** Survive the first hazard hit of the run for free (once). */
  firstHazardWard?: boolean;
  /** Chance to begin the run with a free shield charge. */
  freeShieldChance?: number;
  /** Lucky spin discount, kept for the legacy Reef Regent. */
  luckySpinDiscount?: number;
};

export interface CharacterDef {
  id: SkinId;
  /** i18n keys: `character.<id>.name` / `.personality` / `.ability`. */
  nameKey: string;
  species: string;
  unlockScore: number;
  /** Distinguishing silhouette parameters consumed by the engine renderer. */
  profile: {
    /** 1 = classic round hero proportions. */
    bodyLength: number;
    bodyHeight: number;
    /** Fin style drives tail + dorsal rendering. */
    finStyle: 'flowing' | 'forked' | 'crescent' | 'spiked' | 'veil' | 'lure';
    /** Extra accent stripe color used by the renderer. */
    accent: string;
    eyeSize: number;
  };
  colors: { body: string; belly: string; fin: string; glow: string };
  ability: CharacterAbility;
  abilityLabelKey: string;
  personalityKey: string;
  /** Presentation group in the character gallery. */
  tier: 'hero' | 'legacy';
  /** Bubble trail tint used while swimming. */
  trailColor: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'golden',
    nameKey: 'character.golden.name',
    species: 'aurum',
    unlockScore: 0,
    profile: { bodyLength: 1, bodyHeight: 1, finStyle: 'forked', accent: '#2fe3e8', eyeSize: 1 },
    colors: { body: '#ff9f1c', belly: '#fff0c2', fin: '#ff7b00', glow: '#ffd166' },
    ability: { coinMultiplier: 1.1 },
    abilityLabelKey: 'character.golden.ability',
    personalityKey: 'character.golden.personality',
    tier: 'hero',
    trailColor: '#ffe9a8',
  },
  {
    id: 'ruby',
    nameKey: 'character.ruby.name',
    species: 'coral',
    unlockScore: 25,
    profile: { bodyLength: 1.02, bodyHeight: 0.98, finStyle: 'veil', accent: '#ffcc80', eyeSize: 1.05 },
    colors: { body: '#c1121f', belly: '#ffccd5', fin: '#780000', glow: '#ff4d6d' },
    ability: { shieldDurationMultiplier: 1.3 },
    abilityLabelKey: 'character.ruby.ability',
    personalityKey: 'character.ruby.personality',
    tier: 'hero',
    trailColor: '#ffd7dd',
  },
  {
    id: 'emerald',
    nameKey: 'character.emerald.name',
    species: 'mandarin',
    unlockScore: 50,
    profile: { bodyLength: 1, bodyHeight: 0.95, finStyle: 'flowing', accent: '#90e0ef', eyeSize: 1 },
    colors: { body: '#0077b6', belly: '#90e0ef', fin: '#00b4d8', glow: '#48cae4' },
    ability: { magnetDurationMultiplier: 1.25 },
    abilityLabelKey: 'character.emerald.ability',
    personalityKey: 'character.emerald.personality',
    tier: 'legacy',
    trailColor: '#b8f3ff',
  },
  {
    id: 'mako',
    nameKey: 'character.mako.name',
    species: 'mako',
    unlockScore: 75,
    profile: { bodyLength: 1.14, bodyHeight: 0.86, finStyle: 'crescent', accent: '#d0fffe', eyeSize: 0.95 },
    colors: { body: '#1155ff', belly: '#e8f7ff', fin: '#0b2fbf', glow: '#53e0ff' },
    ability: { nearMissMultiplier: 2, surgeChargeMultiplier: 1.1 },
    abilityLabelKey: 'character.mako.ability',
    personalityKey: 'character.mako.personality',
    tier: 'hero',
    trailColor: '#a9f1ff',
  },
  {
    id: 'diamond',
    nameKey: 'character.diamond.name',
    species: 'pearl',
    unlockScore: 100,
    profile: { bodyLength: 0.94, bodyHeight: 1.1, finStyle: 'veil', accent: '#b2ebf2', eyeSize: 1.08 },
    colors: { body: '#4cc9f0', belly: '#f0f9ff', fin: '#4361ee', glow: '#a5d8ff' },
    ability: { gemDropMultiplier: 1.3, magnetDurationMultiplier: 1.15 },
    abilityLabelKey: 'character.diamond.ability',
    personalityKey: 'character.diamond.personality',
    tier: 'hero',
    trailColor: '#e6fbff',
  },
  {
    id: 'ember',
    nameKey: 'character.ember.name',
    species: 'ember',
    unlockScore: 150,
    profile: { bodyLength: 1.05, bodyHeight: 1.02, finStyle: 'spiked', accent: '#ffb37c', eyeSize: 1 },
    colors: { body: '#e63946', belly: '#ffe0a3', fin: '#9d0208', glow: '#ffba08' },
    ability: { firstHazardWard: true },
    abilityLabelKey: 'character.ember.ability',
    personalityKey: 'character.ember.personality',
    tier: 'hero',
    trailColor: '#ffd9a0',
  },
  {
    id: 'nyx',
    nameKey: 'character.nyx.name',
    species: 'nyx',
    unlockScore: 300,
    profile: { bodyLength: 1.06, bodyHeight: 1.04, finStyle: 'lure', accent: '#b388ff', eyeSize: 1.12 },
    colors: { body: '#1b1035', belly: '#4a2f7a', fin: '#0d0620', glow: '#9d4edd' },
    ability: { surgeChargeMultiplier: 1.3 },
    abilityLabelKey: 'character.nyx.ability',
    personalityKey: 'character.nyx.personality',
    tier: 'hero',
    trailColor: '#c9a4ff',
  },
  {
    id: 'legendary',
    nameKey: 'character.legendary.name',
    species: 'reef-regent',
    unlockScore: 200,
    profile: { bodyLength: 1.08, bodyHeight: 0.98, finStyle: 'crescent', accent: '#ffe066', eyeSize: 1.02 },
    colors: { body: '#ffd60a', belly: '#fffbe6', fin: '#1a1a1a', glow: '#ffe066' },
    ability: { freeShieldChance: 0.15, luckySpinDiscount: 0.2 },
    abilityLabelKey: 'character.legendary.ability',
    personalityKey: 'character.legendary.personality',
    tier: 'legacy',
    trailColor: '#fff3b0',
  },
  {
    id: 'sapphire',
    nameKey: 'skin.sapphire.name',
    species: 'crown-koi',
    unlockScore: 350,
    profile: { bodyLength: 1.1, bodyHeight: 1.0, finStyle: 'veil', accent: '#80d8ff', eyeSize: 1.04 },
    colors: { body: '#1565c0', belly: '#e3f2fd', fin: '#00e5ff', glow: '#80d8ff' },
    ability: { coinMultiplier: 1.35, magnetDurationMultiplier: 1.4 },
    abilityLabelKey: 'skin.sapphire.ability',
    personalityKey: 'character.sapphire.personality',
    tier: 'hero',
    trailColor: '#b3e5fc',
  },
  {
    id: 'solar',
    nameKey: 'skin.solar.name',
    species: 'solar-lionfish',
    unlockScore: 650,
    profile: { bodyLength: 1.06, bodyHeight: 1.04, finStyle: 'spiked', accent: '#ffd54f', eyeSize: 1 },
    colors: { body: '#ff7043', belly: '#fff3e0', fin: '#ffd54f', glow: '#ffcc80' },
    ability: {},
    abilityLabelKey: 'skin.solar.ability',
    personalityKey: 'character.solar.personality',
    tier: 'hero',
    trailColor: '#ffe0b2',
  },
  {
    id: 'poseidonsHeir',
    nameKey: 'skin.poseidonsHeir.name',
    species: 'heir-of-the-deep',
    unlockScore: 1000,
    profile: { bodyLength: 1.12, bodyHeight: 1.02, finStyle: 'crescent', accent: '#ffd740', eyeSize: 1.06 },
    colors: { body: '#0d47a1', belly: '#e3f2fd', fin: '#00e5ff', glow: '#ffd740' },
    ability: { coinMultiplier: 1.5 },
    abilityLabelKey: 'skin.poseidonsHeir.ability',
    personalityKey: 'character.poseidonsHeir.personality',
    tier: 'hero',
    trailColor: '#b3e5fc',
  },
];

const byId = new Map(CHARACTERS.map((c) => [c.id, c] as const));

export function getCharacter(id: SkinId): CharacterDef {
  return byId.get(id) ?? CHARACTERS[0];
}

export function getCharacterAbility(id: SkinId): CharacterAbility {
  return getCharacter(id).ability;
}

/** Ordered gallery list: hero cast first, legacy characters after. */
export function getGalleryOrder(): CharacterDef[] {
  return [
    ...CHARACTERS.filter((c) => c.tier === 'hero'),
    ...CHARACTERS.filter((c) => c.tier === 'legacy'),
  ];
}
