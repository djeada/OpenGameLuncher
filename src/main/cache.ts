import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

export type Cached<T> = { at: number; value: T }

function cacheFile(namespace: string, key: string): string {
  const name = createHash('sha1').update(key).digest('hex')
  return path.join(app.getPath('userData'), 'ogl-cache', namespace, `${name}.json`)
}

export async function readCache<T>(namespace: string, key: string): Promise<Cached<T> | null> {
  try {
    return JSON.parse(await readFile(cacheFile(namespace, key), 'utf8')) as Cached<T>
  } catch {
    return null
  }
}

export async function writeCache<T>(namespace: string, key: string, value: T): Promise<void> {
  const file = cacheFile(namespace, key)
  try {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify({ at: Date.now(), value } satisfies Cached<T>))
  } catch {
    // A cache that cannot be written only costs a request next time.
  }
}

// Returns a fresh cached value, or loads a new one and stores it. If loading fails, a stale copy is better than none.
export async function cached<T>(namespace: string, key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const saved = await readCache<T>(namespace, key)
  if (saved && Date.now() - saved.at < maxAgeMs) return saved.value
  try {
    const value = await load()
    await writeCache(namespace, key, value)
    return value
  } catch (error) {
    if (saved) return saved.value
    throw error
  }
}
