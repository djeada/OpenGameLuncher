// Reads GitHub's public release pages. OGL falls back to these when the API's hourly limit is used up.

export type PageRelease = { tag: string; prerelease: boolean; publishedAt: string }
export type PageAsset = { name: string; url: string; size: number }

const UNITS: Record<string, number> = { bytes: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

// The releases page lists each release as a block that starts with a link to its tag.
export function readReleasesPage(html: string, owner: string, repo: string): PageRelease[] {
  const link = new RegExp(`href="/${escapeRegExp(owner)}/${escapeRegExp(repo)}/releases/tag/([^"]+)"`, 'gi')
  const starts: { tag: string; index: number }[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(link)) {
    const tag = decodeURIComponent(match[1] ?? '')
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    starts.push({ tag, index: match.index })
  }
  return starts.map((start, position) => {
    const block = html.slice(start.index, starts[position + 1]?.index ?? html.length)
    return {
      tag: start.tag,
      prerelease: />\s*Pre-release\s*</.test(block),
      publishedAt: block.match(/<relative-time[^>]*datetime="([^"]+)"/)?.[1] ?? ''
    }
  })
}

export function readExpandedAssets(html: string, owner: string, repo: string): PageAsset[] {
  const link = new RegExp(
    `href="(/${escapeRegExp(owner)}/${escapeRegExp(repo)}/releases/download/[^"]+/([^"/]+))"`,
    'gi'
  )
  const matches = [...html.matchAll(link)]
  return matches.map((match, position) => {
    const block = html.slice(match.index, matches[position + 1]?.index ?? html.length)
    const size = block.match(/>\s*([\d.]+)\s*(Bytes|KB|MB|GB)\s*</i)
    return {
      name: decodeURIComponent(match[2] ?? ''),
      url: `https://github.com${decodeEntities(match[1] ?? '')}`,
      size: size ? Math.round(Number(size[1]) * (UNITS[(size[2] ?? '').toLowerCase()] ?? 1)) : 0
    }
  })
}

// The Atom feed carries each release's notes as escaped HTML.
export function readReleaseNotes(atom: string): Map<string, { title: string; notes: string }> {
  const notes = new Map<string, { title: string; notes: string }>()
  for (const entry of atom.split('<entry>').slice(1)) {
    const tag = entry.match(/href="[^"]*\/releases\/tag\/([^"]+)"/)?.[1]
    if (!tag) continue
    const content = decodeEntities(entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? '')
    const text = decodeEntities(
      content
        .replace(/<h[1-6][^>]*>/gi, '\n## ')
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<\/(p|h[1-6]|ul|ol|div)>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    )
      .replace(/\n{2,}/g, '\n')
      .trim()
    notes.set(decodeURIComponent(tag), {
      title: decodeEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim(),
      notes: text === 'No content.' ? '' : text.slice(0, 6000)
    })
  }
  return notes
}
