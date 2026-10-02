// Browser-only stand-in for the preload bridge, so the renderer can be previewed with `vite` alone.
import type { OglApi } from '../shared/api'
import { resolveArt } from '../shared/art'
import { validateGames } from '../shared/games'
import type { GameBuild, InstallView, LauncherUpdate, ProgressEvent } from '../shared/types'

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
  getLauncherUpdate: async () => ({ state: 'dev' }),
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
