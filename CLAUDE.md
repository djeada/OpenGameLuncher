# OGL

Open Game Launcher: an Electron app (electron-vite, React, TypeScript) that installs, updates and launches open-source games from the catalog in `catalog/games`.

GitHub repository: `fabianfreund/OpenSourceGameLauncher`, renamed from `OpenGameLuncher` on 3 October 2026. The packaged app reads its catalog and its own updates from the repository named in `ogl.config.json`. That file and every copy up to 0.1.7 still use the old name, which GitHub redirects; never create a repository called `OpenGameLuncher`, and change `ogl.config.json` in the next release.

## Commands

```bash
npm run dev          # the app, reading the catalog from this checkout
npx vite src/renderer   # UI only, in a browser, with mock data from src/renderer/dev-mock.ts
npm test
npm run typecheck
```

## How we work

Read [docs/workflow.md](docs/workflow.md) at the start of a session and [docs/releasing.md](docs/releasing.md) before touching a release. In short:

- Start from an up-to-date `main` with a clean tree. If there is an unexpected branch, stash or uncommitted file, find out what it is first.
- App changes go on a `release/X.Y.Z` branch. The branch name is the version; do not bump `package.json`. One version at a time.
- Documentation-only changes go straight to `main`; that does not trigger a release.
- Pushing a release branch builds a draft release. Merging it into `main` through a pull request publishes it.
- Publishing is public and cannot be redone for the same version. Ask before merging a release branch, and write release notes on the draft first.
- After publishing, delete the release branch on GitHub and locally. Tags (`vX.Y.Z`) keep the history.
- Mac builds are signed and notarized through repository secrets. Never ask to see a secret value.
- After a visible change, send a screenshot: `node scripts/preview-shot.mjs /tmp/shot.png` (see the workflow doc for options).
- Report what was verified and what was not.

## Where things are

- `src/shared`: catalog rules, asset matching, types shared by both sides
- `src/main`: window, GitHub access, downloads, launching, self-update (`updater.ts`)
- `src/preload`: the bridge exposed as `window.ogl`
- `src/renderer`: the interface; `components/Logo.tsx` is the one logo, `components/Splash.tsx` the loading screen
- `docs/catalog.md`: how to add a game
- `AI-POLICY.md`: what is expected of AI-assisted contributions; disclose substantial AI use in pull requests
- `docs/originals.md`: fetching the original game's files from Steam with SteamCMD; games are listed in `src/shared/originals.ts`, the work is in `src/main/originals.ts`
- `docs/mods.md`: mod browser; games with mods are listed in `src/shared/mods.ts`, sources are providers in `src/main/mods.ts`

A new call between the window and the main process touches four files: `src/shared/channels.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, plus the mock in `src/renderer/dev-mock.ts`.

## Checking UI changes

`npx vite src/renderer` runs the interface in a browser with mock data, and `scripts/preview-shot.mjs` takes screenshots of it. The loading screen only shows for about a second after load. The preview cannot show anything from `src/main`, such as the real update check; that needs a packaged build.
