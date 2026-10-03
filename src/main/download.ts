import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { assertAssetUrl } from '../shared/urls'

const STALL_MS = 60 * 1000

// A connection that dies without closing, as when the computer sleeps, would otherwise wait forever.
async function readOrStall<T>(reader: ReadableStreamDefaultReader<T>): Promise<ReadableStreamReadResult<T>> {
  let timer: NodeJS.Timeout | undefined
  const stalled = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('The download stopped. Check the connection and try again.')), STALL_MS)
  })
  try {
    return await Promise.race([reader.read(), stalled])
  } finally {
    clearTimeout(timer)
  }
}

export async function downloadFile(
  url: string,
  destination: string,
  onProgress: (received: number, total: number) => void,
  signal: AbortSignal
): Promise<void> {
  assertAssetUrl(url)
  let current = url
  let response: Response | null = null
  for (let hop = 0; hop < 5; hop += 1) {
    assertAssetUrl(current)
    const next = await fetch(current, { redirect: 'manual', signal })
    if (next.status >= 300 && next.status < 400) {
      const location = next.headers.get('location')
      await next.body?.cancel()
      if (!location) throw new Error('Download redirect was empty')
      current = new URL(location, current).toString()
      continue
    }
    response = next
    break
  }
  if (!response) throw new Error('Too many redirects')
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status})`)

  await mkdir(path.dirname(destination), { recursive: true })
  const partial = `${destination}.part`
  const file = createWriteStream(partial)
  const total = Number(response.headers.get('content-length') ?? 0)
  let received = 0
  const reader = response.body.getReader()
  try {
    while (true) {
      const chunk = await readOrStall(reader)
      if (chunk.done) break
      received += chunk.value.byteLength
      onProgress(received, total)
      const buffer = Buffer.from(chunk.value)
      if (!file.write(buffer)) {
        await new Promise((resolve) => file.once('drain', resolve))
      }
    }
    await new Promise<void>((resolve, reject) => {
      file.once('error', reject)
      file.end(() => resolve())
    })
    await rename(partial, destination)
  } catch (error) {
    void reader.cancel().catch(() => undefined)
    file.destroy()
    await rm(partial, { force: true })
    throw error
  }
}
