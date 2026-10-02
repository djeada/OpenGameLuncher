// Browser-only stand-in for the preload bridge, so the renderer can be previewed with `vite` alone.
import type { OglApi } from '../shared/api'
import { resolveArt } from '../shared/art'
import openrct2 from '../../catalog/mods/openrct2.json'
import { validateGames } from '../shared/games'
import { readOpenrct2Plugins } from '../shared/plugin-lists'
import type {
  GameBuild,
  InstallView,
  LauncherUpdate,
  Mod,
  ModProgress,
  OriginalProgress,
  ProgressEvent
} from '../shared/types'

const files = import.meta.glob('../../catalog/games/[!_]*.json', { eager: true, import: 'default' })
const { games } = validateGames(Object.values(files))
games.sort((left, right) => left.name.localeCompare(right.name))
const installs: InstallView[] = [
  { gameId: 'openrct2', channelId: 'release', tag: 'v0.4.26', installedAt: new Date().toISOString(), autoUpdate: true }
]
const notes = `## Features
- [#24012] Add a new track design browser.
- Add **scenery search** to the object selection window.
## Fixes
- Fix a crash when loading older parks.
- Fix peeps walking through fences.`

function builds(prefix: string, prerelease: boolean): GameBuild[] {
  return [26, 25, 24, 23].map((minor, index) => ({
    tag: `${prefix}${minor}`,
    title: `${prefix}${minor}`,
    publishedAt: new Date(Date.now() - index * 30 * 86_400_000).toISOString(),
    prerelease,
    notes,
    asset: { name: `game-${minor}-macos-universal.zip`, url: '', size: 42_000_000 + index * 1_000_000 }
  }))
}

const modKinds = ['Trains', 'Town names', 'Objects', 'Road vehicles', 'Stations', 'Industries', 'Landscape']
const modPictures: Record<number, string> = {
  0: 'grf/301/grfcrawler-large.png',
  2: 'grf/339/Objects_Big.png',
  3: 'grf/128/ukrsbig.png',
  7: 'grf/340/ko_trainset_grfcrawler_big.png'
}
const mods: Mod[] = Array.from({ length: 180 }, (_, index) => ({
  id: (0x4f472b00 + index).toString(16),
  name: index === 0 ? 'OpenGFX+ Landscape' : `${modKinds[index % modKinds.length]} Set ${index}`,
  description:
    'Supplies gridless alternative landscape, a variable snowline, an optional alpine theme and some objects for eye candy.',
  authors: index % 3 === 0 ? ['planetmaker', 'Zephyris'] : ['andythenorth'],
  version: `1.${index % 9}.2`,
  updatedAt: new Date(Date.now() - index * 9 * 86_400_000).toISOString(),
  size: 140_000 + index * 310_000,
  category: index === 0 ? 'Landscape' : modKinds[index % modKinds.length],
  tags: index % 4 === 0 ? ['32bpp', 'High-res'] : [],
  ...(modPictures[index] ? { image: `https://grfcrawler.tt-forums.net/${modPictures[index]}` } : {}),
  ...(index % 2 === 0 ? { url: 'https://www.tt-forums.net/viewtopic.php?t=52396' } : {}),
  license: 'GPL v2'
}))
const installedMods = new Map<string, boolean>([[mods[0].id, false], [mods[3].id, true]])
const modListeners = new Set<(event: ModProgress) => void>()

const originalListeners = new Set<(event: OriginalProgress) => void>()
const originals = new Set<string>(new URLSearchParams(location.search).has('original-done') ? ['openloco'] : [])
let originalCode: (() => void) | null = null

const downloadListeners = new Set<(event: ProgressEvent) => void>()
const updateListeners = new Set<(update: LauncherUpdate) => void>()

export const mockApi: OglApi = {
  getPlatform: async () => ({ platform: 'darwin', arch: 'arm64', version: '0.1.0', hostLabel: 'Mac · Apple silicon' }),
  getCatalog: async () => ({ games, source: 'bundled' }),
  refreshCatalog: async () => ({ games, source: 'bundled' }),
  onCatalog: () => () => undefined,
  getBuilds: async (_gameId, channelId) => (channelId === 'develop' ? builds('v0.4.26-', true) : builds('v0.4.', false)),
  getArt: async (gameId) => resolveArt(games.find((game) => game.id === gameId)!, null),
  getInstalls: async () => [...installs],
  setAutoUpdate: async () => undefined,
  install: async (gameId, channelId, tag) => {
    for (let step = 1; step <= 10; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (step === 10) installs.push({ gameId, channelId, tag, installedAt: new Date().toISOString(), autoUpdate: true })
      const event: ProgressEvent = {
        gameId, channelId, tag, gameName: gameId, phase: step === 10 ? 'done' : 'downloading', received: step * 10, total: 100
      }
      for (const listener of downloadListeners) listener(event)
    }
  },
  launch: async () => undefined,
  cancelInstall: async () => undefined,
  uninstall: async (gameId, channelId) => {
    const index = installs.findIndex((item) => item.gameId === gameId && item.channelId === channelId)
    if (index >= 0) installs.splice(index, 1)
  },
  showInstall: async () => undefined,
  showLog: async () => undefined,
  playWeb: async (gameId) => {
    window.open(games.find((game) => game.id === gameId)?.web?.url)
    const index = installs.findIndex((item) => item.gameId === gameId && item.channelId === 'web')
    if (index >= 0) installs.splice(index, 1)
    installs.push({ gameId, channelId: 'web', tag: 'Browser', installedAt: new Date().toISOString(), autoUpdate: false })
  },
  onDownload: (listener) => {
    downloadListeners.add(listener)
    return () => downloadListeners.delete(listener)
  },
  getMods: async (gameId) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (gameId === 'openrct2') return readOpenrct2Plugins(openrct2)
    return mods
  },
  getInstalledMods: async () => [...installedMods].map(([id, outdated]) => ({ id, outdated })),
  installMod: async (gameId, modId) => {
    for (let step = 0; step <= 10; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      const event: ModProgress = { gameId, modId, phase: step === 10 ? 'done' : 'downloading', received: step * 10, total: 100 }
      if (step === 10) installedMods.set(modId, false)
      for (const listener of modListeners) listener(event)
    }
  },
  uninstallMod: async (_gameId, modId) => void installedMods.delete(modId),
  showMods: async () => undefined,
  onModProgress: (listener) => {
    modListeners.add(listener)
    return () => modListeners.delete(listener)
  },
  getOriginal: async (gameId) => ({ installed: originals.has(gameId), username: '' }),
  // The password "code" walks through the Steam Guard step, "wrong" through a refused sign-in.
  fetchOriginal: async (gameId, _username, password) => {
    const emit = (event: Omit<OriginalProgress, 'gameId'>) => {
      for (const listener of originalListeners) listener({ gameId, ...event })
    }
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    emit({ phase: 'preparing', received: 0, total: 0 })
    await pause(600)
    emit({ phase: 'signing-in', received: 0, total: 0 })
    await pause(900)
    if (password === 'wrong') throw new Error('Steam did not accept that name and password.')
    if (password === 'code') {
      emit({ phase: 'code', received: 0, total: 0 })
      await new Promise<void>((resolve) => (originalCode = resolve))
    }
    for (let step = 1; step <= 10; step += 1) {
      await pause(350)
      emit({ phase: 'downloading', received: step * 52_000_000, total: 520_000_000 })
    }
    emit({ phase: 'checking', received: 0, total: 0 })
    await pause(500)
    originals.add(gameId)
  },
  sendOriginalCode: async () => originalCode?.(),
  cancelOriginal: async () => undefined,
  signInOriginal: async () => undefined,
  showOriginal: async () => undefined,
  onOriginalProgress: (listener) => {
    originalListeners.add(listener)
    return () => originalListeners.delete(listener)
  },
  getLauncherUpdate: async () =>
    new URLSearchParams(location.search).has('update-error')
      ? {
          state: 'error',
          message: 'This copy of OGL cannot install updates by itself. Download the new version instead.',
          version: '0.2.0'
        }
      : { state: 'dev' },
  checkLauncherUpdate: async () => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { state: 'available', version: '0.2.0' }
  },
  downloadLauncherUpdate: async () => {
    for (let step = 1; step <= 10; step += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      for (const listener of updateListeners) listener({ state: 'downloading', version: '0.2.0', percent: step * 10 })
    }
    for (const listener of updateListeners) listener({ state: 'ready', version: '0.2.0' })
  },
  installLauncherUpdate: async () => undefined,
  onLauncherUpdate: (listener) => {
    updateListeners.add(listener)
    return () => updateListeners.delete(listener)
  },
  openExternal: async (url) => void window.open(url)
}

const requested = new URLSearchParams(location.search).get('game')
if (requested) localStorage.setItem('ogl.selected', requested)
