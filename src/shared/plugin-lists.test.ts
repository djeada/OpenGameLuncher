import { describe, expect, it } from 'vitest'
import openrct2 from '../../catalog/mods/openrct2.json'
import { modSupport } from './mods'
import { isFolderName, readEndlessSkyPlugins, readOpenrct2Plugins } from './plugin-lists'

describe('folder names', () => {
  it('accepts plain names and refuses paths', () => {
    expect(isFolderName('A Coalition at War')).toBe(true)
    expect(isFolderName('mgovea--openrct2-ride-price-manager')).toBe(true)
    for (const name of ['', '..', '.hidden', 'a/b', 'a\\b', 'C:', 'trailing.', ' padded']) {
      expect(isFolderName(name)).toBe(false)
    }
  })
})

describe('Endless Sky plugins', () => {
  it('keeps plugins with a zip on GitHub', () => {
    const { mods, downloads } = readEndlessSkyPlugins([
      {
        name: 'A Coalition at War',
        authors: 'Josh Mudge',
        homepage: 'https://github.com/mathwhiz1212/A-Coalition-At-War',
        license: 'GPL-3.0-or-later',
        version: 'v0.10.4',
        shortDescription: 'Short',
        description: 'Long',
        iconUrl: 'https://raw.githubusercontent.com/x/y/icon.png',
        url: 'https://github.com/mathwhiz1212/A-Coalition-At-War/archive/refs/tags/v0.10.4.zip'
      },
      { name: 'Released', version: '2', url: 'https://github.com/a/b/releases/download/v2-x/x.zip' },
      { name: 'Elsewhere', version: '1', url: 'https://codeberg.org/a/b/archive/1.zip' },
      { name: '../escape', version: '1', url: 'https://github.com/a/b/archive/refs/tags/1.zip' },
      { name: 'Sneaky', version: '1', url: 'https://github.com/a/b/archive/../../c.zip' }
    ])
    expect(mods.map((mod) => mod.id)).toEqual(['A Coalition at War', 'Released'])
    expect(mods[0]).toMatchObject({ id: 'A Coalition at War', icon: 'https://raw.githubusercontent.com/x/y/icon.png', description: 'Long', authors: ['Josh Mudge'], version: 'v0.10.4' })
    expect(downloads['A Coalition at War']).toBe(
      'https://github.com/mathwhiz1212/A-Coalition-At-War/archive/refs/tags/v0.10.4.zip'
    )
    expect(Object.keys(downloads)).toHaveLength(2)
  })
})

describe('OpenRCT2 plugins', () => {
  it('gives repositories readable names', () => {
    const mods = readOpenrct2Plugins({
      plugins: [
        { id: 'mgovea/openrct2-ride-price-manager', name: 'openrct2-ride-price-manager', author: 'mgovea', stars: 63, version: 'v1.3.2' },
        { id: 'a/OpenRCT2-PeepEditor', name: 'OpenRCT2-PeepEditor', stars: 1 },
        { id: 'not a repository', name: 'x' }
      ]
    })
    expect(mods.map((mod) => mod.name)).toEqual(['Ride price manager', 'Peep Editor'])
    expect(mods[0]).toMatchObject({ icon: 'https://github.com/mgovea.png?size=96', url: 'https://github.com/mgovea/openrct2-ride-price-manager', tags: ['63 stars'] })
    expect(mods[1].tags).toEqual(['1 star'])
  })

  it('reads the bundled list', () => {
    const mods = readOpenrct2Plugins(openrct2)
    expect(mods.length).toBe(openrct2.plugins.length)
    expect(new Set(mods.map((mod) => mod.id)).size).toBe(mods.length)
    expect(modSupport('openrct2')?.popular).toHaveLength(20)
  })
})
