// Electron 진입점. 창과 OS 알림으로 UiPort를 만들어 Relay를 조립한다 (I2, I26).
import { join } from 'node:path'
import { app, BrowserWindow, dialog, Notification } from 'electron'
import { skillsDir } from '../adapters/claude'
import { relayHome } from '../adapters/store'
import { IPC } from '../shared/api'
import { registerIpc } from './ipc'
import type { UiPort } from './ports'
import { Relay } from './relay'

let win: BrowserWindow | null = null

function send(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}

const ui: UiPort = {
  work: (view) => send(IPC.work, view),
  projects: (views) => send(IPC.projects, views),
  terminal: (key, chunk) => send(IPC.terminalData(key), chunk),
  // 사람이 창을 보고 있지 않을 때만 알린다 (D81의 조건. M2는 한 번에 Work 하나라 창으로 가른다)
  notify: ({ title, body }) => {
    if (Notification.isSupported() && !win?.isFocused()) new Notification({ title, body }).show()
  },
}

/** 앱에 묶은 스킬 원본 (I7, D103). 설치본은 resources/skills, 개발 중에는 레포의 skills/ */
function bundledSkills(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'skills')
    : join(app.getAppPath(), '..', 'skills')
}

const ready = app
  .whenReady()
  .then(() =>
    Relay.open({ home: relayHome(), skills: skillsDir(process.env, bundledSkills()), ui }),
  )
registerIpc(ready)
ready.catch((e: unknown) => {
  dialog.showErrorBox('relay를 시작할 수 없습니다', e instanceof Error ? e.message : String(e))
  app.quit()
})

function createWindow(): void {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win?.show())
  // 산출물의 링크가 창을 다른 곳으로 옮기지 않게 한다
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  // electron-vite dev 서버가 있으면 그곳을, 없으면 빌드한 파일을 연다.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 끝내기 전에 살아 있는 세션의 프로세스 트리를 끝낸다 (7절: 세션 종료는 트리 단위).
// 앱 종료 확인과 재시작 처리는 M3에서 넣는다.
let quitting = false
app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void ready
    .then((relay) => relay.close())
    .catch(() => {})
    .finally(() => app.quit())
})
