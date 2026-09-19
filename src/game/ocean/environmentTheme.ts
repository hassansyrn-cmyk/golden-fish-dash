// -----------------------------------------------------------------------
// Environment themes shared by the engine, chapters and UI.
// Extracted from engine.ts so chapters/patterns/UI can reference palettes
// without importing the whole simulation.
// -----------------------------------------------------------------------

export type EnvironmentId =
  | 'lagoon' | 'coral' | 'kelp' | 'ruins' | 'volcanic' | 'temple' | 'abyss'
  | 'crystal' | 'moonlit' | 'sunkenCity' | 'aurora' | 'crownReef' | 'eternalTemple';

export interface EnvironmentTheme {
  id: EnvironmentId;
  minScore: number;
  label: string;
  top: string;
  mid: string;
  bottom: string;
  ray: string;
  pillarDark: string;
  pillarMid: string;
  pillarLight: string;
  cap: string;
  accent: string;
  speck: string;
}

export const ENVIRONMENTS: EnvironmentTheme[] = [
  { id: 'lagoon', minScore: 0, label: 'Sunlit Lagoon', top: '#35bce8', mid: '#087fb9', bottom: '#001b38', ray: '#d8fbff', pillarDark: '#0d716d', pillarMid: '#42d2ba', pillarLight: '#a4f5db', cap: '#62dccc', accent: '#d6fff7', speck: '#d8fbff' },
  { id: 'coral', minScore: 12, label: 'Coral Bloom', top: '#29a9d2', mid: '#146d9b', bottom: '#102b56', ray: '#b6f5ff', pillarDark: '#a84d65', pillarMid: '#ff8f7b', pillarLight: '#ffd0a6', cap: '#ffb37c', accent: '#ffd5b8', speck: '#ffd39a' },
  { id: 'kelp', minScore: 30, label: 'Kelp Canopy', top: '#287c78', mid: '#124f5b', bottom: '#06293b', ray: '#beffd0', pillarDark: '#236044', pillarMid: '#5ba853', pillarLight: '#b9df70', cap: '#8fcf68', accent: '#e6ff9a', speck: '#c6ffba' },
  { id: 'ruins', minScore: 55, label: 'Twilight Ruins', top: '#33468a', mid: '#172a68', bottom: '#080e30', ray: '#aeb6ff', pillarDark: '#252b69', pillarMid: '#5a56b0', pillarLight: '#8e9cff', cap: '#737ce8', accent: '#85f0ff', speck: '#c6d2ff' },
  { id: 'volcanic', minScore: 85, label: 'Ember Vents', top: '#4c3c72', mid: '#382346', bottom: '#180b22', ray: '#ffc0a1', pillarDark: '#3a2430', pillarMid: '#924550', pillarLight: '#ff845d', cap: '#e6634d', accent: '#ffcb76', speck: '#ffb25e' },
  { id: 'temple', minScore: 120, label: 'Bioluminescent Temple', top: '#163c77', mid: '#102452', bottom: '#05091d', ray: '#8cf6ff', pillarDark: '#18285b', pillarMid: '#265a82', pillarLight: '#4cf0e1', cap: '#4bd9dd', accent: '#7bfbff', speck: '#a6ffff' },
  { id: 'abyss', minScore: 170, label: 'Abyssal Current', top: '#1b2960', mid: '#111747', bottom: '#030414', ray: '#91a8ff', pillarDark: '#151a48', pillarMid: '#35408f', pillarLight: '#7386e4', cap: '#6576db', accent: '#aebdff', speck: '#849dff' },
  { id: 'crystal', minScore: 240, label: 'Crystal Grotto', top: '#1c6f88', mid: '#155064', bottom: '#071e3a', ray: '#a8ffff', pillarDark: '#194564', pillarMid: '#2c94ad', pillarLight: '#8affef', cap: '#64dacc', accent: '#c9ffff', speck: '#aafff4' },
  { id: 'moonlit', minScore: 330, label: 'Moonlit Tides', top: '#32447f', mid: '#252a65', bottom: '#0b1030', ray: '#edf0ff', pillarDark: '#293060', pillarMid: '#6870bb', pillarLight: '#bec5ff', cap: '#a5abed', accent: '#f0f2ff', speck: '#e0e4ff' },
  { id: 'sunkenCity', minScore: 460, label: 'Sunken City', top: '#17666e', mid: '#11474f', bottom: '#06242f', ray: '#b8fff0', pillarDark: '#1f504c', pillarMid: '#4e9b7b', pillarLight: '#b4d56b', cap: '#8ebf68', accent: '#e1ffac', speck: '#ccffbf' },
  { id: 'aurora', minScore: 650, label: 'Aurora Trench', top: '#25326e', mid: '#2b2162', bottom: '#100b2c', ray: '#d7b9ff', pillarDark: '#35215e', pillarMid: '#7c4aa1', pillarLight: '#ee8fe3', cap: '#c76fd1', accent: '#ffc5f3', speck: '#eeb6ff' },
  { id: 'crownReef', minScore: 850, label: 'Crown Reef', top: '#5c3b69', mid: '#69304f', bottom: '#210f2d', ray: '#ffe3a0', pillarDark: '#59303c', pillarMid: '#b15b58', pillarLight: '#ffc77b', cap: '#f49b62', accent: '#fff0b8', speck: '#ffd182' },
  { id: 'eternalTemple', minScore: 1000, label: 'Eternal Temple', top: '#162b72', mid: '#1a315f', bottom: '#050617', ray: '#b5fff6', pillarDark: '#163651', pillarMid: '#27738c', pillarLight: '#80fff0', cap: '#50d7cf', accent: '#d4fffb', speck: '#9cfff5' },
];

export function environmentById(id: EnvironmentId): EnvironmentTheme {
  return ENVIRONMENTS.find((item) => item.id === id) ?? ENVIRONMENTS[0];
}

export function environmentForScore(score: number): EnvironmentTheme {
  for (let index = ENVIRONMENTS.length - 1; index >= 0; index -= 1) {
    if (score >= ENVIRONMENTS[index].minScore) return ENVIRONMENTS[index];
  }
  return ENVIRONMENTS[0];
}
