import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickAsset } from './assets'
import { validateGame } from './games'
import type { PlatformId } from './types'

// Real asset names from each project's latest stable release, and the file OGL should pick.
const cases: {
  id: string
  assets: string[]
  picks: [PlatformId, string, string | null][]
}[] = [
  {
    id: 'warzone2100',
    assets: [
      'warzone2100_linux_amd64.snap', 'warzone2100_linux_arm64.flatpak', 'warzone2100_linux_x86_64.flatpak',
      'warzone2100_macOS_universal.zip', 'warzone2100_macOS_universal_novideos.zip', 'warzone2100_src.tar.xz',
      'warzone2100_ubuntu22.04_amd64.deb', 'warzone2100_ubuntu22.04_amd64.DEBUGSYMBOLS.7z', 'warzone2100_web_wasm32_archive.zip',
      'warzone2100_win_arm64.DEBUGSYMBOLS.7z', 'warzone2100_win_arm64_archive.zip', 'warzone2100_win_installer.exe',
      'warzone2100_win_x64.DEBUGSYMBOLS.7z', 'warzone2100_win_x64_archive.zip', 'warzone2100_win_x86_archive.zip'
    ],
    picks: [
      ['darwin', 'arm64', 'warzone2100_macOS_universal.zip'],
      ['win32', 'x64', 'warzone2100_win_x64_archive.zip'],
      ['win32', 'arm64', 'warzone2100_win_arm64_archive.zip'],
      ['win32', 'ia32', 'warzone2100_win_x86_archive.zip']
    ]
  },
  {
    id: 'openhv',
    assets: [
      'OpenHV-20250725-x64-winportable.zip', 'OpenHV-20250725-x64.exe', 'OpenHV-20250725-x86-winportable.zip',
      'OpenHV-20250725-x86.exe', 'OpenHV-20250725-x86_64.AppImage', 'OpenHV-20250725-x86_64.AppImage.zsync', 'OpenHV-20250725.dmg'
    ],
    picks: [
      ['darwin', 'arm64', 'OpenHV-20250725.dmg'],
      ['win32', 'x64', 'OpenHV-20250725-x64-winportable.zip'],
      ['win32', 'ia32', 'OpenHV-20250725-x86-winportable.zip'],
      ['linux', 'x64', 'OpenHV-20250725-x86_64.AppImage']
    ]
  },
  {
    id: 'widelands',
    assets: [
      'Checksums-and-Signatures.zip', 'Widelands-1.3.1-arm64.exe', 'Widelands-1.3.1-macOS12_arm64.dmg',
      'Widelands-1.3.1-macOS12_x86.dmg', 'Widelands-1.3.1-x64.exe', 'Widelands-1.3.1-x86.exe', 'Widelands-1.3.1-x86_64.AppImage'
    ],
    picks: [
      ['darwin', 'arm64', 'Widelands-1.3.1-macOS12_arm64.dmg'],
      ['darwin', 'x64', 'Widelands-1.3.1-macOS12_x86.dmg'],
      ['linux', 'x64', 'Widelands-1.3.1-x86_64.AppImage']
    ]
  },
  {
    id: 'lincity-ng',
    assets: [
      'lincity-ng-2.15.0-Linux.tar.xz', 'lincity-ng-2.15.0-Source.tar.xz', 'lincity-ng-2.15.0-win64.exe',
      'lincity-ng-2.15.0-win64.exe.sha256', 'lincity-ng-2.15.0-win64.zip', 'lincity-ng-2.15.0-win64.zip.sha256'
    ],
    picks: [['win32', 'x64', 'lincity-ng-2.15.0-win64.zip']]
  },
  {
    id: 'simutrans',
    assets: [
      'makeobj-macos-arm-60-11.zip', 'makeobj-win-60-11.zip', 'makeobj_linux-x64-60-11.zip', 'simuandroid-124-5.apk',
      'simulinux-x64-124-5.zip', 'simumac-arm-124-5.zip', 'simumac-intel-124-5.zip', 'simuwin-gdi32-124-5.zip',
      'simuwin64-SDL2-124-5.zip'
    ],
    picks: [
      ['darwin', 'arm64', 'simumac-arm-124-5.zip'],
      ['darwin', 'x64', null],
      ['win32', 'x64', 'simuwin64-SDL2-124-5.zip'],
      ['win32', 'ia32', 'simuwin-gdi32-124-5.zip'],
      ['linux', 'x64', 'simulinux-x64-124-5.zip']
    ]
  },
  {
    id: 'augustus',
    assets: [
      'augustus-4.0.0-android.apk', 'augustus-4.0.0-linux.AppImage', 'augustus-4.0.0-mac.dmg',
      'augustus-4.0.0-switch.nro', 'augustus-4.0.0-vita.vpk', 'augustus-4.0.0-windows.zip'
    ],
    picks: [
      ['darwin', 'arm64', 'augustus-4.0.0-mac.dmg'],
      ['win32', 'x64', 'augustus-4.0.0-windows.zip'],
      ['linux', 'x64', 'augustus-4.0.0-linux.AppImage'],
      ['linux', 'arm64', null]
    ]
  },
  {
    id: 'unciv',
    assets: ['linuxFilesForJar.zip', 'Unciv-Linux64.zip', 'Unciv-signed.apk', 'Unciv-Windows64.zip', 'Unciv.jar', 'Unciv.msi', 'UncivServer.jar'],
    picks: [
      ['win32', 'x64', 'Unciv-Windows64.zip'],
      ['linux', 'x64', 'Unciv-Linux64.zip']
    ]
  },
  {
    id: 'fheroes2',
    assets: [
      'fheroes2_android.zip', 'fheroes2_macos_x86-64_SDL2.zip', 'fheroes2_ubuntu_arm64_SDL2.zip', 'fheroes2_ubuntu_x86-64_SDL2.zip',
      'fheroes2_windows_x64_SDL2.zip', 'fheroes2_windows_x64_SDL2_installer.exe', 'fheroes2_windows_x86_SDL2.zip',
      'fheroes2_windows_x86_SDL2_installer.exe'
    ],
    picks: [
      ['win32', 'x64', 'fheroes2_windows_x64_SDL2.zip'],
      ['win32', 'ia32', 'fheroes2_windows_x86_SDL2.zip'],
      ['linux', 'x64', 'fheroes2_ubuntu_x86-64_SDL2.zip'],
      ['linux', 'arm64', 'fheroes2_ubuntu_arm64_SDL2.zip']
    ]
  },
  {
    id: 'freeorion',
    assets: [
      'FreeOrion-v0.5.1.2_Source.tar.gz', 'FreeOrion_v0.5.1.2_MacOSX_10.15_arm64.dmg',
      'FreeOrion_v0.5.1.2_MacOSX_10.15_x86_64.dmg', 'FreeOrion_v0.5.1.2_Win32_Setup.exe'
    ],
    picks: [
      ['darwin', 'arm64', 'FreeOrion_v0.5.1.2_MacOSX_10.15_arm64.dmg'],
      ['darwin', 'x64', 'FreeOrion_v0.5.1.2_MacOSX_10.15_x86_64.dmg']
    ]
  },
  {
    id: 'endless-sky',
    assets: [
      'Endless-Sky-v0.11.2.dmg', 'EndlessSky-v0.11.2-win32-setup.exe', 'EndlessSky-v0.11.2-win64-setup.exe',
      'EndlessSky-win32-v0.11.2.zip', 'EndlessSky-win64-v0.11.2.zip', 'Endless_Sky-v0.11.2-x86_64.AppImage'
    ],
    picks: [
      ['darwin', 'arm64', 'Endless-Sky-v0.11.2.dmg'],
      ['win32', 'x64', 'EndlessSky-win64-v0.11.2.zip'],
      ['win32', 'ia32', 'EndlessSky-win32-v0.11.2.zip'],
      ['linux', 'x64', 'Endless_Sky-v0.11.2-x86_64.AppImage']
    ]
  },
  {
    id: 'naev',
    assets: [
      'naev-0.12.6-linux-x86-64.AppImage', 'naev-0.12.6-linux-x86-64.AppImage.zsync', 'naev-0.12.6-macos-universal.dmg',
      'naev-0.12.6-soundtrack.zip', 'naev-0.12.6-source.tar.xz', 'naev-0.12.6-win64.exe'
    ],
    picks: [
      ['darwin', 'arm64', 'naev-0.12.6-macos-universal.dmg'],
      ['linux', 'x64', 'naev-0.12.6-linux-x86-64.AppImage']
    ]
  },
  {
    id: 'pioneer',
    assets: ['pioneer-20260907-win.exe', 'pioneer-linux-x64-20260907.tar.gz', 'Pioneer-x86_64.AppImage'],
    picks: [['linux', 'x64', 'Pioneer-x86_64.AppImage']]
  },
  {
    id: 'devilutionx',
    assets: [
      'devilutionx-linux-aarch64.tar.xz', 'devilutionx-linux-i386.tar.xz', 'devilutionx-linux-x86_64.appimage',
      'devilutionx-linux-x86_64.tar.xz', 'devilutionx-macOS-10.4-tiger-ppc.dmg', 'devilutionx-macOS-intel-x86.dmg',
      'devilutionx-macOS-universal.dmg', 'devilutionx-windows-i386.zip', 'devilutionx-windows-x86_64.zip',
      'devilutionx-windows-xp-32bit.zip', 'devilutionx-xbox.zip'
    ],
    picks: [
      ['darwin', 'arm64', 'devilutionx-macOS-universal.dmg'],
      ['darwin', 'x64', 'devilutionx-macOS-universal.dmg'],
      ['win32', 'x64', 'devilutionx-windows-x86_64.zip'],
      ['win32', 'ia32', 'devilutionx-windows-i386.zip'],
      ['linux', 'x64', 'devilutionx-linux-x86_64.appimage']
    ]
  },
  {
    id: 'shattered-pixel-dungeon',
    assets: [
      'ShatteredPD-v4.0.0-Android.apk', 'ShatteredPD-v4.0.0-GPlay.apk', 'ShatteredPD-v4.0.0-Java.jar',
      'ShatteredPD-v4.0.0-Linux.zip', 'ShatteredPD-v4.0.0-macOS.zip', 'ShatteredPD-v4.0.0-Windows.zip'
    ],
    picks: [
      ['darwin', 'arm64', 'ShatteredPD-v4.0.0-macOS.zip'],
      ['win32', 'x64', 'ShatteredPD-v4.0.0-Windows.zip'],
      ['linux', 'x64', 'ShatteredPD-v4.0.0-Linux.zip'],
      ['linux', 'arm64', null]
    ]
  },
  {
    id: 'the-powder-toy',
    assets: [
      'powder-v100.1.400+steam-x86_64-darwin-macos.dmg', 'powder-v100.1.400+steam-x86_64-windows-mingw.exe',
      'powder-v100.1.400-aarch64-darwin-macos.dmg', 'powder-v100.1.400-aarch64-linux-gnu', 'powder-v100.1.400-aarch64-linux-gnu.dbg',
      'powder-v100.1.400-aarch64-windows-msvc.exe', 'powder-v100.1.400-aarch64-windows-msvc.pdb',
      'powder-v100.1.400-wasm32-emscripten-emscripten.tar', 'powder-v100.1.400-x86-windows-mingw.exe',
      'powder-v100.1.400-x86_64-darwin-macos.dmg', 'powder-v100.1.400-x86_64-linux-gnu', 'powder-v100.1.400-x86_64-windows-mingw.exe'
    ],
    picks: [
      ['darwin', 'arm64', 'powder-v100.1.400-aarch64-darwin-macos.dmg'],
      ['darwin', 'x64', 'powder-v100.1.400-x86_64-darwin-macos.dmg'],
      ['win32', 'x64', 'powder-v100.1.400-x86_64-windows-mingw.exe'],
      ['win32', 'arm64', 'powder-v100.1.400-aarch64-windows-msvc.exe'],
      ['win32', 'ia32', 'powder-v100.1.400-x86-windows-mingw.exe'],
      ['linux', 'x64', 'powder-v100.1.400-x86_64-linux-gnu'],
      ['linux', 'arm64', 'powder-v100.1.400-aarch64-linux-gnu']
    ]
  },
  {
    id: 'cataclysm-dda',
    assets: [
      'cdda-android-x64-2026-09-19-2324.apk', 'cdda-linux-terminal-only-x64-2026-09-19-2324.tar.gz',
      'cdda-linux-with-graphics-and-sounds-x64-2026-09-19-2324.tar.gz', 'cdda-linux-with-graphics-x64-2026-09-19-2324.tar.gz',
      'cdda-osx-terminal-only-universal-2026-09-19-2324.dmg', 'cdda-osx-with-graphics-universal-2026-09-19-2324.dmg',
      'cdda-windows-with-graphics-and-sounds-x64-2026-09-19-2324.zip', 'cdda-windows-with-graphics-x64-2026-09-19-2324.zip'
    ],
    picks: [
      ['darwin', 'arm64', 'cdda-osx-with-graphics-universal-2026-09-19-2324.dmg'],
      ['win32', 'x64', 'cdda-windows-with-graphics-and-sounds-x64-2026-09-19-2324.zip'],
      ['linux', 'x64', 'cdda-linux-with-graphics-and-sounds-x64-2026-09-19-2324.tar.gz']
    ]
  }
]

describe('catalog asset rules against real releases', () => {
  for (const item of cases) {
    it(`picks the right ${item.id} file`, () => {
      const result = validateGame(JSON.parse(readFileSync(`catalog/games/${item.id}.json`, 'utf8')))
      expect(result.errors).toEqual([])
      const assets = item.assets.map((name) => ({ name }))
      for (const [platform, arch, expected] of item.picks) {
        const rule = result.game?.platforms[platform]?.asset
        const picked = rule ? (pickAsset(rule, arch, assets)?.name ?? null) : null
        expect(picked, `${item.id} ${platform} ${arch}`).toBe(expected)
      }
    })
  }
})
