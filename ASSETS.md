# Golden Fish Dash — Visual Character Upgrade

## Art direction

The upgraded game uses a **premium cartoon ocean-arcade** style: an expressive golden-and-turquoise hero fish against deep teal water, with high-contrast readable silhouettes, luminous bioluminescent enemy accents, and gameplay-safe effects. Shapes remain clean and broad so they are legible on a phone at speed.

## Character treatment

| Character | Visual identity | Motion treatment |
|---|---|---|
| Golden Fish | Rounded golden body, luminous turquoise stripes, glossy eye, flowing fins and a warm dash trail | Tail and fins undulate independently; body bobs subtly; an active dash produces bubbles and gold sparks. |
| Reef Shark | Blue-gray wedge silhouette, icy underside, warning-red eye and moving fin shape | Gentle swimming wave and a compact warning glow that does not obscure the route. |
| Jellyfish | Violet transparent bell, cyan core and trailing bioluminescent tentacles | Pulse-driven bell contraction with flowing tentacles around a fixed safe center. |
| Sea Mine | Dark metal sphere, amber danger core, rotating spikes and small bubbles | Slow rotating warning ring and a compact pulse, kept outside the designated safe lane. |

## Asset provenance

| Asset | Use | License / source |
|---|---|---|
| `cc0-stylized-water.jpg` | Water texture layered behind gameplay | CC0-1.0, [SpriteCook Free Game Assets](https://github.com/SpriteCook/spritecook-free-game-assets) |
| Character and enemy art | Canvas-native vector drawing in `src/game/engine.ts` | Original implementation in this project |

## Generation note

A visual reference was requested through the built-in image generator for this phase, but the free daily image-generation quota was exhausted. The character overhaul therefore uses original Canvas vector illustration and the existing CC0 water texture; no unverified third-party character sprites will be imported.

## Environment progression reference

**Visual target:** `/home/ubuntu/golden-fish-dash-reviews/environment-progression-visual-target.png`

**Direction:** A clear player route through hand-painted underwater environments that evolve from bright lagoon water to coral reef, kelp forest, twilight ruins, volcanic vents, and bioluminescent temple waters. Gate silhouettes stay simple and readable; the environment carries the color and material variation through coral, stone, vines, runes, and subtle light specks.

**Generation prompt:** Premium portrait 2D underwater arcade scene with a golden-and-turquoise player fish, cyan rune stone pillars, violet coral, deep cobalt water, distant ruins, and a visibly safe center corridor. Generated on 2026-08-15 for this branch.
