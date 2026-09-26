// 터미널 탭의 PTY 세션을 맡는다 (M0). 렌더러 명령은 invoke로 받고,
// 출력과 종료는 세션별 채널로 보낸다 (I14).
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { findClaude } from '../adapters/claude'
import { startPty, type PtySession } from '../adapters/pty'
import { IPC, type AppInfo, type StartResult } from '../shared/api'

interface Entry {
  cwd: string
  sender: WebContents
  pty?: PtySession
}

const sessions = new Map<string, Entry>()

function windowsBuild(): number | null {
  if (process.platform !== 'win32') return null
  const m = /^\d+\.\d+\.(\d+)/.exec(os.release())
  return m?.[1] ? Number(m[1]) : null
}

function send(e: Entry, channel: string, ...args: unknown[]): void {
  if (!e.sender.isDestroyed()) e.sender.send(channel, ...args)
}

export function registerTerminalIpc(): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    platform: process.platform,
    windowsBuild: windowsBuild(),
  }))

  ipcMain.handle(IPC.pickFolder, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts = { properties: ['openDirectory' as const], title: 'claude를 실행할 폴더' }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.create, (event, cwd: string) => {
    const id = randomUUID()
    sessions.set(id, { cwd, sender: event.sender })
    return id
  })

  ipcMain.handle(IPC.start, (_event, id: string, cols: number, rows: number): StartResult => {
    const e = sessions.get(id)
    if (!e) return { ok: false, error: '세션이 없습니다' }
    if (e.pty) return { ok: false, error: '이미 시작한 세션입니다' }
    const bin = findClaude()
    if (!bin) {
      return {
        ok: false,
        error:
          'claude 실행 파일을 찾지 못했습니다. Claude Code를 설치하거나 CLAUDE_BIN 환경 변수로 경로를 알려 주세요.',
      }
    }
    try {
      const pty = startPty({ bin, cwd: e.cwd, cols, rows })
      pty.onData((d) => send(e, IPC.data(id), d))
      pty.onExit((code) => send(e, IPC.exit(id), code))
      e.pty = pty
      return { ok: true, pid: pty.pid, bin }
    } catch (err) {
      return { ok: false, error: `실행 실패: ${err instanceof Error ? err.message : String(err)}` }
    }
  })

  ipcMain.handle(IPC.write, (_event, id: string, data: string) => {
    sessions.get(id)?.pty?.write(data)
  })

  ipcMain.handle(IPC.resize, (_event, id: string, cols: number, rows: number) => {
    if (cols > 0 && rows > 0) sessions.get(id)?.pty?.resize(cols, rows)
  })

  ipcMain.handle(IPC.close, async (_event, id: string) => {
    const e = sessions.get(id)
    sessions.delete(id)
    await e?.pty?.killTree()
  })
}

export function hasSessions(): boolean {
  return [...sessions.values()].some((e) => e.pty)
}

/** 앱을 끝낼 때 모든 세션의 프로세스 트리를 끝낸다 */
export async function killAllSessions(): Promise<void> {
  const all = [...sessions.values()]
  sessions.clear()
  await Promise.all(all.map((e) => e.pty?.killTree()))
}
