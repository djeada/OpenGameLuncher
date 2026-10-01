import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nameMatches, pickAsset } from './assets'
import { validateGame } from './games'
import { itchFileEndpoint, itchVersion, readItchUploads } from './itch'
import { isAllowedAssetUrl } from './urls'

// Copied from the Stone Kingdoms itch.io page.
const page = `<div class="upload"><a data-upload_id="9855431" class="button download_btn" href="javascript:void(0);">Download</a><div class="info_column"><div class="upload_name"><strong title="StoneKingdoms_Win64_0.6.1.zip" class="name">StoneKingdoms_Win64_0.6.1.zip</strong> <span class="file_size"><span>276 MB</span></span></div></div></div><div class="upload"><a data-upload_id="9855440" class="button download_btn" href="javascript:void(0);">Download</a><div class="info_column"><div class="upload_name"><strong title="StoneKingdoms_Linux_Mac_0.6.1.zip" class="name">StoneKingdoms_Linux_Mac_0.6.1.zip</strong> <span class="file_size"><span>272 MB</span></span></div></div></div>`

describe('itch.io', () => {
  it('reads the uploads on a game page', () => {
    expect(readItchUploads(page)).toEqual([
      { id: '9855431', name: 'StoneKingdoms_Win64_0.6.1.zip', size: 276 * 1024 ** 2 },
      { id: '9855440', name: 'StoneKingdoms_Linux_Mac_0.6.1.zip', size: 272 * 1024 ** 2 }
    ])
  })

  it('takes the version from the file name', () => {
    expect(itchVersion('StoneKingdoms_Win64_0.6.1.zip')).toBe('0.6.1')
    expect(itchVersion('game.zip')).toBe('game')
  })

  it('only follows itch.io download mirrors', () => {
    expect(isAllowedAssetUrl('https://itchio-mirror.cb031a832f44726753d6267436f3b414.r2.cloudflarestorage.com/upload2/game/1/2')).toBe(true)
    expect(isAllowedAssetUrl('https://evil.r2.cloudflarestorage.com/x')).toBe(false)
    expect(() => itchFileEndpoint('https://a.itch.io/b', '12/../3')).toThrow()
  })

  it('picks the Stone Kingdoms file for each system', () => {
    const game = validateGame(JSON.parse(readFileSync('catalog/games/stone-kingdoms.json', 'utf8')))
    expect(game.errors).toEqual([])
    const uploads = readItchUploads(page).map((upload) => ({ name: upload.name }))
    const pick = (id: 'darwin' | 'win32' | 'linux') => pickAsset(game.game!.platforms[id]!.asset, 'x64', uploads)?.name
    expect(pick('win32')).toBe('StoneKingdoms_Win64_0.6.1.zip')
    expect(pick('darwin')).toBe('StoneKingdoms_Linux_Mac_0.6.1.zip')
    expect(pick('linux')).toBe('StoneKingdoms_Linux_Mac_0.6.1.zip')
    expect(game.game!.platforms.darwin!.runtime).toMatchObject({ owner: 'love2d', repo: 'love', tag: '11.5' })
  })

  it('picks the LÖVE runtime for each system', () => {
    const game = validateGame(JSON.parse(readFileSync('catalog/games/stone-kingdoms.json', 'utf8'))).game!
    const love = ['love-11.5-android.apk', 'love-11.5-macos.zip', 'love-11.5-win64.zip', 'love-11.5-x86_64.AppImage', 'love-11.5-linux-src.tar.gz']
    const assets = love.map((name) => ({ name }))
    expect(pickAsset(game.platforms.darwin!.runtime!.asset, 'arm64', assets)?.name).toBe('love-11.5-macos.zip')
    expect(pickAsset(game.platforms.linux!.runtime!.asset, 'x64', assets)?.name).toBe('love-11.5-x86_64.AppImage')
  })
})

describe('launch names', () => {
  it('matches a * in a launch file name', () => {
    expect(nameMatches('StoneKingdoms_Win64_0.6.1.exe', 'StoneKingdoms_Win64_*.exe')).toBe(true)
    expect(nameMatches('StoneKingdoms_Win64_0.6.1.exe.bak', 'StoneKingdoms_Win64_*.exe')).toBe(false)
    expect(nameMatches('love.exe', 'StoneKingdoms_Win64_*.exe')).toBe(false)
    expect(nameMatches('OpenTTD.app', 'OpenTTD.app')).toBe(true)
  })
})

describe('original game', () => {
  it('accepts a requirement with a store link and rejects plain http', () => {
    const base = { id: 'demo', name: 'Demo', tagline: 'x', accent: '#123456', web: { url: 'https://demo.org' } }
    expect(validateGame({ ...base, requires: { name: 'Caesar III', url: 'https://www.gog.com/en/game/caesar_3' } }).game?.requires).toEqual({
      name: 'Caesar III',
      url: 'https://www.gog.com/en/game/caesar_3'
    })
    expect(validateGame({ ...base, requires: { name: 'Caesar III', url: 'http://gog.com' } }).game).toBeNull()
  })
})
