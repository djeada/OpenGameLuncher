import { modSupport } from '../shared/mods'
import type { InstalledMod, Mod, ModProgress, ModSource } from '../shared/types'
import { endlessSkyPlugins } from './endless-sky-plugins'
import { openrct2Plugins } from './openrct2-plugins'
import { openttdContent } from './openttd-content'
import { simutransPaksets } from './simutrans-paksets'

// What a mod source has to be able to do. Installed mods are read from the game's own folders,
// so mods the player added inside the game show up as well.
export type ModProvider = {
  list(): Promise<Mod[]>
  installed(): Promise<InstalledMod[]>
  install(modId: string, onProgress: (received: number, total: number) => void): Promise<void>
  uninstall(modId: string): Promise<void>
  folder(): string
}

const providers: { [Type in ModSource['type']]: (source: Extract<ModSource, { type: Type }>) => ModProvider } = {
  'openttd-content': openttdContent,
  'endless-sky-plugins': endlessSkyPlugins,
  'openrct2-plugins': openrct2Plugins,
  'simutrans-paksets': simutransPaksets
}

const listeners = new Set<(event: ModProgress) => void>()
const jobs = new Set<string>()

function emit(event: ModProgress) {
  for (const listener of listeners) listener(event)
}

function provide<Source extends ModSource>(source: Source): ModProvider {
  return (providers[source.type] as (source: Source) => ModProvider)(source)
}

function providerFor(gameId: string): ModProvider {
  const support = modSupport(gameId)
  if (!support) throw new Error('OGL has no mods for this game')
  return provide(support.source)
}

export function onModProgress(listener: (event: ModProgress) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function listMods(gameId: string): Promise<Mod[]> {
  return providerFor(gameId).list()
}

export function installedMods(gameId: string): Promise<InstalledMod[]> {
  return providerFor(gameId).installed()
}

export async function modsFolder(gameId: string): Promise<string> {
  return providerFor(gameId).folder()
}

export async function installMod(gameId: string, modId: string): Promise<void> {
  const provider = providerFor(gameId)
  const key = `${gameId}:${modId}`
  if (jobs.has(key)) throw new Error('That is already installing')
  jobs.add(key)
  const base = { gameId, modId, received: 0, total: 0 }
  let lastEmit = 0
  try {
    emit({ ...base, phase: 'downloading' })
    await provider.install(modId, (received, total) => {
      const now = Date.now()
      if (now - lastEmit < 100 && received !== total) return
      lastEmit = now
      emit({ ...base, phase: 'downloading', received, total })
    })
    emit({ ...base, phase: 'done' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Install failed'
    emit({ ...base, phase: 'error', message })
    throw new Error(message)
  } finally {
    jobs.delete(key)
  }
}

export async function uninstallMod(gameId: string, modId: string): Promise<void> {
  if (jobs.has(`${gameId}:${modId}`)) throw new Error('Wait for the install to finish first')
  await providerFor(gameId).uninstall(modId)
}
