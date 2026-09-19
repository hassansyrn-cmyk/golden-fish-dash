# Changelog

## Ocean Legends (2026-09) — branch `ocean-legends`

A sequel-grade content and feel upgrade built on the original engine. Nothing was removed;
every addition is data-driven and localized (EN/AR).

### The run

- **8 authored chapters** (Sunlit Lagoon → Crown Reef) with intro cards, gameplay identity,
  environment sub-themes, lore fragments, missions, and a set-piece finale each.
- **33 authored obstacle patterns** with seeded procedural variation, difficulty gating per
  chapter, and tested reachability (a passable corridor is guaranteed and unit-tested).
- **Golden Surge**: collect sun pearls to become radiant — double score, collectible
  attraction, coral-barrier shattering, gold fish form, vignette + speed lines + music lift.
- **Combo chains**: coins, plankton, pearls, near-misses and rescues feed one meter with
  multipliers up to x5 and break feedback.
- **Companion school**: rescue fish ahead of you; they orbit, add +8% score each, and
  absorb one hit each before swimming away.
- **Collect-and-grow**: eat harmless plankton to grow through 3 stages; grown fish smash
  coral and read bigger on screen.
- **Current zones**: telegraphed up/down push bands with animated chevrons.
- **Set pieces**: The Reef Guardian (lane/current tests), The Trench Leviathan
  (darkness + sonar rhythm), Crown of the Ocean (3-phase finale) — nonviolent: collect
  exposed pearls, rescue creatures, survive the sweep. Chapter finale flurries for the
  other chapters.
- **New characters**: Mako (double near-miss score), Ember (survives the first hit each
  run), Nyx (+30% surge charge) — joining Aurum, Coral, Mandarin, Pearl and the Reef
  Regent, all with distinct silhouettes, personalities and profile cards.
- **Run modifiers**: Mirror Current (+25% coins), Treasure Tide, No-Boost Challenge (+40%).
- **Fairness preserved**: same generous opening, capped speed, reserved hazard lanes,
  smaller-than-art hitbox; hazards now also yield to companions/Ember's ward before lives.

### Feel

- Squash-and-stretch swimming, per-character fin animation, hit-stop on big impacts,
  eased camera shake, Golden Surge fullscreen treatment, meaning-coded VFX palette
  (gold/cyan/magenta/amber/violet) with pooled, budgeted emitters.
- New audio system: master/music/ambience/SFX/UI buses, per-chapter ambient beds,
  adaptive music states (explore/danger/surge/boss), material-specific SFX, musical-scale
  collectible chimes, ducking, silent fallback everywhere.
- Optional hold-to-steer control mode (tap still jumps).

### Meta

- **Chapter Map** with unlock nodes, replay medals (bronze/silver/gold/legend) and the
  three run modifiers behind a Dive CTA.
- **Character Gallery** with portraits, species, personality lines and abilities.
- **Collection Book** with 12 lore fragments and lifetime totals.
- **Post-run summary**: best combo, surges, rescues, plankton, pearls, barriers, chapters,
  lore, medals earned, run seed.
- Home-reef main menu; simplified in-run HUD (score, combo, surge, school, set-piece
  objective, power-ups).
- Accessibility: reduced motion, reduced flashes, high contrast, colorblind markers,
  haptic tiers, volume buses — all persisted.

### Engineering

- Save migration to v2 (additive keys only; old saves keep everything).
- Deterministic demo/QA mode: `?demo=1&seed=…&skipLoading=1&debug=1` with autopilot and
  debug overlay (FPS, entities, biome, pattern, boss, audio).
- 24 unit tests including automated pattern-reachability checks (`pnpm test`).
- typecheck ✅ build ✅ (CI unchanged; Android AAB workflow unaffected).

### Fixes during QA

- `?skipLoading=1` no longer sticks on the loading screen.
- Demo autopilot jump logic corrected (canvas y-axis inversion).
- Legacy character abilities now translate in the gallery.

## v1.0.0 (baseline)

Original Golden Fish Rush: one-touch flappy runner, 13 environment palettes, skins, shop,
daily rewards, lucky spin, achievements, missions, XP, Firebase leaderboard, AdMob
integration + fallbacks, EN/AR, Capacitor Android CI.
