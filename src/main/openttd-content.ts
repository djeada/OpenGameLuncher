import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { connect } from 'node:net'
import { homedir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { app } from 'electron'
import {
  CONTENT_API,
  CONTENT_LINKS,
  CONTENT_SERVER,
  contentFileName,
  infoByContentId,
  infoByUniqueId,
  isContentId,
  readContentLinks,
  readContentPackages,
  readInfoPacket,
  splitPackets,
  type ContentInfo,
  type ContentKind
} from '../shared/openttd-content'
import pictures from '../shared/openttd-art.json'
import type { Mod, ModSource } from '../shared/types'
import { cached } from './cache'
import { downloadFile } from './download'
import { cachedImageUrl } from './image-cache'
import type { ModProvider } from './mods'

type Listing = { mods: Mod[]; files: Record<string, string> }

// Preview pictures from GRFCrawler, by GRF id. scripts/openttd-mod-art.mjs rebuilds the file.
const PICTURES: Record<string, string> = pictures
const PICTURE_HOST = 'https://grfcrawler.tt-forums.net'
const LIST_AGE = 6 * 60 * 60 * 1000
const listings = new Map<ContentKind, { at: number; listing: Promise<Listing> }>()

// OpenTTD keeps downloaded content in its personal folder, shared by every installed version.
function contentFolder(kind: ContentKind): string {
  const personal =
    process.platform === 'linux'
      ? path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share'), 'openttd')
      : path.join(app.getPath('documents'), 'OpenTTD')
  return path.join(personal, 'content_download', kind)
}

function listing(kind: ContentKind): Promise<Listing> {
  const known = listings.get(kind)
  if (known && Date.now() - known.at < LIST_AGE) return known.listing
  const pending = cached('mods', `openttd-${kind}`, LIST_AGE, async () => {
    const response = await fetch(`${CONTENT_API}/package/${kind}`, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`OpenTTD's content list returned ${response.status}`)
    const read = readContentPackages(await response.json())
    if (read.mods.length === 0) throw new Error("OpenTTD's content list is empty")
    return read
  })
  listings.set(kind, { at: Date.now(), listing: pending })
  pending.catch(() => listings.delete(kind))
  return pending
}

// Sends one request and collects the answers. The server says nothing about entries it does not
// know, so a short silence ends the wait.
function ask(request: Uint8Array, kind: ContentKind, expected: number): Promise<ContentInfo[]> {
  return new Promise((resolve, reject) => {
    const socket = connect(CONTENT_SERVER.port, CONTENT_SERVER.host)
    const found: ContentInfo[] = []
    let pending: Uint8Array = new Uint8Array(0)
    let seen = 0
    const finish = (error?: Error) => {
      socket.destroy()
      if (error) reject(error)
      else resolve(found)
    }
    socket.setTimeout(8000, () => {
      if (seen > 0) finish()
      else finish(new Error("OpenTTD's content server did not answer"))
    })
    socket.once('error', () => finish(new Error("OpenTTD's content server could not be reached")))
    socket.once('connect', () => socket.write(request))
    socket.on('data', (chunk: Buffer) => {
      try {
        const split = splitPackets(Buffer.concat([pending, chunk]))
        pending = split.rest
        for (const packet of split.packets) {
          seen += 1
          const info = readInfoPacket(packet, kind)
          if (info) found.push(info)
        }
        if (seen >= expected) finish()
      } catch (error) {
        finish(error instanceof Error ? error : new Error('Unreadable answer'))
      }
    })
  })
}

// The wanted entry plus everything it depends on, which OpenTTD refuses to load it without.
async function withDependencies(kind: ContentKind, uniqueId: string): Promise<ContentInfo[]> {
  const [wanted] = await ask(infoByUniqueId(kind, [uniqueId]), kind, 1)
  if (!wanted || wanted.uniqueId !== uniqueId) throw new Error('OpenTTD no longer offers that download')
  const entries = new Map([[wanted.contentId, wanted]])
  let missing = wanted.dependencies
  while (missing.length > 0 && entries.size < 40) {
    const found = await ask(infoByContentId(missing), kind, missing.length)
    for (const entry of found) entries.set(entry.contentId, entry)
    missing = [...new Set(found.flatMap((entry) => entry.dependencies))].filter((id) => !entries.has(id))
  }
  return [...entries.values()]
}

async function links(entries: ContentInfo[]): Promise<Map<number, string>> {
  const response = await fetch(CONTENT_LINKS, {
    method: 'POST',
    body: entries.map((entry) => `${entry.contentId}\n`).join(''),
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error(`OpenTTD's download service returned ${response.status}`)
  return readContentLinks(await response.text())
}

async function tarFiles(folder: string): Promise<string[]> {
  try {
    return (await readdir(folder)).filter((name) => /^[0-9a-f]{8}-.+\.tar$/.test(name))
  } catch {
    return []
  }
}

export function openttdContent(source: Extract<ModSource, { type: 'openttd-content' }>): ModProvider {
  const kind = source.kind
  const folder = contentFolder(kind)

  return {
    folder: () => folder,

    async list() {
      const { mods } = await listing(kind)
      if (kind !== 'newgrf') return mods
      return mods.map((mod) =>
        Object.hasOwn(PICTURES, mod.id)
          ? { ...mod, image: cachedImageUrl(`${PICTURE_HOST}/${encodeURI(PICTURES[mod.id])}`) }
          : mod
      )
    },

    async installed() {
      const present = await tarFiles(folder)
      if (present.length === 0) return []
      const latest = await listing(kind).then(
        (read) => read.files,
        () => ({}) as Record<string, string>
      )
      const ids = [...new Set(present.map((name) => name.slice(0, 8)))]
      return ids.map((id) => ({
        id,
        outdated: Object.hasOwn(latest, id) && !present.includes(`${latest[id]}.tar`)
      }))
    },

    async install(modId, onProgress) {
      if (!isContentId(modId)) throw new Error('That is not an OpenTTD content id')
      const entries = await withDependencies(kind, modId)
      const present = new Set(await tarFiles(folder))
      const wanted = entries
        .map((entry) => ({ ...entry, file: contentFileName(entry.uniqueId, entry.name, entry.version) }))
        .filter((entry) => !present.has(`${entry.file}.tar`))
      if (wanted.length === 0) return
      const urls = await links(wanted)
      const total = wanted.reduce((sum, entry) => sum + entry.size, 0)
      let done = 0
      await mkdir(folder, { recursive: true })

      for (const entry of wanted) {
        const url = urls.get(entry.contentId)
        if (!url) throw new Error(`OpenTTD gave no download for ${entry.name}`)
        // The file is stored under the name the server gives it, which starts with the entry's id.
        const name = path.basename(new URL(url).pathname)
        if (!name.startsWith(`${entry.uniqueId}-`) || !name.endsWith('.tar.gz') || name.includes('..')) {
          throw new Error(`OpenTTD gave an unexpected file for ${entry.name}`)
        }
        const archive = path.join(folder, name)
        const tar = archive.slice(0, -'.gz'.length)
        try {
          await downloadFile(url, archive, (received) => onProgress(done + received, total), AbortSignal.timeout(600000))
          // OpenTTD only reads plain .tar files.
          await pipeline(createReadStream(archive), createGunzip(), createWriteStream(`${tar}.part`))
          await rename(`${tar}.part`, tar)
        } finally {
          await rm(archive, { force: true })
          await rm(`${tar}.part`, { force: true })
        }
        for (const old of await tarFiles(folder)) {
          if (old.startsWith(`${entry.uniqueId}-`) && old !== path.basename(tar)) await rm(path.join(folder, old), { force: true })
        }
        done += entry.size
        onProgress(done, total)
      }
    },

    async uninstall(modId) {
      if (!isContentId(modId)) throw new Error('That is not an OpenTTD content id')
      for (const name of await tarFiles(folder)) {
        if (name.startsWith(`${modId}-`)) await rm(path.join(folder, name), { force: true })
      }
    }
  }
}
