import { BrowserWindow, shell } from 'electron'
import type { Game } from '../shared/types'

const windows = new Map<string, BrowserWindow>()

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

// Shown instead of a blank window when the game's page cannot load, such as a broken certificate or no network.
function errorPage(game: Game, url: URL, reason: string): string {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(game.name)}</title>
<style>
  html,body{height:100%;margin:0;background:#0b0e14;color:#eef1f6;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  main{height:100%;display:grid;place-content:center;text-align:center;padding:24px}
  h1{margin:0 0 6px;font-size:20px}
  p{margin:0;color:#8a93a6;max-width:46ch}
  code{color:#ff9a9a;font-size:12px}
  a{display:inline-block;margin-top:18px;padding:8px 16px;border-radius:8px;background:#3d7bff;color:#fff;text-decoration:none;font-weight:600}
</style></head><body><main>
  <h1>${escapeHtml(game.name)} didn't load</h1>
  <p>${escapeHtml(url.hostname)} could not be reached. The site may be down or misconfigured.</p>
  <p><code>${escapeHtml(reason)}</code></p>
  <div><a href="${escapeHtml(url.toString())}">Try again</a></div>
</main></body></html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

// Browser games get their own window and storage, so saves survive restarts and stay apart.
export function openWebGame(game: Game): void {
  if (!game.web) throw new Error('This game does not run in the browser')
  const open = windows.get(game.id)
  if (open && !open.isDestroyed()) {
    if (open.isMinimized()) open.restore()
    open.focus()
    return
  }
  const url = new URL(game.web.url)
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    title: game.name,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      partition: `persist:web-${game.id}`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  window.webContents.setWindowOpenHandler(({ url: next }) => {
    if (next.startsWith('https://')) void shell.openExternal(next)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, next) => {
    if (new URL(next).origin !== url.origin) {
      event.preventDefault()
      if (next.startsWith('https://')) void shell.openExternal(next)
    }
  })
  window.webContents.on('did-fail-load', (_event, code, description, _failedUrl, isMainFrame) => {
    // -3 is an aborted load, which also happens on ordinary redirects.
    if (!isMainFrame || code === -3) return
    void window.loadURL(errorPage(game, url, `${description} (${code})`))
  })
  // A page that sets no background expects the browser's white. Black only covers the wait before it loads.
  window.webContents.on('dom-ready', () => window.setBackgroundColor('#ffffff'))
  window.on('closed', () => windows.delete(game.id))
  windows.set(game.id, window)
  void window.loadURL(url.toString())
}
