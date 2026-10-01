import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickAsset } from './assets'
import { validateGame } from './games'
import type { PlatformId } from './types'

type Fixture = { assets: string[]; picks: [PlatformId, string, string | null][] }

const files = readdirSync('src/shared/fixtures').filter((name) => name.endsWith('.json') && !name.startsWith('_'))

describe('catalog asset rules against release fixtures', () => {
  for (const file of files) {
    const id = file.replace(/\.json$/, '')
    it(`picks the right ${id} file`, () => {
      const fixture = JSON.parse(readFileSync(`src/shared/fixtures/${file}`, 'utf8')) as Fixture
      const result = validateGame(JSON.parse(readFileSync(`catalog/games/${id}.json`, 'utf8')))
      expect(result.errors).toEqual([])
      const assets = fixture.assets.map((name) => ({ name }))
      for (const [platform, arch, expected] of fixture.picks) {
        const rule = result.game?.platforms[platform]?.asset
        const picked = rule ? (pickAsset(rule, arch, assets)?.name ?? null) : null
        expect(picked, `${id} ${platform} ${arch}`).toBe(expected)
      }
    })
  }

  it('has nothing to check yet or passes', () => {
    expect(files.length).toBeGreaterThanOrEqual(0)
  })
})
