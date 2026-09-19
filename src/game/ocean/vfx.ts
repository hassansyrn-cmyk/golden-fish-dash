// -----------------------------------------------------------------------
// Ocean Legends VFX vocabulary.
// Colors encode gameplay meaning (never decoration):
//   gold   = reward / combo / growth / Golden Surge
//   cyan   = safe currents, shields, helpful interactions
//   magenta = rare treasure, lore, legendary content
//   amber  = danger, heat, mines, predators
//   violet = abyss, mystery, boss telegraphs
// All emitters are pooled/bounded with per-emitter caps and a global
// mobile budget so particles never hide the player or the next gate.
// -----------------------------------------------------------------------

export const VFX_COLORS = {
  gold: '#ffd60a',
  goldSoft: '#fff3a6',
  cyan: '#4ff0ff',
  cyanSoft: '#b8f7ff',
  magenta: '#ff5ec8',
  amber: '#ffb300',
  danger: '#ff5252',
  violet: '#b388ff',
  foam: 'rgba(255,255,255,0.85)',
} as const;

export type EmitterKind =
  | 'bubbleBurst' | 'foam' | 'planktonDust' | 'pearlGlitter' | 'coralShards'
  | 'electricArc' | 'heatAsh' | 'crystalShards' | 'biolumMotes' | 'surgeTrail'
  | 'shieldShatter' | 'currentStreak' | 'treasureBeam' | 'rescueSpark';

interface EmitterSpec {
  colors: string[];
  count: number;
  speed: number;
  life: number;
  size: number;
  gravity: number;
}

const EMITTERS: Record<EmitterKind, EmitterSpec> = {
  bubbleBurst: { colors: [VFX_COLORS.cyanSoft, VFX_COLORS.foam], count: 10, speed: 1.6, life: 30, size: 2.2, gravity: -0.02 },
  foam: { colors: [VFX_COLORS.foam], count: 6, speed: 1.1, life: 22, size: 1.8, gravity: -0.01 },
  planktonDust: { colors: [VFX_COLORS.goldSoft, VFX_COLORS.cyanSoft], count: 5, speed: 0.7, life: 40, size: 1.4, gravity: 0 },
  pearlGlitter: { colors: [VFX_COLORS.magenta, VFX_COLORS.goldSoft], count: 12, speed: 1.4, life: 34, size: 2, gravity: -0.015 },
  coralShards: { colors: [VFX_COLORS.amber, VFX_COLORS.danger], count: 14, speed: 2.6, life: 28, size: 2.6, gravity: 0.08 },
  electricArc: { colors: [VFX_COLORS.cyan, VFX_COLORS.violet], count: 12, speed: 3.0, life: 18, size: 1.8, gravity: 0 },
  heatAsh: { colors: [VFX_COLORS.amber, VFX_COLORS.danger], count: 7, speed: 1.2, life: 44, size: 1.5, gravity: -0.03 },
  crystalShards: { colors: [VFX_COLORS.cyanSoft, VFX_COLORS.foam], count: 12, speed: 2.4, life: 26, size: 2.4, gravity: 0.07 },
  biolumMotes: { colors: [VFX_COLORS.violet, VFX_COLORS.cyan], count: 5, speed: 0.5, life: 55, size: 1.6, gravity: -0.008 },
  surgeTrail: { colors: [VFX_COLORS.gold, VFX_COLORS.goldSoft], count: 3, speed: 0.9, life: 26, size: 2.2, gravity: -0.01 },
  shieldShatter: { colors: [VFX_COLORS.cyan, VFX_COLORS.foam], count: 18, speed: 2.8, life: 24, size: 2.4, gravity: 0.04 },
  currentStreak: { colors: [VFX_COLORS.cyanSoft], count: 4, speed: 2.2, life: 20, size: 1.6, gravity: 0 },
  treasureBeam: { colors: [VFX_COLORS.gold, VFX_COLORS.magenta], count: 16, speed: 1.8, life: 36, size: 2.4, gravity: -0.02 },
  rescueSpark: { colors: [VFX_COLORS.cyan, VFX_COLORS.goldSoft], count: 9, speed: 1.5, life: 26, size: 1.9, gravity: -0.015 },
};

export interface VFXParticle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number; gravity?: number;
}

export const GLOBAL_PARTICLE_BUDGET = 260;

/**
 * Pooled emitter helper. Keeps arrays bounded: when `spawn` returns null the
 * budget or the per-emitter cap was hit (mobile performance protection).
 */
export class VFXPool {
  private counts = new Map<EmitterKind, number>();
  private lastTrim = 0;

  /** Spawn one emitter's worth of particles into the shared engine array. */
  emit(
    kind: EmitterKind,
    particles: VFXParticle[],
    x: number,
    y: number,
    opts: { scale?: number; now?: number; budget?: number } = {},
  ) {
    const spec = EMITTERS[kind];
    const scale = opts.scale ?? 1;
    const budget = opts.budget ?? GLOBAL_PARTICLE_BUDGET;
    if (particles.length >= budget) return 0;

    const perEmitterCap = Math.ceil(budget * 0.16);
    const active = (this.counts.get(kind) ?? 0) + 1;
    if (active > perEmitterCap) return 0;
    this.counts.set(kind, active);

    const count = Math.max(2, Math.round(spec.count * scale));
    let spawned = 0;
    for (let i = 0; i < count && particles.length < budget; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const speed = spec.speed * (0.6 + Math.random() * 0.8) * scale;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: spec.life * (0.7 + Math.random() * 0.6),
        color: spec.colors[Math.floor(Math.random() * spec.colors.length)],
        size: spec.size * (0.7 + Math.random() * 0.6),
        gravity: spec.gravity,
      });
      spawned++;
    }
    return spawned;
  }

  /** Called once per step so per-emitter counters decay naturally. */
  tick(now: number) {
    if (now - this.lastTrim > 1000) {
      this.counts.clear();
      this.lastTrim = now;
    }
  }

  static update(particles: VFXParticle[], dt: number) {
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity ?? 0.05) * dt; // legacy burst particles sink slightly
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life >= particles[i].maxLife) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
      }
    }
  }
}
