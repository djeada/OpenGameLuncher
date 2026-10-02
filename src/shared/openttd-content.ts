// OpenTTD's online content (BaNaNaS). The list comes from its public API. Download links come from
// the content server the game itself talks to: it answers a binary request with the entry's numeric
// id, which a second, plain web request turns into a link on OpenTTD's CDN.
import type { Mod } from './types'

export const CONTENT_API = 'https://bananas-api.openttd.org'
export const CONTENT_LINKS = 'https://binaries.openttd.org/bananas'
export const CONTENT_SERVER = { host: 'content.openttd.org', port: 3978 }

const CONTENT_TYPES = { newgrf: 2 } as const
const PACKET_INFO_ID = 1
const PACKET_INFO_EXTID = 2
const PACKET_INFO = 4
const UNIQUE_ID = /^[0-9a-f]{8}$/

const CATEGORIES: Record<string, string> = {
  aircraft: 'Aircraft',
  airport: 'Airports',
  bridge: 'Bridges',
  economy: 'Economy',
  gui: 'Interface',
  industry: 'Industries',
  landscape: 'Landscape',
  mixed: 'Mixed',
  object: 'Objects',
  'rail-infra': 'Rail',
  'rail-station': 'Stations',
  'road-infra': 'Roads',
  'road-stop': 'Road stops',
  'road-vehicle': 'Road vehicles',
  ship: 'Ships',
  signal: 'Signals',
  town: 'Towns',
  townname: 'Town names',
  train: 'Trains',
  vehicle: 'Vehicles',
  'water-infra': 'Water'
}

export type ContentKind = keyof typeof CONTENT_TYPES

export type ContentInfo = {
  contentId: number
  size: number
  name: string
  version: string
  uniqueId: string
  dependencies: number[]
}

export function isContentId(value: string): boolean {
  return UNIQUE_ID.test(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// The server names files this way, and the game looks for them under the same name.
function safeName(name: string): string {
  let safe = ''
  for (const letter of name) {
    if (/[A-Za-z0-9.]/.test(letter)) safe += letter
    else if (safe && !safe.endsWith('_')) safe += '_'
  }
  return safe.replace(/^[._]+|[._]+$/g, '')
}

export function contentFileName(uniqueId: string, name: string, version: string): string {
  return `${uniqueId}-${safeName(name)}-${safeName(version)}`
}

// Reads the API's package list. Each package becomes one mod at its newest version.
export function readContentPackages(input: unknown): { mods: Mod[]; files: Record<string, string> } {
  const mods: Mod[] = []
  const files: Record<string, string> = {}
  for (const entry of Array.isArray(input) ? input : []) {
    if (typeof entry !== 'object' || entry === null) continue
    const item = entry as Record<string, unknown>
    const id = text(item['unique-id'])
    const versions = Array.isArray(item.versions) ? (item.versions as Record<string, unknown>[]) : []
    const latest = versions
      .filter((version) => version && version.availability === 'new-games')
      .sort((left, right) => text(left['upload-date']).localeCompare(text(right['upload-date'])))
      .at(-1)
    const name = text(latest?.name) || text(item.name)
    const version = text(latest?.version)
    if (!isContentId(id) || !latest || !name || !version) continue

    const kind = (latest.classification ?? {}) as Record<string, unknown>
    const tags: string[] = []
    if (kind.palette === '32bpp') tags.push('32bpp')
    if (kind['has-high-res'] === true) tags.push('High-res')
    if (kind['has-sound-effects'] === true) tags.push('Sounds')
    const url = text(latest.url) || text(item.url)
    const authors = Array.isArray(item.authors)
      ? item.authors.map((author) => text((author as Record<string, unknown> | null)?.['display-name'])).filter(Boolean)
      : []
    mods.push({
      id,
      name,
      description: text(latest.description) || text(item.description),
      authors,
      version,
      updatedAt: text(latest['upload-date']),
      size: typeof latest.filesize === 'number' ? latest.filesize : 0,
      category: CATEGORIES[text(kind.set)] ?? 'Other',
      tags,
      ...(url.startsWith('https://') ? { url } : {}),
      ...(text(latest.license) ? { license: text(latest.license) } : {})
    })
    files[id] = contentFileName(id, name, version)
  }
  return { mods, files }
}

function packet(type: number, body: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(body.length + 3)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, bytes.length, true)
  view.setUint8(2, type)
  bytes.set(body, 3)
  return bytes
}

// Asks for entries by the id their authors gave them (for a NewGRF, its GRF id).
export function infoByUniqueId(kind: ContentKind, uniqueIds: string[]): Uint8Array {
  if (uniqueIds.length === 0 || uniqueIds.length > 255 || !uniqueIds.every(isContentId)) {
    throw new Error('That is not an OpenTTD content id')
  }
  const body = new Uint8Array(1 + uniqueIds.length * 5)
  const view = new DataView(body.buffer)
  view.setUint8(0, uniqueIds.length)
  uniqueIds.forEach((id, index) => {
    view.setUint8(1 + index * 5, CONTENT_TYPES[kind])
    view.setUint32(2 + index * 5, Number.parseInt(id, 16), true)
  })
  return packet(PACKET_INFO_EXTID, body)
}

// Asks for entries by the server's own numeric id, which is how dependencies are named.
export function infoByContentId(contentIds: number[]): Uint8Array {
  const body = new Uint8Array(2 + contentIds.length * 4)
  const view = new DataView(body.buffer)
  view.setUint16(0, contentIds.length, true)
  contentIds.forEach((id, index) => view.setUint32(2 + index * 4, id, true))
  return packet(PACKET_INFO_ID, body)
}

// Splits what has arrived so far into whole packets and the unfinished rest.
export function splitPackets(bytes: Uint8Array): { packets: Uint8Array[]; rest: Uint8Array } {
  const packets: Uint8Array[] = []
  let offset = 0
  while (bytes.length - offset >= 3) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset).getUint16(0, true)
    if (size < 3) throw new Error("OpenTTD's content server sent an unreadable answer")
    if (bytes.length - offset < size) break
    packets.push(bytes.subarray(offset, offset + size))
    offset += size
  }
  return { packets, rest: bytes.subarray(offset) }
}

// Returns null for packets that are not about one entry of the wanted kind.
export function readInfoPacket(bytes: Uint8Array, kind: ContentKind): ContentInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  let offset = 3
  const u8 = () => view.getUint8(offset++)
  const u32 = () => {
    offset += 4
    return view.getUint32(offset - 4, true)
  }
  const string = () => {
    const end = bytes.indexOf(0, offset)
    if (end < 0) throw new RangeError('Unterminated text')
    const value = decoder.decode(bytes.subarray(offset, end))
    offset = end + 1
    return value
  }
  try {
    if (view.getUint8(2) !== PACKET_INFO || u8() !== CONTENT_TYPES[kind]) return null
    const contentId = u32()
    const size = u32()
    const name = string()
    const version = string()
    string() // address
    string() // description
    const uniqueId = u32().toString(16).padStart(8, '0')
    offset += 16 // checksum of the unpacked files
    const dependencies = Array.from({ length: u8() }, u32)
    return { contentId, size, name, version, uniqueId, dependencies }
  } catch {
    return null
  }
}

// The link service answers one line per id: id, type, size, address.
export function readContentLinks(body: string): Map<number, string> {
  const links = new Map<number, string>()
  for (const line of body.split('\n')) {
    const [id, , , url] = line.trim().split(',')
    if (id && url && /^\d+$/.test(id)) links.set(Number(id), url)
  }
  return links
}
