import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { catalog } from './catalog'
import { handleImageRequests, registerImageScheme } from './image-cache'
import { registerIpc } from './ipc'
import { autoUpdateInstalled } from './library'
import { startUpdater } from './updater'

registerImageScheme()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  function createWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1040,
      height: 680,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      useContentSize: true,
      show: false,
      title: 'OGL',
      backgroundColor: '#0b0e14',
      autoHideMenuBar: true,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })

    window.once('ready-to-show', () => window.show())

    if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
    else void window.loadFile(path.join(__dirname, '../renderer/index.html'))

    return window
  }

  void app.whenReady().then(async () => {
    handleImageRequests()
    registerIpc(() => mainWindow)
    await catalog.init()
    startUpdater()
    mainWindow = createWindow()
    void autoUpdateInstalled()
  })

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
