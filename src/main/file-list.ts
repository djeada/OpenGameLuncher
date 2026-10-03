import { readFileList, type ListedFile } from '../shared/file-list'
import { assertAssetUrl } from '../shared/urls'
import { cached } from './cache'

// Kept on disk too, so the versions still show when the page cannot be reached.
export function listedFiles(page: string): Promise<ListedFile[]> {
  assertAssetUrl(page)
  return cached('file-list', page, 5 * 60 * 1000, async () => {
    const response = await fetch(page, { headers: { 'User-Agent': 'OGL' }, signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error(`${new URL(page).hostname} returned ${response.status} for its file list`)
    const files = readFileList(await response.text())
    if (files.length === 0) throw new Error(`${new URL(page).hostname} lists no files`)
    return files
  })
}
