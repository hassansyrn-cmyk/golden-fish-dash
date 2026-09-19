# Golden Fish Dash: Ocean Legends — PLAN

> Status: **implemented** on branch `ocean-legends`. This document records the upgrade plan,
> what was delivered, and what remains as future work.

## Vision

Turn the existing one-touch flappy-runner into a sequel-grade underwater arcade:
**"A tiny golden fish becomes the legendary guardian of the ocean."** The run itself tells a
story through authored routes, animated characters, chapter-specific mechanics, set pieces,
and a recognizable audiovisual signature — while preserving the original's fairness
(generous opening, capped speed, reserved hazard lanes, smaller-than-art hitbox) and its
React + Canvas engine separation.

## Non-negotiables (preserved)

- One-button tap/click/space control is still the default; steering is opt-in.
- React owns screens/HUD; per-frame simulation stays in `src/game/engine.ts` (no React state in the loop).
- English/Arabic localization and RTL layout for **all** new content.
- Every existing feature (shop, skins, daily rewards, lucky spin, achievements, missions,
  XP/levels, Firebase leaderboard, AdMob + fallbacks) keeps working.
- Existing save data keys are untouched; Ocean Legends storage is purely additive with a
  versioned migration (`migrateSave()`).
- Mobile + desktop, 60 FPS target, graceful degradation.

## Delivered slices (in implementation order)

### 1. Foundation (data-driven core)

| System | File | Notes |
| --- | --- | --- |
| Seeded RNG | `src/game/ocean/rng.ts` | mulberry32 + string hashing; every run reproducible via `?seed=` |
| Chapter model | `src/game/ocean/chapters.ts` | 8 authored chapters: identity, themes, difficulty curve, lore, missions, set piece |
| Pattern library | `src/game/ocean/patterns.ts` | 33 authored obstacle patterns, difficulty/chapter/modifier-weighted selection |
| Character cast | `src/game/ocean/characters.ts` | 8 characters (incl. 3 new: Mako, Ember, Nyx) with data-driven abilities |
| VFX language | `src/game/ocean/vfx.ts` | Meaning-coded palette (gold/cyan/magenta/amber/violet), 14 pooled emitters, global budget |
| Run systems | `src/game/ocean/systems.ts` | Combo chains, Golden Surge, school, collect-and-grow |
| Bosses | `src/game/ocean/bosses.ts` | Guardian / Leviathan / Crown finale + chapter spectacle finales |
| Run config | `src/game/ocean/runConfig.ts` | 3 run modifiers, accessibility options, `?debug`/`?demo` flags |

### 2. Engine integration (`src/game/engine.ts`)

- Pattern-driven spawning replaces per-gate spawns (seeded, chapter-aware, repeat-guarded).
- Combo chain unifies coins, plankton, pearls, near-misses, rescues; big tier feedback.
- Golden Surge: sun pearls charge the meter; surge doubles score, attracts collectibles,
  shatters coral barriers, golden fish form + vignette + speed lines + music layer.
- Companion school: rescue fish that orbit, grant +8%/fish score bonus, absorb one hit each.
- Collect-and-grow: plankton grows the fish through 3 stages (visual scale + barrier breaking).
- Current zones: telegraphed up/down push bands (Mirror Current modifier flips them).
- Hazard ladder: Ember's one-time ward → companion sacrifice → extra life → death.
- Hit-stop (45–55 ms), reduced-motion/flash-safe shake and red flash.
- Per-frame chapter/set-piece transitions (score jumps from chests/lore can't skip a chapter).
- Rendering: character profiles (fin styles, eye size, crown dorsal, Nyx's lure), boss
  silhouettes (guardian manta, leviathan serpent, crown sea-dragon), all new entities,
  high-contrast outline mode, surge treatment.

### 3. Audio (`src/game/managers/AudioManager.ts`)

- Master bus → music / ambience / SFX / UI buses with persisted volumes.
- Per-chapter ambient beds (drone + LFO swell, silent fallback).
- Adaptive music sequencer: intro / explore / danger / surge / boss states, crossfaded.
- Material SFX: pearls, coral break, stone doors, eels, mine warning, rescue, treasure,
  combo tier, surge, boss roar/end, lore, currents, growth.
- Collectible chimes climb a pentatonic scale with micro-detune; important cues duck the mix.

### 4. UI / meta

- Simplified in-run HUD: lives, shields, school counter, score, combo meter, surge meter,
  set-piece objective, power-up timers, mini-challenge.
- Chapter Map screen: unlock nodes, replay medals (bronze/silver/gold/legend), run
  modifiers, per-chapter detail, Dive CTA.
- Character Gallery: portraits per fin-style, personality text, abilities, equip flow.
- Collection Book: lore fragments per chapter, lifetime totals, medal status.
- Post-run summary: best combo, surges, rescues, plankton, pearls, barriers, chapters,
  lore, medal improvements, run seed.
- Menu: home reef backdrop (kelp, bubbles, swimming fish), Dive CTA, new entries.
- Settings: reduced motion, reduced flashes, high contrast, colorblind markers,
  hold-to-steer mode (all persisted, engine-respected).

### 5. QA infrastructure

- Deterministic demo autopilot (`?demo=1&seed=GFD-XXXX&skipLoading=1&debug=1`).
- Debug overlay (`?debug=1`): FPS, entity counts, biome, pattern id, combo, surge, boss
  state, audio backend; `window.__gfrEngine` exposes live state for automation.
- 24 vitest unit tests (`pnpm test`): RNG determinism, combo/surge/growth rules, chapter
  integrity, boss payouts, character roster, and **pattern reachability** (every pattern ×
  seed × difficulty keeps a ≥96 px passable corridor and bounded entities).

## Verification performed

- `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` (24/24) ✅
- Browser QA at 390×844 and 1280×800: menu, dive prep, early/mid run, chapter transition,
  Guardian set piece, Golden Surge + barrier break, game over + summary, Arabic RTL menu,
  chapter map, gallery, collection book. Bugs found and fixed during QA:
  1. `?skipLoading=1` stuck on the loading screen.
  2. Demo pilot's jump logic was vertically inverted (canvas y grows downward).
  3. Legacy characters showed raw ability i18n keys in the gallery.

## Future work (not in this slice)

- Sprite-sheet art pass to replace procedural vector drawing (assets stay out of repo).
- Per-chapter recorded music stems instead of the synth sequencer.
- Chapter 5–8 unique mechanic gimmicks (crystal refractors, sonar pings) beyond pattern mixes.
- Weekly events; Play Games Services leaderboard swap for Firebase.
- More daily challenge types beyond the existing three metrics.
