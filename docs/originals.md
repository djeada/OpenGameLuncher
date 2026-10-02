# Original files from Steam

Some games need the files of the original game. Steam sells a few of those for Windows only, so the Steam app will not download them on a Mac. SteamCMD, Valve's command-line client, will. OGL runs it for the player from the three-dots menu on the game page ("Get files from Steam…"). Mac only.

## What happens

1. OGL downloads SteamCMD from Valve into its data folder (`steamcmd/tool`) on first use. It is not shipped inside the app, because SteamCMD updates itself in place and that would break the app's signature.
2. SteamCMD runs with a home folder of its own (`steamcmd/home`), so it never touches the settings of an installed Steam app.
3. It signs in, downloads the Windows files into `originals/<game id>`, and OGL writes that folder into the game's own settings file, unless the game already points at a folder that exists.

SteamCMD is an Intel program, so an Apple silicon Mac needs Rosetta.

## Signing in

- **Form:** OGL starts SteamCMD and types the password into its prompt. OGL does not store the password. SteamCMD keeps its own sign-in token, so later downloads work with the password left empty.
- **Terminal:** OGL opens Terminal on `steamcmd +login <name> +quit`, and the player types the password into SteamCMD. Back in OGL, Download then works without a password.

Steam Guard: SteamCMD either asks for a code, which the window passes on, or waits for a tap in the Steam phone app.

## Adding a game

Add a line to `SOURCES` in `src/shared/originals.ts`: the Steam app id and the settings file and key where the game keeps the folder. Only add a game after the download was tried from OGL and the game started with the files.

## Checked and not checked

Checked on a Mac: downloading SteamCMD, the separate home folder, progress during an anonymous download, the password prompt and a refused sign-in, cancelling. Not checked without a real account: a successful sign-in, Steam Guard, and the download of a paid game.
