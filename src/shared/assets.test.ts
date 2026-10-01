import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { channelAccepts, pickAsset } from './assets'
import { validateGame } from './games'
import type { PlatformBuild } from './types'

const openrct2Names = [
  'OpenRCT2-v0.5.5-android.apk',
  'OpenRCT2-v0.5.5-Linux-noble-x86_64.tar.gz',
  'OpenRCT2-v0.5.5-linux-x86_64.AppImage',
  'OpenRCT2-v0.5.5-macos-universal.zip',
  'OpenRCT2-v0.5.5-sha256sums.txt',
  'OpenRCT2-v0.5.5-windows-installer-x64.exe',
  'OpenRCT2-v0.5.5-windows-portable-arm64.zip',
  'OpenRCT2-v0.5.5-windows-portable-win32.zip',
  'OpenRCT2-v0.5.5-windows-portable-x64.zip',
  'OpenRCT2-v0.5.5-windows-symbols-x64.zip'
]

const openlocoNames = [
  'OpenLoco-v26.09-linux-x64.AppImage',
  'OpenLoco-v26.09-macos-arm64.zip',
  'OpenLoco-v26.09-windows-portable-win32.zip',
  'OpenLoco-v26.09-windows-portable-x64.zip',
  'OpenLoco-v26.09-windows-x64-symbols.zip'
]

function assets(names: string[]) {
  return names.map((name) => ({ name }))
}

function platform(file: string, id: 'darwin' | 'win32' | 'linux'): PlatformBuild {
  const parsed = validateGame(JSON.parse(readFileSync(file, 'utf8')))
  expect(parsed.errors).toEqual([])
  const build = parsed.game?.platforms[id]
  if (!build) throw new Error(`missing ${id}`)
  return build
}

describe('pickAsset', () => {
  const rct2 = 'catalog/games/openrct2.json'
  const loco = 'catalog/games/openloco.json'

  it('picks the portable build for this machine and skips installers', () => {
    expect(pickAsset(platform(rct2, 'darwin').asset, 'arm64', assets(openrct2Names))?.name).toBe(
      'OpenRCT2-v0.5.5-macos-universal.zip'
    )
    expect(
      pickAsset(platform(rct2, 'darwin').asset, 'arm64', assets(['OpenRCT2-v0.5.5-99-gb80a4a84e9-macos-universal.zip']))
        ?.name
    ).toBe('OpenRCT2-v0.5.5-99-gb80a4a84e9-macos-universal.zip')
    expect(pickAsset(platform(rct2, 'darwin').asset, 'x64', assets(openrct2Names))?.name).toBe(
      'OpenRCT2-v0.5.5-macos-universal.zip'
    )
    expect(pickAsset(platform(rct2, 'win32').asset, 'x64', assets(openrct2Names))?.name).toBe(
      'OpenRCT2-v0.5.5-windows-portable-x64.zip'
    )
    expect(pickAsset(platform(rct2, 'win32').asset, 'arm64', assets(openrct2Names))?.name).toBe(
      'OpenRCT2-v0.5.5-windows-portable-arm64.zip'
    )
    expect(pickAsset(platform(rct2, 'linux').asset, 'x64', assets(openrct2Names))?.name).toBe(
      'OpenRCT2-v0.5.5-linux-x86_64.AppImage'
    )
  })

  it('prefers a specific cpu build over a universal one', () => {
    const rule = platform(rct2, 'darwin').asset
    const chosen = pickAsset(rule, 'arm64', assets([...openrct2Names, 'OpenRCT2-v0.5.5-macos-arm64.zip']))
    expect(chosen?.name).toBe('OpenRCT2-v0.5.5-macos-arm64.zip')
  })

  it('does not treat x86_64 as a 32-bit build', () => {
    const rule = platform(rct2, 'win32').asset
    expect(pickAsset(rule, 'ia32', assets(['OpenRCT2-windows-portable-x86_64.zip']))).toBeNull()
    expect(pickAsset(rule, 'x64', assets(['OpenRCT2-windows-portable-x86_64.zip']))?.name).toBe(
      'OpenRCT2-windows-portable-x86_64.zip'
    )
  })

  it('hides games with no file for this Mac', () => {
    expect(pickAsset(platform(loco, 'darwin').asset, 'x64', assets(openlocoNames))).toBeNull()
    expect(pickAsset(platform(loco, 'darwin').asset, 'arm64', assets(openlocoNames))?.name).toBe(
      'OpenLoco-v26.09-macos-arm64.zip'
    )
    expect(pickAsset(platform(loco, 'linux').asset, 'arm64', assets(openlocoNames))).toBeNull()
  })

  it('filters pre-releases per channel', () => {
    expect(channelAccepts('exclude', false)).toBe(true)
    expect(channelAccepts('exclude', true)).toBe(false)
    expect(channelAccepts('only', true)).toBe(true)
    expect(channelAccepts('only', false)).toBe(false)
    expect(channelAccepts(undefined, true)).toBe(false)
    expect(channelAccepts('include', true)).toBe(true)
  })
})

describe('games added later', () => {
  const pick = (file: string, id: 'darwin' | 'win32' | 'linux', arch: string, names: string[]) =>
    pickAsset(platform(`catalog/games/${file}.json`, id).asset, arch, assets(names))?.name ?? null

  const openra = [
    'OpenRA-Dune-2000-x86_64.AppImage',
    'OpenRA-Red-Alert-x86_64.AppImage',
    'OpenRA-Red-Alert-x86_64.AppImage.zsync',
    'OpenRA-release-20250330-source.tar.bz2',
    'OpenRA-release-20250330-x64-winportable.zip',
    'OpenRA-release-20250330-x64.exe',
    'OpenRA-release-20250330-x86-winportable.zip',
    'OpenRA-release-20250330.dmg'
  ]
  const julius = [
    'julius-1.8.0-emscripten.zip',
    'julius-1.8.0-linux-x86_64.zip',
    'julius-1.8.0-linux.AppImage',
    'julius-1.8.0-mac.dmg',
    'julius-1.8.0-source.zip',
    'julius-1.8.0-switch.zip',
    'julius-1.8.0-windows.zip'
  ]
  const corsix = [
    'CorsixTH-0.70.1.dmg',
    'CorsixTH-0.70.1.tar.gz.sig',
    'CorsixTH-v0.70.1-Windows-x64.zip',
    'CorsixTH-v0.70.1-x86_64.AppImage',
    'CorsixTHInstaller.exe'
  ]
  const openttd = [
    'openttd-15.3-linux-generic-amd64.tar.xz',
    'openttd-15.3-macos-universal.dmg',
    'openttd-15.3-macos-universal.zip',
    'openttd-15.3-windows-arm64.exe',
    'openttd-15.3-windows-arm64.zip',
    'openttd-15.3-windows-win32.zip',
    'openttd-15.3-windows-win64.exe',
    'openttd-15.3-windows-win64.zip'
  ]

  it('picks the right OpenRA file', () => {
    expect(pick('openra', 'darwin', 'arm64', openra)).toBe('OpenRA-release-20250330.dmg')
    expect(pick('openra', 'win32', 'x64', openra)).toBe('OpenRA-release-20250330-x64-winportable.zip')
    expect(pick('openra', 'win32', 'ia32', openra)).toBe('OpenRA-release-20250330-x86-winportable.zip')
    expect(pick('openra', 'linux', 'x64', openra)).toBe('OpenRA-Red-Alert-x86_64.AppImage')
  })

  it('picks the right Julius and CorsixTH files', () => {
    expect(pick('julius', 'darwin', 'arm64', julius)).toBe('julius-1.8.0-mac.dmg')
    expect(pick('julius', 'win32', 'x64', julius)).toBe('julius-1.8.0-windows.zip')
    expect(pick('julius', 'linux', 'x64', julius)).toBe('julius-1.8.0-linux.AppImage')
    expect(pick('corsixth', 'darwin', 'x64', corsix)).toBe('CorsixTH-0.70.1.dmg')
    expect(pick('corsixth', 'win32', 'x64', corsix)).toBe('CorsixTH-v0.70.1-Windows-x64.zip')
    expect(pick('corsixth', 'linux', 'x64', corsix)).toBe('CorsixTH-v0.70.1-x86_64.AppImage')
  })

  it('picks the right OpenTTD file from the CDN manifest', () => {
    expect(pick('openttd', 'darwin', 'arm64', openttd)).toBe('openttd-15.3-macos-universal.zip')
    expect(pick('openttd', 'win32', 'x64', openttd)).toBe('openttd-15.3-windows-win64.zip')
    expect(pick('openttd', 'win32', 'arm64', openttd)).toBe('openttd-15.3-windows-arm64.zip')
    expect(pick('openttd', 'win32', 'ia32', openttd)).toBe('openttd-15.3-windows-win32.zip')
    expect(pick('openttd', 'linux', 'x64', openttd)).toBe('openttd-15.3-linux-generic-amd64.tar.xz')
  })
})
