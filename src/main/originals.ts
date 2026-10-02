// Fetches the original game's files from Steam with SteamCMD, Valve's command-line client.
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { app, shell } from 'electron'
import { extract as extractTar } from 'tar'
import {
  isSteamCode,
  isSteamName,
  originalSource,
  readIniValue,
  readSteamOutput,
  readYamlValue,
  setIniValue,
  setYamlValue,
  signInScript,
  steamArgs,
  type OriginalSetting
} from '../shared/originals'
import type { OriginalProgress, OriginalState } from '../shared/types'

const execFileAsync = promisify(execFile)
const TOOL_URL = 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz'
const MARKER = '.ogl-original'
const listeners = new Set<(event: OriginalProgress) => void>()

// SteamCMD keeps one sign-in and one set of files of its own, so only one copy runs at a time.
type Job = { gameId: string; child: ChildProcessWithoutNullStreams | null; cancelled: boolean }
let running: Job | null = null

export function onOriginalProgress(listener: (event: OriginalProgress) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function root(): string {
  return path.join(app.getPath('userData'), 'steamcmd')
}

// SteamCMD updates itself in place, so it lives in OGL's data folder and not inside the signed app.
function toolFolder(): string {
  return path.join(root(), 'tool')
}

// SteamCMD gets a home folder of its own. In the real one it would share settings with the Steam app.
function homeFolder(): string {
  return path.join(root(), 'home')
}

function accountFile(): string {
  return path.join(root(), 'account.json')
}

export function originalFolder(gameId: string): string {
  if (!originalSource(gameId, process.platform)) throw new Error('OGL cannot fetch the original files for this game')
  return path.join(app.getPath('userData'), 'originals', gameId)
}

async function savedName(): Promise<string> {
  try {
    const saved = JSON.parse(await readFile(accountFile(), 'utf8')) as { username?: unknown }
    return typeof saved.username === 'string' && isSteamName(saved.username) ? saved.username : ''
  } catch {
    return ''
  }
}

export async function originalState(gameId: string): Promise<OriginalState> {
  return { installed: existsSync(path.join(originalFolder(gameId), MARKER)), username: await savedName() }
}

async function ensureTool(): Promise<string> {
  const script = path.join(toolFolder(), 'steamcmd.sh')
  if (existsSync(script)) return script
  if (process.arch === 'arm64') {
    // SteamCMD for the Mac is an Intel program.
    await execFileAsync('arch', ['-x86_64', '/usr/bin/true']).catch(() => {
      throw new Error('SteamCMD needs Rosetta. Install it in Terminal with: softwareupdate --install-rosetta')
    })
  }
  const response = await fetch(TOOL_URL, { redirect: 'error', signal: AbortSignal.timeout(120000) })
  if (!response.ok) throw new Error(`SteamCMD could not be downloaded (${response.status})`)
  const incoming = `${toolFolder()}.incoming`
  const archive = `${incoming}.tar.gz`
  await rm(incoming, { recursive: true, force: true })
  await mkdir(incoming, { recursive: true })
  try {
    await writeFile(archive, Buffer.from(await response.arrayBuffer()))
    await extractTar({ file: archive, cwd: incoming })
    if (!existsSync(path.join(incoming, 'steamcmd.sh'))) throw new Error('The SteamCMD download was not usable')
    await rm(toolFolder(), { recursive: true, force: true })
    await rename(incoming, toolFolder())
  } finally {
    await rm(archive, { force: true })
    await rm(incoming, { recursive: true, force: true })
  }
  return script
}

async function rememberName(username: string): Promise<void> {
  await mkdir(root(), { recursive: true })
  await writeFile(accountFile(), JSON.stringify({ username }))
}

// Opens Terminal on a script that signs in, so the password is typed into SteamCMD and never into OGL.
export async function signInViaTerminal(username: string): Promise<void> {
  if (process.platform !== 'darwin') throw new Error('This only works on a Mac')
  if (!isSteamName(username)) throw new Error('Enter your Steam account name first')
  if (running) throw new Error('SteamCMD is already running')
  const tool = await ensureTool()
  await mkdir(homeFolder(), { recursive: true })
  await rememberName(username)
  const script = path.join(root(), 'Sign in to Steam.command')
  await writeFile(script, signInScript(tool, homeFolder(), username))
  await chmod(script, 0o755)
  const problem = await shell.openPath(script)
  if (problem) throw new Error(problem)
}

// Points the game at the files, unless it already uses a folder that is still there.
async function applySetting(setting: OriginalSetting, folder: string): Promise<void> {
  const file = path.join(app.getPath('appData'), ...setting.file)
  const text = await readFile(file, 'utf8').catch(() => '')
  const current =
    setting.type === 'ini' ? readIniValue(text, setting.section, setting.key) : readYamlValue(text, setting.key)
  if (current && current !== folder && existsSync(current)) return
  const next =
    setting.type === 'ini'
      ? setIniValue(text, setting.section, setting.key, folder)
      : setYamlValue(text, setting.key, folder)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, next)
}

function stop(child: ChildProcessWithoutNullStreams): void {
  if (child.pid === undefined) return
  try {
    process.kill(-child.pid)
  } catch {
    // Already gone.
  }
}

function runSteam(
  tool: string,
  args: string[],
  password: string,
  emit: (progress: Pick<OriginalProgress, 'phase' | 'received' | 'total'>) => void,
  job: Job
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Its own process group, so a cancel also stops the program the script starts.
    const child = spawn(tool, args, {
      cwd: path.dirname(tool),
      env: { ...process.env, HOME: homeFolder() },
      detached: true
    })
    job.child = child
    let pending = ''
    let asked = false
    let succeeded = false
    let failure: string | null = null
    let last = ''

    const handle = (text: string) => {
      if (text.trim()) last = text.trim()
      const signal = readSteamOutput(text)
      if (!signal) return
      if (signal.type === 'password') {
        if (asked) return
        asked = true
        if (password) child.stdin.write(`${password}\n`)
        else {
          failure = 'Not signed in yet. Enter your password, or sign in via Terminal first.'
          stop(child)
        }
      } else if (signal.type === 'progress') emit(signal.progress)
      else if (signal.type === 'success') succeeded = true
      else failure ??= signal.message
    }

    child.stdout.on('data', (chunk: Buffer) => {
      const pieces = (pending + chunk.toString()).split(/\r\n|\n|\r/)
      pending = pieces.pop() ?? ''
      for (const piece of pieces) handle(piece)
      // A prompt has no line end, so the unfinished rest is looked at as well.
      if (pending) handle(pending)
    })
    child.stderr.resume()
    child.stdin.on('error', () => undefined)
    child.once('error', () => reject(new Error('SteamCMD could not be started')))
    child.once('close', () => {
      if (job.cancelled) reject(new Error('Cancelled'))
      else if (failure) reject(new Error(failure))
      else if (succeeded) resolve()
      else reject(new Error(last ? `SteamCMD stopped early: ${last}` : 'SteamCMD stopped early'))
    })
  })
}

export async function fetchOriginal(gameId: string, username: string, password: string): Promise<void> {
  const source = originalSource(gameId, process.platform)
  if (!source) throw new Error('OGL cannot fetch the original files for this game')
  if (!isSteamName(username)) throw new Error('That is not a Steam account name')
  if (running) throw new Error('SteamCMD is already running')

  const job: Job = { gameId, child: null, cancelled: false }
  running = job
  const emit = (progress: Pick<OriginalProgress, 'phase' | 'received' | 'total'>) => {
    for (const listener of listeners) listener({ gameId, ...progress })
  }
  try {
    emit({ phase: 'preparing', received: 0, total: 0 })
    const tool = await ensureTool()
    if (job.cancelled) throw new Error('Cancelled')
    const folder = originalFolder(gameId)
    await mkdir(folder, { recursive: true })
    await mkdir(homeFolder(), { recursive: true })
    await rememberName(username)
    emit({ phase: 'signing-in', received: 0, total: 0 })
    await runSteam(tool, steamArgs(source.appId, folder, username), password, emit, job)
    await writeFile(path.join(folder, MARKER), new Date().toISOString())
    await applySetting(source.setting, folder)
  } finally {
    running = null
  }
}

export function sendOriginalCode(code: string): void {
  if (!isSteamCode(code)) throw new Error('That does not look like a Steam Guard code')
  if (!running?.child) throw new Error('SteamCMD is not waiting for a code')
  running.child.stdin.write(`${code}\n`)
}

export function cancelOriginal(): void {
  if (!running) return
  running.cancelled = true
  if (running.child) stop(running.child)
}
