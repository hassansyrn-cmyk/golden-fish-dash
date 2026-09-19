# MEMORY — Golden Fish Dash: Ocean Legends

Working notes for anyone (human or agent) continuing this project.

## Architecture decisions worth remembering

- **React/Canvas split is sacred.** `engine.ts` is framework-free simulation + rendering.
  React gets data via engine callbacks and a 100 ms HUD snapshot; never put per-frame state
  in React. Extending gameplay means extending `engine.ts` + an `ocean/*` data module.
- **Everything content-like is data in `src/game/ocean/`.** Chapters, patterns, characters,
  VFX emitters, bosses, modifiers are plain typed tables. Add content by adding rows, not
  branches. Patterns must go through `pickPattern` so difficulty/modifier gating stays honest.
- **Seeded determinism.** Gameplay uses only `state.rng` (never `Math.random()`). The QA demo
  (`?demo=1&seed=…`) and the reachability tests depend on this.
- **Fairness ladder is load-bearing.** Hit resolution order: Ember ward → companion sacrifice
  → extra life → death. Hazards always leave a lane (`sideLane` in patterns, `MIN_ROUTE`
  tested at 96 px). Don't tighten gaps; the design intent is capped speed + readable routes.
- **VFX colors mean things.** gold=reward/surge, cyan=safe/help, magenta=rare/lore,
  amber=danger, violet=abyss/boss. Reuse `VFX_COLORS`; don't invent ad-hoc colors for
  gameplay-communicating effects. Particles share a 260-item budget (`VFXPool`).
- **Audio is bus-based.** Route new sounds through `playTone(..., busName)`; collectible
  chimes use the shared `SCALE` so chains stay musical. Important cues call `duck()`.

## Save data (localStorage)

- Legacy keys (`gfr_*` from `constants.ts`) are untouched. Ocean Legends adds:
  `gfr_chapter_progress`, `gfr_lore_found`, `gfr_collection_totals`, `gfr_save_version` (=2).
- `migrateSave()` runs on boot and is idempotent. If you add keys, bump `SAVE_VERSION` and
  handle v2→v3 there. Never delete or rename existing keys without a migration.
- Settings gained optional fields (reducedMotion, reducedFlashes, highContrast,
  colorblindShapes, steerMode, masterVolume, musicVolume, sfxVolume) — all optional in the
  type so old saved settings objects still parse.

## i18n discipline

- Every player-visible string needs `en` **and** `ar` entries in `i18n.ts`. Screens use
  `dir={language === 'ar' ? 'rtl' : 'ltr'}`. Legacy skins translate via `skin.*` keys;
  the character cast uses `character.<id>.{name,ability,personality}` — both exist.
- Arabic was authored, not machine-dumped; keep the tone playful and concise.

## QA workflows

- Deterministic run: `?demo=1&seed=GFD-XXXXX&skipLoading=1&debug=1` — autopilot flies,
  overlay shows FPS/entities/biome/pattern/boss. `window.__gfrEngine.current` exposes the
  live engine for browser automation (force score, surge, death).
- Tests: `pnpm test` (vitest). The pattern reachability test builds every pattern across
  seeds/difficulties and asserts a ≥96 px corridor — if you add a pattern, this test is the
  gate; a failure means your pattern seals the route.
- Verify `pnpm typecheck` + `pnpm build` before pushing. `noUnusedLocals` is on.

## Known quirks / future gotchas

- Score can jump several thresholds at once (chest +25, lore +3, boss payouts) — chapter
  transitions therefore run every frame and set pieces queue per chapter. Banners can overlap
  if many thresholds cross in one frame (mostly visible only in debug score-forcing).
- The demo pilot targets the nearest gate and picks the stacked opening closest to its
  altitude; it is intentionally decent, not perfect. Seeds with harsh early patterns may
  still end runs quickly.
- `getDifficultyTier` in `constants.ts` (menu color tiers) is independent of the chapter
  system; it colors the menu, not the world.
- Capacitor Android: audio starts only after a user gesture (context resume on first input);
  haptics go through `navigator.vibrate` guarded by settings.
