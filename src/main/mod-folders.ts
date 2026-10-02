// Mods that are one folder each inside a game's plugin folder.
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import extractZip from 'extract-zip'
import { isFolderName } from '../shared/plugin-lists'
import type { Mod } from '../shared/types'
import { downloadFile } from './download'
import { cachedImageUrl } from './image-cache'

// OGL notes the version it installed here, to tell when a newer one is listed.
const VERSION_FILE = '.ogl-version'

function target(folder: string, name: string): string {
  if (!isFolderName(name)) throw new Error('That mod has an unusable name')
  return path.join(folder, name)
}

// Every mod folder with the version OGL installed, or null when the player put it there.
export async function modFolders(folder: string): Promise<Map<string, string | null>> {
  const found = new Map<string, string | null>()
  let entries
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const version = await readFile(path.join(folder, entry.name, VERSION_FILE), 'utf8').catch(() => null)
    found.set(entry.name, version?.trim() || null)
  }
  return found
}

// Fills a fresh folder through `fill`, then swaps it in, so a failed install leaves the old copy alone.
export async function replaceModFolder(
  folder: string,
  name: string,
  version: string,
  fill: (incoming: string) => Promise<void>
): Promise<void> {
  const destination = target(folder, name)
  // Beside the plugin folder, not inside it, where the game would take it for a plugin.
  const incoming = `${folder}.ogl-incoming`
  await rm(incoming, { recursive: true, force: true })
  await mkdir(incoming, { recursive: true })
  try {
    await fill(incoming)
    // An archive from GitHub wraps everything in one folder named after the repository.
    const entries = await readdir(incoming, { withFileTypes: true })
    const root = entries.length === 1 && entries[0].isDirectory() ? path.join(incoming, entries[0].name) : incoming
    await writeFile(path.join(root, VERSION_FILE), version)
    await mkdir(folder, { recursive: true })
    await rm(destination, { recursive: true, force: true })
    await rename(root, destination)
  } finally {
    await rm(incoming, { recursive: true, force: true })
  }
}

export async function downloadZipInto(
  url: string,
  incoming: string,
  onProgress: (received: number, total: number) => void
): Promise<void> {
  const archive = `${incoming}.zip`
  try {
    await downloadFile(url, archive, onProgress, AbortSignal.timeout(600000))
    await extractZip(archive, { dir: incoming })
  } finally {
    await rm(archive, { force: true })
  }
}

export async function removeModFolder(folder: string, name: string): Promise<void> {
  await rm(target(folder, name), { recursive: true, force: true })
}

// Pictures go through OGL's image cache, so each is downloaded once.
export function cachedArt(mod: Mod): Mod {
  return {
    ...mod,
    ...(mod.icon ? { icon: cachedImageUrl(mod.icon) } : {}),
    ...(mod.image ? { image: cachedImageUrl(mod.image) } : {})
  }
}
