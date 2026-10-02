// Takes a screenshot of the browser preview (mock data), for checking UI changes.
//
//   node scripts/preview-shot.mjs out.png
//   node scripts/preview-shot.mjs out.png --query "?game=openrct2" --wait 3500
//   node scripts/preview-shot.mjs out.png --wait 800                 the loading screen
//   node scripts/preview-shot.mjs out.png --click ".rail-foot button" --after 1500
//   node scripts/preview-shot.mjs out.png --clip 0,440,200,240       x,y,width,height
//
// Needs Google Chrome. The window is 1040x680, captured at 2x.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [output, ...rest] = process.argv.slice(2)
if (!output) {
  console.error('Usage: node scripts/preview-shot.mjs <out.png> [--query ?x] [--wait ms] [--click selector] [--after ms] [--clip x,y,w,h]')
  process.exit(1)
}
const option = (name, fallback) => {
  const index = rest.indexOf(`--${name}`)
  return index >= 0 ? rest[index + 1] : fallback
}
const query = option('query', '')
const wait = Number(option('wait', 3500))
const click = option('click', null)
const after = Number(option('after', 1000))
const clip = option('clip', null)

const vitePort = 5199
const debugPort = 9333
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const vite = spawn('npx', ['vite', 'src/renderer', '--port', String(vitePort), '--strictPort'], { stdio: 'ignore' })
const browser = spawn(
  chrome,
  ['--headless=new', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/ogl-preview-chrome', '--hide-scrollbars', 'about:blank'],
  { stdio: 'ignore' }
)

async function reachable(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await fetch(url)
    } catch {
      await sleep(500)
    }
  }
  throw new Error(`${url} did not come up`)
}

try {
  await reachable(`http://localhost:${vitePort}/`)
  const targets = await (await reachable(`http://localhost:${debugPort}/json`)).json()
  const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve) => (socket.onopen = resolve))
  let id = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    pending.get(message.id)?.(message.result)
    pending.delete(message.id)
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Emulation.setDeviceMetricsOverride', { width: 1040, height: 680, deviceScaleFactor: 2, mobile: false })
  await send('Page.navigate', { url: `http://localhost:${vitePort}/${query}` })
  await sleep(wait)
  if (click) {
    await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(click)}).click()` })
    await sleep(after)
  }
  const [x, y, width, height] = clip ? clip.split(',').map(Number) : []
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    ...(clip ? { clip: { x, y, width, height, scale: 1 } } : {})
  })
  writeFileSync(output, Buffer.from(data, 'base64'))
  socket.close()
  console.log(output)
} finally {
  browser.kill()
  vite.kill()
}
