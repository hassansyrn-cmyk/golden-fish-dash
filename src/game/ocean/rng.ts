// -----------------------------------------------------------------------
// Deterministic seeded randomness for Ocean Legends.
// Every run can be reproduced from its seed string, which powers the QA
// demo mode (`?demo=1&seed=...`) and reproducible bug reports.
// -----------------------------------------------------------------------

export type RunRandom = {
  /** Float in [0, 1). */
  next: () => number;
  /** Float in [min, max). */
  range: (min: number, max: number) => number;
  /** Integer in [min, max] inclusive. */
  int: (min: number, max: number) => number;
  /** True with probability p. */
  chance: (p: number) => boolean;
  /** Random element of an array. */
  pick: <T>(items: readonly T[]) => T;
  /** Weighted pick: items paired with relative weights. */
  weighted: <T>(entries: readonly (readonly [T, number])[]) => T;
  /** Signed offset. */
  spread: (amount: number) => number;
};

/** Fast 32-bit PRNG (mulberry32). Good enough for gameplay, tiny and seedable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash an arbitrary seed string into a 32-bit integer. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Create a bundle of helpers bound to one seeded stream. */
export function createRunRandom(seed: string | number): RunRandom {
  const raw = typeof seed === 'number' ? mulberry32(seed) : mulberry32(hashSeed(seed));
  const next = () => raw();
  return {
    next,
    range: (min, max) => min + raw() * (max - min),
    int: (min, max) => Math.floor(min + raw() * (max - min + 1)),
    chance: (p) => raw() < p,
    pick: <T,>(items: readonly T[]) => items[Math.floor(raw() * items.length)],
    weighted: <T,>(entries: readonly (readonly [T, number])[]) => {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = raw() * total;
      for (const [item, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return item;
      }
      return entries[entries.length - 1][0];
    },
    spread: (amount) => (raw() * 2 - 1) * amount,
  };
}

/** Generate a short human-friendly seed like "GFD-7K2QX". */
export function generateSeed(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `GFD-${out}`;
}

/** Parse a seed from URL query (?seed=GFD-7K2QX) with a safe fallback. */
export function seedFromQuery(search: string = typeof location !== 'undefined' ? location.search : ''): string | null {
  try {
    const value = new URLSearchParams(search).get('seed');
    return value && value.trim() ? value.trim().slice(0, 24) : null;
  } catch {
    return null;
  }
}
