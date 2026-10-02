# OGL

Open Game Launcher. A desktop app for macOS, Windows, and Linux that installs, updates, and launches open-source games such as OpenRCT2, OpenTTD, and OpenLoco.

## Download

Get the installer for your system from the [latest release](https://github.com/fabianfreund/OpenGameLuncher/releases/latest):

- **macOS:** `OGL-x.y.z-arm64.dmg` for Apple silicon, `OGL-x.y.z.dmg` for Intel
- **Windows:** `OGL-Setup-x.y.z.exe`
- **Linux:** `OGL-x.y.z.AppImage`

The builds are not signed yet, so macOS and Windows warn the first time you open the app.

## How it works

The games are a list of JSON files in [`catalog/games`](catalog/games). OGL reads that folder from this repository on launch, so a new game shows up without a new version of the launcher. Each game's versions come from that game's own GitHub releases.

OGL updates itself from the releases of this repository.

## Develop

```bash
npm install
npm run dev
```

`npm test` and `npm run typecheck` run the checks.

```
catalog/games        the games
src/shared           catalog rules and asset matching
src/main             window, downloads, launching, self-update
src/preload          the bridge into the window
src/renderer         the interface
```

## More

- [Adding games](docs/catalog.md)
- [Releasing OGL](docs/releasing.md)

## License

[MIT](LICENSE)
