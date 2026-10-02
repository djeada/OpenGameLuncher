import { homedir } from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { readEndlessSkyPlugins } from '../shared/plugin-lists'
import { cached } from './cache'
import { cachedArt, downloadZipInto, modFolders, removeModFolder, replaceModFolder } from './mod-folders'
import type { ModProvider } from './mods'

const LIST = 'https://raw.githubusercontent.com/endless-sky/endless-sky-plugins/master/generated/plugins.json'
const LIST_AGE = 6 * 60 * 60 * 1000

// The game's own settings folder: where SDL puts "endless-sky" on each system.
function pluginFolder(): string {
  const base =
    process.platform === 'linux'
      ? process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share')
      : app.getPath('appData')
  return path.join(base, 'endless-sky', 'plugins')
}

function listing() {
  return cached('mods', 'endless-sky', LIST_AGE, async () => {
    const response = await fetch(LIST, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`The Endless Sky plugin list returned ${response.status}`)
    const read = readEndlessSkyPlugins(await response.json())
    if (read.mods.length === 0) throw new Error('The Endless Sky plugin list is empty')
    return read
  })
}

export function endlessSkyPlugins(): ModProvider {
  const folder = pluginFolder()
  return {
    folder: () => folder,

    async list() {
      const { mods } = await listing()
      return mods.map(cachedArt)
    },

    async installed() {
      const present = await modFolders(folder)
      if (present.size === 0) return []
      const mods = await listing().then(
        (read) => read.mods,
        () => []
      )
      const latest = new Map(mods.map((mod) => [mod.id, mod.version]))
      return [...present].map(([id, version]) => ({
        id,
        outdated: version !== null && latest.has(id) && latest.get(id) !== version
      }))
    },

    async install(modId, onProgress) {
      const { mods, downloads } = await listing()
      const mod = mods.find((item) => item.id === modId)
      if (!mod || !Object.hasOwn(downloads, modId)) throw new Error('That plugin is no longer listed')
      await replaceModFolder(folder, modId, mod.version, (incoming) => downloadZipInto(downloads[modId], incoming, onProgress))
    },

    uninstall: (modId) => removeModFolder(folder, modId)
  }
}
