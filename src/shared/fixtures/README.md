One file per game: `<game id>.json`. `assets` is the full list of file names on that game's latest stable
release. `picks` lists `[platform, arch, expected file or null]`. `catalog-fixtures.test.ts` runs every file
through the game's asset rules, so a rule change that picks the wrong download fails the tests.
