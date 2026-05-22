# Elden Ring MapTap

A daily, Wordle-style geography game for the Lands Between. Each day you get **five
Sites of Grace**; tap where you think each one sits on the map of the Lands Between,
and score by how close you land. Share your result with friends.

Inspired by [maptap.gg](https://maptap.gg), re-skinned for Elden Ring.

## How it works

- **Five rounds, rising stakes.** Scores are quality 0–100 per round, multiplied
  `×1, ×1, ×2, ×3, ×3` → **1000 max**.
- **The hint fades.** Rounds 1–3 reveal the grace's region; rounds 4–5 give only the
  name.
- **Deterministic daily puzzle.** The five graces are chosen from the date with a
  seeded PRNG (`src/game/daily.ts`) — no database, no backend. Everyone playing on
  the same calendar day gets the same five, spanning five distinct regions.
- **Share string** with Elden Ring–flavored tiers
  (🌟 👑 ⚔️ 🛡️ 🩸 💀), e.g.

  ```
  Elden Ring MapTap · May 22
  95👑  88👑  80👑  87👑  25🩸
  Grace: 679/1000
  ```

## Stack

TanStack Start + React 19, Tailwind v4, Leaflet (flat 2D map via `CRS.Simple`),
Vitest. The map is the above-ground Lands Between only — no DLC, no underground.

## Develop

```bash
pnpm dev      # http://localhost:3000
pnpm test     # game-logic unit tests (vitest)
pnpm build    # production build (SSR)
```

## The grace data

`src/data/graces.json` holds **267 above-ground graces** with `{ id, name, region,
x, y }`, where `x`/`y` are normalized `0..1` over `public/map/lands-between.jpg`.

It is generated from a MapGenie-derived dump (`data-src/site-of-grace.ts`, from the
MIT-licensed [richiexuetang/interactive-game-maps](https://github.com/richiexuetang/interactive-game-maps))
by `scripts/build-graces.mjs`, which:

1. keeps only `mapSlug: "the-lands-between"` (drops the Shadow of the Erdtree DLC);
2. drops the open-world **underground** (`lat < 0.5`: Siofra, Ainsel, Nokron,
   Deeproot, Lake of Rot, …) and **Crumbling Farum Azula** (`lng > -0.55`);
3. assigns each grace a region via nearest labeled-anchor (KNN);
4. projects MapGenie lat/lng → normalized map pixels with a calibrated 6-param
   affine (fitted in `scripts/fit.mjs`, verified with `scripts/overlay.mjs`).

The base map image is ERDB's `lod_0.jpeg` (9728×9216), downscaled to a 4096px web
JPEG. The 18 MB original and large raw dumps are git-ignored under `data-src/`
(re-downloadable; see script headers).

To rebuild the data: `node scripts/build-graces.mjs`.
