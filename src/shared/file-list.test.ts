import { describe, expect, it } from 'vitest'
import { fileListUrl, fileVersion, readFileList } from './file-list'
import { validateGame } from './games'

// Rows copied from releases.wildfiregames.com and from files.freeciv.org (a plain Apache listing).
const wildfire = `<table cellspacing="0" cellpadding="3">
<tr><th>File</th><th>Released</th><th>Size</th><th>Checksums</th><th>Signature</th><th>Download</th></tr>
<tr><td>0ad-0.28.0-macos-aarch64.dmg</td><td>2026-02-18</td><td style="text-align: right;">1667.36 MB</td><td><a href="0ad-0.28.0-macos-aarch64.dmg.md5sum">md5</a> <a href="0ad-0.28.0-macos-aarch64.dmg.sha1sum">sha1</a> <a href="0ad-0.28.0-macos-aarch64.dmg.sha256sum">sha256</a></td><td><a href="0ad-0.28.0-macos-aarch64.dmg.minisig">minisig</a></td><td><a href="0ad-0.28.0-macos-aarch64.dmg.torrent">torrent</a> <a href="0ad-0.28.0-macos-aarch64.dmg">https</a></td></tr><tr><td>0ad-0.28.0-x86_64.AppImage</td><td>2026-02-18</td><td style="text-align: right;">1500.00 MB</td><td><a href="0ad-0.28.0-x86_64.AppImage.md5sum">md5</a></td><td><a href="0ad-0.28.0-x86_64.AppImage.torrent">torrent</a> <a href="0ad-0.28.0-x86_64.AppImage">https</a></td></tr>
</table>
<ul><li><a href="libs">libs</a></li><li><a href="/stats.php">Statistics</a></li></ul>`

const apache = `<tr><th colspan="5"><hr></th></tr>
<tr><td valign="top"><img src="/icons/back.gif" alt="[PARENTDIR]"></td><td><a href="/packages/">Parent Directory</a></td><td>&nbsp;</td><td align="right">  - </td><td>&nbsp;</td></tr>
<tr><td valign="top"><img src="/icons/unknown.gif" alt="[   ]"></td><td><a href="Freeciv-gtk4-3.2.6-x86_64.AppImage">Freeciv-gtk4-3.2.6-x86_64.AppImage</a></td><td align="right">2026-09-04 00:38  </td><td align="right"> 77M</td><td>&nbsp;</td></tr>`

describe('download page', () => {
  it('reads one file per row and skips its checksums', () => {
    expect(readFileList(wildfire)).toEqual([
      { name: '0ad-0.28.0-macos-aarch64.dmg', size: Math.round(1667.36 * 1024 ** 2), publishedAt: '2026-02-18T00:00:00Z' },
      { name: '0ad-0.28.0-x86_64.AppImage', size: 1500 * 1024 ** 2, publishedAt: '2026-02-18T00:00:00Z' }
    ])
  })

  it('reads a plain folder listing', () => {
    expect(readFileList(apache)).toEqual([
      { name: 'Freeciv-gtk4-3.2.6-x86_64.AppImage', size: 77 * 1024 ** 2, publishedAt: '2026-09-04T00:00:00Z' }
    ])
  })

  it('takes the version from the file name', () => {
    expect(fileVersion('0ad-0.28.0-macos-aarch64.dmg')).toEqual({ tag: '0.28.0', prerelease: false })
    expect(fileVersion('0ad-0.28.0-x86_64.AppImage')).toEqual({ tag: '0.28.0', prerelease: false })
    expect(fileVersion('0ad-0.0.25b-alpha-osx64.dmg')).toEqual({ tag: '0.0.25b-alpha', prerelease: true })
    expect(fileVersion('Freeciv-gtk3.22-3.2.0-RC2-x86_64.AppImage')).toEqual({ tag: '3.2.0-RC2', prerelease: true })
    expect(fileVersion('styles.css')).toBeNull()
  })

  it('builds the file address under the page', () => {
    expect(fileListUrl('https://releases.wildfiregames.com/', '0ad-0.28.0-win64.exe')).toBe(
      'https://releases.wildfiregames.com/0ad-0.28.0-win64.exe'
    )
    expect(fileListUrl('https://releases.wildfiregames.com/rc', 'a.dmg')).toBe('https://releases.wildfiregames.com/rc/a.dmg')
    expect(() => fileListUrl('https://releases.wildfiregames.com/', '../a.dmg')).toThrow()
  })

  it('only accepts a page on a host OGL downloads from', () => {
    const game = (page: string) =>
      validateGame({
        id: 'demo',
        name: 'Demo',
        tagline: 'x',
        accent: '#123456',
        channels: [{ id: 'release', label: 'Release', source: { type: 'file-list', page } }],
        platforms: { linux: { asset: { include: ['appimage'] }, archive: 'file' } }
      }).game
    expect(game('https://releases.wildfiregames.com/')?.channels[0]?.source).toMatchObject({ type: 'file-list' })
    expect(game('https://example.org/files/')).toBeNull()
  })
})
