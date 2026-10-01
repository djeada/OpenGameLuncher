import type { Game } from './types'

export function supportsPlatform(game: Game, platform: string): boolean {
  if (game.web) return true
  if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') return false
  return Boolean(game.platforms[platform])
}

export function hostLabel(platform: string, arch: string): string {
  if (platform === 'darwin') return arch === 'arm64' ? 'Mac · Apple silicon' : 'Mac · Intel'
  if (platform === 'win32') {
    if (arch === 'arm64') return 'Windows · ARM'
    if (arch === 'ia32') return 'Windows · 32-bit'
    return 'Windows · 64-bit'
  }
  if (platform === 'linux') {
    const cpu = arch === 'arm64' ? 'ARM' : arch === 'ia32' ? '32-bit' : '64-bit'
    return `Linux · ${cpu}`
  }
  return `${platform} · ${arch}`
}

export function machinePhrase(platform: string): string {
  if (platform === 'darwin') return 'this Mac'
  if (platform === 'win32') return 'this PC'
  if (platform === 'linux') return 'this Linux machine'
  return 'this system'
}

export function gameMark(name: string, mark?: string): string {
  if (mark) return mark
  const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return ''
  if (size < 1024) return `${Math.round(size)} B`
  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date)
}
