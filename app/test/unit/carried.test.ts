// [현재 코드 위에서 이어서]로 되감은 design 뒤의 implement가 이어서 하는지 (D254, core/context keptCodeDesign)
import { describe, expect, it } from 'vitest'
import { keptCodeDesign, selectionKind } from '../../src/core/context'
import { createWork, currentTask, transition, type MachineEvent } from '../../src/core/machine'
import { changeRange } from '../../src/core/review'
import type { TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff } from '../../src/shared/contracts'
import type { TaskRecord, WorkState } from '../../src/shared/work'

let clock = 0
const at = () => `2026-09-26T10:${String(clock++ % 60).padStart(2, '0')}:00+09:00`
const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}
const valid: TaskCheck = {
  handoff_present: true,
  status: 'awaiting_approval',
  errors: [],
  warnings: [],
  handoff: HANDOFF,
  handoffHeader: HANDOFF,
}
const MANUAL: AppConfig = {
  ...DEFAULT_CONFIG,
  auto_approve: {
    fix: false,
    design: false,
    implement: false,
    refactor: false,
    spec: false,
    execute: false,
    respond: false,
  },
}
const apply = (w: WorkState, e: MachineEvent) => transition(w, e, MANUAL)
function current(w: WorkState): TaskRecord {
  const t = currentTask(w)
  if (!t) throw new Error('지금 task가 없음')
  return t
}
function launch(w: WorkState): WorkState {
  const t = current(w)
  return apply(w, {
    type: 'session.started',
    taskId: t.id,
    at: at(),
    sessionId: `s-${t.id}`,
    pid: 1000 + t.seq,
    startCommit: `start-${t.id}`,
    skillHash: 'h',
    claudeVersion: 'x',
  } as MachineEvent).work
}
function step(w: WorkState): WorkState {
  w = launch(w)
  const t = current(w)
  w = apply(w, {
    type: 'Stop',
    taskId: t.id,
    at: at(),
    stopHookActive: false,
    handoffChanged: true,
    check: valid,
  } as MachineEvent).work
  return apply(w, { type: 'approve', taskId: t.id, at: at(), check: valid } as MachineEvent).work
}
/** verify까지 와서 [현재 코드 위에서 이어서]로 design을 고른 기능 추가 Work */
function keptDesign(): WorkState {
  let w = createWork({
    type: 'feature',
    workId: 'w-20260926-001',
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: at(),
  }).work
  w = launch(step(step(step(w))))
  const v = current(w)
  return apply(w, {
    type: 'selectStep',
    at: at(),
    node: 'design',
    keepCode: true,
    instruction: '',
    expect: { taskId: v.id, done: false },
    backups: [],
  } as MachineEvent).work
}

describe('[단위] 이어서 고친 design 뒤의 implement (D254)', () => {
  it('[이 단계 끝나면 멈춤] 뒤 [단계 선택]으로 기본 다음 단계 implement를 골라도 이어서 한다', () => {
    let w = apply(keptDesign(), { type: 'stopAfter', at: at(), on: true } as MachineEvent).work
    w = step(w)
    expect(w.status).toBe('stopped')
    const design = current(w)
    const r = apply(w, {
      type: 'selectStep',
      at: at(),
      node: 'implement',
      keepCode: false,
      instruction: '',
      expect: { taskId: design.id, done: true },
      backups: [],
    } as MachineEvent)
    expect(r.rejected).toBeUndefined()
    expect(keptCodeDesign(r.work, current(r.work))?.id).toBe(design.id)
  })

  it('이어서 하던 implement를 새 세션으로 다시 해도 이어서 한다', () => {
    let w = step(keptDesign())
    const design = w.tasks.find((t) => t.node === 'design' && t.selection?.keep_code)
    if (!design) throw new Error('이어서 고친 design이 없음')
    w = launch(w)
    const impl = current(w)
    expect(keptCodeDesign(w, impl)?.id).toBe(design.id)
    w = apply(w, {
      type: 'SessionEnd',
      taskId: impl.id,
      at: at(),
      sessionId: `s-${impl.id}`,
    } as MachineEvent).work
    const r = apply(w, { type: 'retry', taskId: impl.id, at: at() } as MachineEvent)
    expect(r.rejected).toBeUndefined()
    expect(keptCodeDesign(r.work, current(r.work))?.id).toBe(design.id)
  })
})

describe('[단위] [이 단계 새 세션으로 다시]는 단계 선택을 이어받는다 (D327)', () => {
  it('되감기의 추가 지시, 이어서 하기, 폐기한 task가 새 task에 남고 되감기로 보인다', () => {
    let w = createWork({
      type: 'feature',
      workId: 'w-20260926-002',
      baseBranch: 'main',
      baseCommit: 'base0001',
      at: at(),
    }).work
    w = launch(step(step(step(w))))
    const v = current(w)
    w = apply(w, {
      type: 'selectStep',
      at: at(),
      node: 'implement',
      keepCode: true,
      instruction: '테스트 이름은 keeps_total',
      expect: { taskId: v.id, done: false },
      backups: [],
    } as MachineEvent).work
    w = launch(w)
    const impl = current(w)
    expect(selectionKind(impl)).toBe('rewind')
    w = apply(w, {
      type: 'SessionEnd',
      taskId: impl.id,
      at: at(),
      sessionId: `s-${impl.id}`,
    } as MachineEvent).work
    const r = apply(w, { type: 'retry', taskId: impl.id, at: at() } as MachineEvent)
    expect(r.rejected).toBeUndefined()
    const again = current(r.work)
    expect(again.id).not.toBe(impl.id)
    expect(again.reason).toBe('resume')
    expect(again.selection).toMatchObject({
      instruction: '테스트 이름은 keeps_total',
      keep_code: true,
      discarded: impl.selection?.discarded,
    })
    expect(selectionKind(again)).toBe('rewind')
  })

  it('코드를 되돌린 되감기는 이어받지 않는다: 다시 한 task는 코드를 되돌리지 않았다 (PR #30 리뷰)', () => {
    let w = createWork({
      type: 'bugfix',
      workId: 'w-20260926-003',
      baseBranch: 'main',
      baseCommit: 'base0001',
      at: at(),
    }).work
    w = launch(step(step(w)))
    const v = current(w)
    w = apply(w, {
      type: 'selectStep',
      at: at(),
      node: 'fix',
      keepCode: false,
      instruction: '',
      expect: { taskId: v.id, done: false },
      backups: [],
    } as MachineEvent).work
    w = apply(w, {
      type: 'rewind.backedUp',
      at: at(),
      branch: 'b',
      commit: 'c0ffee',
    } as MachineEvent).work
    w = launch(
      apply(w, { type: 'rewind.applied', at: at(), head: 'head0001' } as MachineEvent).work,
    )
    const fix = current(w)
    expect(fix.selection?.reset).not.toBeNull()
    w = apply(w, {
      type: 'SessionEnd',
      taskId: fix.id,
      at: at(),
      sessionId: `s-${fix.id}`,
    } as MachineEvent).work
    const r = apply(w, { type: 'retry', taskId: fix.id, at: at() } as MachineEvent)
    expect(r.rejected).toBeUndefined()
    const again = current(r.work)
    expect(again.selection?.reset).toBeNull()
    expect(selectionKind(again)).toBe('rewind')
    // 앞 task의 [변경]은 그 task의 시작 커밋부터이고, 버린 시도의 백업으로 거꾸로 가지 않는다
    expect(changeRange(r.work, fix.id)?.to).not.toBe('c0ffee')
  })
})
