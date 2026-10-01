export type ItchUpload = { id: string; name: string; size: number }

const UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

// Reads the download list on a free itch.io game page. Each upload has an id, a file name, and a rounded size.
export function readItchUploads(html: string): ItchUpload[] {
  const uploads: ItchUpload[] = []
  const blocks = html.split(/<div class="upload"/).slice(1)
  for (const block of blocks) {
    const id = block.match(/data-upload_id="(\d+)"/)?.[1]
    const name = block.match(/class="name"(?:[^>]*title="([^"]+)")?[^>]*>([^<]*)</)
    const file = decode(name?.[1] ?? name?.[2] ?? '')
    if (!id || !file || /[\\/]/.test(file)) continue
    const size = block.match(/file_size"><span>([\d.]+)\s*(B|KB|MB|GB)</)
    uploads.push({ id, name: file, size: size ? Math.round(Number(size[1]) * (UNITS[size[2] ?? 'B'] ?? 1)) : 0 })
  }
  return uploads
}

// itch.io has no version field, so the version is the last number in the file name.
export function itchVersion(fileName: string): string {
  const matches = fileName.match(/\d+(?:\.\d+){1,3}/g)
  return matches?.at(-1) ?? fileName.replace(/\.[a-z0-9]+$/i, '')
}

export function itchFileEndpoint(page: string, uploadId: string): string {
  if (!/^\d+$/.test(uploadId)) throw new Error('itch.io upload id is not usable')
  return `${page}/file/${uploadId}?source=view_game&as_props=1`
}
