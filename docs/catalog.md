# Adding games

Create `catalog/games/<id>.json`. The editor validates it against [`catalog/game.schema.json`](../catalog/game.schema.json). [OpenRCT2](../catalog/games/openrct2.json) and [OpenLoco](../catalog/games/openloco.json) are the working examples.

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

Browser games skip `channels` and `platforms` and give `"web": { "url": "https://…" }` instead. OGL opens the page in its own window with its own saved data, on every system. [Micropolis](../catalog/games/micropolis.json) works this way. [Freeciv](../catalog/games/_freeciv.json) is parked with a leading `_` while play.freeciv.org serves a certificate for the wrong domain; rename it back once that site loads again.

Projects that do not attach files to GitHub releases can still work if their files live on a known CDN. OpenTTD sets `"cdn": "openttd"` on its channels: versions and notes come from GitHub, files from `cdn.openttd.org`.

A channel can also read a free itch.io page with `"source": { "type": "itch", "page": "https://creator.itch.io/game" }`. OGL requests the file the same way the page's Download button does, and takes the version from the file name. [Stone Kingdoms](../catalog/games/stone-kingdoms.json) works this way. That endpoint is not a public API, so it can change.

A project that publishes its files on its own download page can use `"source": { "type": "file-list", "page": "https://releases.wildfiregames.com/" }`. The page must list one file per table row, as a web server's folder listing does. OGL groups the files by the version in their names and reads the date and size from the row; a name with `alpha`, `beta` or `rc` after the version is a pre-release, and `prerelease` works as it does for GitHub. The host must be in the download list in `src/shared/urls.ts`, so a new host needs a new OGL version. [0 A.D.](../catalog/games/0ad.json) works this way.

Games shipped as a `.love` file add a `runtime` to the platform: a GitHub release to download once (such as `love2d/love` `11.5`) and share between games. OGL starts the runtime with the game file as its argument.

`requires` names the original game a project needs files from, with an optional store link. It shows as a "Needs …" tag on the game page and a "Needs original" chip and filter on Home.

`tags` are genres such as `Strategy` or `City builder`. They become filter chips next to the search on Home.

Art is optional but makes the store look alive. `cover` is the wide banner and card image, `icon` is the square tile, and `screenshots` is a list of up to 12 in-game images. All three are https URLs, ideally from the game's own website or repository. When `cover` or `icon` is missing, OGL reads the website's `og:image` and `apple-touch-icon`, then falls back to the GitHub owner's avatar.

Each channel is a track the player can pick on the game page. Give it a one-line `description` such as "Nightly builds, may be unstable." Channels that include pre-releases get a Beta badge.

Push the file to the branch named in `ogl.config.json` (`main` by default, folder `catalog/games`). On the next launch, OGL lists that folder through the GitHub API and replaces the cached catalog. `npm run dev` always reads the files in this checkout; set `OGL_REMOTE_CATALOG=1` to test against the branch.

Files starting with `_` are ignored, so a draft can sit beside the real games.

The catalog is trusted. It decides which release file is downloaded and which executable is started. Point `ogl.config.json` only at a repository you control.

## Versions without a new launcher

Each channel calls the GitHub releases API when the player opens that game. Drafts are skipped. `prerelease` is `exclude`, `only`, or `include`. The asset rule then keeps the file whose name matches this operating system and CPU. A release published ten minutes ago shows up in the list. The Launch button installs it, or says when this machine has no file.

If **Update automatically** is on (the default once a game is installed), OGL downloads a newer release in the background and keeps the previous copy until the new one is ready.

## Caching and GitHub's limit

GitHub allows 60 anonymous API requests an hour. OGL keeps what it has already fetched in `ogl-cache` inside the app's user data folder:

- **Release lists** are stored with their ETag and revalidated; a "not modified" answer does not count against the limit. When the limit is hit, the stored copy is used.
- **No stored copy and the limit is hit:** OGL reads GitHub's public release pages instead (tags, pre-release labels, files, notes) and keeps that for 30 minutes. `OGL_NO_GITHUB_API=1` uses this route all the time.
- **Images** load through `ogl-img://`, which downloads each picture once and serves it from disk after that, including offline. They refresh in the background after two weeks.
- **Website art lookups** are kept for a week, **itch.io pages and download pages** for five minutes with the old copy as fallback, and **OpenTTD file lists** for good, since a released version does not change.

Set `OGL_GITHUB_TOKEN` to raise GitHub's limit to 5,000 requests an hour. Deleting `ogl-cache` is always safe.
