import openrct2 from '../../catalog/mods/openrct2.json'
import openttd from '../../catalog/mods/openttd.json'
import type { ModSupport } from './types'

const OPENTTD_NEWGRF: ModSupport = {
  label: 'NewGRFs',
  hint: 'Switch them on in OpenTTD under NewGRF Settings before starting a new game.',
  popular: openttd.popular.map((mod) => mod.id),
  source: { type: 'openttd-content', kind: 'newgrf' }
}

// Mods are tied to how one game stores its content, so the games that have them are listed here
// rather than in the catalog. A new game needs a line here; a new kind of source also needs a
// provider in src/main/mods.ts.
const SUPPORT: Record<string, ModSupport> = {
  openttd: OPENTTD_NEWGRF,
  'openttd-jgrpp': OPENTTD_NEWGRF,
  openrct2: {
    label: 'Plugins',
    hint: 'Plugins load the next time OpenRCT2 starts.',
    // The list is sorted by GitHub stars, so its top is the popular set.
    popular: openrct2.plugins.slice(0, 20).map((plugin) => plugin.id),
    source: { type: 'openrct2-plugins' }
  },
  simutrans: {
    label: 'Paksets',
    hint: 'Simutrans asks which pakset to play when it starts.',
    source: { type: 'simutrans-paksets' }
  },
  'endless-sky': {
    label: 'Plugins',
    hint: 'Plugins load the next time Endless Sky starts. Switch them off under Preferences, Plugins.',
    source: { type: 'endless-sky-plugins' }
  }
}

export function modSupport(gameId: string): ModSupport | undefined {
  return Object.hasOwn(SUPPORT, gameId) ? SUPPORT[gameId] : undefined
}
