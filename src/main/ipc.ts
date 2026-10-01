import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { ipc } from '../shared/channels'
import { hostLabel } from '../shared/labels'
import { gameArt } from './art'
import { installStore } from './install-store'
import { openWebGame } from './web-game'
import { catalog } from './catalog'
import {
  cancelInstall,
  installGame,
  launchGame,
  listBuilds,
  listInstalls,
  onDownload,
  setAutoUpdate,
  launchLog,
  showInstallFolder,
  uninstallGame
} from './library'
import { downloadLauncherUpdate, installLauncherUpdate, launcherUpdateState, onLauncherUpdate } from './updater'

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 200) {
    throw new Error(`${label} is missing`)
  }
  return value
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const send = (channel: string, payload: unknown) => {
    const window = getWindow()
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
  }

  catalog.subscribe((snapshot) => send(ipc.catalogUpdated, snapshot))
  onDownload((event) => send(ipc.download, event))
  onLauncherUpdate((update) => send(ipc.launcherUpdate, update))

  ipcMain.handle(ipc.getPlatform, () => ({
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    hostLabel: hostLabel(process.platform, process.arch)
  }))

  ipcMain.handle(ipc.getCatalog, () => catalog.current())
  ipcMain.handle(ipc.refreshCatalog, () => catalog.refresh())
  ipcMain.handle(ipc.getInstalls, () => listInstalls())
  ipcMain.handle(ipc.getLauncherUpdate, () => launcherUpdateState())

  ipcMain.handle(ipc.getBuilds, (_event, gameId: unknown, channelId: unknown) => {
    const game = catalog.game(asString(gameId, 'Game'))
    if (!game) throw new Error('That game is not in the catalog')
    return listBuilds(game, asString(channelId, 'Channel'))
  })

  ipcMain.handle(ipc.getArt, (_event, gameId: unknown) => {
    const game = catalog.game(asString(gameId, 'Game'))
    if (!game) throw new Error('That game is not in the catalog')
    return gameArt(game)
  })

  ipcMain.handle(ipc.setAutoUpdate, (_event, gameId: unknown, channelId: unknown, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Auto-update must be on or off')
    return setAutoUpdate(asString(gameId, 'Game'), asString(channelId, 'Channel'), enabled)
  })

  ipcMain.handle(ipc.install, (_event, gameId: unknown, channelId: unknown, tag: unknown) => {
    return installGame(asString(gameId, 'Game'), asString(channelId, 'Channel'), asString(tag, 'Version'))
  })

  ipcMain.handle(ipc.launch, (_event, gameId: unknown, channelId: unknown) => {
    return launchGame(asString(gameId, 'Game'), asString(channelId, 'Channel'))
  })

  ipcMain.handle(ipc.cancelInstall, (_event, gameId: unknown, channelId: unknown) => {
    cancelInstall(asString(gameId, 'Game'), asString(channelId, 'Channel'))
  })

  ipcMain.handle(ipc.playWeb, async (_event, gameId: unknown) => {
    const game = catalog.game(asString(gameId, 'Game'))
    if (!game) throw new Error('That game is not in the catalog')
    openWebGame(game)
    await (await installStore()).markWebPlayed(game.id)
  })

  ipcMain.handle(ipc.uninstall, (_event, gameId: unknown, channelId: unknown) => {
    return uninstallGame(asString(gameId, 'Game'), asString(channelId, 'Channel'))
  })

  ipcMain.handle(ipc.showLog, async (_event, gameId: unknown, channelId: unknown) => {
    const file = launchLog(asString(gameId, 'Game'), asString(channelId, 'Channel'))
    if (!file) throw new Error('No log yet. Start the game once first.')
    const problem = await shell.openPath(file)
    if (problem) shell.showItemInFolder(file)
  })

  ipcMain.handle(ipc.showInstall, async (_event, gameId: unknown, channelId: unknown) => {
    const file = await showInstallFolder(asString(gameId, 'Game'), asString(channelId, 'Channel'))
    if (file) shell.showItemInFolder(file)
  })

  ipcMain.handle(ipc.downloadLauncherUpdate, () => downloadLauncherUpdate())
  ipcMain.handle(ipc.installLauncherUpdate, () => installLauncherUpdate())

  ipcMain.handle(ipc.openExternal, async (_event, url: unknown) => {
    if (typeof url !== 'string') throw new Error('Missing address')
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error('Only https links can be opened')
    await shell.openExternal(parsed.toString())
  })
}
