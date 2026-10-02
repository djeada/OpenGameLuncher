// Reads the pakset list Simutrans keeps in its own source (src/paksetinfo.h), the one the game's
// first-start installer uses.
import { isFolderName } from './plugin-lists'
import type { Mod } from './types'

// The list has names and versions only, so the descriptions are written here, by folder name.
const ABOUT: Record<string, { name: string; description: string }> = {
  pak: {
    name: 'pak64',
    description: 'The classic set and the one most players start with. Small 64 pixel graphics, a full timeline and the widest choice of vehicles.'
  },
  pak128: {
    name: 'pak128',
    description: 'Larger, more detailed 128 pixel graphics with a tougher economy. The most popular set after pak64.'
  },
  'pak192.comic': {
    name: 'pak192.comic',
    description: 'The largest graphics, drawn in a clean comic style. A big download.'
  },
  'pak64.german': {
    name: 'pak64.german',
    description: 'German towns, industries and rolling stock in 64 pixel graphics.'
  },
  'PAK128.german': {
    name: 'pak128.german',
    description: 'German vehicles and buildings in 128 pixel graphics, with a detailed freight economy.'
  },
  'pak.japan': {
    name: 'pak64.japan',
    description: 'Japanese trains, buildings and landscapes in 64 pixel graphics.'
  },
  'pak.nippon': {
    name: 'pak.nippon',
    description: 'A newer Japanese set in 64 pixel graphics, built around dense city railways.'
  },
  'pak128.CS': {
    name: 'pak128.CS',
    description: 'Czech and Slovak vehicles and buildings in 128 pixel graphics.'
  },
  'pak128.Britain': {
    name: 'pak128.Britain',
    description: 'British railways, buses and canals from the 1700s onwards, in 128 pixel graphics.'
  },
  'pak144.Excentrique': {
    name: 'pak144.Excentrique',
    description: 'A playful fantasy set with its own odd industries and vehicles.'
  },
  pakTTD: {
    name: 'pakTTD',
    description: 'Graphics in the look of Transport Tycoon Deluxe.'
  },
  'pak48.bitlit': {
    name: 'pak48.bitlit',
    description: 'A small pixel-art set in 48 pixel graphics. Still early.'
  }
}

function secure(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
}

// Entries from OBSOLETE_FROM on are sets the game itself marks as outdated, and are left out.
export function readPaksetInfo(source: string): { mods: Mod[]; downloads: Record<string, string> } {
  const obsoleteFrom = Number(/#define OBSOLETE_FROM \((\d+)\)/.exec(source)?.[1] ?? Infinity)
  const mods: Mod[] = []
  const downloads: Record<string, string> = {}
  const entry = /\{\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*(\d+)\s*\}/g
  let index = 0
  for (let match = entry.exec(source); match; match = entry.exec(source), index += 1) {
    if (index >= obsoleteFrom) break
    const [, address, folder, version, kilobytes] = match
    const url = secure(address)
    if (!isFolderName(folder) || !/\.zip$/i.test(url) || url.includes('..') || Object.hasOwn(downloads, folder)) continue
    const about = Object.hasOwn(ABOUT, folder) ? ABOUT[folder] : { name: folder, description: '' }
    mods.push({
      id: folder,
      name: about.name,
      description: about.description,
      // The list names no authors; every set is the work of a group of players.
      authors: ['Simutrans community'],
      version: version.trim(),
      updatedAt: '',
      size: Number(kilobytes) * 1024,
      category: 'Pakset',
      tags: []
    })
    downloads[folder] = url
  }
  return { mods, downloads }
}
