import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { OglApi } from '../shared/api'
import { ipc } from '../shared/channels'

function listen<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T) => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: OglApi = {
  getPlatform: () => ipcRenderer.invoke(ipc.getPlatform),
  getCatalog: () => ipcRenderer.invoke(ipc.getCatalog),
  refreshCatalog: () => ipcRenderer.invoke(ipc.refreshCatalog),
  onCatalog: (listener) => listen(ipc.catalogUpdated, listener),
  getBuilds: (gameId, channelId) => ipcRenderer.invoke(ipc.getBuilds, gameId, channelId),
  getArt: (gameId) => ipcRenderer.invoke(ipc.getArt, gameId),
  getInstalls: () => ipcRenderer.invoke(ipc.getInstalls),
  setAutoUpdate: (gameId, channelId, enabled) => ipcRenderer.invoke(ipc.setAutoUpdate, gameId, channelId, enabled),
  install: (gameId, channelId, tag) => ipcRenderer.invoke(ipc.install, gameId, channelId, tag),
  launch: (gameId, channelId) => ipcRenderer.invoke(ipc.launch, gameId, channelId),
  cancelInstall: (gameId, channelId) => ipcRenderer.invoke(ipc.cancelInstall, gameId, channelId),
  playWeb: (gameId) => ipcRenderer.invoke(ipc.playWeb, gameId),
  uninstall: (gameId, channelId) => ipcRenderer.invoke(ipc.uninstall, gameId, channelId),
  showLog: (gameId, channelId) => ipcRenderer.invoke(ipc.showLog, gameId, channelId),
  showInstall: (gameId, channelId) => ipcRenderer.invoke(ipc.showInstall, gameId, channelId),
  onDownload: (listener) => listen(ipc.download, listener),
  getLauncherUpdate: () => ipcRenderer.invoke(ipc.getLauncherUpdate),
  downloadLauncherUpdate: () => ipcRenderer.invoke(ipc.downloadLauncherUpdate),
  installLauncherUpdate: () => ipcRenderer.invoke(ipc.installLauncherUpdate),
  onLauncherUpdate: (listener) => listen(ipc.launcherUpdate, listener),
  openExternal: (url) => ipcRenderer.invoke(ipc.openExternal, url)
}

contextBridge.exposeInMainWorld('ogl', api)
