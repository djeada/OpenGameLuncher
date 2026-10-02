const ASSET_HOSTS = new Set([
  'github.com',
  'codeload.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'cdn.openttd.org',
  'bananas-cdn.openttd.org',
  // Simutrans paksets
  'downloads.sourceforge.net',
  'simutrans-germany.com',
  'codeberg.org'
])

const CATALOG_HOSTS = new Set([
  'api.github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'codeload.github.com'
])

const GITHUB_NAME = /^[A-Za-z0-9_.-]+$/

// itch.io hands out short-lived signed links on its own storage mirrors.
const ITCH_ASSET_HOST = /^(?:itchio-mirror\.[a-f0-9]+\.r2\.cloudflarestorage\.com|[a-z0-9-]+\.itch\.zone)$/

// SourceForge sends a download on to one of its mirrors.
const SOURCEFORGE_MIRROR = /^[a-z0-9-]+\.dl\.sourceforge\.net$/

function hostname(url: string, hosts: Set<string>): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && hosts.has(parsed.hostname)
  } catch {
    return false
  }
}

export function isAllowedAssetUrl(url: string): boolean {
  if (hostname(url, ASSET_HOSTS)) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && (ITCH_ASSET_HOST.test(parsed.hostname) || SOURCEFORGE_MIRROR.test(parsed.hostname))
  } catch {
    return false
  }
}

export function assertAssetUrl(url: string): void {
  if (!isAllowedAssetUrl(url)) {
    throw new Error('Refusing a download from a place OGL does not know')
  }
}

export function assertCatalogUrl(url: string): void {
  if (!hostname(url, CATALOG_HOSTS)) {
    throw new Error('Refusing a catalog address that is not on GitHub')
  }
}

export function assertCatalogLocation(location: {
  owner: string
  name: string
  branch: string
  directory: string
}): void {
  if (!GITHUB_NAME.test(location.owner) || !GITHUB_NAME.test(location.name)) {
    throw new Error('Catalog repository is not a GitHub owner and name')
  }
  if (
    !/^[A-Za-z0-9._/-]+$/.test(location.branch) ||
    location.branch.includes('..') ||
    location.branch.startsWith('/') ||
    location.branch.endsWith('/')
  ) {
    throw new Error('Catalog branch is not usable')
  }
  if (
    !/^[A-Za-z0-9._/-]+$/.test(location.directory) ||
    location.directory.includes('..') ||
    location.directory.startsWith('/')
  ) {
    throw new Error('Catalog directory is not usable')
  }
}

export function safeTag(tag: string): string {
  const cleaned = tag.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '')
  if (!cleaned) throw new Error('Version tag is not a usable folder name')
  return cleaned
}
