// 렌더러 명령을 Relay로 잇는다 (I14). 명령은 invoke로 받고, 상태는 UiPort가 스냅샷으로 보낸다.
// 값은 여기서 모양만 확인하고, 뜻(상태에 맞는 명령인지, 설정 값의 범위)은 Relay와 core가 판정한다.
import os from 'node:os'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, type AppInfo } from '../shared/api'
import type { ApproveOptions, NewWorkInput } from '../shared/views'
import type { Relay } from './relay'

function windowsBuild(): number | null {
  if (process.platform !== 'win32') return null
  const m = /^\d+\.\d+\.(\d+)/.exec(os.release())
  return m?.[1] ? Number(m[1]) : null
}

function text(v: unknown): string {
  if (typeof v !== 'string') throw new Error('문자열이 아님')
  return v
}

function count(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('숫자가 아님')
  return Math.floor(v)
}

function flag(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error('true/false가 아님')
  return v
}

export interface IpcHooks {
  /** 사람이 보고 있는 Work가 바뀌었다 (D81) */
  onSelectWork(workKey: string | null): void
}

export function registerIpc(ready: Promise<Relay>, hooks: IpcHooks): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    platform: process.platform,
    windowsBuild: windowsBuild(),
  }))
  ipcMain.handle(IPC.snapshot, async () => (await ready).snapshot())

  ipcMain.handle(IPC.pickFolder, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts = { properties: ['openDirectory' as const], title: '등록할 레포 폴더' }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })
  ipcMain.handle(IPC.inspectProject, async (_e, dir: unknown) =>
    (await ready).inspectProject(text(dir)),
  )
  ipcMain.handle(IPC.registerProject, async (_e, dir: unknown, branch: unknown) => {
    const r = await (await ready).registerProject(text(dir), text(branch))
    return r.ok ? { ok: true } : r
  })
  ipcMain.handle(IPC.branches, async (_e, projectId: unknown) =>
    (await ready).branches(text(projectId)),
  )

  ipcMain.handle(IPC.createWork, async (_e, projectId: unknown, input: NewWorkInput) =>
    (await ready).createWork(text(projectId), {
      request: text(input.request),
      baseBranch: text(input.baseBranch),
      baseLocation: input.baseLocation === 'remote' ? 'remote' : 'local',
      ...(input.settings === undefined ? {} : { settings: input.settings }),
    }),
  )
  ipcMain.handle(IPC.review, async (_e, workKey: unknown, taskId: unknown) =>
    (await ready).review(text(workKey), text(taskId)),
  )
  ipcMain.handle(IPC.approve, async (_e, workKey: unknown, taskId: unknown, opts: ApproveOptions) =>
    (await ready).approve(text(workKey), text(taskId), {
      ...(opts.size === 'S' || opts.size === 'M' || opts.size === 'L' ? { size: opts.size } : {}),
      ...(opts.force === true ? { force: true } : {}),
    }),
  )

  ipcMain.handle(IPC.interrupt, async (_e, workKey: unknown, taskId: unknown) =>
    (await ready).interrupt(text(workKey), text(taskId)),
  )
  ipcMain.handle(IPC.resume, async (_e, workKey: unknown, taskId: unknown) =>
    (await ready).resume(text(workKey), text(taskId)),
  )
  ipcMain.handle(IPC.retry, async (_e, workKey: unknown, taskId: unknown) =>
    (await ready).retry(text(workKey), text(taskId)),
  )
  ipcMain.handle(IPC.stopAfter, async (_e, workKey: unknown, on: unknown) =>
    (await ready).stopAfter(text(workKey), flag(on)),
  )
  ipcMain.handle(IPC.resumeWork, async (_e, workKey: unknown) =>
    (await ready).resumeWork(text(workKey)),
  )
  ipcMain.handle(IPC.abandon, async (_e, workKey: unknown) => (await ready).abandon(text(workKey)))
  ipcMain.handle(IPC.workSettings, async (_e, workKey: unknown, settings: unknown) =>
    (await ready).updateWorkSettings(text(workKey), settings),
  )
  ipcMain.handle(IPC.config, async () => (await ready).currentConfig())
  ipcMain.handle(IPC.updateConfig, async (_e, patch: unknown) => {
    const r = await (await ready).updateConfig(patch)
    return r.ok ? { ok: true } : r
  })
  ipcMain.on(IPC.selectWork, (_e, workKey: unknown) => {
    hooks.onSelectWork(typeof workKey === 'string' ? workKey : null)
  })

  ipcMain.handle(IPC.terminalAttach, async (_e, key: unknown) =>
    (await ready).terminalAttach(text(key)),
  )
  ipcMain.handle(IPC.terminalWrite, async (_e, key: unknown, data: unknown) => {
    ;(await ready).terminalWrite(text(key), text(data))
  })
  ipcMain.handle(IPC.terminalResize, async (_e, key: unknown, cols: unknown, rows: unknown) => {
    ;(await ready).terminalResize(text(key), count(cols), count(rows))
  })
}
