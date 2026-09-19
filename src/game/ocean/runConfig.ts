// -----------------------------------------------------------------------
// Run configuration: modifiers, accessibility options, and the
// deterministic demo/QA mode driven by URL parameters.
// -----------------------------------------------------------------------

export type RunModifierId = 'mirrorCurrent' | 'treasureTide' | 'noBoost';

export interface RunModifierDef {
  id: RunModifierId;
  nameKey: string;
  descriptionKey: string;
  /** Coin reward multiplier granted for the added difficulty. */
  coinBonus: number;
}

export const RUN_MODIFIERS: RunModifierDef[] = [
  { id: 'mirrorCurrent', nameKey: 'modifier.mirrorCurrent.name', descriptionKey: 'modifier.mirrorCurrent.description', coinBonus: 0.25 },
  { id: 'treasureTide', nameKey: 'modifier.treasureTide.name', descriptionKey: 'modifier.treasureTide.description', coinBonus: 0 },
  { id: 'noBoost', nameKey: 'modifier.noBoost.name', descriptionKey: 'modifier.noBoost.description', coinBonus: 0.4 },
];

export type RunModifiers = RunModifierId[];

/** Accessibility & control options persisted alongside settings. */
export interface AccessibilityOptions {
  reducedMotion: boolean;
  reducedFlashes: boolean;
  highContrast: boolean;
  colorblindShapes: boolean;
  haptics: boolean;
  steerMode: boolean;
  masterVolume: number; // 0..1
  musicVolume: number;
  sfxVolume: number;
}

export const DEFAULT_ACCESSIBILITY: AccessibilityOptions = {
  reducedMotion: false,
  reducedFlashes: false,
  highContrast: false,
  colorblindShapes: false,
  haptics: true,
  steerMode: false,
  masterVolume: 1,
  musicVolume: 0.7,
  sfxVolume: 1,
};

/** Flags parsed once from the URL for QA / screenshots. */
export interface LaunchFlags {
  debug: boolean;
  demo: boolean;
  seed: string | null;
  reducedMotion: boolean;
  skipLoading: boolean;
}

export function parseLaunchFlags(search: string = typeof location !== 'undefined' ? location.search : ''): LaunchFlags {
  const get = (key: string) => {
    try {
      return new URLSearchParams(search).get(key);
    } catch {
      return null;
    }
  };
  return {
    debug: get('debug') === '1',
    demo: get('demo') === '1',
    seed: get('seed'),
    reducedMotion: get('reducedMotion') === '1',
    skipLoading: get('skipLoading') === '1',
  };
}
