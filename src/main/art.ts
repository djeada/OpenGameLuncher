import { readPageArt, resolveArt } from '../shared/art'
import type { Game, GameArt } from '../shared/types'
import { cached } from './cache'
import { cachedImageUrl } from './image-cache'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const memory = new Map<string, Promise<GameArt>>()

// Looked up once a week. A failed lookup is not stored, so it is tried again next time.
async function readWebsite(url: string): Promise<{ image?: string; icon?: string } | null> {
  try {
    return await cached('art-pages', url, WEEK_MS, async () => {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'OGL', Accept: 'text/html' },
        signal: AbortSignal.timeout(8000)
      })
      if (!response.ok || !response.url.startsWith('https://')) throw new Error('Website did not load')
      return readPageArt(await response.text(), response.url)
    })
  } catch {
    return null
  }
}

export function gameArt(game: Game): Promise<GameArt> {
  const key = JSON.stringify([game.id, game.cover, game.icon, game.website, game.screenshots])
  const known = memory.get(key)
  if (known) return known
  const needsWebsite = Boolean(game.website && (!game.cover || !game.icon))
  const pending = (needsWebsite && game.website ? readWebsite(game.website) : Promise.resolve(null)).then((page) => {
    const art = resolveArt(game, page)
    return {
      cover: art.cover ? cachedImageUrl(art.cover) : undefined,
      icon: art.icon ? cachedImageUrl(art.icon) : undefined,
      screenshots: art.screenshots.map(cachedImageUrl)
    }
  })
  memory.set(key, pending)
  return pending
}
