import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { dedupeGames, isConfiguredRepository, resolveCatalog } from '../shared/catalog'
import { validateGame, validateGames } from '../shared/games'
import type { CatalogSnapshot, Game } from '../shared/types'
import { bundledGamesDir, readConfig } from './config'
import { fetchCatalogDocuments } from './github'

async function readGameDir(directory: string): Promise<Game[]> {
  if (!existsSync(directory)) return []
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  const games: Game[] = []
  for (const name of names) {
    try {
      const parsed = JSON.parse(await readFile(path.join(directory, name), 'utf8')) as unknown
      const result = validateGame(parsed)
      if (result.game) games.push(result.game)
      else console.error(`Skipping ${name}: ${result.errors.join('; ')}`)
    } catch (error) {
      console.error(`Skipping ${name}`, error)
    }
  }
  return games
}

function cacheFile(): string {
  return path.join(app.getPath('userData'), 'catalog-cache.json')
}

async function readCache(): Promise<Game[] | null> {
  try {
    const parsed = JSON.parse(await readFile(cacheFile(), 'utf8')) as unknown
    if (!Array.isArray(parsed)) return null
    const result = validateGames(parsed)
    return result.games
  } catch {
    return null
  }
}

async function writeCache(games: Game[]): Promise<void> {
  const file = cacheFile()
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(games))
}

// In development the catalog folder in this checkout is the source of truth,
// so edits to a game file show up without pushing them first.
function usesLocalCatalog(): boolean {
  return !app.isPackaged && process.env.OGL_REMOTE_CATALOG !== '1'
}

class CatalogService {
  private snapshot: CatalogSnapshot = { games: [], source: 'bundled' }
  private listeners = new Set<(snapshot: CatalogSnapshot) => void>()

  current(): CatalogSnapshot {
    return this.snapshot
  }

  game(id: string): Game | undefined {
    return this.snapshot.games.find((game) => game.id === id)
  }

  subscribe(listener: (snapshot: CatalogSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private publish(snapshot: CatalogSnapshot) {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener(snapshot)
  }

  async init(): Promise<void> {
    const bundled = await readGameDir(bundledGamesDir())
    const cache = usesLocalCatalog() ? null : await readCache()
    this.publish(resolveCatalog({ bundled, cache, remote: null }))
    void this.refresh()
  }

  async refresh(): Promise<CatalogSnapshot> {
    let config
    try {
      config = readConfig()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ogl.config.json could not be read'
      this.publish({ ...this.snapshot, error: message })
      return this.snapshot
    }
    if (usesLocalCatalog() || !isConfiguredRepository(config.repository)) return this.snapshot

    try {
      const documents = await fetchCatalogDocuments(config)
      const result = validateGames(documents)
      for (const error of result.errors) console.error(error)
      if (result.games.length === 0) {
        this.publish({ ...this.snapshot, error: 'The catalog branch has no valid games.' })
        return this.snapshot
      }
      const games = dedupeGames(result.games)
      await writeCache(games)
      this.publish({ games, source: 'remote' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not refresh the catalog'
      this.publish({ ...this.snapshot, error: message })
    }
    return this.snapshot
  }
}

export const catalog = new CatalogService()
