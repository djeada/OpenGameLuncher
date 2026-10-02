# Mods

Some games get a mods button on their page (OpenTTD: **NewGRFs**; OpenRCT2 and Endless Sky: **Plugins**; Simutrans: **Paksets**). It opens a browser where the player searches, filters by category, installs and uninstalls.

## Which games have mods

`src/shared/mods.ts` lists them by game id. This is in the app and not in the catalog on purpose: a mod source depends on how one game stores its content, and released launchers reject catalog files with properties they do not know.

Each entry gives a `label` (what the game calls its mods), a `hint` (where the player switches them on) and a `source`.

`popular` is an optional hand-picked list of well-known mods, best first. It shows as the first category and is what the browser opens on. OpenTTD's list is `catalog/mods/openttd.json`; the `name` there is only for people reading the file. OpenTTD publishes no download counts, so the list is editorial: the sets that community recommendations keep naming.

## Adding a source

A source type is a provider in `src/main/mods.ts`:

```ts
type ModProvider = {
  list(): Promise<Mod[]>
  installed(): Promise<InstalledMod[]>
  install(modId, onProgress): Promise<void>
  uninstall(modId): Promise<void>
  folder(): string
}
```

Add the type to `ModSource` in `src/shared/types.ts`, write the provider, and register it in `providers`. The window, the IPC calls and the mock do not change. Download hosts must be on the list in `src/shared/urls.ts`.

`installed()` should read the game's own folder rather than keep a list, so mods added inside the game show up too.

## OpenTTD

`src/main/openttd-content.ts` and `src/shared/openttd-content.ts`.

- **List:** `bananas-api.openttd.org/package/newgrf`, kept for six hours in `ogl-cache/mods`.
- **Pictures:** BaNaNaS has none. `src/shared/openttd-art.json` maps GRF ids to preview pictures on GRFCrawler (about one set in ten has one), shown as the list icon and at the top of the detail pane, loaded through `ogl-img://`. Rebuild it with `node scripts/openttd-mod-art.mjs`.
- **Download:** the API has no file links. OGL asks the content server the game itself uses (`content.openttd.org:3978`, a small binary protocol) for the entry and its dependencies, then posts their ids to `binaries.openttd.org/bananas`, which answers with links on `bananas-cdn.openttd.org`.
- **Install:** the `.tar.gz` is unpacked to a `.tar` in `content_download/newgrf` of OpenTTD's personal folder (`Documents/OpenTTD` on Mac and Windows, `~/.local/share/openttd` on Linux), under the same name the game would give it. Dependencies are installed along with it. An older version of the same NewGRF is removed.
- All installed versions of OpenTTD, and JGR's Patch Pack, share that folder.

## OpenRCT2

`src/main/openrct2-plugins.ts`. The list is `catalog/mods/openrct2.json`, built by `scripts/openrct2-plugins.mjs` from openrct2plugins.org: only plugins whose latest GitHub release carries a `.js` file (131 of 198 when last built), sorted by stars. The first 20 are the Popular category.

Installing reads the repository's releases and puts the `.js` files of the newest one into `plugin/<owner>--<repo>/` in OpenRCT2's user folder (`~/Library/Application Support/OpenRCT2`, `Documents\OpenRCT2`, `~/.config/OpenRCT2`). The game loads every `.js` below `plugin`.

## Endless Sky

`src/main/endless-sky-plugins.ts`. The list is the project's own `generated/plugins.json` in `endless-sky/endless-sky-plugins`, read live and kept for six hours. Plugins whose zip is not on GitHub are left out.

Installing unpacks the zip into `plugins/<name>/` in the game's settings folder (`~/Library/Application Support/endless-sky`, `%APPDATA%\endless-sky`, `~/.local/share/endless-sky`).

## Simutrans

`src/main/simutrans-paksets.ts` and `src/shared/simutrans-paksets.ts`. A pakset is the graphics and rule set the game runs on, so it is closer to a base game than a mod, but it installs the same way.

- **List:** `src/paksetinfo.h` in `simutrans/simutrans`, the list the game's own first-start installer uses, read live and kept for six hours. The sets the file marks as obsolete, and the one that is not a zip, are left out. The file has no descriptions, so those are written in `src/shared/simutrans-paksets.ts`. The size it gives is the size on disk, not the download.
- **Download:** most sets are on SourceForge, which sends the download on to a mirror (`*.dl.sourceforge.net`); the rest are on GitHub, simutrans-germany.com and Codeberg.
- **Install:** into `paksets/<folder>/` in Simutrans's personal folder (`~/Library/Simutrans`, `Documents\Simutrans`, `~/simutrans`), where the game's own installer puts them. Most zips wrap the set in `simutrans/<folder>/`; the set is lifted out, and a download without `ground.Outside.pak` is refused.

## Folder-per-mod helper

`src/main/mod-folders.ts` does the work for these three: fill a fresh folder, swap it in, and note the installed version in `.ogl-version` so a newer listed version shows as an update. A folder without that file was put there by the player and counts as installed.

## Games left out

Unciv, Luanti and Cataclysm: DDA keep their data inside the game folder on at least one system. OGL replaces that folder on every update, so mods placed there would be lost.

More OpenTTD content (AIs, game scripts, scenarios) uses the same server as NewGRFs; it needs a new `kind` and its folder name.
