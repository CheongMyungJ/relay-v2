import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { hasSessions, killAllSessions, registerTerminalIpc } from './terminals'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())

  // electron-vite dev 서버가 있으면 그곳을, 없으면 빌드한 파일을 연다.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(() => {
  registerTerminalIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 끝내기 전에 살아 있는 세션의 프로세스 트리를 끝낸다 (7절: 세션 종료는 트리 단위).
let quitting = false
app.on('before-quit', (event) => {
  if (quitting || !hasSessions()) return
  event.preventDefault()
  quitting = true
  void killAllSessions().finally(() => app.quit())
})
