// 렌더러 명령을 Relay로 잇는다 (I14). 명령은 invoke로 받고, 상태는 UiPort가 스냅샷으로 보낸다.
// 값은 여기서 모양만 확인하고, 뜻(상태에 맞는 명령인지, 설정 값의 범위)은 Relay와 core가 판정한다.
import os from 'node:os'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { ALL_NODES } from '../core/pipeline'
import { IPC, type AppInfo } from '../shared/api'
import type { NodeName } from '../shared/contracts'
import type {
  ApproveOptions,
  CleanExpect,
  CleanInput,
  DeliverInput,
  MergeInput,
  NewWorkInput,
  PrItemAction,
  RespondStartInput,
  SelectStepInput,
} from '../shared/views'
import { WORK_TYPES, type DeliveryChoice, type MergeMethod, type WorkType } from '../shared/work'
import type { Relay } from './relay'
import { externalUrl } from './security'

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

function node(v: unknown): NodeName {
  const found = ALL_NODES.find((n) => n === v)
  if (!found) throw new Error('파이프라인 단계가 아님')
  return found
}

/** 업무 유형 (D236) */
function workType(v: unknown): WorkType {
  const found = WORK_TYPES.find((t) => t === v)
  if (!found) throw new Error('업무 유형이 아님')
  return found
}

/** 고르지 않을 수 있는 업무 유형: undefined나 null이면 없다 ([intake 다시]의 유형 고르기, D237) */
function optionalType(v: unknown): WorkType | undefined {
  return v === undefined || v === null ? undefined : workType(v)
}

function stepInput(v: unknown): SelectStepInput {
  if (!v || typeof v !== 'object') throw new Error('단계 선택 입력이 아님')
  const o = v as Record<string, unknown>
  const expect = o['expect']
  if (!expect || typeof expect !== 'object') throw new Error('expect가 없음')
  const e = expect as Record<string, unknown>
  const type = optionalType(o['type'])
  return {
    node: node(o['node']),
    keepCode: flag(o['keepCode']),
    instruction: text(o['instruction']),
    expect: { taskId: text(e['taskId']), done: flag(e['done']) },
    ...(type === undefined ? {} : { type }),
  }
}

function texts(v: unknown): string[] {
  if (!Array.isArray(v)) throw new Error('문자열 목록이 아님')
  return v.map(text)
}

function choice(v: unknown): DeliveryChoice {
  if (v !== 'push' && v !== 'pr') throw new Error('전달 선택이 아님')
  return v
}

function deliverInput(v: unknown): DeliverInput {
  if (!v || typeof v !== 'object') throw new Error('전달 입력이 아님')
  const o = v as Record<string, unknown>
  const u = o['uncommitted']
  if (u === null || u === undefined) return { choice: choice(o['choice']), uncommitted: null }
  if (typeof u !== 'object') throw new Error('커밋 안 된 변경의 처리가 아님')
  const w = u as Record<string, unknown>
  const action = w['action']
  if (action !== 'discard' && action !== 'commit') throw new Error('커밋 안 된 변경의 처리가 아님')
  return { choice: choice(o['choice']), uncommitted: { action, expect: texts(w['expect']) } }
}

function cleanInput(v: unknown): CleanInput {
  if (!v || typeof v !== 'object') throw new Error('정리 입력이 아님')
  const o = v as Record<string, unknown>
  const e = o['expect']
  if (!e || typeof e !== 'object') throw new Error('expect가 없음')
  const x = e as Record<string, unknown>
  const expect: CleanExpect = {
    uncommitted: texts(x['uncommitted']),
    locks: texts(x['locks']),
    live: count(x['live']),
    backups: texts(x['backups']),
    remote: flag(x['remote']),
    lost: x['lost'] === undefined ? [] : texts(x['lost']),
  }
  return {
    deleteBranch: flag(o['deleteBranch']),
    deleteBackups: flag(o['deleteBackups']),
    ...(o['deleteRemote'] === undefined ? {} : { deleteRemote: flag(o['deleteRemote']) }),
    confirmed: flag(o['confirmed']),
    ...(o['confirmLost'] === undefined ? {} : { confirmLost: flag(o['confirmLost']) }),
    expect,
  }
}

function mergeMethod(v: unknown): MergeMethod {
  if (v !== 'merge' && v !== 'squash' && v !== 'rebase') throw new Error('머지 방식이 아님')
  return v
}

function mergeInput(v: unknown): MergeInput {
  if (!v || typeof v !== 'object') throw new Error('머지 입력이 아님')
  const o = v as Record<string, unknown>
  return { method: mergeMethod(o['method']), head: text(o['head']) }
}

function itemAction(v: unknown): PrItemAction {
  if (v !== 'exclude' && v !== 'include' && v !== 'accept') throw new Error('항목 조작이 아님')
  return v
}

function respondInput(v: unknown): RespondStartInput {
  if (!v || typeof v !== 'object') throw new Error('대응 시작 입력이 아님')
  const o = v as Record<string, unknown>
  const items = o['items']
  if (!Array.isArray(items)) throw new Error('항목 목록이 아님')
  return { items: items.map(text), instruction: text(o['instruction']) }
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
      type: workType(input.type),
      baseBranch: text(input.baseBranch),
      baseLocation: input.baseLocation === 'remote' ? 'remote' : 'local',
      ...(input.settings === undefined ? {} : { settings: input.settings }),
      // 기존 이슈 번호 (D338). 정수인지는 Relay.createWork가 본다
      ...(typeof input.issueNumber === 'number' ? { issueNumber: input.issueNumber } : {}),
    }),
  )
  ipcMain.handle(IPC.review, async (_e, workKey: unknown, taskId: unknown) =>
    (await ready).review(text(workKey), text(taskId)),
  )
  ipcMain.handle(IPC.approve, async (_e, workKey: unknown, taskId: unknown, opts: ApproveOptions) =>
    (await ready).approve(text(workKey), text(taskId), {
      ...(opts.force === true ? { force: true } : {}),
    }),
  )

  ipcMain.handle(IPC.cancelCountdown, async (_e, workKey: unknown, taskId: unknown) =>
    (await ready).cancelCountdown(text(workKey), text(taskId)),
  )
  ipcMain.handle(
    IPC.answerQuestion,
    async (_e, workKey: unknown, taskId: unknown, questionId: unknown, answers: unknown) =>
      (await ready).answerQuestion(text(workKey), text(taskId), text(questionId), answers),
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
  ipcMain.handle(IPC.shelve, async (_e, workKey: unknown) => (await ready).shelve(text(workKey)))
  ipcMain.handle(IPC.resumeWork, async (_e, workKey: unknown) =>
    (await ready).resumeWork(text(workKey)),
  )
  ipcMain.handle(IPC.abandon, async (_e, workKey: unknown) => (await ready).abandon(text(workKey)))
  ipcMain.handle(
    IPC.stepPreview,
    async (_e, workKey: unknown, step: unknown, keepCode: unknown, type: unknown) =>
      (await ready).stepPreview(text(workKey), node(step), flag(keepCode), optionalType(type)),
  )
  ipcMain.handle(IPC.selectStep, async (_e, workKey: unknown, input: unknown) =>
    (await ready).selectStep(text(workKey), stepInput(input)),
  )
  ipcMain.handle(IPC.deliver, async (_e, workKey: unknown, input: unknown) =>
    (await ready).deliver(text(workKey), deliverInput(input)),
  )
  ipcMain.handle(IPC.openCleanup, async (_e, workKey: unknown, c: unknown) =>
    (await ready).openCleanup(text(workKey), choice(c)),
  )
  ipcMain.handle(IPC.closeCleanup, async (_e, workKey: unknown) =>
    (await ready).closeCleanup(text(workKey)),
  )
  ipcMain.handle(IPC.finishCleanup, async (_e, workKey: unknown) =>
    (await ready).finishCleanup(text(workKey)),
  )
  ipcMain.handle(IPC.recheck, async (_e, workKey: unknown) =>
    (await ready).recheckWork(text(workKey)),
  )
  ipcMain.handle(IPC.cleanPreview, async (_e, workKey: unknown) =>
    (await ready).cleanPreview(text(workKey)),
  )
  ipcMain.handle(IPC.clean, async (_e, workKey: unknown, input: unknown) =>
    (await ready).clean(text(workKey), cleanInput(input)),
  )
  ipcMain.handle(IPC.retryOperation, async (_e, workKey: unknown) =>
    (await ready).retryOperation(text(workKey)),
  )
  ipcMain.handle(IPC.ignoreOperation, async (_e, workKey: unknown) =>
    (await ready).ignoreOperation(text(workKey)),
  )
  ipcMain.handle(IPC.dismissNotice, async (_e, workKey: unknown, id: unknown) =>
    (await ready).dismissNotice(text(workKey), text(id)),
  )
  ipcMain.handle(IPC.prRefresh, async (_e, workKey: unknown) =>
    (await ready).prRefresh(text(workKey)),
  )
  ipcMain.handle(IPC.prItem, async (_e, workKey: unknown, itemId: unknown, action: unknown) =>
    (await ready).prItem(text(workKey), text(itemId), itemAction(action)),
  )
  ipcMain.handle(IPC.prMergeInfo, async (_e, workKey: unknown) =>
    (await ready).prMergeInfo(text(workKey)),
  )
  ipcMain.handle(IPC.prMerge, async (_e, workKey: unknown, input: unknown) =>
    (await ready).prMerge(text(workKey), mergeInput(input)),
  )
  ipcMain.handle(IPC.prEnd, async (_e, workKey: unknown) => (await ready).prEnd(text(workKey)))
  ipcMain.handle(IPC.prCleanOffered, async (_e, workKey: unknown) =>
    (await ready).prCleanOffered(text(workKey)),
  )
  ipcMain.handle(IPC.prRespond, async (_e, workKey: unknown, input: unknown) =>
    (await ready).prRespond(text(workKey), respondInput(input)),
  )
  ipcMain.handle(IPC.prRerun, async (_e, workKey: unknown) => (await ready).prRerun(text(workKey)))
  ipcMain.handle(IPC.issueRetry, async (_e, workKey: unknown) =>
    (await ready).issueRetry(text(workKey)),
  )
  ipcMain.handle(IPC.projectSettings, async (_e, projectId: unknown, settings: unknown) =>
    (await ready).updateProjectSettings(text(projectId), settings),
  )
  // 비교 URL과 PR 주소만 연다. 앱 창은 옮기지 않는다 (main/index)
  ipcMain.handle(IPC.openExternal, async (_e, url: unknown) => {
    await shell.openExternal(externalUrl(text(url)))
  })
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
