import { existsSync } from 'node:fs'
import { readdir, rename, rm, rmdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { readPaksetInfo } from '../shared/simutrans-paksets'
import { cached } from './cache'
import { downloadZipInto, modFolders, removeModFolder, replaceModFolder } from './mod-folders'
import type { ModProvider } from './mods'

const LIST = 'https://raw.githubusercontent.com/simutrans/simutrans/master/src/paksetinfo.h'
const LIST_AGE = 6 * 60 * 60 * 1000

// Simutrans's personal folder on each system, where the game's own installer puts paksets too.
function paksetFolder(): string {
  const base =
    process.platform === 'darwin'
      ? path.join(homedir(), 'Library', 'Simutrans')
      : process.platform === 'win32'
        ? path.join(app.getPath('documents'), 'Simutrans')
        : path.join(process.env.XDG_DATA_HOME || homedir(), 'simutrans')
  return path.join(base, 'paksets')
}

function listing() {
  return cached('mods', 'simutrans', LIST_AGE, async () => {
    const response = await fetch(LIST, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`The Simutrans pakset list returned ${response.status}`)
    const read = readPaksetInfo(await response.text())
    if (read.mods.length === 0) throw new Error('The Simutrans pakset list is empty')
    return read
  })
}

// Most pakset zips wrap the set in simutrans/<name>/, and a few put other folders beside it. The set's
// own files are lifted out, and the rest is dropped.
async function unwrap(incoming: string, name: string): Promise<void> {
  for (let depth = 0; depth < 3; depth += 1) {
    const entries = await readdir(incoming, { withFileTypes: true })
    if (entries.some((entry) => entry.name === 'ground.Outside.pak')) return
    const folders = entries.filter((entry) => entry.isDirectory())
    const inner =
      folders.find((entry) => entry.name.toLowerCase() === name.toLowerCase()) ??
      (entries.length === 1 ? folders[0] : undefined)
    if (!inner) return
    const wrapper = path.join(incoming, '.ogl-unwrap')
    await rename(path.join(incoming, inner.name), wrapper)
    for (const entry of entries) {
      if (entry !== inner) await rm(path.join(incoming, entry.name), { recursive: true, force: true })
    }
    for (const item of await readdir(wrapper)) await rename(path.join(wrapper, item), path.join(incoming, item))
    await rmdir(wrapper)
  }
}

export function simutransPaksets(): ModProvider {
  const folder = paksetFolder()
  return {
    folder: () => folder,

    async list() {
      return (await listing()).mods
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
      if (!mod || !Object.hasOwn(downloads, modId)) throw new Error('That pakset is no longer listed')
      await replaceModFolder(folder, modId, mod.version, async (incoming) => {
        await downloadZipInto(downloads[modId], incoming, onProgress)
        await unwrap(incoming, modId)
        if (!existsSync(path.join(incoming, 'ground.Outside.pak'))) throw new Error('That download does not look like a pakset')
      })
    },

    uninstall: (modId) => removeModFolder(folder, modId)
  }
}
