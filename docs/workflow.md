# How we work on OGL

This is the working agreement between the maintainer and whoever (person or AI assistant) is helping in a session. It records what was decided and what was learned, so a new session does not have to rediscover it. Release mechanics are in [releasing.md](releasing.md).

## State of the project

- Home: `github.com/fabianfreund/OpenSourceGameLauncher`. One maintainer with write access. Public, MIT, issues on, forks allowed.
- `main` is the only long-lived branch. Every published version has a tag (`v0.1.0` and up) on the commit it was built from.
- Mac builds are signed with a Developer ID and notarized. In-app updates are confirmed working on the Mac (0.1.4 to 0.1.5). Windows and Linux builds are produced by CI but have never been run on a real machine; the README says so.
- OGL is a hobby project. Keep changes small and the docs plain.

## Start of a session

```bash
git switch main && git pull --tags
git status --short           # should be empty
git branch -a                # should be main only, plus a release branch if one is in progress
git stash list               # should be empty
git remote -v                # must be fabianfreund/OpenSourceGameLauncher
```

If any of these show something unexpected, find out what it is before starting new work. Work has been lost here before: a commit with two browser games sat unpushed on an old release branch after that version was already published, and it missed two releases.

## Where a change goes

| Change | Where |
| --- | --- |
| Anything in the app (code, catalog, styles) | a `release/X.Y.Z` branch for the next version |
| Documentation only (`README.md`, `docs/`, `CLAUDE.md`, `AI-POLICY.md`) | straight to `main` |
| Workflow or build configuration | a release branch, so the draft build tests it |

Catalog files are bundled into the app but are also read live from `main` by installed copies, so a new game file reaches players as soon as it is on `main`, without a new version.

One version at a time. Do not start `release/0.1.7` while `release/0.1.6` is open; put the work on the open branch.

## Finishing a version

1. Run `npm test` and `npm run typecheck`.
2. Push the release branch and wait for the draft build to be green on all three systems.
3. Write the release notes on the draft (`gh release edit vX.Y.Z --notes-file ...`).
4. Ask the maintainer before publishing. Publishing is public and cannot be redone for that version.
5. Open the pull request into `main` and merge it. Wait for the publish run and check `gh release list` says Latest.
6. Check that `main` contains the branch (`git log main..origin/release/X.Y.Z` prints nothing), then delete the branch on GitHub and locally. The tag keeps the history.

To go back to an old version later: `git switch -c fix/something v0.1.3`.

## Release notes

Written for players, not developers. The shape used so far:

- **New** and **Changed**: one bullet per thing, the bold part names it, the rest says what the player sees.
- **Good to know**: anything a player must do by hand, or a limit they will hit.
- **Download**: a table of which file is for which system.
- A link to the install steps in the README, and the full changelog link.

## Checking interface changes

The maintainer wants a screenshot after every visible change.

```bash
node scripts/preview-shot.mjs /tmp/shot.png                          # home screen
node scripts/preview-shot.mjs /tmp/shot.png --wait 800               # loading screen
node scripts/preview-shot.mjs /tmp/shot.png --query "?game=openrct2" # a game page
node scripts/preview-shot.mjs /tmp/shot.png --click ".rail-foot button" --after 1500 --clip 0,440,200,240
node scripts/preview-shot.mjs /tmp/shot.png --query "?game=openloco" --click ".menu-button" --click ".menu [role=menuitem]:nth-child(2)"   # several clicks, in order
```

This runs the browser preview with mock data from `src/renderer/dev-mock.ts`. To show a state that needs data, such as an available update, add it to the mock. Say in the report that the picture is from the preview and not the packaged app.

Things the preview cannot show: the real update check, downloads, launching games, anything in `src/main`. Those are only proven by a packaged build.

## Checking a build

A green CI run is not proof that the Mac app is good. Download it from the release and check it:

```bash
gh release download vX.Y.Z -p 'OGL-X.Y.Z-arm64-mac.zip' -D /tmp/check
ditto -x -k /tmp/check/OGL-X.Y.Z-arm64-mac.zip /tmp/check/app
codesign --verify --deep --strict /tmp/check/app/OGL.app
spctl -a -vv -t exec /tmp/check/app/OGL.app      # accepted, source=Notarized Developer ID
xcrun stapler validate /tmp/check/app/OGL.app
```

Run these in an empty folder. Never extract files from an app into the repository folder; that once overwrote `package.json`.

## Reporting

- Say what was verified and how, and what was not. "Built in CI" and "opened on a Mac" are different claims.
- When a build fails, quote the line that failed.
- Secrets are entered by the maintainer with `gh secret set NAME`, one command at a time. An assistant never asks to see a secret value. `gh secret list` shows names and dates only, which is enough to see what was changed.

## Contributions from others

Pull requests from forks cannot start a release and never see the signing secrets. The safeguard is the review before merging. Look closely at changes to `.github/workflows/`, `electron-builder.config.cjs`, `package.json`, and `catalog/games/*.json`, since those decide what is built and what OGL downloads and runs.

[AI-POLICY.md](../AI-POLICY.md) applies to everyone, including the maintainer's own sessions: substantial AI help is disclosed in the pull request, and a game file is only added after the game was installed and started from OGL.

## Open points

- Windows and Linux builds are untested on real machines.
- The Windows installer is not signed, so SmartScreen warns.
- The app icon file (`build/icon.png`, made by `scripts/render-icon.mjs`) is still the old flat design; the in-app logo in `Logo.tsx` is newer.
- The repository has no description, topics, `CONTRIBUTING.md` or issue templates.
