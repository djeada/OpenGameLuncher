import path from 'node:path'
import { app } from 'electron'
import index from '../../catalog/mods/openrct2.json'
import { readOpenrct2Plugins } from '../shared/plugin-lists'
import { downloadFile } from './download'
import { fetchReleases } from './github'
import { cachedArt, modFolders, removeModFolder, replaceModFolder } from './mod-folders'
import type { ModProvider } from './mods'

const plugins = readOpenrct2Plugins(index)

// OpenRCT2 keeps its user folder in Documents on Windows and with the other settings elsewhere.
function pluginFolder(): string {
  const base = process.platform === 'win32' ? app.getPath('documents') : app.getPath('appData')
  return path.join(base, 'OpenRCT2', 'plugin')
}

// The game loads every .js below its plugin folder, so each plugin gets a folder of its own.
function folderName(modId: string): string {
  return modId.replace('/', '--')
}

export function openrct2Plugins(): ModProvider {
  const folder = pluginFolder()
  return {
    folder: () => folder,

    list: async () => plugins.map(cachedArt),

    async installed() {
      const present = await modFolders(folder)
      return plugins
        .filter((mod) => present.has(folderName(mod.id)))
        .map((mod) => {
          const version = present.get(folderName(mod.id))
          // The list is as old as this copy of OGL, so only a version it knows to be newer counts.
          return { id: mod.id, outdated: Boolean(version) && (version ?? '').localeCompare(mod.version, undefined, { numeric: true }) < 0 }
        })
    },

    async install(modId, onProgress) {
      if (!plugins.some((mod) => mod.id === modId)) throw new Error('OGL does not know that plugin')
      const [owner, repo] = modId.split('/')
      const releases = await fetchReleases(owner, repo)
      const release = releases.find(
        (item) => !item.draft && !item.prerelease && item.assets.some((asset) => asset.name.toLowerCase().endsWith('.js'))
      )
      if (!release) throw new Error('This plugin has no file to install right now. Its page explains how to add it by hand.')
      const files = release.assets.filter((asset) => asset.name.toLowerCase().endsWith('.js'))
      const total = files.reduce((sum, file) => sum + file.size, 0)
      await replaceModFolder(folder, folderName(modId), release.tag, async (incoming) => {
        let done = 0
        for (const file of files) {
          const name = path.basename(file.name)
          if (name !== file.name || name.startsWith('.')) throw new Error('The plugin file has an unusable name')
          await downloadFile(file.url, path.join(incoming, name), (received) => onProgress(done + received, total), AbortSignal.timeout(300000))
          done += file.size
        }
      })
    },

    uninstall: async (modId) => {
      if (!plugins.some((mod) => mod.id === modId)) throw new Error('OGL does not know that plugin')
      await removeModFolder(folder, folderName(modId))
    }
  }
}
