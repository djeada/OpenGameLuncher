import { describe, expect, it } from 'vitest'
import { modSupport } from './mods'
import {
  contentFileName,
  infoByContentId,
  infoByUniqueId,
  isContentId,
  readContentLinks,
  readContentPackages,
  readInfoPacket,
  splitPackets
} from './openttd-content'

function infoPacket(type = 2): Uint8Array {
  const text = (value: string) => [...new TextEncoder().encode(value), 0]
  const u32 = (value: number) => [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >>> 24) & 255]
  const body = [
    type,
    ...u32(6046212),
    ...u32(2984023),
    ...text('OpenGFX+ Landscape'),
    ...text('1.1.2'),
    ...text('http://example.org'),
    ...text('Gridless landscape'),
    0x34, 0x2b, 0x47, 0x4f,
    ...Array.from({ length: 16 }, () => 7),
    2,
    ...u32(11),
    ...u32(12),
    1,
    ...text('landscape')
  ]
  return new Uint8Array([(body.length + 3) & 255, (body.length + 3) >> 8, 4, ...body])
}

describe('OpenTTD content', () => {
  it('names files the way the content server does', () => {
    expect(contentFileName('4f472b34', 'OpenGFX+ Landscape', '1.1.2')).toBe('4f472b34-OpenGFX_Landscape-1.1.2')
    expect(contentFileName('00000002', ' (CZ) Signals! ', 'v2.')).toBe('00000002-CZ_Signals-v2')
  })

  it('keeps the newest version of each package', () => {
    const { mods, files } = readContentPackages([
      {
        name: 'OpenGFX+ Landscape',
        description: 'Package text',
        url: 'http://dev.openttdcoop.org/projects/ogfx-landscape',
        'unique-id': '4f472b34',
        authors: [{ 'display-name': 'planetmaker' }],
        versions: [
          { version: '1.1.2', 'upload-date': '2015-02-16T20:05:36+00:00', availability: 'new-games', filesize: 2984023, license: 'GPL v2', classification: { set: 'landscape', palette: '32bpp', 'has-high-res': true } },
          { version: '0.1.0', 'upload-date': '2011-02-11T22:27:45+00:00', availability: 'savegames-only', filesize: 1 },
          { version: '2.0.0', 'upload-date': '2016-01-01T00:00:00+00:00', availability: 'savegames-only', filesize: 1 }
        ]
      },
      { name: 'No usable version', 'unique-id': '11111111', versions: [] },
      { name: 'Bad id', 'unique-id': '../etc', versions: [{ version: '1', availability: 'new-games' }] }
    ])
    expect(mods).toHaveLength(1)
    expect(mods[0]).toMatchObject({
      id: '4f472b34',
      version: '1.1.2',
      category: 'Landscape',
      authors: ['planetmaker'],
      tags: ['32bpp', 'High-res'],
      description: 'Package text',
      license: 'GPL v2'
    })
    expect(mods[0].url).toBeUndefined()
    expect(files).toEqual({ '4f472b34': '4f472b34-OpenGFX_Landscape-1.1.2' })
  })

  it('builds requests', () => {
    expect([...infoByUniqueId('newgrf', ['4f472b34'])]).toEqual([9, 0, 2, 1, 2, 0x34, 0x2b, 0x47, 0x4f])
    expect([...infoByContentId([6046212])]).toEqual([9, 0, 1, 1, 0, 0x04, 0x42, 0x5c, 0x00])
    expect(() => infoByUniqueId('newgrf', ['nope'])).toThrow()
  })

  it('reads an answer that arrives in pieces', () => {
    const whole = infoPacket()
    const first = splitPackets(whole.subarray(0, 20))
    expect(first.packets).toHaveLength(0)
    const joined = new Uint8Array([...first.rest, ...whole.subarray(20), ...whole.subarray(0, 5)])
    const second = splitPackets(joined)
    expect(second.packets).toHaveLength(1)
    expect(second.rest).toHaveLength(5)
    expect(readInfoPacket(second.packets[0], 'newgrf')).toEqual({
      contentId: 6046212,
      size: 2984023,
      name: 'OpenGFX+ Landscape',
      version: '1.1.2',
      uniqueId: '4f472b34',
      dependencies: [11, 12]
    })
  })

  it('ignores other kinds of content and cut-off packets', () => {
    expect(readInfoPacket(infoPacket(3), 'newgrf')).toBeNull()
    expect(readInfoPacket(infoPacket().subarray(0, 30), 'newgrf')).toBeNull()
  })

  it('reads download links', () => {
    const links = readContentLinks('6046212,2,2984023,https://bananas-cdn.openttd.org/newgrf/a/b/c.tar.gz\n\nbroken\n')
    expect([...links]).toEqual([[6046212, 'https://bananas-cdn.openttd.org/newgrf/a/b/c.tar.gz']])
  })
})

describe('mod support', () => {
  it('is only known for games that have it', () => {
    expect(modSupport('openttd')?.label).toBe('NewGRFs')
    const popular = modSupport('openttd')?.popular ?? []
    expect(popular.length).toBeGreaterThan(10)
    expect(new Set(popular).size).toBe(popular.length)
    expect(popular.every(isContentId)).toBe(true)
    expect(modSupport('supertux')).toBeUndefined()
    expect(modSupport('constructor')).toBeUndefined()
  })
})
