import type { ArchId, AssetRule, PrereleaseFilter } from './types'

function findTokens(filename: string, tokens: string[]): string[] {
  const found: string[] = []
  let rest = filename.toLowerCase()
  const ordered = [...tokens].sort((left, right) => right.length - left.length)
  for (const token of ordered) {
    const value = token.toLowerCase()
    if (!value || !rest.includes(value)) continue
    found.push(value)
    rest = rest.split(value).join(' ')
  }
  return found
}

function includesText(filename: string, token: string): boolean {
  return filename.toLowerCase().includes(token.toLowerCase())
}

export function pickAsset<T extends { name: string }>(
  rule: AssetRule,
  arch: string,
  assets: T[]
): T | null {
  const include = rule.include
  const exclude = rule.exclude ?? []
  const prefer = rule.prefer ?? []
  const archMap = rule.arch ?? {}
  const ownTokens = archMap[arch as ArchId] ?? []
  const allTokens = Object.values(archMap).flatMap((tokens) => tokens ?? [])
  const tokenOwners = new Map<string, number>()
  for (const tokens of Object.values(archMap)) {
    for (const token of tokens ?? []) {
      const key = token.toLowerCase()
      tokenOwners.set(key, (tokenOwners.get(key) ?? 0) + 1)
    }
  }
  const own = new Set(ownTokens.map((token) => token.toLowerCase()))

  let best: { asset: T; score: number } | null = null
  for (const asset of assets) {
    const filename = asset.name
    if (exclude.some((token) => token && includesText(filename, token))) continue
    if (include.length > 0 && !include.some((token) => includesText(filename, token))) continue

    const found = allTokens.length > 0 ? findTokens(filename, allTokens) : []
    const ownHit = found.some((token) => own.has(token))
    const otherHit = found.some((token) => !own.has(token))
    if (otherHit && !ownHit) continue

    const uniqueOwnHit = found.some((token) => own.has(token) && tokenOwners.get(token) === 1)
    let score = 1
    score += include.filter((token) => includesText(filename, token)).length
    if (uniqueOwnHit) score += 6
    else if (ownHit) score += 3
    score += prefer.filter((token) => includesText(filename, token)).length * 8
    if (!best || score > best.score) best = { asset, score }
  }
  return best?.asset ?? null
}

export function channelAccepts(filter: PrereleaseFilter | undefined, prerelease: boolean): boolean {
  const mode = filter ?? 'exclude'
  if (mode === 'include') return true
  if (mode === 'only') return prerelease
  return !prerelease
}

// Launch names are file names. A * matches any run of characters, for names that carry a version.
export function nameMatches(entry: string, pattern: string): boolean {
  if (!pattern.includes('*')) return entry === pattern
  const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${escaped.join('.*')}$`, 'i').test(entry)
}
