// Rebuilds src/shared/openttd-art.json: preview pictures for OpenTTD NewGRFs.
// OpenTTD's content service has no pictures, but the older GRFCrawler directory does for some sets.
// Entries are matched by GRF id. Run by hand now and then: node scripts/openttd-mod-art.mjs
import { writeFileSync } from 'node:fs'

const CRAWLER = 'https://grfcrawler.tt-forums.net'
const LAST_ENTRY = 600
const output = new URL('../src/shared/openttd-art.json', import.meta.url)

function unescape(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}

// GRFCrawler shows an id either as eight hex digits or as its four characters.
function grfId(shown) {
  const compact = shown.replace(/\s+/g, '')
  if (/^[0-9a-f]{8}$/i.test(compact)) return compact.toLowerCase()
  const text = shown.trim()
  if (text.length === 4) return Buffer.from(text, 'latin1').toString('hex')
  return null
}

async function entry(id) {
  const response = await fetch(`${CRAWLER}/details.php?do=details&id=${id}`)
  if (!response.ok) return null
  const page = Buffer.from(await response.arrayBuffer()).toString('latin1')
  const shown = page.match(/GRFID:<\/td><td>([\s\S]*?)&nbsp;/)?.[1]
  const picture = page.match(/grfdetailsimg"><img src="([^"]+)"/)?.[1]
  if (!shown || !picture || picture.includes('nopic') || !/^grf\/\d+\/[\w.() -]+$/.test(picture)) return null
  const grf = grfId(unescape(shown))
  return grf ? { grf, picture } : null
}

const packages = await (await fetch('https://bananas-api.openttd.org/package/newgrf')).json()
const known = new Set(packages.map((item) => item['unique-id']))

const art = {}
const ids = Array.from({ length: LAST_ENTRY }, (_, index) => index + 1)
for (let start = 0; start < ids.length; start += 6) {
  const found = await Promise.all(ids.slice(start, start + 6).map((id) => entry(id).catch(() => null)))
  // A later entry for the same set is the newer one.
  for (const item of found) if (item && known.has(item.grf)) art[item.grf] = item.picture
}

const sorted = Object.fromEntries(Object.entries(art).sort(([left], [right]) => left.localeCompare(right)))
writeFileSync(output, `${JSON.stringify(sorted, null, 2)}\n`)
console.log(`${Object.keys(sorted).length} pictures for ${known.size} NewGRFs`)
