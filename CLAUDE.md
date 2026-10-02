# OGL

Open Game Launcher: an Electron app (electron-vite, React, TypeScript) that installs, updates and launches open-source games from the catalog in `catalog/games`.

GitHub repository: `fabianfreund/OpenGameLuncher`. `ogl.config.json` names the same repository; the packaged app reads its catalog and its own updates from there.

## Commands

```bash
npm run dev          # the app, reading the catalog from this checkout
npx vite src/renderer   # UI only, in a browser, with mock data from src/renderer/dev-mock.ts
npm test
npm run typecheck
```

## Releasing

Read [docs/releasing.md](docs/releasing.md) before touching a release. In short:

- Work for a version happens on a `release/X.Y.Z` branch. The branch name is the version; do not bump `package.json`.
- Pushing the branch builds a draft release. Merging it into `main` through a pull request publishes it.
- Publishing is public and cannot be redone for the same version. Ask before merging a release branch, and write release notes on the draft first.
- Small documentation changes can go straight to `main`; that does not trigger a release.

## Where things are

- `src/shared`: catalog rules, asset matching, types shared by both sides
- `src/main`: window, GitHub access, downloads, launching, self-update (`updater.ts`)
- `src/preload`: the bridge exposed as `window.ogl`
- `src/renderer`: the interface; `components/Logo.tsx` is the one logo, `components/Splash.tsx` the loading screen
- `docs/catalog.md`: how to add a game
- `AI-POLICY.md`: what is expected of AI-assisted contributions; disclose substantial AI use in pull requests
- `docs/mods.md`: mod browser; games with mods are listed in `src/shared/mods.ts`, sources are providers in `src/main/mods.ts`

A new call between the window and the main process touches four files: `src/shared/channels.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, plus the mock in `src/renderer/dev-mock.ts`.

## Checking UI changes

The browser preview (`npx vite src/renderer`) is the quickest way to look at a change. The loading screen only shows for about a second after load.
