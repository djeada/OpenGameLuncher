import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { isConfiguredRepository } from '../shared/catalog'
import type { LauncherUpdate } from '../shared/types'
import { readConfig } from './config'

let current: LauncherUpdate = { state: 'checking' }
let announcedVersion = ''
const listeners = new Set<(update: LauncherUpdate) => void>()

function emit(update: LauncherUpdate) {
  current = update
  for (const listener of listeners) listener(update)
}

export function launcherUpdateState(): LauncherUpdate {
  return current
}

export function onLauncherUpdate(listener: (update: LauncherUpdate) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function startUpdater(): void {
  let configured = false
  try {
    configured = isConfiguredRepository(readConfig().repository)
  } catch {
    configured = false
  }
  if (!app.isPackaged) {
    emit({ state: 'dev' })
    return
  }
  if (!configured) {
    emit({ state: 'unconfigured' })
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) => {
    announcedVersion = info.version
    emit({ state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => emit({ state: 'none', version: app.getVersion() }))
  autoUpdater.on('download-progress', (progress) => {
    emit({
      state: 'downloading',
      version: announcedVersion || app.getVersion(),
      percent: progress.percent
    })
  })
  autoUpdater.on('update-downloaded', (info) => emit({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (error) => {
    const message = error instanceof Error ? error.message : 'Could not update OGL'
    emit({ state: 'error', message })
  })

  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Could not check for an OGL update'
    emit({ state: 'error', message })
  })
}

export async function downloadLauncherUpdate(): Promise<void> {
  if (current.state !== 'available' && current.state !== 'downloading') {
    throw new Error('There is no OGL update to download')
  }
  await autoUpdater.downloadUpdate()
}

export function installLauncherUpdate(): void {
  if (current.state !== 'ready') throw new Error('The OGL update is still downloading')
  autoUpdater.quitAndInstall()
}
