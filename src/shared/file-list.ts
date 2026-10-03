export type ListedFile = { name: string; size: number; publishedAt: string }

const UNITS: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 }

// Reads a download page that lists one file per table row, such as a web server's folder listing.
// A row may also link checksums and signatures of the file; those names are longer, so the shortest link is the file.
export function readFileList(html: string): ListedFile[] {
  const files: ListedFile[] = []
  const seen = new Set<string>()
  for (const row of html.split(/<tr\b/i).slice(1)) {
    const links = [...row.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1] ?? '')
      .filter((link) => /^[A-Za-z0-9][A-Za-z0-9._+-]*\.[A-Za-z0-9]+$/.test(link))
      .sort((left, right) => left.length - right.length)
    const name = links[0]
    if (!name || seen.has(name)) continue
    seen.add(name)
    const text = row
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .split(name)
      .join(' ')
    const date = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? ''
    const size = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*([KMG])B?(?=\s|$)/)
    files.push({
      name,
      size: size ? Math.round(Number(size[1]) * (UNITS[size[2] ?? ''] ?? 1)) : 0,
      publishedAt: date ? `${date}T00:00:00Z` : ''
    })
  }
  return files
}

// The version is the last number in the file name. A following alpha, beta or rc marks a pre-release.
export function fileVersion(fileName: string): { tag: string; prerelease: boolean } | null {
  const match = [...fileName.matchAll(/(\d+(?:\.\d+){1,3}[a-z]?)(?:[-_.]?((?:alpha|beta|rc)\d*))?(?![A-Za-z0-9])/gi)].at(-1)
  if (!match?.[1]) return null
  return { tag: match[2] ? `${match[1]}-${match[2]}` : match[1], prerelease: Boolean(match[2]) }
}

export function fileListUrl(page: string, name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(name) || name.includes('..')) throw new Error('The listed file name is not usable')
  return new URL(name, page.endsWith('/') ? page : `${page}/`).toString()
}
