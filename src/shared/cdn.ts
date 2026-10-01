const OPENTTD_BASE = 'https://cdn.openttd.org/openttd-releases'

export function openttdManifestUrl(tag: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(tag)) throw new Error('OpenTTD version is not usable')
  return `${OPENTTD_BASE}/${tag}/manifest.yaml`
}

// Reads the player-facing files from an OpenTTD manifest.yaml, skipping dev_files.
export function readOpenttdManifest(text: string, tag: string): { name: string; url: string; size: number }[] {
  const files = text.split(/^dev_files:/m)[0] ?? ''
  const assets: { name: string; url: string; size: number }[] = []
  for (const match of files.matchAll(/^- id: (\S+)\s*\n\s+size: (\d+)/gm)) {
    const name = match[1] ?? ''
    if (!/^[A-Za-z0-9._-]+$/.test(name)) continue
    assets.push({ name, url: `${OPENTTD_BASE}/${tag}/${name}`, size: Number(match[2]) })
  }
  return assets
}
