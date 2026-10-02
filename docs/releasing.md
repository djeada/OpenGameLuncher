# Releasing OGL

OGL updates itself from the GitHub releases of the repository named in `ogl.config.json`. Releases are built by [`.github/workflows/release.yml`](../.github/workflows/release.yml); the version comes from the branch name, so there is nothing to bump by hand.

1. Create a branch named after the version: `git switch -c release/0.2.0`.
2. Push to it. Every push builds macOS (Apple silicon and Intel), Windows, and Linux and uploads them to a **draft** release `v0.2.0`. Download from the draft to test. Installed launchers do not see drafts.
3. Open a pull request into `main` and merge it. The merge rebuilds from `main`, tags `v0.2.0`, and publishes the release with generated notes. Notes you wrote on the draft are kept.

Packaged OGL checks the newest published release on startup and offers the download. A name with a suffix, such as `release/0.3.0-beta.1`, is published as a pre-release, which only launchers already on a pre-release pick up.

Pushing a `vX.Y.Z` tag publishes that commit directly, and the workflow can be run by hand from the Actions tab for any ref. A published version cannot be rebuilt; start the next one.

**macOS signing.** macOS only installs an update into a signed app, so an unsigned Mac build can show that an update exists but cannot install it, and Gatekeeper warns when it is first opened. To sign and notarize, add these repository secrets: `CSC_LINK` (base64 of the Developer ID Application `.p12`), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Windows and Linux update without signing; Windows shows a SmartScreen warning on unsigned installers.

`npm run dist:mac`, `npm run dist:win`, and `npm run dist:linux` build locally without publishing.
