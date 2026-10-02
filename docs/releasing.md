# Releasing OGL

OGL updates itself from the GitHub releases of the repository named in `ogl.config.json` (`fabianfreund/OpenGameLuncher`). Releases are built by [`.github/workflows/release.yml`](../.github/workflows/release.yml). The version comes from the branch name, so `package.json` is never bumped by hand; CI stamps it at build time.

## The short version

```bash
git switch main && git pull
git switch -c release/0.2.0        # the branch name is the version
# ...commit work...
git push -u origin release/0.2.0   # builds a draft release v0.2.0
gh pr create --base main --head release/0.2.0 --title "Release 0.2.0"
gh pr merge release/0.2.0 --merge  # rebuilds from main and publishes v0.2.0
```

## What each step does

| You do | The workflow does |
| --- | --- |
| Push to `release/X.Y.Z` | Builds macOS (Apple silicon and Intel), Windows and Linux, and uploads them to a **draft** release `vX.Y.Z`. A newer push cancels the build of an older one. |
| Merge `release/X.Y.Z` into `main` through a pull request | Rebuilds from `main`, then publishes `vX.Y.Z` and marks it latest. It only publishes after all three platforms built. |
| Push a `vX.Y.Z` tag | Builds and publishes that commit directly. Use this when there is no release branch to merge. |
| Run the workflow by hand (Actions tab) | Builds any ref as the version you type, as a draft unless you tick publish. |

Installed launchers only see published releases, so a draft is safe to download and test.

A branch name with a suffix, such as `release/0.3.0-beta.1`, is published as a pre-release. Only launchers that are already on a pre-release pick those up.

A published version cannot be rebuilt. If something is wrong, fix it in the next version.

## Before merging

1. Wait for the draft build of the last push to finish. All three `build` jobs must be green:

   ```bash
   gh run list --workflow release.yml --branch release/0.2.0 --limit 1
   ```

2. Write the release notes on the draft. Notes that exist on the draft are kept when it is published; an empty draft gets GitHub's generated notes, which only list the pull request.

   ```bash
   gh release edit v0.2.0 --notes "..."
   ```

   Use the shape of the earlier releases: what is new, what changed, a download table per system, and a link to the install steps in the README.

3. To check the Mac build, download a zip from the draft and verify the signature:

   ```bash
   gh release download v0.2.0 -p 'OGL-0.2.0-arm64-mac.zip'
   ditto -x -k OGL-0.2.0-arm64-mac.zip out && codesign --verify --deep --strict out/OGL.app
   ```

## After merging

```bash
gh run list --workflow release.yml --event pull_request --limit 1   # the publish run
gh release list                                                     # the new version should say Latest
```

The publish run waits for a draft build of the same branch that is still going, so it can sit in "pending" for a few minutes.

## Files in a release

| File | For |
| --- | --- |
| `OGL-X.Y.Z-arm64.dmg`, `OGL-X.Y.Z.dmg` | macOS installers (Apple silicon, Intel) |
| `OGL-Setup-X.Y.Z.exe` | Windows installer |
| `OGL-X.Y.Z.AppImage` | Linux |
| `*-mac.zip`, `*.blockmap`, `latest*.yml` | Read by the updater inside OGL. Never delete them from a release. |

## How updates reach players

OGL checks the latest published release when it starts and when the player presses the refresh button at the bottom of the sidebar. A newer version shows as a card in the sidebar, the same way a game download does.

- **Windows and Linux** download the update in the app and restart into it.
- **macOS** opens the release page instead, and the player replaces the app by hand. macOS only installs an update into an app signed with a Developer ID, and OGL does not have one yet.

Outside a packaged build (`npm run dev`, the browser preview) there is no update check. The preview uses a simulated update from `src/renderer/dev-mock.ts`.

## macOS signing

Without a certificate, the Mac build is ad-hoc signed. That is what makes it openable: an app with no signature at all is reported as "damaged" on Apple silicon. Players still have to allow it once under System Settings → Privacy & Security → **Open Anyway**.

To sign and notarize properly, which also turns on in-app updates on the Mac, add these repository secrets. The workflow already reads them:

- `CSC_LINK`: base64 of the Developer ID Application `.p12`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

Windows and Linux need no signing to update. Windows shows a SmartScreen warning on unsigned installers.

## Building locally

`npm run dist:mac`, `npm run dist:win` and `npm run dist:linux` build into `release/` without publishing. A full Mac build makes four files for two architectures and takes a long time; for a quick check build one target:

```bash
npm run build
npx electron-builder --config electron-builder.config.cjs --mac zip --arm64 --publish never
```

## Things that went wrong before

- **electron-builder ignored the config.** `electron-builder.config.cjs` is not a name it looks for, so it must be passed with `--config`. The npm scripts and the workflow do this.
- **"OGL is damaged and can't be opened".** The Mac build had no signature. Fixed by ad-hoc signing (`identity: '-'`) when there is no certificate.
- **The Mac job failed with "not a file".** Secrets that are not set arrive as empty strings, and electron-builder read the empty `CSC_LINK` as a certificate path. The config now deletes empty signing variables.
- **Two builds writing to one release.** The branch build and the publish build share a concurrency group, so they run one after the other.
- **Windows tried to sign with the Apple certificate.** `CSC_LINK` is read by every platform, so the workflow passes it to the Mac job only.
- **"MAC verification failed during PKCS12 import".** `CSC_KEY_PASSWORD` does not match the `.p12`. Set secrets one command at a time; pasting several `gh secret set` lines at once feeds the later lines into the first prompt.
- **Wrong repository.** `ogl.config.json`, the `origin` remote and the download link in the README must all name the same repository. The app reads its catalog and its updates from the one in `ogl.config.json`.
