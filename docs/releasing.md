# Releasing OGL

OGL updates itself from the GitHub releases of the repository named in `ogl.config.json` (`fabianfreund/OpenSourceGameLauncher`; the file still says `OpenGameLuncher` until the next release, which GitHub redirects). Releases are built by [`.github/workflows/release.yml`](../.github/workflows/release.yml). The version comes from the branch name, so `package.json` is never bumped by hand; CI stamps it at build time.

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

Then clean up. All history stays reachable through the tag.

```bash
git switch main && git pull --tags
git log main..origin/release/0.2.0        # must print nothing
git push origin --delete release/0.2.0
git branch -D release/0.2.0
```

## Publishing a draft without rebuilding

A draft that was built and checked can be published as it is, without a merge. This was done for 0.1.4, so that a signed version existed to test the updater from.

```bash
gh release edit v0.1.4 --draft=false --latest --target <commit the draft was built from> --notes "..."
```

This creates the tag, which starts one more workflow run. That run fails at the first step with "already published". It is harmless.

## Files in a release

| File | For |
| --- | --- |
| `OGL-X.Y.Z-arm64.dmg`, `OGL-X.Y.Z.dmg` | macOS installers (Apple silicon, Intel) |
| `OGL-Setup-X.Y.Z.exe` | Windows installer |
| `OGL-X.Y.Z.AppImage` | Linux |
| `*-mac.zip`, `*.blockmap`, `latest*.yml` | Read by the updater inside OGL. Never delete them from a release. |

## How updates reach players

OGL checks the latest published release when it starts and when the player presses the refresh button at the bottom of the sidebar. A newer version shows as a card in the sidebar, the same way a game download does.

All three systems download the update in the app and restart into it.

On macOS this only works from a signed copy to a signed copy. Versions before 0.1.5 were not signed with a Developer ID, so they open the release page instead and the player replaces the app by hand once. If the signing secrets are ever missing, the build falls back to an ad-hoc signature and behaves like those old versions.

Outside a packaged build (`npm run dev`, the browser preview) there is no update check. The preview uses a simulated update from `src/renderer/dev-mock.ts`.

## macOS signing

Mac builds are signed with the Developer ID certificate of Digital Vibes GmbH (team `8HFX6YPXXN`, valid until September 2031) and notarized by Apple. The workflow reads five repository secrets:

| Secret | Value |
| --- | --- |
| `CSC_LINK` | the "Developer ID Application" certificate with its private key, exported from Keychain Access as `.p12`, base64-encoded |
| `CSC_KEY_PASSWORD` | the password of that `.p12` |
| `APPLE_ID` | the Apple ID email of a member of the team |
| `APPLE_APP_SPECIFIC_PASSWORD` | an app-specific password for that Apple ID, from account.apple.com |
| `APPLE_TEAM_ID` | `8HFX6YPXXN` |

Set them one command at a time, for example `base64 -i DeveloperID.p12 | gh secret set CSC_LINK` and `gh secret set CSC_KEY_PASSWORD`.

The workflow loads the certificate into a temporary keychain on the Mac runner, and electron-builder signs and notarizes with it. To check a build:

```bash
codesign --verify --deep --strict OGL.app
spctl -a -vv -t exec OGL.app        # should say: accepted, source=Notarized Developer ID
xcrun stapler validate OGL.app
```

Without the secrets the Mac build is ad-hoc signed. That still opens (an app with no signature at all is reported as "damaged" on Apple silicon), but players have to allow it under System Settings → Privacy & Security → **Open Anyway**, and it cannot update itself.

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
- **Notarization answered "401 Invalid credentials".** `APPLE_APP_SPECIFIC_PASSWORD` must be an app-specific password, not the Apple account password, and belong to the `APPLE_ID` account.
- **"MAC verification failed during PKCS12 import".** `CSC_KEY_PASSWORD` does not match the `.p12`. Set secrets one command at a time; pasting several `gh secret set` lines at once feeds the later lines into the first prompt.
- **"SecKeychainUnlock: The user name or passphrase you entered is not correct".** electron-builder's own keychain handling failed on the GitHub Mac runner when given `CSC_LINK`. The workflow now loads the certificate into a temporary keychain itself and lets electron-builder find the identity there.
- **The `.p12` held the wrong certificate.** The first export contained an "Apple Development" identity, not "Developer ID Application". The downloaded `.cer` has to be opened first so it joins its private key in the keychain; then export that entry from **My Certificates**. `security find-identity -v -p codesigning` must list a "Developer ID Application" line before exporting.
- **The repository was renamed.** It was `OpenGameLuncher` until 3 October 2026. Copies of OGL up to 0.1.7 still ask for the old name and only work because GitHub redirects it. A new repository with the old name would cut them off from the catalog and from updates.
- **Wrong repository.** `ogl.config.json`, the `origin` remote and the download link in the README must all name the same repository. The app reads its catalog and its updates from the one in `ogl.config.json`.
