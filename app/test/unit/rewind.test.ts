import { describe, expect, it } from 'vitest'
import { taskId } from '../../src/core/machine'
import {
  backupBranch,
  backupMessage,
  backupPattern,
  canSelectStep,
  nextBackupBranch,
  planStep,
  stepChoices,
  stepPreview,
  type StepOptions,
  type StepPlan,
} from '../../src/core/rewind'
import type { NodeName } from '../../src/shared/contracts'
import type { TaskRecord, TaskStatus, WorkState, WorkStop } from '../../src/shared/work'

const AT = '2026-09-27T10:00:00+09:00'
const WORK_ID = 'w-20260927-001'
const LIVE = { id: 's', pid: 1, started_at: AT, alive: true }

/** task. 한 번 띄운 task는 시작 커밋(start-<순번>)이 있다 */
function task(
  seq: number,
  node: NodeName,
  status: TaskStatus,
  extra: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    id: taskId(seq),
    seq,
    node,
    status,
    reason: 'default',
    format_version: 1,
    created_at: AT,
    start_commit: `start-${seq}`,
    session: status === 'approved' ? { ...LIVE, alive: false } : LIVE,
    bounce_count: 0,
    check: null,
    ...extra,
  }
}

function work(
  tasks: TaskRecord[],
  opts: { approved?: boolean; status?: WorkState['status']; stop?: WorkStop } = {},
): WorkState {
  return {
    schema_version: 1,
    work_id: WORK_ID,
    status: opts.status ?? 'active',
    created_at: AT,
    base_branch: 'main',
    base_commit: 'base',
    intent: opts.approved === false ? null : { version: 1 },
    settings: {},
    ...(opts.stop ? { stop: opts.stop } : {}),
    tasks,
  }
}

/**
 * 앞 단계를 모두 승인하고 node가 지금 task인 Work (D227):
 * t-01 intake, t-02 fix, t-03 verify
 */
function at(node: NodeName, status: TaskStatus = 'working'): WorkState {
  const nodes: NodeName[] = ['intake', 'fix', 'verify']
  const upto = nodes.slice(0, nodes.indexOf(node) + 1)
  return work(upto.map((n, i) => task(i + 1, n, n === node ? status : 'approved')))
}

/** node를 승인하고 멈춘 Work (6.2의 "k 완료") */
function stoppedAfter(node: NodeName): WorkState {
  const w = at(node, 'approved')
  return {
    ...w,
    status: 'stopped',
    stop: { kind: 'after_step', task_id: w.tasks.at(-1)?.id ?? '' },
  }
}

function plan(w: WorkState, node: NodeName, opts?: StepOptions): StepPlan {
  const r = planStep(w, node, opts)
  if (!r.ok) throw new Error(r.error)
  return r.plan
}

const ids = (tasks: readonly TaskRecord[]) => tasks.map((t) => t.id)

describe('6.2 표의 네 경우', () => {
  it('k 진행 중에 k 이하를 고르면: k를 중단하고, 고른 단계부터 k까지 폐기하고, 고른 단계를 다시 실행한다', () => {
    const p = plan(at('verify'), 'fix')
    expect(p).toMatchObject({
      node: 'fix',
      kind: 'rewind',
      done: false,
      interrupt: 'session',
      skipped: [],
      reason: 'rewind',
      code: { kind: 'reset', to: 'start-2', backupBranch: `relay/${WORK_ID}-discarded-1` },
      keepCodeOffered: true,
    })
    expect(p.from.id).toBe('t-03')
    expect(ids(p.discard)).toEqual(['t-02', 't-03'])
  })

  it('k 완료에 k 이하를 고르면: 위와 같다. 중단할 세션은 없다', () => {
    const p = plan(stoppedAfter('verify'), 'fix')
    expect(p).toMatchObject({ kind: 'rewind', done: true, interrupt: null, reason: 'rewind' })
    expect(ids(p.discard)).toEqual(['t-02', 't-03'])
    expect(p.code).toEqual({
      kind: 'reset',
      to: 'start-2',
      backupBranch: `relay/${WORK_ID}-discarded-1`,
    })
    // 같은 단계를 고르면 k만 폐기하고 다시 실행한다
    const same = plan(stoppedAfter('verify'), 'verify')
    expect(ids(same.discard)).toEqual(['t-03'])
    expect(same.code).toMatchObject({ kind: 'reset', to: 'start-3' })
    expect(same.keepCodeOffered).toBe(false)
  })

  it('k 진행 중에 k보다 뒤를 고르면: k를 중단하고 k를 폐기한 뒤 고른 단계를 실행한다. 코드는 그대로다 (D117)', () => {
    const p = plan(at('intake'), 'verify')
    expect(p).toMatchObject({
      kind: 'skip',
      done: false,
      interrupt: 'session',
      skipped: ['fix'],
      reason: 'skip',
      code: { kind: 'none' },
      keepCodeOffered: false,
    })
    expect(ids(p.discard)).toEqual(['t-01'])
    // 진행 중인 fix를 두고 verify로 건너뛰어도 fix의 코드는 되돌리지 않는다. fix를 폐기하므로 기본 진행이 아니다
    const fromFix = plan(at('fix'), 'verify')
    expect(fromFix).toMatchObject({ skipped: [], reason: 'skip', code: { kind: 'none' } })
    expect(ids(fromFix.discard)).toEqual(['t-02'])
  })

  it('k 완료에 k보다 뒤를 고르면: k는 입력에 남고 고른 단계를 실행한다', () => {
    const p = plan(stoppedAfter('intake'), 'verify')
    expect(p).toMatchObject({
      kind: 'skip',
      done: true,
      interrupt: null,
      discard: [],
      skipped: ['fix'],
      reason: 'skip',
      code: { kind: 'none' },
    })
    // 기본 다음 단계를 고르면 건너뛴 것도 폐기한 것도 없어 기본 진행이다
    expect(plan(stoppedAfter('intake'), 'fix')).toMatchObject({
      kind: 'skip',
      discard: [],
      skipped: [],
      reason: 'default',
    })
    expect(plan(stoppedAfter('fix'), 'verify')).toMatchObject({
      kind: 'skip',
      discard: [],
      skipped: [],
      reason: 'default',
    })
  })
})

describe('되돌릴 커밋 (D117)', () => {
  it('폐기하는 task 가운데 가장 앞 task의 시작 커밋으로 되돌린다', () => {
    expect(plan(at('verify'), 'intake').code).toMatchObject({ kind: 'reset', to: 'start-1' })
    expect(ids(plan(at('verify'), 'intake').discard)).toEqual(['t-01', 't-02', 't-03'])
  })

  it('fix를 건너뛰고 온 verify에서 fix를 고르면 폐기하는 verify의 시작 커밋으로 되돌린다', () => {
    const w = work([
      task(1, 'intake', 'approved'),
      task(2, 'verify', 'working', { reason: 'skip' }),
    ])
    const p = plan(w, 'fix')
    expect(p).toMatchObject({ kind: 'rewind', reason: 'rewind', keepCodeOffered: true })
    expect(ids(p.discard)).toEqual(['t-02'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-2' })
  })

  it('새 세션으로 다시 한 task(D114)가 있으면 앞 task의 시작 커밋으로 되돌린다', () => {
    const w = work([
      task(1, 'intake', 'approved'),
      task(2, 'fix', 'session_ended', { session: { ...LIVE, alive: false } }),
      task(3, 'fix', 'working'),
    ])
    const p = plan(w, 'fix')
    expect(ids(p.discard)).toEqual(['t-02', 't-03'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-2' })
  })

  it('이미 폐기된 task는 다시 폐기하지 않는다', () => {
    const w = work([
      task(1, 'intake', 'approved'),
      task(2, 'fix', 'discarded'),
      task(3, 'verify', 'discarded'),
      task(4, 'fix', 'approved', { reason: 'rewind' }),
      task(5, 'verify', 'working'),
    ])
    const p = plan(w, 'fix')
    expect(ids(p.discard)).toEqual(['t-04', 't-05'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-4' })
  })

  it('폐기하는 task가 한 번도 시작하지 않았으면 되돌릴 커밋이 없다. 대기열의 task는 대기열에서 뺀다', () => {
    const queued = at('verify', 'queued')
    const last = queued.tasks[2] as TaskRecord
    const w = {
      ...queued,
      tasks: [...queued.tasks.slice(0, 2), { ...last, session: null, start_commit: undefined }],
    }
    expect(plan(w, 'verify')).toMatchObject({ interrupt: 'queue', code: { kind: 'none' } })
    expect(plan(w, 'fix').code).toMatchObject({ kind: 'reset', to: 'start-2' })
  })

  it('[현재 코드 위에서 이어서]는 fix로 되감을 때만 고를 수 있고, 코드를 그대로 둔다 (6.2)', () => {
    expect(plan(at('verify'), 'fix', { keepCode: true })).toMatchObject({
      kind: 'rewind',
      code: { kind: 'keep' },
      keepCodeOffered: true,
    })
    expect(ids(plan(at('verify'), 'fix', { keepCode: true }).discard)).toEqual(['t-02', 't-03'])
    expect(planStep(at('verify'), 'intake', { keepCode: true })).toMatchObject({ ok: false })
    expect(planStep(at('verify'), 'verify', { keepCode: true })).toMatchObject({ ok: false })
    // 건너뛰어 fix로 가면 되돌릴 것이 없다
    expect(planStep(stoppedAfter('intake'), 'fix', { keepCode: true })).toMatchObject({
      ok: false,
    })
    expect(plan(stoppedAfter('intake'), 'fix').keepCodeOffered).toBe(false)
  })
})

describe('백업 브랜치 (D115)', () => {
  it('이름은 relay/<work-id>-discarded-<n>이고 n은 이 Work의 백업 가운데 가장 큰 번호 + 1이다', () => {
    expect(backupBranch(WORK_ID, 2)).toBe(`relay/${WORK_ID}-discarded-2`)
    expect(backupPattern(WORK_ID)).toBe(`refs/heads/relay/${WORK_ID}-discarded-*`)
    expect(nextBackupBranch(WORK_ID, [])).toBe(`relay/${WORK_ID}-discarded-1`)
    expect(
      nextBackupBranch(WORK_ID, [
        `relay/${WORK_ID}-discarded-1`,
        `relay/${WORK_ID}-discarded-3`,
        'relay/w-20260927-002-discarded-9',
      ]),
    ).toBe(`relay/${WORK_ID}-discarded-4`)
    expect(
      plan(at('verify'), 'fix', { backups: [`relay/${WORK_ID}-discarded-1`] }).code,
    ).toMatchObject({
      backupBranch: `relay/${WORK_ID}-discarded-2`,
    })
  })

  it('커밋 안 된 변경의 백업 커밋 메시지 (D116)', () => {
    expect(backupMessage(WORK_ID)).toBe(`relay(${WORK_ID}): 되감기 전 커밋 안 된 변경`)
  })
})

describe('고를 수 있는 단계 (6.3)', () => {
  it('의도 승인 전에는 intake만 고를 수 있다', () => {
    const w = work([task(1, 'intake', 'blocked')], { approved: false })
    expect(planStep(w, 'fix')).toEqual({
      ok: false,
      error: '의도 승인 전에는 intake만 고를 수 있음 (6.3)',
    })
    expect(planStep(w, 'verify')).toMatchObject({ ok: false })
    const p = plan(w, 'intake')
    expect(p).toMatchObject({ kind: 'rewind', code: { kind: 'reset', to: 'start-1' } })
    expect(ids(p.discard)).toEqual(['t-01'])
    expect(stepChoices(w).map((c) => [c.node, c.allowed])).toEqual([
      ['intake', true],
      ['fix', false],
      ['verify', false],
    ])
    expect(stepChoices(w)[1]?.why).toBe('의도 승인 전에는 intake만 고를 수 있음 (6.3)')
  })

  it('의도 승인 뒤에는 모든 Work가 모든 단계를 고를 수 있다 (D227)', () => {
    expect(stepChoices(at('fix')).map((c) => [c.node, c.kind, c.allowed])).toEqual([
      ['intake', 'rewind', true],
      ['fix', 'rewind', true],
      ['verify', 'skip', true],
    ])
    expect(stepChoices(at('intake')).map((c) => [c.node, c.kind, c.allowed])).toEqual([
      ['intake', 'rewind', true],
      ['fix', 'skip', true],
      ['verify', 'skip', true],
    ])
    for (const node of ['intake', 'fix', 'verify'] as const) {
      expect(planStep(at('verify'), node), node).toMatchObject({ ok: true })
    }
  })

  it('intake로 되감으면 모든 task를 폐기한다 (6.3)', () => {
    const p = plan(stoppedAfter('verify'), 'intake')
    expect(ids(p.discard)).toEqual(['t-01', 't-02', 't-03'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-1' })
  })

  it('완료나 포기한 Work에서는 고르지 않는다', () => {
    for (const status of ['completed', 'abandoned'] as const) {
      const w = { ...at('verify', 'approved'), status }
      expect(canSelectStep(w)).toBe(false)
      expect(planStep(w, 'fix')).toMatchObject({ ok: false })
      expect(stepChoices(w).every((c) => !c.allowed)).toBe(true)
    }
    expect(canSelectStep(at('fix'))).toBe(true)
    expect(canSelectStep(stoppedAfter('fix'))).toBe(true)
  })

  it('대화상자는 파이프라인 차례로 되감기와 건너뛰기, 지금 단계, 추천한 단계를 보인다 (D82, D23)', () => {
    const w: WorkState = {
      ...stoppedAfter('verify'),
      stop: { kind: 'recommended_back', task_id: 't-03', node: 'fix', reason: '완료조건 2 실패' },
    }
    expect(stepChoices(w)).toEqual([
      {
        node: 'intake',
        title: '의도 정리(intake)',
        kind: 'rewind',
        allowed: true,
        why: null,
        current: false,
        recommended: false,
        keepCode: false,
        keepLabel: '현재 코드 위에서 이어서',
        keepDefault: false,
        typeChange: false,
      },
      {
        node: 'fix',
        title: '원인 분석과 수정(fix)',
        kind: 'rewind',
        allowed: true,
        why: null,
        current: false,
        recommended: true,
        keepCode: true,
        keepLabel: '현재 코드 위에서 이어서',
        keepDefault: false,
        typeChange: false,
      },
      {
        node: 'verify',
        title: '리뷰와 검증(verify)',
        kind: 'rewind',
        allowed: true,
        why: null,
        current: true,
        recommended: false,
        keepCode: false,
        keepLabel: '현재 코드 위에서 이어서',
        keepDefault: false,
        typeChange: false,
      },
    ])
  })
})

describe('리뷰와 검증 단계 (D229, D117)', () => {
  it('verify에서 fix로 되감으면 리뷰를 반영한 커밋도 되돌린다. [현재 코드 위에서 이어서]면 그대로 둔다 (D117)', () => {
    const w = at('verify')
    const p = plan(w, 'fix')
    expect(ids(p.discard)).toEqual(['t-02', 't-03'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-2' })
    expect(plan(w, 'fix', { keepCode: true }).code).toEqual({ kind: 'keep' })
    // 멈춘 verify에서 fix로 되감아도 같다
    const r = plan(stoppedAfter('verify'), 'fix')
    expect(ids(r.discard)).toEqual(['t-02', 't-03'])
    expect(r).toMatchObject({ code: { kind: 'reset', to: 'start-2' }, keepCodeOffered: true })
  })

  it('verify를 다시 하면 verify만 폐기하고 그 시작 커밋으로 되돌린다. [현재 코드 위에서 이어서]는 fix만이다 (6.2)', () => {
    const w = at('verify')
    const p = plan(w, 'verify')
    expect(p).toMatchObject({ kind: 'rewind', reason: 'rewind', keepCodeOffered: false })
    expect(ids(p.discard)).toEqual(['t-03'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-3' })
  })
})

describe('미리 보기 (D82)', () => {
  const facts = {
    commits: 2,
    uncommitted: [' M src/avg.js', '?? notes.txt'],
    artifacts: { 't-02': ['fix.md'], 't-03': ['pr.md', 'verification.md'] },
  }

  it('폐기될 산출물, 되돌릴 커밋 수와 커밋 안 된 변경, 백업 브랜치, 중단할 task', () => {
    const w = at('verify')
    expect(stepPreview(w, plan(w, 'fix'), facts)).toEqual({
      node: 'fix',
      title: '원인 분석과 수정(fix)',
      kind: 'rewind',
      reason: '되감기',
      expect: { taskId: 't-03', done: false },
      interrupt: '진행 중인 03 리뷰와 검증의 세션을 끝냅니다',
      discard: [
        { taskId: 't-02', label: '02 원인 분석과 수정', artifacts: ['fix.md'] },
        {
          taskId: 't-03',
          label: '03 리뷰와 검증',
          artifacts: ['pr.md', 'verification.md'],
        },
      ],
      skipped: [],
      code: {
        kind: 'reset',
        to: 'start-2',
        commits: 2,
        uncommitted: [' M src/avg.js', '?? notes.txt'],
        backupBranch: `relay/${WORK_ID}-discarded-1`,
      },
      keepCodeOffered: true,
      intent: null,
      typeChange: null,
    })
  })

  it('되돌릴 커밋도 커밋 안 된 변경도 없으면 백업 브랜치를 만들지 않는다 (D116)', () => {
    const w = stoppedAfter('verify')
    const preview = stepPreview(w, plan(w, 'fix'), {
      commits: 0,
      uncommitted: [],
      artifacts: {},
    })
    expect(preview.code).toEqual({
      kind: 'reset',
      to: 'start-2',
      commits: 0,
      uncommitted: [],
      backupBranch: null,
    })
    expect(preview.interrupt).toBeNull()
    expect(preview.expect).toEqual({ taskId: 't-03', done: true })
    // 커밋 안 된 변경만 있어도 백업한다
    const dirty = stepPreview(w, plan(w, 'fix'), {
      commits: 0,
      uncommitted: ['?? x'],
      artifacts: {},
    })
    expect(dirty.code.backupBranch).toBe(`relay/${WORK_ID}-discarded-1`)
  })

  it('건너뛰기: 건너뛸 단계와 폐기할 task. 코드는 그대로이고 커밋 안 된 변경은 보이기만 한다', () => {
    const w = at('intake')
    const preview = stepPreview(w, plan(w, 'verify'), {
      commits: 0,
      uncommitted: ['?? x'],
      artifacts: { 't-01': ['intent.draft.md'] },
    })
    expect(preview).toMatchObject({
      kind: 'skip',
      reason: '건너뛰기',
      interrupt: '진행 중인 01 의도 정리의 세션을 끝냅니다',
      discard: [{ taskId: 't-01', label: '01 의도 정리', artifacts: ['intent.draft.md'] }],
      skipped: ['원인 분석과 수정(fix)'],
      code: { kind: 'none', to: null, commits: 0, uncommitted: ['?? x'], backupBranch: null },
      keepCodeOffered: false,
    })
  })

  it('[현재 코드 위에서 이어서]와 대기열의 task', () => {
    const w = at('verify')
    expect(stepPreview(w, plan(w, 'fix', { keepCode: true }), facts).code).toEqual({
      kind: 'keep',
      to: null,
      commits: 0,
      uncommitted: [' M src/avg.js', '?? notes.txt'],
      backupBranch: null,
    })
    const queued = at('verify', 'queued')
    const q = {
      ...queued,
      tasks: queued.tasks.map((t) => (t.id === 't-03' ? { ...t, session: null } : t)),
    }
    expect(stepPreview(q, plan(q, 'fix'), facts).interrupt).toBe(
      '대기열의 03 리뷰와 검증을(를) 대기열에서 뺍니다',
    )
  })

  it('intake로 되감으면 intent 새 버전을 만든다는 것을 보인다 (D40)', () => {
    const w = stoppedAfter('verify')
    expect(stepPreview(w, plan(w, 'intake'), facts).intent).toBe(
      '의도 승인 때 intent 새 버전(v2)을 만듭니다. 지금 버전(v1)을 출발점으로 고칩니다 (D40)',
    )
    const before = work([task(1, 'intake', 'idle')], { approved: false })
    expect(stepPreview(before, plan(before, 'intake'), facts).intent).toBe(
      '의도 승인 전이라 intent를 처음부터 씁니다',
    )
  })
})

describe('기능 추가 (D232, D237, D254)', () => {
  /** 기능 추가 Work: t-01 intake, t-02 design, t-03 implement, t-04 verify */
  function featureAt(node: NodeName, status: TaskStatus = 'working'): WorkState {
    const nodes: NodeName[] = ['intake', 'design', 'implement', 'verify']
    const upto = nodes.slice(0, nodes.indexOf(node) + 1)
    return {
      ...work(upto.map((n, i) => task(i + 1, n, n === node ? status : 'approved'))),
      type: 'feature',
    }
  }

  it('대화상자는 기능 추가의 단계만 보이고, design과 implement로 되감을 때 [현재 코드 위에서 이어서]를 준다', () => {
    const choices = stepChoices(featureAt('verify'))
    expect(choices.map((c) => [c.node, c.kind, c.keepCode])).toEqual([
      ['intake', 'rewind', false],
      ['design', 'rewind', true],
      ['implement', 'rewind', true],
      ['verify', 'rewind', false],
    ])
    expect(stepChoices(at('verify')).map((c) => c.node)).toEqual(['intake', 'fix', 'verify'])
  })

  it('design으로 [현재 코드 위에서 이어서] 되감으면 design부터 폐기하고 코드는 그대로 둔다 (D254)', () => {
    const w = featureAt('verify')
    const p = plan(w, 'design', { keepCode: true })
    expect(p).toMatchObject({ kind: 'rewind', code: { kind: 'keep' }, keepCodeOffered: true })
    expect(ids(p.discard)).toEqual(['t-02', 't-03', 't-04'])
    expect(plan(w, 'implement', { keepCode: true }).code).toEqual({ kind: 'keep' })
    // 기본은 고른 단계를 시작할 때의 커밋으로 되돌린다
    expect(plan(w, 'design').code).toMatchObject({ kind: 'reset', to: 'start-2' })
  })

  it('기능 추가의 intake와 verify로는 [현재 코드 위에서 이어서]를 고를 수 없다. 다른 유형의 단계는 고를 수 없다', () => {
    const w = featureAt('verify')
    expect(planStep(w, 'verify', { keepCode: true })).toEqual({
      ok: false,
      error: '[현재 코드 위에서 이어서]는 design, implement로 되감을 때만 고를 수 있음',
    })
    expect(planStep(w, 'fix')).toEqual({ ok: false, error: '기능 추가 Work의 단계가 아님' })
    expect(planStep(at('verify'), 'design')).toEqual({
      ok: false,
      error: '버그 수정 Work의 단계가 아님',
    })
  })

  it('implement에서 승인하고 멈춘 뒤 verify를 고르면 기본 진행이다. design을 고르면 되감기다', () => {
    const w: WorkState = {
      ...featureAt('implement', 'approved'),
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-03' },
    }
    expect(plan(w, 'verify')).toMatchObject({ kind: 'skip', reason: 'default', skipped: [] })
    expect(plan(w, 'design')).toMatchObject({ kind: 'rewind', reason: 'rewind' })
  })

  it('의도 승인 전 [intake 다시]에서만 유형을 바꿀 수 있다 (D237)', () => {
    const before: WorkState = {
      ...work([task(1, 'intake', 'awaiting_approval')], { approved: false }),
      type: 'bugfix',
    }
    expect(stepChoices(before).map((c) => [c.node, c.typeChange])).toEqual([
      ['intake', true],
      ['fix', false],
      ['verify', false],
    ])
    expect(plan(before, 'intake', { type: 'feature' }).type).toBe('feature')
    // 같은 유형을 고르면 바꾸지 않는다
    expect(plan(before, 'intake', { type: 'bugfix' }).type).toBeNull()
    const preview = stepPreview(before, plan(before, 'intake', { type: 'feature' }), {
      commits: 0,
      uncommitted: [],
      artifacts: {},
    })
    expect(preview.typeChange).toBe(
      '유형을 버그 수정에서 기능 추가(으)로 바꿉니다. 의도 승인 뒤에는 바꿀 수 없습니다 (D237)',
    )
    // 의도 승인 뒤에는 intake로 되감아도 유형을 바꿀 수 없다
    const after = featureAt('design')
    expect(stepChoices(after).find((c) => c.node === 'intake')?.typeChange).toBe(false)
    expect(planStep(after, 'intake', { type: 'bugfix' })).toEqual({
      ok: false,
      error: '유형은 의도 승인 전 [intake 다시]에서만 바꿀 수 있음 (D237)',
    })
  })
})

describe('설계 (D350, D365, I105)', () => {
  /** 설계 Work: t-01 intake, t-02 spec, t-03 verify */
  function specAt(node: NodeName, status: TaskStatus = 'working'): WorkState {
    const nodes: NodeName[] = ['intake', 'spec', 'verify']
    const upto = nodes.slice(0, nodes.indexOf(node) + 1)
    return {
      ...work(upto.map((n, i) => task(i + 1, n, n === node ? status : 'approved'))),
      type: 'spec',
    }
  }

  it('대화상자는 설계의 단계를 보이고, spec으로 되감을 때 [현재 문서 위에서 이어서]가 처음부터 체크되어 있다', () => {
    expect(
      stepChoices(specAt('verify')).map((c) => [c.node, c.keepCode, c.keepLabel, c.keepDefault]),
    ).toEqual([
      ['intake', false, '현재 코드 위에서 이어서', false],
      ['spec', true, '현재 문서 위에서 이어서', true],
      ['verify', false, '현재 코드 위에서 이어서', false],
    ])
  })

  it('체크하면 문서 커밋을 그대로 두고, 끄면 다른 유형처럼 spec을 시작할 때의 커밋으로 되돌린다 (D365)', () => {
    const w = specAt('verify')
    const keep = plan(w, 'spec', { keepCode: true })
    expect(keep).toMatchObject({ kind: 'rewind', code: { kind: 'keep' }, keepCodeOffered: true })
    expect(ids(keep.discard)).toEqual(['t-02', 't-03'])
    const reset = plan(w, 'spec')
    expect(reset.code).toMatchObject({ kind: 'reset', to: 'start-2' })
    const facts = { commits: 2, uncommitted: [], artifacts: {} }
    expect(stepPreview(w, keep, facts).code).toMatchObject({ kind: 'keep', commits: 0 })
    expect(stepPreview(w, reset, facts).code).toMatchObject({ kind: 'reset', commits: 2 })
    expect(planStep(w, 'design')).toEqual({ ok: false, error: '설계 Work의 단계가 아님' })
  })
})
