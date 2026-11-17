# Immersive Archive V2 — Frontend

Entry point: `src/App.js` → `src/pages/ReelStudio.jsx`. This application is an archive-only interactive exhibition, not a 60-second movie.

## Cinematic intro
- `src/reel/apertureTimeline.js` — pure timing, camera path and per-artwork reveal functions.
- `src/reel/apertureSequence.js` — iris geometry, blue light shader and forming particles.
- `src/reel/archiveEngine.js` — runs the intro and interactive archive in the **same scene and renderer**.
- `src/reel/explore.js` — smoothly forms the original gallery positions as the camera flies in.
- `src/components/ui/portal-intro.tsx` — preloading-only curtain, skip control and visit-aware UI.

First entry: 3.25 s once assets have loaded; subsequent entries: 1.35 s; reduced motion: static archive without the camera flight. There is no skip-intro button or keyboard shortcut. Works and video originals remain unchanged.

The older `dither-flow.tsx` and `bloim-animation-background.tsx` files remain available for reference but are no longer loaded at runtime.

## Verification
```bash
yarn install
yarn test:ci
yarn build
```

GitHub Actions: `.github/workflows/archive-quality.yml` at the repository root. The production app is deployed from `main` to https://showreel-kutuzov-v2-kutuzov.vercel.app.

## Contextual archive navigation
- `src/reel/archiveExperience.js`: deterministic relationships, restrained orbit, depth visibility, preview eligibility and tile positions.
- `src/reel/spatialAccents.js`: occluded, short relationship lines and a soft light halo behind the work; original image shader colors remain unchanged.
- `src/reel/livingFrames.js`: up to one muted 3D video preview at once; disabled on touch devices, reduced-motion preference and data-saving connections.
- `src/reel/explore.js`: exact pointer-up raycast, touch tolerance, frozen view snapshot while a work is open, and light/depth updates.
- `src/components/reel/ExploreOverlay.jsx`: compact atlas-backed discovery rail and controlled project/category transitions.
- `scripts/archive-smoke.cjs`: live Chromium desktop/mobile smoke check against the compiled archive.
