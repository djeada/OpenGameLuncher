// Draws the download buttons in docs/buttons and keeps the links in the README current.
//
//   node scripts/buttons.mjs                    redraw the buttons, point the README at the latest release
//   node scripts/buttons.mjs --version 0.2.0    the same, for a version you name
//   node scripts/buttons.mjs --snippet          print a "Play on OGL" button for a game's own README
//   node scripts/buttons.mjs --snippet openttd  the same, checked against the catalog and named after the game
//
// The buttons are plain SVG files, so GitHub shows them in any README.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repository = 'fabianfreund/OpenGameLauncher'
const projectPage = 'https://fabianbuilds.com/opengamelauncher'
const buttonsUrl = `https://raw.githubusercontent.com/${repository}/main/docs/buttons`

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? (args[index + 1] ?? '') : null
}

const icons = {
  apple:
    '<path transform="translate(1.9 0) scale(0.02)" fill="#fff" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>',
  windows:
    '<path transform="translate(1 1) scale(1.125)" fill="#fff" d="M1 1h6.5v6.5H1zM8.5 1H15v6.5H8.5zM1 8.5h6.5V15H1zM8.5 8.5H15V15H8.5z"/>',
  linux:
    '<g transform="translate(1 1) scale(1.125)" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="2.5"/><path d="m4.5 6 2.5 2-2.5 2M8.5 10.5h3"/></g>',
  // The OGL mark, as in src/renderer/components/Logo.tsx.
  ogl: '<path transform="translate(-2.6 -2) scale(1)" d="M9.2 6.4v11.2L18.4 12 9.2 6.4z" fill="#fff" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>',
  download:
    '<path fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M8 2v8m0 0L4.8 6.8M8 10l3.2-3.2M2.5 13.5h11"/>'
}

// One pill in the launcher's blue. `icon` is drawn in a 20x20 box; `arrow` adds the download arrow on the right.
function button({ width, icon, title, detail, label, arrow }) {
  const height = 52
  const font = `font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif"`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
  <title>${label}</title>
  <defs>
    <linearGradient id="flow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6aa0ff"/>
      <stop offset="0.45" stop-color="#3d7bff"/>
      <stop offset="1" stop-color="#5b4bf0"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.04"/>
      <stop offset="0.54" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.7" stop-color="#081450" stop-opacity="0"/>
      <stop offset="1" stop-color="#081450" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="14" fill="url(#flow)"/>
  <rect width="${width}" height="${height}" rx="14" fill="url(#depth)"/>
  <rect width="${width}" height="${height}" rx="14" fill="url(#gloss)"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="13.5" fill="none" stroke="#fff" stroke-opacity="0.3"/>
  <g transform="translate(18 16)">${icon}</g>
  <text x="50" y="23" ${font} font-size="15" font-weight="700" fill="#fff">${title}</text>
  <text x="50" y="39" ${font} font-size="11" font-weight="500" fill="#fff" fill-opacity="0.78">${detail}</text>${
    arrow ? `\n  <g transform="translate(${width - 32} 18)">${icons.download}</g>` : ''
  }
</svg>
`
}

// The files of a release, as named by electron-builder.config.cjs.
const downloads = [
  { file: 'download-macos-arm64', icon: icons.apple, title: 'macOS', detail: 'Apple silicon', asset: (v) => `OGL-${v}-arm64.dmg` },
  { file: 'download-macos-intel', icon: icons.apple, title: 'macOS', detail: 'Intel', asset: (v) => `OGL-${v}.dmg` },
  { file: 'download-windows', icon: icons.windows, title: 'Windows', detail: 'Installer', asset: (v) => `OGL-Setup-${v}.exe` },
  { file: 'download-linux', icon: icons.linux, title: 'Linux', detail: 'AppImage', asset: (v) => `OGL-${v}.AppImage` }
]

function draw() {
  const directory = join(root, 'docs/buttons')
  mkdirSync(directory, { recursive: true })
  for (const { file, icon, title, detail } of downloads) {
    const label = `Download OGL for ${title} (${detail})`
    writeFileSync(join(directory, `${file}.svg`), button({ width: 186, icon, title, detail, label, arrow: true }))
  }
  writeFileSync(
    join(directory, 'play-on-ogl.svg'),
    button({ width: 196, icon: icons.ogl, title: 'Play on OGL', detail: 'Open Game Launcher', label: 'Play on OGL, the Open Game Launcher' })
  )
}

async function latestVersion() {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for the latest release. Pass --version X.Y.Z instead.`)
  return (await response.json()).tag_name.replace(/^v/, '')
}

function updateReadme(version) {
  const path = join(root, 'README.md')
  const readme = readFileSync(path, 'utf8')
  const block = /(<!-- downloads:start -->)[\s\S]*?(<!-- downloads:end -->)/
  if (!block.test(readme)) throw new Error('README.md has no <!-- downloads:start --> ... <!-- downloads:end --> block.')
  const links = downloads.map(
    ({ file, title, detail, asset }) =>
      `  <a href="https://github.com/${repository}/releases/download/v${version}/${asset(version)}"><img src="docs/buttons/${file}.svg" alt="Download OGL for ${title} (${detail})" height="52"></a>`
  )
  writeFileSync(path, readme.replace(block, `$1\n<p align="center">\n${links.join('\n')}\n</p>\n$2`))
}

function snippet(id) {
  let name = 'this game'
  if (id) {
    const path = join(root, 'catalog/games', `${id}.json`)
    if (!existsSync(path)) throw new Error(`catalog/games/${id}.json does not exist. Add the game first; see docs/catalog.md.`)
    name = JSON.parse(readFileSync(path, 'utf8')).name ?? id
  }
  console.log(`[![Play ${name} on OGL, the Open Game Launcher](${buttonsUrl}/play-on-ogl.svg)](${projectPage})`)
}

try {
  const game = option('snippet')
  if (game !== null) {
    snippet(game)
  } else {
    draw()
    const version = option('version') || (await latestVersion())
    updateReadme(version)
    console.log(`Buttons drawn in docs/buttons, README links point at v${version}.`)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
