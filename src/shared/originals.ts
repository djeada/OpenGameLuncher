import type { OriginalProgress } from './types'

// How the downloaded files are handed to the game: each one keeps the folder in its own settings file.
export type OriginalSetting =
  | { type: 'ini'; file: string[]; section: string; key: string }
  | { type: 'yaml'; file: string[]; key: string }

export type OriginalSource = {
  // The Steam app whose Windows files the game needs.
  appId: number
  // The settings file, as path parts below the player's Application Support folder.
  setting: OriginalSetting
}

// Fetching the files is tied to how one game finds them, so the games that can are listed here
// rather than in the catalog. Only games whose download was tried from OGL belong here.
const SOURCES: Record<string, OriginalSource> = {
  openloco: {
    appId: 356430,
    setting: { type: 'yaml', file: ['OpenLoco', 'openloco.yml'], key: 'loco_install_path' }
  },
  openrct2: {
    appId: 285330,
    setting: { type: 'ini', file: ['OpenRCT2', 'config.ini'], section: 'general', key: 'game_path' }
  }
}

// SteamCMD runs on a Mac, where Steam itself refuses to download a Windows-only game.
export function originalSource(gameId: string, platform: string): OriginalSource | undefined {
  if (platform !== 'darwin') return undefined
  return Object.hasOwn(SOURCES, gameId) ? SOURCES[gameId] : undefined
}

// The name ends up in a shell script, so it is held to what Steam itself allows.
export function isSteamName(name: string): boolean {
  return /^[A-Za-z0-9_]{2,64}$/.test(name)
}

export function isSteamCode(code: string): boolean {
  return /^[A-Za-z0-9]{4,10}$/.test(code)
}

export function steamArgs(appId: number, directory: string, username: string): string[] {
  return [
    '+@sSteamCmdForcePlatformType',
    'windows',
    '+force_install_dir',
    directory,
    '+login',
    username,
    '+app_update',
    String(appId),
    'validate',
    '+quit'
  ]
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

// The script Terminal runs for a sign-in where SteamCMD asks for the password itself.
export function signInScript(tool: string, home: string, username: string): string {
  if (!isSteamName(username)) throw new Error('That is not a Steam account name')
  return [
    '#!/bin/sh',
    `export HOME=${shellQuote(home)}`,
    `${shellQuote(tool)} +login ${shellQuote(username)} +quit`,
    'echo',
    'echo "If the sign-in above says OK, go back to OGL and press Download."',
    ''
  ].join('\n')
}

const REASONS: Record<string, string> = {
  'invalid password': 'Steam did not accept that name and password.',
  'rate limit exceeded': 'Steam is refusing sign-ins from here for now, after too many attempts. Try again later.',
  'two-factor code mismatch': 'Steam did not accept that Steam Guard code.',
  'invalid login auth code': 'Steam did not accept that Steam Guard code.',
  'account login denied need two factor': 'Steam did not accept that Steam Guard code.',
  'no subscription': 'This Steam account does not own the game.',
  'no connection': 'SteamCMD could not reach Steam.',
  'disk write failure': 'SteamCMD could not write the files. Check the free space on this Mac.'
}

function reason(text: string): string {
  return REASONS[text.toLowerCase()] ?? `SteamCMD said: ${text}`
}

export type SteamSignal =
  | { type: 'password' }
  | { type: 'progress'; progress: Pick<OriginalProgress, 'phase' | 'received' | 'total'> }
  | { type: 'success' }
  | { type: 'failure'; message: string }

// Reads one piece of SteamCMD's output. Prompts come without a line end, so a piece may be a partial line.
export function readSteamOutput(text: string): SteamSignal | null {
  if (/^password:\s*$/i.test(text.trim())) return { type: 'password' }
  const waiting = { received: 0, total: 0 }
  if (/(steam guard code|two-factor code):\s*$/i.test(text.trim())) {
    return { type: 'progress', progress: { phase: 'code', ...waiting } }
  }
  if (/confirm the login in the steam mobile app/i.test(text)) {
    return { type: 'progress', progress: { phase: 'confirm', ...waiting } }
  }
  const update = /Update state \(0x[0-9a-f]+\) ([a-z ]+), progress: [\d.]+ \((\d+) \/ (\d+)\)/i.exec(text)
  if (update) {
    const total = Number(update[3])
    // Before and after the download SteamCMD checks the files, and reports that with its own counts.
    if (!/downloading/.test(update[1]) || total === 0) return { type: 'progress', progress: { phase: 'checking', ...waiting } }
    return { type: 'progress', progress: { phase: 'downloading', received: Number(update[2]), total } }
  }
  if (/Success! App '\d+' (fully installed|already up to date)/i.test(text)) return { type: 'success' }
  const failed = /ERROR! Failed to install app '\d+' \(([^)]+)\)/i.exec(text) ?? /(?:ERROR|FAILED) \(([^)]+)\)/.exec(text)
  if (failed) return { type: 'failure', message: reason(failed[1]) }
  return null
}

// Sets one key in an ini file, keeping everything else as the game wrote it.
export function setIniValue(text: string, section: string, key: string, value: string): string {
  const line = `${key} = ${JSON.stringify(value)}`
  const lines = text === '' ? [] : text.split(/\r?\n/)
  const start = lines.findIndex((item) => item.trim() === `[${section}]`)
  if (start < 0) return [...lines, ...(lines.length > 0 && lines.at(-1) !== '' ? [''] : []), `[${section}]`, line, ''].join('\n')
  let end = lines.findIndex((item, index) => index > start && /^\s*\[/.test(item))
  if (end < 0) end = lines.length
  const existing = lines.findIndex((item, index) => index > start && index < end && item.split('=')[0].trim() === key)
  if (existing >= 0) lines[existing] = line
  else lines.splice(start + 1, 0, line)
  return lines.join('\n')
}

export function readIniValue(text: string, section: string, key: string): string {
  let inside = false
  for (const item of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(item)) inside = item.trim() === `[${section}]`
    else if (inside && item.split('=')[0].trim() === key) return unquote(item.slice(item.indexOf('=') + 1))
  }
  return ''
}

// Sets one top-level key in a YAML file.
export function setYamlValue(text: string, key: string, value: string): string {
  const line = `${key}: ${JSON.stringify(value)}`
  const lines = text === '' ? [] : text.split(/\r?\n/)
  const existing = lines.findIndex((item) => item.startsWith(`${key}:`))
  if (existing >= 0) lines[existing] = line
  else {
    while (lines.at(-1) === '') lines.pop()
    lines.push(line, '')
  }
  return lines.join('\n')
}

export function readYamlValue(text: string, key: string): string {
  const found = text.split(/\r?\n/).find((item) => item.startsWith(`${key}:`))
  return found ? unquote(found.slice(key.length + 1)) : ''
}

function unquote(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"')) {
    try {
      return String(JSON.parse(value))
    } catch {
      return value.replace(/^"|"$/g, '')
    }
  }
  return value.replace(/^'|'$/g, '')
}
