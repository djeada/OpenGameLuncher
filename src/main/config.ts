import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { OglConfig } from '../shared/types'

function firstExisting(candidates: string[]): string | null {
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

export function configPath(): string {
  const file = firstExisting([
    path.join(process.resourcesPath, 'ogl.config.json'),
    path.join(process.cwd(), 'ogl.config.json'),
    path.join(app.getAppPath(), 'ogl.config.json')
  ])
  if (!file) throw new Error('ogl.config.json is missing')
  return file
}

export function readConfig(): OglConfig {
  const parsed = JSON.parse(readFileSync(configPath(), 'utf8')) as OglConfig
  if (!parsed.repository?.owner || !parsed.repository.name || !parsed.catalog?.branch || !parsed.catalog.directory) {
    throw new Error('ogl.config.json is incomplete')
  }
  return parsed
}

export function bundledGamesDir(): string {
  return (
    firstExisting([
      path.join(process.resourcesPath, 'catalog', 'games'),
      path.join(process.cwd(), 'catalog', 'games'),
      path.join(app.getAppPath(), 'catalog', 'games')
    ]) ?? path.join(process.cwd(), 'catalog', 'games')
  )
}
