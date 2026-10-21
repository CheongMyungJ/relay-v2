// 렌더러 명령을 Relay로 잇는다 (I14). 명령은 invoke로 받고, 상태는 UiPort가 스냅샷으로 보낸다.
// 값은 여기서 모양만 확인하고, 뜻(상태에 맞는 명령인지, 설정 값의 범위)은 Relay와 core가 판정한다.
import os from 'node:os'
import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
import { IPC, type AppInfo, type UpdateState } from '../shared/api'
import type { DraftRef } from '../shared/session'
import type {
  ApproveOptions,
  CleanExpect,
  CleanInput,
  DeliverInput,
  MergeInput,
  NewWorkInput,
  PrItemAction,
  RespondStartInput,
} from '../shared/views'
import { WORK_TYPES, type DeliveryChoice, type MergeMethod, type WorkType } from '../shared/work'
import type { Relay } from './relay'
import { PASTE_MAX_BYTES, pasteExt } from './links'
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

function bytes(v: unknown): Uint8Array {
  if (v instanceof ArrayBuffer) return new Uint8Array(v)
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
  throw new Error('바이트가 아님')
}

function flag(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error('true/false가 아님')
  return v
}

/** 업무 유형 (D236) */
function workType(v: unknown): WorkType {
  const found = WORK_TYPES.find((t) => t === v)
  if (!found) throw new Error('업무 유형이 아님')
  return found
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
    submodules: x['submodules'] === undefined ? [] : texts(x['submodules']),
    ...(x['integration'] === undefined ? {} : { integration: texts(x['integration']) }),
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

/** 새 Work를 만든 초안의 자리 (D404) */
function draftRef(v: unknown): DraftRef {
  if (!v || typeof v !== 'object') throw new Error('초안 자리가 아님')
  const o = v as Record<string, unknown>
  const source = o['source']
  if (!source || typeof source !== 'object') throw new Error('초안을 만든 곳이 없음')
  const src = source as Record<string, unknown>
  const kind = src['kind']
  if (kind !== 'session' && kind !== 'work') throw new Error('모르는 초안의 만든 곳')
  return { source: { kind, id: text(src['id']) }, name: text(o['name']) }
}

export interface IpcHooks {
  /** 사람이 보고 있는 Work가 바뀌었다 (D81) */
  onSelectWork(workKey: string | null): void
  /** 앱 업데이트 (I121). 업데이트는 Relay가 아니라 main/index가 맡는다 */
  updateState(): UpdateState
  checkUpdate(): void
  installUpdate(): Promise<void>
}

export function registerIpc(ready: Promise<Relay>, hooks: IpcHooks): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    platform: process.platform,
    windowsBuild: windowsBuild(),
    version: app.getVersion(),
  }))
  ipcMain.handle(IPC.updateState, () => hooks.updateState())
  ipcMain.handle(IPC.checkUpdate, () => hooks.checkUpdate())
  ipcMain.handle(IPC.installUpdate, () => hooks.installUpdate())
  ipcMain.handle(IPC.snapshot, async () => (await ready).snapshot())

  ipcMain.handle(IPC.pickFolder, async (event, title: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts = { properties: ['openDirectory' as const], title: text(title) }
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
  ipcMain.handle(IPC.projectRemovePreview, async (_e, projectId: unknown) =>
    (await ready).projectRemovePreview(text(projectId)),
  )
  ipcMain.handle(IPC.removeProject, async (_e, projectId: unknown) =>
    (await ready).removeProject(text(projectId)),
  )
  ipcMain.handle(IPC.branches, async (_e, projectId: unknown) =>
    (await ready).branches(text(projectId)),
  )
  ipcMain.handle(IPC.branchName, async (_e, projectId: unknown, type: unknown, slug: unknown) =>
    (await ready).branchName(text(projectId), workType(type), text(slug)),
  )
  ipcMain.handle(IPC.submodules, async (_e, projectId: unknown) =>
    (await ready).submodules(text(projectId)),
  )
  ipcMain.handle(IPC.prepareSubmodule, async (_e, projectId: unknown, sub: unknown) =>
    (await ready).prepareSubmodule(text(projectId), text(sub)),
  )

  ipcMain.handle(IPC.createWork, async (_e, projectId: unknown, input: NewWorkInput) =>
    (await ready).createWork(text(projectId), {
      request: text(input.request),
      type: workType(input.type),
      baseBranch: text(input.baseBranch),
      baseLocation: input.baseLocation === 'remote' ? 'remote' : 'local',
      // 작업 브랜치와 머지 대상 (D425~D428). 이름을 쓸 수 있는지는 Relay.createWork가 본다
      ...(typeof input.branchName === 'string' ? { branchName: input.branchName } : {}),
      ...(typeof input.slug === 'string' ? { slug: input.slug } : {}),
      ...(typeof input.targetBranch === 'string' ? { targetBranch: input.targetBranch } : {}),
      ...(input.settings === undefined ? {} : { settings: input.settings }),
      // 기존 이슈 번호 (D338). 정수인지는 Relay.createWork가 본다
      ...(typeof input.issueNumber === 'number' ? { issueNumber: input.issueNumber } : {}),
      ...(input.draft === undefined ? {} : { draft: draftRef(input.draft) }),
      // 다시 하기: Work에서 쓴 초안으로 만들 때 원래 Work를 포기한다 (D421)
      ...(input.abandonOriginal === true ? { abandonOriginal: true } : {}),
      // 메인 통합 검증 worktree (D414). 서브모듈 프로젝트인지는 Relay.createWork가 본다
      ...(input.integration && typeof input.integration === 'object'
        ? {
            integration: {
              baseBranch: text(input.integration.baseBranch),
              baseLocation: input.integration.baseLocation === 'remote' ? 'remote' : 'local',
            },
          }
        : {}),
    }),
  )
  ipcMain.handle(
    IPC.knowledgeTidy,
    async (_e, projectId: unknown, branch: unknown, location: unknown) =>
      (await ready).knowledgeTidy(
        text(projectId),
        text(branch),
        location === 'remote' ? 'remote' : 'local',
      ),
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
  ipcMain.handle(IPC.stopAfter, async (_e, workKey: unknown, on: unknown) =>
    (await ready).stopAfter(text(workKey), flag(on)),
  )
  ipcMain.handle(IPC.setTarget, async (_e, workKey: unknown, branch: unknown) =>
    (await ready).setTarget(text(workKey), text(branch)),
  )
  ipcMain.handle(IPC.shelve, async (_e, workKey: unknown) => (await ready).shelve(text(workKey)))
  ipcMain.handle(IPC.resumeWork, async (_e, workKey: unknown) =>
    (await ready).resumeWork(text(workKey)),
  )
  ipcMain.handle(IPC.abandon, async (_e, workKey: unknown) => (await ready).abandon(text(workKey)))
  ipcMain.handle(IPC.deleteWork, async (_e, workKey: unknown, clean: unknown) =>
    (await ready).deleteWork(text(workKey), clean === null ? null : cleanInput(clean)),
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
  ipcMain.handle(IPC.openSide, async (_e, workKey: unknown, fresh: unknown) =>
    (await ready).openSide(text(workKey), flag(fresh)),
  )
  ipcMain.handle(IPC.closeSide, async (_e, workKey: unknown) =>
    (await ready).closeSide(text(workKey)),
  )
  ipcMain.handle(IPC.defaultSessionDir, async () => (await ready).defaultSessionDir())
  ipcMain.handle(IPC.createSession, async (_e, cwd: unknown) =>
    (await ready).createSession(text(cwd)),
  )
  ipcMain.handle(IPC.openSession, async (_e, id: unknown, fresh: unknown) =>
    (await ready).openSession(text(id), flag(fresh)),
  )
  ipcMain.handle(IPC.closeSession, async (_e, id: unknown) => (await ready).closeSession(text(id)))
  ipcMain.handle(IPC.renameSession, async (_e, id: unknown, name: unknown) =>
    (await ready).renameSession(text(id), text(name)),
  )
  ipcMain.handle(IPC.deleteSession, async (_e, id: unknown) =>
    (await ready).deleteSession(text(id)),
  )
  ipcMain.handle(IPC.discardDraft, async (_e, ref: unknown) =>
    (await ready).discardDraft(draftRef(ref)),
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
  // 터미널의 경로 열기 (D411, D412). 경로는 main이 그 터미널의 폴더에서 다시 풀고 있는지 본다. 주소는 openExternal로 연다
  ipcMain.handle(IPC.terminalPaths, async (_e, key: unknown, groups: unknown) => {
    if (!Array.isArray(groups)) throw new Error('경로 목록이 아님')
    const tries = groups.slice(0, 50).map((g) => texts(g).slice(0, 4))
    return (await ready).terminalPaths(text(key), tries)
  })
  ipcMain.handle(IPC.terminalOpen, async (_e, key: unknown, raw: unknown) => {
    const target = await (await ready).terminalTarget(text(key), text(raw))
    if (!target) throw new Error(`열 수 있는 파일이 아님: ${text(raw)}`)
    // 안전한 형식이 아니면 실행하지 않고 폴더에서 보여 준다
    if (!target.open) return shell.showItemInFolder(target.path)
    const error = await shell.openPath(target.path)
    if (error) throw new Error(error)
  })
  // 붙여넣거나 끌어 놓은 그림 (D410). 엔진이 받지 않는 형식은 PNG로 바꾼다
  ipcMain.handle(IPC.terminalSaveImage, async (_e, data: unknown, mime: unknown) => {
    let image = bytes(data)
    if (image.byteLength === 0 || image.byteLength > PASTE_MAX_BYTES) {
      throw new Error('그림이 비었거나 너무 큼')
    }
    let ext = pasteExt(text(mime))
    if (!ext) {
      const native = nativeImage.createFromBuffer(Buffer.from(image))
      if (native.isEmpty()) throw new Error(`읽을 수 없는 그림 형식: ${text(mime)}`)
      image = native.toPNG()
      ext = 'png'
    }
    return (await ready).savePaste(image, ext)
  })
}
