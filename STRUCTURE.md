# STRUCTURE — Golden Fish Dash: Ocean Legends

```
golden-fish-dash/
├── PLAN.md / STRUCTURE.md / MEMORY.md / ASSETS.md / CHANGELOG.md
├── index.html                     # Vite entry
├── capacitor.config.json          # Android shell config
├── android/                       # Capacitor Android project (CI builds AAB)
├── public/
│   └── assets/                    # water texture, heart-drop.svg, icons, privacy.html
├── tests/
│   └── ocean-systems.test.ts      # 24 vitest unit + reachability tests (pnpm test)
└── src/
    ├── main.tsx / App.tsx         # React bootstrap, wouter shell
    ├── index.css                  # Tailwind 4 + all game styling (HUD, screens, banners, reef)
    └── game/
        ├── GoldenFishRush.tsx     # top-level screen router + HUD + banners + pointer input
        ├── useGameEngine.ts       # RAF loop, engine↔React bridge, callbacks, run summary
        ├── engine.ts              # ALL per-frame simulation + Canvas 2D rendering
        ├── constants.ts           # BASE tuning, SKINS (legacy), achievements, dailies
        ├── types.ts               # shared types (SkinId now has 8 heroes)
        ├── storage.ts             # localStorage layer + Ocean Legends additive keys + migration
        ├── i18n.ts                # EN/AR tables (incl. chapters, lore, characters, modifiers)
        ├── DebugOverlay.tsx       # ?debug=1 QA overlay
        ├── AdPlaceholders.tsx / Footer.tsx / firebaseLeaderboard.ts
        ├── managers/
        │   └── AudioManager.ts    # bus graph, ambience beds, adaptive music, material SFX
        ├── screens/
        │   ├── MainMenu.tsx           # + home reef, Dive CTA, map/gallery/collection entries
        │   ├── ChapterMapScreen.tsx   # NEW — chapters, medals, modifiers, Dive
        │   ├── CharacterGalleryScreen.tsx # NEW — roster, portraits, abilities
        │   ├── CollectionBookScreen.tsx   # NEW — lore, lifetime totals, medals
        │   ├── GameOverScreen.tsx     # + post-run run summary block
        │   ├── SettingsScreen.tsx     # + accessibility & steering options
        │   └── (Ready/Pause/HowTo/Shop/DailyRewards/LuckySpin/Leaderboard/Continue/Loading/…)
        └── ocean/                 # ← Ocean Legends data-driven core
            ├── rng.ts             # seeded PRNG (mulberry32), seed parsing
            ├── environmentTheme.ts# 13 environment palettes shared engine/UI
            ├── chapters.ts        # 8 chapters: identity, themes, lore, missions, set pieces
            ├── patterns.ts        # 33 authored patterns + weighted reachability-safe picker
            ├── characters.ts      # 8 characters, ability multipliers, fin-style profiles
            ├── systems.ts         # combo chain, Golden Surge, school, collect-and-grow
            ├── bosses.ts          # guardian / leviathan / crownFinale / spectacle states
            ├── vfx.ts             # VFX color language + pooled emitters + budget
            └── runConfig.ts       # modifiers, accessibility defaults, launch flags
```

## Data flow

1. `GoldenFishRush` mounts `useGameEngine` with skin, modifiers, demo flag.
2. `useGameEngine` owns the requestAnimationFrame loop; each frame calls
   `stepEngine(state, dt, callbacks, settings)` then `renderEngine(ctx, state)`.
   React state is only touched through throttled HUD snapshots (100 ms) and engine callbacks.
3. `engine.ts` spawns content exclusively through `ocean/patterns.ts` builders using the
   run's seeded RNG; chapters/characters/VFX/bosses are pure data modules under `ocean/`.
4. On death, `useGameEngine` folds the run into storage: personal best, XP, missions,
   dailies, chapter progress + medals, lore, lifetime totals → `RunSummary` for game over.

## Key invariants

- No `Math.random()` in gameplay simulation — only the seeded run RNG (visual-only ambience
  in the audio manager is exempt).
- Every pattern guarantees a passable corridor (tested ≥ 96 px) and keeps entities in bounds.
- All new user-facing strings exist in **both** `en` and `ar` tables; new screens set `dir`.
- New storage keys are additive; `migrateSave()` upgrades old saves without data loss.
