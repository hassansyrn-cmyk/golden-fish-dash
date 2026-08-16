# Boss Summon Asset Research

## Selected source

The selected source is [`rapidpunches/ocean`](https://github.com/rapidpunches/ocean), a public repository of marine game artwork. Its included `LICENSE` specifies **Creative Commons Attribution 4.0 International (CC BY 4.0)**. The README states that the work is free to use and requests credit. The game will therefore retain an in-project attribution record.

| Intended summon | Candidate source asset | Boss stage |
|---|---|---:|
| Reef shark | `png-sprites/shark-blue-swimming-*.png` | 100 |
| Moon jellyfish | `svg-sprites/32bit-moon-jellyfish*.svg` | 200 |
| Anglerfish | `svg-sprites/fish-angler*.svg` | 300 |
| Hammerhead shark | `svg-sprites/32bit-shark-hammerhead*.svg` | 400 |
| Reef squid | `svg-sprites/8bit-squid*.svg` | 500 |

The repository also includes its own ready-made jellyfish, anglerfish, squid, octopus, reef, shark, and hammerhead artwork. This is a more suitable path than the current code-drawn geometry, so image generation is not required for this change.

## Attribution

> Marine summon sprite artwork derived from `rapidpunches/ocean`, licensed under CC BY 4.0. Source: https://github.com/rapidpunches/ocean

## Visual screening

The selected reef shark is a small transparent sprite with a readable complete silhouette. The moon jellyfish is a ready-made transparent SVG creature with a clear bell-and-tentacle silhouette. Both are appropriate replacements for the previous geometry-based summons.

The local Stage 200 preview loaded successfully after the ready screen with the new asset paths present in the development bundle. Combat-frame verification follows.

Stage 200 visual verification confirmed that the camera now pulls back during the boss fight and creates a visibly larger fish-to-boss separation. The first 0.80 scale was intentionally refined to 0.88 after inspection so the view remains spacious without making the fish and boss too small.

After restarting the local server, the Stage 200 preview loaded normally again. The final combat capture is continuing from a fresh run.

The first summon capture ended in the continuation overlay before the intended frame, so the local `bossPreview` path is being made permanently invulnerable for deterministic visual-only checks. This development-only behavior does not affect release gameplay.

The Stage 200 preview now starts with the development-only invulnerability active, allowing the summon sequence to be inspected without a premature game-over interruption.

The automated preview elapsed beyond the full boss encounter before the browser captured a frame. The development-only preview is therefore being extended to keep the boss in battle state long enough for deterministic summon screenshots; release timing remains unchanged.

Stage 200 visual verification passed. The encounter shows multiple imported moon-jellyfish sprites with clear bell-and-tentacle silhouettes rather than geometric substitute shapes. The calibrated 0.88 camera scale visibly increases the fish-to-boss space while retaining a readable boss size.
