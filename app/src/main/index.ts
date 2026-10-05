// Electron 진입점. 창과 OS 알림으로 UiPort를 만들어 Relay를 조립한다 (I2, I26).
import { join } from 'node:path'
import { app, BrowserWindow, dialog, nativeTheme, Notification } from 'electron'
import { skillsDir } from '../adapters/claude'
import { relayHome } from '../adapters/store'
import { IPC } from '../shared/api'
import type { AppConfig } from '../shared/config'
import { holdSingleInstance } from './instance'
import { registerIpc } from './ipc'
import { APP_USER_MODEL_ID, keepNotice } from './notices'
import type { Notice, UiPort } from './ports'
import { Relay } from './relay'
import { WEB_PREFERENCES } from './security'
import { startUpdates, updatesEnabled } from './update'

let win: BrowserWindow | null = null
/** 사람이 창에서 고른 Work (D81의 "그 Work를 보고 있는가") */
let selectedWork: string | null = null

function send(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}

/** 사람이 그 Work를 보고 있다: 창이 떠 있고 포커스가 있고, 그 Work를 고른 상태다 (D81) */
function looking(workKey: string): boolean {
  return (
    !!win &&
    !win.isDestroyed() &&
    win.isVisible() &&
    !win.isMinimized() &&
    win.isFocused() &&
    selectedWork === workKey
  )
}

/** 창을 앞으로 가져온다. 창이 없으면 false */
function showWindow(): boolean {
  if (!win || win.isDestroyed()) return false
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return true
}

/** 누르기 전까지 붙잡아 둔 알림 (D142) */
const notices = new Set<Notification>()

/** OS 알림 (D81). 보고 있지 않을 때만 보내고, 누르면 창을 띄워 그 Work를 고른다 */
function notify(n: Notice): void {
  if (!Notification.isSupported() || looking(n.workKey)) return
  const notice = keepNotice(notices, new Notification({ title: n.title, body: n.body }))
  notice.on('click', () => {
    if (showWindow()) send(IPC.focusWork, n.workKey)
  })
  notice.show()
}

/** 새 버전을 받았다는 알림 (I95). 보고 있어도 보낸다. 누르면 창만 띄운다 */
function notifyUpdate(version: string): void {
  if (!Notification.isSupported()) return
  const notice = keepNotice(
    notices,
    new Notification({
      title: `새 버전 받음: relay ${version}`,
      body: '앱을 끝내면 설치되고 다음 실행부터 새 버전입니다.',
    }),
  )
  notice.on('click', () => void showWindow())
  notice.show()
}

const ui: UiPort = {
  work: (view) => send(IPC.work, view),
  activity: (update) => send(IPC.activity, update),
  projects: (views) => send(IPC.projects, views),
  terminal: (key, chunk) => send(IPC.terminalData(key), chunk),
  notify,
}

/** 앱에 묶은 스킬 원본 (I7, D103). 설치본은 resources/skills, 개발 중에는 레포의 skills/ */
function bundledSkills(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'skills')
    : join(app.getAppPath(), '..', 'skills')
}

// Windows의 토스트와 클릭이 이 앱으로 오게 설치 파일과 같은 앱 ID를 쓴다 (D142). 개발 중에는 바꾸지 않는다
if (process.platform === 'win32' && app.isPackaged) app.setAppUserModelId(APP_USER_MODEL_ID)

// 앱은 하나만 켠다 (D133). 두 번째로 켠 앱은 relay를 열지 않고 끝나고, 첫 앱이 창을 앞으로 가져온다
const primary = holdSingleInstance(app, () => void showWindow())

const ready: Promise<Relay> = primary
  ? app
      .whenReady()
      .then(() =>
        Relay.open({ home: relayHome(), skills: skillsDir(process.env, bundledSkills()), ui }),
      )
  : new Promise<Relay>(() => {})
/** 화면 테마 (D335). 렌더러의 CSS는 prefers-color-scheme만 보므로 main이 정한다 */
function applyTheme(config: AppConfig): void {
  nativeTheme.themeSource = config.theme
}

void ready.then((relay) => applyTheme(relay.currentConfig())).catch(() => undefined)
registerIpc(ready, {
  onSelectWork: (workKey) => {
    selectedWork = workKey
  },
  onConfig: applyTheme,
})
ready.catch((e: unknown) => {
  dialog.showErrorBox('relay를 시작할 수 없습니다', e instanceof Error ? e.message : String(e))
  app.quit()
})

/**
 * 앱 종료 확인 (시나리오 3-6, 기본값). 실행 중인 세션이 있으면 확인 창을 띄운다.
 * 확인하면 세션을 "중단됨"으로 남기고 트리째 끝낸다(Relay.close). 다음 실행 때 [재개]할 수 있다.
 */
let quitConfirmed = false
let confirming: Promise<boolean> | null = null

function confirmQuit(): Promise<boolean> {
  if (quitConfirmed) return Promise.resolve(true)
  confirming ??= ask().finally(() => {
    confirming = null
  })
  return confirming
}

async function ask(): Promise<boolean> {
  const relay = await ready.catch(() => null)
  if (relay?.hasLiveSessions()) {
    const opts = {
      type: 'question' as const,
      buttons: ['종료', '취소'],
      defaultId: 1,
      cancelId: 1,
      title: 'relay 종료',
      message: '실행 중인 세션이 있습니다',
      detail: '종료하면 세션을 끝내고 "중단됨"으로 남깁니다. 다음 실행 때 [재개]할 수 있습니다.',
    }
    const r =
      win && !win.isDestroyed()
        ? await dialog.showMessageBox(win, opts)
        : await dialog.showMessageBox(opts)
    if (r.response !== 0) return false
  }
  quitConfirmed = true
  return true
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), ...WEB_PREFERENCES },
  })
  win.once('ready-to-show', () => win?.show())
  // 산출물의 링크가 창을 다른 곳으로 옮기지 않게 한다
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  // 실행 중인 세션이 있으면 창을 닫기 전에 확인한다 (시나리오 3-6)
  // macOS는 창을 닫아도 앱이 남으므로 앱을 끝낼 때(before-quit)만 묻는다
  win.on('close', (event) => {
    if (quitConfirmed || process.platform === 'darwin') return
    event.preventDefault()
    void confirmQuit().then((ok) => {
      if (ok) app.quit()
    })
  })

  // electron-vite dev 서버가 있으면 그곳을, 없으면 빌드한 파일을 연다.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(() => {
  if (!primary) return
  createWindow()
  const target = {
    env: process.env,
    packaged: app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
  }
  if (updatesEnabled(target)) startUpdates(notifyUpdate)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 끝내기 전에 살아 있는 세션을 중단됨으로 남기고 프로세스 트리를 끝낸다 (7절: 세션 종료는 트리 단위).
let quitting = false
app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  void confirmQuit().then((ok) => {
    if (!ok || quitting) return
    quitting = true
    void ready
      .then((relay) => relay.close())
      .catch(() => {})
      .finally(() => app.quit())
  })
})
