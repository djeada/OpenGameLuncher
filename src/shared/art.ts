import type { Game, GameArt } from './types'

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))
  return match ? (match[1] ?? match[2] ?? null) : null
}

function httpsUrl(value: string | null, base: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), base)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function readPageArt(html: string, base: string): { image?: string; icon?: string } {
  const head = html.slice(0, 200_000)
  let image: string | undefined
  let icon: string | undefined
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase()
    if (!image && (key === 'og:image' || key === 'twitter:image')) image = httpsUrl(attribute(tag, 'content'), base)
  }
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attribute(tag, 'rel') ?? '').toLowerCase()
    if (!icon && rel.includes('apple-touch-icon')) icon = httpsUrl(attribute(tag, 'href'), base)
  }
  return { image, icon }
}

export function resolveArt(game: Game, page: { image?: string; icon?: string } | null): GameArt {
  const screenshots = game.screenshots ?? []
  const source = game.channels[0]?.source
  const owner = source?.type === 'github-releases' ? source.owner : undefined
  return {
    cover: game.cover ?? page?.image ?? screenshots[0],
    icon: game.icon ?? page?.icon ?? (owner ? `https://github.com/${owner}.png?size=256` : undefined),
    screenshots
  }
}
