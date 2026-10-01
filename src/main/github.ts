import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import { readExpandedAssets, readReleaseNotes, readReleasesPage } from '../shared/github-pages'
import { assertCatalogLocation, assertCatalogUrl } from '../shared/urls'
import { cached as diskCached } from './cache'
import type { OglConfig } from '../shared/types'

export type RemoteAsset = {
  name: string
  url: string
  size: number
}

export type RemoteRelease = {
  tag: string
  title: string
  draft: boolean
  prerelease: boolean
  publishedAt: string
  notes: string
  assets: RemoteAsset[]
}

export function githubToken(): string | undefined {
  const token = process.env.OGL_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  const trimmed = token?.trim()
  return trimmed ? trimmed : undefined
}

type CachedResponse = { etag?: string; at: number; body: unknown }

const memory = new Map<string, CachedResponse>()
const FRESH_MS = 5 * 60 * 1000

function cacheFile(url: string): string {
  return path.join(app.getPath('userData'), 'ogl-cache', 'github-api', `${createHash('sha1').update(url).digest('hex')}.json`)
}

async function readCached(url: string): Promise<CachedResponse | null> {
  const hit = memory.get(url)
  if (hit) return hit
  try {
    const saved = JSON.parse(await readFile(cacheFile(url), 'utf8')) as CachedResponse
    memory.set(url, saved)
    return saved
  } catch {
    return null
  }
}

async function writeCached(url: string, entry: CachedResponse): Promise<void> {
  memory.set(url, entry)
  const file = cacheFile(url)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(entry)).catch(() => undefined)
}

class RateLimitError extends Error {}

function limitMessage(): string {
  const when = new Date(limitedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `GitHub's hourly limit for anonymous requests is used up. Try again after ${when}.`
}

async function pageText(url: string): Promise<string> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') throw new Error('Not a GitHub page')
  const response = await fetch(url, { headers: { 'User-Agent': 'OGL' }, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`GitHub returned ${response.status} for ${parsed.pathname}`)
  return response.text()
}

async function pageAssets(owner: string, repo: string, tag: string): Promise<RemoteAsset[]> {
  const html = await pageText(`https://github.com/${owner}/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`)
  return readExpandedAssets(html, owner, repo)
}

// The API-free route: the public releases page for tags and pre-release labels, the Atom feed for notes,
// and one small page per release for its files. Kept for half an hour so it is not repeated on every visit.
function releasesFromPages(owner: string, repo: string): Promise<RemoteRelease[]> {
  return diskCached('github-pages', `${owner}/${repo}`, 30 * 60 * 1000, async () => {
    const base = `https://github.com/${owner}/${repo}/releases`
    const [list, feed] = await Promise.all([pageText(base), pageText(`${base}.atom`).catch(() => '')])
    const notes = readReleaseNotes(feed)
    const releases = readReleasesPage(list, owner, repo).slice(0, 8)
    if (releases.length === 0) throw new Error(`${owner}/${repo} lists no releases`)
    return Promise.all(
      releases.map(async (release) => ({
        tag: release.tag,
        title: notes.get(release.tag)?.title || release.tag,
        draft: false,
        prerelease: release.prerelease,
        publishedAt: release.publishedAt,
        notes: notes.get(release.tag)?.notes ?? '',
        assets: await pageAssets(owner, repo, release.tag).catch(() => [])
      }))
    )
  })
}

// Set when GitHub says the hourly limit is used up, so OGL stops asking the API until it resets.
let limitedUntil = 0

function rateLimitMessage(response: Response): string {
  const reset = Number(response.headers.get('x-ratelimit-reset'))
  limitedUntil = Number.isFinite(reset) && reset > 0 ? reset * 1000 : Date.now() + 10 * 60 * 1000
  const when = Number.isFinite(reset) && reset > 0
    ? ` Try again after ${new Date(reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    : ' Try again in a few minutes.'
  return `GitHub's hourly limit for anonymous requests is used up.${when}`
}

// GitHub allows 60 anonymous API calls an hour. Responses are kept on disk and revalidated with
// If-None-Match: a 304 does not count against the limit, and a cached copy is used when the limit is hit.
async function githubGet(url: string, token: string | undefined, what: string): Promise<unknown> {
  assertCatalogUrl(url)
  const cached = await readCached(url)
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.body
  // OGL_NO_GITHUB_API=1 skips the API entirely and reads GitHub's public pages instead.
  if (process.env.OGL_NO_GITHUB_API === '1' && url.startsWith('https://api.github.com/repos/') && url.includes('/releases')) {
    throw new RateLimitError('GitHub API is switched off')
  }
  if (Date.now() < limitedUntil && url.startsWith('https://api.github.com/')) {
    if (cached) return cached.body
    throw new RateLimitError(limitMessage())
  }

  let current = url
  let response: Response | null = null
  try {
    for (let hop = 0; hop < 5; hop += 1) {
      assertCatalogUrl(current)
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OGL',
        'X-GitHub-Api-Version': '2022-11-28'
      }
      if (token) headers.Authorization = `Bearer ${token}`
      if (cached?.etag && current === url) headers['If-None-Match'] = cached.etag
      const next = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(20000) })
      if (next.status >= 300 && next.status < 400 && next.status !== 304) {
        const location = next.headers.get('location')
        await next.body?.cancel()
        if (!location) throw new Error(`Redirect while reading ${what} was empty`)
        current = new URL(location, current).toString()
        continue
      }
      response = next
      break
    }
  } catch (error) {
    if (cached) return cached.body
    throw error
  }
  if (!response) throw new Error(`Too many redirects while reading ${what}`)
  if (response.status === 304 && cached) {
    await writeCached(url, { ...cached, at: Date.now() })
    return cached.body
  }
  const limited =
    response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
  if (limited) {
    const message = rateLimitMessage(response)
    if (cached) return cached.body
    throw new RateLimitError(message)
  }
  if (!response.ok) {
    if (cached) return cached.body
    throw new Error(`GitHub returned ${response.status} while reading ${what}`)
  }
  const body = (await response.json()) as unknown
  await writeCached(url, { etag: response.headers.get('etag') ?? undefined, at: Date.now(), body })
  return body
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

export async function fetchReleases(owner: string, repo: string, token = githubToken()): Promise<RemoteRelease[]> {
  assertCatalogLocation({ owner, name: repo, branch: 'main', directory: 'catalog' })
  let payload: unknown
  try {
    payload = await githubGet(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`,
      token,
      `${owner}/${repo} releases`
    )
  } catch (error) {
    if (error instanceof RateLimitError) return releasesFromPages(owner, repo)
    throw error
  }
  if (!Array.isArray(payload)) {
    const message = asRecord(payload)?.message
    throw new Error(typeof message === 'string' ? message : 'GitHub releases could not be read')
  }
  return payload.map(toRelease).filter((release): release is RemoteRelease => release !== null)
}

export async function fetchRelease(owner: string, repo: string, tag: string, token = githubToken()): Promise<RemoteRelease> {
  assertCatalogLocation({ owner, name: repo, branch: 'main', directory: 'catalog' })
  if (!/^[A-Za-z0-9._-]+$/.test(tag)) throw new Error('Release tag is not usable')
  let payload: unknown
  try {
    payload = await githubGet(
      `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
      token,
      `${owner}/${repo} ${tag}`
    )
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error
    const assets = await diskCached('github-pages', `${owner}/${repo}@${tag}`, 24 * 60 * 60 * 1000, () =>
      pageAssets(owner, repo, tag)
    )
    return { tag, title: tag, draft: false, prerelease: false, publishedAt: '', notes: '', assets }
  }
  const release = toRelease(payload)
  if (!release) throw new Error(`${owner}/${repo} has no release ${tag}`)
  return release
}

function toRelease(entry: unknown): RemoteRelease | null {
  const record = asRecord(entry)
  if (!record || typeof record.tag_name !== 'string') return null
  const assets: RemoteAsset[] = []
  if (Array.isArray(record.assets)) {
    for (const asset of record.assets) {
      const item = asRecord(asset)
      if (!item || typeof item.name !== 'string' || typeof item.browser_download_url !== 'string') continue
      assets.push({
        name: item.name,
        url: item.browser_download_url,
        size: typeof item.size === 'number' ? item.size : 0
      })
    }
  }
  return {
    tag: record.tag_name,
    title: typeof record.name === 'string' && record.name.trim() ? record.name : record.tag_name,
    draft: Boolean(record.draft),
    prerelease: Boolean(record.prerelease),
    publishedAt: typeof record.published_at === 'string' ? record.published_at : '',
    notes: typeof record.body === 'string' ? record.body.slice(0, 6000) : '',
    assets
  }
}

export async function fetchCatalogDocuments(config: OglConfig, token = githubToken()): Promise<unknown[]> {
  assertCatalogLocation({
    owner: config.repository.owner,
    name: config.repository.name,
    branch: config.catalog.branch,
    directory: config.catalog.directory
  })
  const folder = await githubGet(
    `https://api.github.com/repos/${config.repository.owner}/${config.repository.name}/contents/${config.catalog.directory}?ref=${encodeURIComponent(config.catalog.branch)}`,
    token,
    'the game catalog'
  )
  if (!Array.isArray(folder)) {
    throw new Error(`Game catalog path is not a folder on ${config.catalog.branch}`)
  }
  const documents: unknown[] = []
  for (const entry of folder) {
    const record = asRecord(entry)
    if (!record || record.type !== 'file' || typeof record.name !== 'string') continue
    if (!record.name.endsWith('.json') || record.name.startsWith('_')) continue
    if (typeof record.download_url !== 'string') continue
    try {
      documents.push(await githubGet(record.download_url, token, record.name))
    } catch (error) {
      console.error(error)
    }
  }
  return documents
}
