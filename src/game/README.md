# Game Module Architecture (Phase 1+)

This folder is being refactored into a clean, scalable structure:

```
src/game/
├── engine/              # Core game loop, state, rendering
│   ├── index.ts
│   ├── core.ts          # (future) main engine
│   ├── physics.ts
│   ├── entities/        # Fish, Obstacles, PowerUps, Particles
│   ├── systems/         # Spawning, Collision, Progression, Particles
│   └── managers/        # PowerUp, Audio, Difficulty, Economy
├── screens/             # UI Screens (MainMenu, GameOver...)
├── useGameEngine.ts     # React hook bridge (kept thin)
├── GoldenFishRush.tsx   # Root orchestrator
├── storage.ts           # Persistence (will be modularized)
├── firebaseLeaderboard.ts
├── AdPlaceholders.tsx
├── Footer.tsx
└── constants.ts / types.ts (legacy - migrating to src/constants & src/types)
```

**Principles:**
- Game logic **never** imports React components.
- React only renders UI and bridges via hooks.
- Performance first: Object Pooling, minimal allocations in hot loop, stable callbacks.
- Incremental migration — existing gameplay preserved at every commit.
