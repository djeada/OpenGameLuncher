import type { CatalogSource, Game } from './types'

const PLACEHOLDER_OWNER = 'your-github-user'

export function isConfiguredRepository(repository: { owner: string; name: string }): boolean {
  return Boolean(
    repository.owner &&
      repository.name &&
      repository.owner !== PLACEHOLDER_OWNER &&
      !repository.owner.includes(' ')
  )
}

export function dedupeGames(games: Game[]): Game[] {
  const byId = new Map<string, Game>()
  for (const game of games) byId.set(game.id, game)
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function resolveCatalog(input: {
  bundled: Game[]
  cache: Game[] | null
  remote: Game[] | null
}): { games: Game[]; source: CatalogSource } {
  if (input.remote && input.remote.length > 0) {
    return { games: dedupeGames(input.remote), source: 'remote' }
  }
  if (input.cache && input.cache.length > 0) {
    return { games: dedupeGames(input.cache), source: 'cache' }
  }
  return { games: dedupeGames(input.bundled), source: 'bundled' }
}
