# OGL

Open Game Launcher. A fixed-size desktop app for macOS, Windows, and Linux that installs, updates, and launches a catalog of open-source games.

Players do not add games. The library is the catalog in this repo. Maintainers add a game by dropping one JSON file on the catalog branch. Installed copies of OGL pick that file up the next time they launch. A new game build is a GitHub release on that game's own repository. OGL matches the file for the current Mac or PC at runtime, so neither change needs a new OGL build.

OGL itself updates from GitHub releases of this repository.

## Run

```bash
npm install
npm test
npm run dev
```

`npx vite src/renderer` previews the UI in a browser with mock data. Add `?game=openrct2` to open a game page.

The window is 1040×680 and does not resize.

## Add a game

Create `catalog/games/<id>.json`. The editor validates it against [`catalog/game.schema.json`](catalog/game.schema.json). [OpenRCT2](catalog/games/openrct2.json) and [OpenLoco](catalog/games/openloco.json) are the working examples.

A game file names the GitHub repository whose releases to read, and the filename fragments that identify a Mac, Windows, or Linux build. Example shape:

```json
{
  "$schema": "../game.schema.json",
  "id": "openrct2",
  "name": "OpenRCT2",
  "mark": "RC",
  "tagline": "Open-source reimplementation of RollerCoaster Tycoon 2.",
  "accent": "#e4572e",
  "channels": [
    {
      "id": "release",
      "label": "Release",
      "source": { "type": "github-releases", "owner": "OpenRCT2", "repo": "OpenRCT2", "prerelease": "exclude" }
    }
  ],
  "platforms": {
    "darwin": {
      "asset": { "include": ["macos"], "exclude": ["symbols"], "arch": { "arm64": ["arm64", "universal"], "x64": ["x64", "universal"] } },
      "archive": "zip",
      "launch": { "app": "OpenRCT2.app" }
    }
  }
}
```

`archive` is `zip`, `tar.gz`, `tar.xz`, `dmg` (macOS disk image; OGL copies the `.app` out), or `file` for a single executable such as an AppImage. `launch.app` and `launch.binary` are file names inside the archive, not paths. A second channel can point at another repository: OpenRCT2 Develop reads `OpenRCT2/OpenRCT2-binaries`, where those builds are published as normal releases, so that channel uses `"prerelease": "include"`.

Browser games skip `channels` and `platforms` and give `"web": { "url": "https://…" }` instead. OGL opens the page in its own window with its own saved data, on every system. [Micropolis](catalog/games/micropolis.json) works this way. [Freeciv](catalog/games/_freeciv.json) is parked with a leading `_` while play.freeciv.org serves a certificate for the wrong domain; rename it back once that site loads again.

Projects that do not attach files to GitHub releases can still work if their files live on a known CDN. OpenTTD sets `"cdn": "openttd"` on its channels: versions and notes come from GitHub, files from `cdn.openttd.org`.

A channel can also read a free itch.io page with `"source": { "type": "itch", "page": "https://creator.itch.io/game" }`. OGL requests the file the same way the page's Download button does, and takes the version from the file name. [Stone Kingdoms](catalog/games/stone-kingdoms.json) works this way. That endpoint is not a public API, so it can change.

Games shipped as a `.love` file add a `runtime` to the platform: a GitHub release to download once (such as `love2d/love` `11.5`) and share between games. OGL starts the runtime with the game file as its argument.

`requires` names the original game a project needs files from, with an optional store link. It shows as a "Needs …" tag on the game page and a "Needs original" chip and filter on Home.

`tags` are genres such as `Strategy` or `City builder`. They become filter chips next to the search on Home.

Art is optional but makes the store look alive. `cover` is the wide banner and card image, `icon` is the square tile, and `screenshots` is a list of up to 12 in-game images. All three are https URLs, ideally from the game's own website or repository. When `cover` or `icon` is missing, OGL reads the website's `og:image` and `apple-touch-icon`, then falls back to the GitHub owner's avatar.

Each channel is a track the player can pick on the game page. Give it a one-line `description` such as "Nightly builds, may be unstable." Channels that include pre-releases get a Beta badge.

Push the file to the branch named in `ogl.config.json` (`main` by default, folder `catalog/games`). On the next launch, OGL lists that folder through the GitHub API and replaces the cached catalog. Until the repository owner below is filled in, OGL uses the JSON shipped inside the app.

Files starting with `_` are ignored, so a draft can sit beside the real games.

The catalog is trusted. It decides which release file is downloaded and which executable is started. Point `ogl.config.json` only at a repository you control.

## Versions without a new launcher

Each channel calls the GitHub releases API when the player opens that game. Drafts are skipped. `prerelease` is `exclude`, `only`, or `include`. The asset rule then keeps the file whose name matches this operating system and CPU. A release published ten minutes ago shows up in the list. The Launch button installs it, or says when this machine has no file.

If **Update automatically** is on (the default once a game is installed), OGL downloads a newer release in the background and keeps the previous copy until the new one is ready.

## Launcher updates

1. Set `repository.owner` and `repository.name` in `ogl.config.json` to this GitHub repo.
2. Bump `version` in `package.json`.
3. Tag a matching `vX.Y.Z` and push it.

GitHub Actions builds a macOS dmg/zip and a Windows installer and attaches them to the release, including the `latest*.yml` files electron-updater needs. Packaged OGL checks that release on startup and offers the download. Unsigned Mac builds need `CSC_IDENTITY_AUTO_DISCOVERY=false` unless you have a Developer ID certificate. Gatekeeper will warn on unsigned apps until you sign and notarize.

`npm run dist:mac` and `npm run dist:win` build locally without publishing.

## Caching and GitHub's limit

GitHub allows 60 anonymous API requests an hour. OGL keeps what it has already fetched in `ogl-cache` inside the app's user data folder:

- **Release lists** are stored with their ETag and revalidated; a "not modified" answer does not count against the limit. When the limit is hit, the stored copy is used.
- **No stored copy and the limit is hit:** OGL reads GitHub's public release pages instead (tags, pre-release labels, files, notes) and keeps that for 30 minutes. `OGL_NO_GITHUB_API=1` uses this route all the time.
- **Images** load through `ogl-img://`, which downloads each picture once and serves it from disk after that, including offline. They refresh in the background after two weeks.
- **Website art lookups** are kept for a week, **itch.io pages** for five minutes with the old copy as fallback, and **OpenTTD file lists** for good, since a released version does not change.

Set `OGL_GITHUB_TOKEN` to raise GitHub's limit to 5,000 requests an hour. Deleting `ogl-cache` is always safe.

## Layout

```
catalog/game.schema.json    contract for a game file
catalog/games/*.json         the games we ship
ogl.config.json              GitHub repo and catalog branch
src/shared                   catalog rules, asset matching, button states
src/main                     window, GitHub, download, launch, self-update
src/preload                  the small bridge into the window
src/renderer/components      home, game page, sidebar, track and version pickers
```

Installed games live in the app's user data folder, one version per channel. On macOS, quarantine is cleared on the files OGL just downloaded so Launch can open them.
