import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import type { InstallView } from '../shared/types'

export type InstallRecord = {
  gameId: string
  channelId: string
  tag: string
  directory: string
  executable: string
  kind: 'app' | 'binary'
  args: string[]
  installedAt: string
  autoUpdate: boolean
  runtime?: { executable: string; kind: 'app' | 'binary' }
}

type WebRecord = { gameId: string; playedAt: string }

type FileShape = {
  installs: InstallRecord[]
  autoUpdate: Record<string, boolean>
  web: WebRecord[]
}

// Browser games have nothing on disk. Playing one adds it to the library under this channel id.
export const WEB_CHANNEL = 'web'

function installKey(gameId: string, channelId: string): string {
  return `${gameId}:${channelId}`
}

function isRecord(value: unknown): value is InstallRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as InstallRecord
  return (
    typeof record.gameId === 'string' &&
    typeof record.channelId === 'string' &&
    typeof record.tag === 'string' &&
    typeof record.directory === 'string' &&
    typeof record.executable === 'string' &&
    (record.kind === 'app' || record.kind === 'binary')
  )
}

export class InstallStore {
  private data: FileShape = { installs: [], autoUpdate: {}, web: [] }

  constructor(private readonly file: string) {}

  static async open(): Promise<InstallStore> {
    const file = path.join(app.getPath('userData'), 'library.json')
    const store = new InstallStore(file)
    await store.load()
    return store
  }

  private async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Partial<FileShape>
      this.data = {
        installs: Array.isArray(parsed.installs) ? parsed.installs.filter(isRecord) : [],
        autoUpdate: parsed.autoUpdate && typeof parsed.autoUpdate === 'object' ? parsed.autoUpdate : {},
        web: Array.isArray(parsed.web)
          ? parsed.web.filter((item) => typeof item?.gameId === 'string' && typeof item.playedAt === 'string')
          : []
      }
    } catch {
      this.data = { installs: [], autoUpdate: {}, web: [] }
    }
  }

  private async save(): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true })
    await writeFile(this.file, JSON.stringify(this.data, null, 2))
  }

  list(): InstallRecord[] {
    return this.data.installs
  }

  views(): InstallView[] {
    const installed = this.data.installs.map((record) => ({
      gameId: record.gameId,
      channelId: record.channelId,
      tag: record.tag,
      installedAt: record.installedAt,
      autoUpdate: record.autoUpdate
    }))
    const played = this.data.web.map((record) => ({
      gameId: record.gameId,
      channelId: WEB_CHANNEL,
      tag: 'Browser',
      installedAt: record.playedAt,
      autoUpdate: false
    }))
    return [...installed, ...played]
  }

  async markWebPlayed(gameId: string): Promise<void> {
    this.data.web = [...this.data.web.filter((item) => item.gameId !== gameId), { gameId, playedAt: new Date().toISOString() }]
    await this.save()
  }

  async removeWeb(gameId: string): Promise<void> {
    this.data.web = this.data.web.filter((item) => item.gameId !== gameId)
    await this.save()
  }

  find(gameId: string, channelId: string): InstallRecord | undefined {
    return this.data.installs.find((record) => record.gameId === gameId && record.channelId === channelId)
  }

  prefersAutoUpdate(gameId: string, channelId: string): boolean {
    const saved = this.data.autoUpdate[installKey(gameId, channelId)]
    if (typeof saved === 'boolean') return saved
    return this.find(gameId, channelId)?.autoUpdate ?? true
  }

  async setAutoUpdate(gameId: string, channelId: string, enabled: boolean): Promise<void> {
    this.data.autoUpdate[installKey(gameId, channelId)] = enabled
    const record = this.find(gameId, channelId)
    if (record) record.autoUpdate = enabled
    await this.save()
  }

  async removeInstall(gameId: string, channelId: string): Promise<void> {
    this.data.installs = this.data.installs.filter((item) => item.gameId !== gameId || item.channelId !== channelId)
    await this.save()
  }

  async saveInstall(record: InstallRecord): Promise<void> {
    this.data.installs = this.data.installs.filter(
      (item) => item.gameId !== record.gameId || item.channelId !== record.channelId
    )
    this.data.installs.push(record)
    this.data.autoUpdate[installKey(record.gameId, record.channelId)] = record.autoUpdate
    await this.save()
  }
}

let opening: Promise<InstallStore> | null = null

export function installStore(): Promise<InstallStore> {
  opening ??= InstallStore.open()
  return opening
}
