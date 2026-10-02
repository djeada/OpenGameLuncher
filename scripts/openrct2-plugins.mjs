// Rebuilds catalog/mods/openrct2.json: the OpenRCT2 plugins OGL can install.
// The list comes from openrct2plugins.org. A plugin is kept only when its latest GitHub release
// carries a ready-made .js file, which is what the game loads. Needs a GitHub token for the
// release lookups: OGL_GITHUB_TOKEN=$(gh auth token) node scripts/openrct2-plugins.mjs
import { writeFileSync } from 'node:fs'

const token = process.env.OGL_GITHUB_TOKEN
if (!token) throw new Error('Set OGL_GITHUB_TOKEN')
const output = new URL('../catalog/mods/openrct2.json', import.meta.url)

const listed = []
for (let page = 1; page <= 20; page += 1) {
  const response = await fetch(`https://openrct2plugins.org/list/?sort=rating&results=100&p=${page}&json=1`)
  const body = await response.json()
  listed.push(...Object.values(body.data ?? {}))
  if (page >= (body.info?.pages ?? 1)) break
}

const plugins = []
for (const item of listed) {
  const repo = `${item.username}/${item.name}`
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) continue
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) continue
  const release = await response.json()
  if (!release.assets?.some((asset) => asset.name.toLowerCase().endsWith('.js'))) continue
  plugins.push({
    id: repo,
    name: item.name,
    description: item.description ?? '',
    author: item.username,
    stars: item.stargazers ?? 0,
    version: release.tag_name,
    updatedAt: release.published_at,
    ...(item.licenseName ? { license: item.licenseName } : {}),
    // Without a picture of its own, GitHub's card for the repository says nothing new.
    ...(item.usesCustomOpenGraphImage && item.thumbnail ? { image: item.thumbnail } : {})
  })
}

plugins.sort((left, right) => right.stars - left.stars || left.id.localeCompare(right.id))
writeFileSync(output, `${JSON.stringify({ plugins }, null, 2)}\n`)
console.log(`${plugins.length} of ${listed.length} plugins have a file to install`)
