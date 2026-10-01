import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { launchAction } from './action'
import { openttdManifestUrl, readOpenttdManifest } from './cdn'
import { dedupeGames, isConfiguredRepository, resolveCatalog } from './catalog'
import { validateGame } from './games'
import { assertAssetUrl, assertCatalogLocation, safeTag } from './urls'
import type { Game } from './types'

const files = readdirSync('catalog/games').filter((name) => name.endsWith('.json'))

describe('catalog games', () => {
  it('accepts every shipped game file', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const result = validateGame(JSON.parse(readFileSync(`catalog/games/${file}`, 'utf8')))
      expect(result.errors, file).toEqual([])
      expect(result.game?.id).toBeTruthy()
    }
  })

  it('rejects a file a maintainer mistyped', () => {
    const result = validateGame({
      id: 'Not A Slug',
      name: 'Example',
      tagline: 'Short.',
      accent: 'blue',
      channels: [],
      platforms: {},
      extra: true
    })
    expect(result.game).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects a launch path that leaves the archive', () => {
    const sample = validateGame(JSON.parse(readFileSync('catalog/games/openrct2.json', 'utf8')))
    const broken = structuredClone(sample.game) as Game
    broken.platforms.darwin!.launch = { app: '../OpenRCT2.app' }
    expect(validateGame(broken).game).toBeNull()
  })
})

describe('catalog resolution', () => {
  const bundled = [{ id: 'openrct2', name: 'OpenRCT2' } as Game]
  const added = [{ id: 'openloco', name: 'OpenLoco' } as Game]

  it('uses the branch when it is reachable', () => {
    const resolved = resolveCatalog({ bundled, cache: bundled, remote: [...bundled, ...added] })
    expect(resolved.source).toBe('remote')
    expect(resolved.games.map((game) => game.id)).toEqual(['openloco', 'openrct2'])
  })

  it('falls back to the last good catalog, then the copy in the app', () => {
    expect(resolveCatalog({ bundled, cache: added, remote: null }).source).toBe('cache')
    expect(resolveCatalog({ bundled, cache: null, remote: [] }).source).toBe('bundled')
  })

  it('keeps the newest copy when ids collide', () => {
    const games = dedupeGames([
      { id: 'openrct2', name: 'Old' } as Game,
      { id: 'openrct2', name: 'New' } as Game
    ])
    expect(games).toHaveLength(1)
    expect(games[0]?.name).toBe('New')
  })

  it('does not fetch a catalog until the repository is set', () => {
    expect(isConfiguredRepository({ owner: 'your-github-user', name: 'OpenGameLauncher' })).toBe(false)
    expect(isConfiguredRepository({ owner: 'ogl', name: 'OpenGameLauncher' })).toBe(true)
  })
})

describe('download safety', () => {
  it('only follows GitHub release hosts', () => {
    expect(() => assertAssetUrl('https://github.com/OpenRCT2/OpenRCT2/releases/download/v0.5.5/game.zip')).not.toThrow()
    expect(() => assertAssetUrl('http://github.com/OpenRCT2/OpenRCT2/releases/download/v0.5.5/game.zip')).toThrow()
    expect(() => assertAssetUrl('https://example.com/game.zip')).toThrow()
  })

  it('rejects a catalog location that could escape the repo', () => {
    expect(() =>
      assertCatalogLocation({
        owner: 'ogl',
        name: 'OpenGameLauncher',
        branch: 'main',
        directory: 'catalog/games'
      })
    ).not.toThrow()
    expect(() =>
      assertCatalogLocation({
        owner: 'ogl',
        name: 'OpenGameLauncher',
        branch: 'main',
        directory: '../secrets'
      })
    ).toThrow()
  })

  it('makes version tags safe folder names', () => {
    expect(safeTag('v0.5.5')).toBe('v0.5.5')
    expect(safeTag('v1/../../x')).toBe('v1_.._.._x')
  })
})

describe('launch button', () => {
  it('asks to install, update, or launch', () => {
    expect(
      launchAction({
        hasAsset: true,
        machine: 'this Mac',
        selectedTag: 'v2',
        latestTag: 'v2',
        installedTag: null
      }).label
    ).toBe('Install')

    const update = launchAction({
      hasAsset: true,
      machine: 'this Mac',
      selectedTag: 'v2',
      latestTag: 'v2',
      installedTag: 'v1'
    })
    expect(update.label).toBe('Update')
    expect(update.secondaryLaunch).toBe(true)

    expect(
      launchAction({
        hasAsset: true,
        machine: 'this Mac',
        selectedTag: 'v2',
        latestTag: 'v2',
        installedTag: 'v2'
      }).kind
    ).toBe('launch')

    expect(
      launchAction({
        hasAsset: false,
        machine: 'this Mac',
        selectedTag: null,
        latestTag: null,
        installedTag: null
      }).label
    ).toBe('No build for this Mac')

    expect(
      launchAction({
        hasAsset: false,
        machine: 'this Mac',
        selectedTag: null,
        latestTag: null,
        installedTag: null,
        pending: true
      }).label
    ).toBe('Loading')
  })

  it('turns the button into cancel while a download is running', () => {
    const action = launchAction({
      hasAsset: true,
      machine: 'this Mac',
      selectedTag: 'v2',
      latestTag: 'v2',
      installedTag: null,
      phase: 'downloading',
      percent: 0.42
    })
    expect(action.kind).toBe('cancel')
    expect(action.label).toBe('Downloading 42%')
  })
})

describe('browser games and the OpenTTD CDN', () => {
  it('accepts a game that only has a web address', () => {
    const result = validateGame({ id: 'web-demo', name: 'Web', tagline: 'Plays in a window.', accent: '#123456', web: { url: 'https://demo.org/' } })
    expect(result.errors).toEqual([])
    expect(result.game?.channels).toEqual([])
  })

  it('still needs channels when there is no web address', () => {
    expect(validateGame({ id: 'demo', name: 'Demo', tagline: 'x', accent: '#123456' }).game).toBeNull()
  })

  it('reads player files from an OpenTTD manifest and skips docs', () => {
    const text = `version: 15.3
files:
- id: openttd-15.3-macos-universal.zip
  size: 15540074
  md5sum: x
- id: openttd-15.3-windows-win64.zip
  size: 11250350
dev_files:
- id: openttd-15.3-docs.tar.xz
  size: 15471228
`
    expect(readOpenttdManifest(text, '15.3')).toEqual([
      {
        name: 'openttd-15.3-macos-universal.zip',
        url: 'https://cdn.openttd.org/openttd-releases/15.3/openttd-15.3-macos-universal.zip',
        size: 15540074
      },
      {
        name: 'openttd-15.3-windows-win64.zip',
        url: 'https://cdn.openttd.org/openttd-releases/15.3/openttd-15.3-windows-win64.zip',
        size: 11250350
      }
    ])
    expect(() => openttdManifestUrl('../x')).toThrow()
  })
})
