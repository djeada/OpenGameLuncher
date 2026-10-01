import { readItchUploads, type ItchUpload } from '../shared/itch'
import { assertAssetUrl } from '../shared/urls'
import { cached } from './cache'

function assertItchPage(url: string): void {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.itch\.io$/i.test(parsed.hostname)) {
    throw new Error('Refusing an itch.io address that is not a game page')
  }
}

// Kept on disk too, so the version still shows when itch.io cannot be reached.
export function itchUploads(page: string): Promise<ItchUpload[]> {
  assertItchPage(page)
  return cached('itch', page, 5 * 60 * 1000, async () => {
    const response = await fetch(page, { headers: { 'User-Agent': 'OGL' }, signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error(`itch.io returned ${response.status} for this game`)
    return readItchUploads(await response.text())
  })
}

// Same request the page's Download button makes. Free uploads answer with a signed link valid for a minute.
export async function resolveItchDownload(endpoint: string): Promise<string> {
  assertItchPage(endpoint)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'User-Agent': 'OGL', 'X-Requested-With': 'XMLHttpRequest' },
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) throw new Error(`itch.io returned ${response.status} for the download`)
  const payload = (await response.json()) as { url?: unknown }
  if (typeof payload.url !== 'string') throw new Error('itch.io did not offer a free download for this file')
  assertAssetUrl(payload.url)
  return payload.url
}
