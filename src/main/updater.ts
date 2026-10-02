import { readFileSync } from 'node:fs'
import path from 'node:path'
import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { isConfiguredRepository } from '../shared/catalog'
import { describeUpdateError } from '../shared/update-error'
import type { LauncherUpdate } from '../shared/types'
import { readConfig } from './config'

let current: LauncherUpdate = { state: 'checking' }
let announcedVersion = ''
let started = false
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

// macOS only installs an update into an app signed with a Developer ID.
// The release build records whether it was, in the packaged package.json.
function installsOwnUpdates(): boolean {
  if (process.platform !== 'darwin') return true
  try {
    const meta = JSON.parse(readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8')) as { macSigned?: boolean }
    return meta.macSigned === true
  } catch {
    return false
  }
}

function fail(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  console.error('OGL update failed:', raw)
  const failure = describeUpdateError(raw)
  emit({
    state: 'error',
    message: failure.message,
    ...(failure.manual && announcedVersion ? { version: announcedVersion } : {})
  })
}

function openReleasePage(version: string): Promise<void> {
  const { owner, name } = readConfig().repository
  return shell.openExternal(`https://github.com/${owner}/${name}/releases/tag/v${version}`)
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
    emit({ state: 'available', version: info.version, ...(installsOwnUpdates() ? {} : { manual: true }) })
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
  autoUpdater.on('error', (error) => fail(error))

  started = true
  void checkLauncherUpdate()
}

// Asks GitHub for the newest release again. A download that is running or finished is left alone.
export async function checkLauncherUpdate(): Promise<LauncherUpdate> {
  if (!started || current.state === 'downloading' || current.state === 'ready') return current
  emit({ state: 'checking' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    fail(error)
  }
  return current
}

export async function downloadLauncherUpdate(): Promise<void> {
  if (current.state === 'error' && current.version) return openReleasePage(current.version)
  if (current.state !== 'available' && current.state !== 'downloading') {
    throw new Error('There is no OGL update to download')
  }
  if (current.state === 'available' && current.manual) return openReleasePage(current.version)
  await autoUpdater.downloadUpdate()
}

export function installLauncherUpdate(): void {
  if (current.state !== 'ready') throw new Error('The OGL update is still downloading')
  autoUpdater.quitAndInstall()
}
