# OGL

Open Game Launcher. A desktop app for macOS, Windows, and Linux that installs, updates, and launches open-source games such as OpenRCT2, OpenTTD, and OpenLoco.

## Install

Download the file for your system from the [latest release](https://github.com/fabianfreund/OpenGameLuncher/releases/latest). The files are listed under **Assets** at the bottom of the release. `x.y.z` below stands for the version number.

OGL is not signed with a paid developer certificate yet, so macOS and Windows show a warning the first time you open it. The steps below include how to get past it.

### macOS

Which file you need depends on your Mac. Open the Apple menu → **About This Mac**:

| About This Mac shows | Download |
| --- | --- |
| Chip: Apple M1, M2, M3, … | `OGL-x.y.z-arm64.dmg` |
| Processor: Intel | `OGL-x.y.z.dmg` |

1. Open the downloaded `.dmg` and drag **OGL** into **Applications**.
2. Open OGL from Applications. macOS says it could not verify the app. Click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to OGL.
4. Confirm with **Open Anyway**. You only need to do this once.

### Windows

Download `OGL-Setup-x.y.z.exe`.

1. Run the downloaded file.
2. If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**.
3. Follow the installer. OGL appears in the Start menu.

### Linux

Download `OGL-x.y.z.AppImage`.

1. Make the file executable: right-click → **Properties** → **Permissions** → allow running as a program, or in a terminal:

   ```bash
   chmod +x OGL-*.AppImage
   ```

2. Double-click the file, or run `./OGL-*.AppImage`.

You can ignore the other files in the release (`.zip`, `.blockmap`, `.yml`). OGL uses them to update itself.

### Updates

OGL checks for a new version when it starts and offers to install it. On macOS this does not work yet: download the new `.dmg` and replace the app in Applications.

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
