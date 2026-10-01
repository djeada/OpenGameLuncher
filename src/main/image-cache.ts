import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, protocol } from 'electron'

export const IMAGE_SCHEME = 'ogl-img'
const MAX_BYTES = 40 * 1024 * 1024
const REFRESH_MS = 14 * 24 * 60 * 60 * 1000
const pending = new Map<string, Promise<{ body: Buffer; type: string } | null>>()

// Must run before the app is ready.
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: IMAGE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

// Art is shown through this address so each picture is downloaded once and then read from disk.
export function cachedImageUrl(url: string): string {
  return `${IMAGE_SCHEME}://art/?u=${encodeURIComponent(url)}`
}

function files(url: string): { body: string; meta: string } {
  const name = createHash('sha1').update(url).digest('hex')
  const directory = path.join(app.getPath('userData'), 'ogl-cache', 'images')
  return { body: path.join(directory, name), meta: path.join(directory, `${name}.json`) }
}

function sniff(body: Buffer): string | null {
  if (body.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n') return 'image/png'
  if (body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg'
  if (body.subarray(0, 4).toString('latin1') === 'GIF8') return 'image/gif'
  if (body.subarray(0, 4).toString('latin1') === 'RIFF' && body.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(body.subarray(0, 600).toString('utf8'))) return 'image/svg+xml'
  return null
}

function download(url: string): Promise<{ body: Buffer; type: string } | null> {
  const running = pending.get(url)
  if (running) return running
  const job = (async () => {
    const response = await fetch(url, { headers: { 'User-Agent': 'OGL' }, signal: AbortSignal.timeout(30000) })
    if (!response.ok) return null
    const body = Buffer.from(await response.arrayBuffer())
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return null
    const declared = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    const type = sniff(body) ?? (declared.startsWith('image/') ? declared : null)
    if (!type) return null
    const target = files(url)
    await mkdir(path.dirname(target.body), { recursive: true })
    await writeFile(target.body, body)
    await writeFile(target.meta, JSON.stringify({ type, url }))
    return { body, type }
  })()
    .catch(() => null)
    .finally(() => pending.delete(url))
  pending.set(url, job)
  return job
}

async function fromDisk(url: string): Promise<{ body: Buffer; type: string; age: number } | null> {
  const target = files(url)
  try {
    const [body, meta, info] = await Promise.all([readFile(target.body), readFile(target.meta, 'utf8'), stat(target.body)])
    return { body, type: (JSON.parse(meta) as { type: string }).type, age: Date.now() - info.mtimeMs }
  } catch {
    return null
  }
}

export function handleImageRequests(): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const source = new URL(request.url).searchParams.get('u') ?? ''
    let parsed: URL
    try {
      parsed = new URL(source)
    } catch {
      return new Response(null, { status: 400 })
    }
    if (parsed.protocol !== 'https:') return new Response(null, { status: 400 })

    const saved = await fromDisk(source)
    if (saved) {
      if (saved.age > REFRESH_MS) void download(source)
      return new Response(new Uint8Array(saved.body), {
        headers: { 'Content-Type': saved.type, 'Cache-Control': 'max-age=31536000' }
      })
    }
    const fresh = await download(source)
    if (!fresh) return new Response(null, { status: 502 })
    return new Response(new Uint8Array(fresh.body), {
      headers: { 'Content-Type': fresh.type, 'Cache-Control': 'max-age=31536000' }
    })
  })
}
