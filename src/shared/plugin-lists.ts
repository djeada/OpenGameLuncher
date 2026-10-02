// Readers for plugin lists that are plain files: one maintained by the Endless Sky project,
// one OGL builds for OpenRCT2 (scripts/openrct2-plugins.mjs).
import type { Mod } from './types'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// Plugins are stored in a folder named after them, so the name must be nothing but a name.
export function isFolderName(name: string): boolean {
  return name.length > 0 && name.length <= 100 && !/[\\/:*?"<>|\x00-\x1f]/.test(name) && !/^\.|\.$|^\s|\s$/.test(name)
}

// A zip GitHub builds from a tag, or one attached to a release.
function githubZip(url: string): boolean {
  return (
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:archive|releases\/download)\/[\w./%+-]+\.zip$/.test(url) &&
    !url.includes('..')
  )
}

function httpsUrl(value: unknown): string | undefined {
  const url = text(value)
  return url.startsWith('https://') ? url : undefined
}

// generated/plugins.json of endless-sky/endless-sky-plugins. Only plugins with a zip on GitHub are kept.
export function readEndlessSkyPlugins(input: unknown): { mods: Mod[]; downloads: Record<string, string> } {
  const mods: Mod[] = []
  const downloads: Record<string, string> = {}
  for (const entry of Array.isArray(input) ? input : []) {
    if (typeof entry !== 'object' || entry === null) continue
    const item = entry as Record<string, unknown>
    const name = text(item.name)
    const url = text(item.url)
    if (!isFolderName(name) || !githubZip(url) || Object.hasOwn(downloads, name)) continue
    const icon = httpsUrl(item.iconUrl)
    const homepage = httpsUrl(item.homepage)
    mods.push({
      id: name,
      name,
      description: text(item.description) || text(item.shortDescription),
      authors: text(item.authors) ? [text(item.authors)] : [],
      version: text(item.version),
      updatedAt: '',
      size: 0,
      category: 'Plugin',
      tags: [],
      ...(icon ? { icon } : {}),
      ...(homepage ? { url: homepage } : {}),
      ...(text(item.license) ? { license: text(item.license) } : {})
    })
    downloads[name] = url
  }
  return { mods, downloads }
}

// "openrct2-ride-price-manager" reads better as "Ride price manager".
function pluginTitle(repository: string): string {
  const words = repository
    .replace(/^open-?rct2?[-_.]?/i, '')
    .replace(/[-_.]?(?:open-?rct2?[-_.]?)?plugin$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
  const title = words || repository
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export function readOpenrct2Plugins(input: unknown): Mod[] {
  const list = (input as { plugins?: unknown } | null)?.plugins
  const mods: Mod[] = []
  for (const entry of Array.isArray(list) ? list : []) {
    const item = entry as Record<string, unknown>
    const id = text(item.id)
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(id) || id.includes('..')) continue
    const image = httpsUrl(item.image)
    const stars = typeof item.stars === 'number' ? item.stars : 0
    mods.push({
      id,
      name: pluginTitle(text(item.name) || id.split('/')[1]),
      description: text(item.description),
      authors: text(item.author) ? [text(item.author)] : [],
      version: text(item.version),
      updatedAt: text(item.updatedAt),
      size: 0,
      category: 'Plugin',
      tags: stars > 0 ? [`${stars} ${stars === 1 ? 'star' : 'stars'}`] : [],
      // The author's picture tells plugins apart at a glance better than initials do.
      icon: `https://github.com/${id.split('/')[0]}.png?size=96`,
      ...(image ? { image } : {}),
      url: `https://github.com/${id}`,
      ...(text(item.license) ? { license: text(item.license) } : {})
    })
  }
  return mods
}
