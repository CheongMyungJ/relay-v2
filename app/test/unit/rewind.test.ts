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
import type { NodeName, Size } from '../../src/shared/contracts'
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
  opts: { size?: Size | null; status?: WorkState['status']; stop?: WorkStop } = {},
): WorkState {
  const size = opts.size === undefined ? 'L' : opts.size
  return {
    schema_version: 1,
    work_id: WORK_ID,
    status: opts.status ?? 'active',
    created_at: AT,
    base_branch: 'main',
    base_commit: 'base',
    intent: size ? { version: 1, size } : null,
    settings: {},
    ...(opts.stop ? { stop: opts.stop } : {}),
    tasks,
  }
}

/** L 경로에서 앞 단계를 모두 승인하고 node가 지금 task인 Work */
function lAt(node: NodeName, status: TaskStatus = 'working'): WorkState {
  const nodes: NodeName[] = ['intake', 'evidence', 'rca', 'fix', 'verify']
  const upto = nodes.slice(0, nodes.indexOf(node) + 1)
  return work(upto.map((n, i) => task(i + 1, n, n === node ? status : 'approved')))
}

/** node를 승인하고 멈춘 Work (6.2의 "k 완료") */
function stoppedAfter(node: NodeName): WorkState {
  const w = lAt(node, 'approved')
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
    const p = plan(lAt('verify'), 'fix')
    expect(p).toMatchObject({
      node: 'fix',
      kind: 'rewind',
      done: false,
      interrupt: 'session',
      skipped: [],
      reason: 'rewind',
      code: { kind: 'reset', to: 'start-4', backupBranch: `relay/${WORK_ID}-discarded-1` },
      keepCodeOffered: true,
    })
    expect(p.from.id).toBe('t-05')
    expect(ids(p.discard)).toEqual(['t-04', 't-05'])
  })

  it('k 완료에 k 이하를 고르면: 위와 같다. 중단할 세션은 없다', () => {
    const p = plan(stoppedAfter('verify'), 'fix')
    expect(p).toMatchObject({ kind: 'rewind', done: true, interrupt: null, reason: 'rewind' })
    expect(ids(p.discard)).toEqual(['t-04', 't-05'])
    expect(p.code).toEqual({
      kind: 'reset',
      to: 'start-4',
      backupBranch: `relay/${WORK_ID}-discarded-1`,
    })
    // 같은 단계를 고르면 k만 폐기하고 다시 실행한다
    const same = plan(stoppedAfter('verify'), 'verify')
    expect(ids(same.discard)).toEqual(['t-05'])
    expect(same.code).toMatchObject({ kind: 'reset', to: 'start-5' })
    expect(same.keepCodeOffered).toBe(false)
  })

  it('k 진행 중에 k보다 뒤를 고르면: k를 중단하고 k를 폐기한 뒤 고른 단계를 실행한다. 코드는 그대로다 (D117)', () => {
    const p = plan(lAt('rca'), 'verify')
    expect(p).toMatchObject({
      kind: 'skip',
      done: false,
      interrupt: 'session',
      skipped: ['fix'],
      reason: 'skip',
      code: { kind: 'none' },
      keepCodeOffered: false,
    })
    expect(ids(p.discard)).toEqual(['t-03'])
    // 진행 중인 fix를 두고 verify로 건너뛰어도 fix의 코드는 되돌리지 않는다
    const fromFix = plan(lAt('fix'), 'verify')
    expect(fromFix).toMatchObject({ skipped: [], reason: 'skip', code: { kind: 'none' } })
    expect(ids(fromFix.discard)).toEqual(['t-04'])
  })

  it('k 완료에 k보다 뒤를 고르면: k는 입력에 남고 고른 단계를 실행한다', () => {
    const p = plan(stoppedAfter('evidence'), 'fix')
    expect(p).toMatchObject({
      kind: 'skip',
      done: true,
      interrupt: null,
      discard: [],
      skipped: ['rca'],
      reason: 'skip',
      code: { kind: 'none' },
    })
    // 기본 다음 단계를 고르면 건너뛴 것도 폐기한 것도 없어 기본 진행이다
    expect(plan(stoppedAfter('evidence'), 'rca')).toMatchObject({
      kind: 'skip',
      discard: [],
      skipped: [],
      reason: 'default',
    })
  })
})

describe('되돌릴 커밋 (D117)', () => {
  it('폐기하는 task 가운데 가장 앞 task의 시작 커밋으로 되돌린다', () => {
    expect(plan(lAt('verify'), 'rca').code).toMatchObject({ kind: 'reset', to: 'start-3' })
    expect(ids(plan(lAt('verify'), 'rca').discard)).toEqual(['t-03', 't-04', 't-05'])
  })

  it('S 경로에서 건너뛴 investigate를 고르면 폐기하는 fix의 시작 커밋으로 되돌린다 (D66, D149)', () => {
    const w = work(
      [task(1, 'intake', 'approved'), task(2, 'fix', 'approved'), task(3, 'verify', 'working')],
      {
        size: 'S',
      },
    )
    const p = plan(w, 'investigate')
    expect(p).toMatchObject({ kind: 'rewind', reason: 'rewind' })
    expect(ids(p.discard)).toEqual(['t-02', 't-03'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-2' })
  })

  it('새 세션으로 다시 한 task(D114)가 있으면 앞 task의 시작 커밋으로 되돌린다', () => {
    const w = work([
      task(1, 'intake', 'approved'),
      task(2, 'evidence', 'approved'),
      task(3, 'rca', 'approved'),
      task(4, 'fix', 'session_ended', { session: { ...LIVE, alive: false } }),
      task(5, 'fix', 'working'),
    ])
    const p = plan(w, 'fix')
    expect(ids(p.discard)).toEqual(['t-04', 't-05'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-4' })
  })

  it('이미 폐기된 task는 다시 폐기하지 않는다', () => {
    const w = work(
      [
        task(1, 'intake', 'approved'),
        task(2, 'fix', 'discarded'),
        task(3, 'verify', 'discarded'),
        task(4, 'fix', 'approved', { reason: 'rewind' }),
        task(5, 'verify', 'working'),
      ],
      { size: 'S' },
    )
    const p = plan(w, 'fix')
    expect(ids(p.discard)).toEqual(['t-04', 't-05'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-4' })
  })

  it('폐기하는 task가 한 번도 시작하지 않았으면 되돌릴 커밋이 없다. 대기열의 task는 대기열에서 뺀다', () => {
    const queued = lAt('verify', 'queued')
    const last = queued.tasks[4] as TaskRecord
    const w = {
      ...queued,
      tasks: [...queued.tasks.slice(0, 4), { ...last, session: null, start_commit: undefined }],
    }
    expect(plan(w, 'verify')).toMatchObject({ interrupt: 'queue', code: { kind: 'none' } })
    expect(plan(w, 'fix').code).toMatchObject({ kind: 'reset', to: 'start-4' })
  })

  it('[현재 코드 위에서 이어서]는 fix로 되감을 때만 고를 수 있고, 코드를 그대로 둔다 (6.2)', () => {
    expect(plan(lAt('verify'), 'fix', { keepCode: true })).toMatchObject({
      kind: 'rewind',
      code: { kind: 'keep' },
      keepCodeOffered: true,
    })
    expect(ids(plan(lAt('verify'), 'fix', { keepCode: true }).discard)).toEqual(['t-04', 't-05'])
    expect(planStep(lAt('verify'), 'rca', { keepCode: true })).toMatchObject({ ok: false })
    // 건너뛰어 fix로 가면 되돌릴 것이 없다
    expect(planStep(stoppedAfter('rca'), 'fix', { keepCode: true })).toMatchObject({ ok: false })
    expect(plan(stoppedAfter('rca'), 'fix').keepCodeOffered).toBe(false)
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
      plan(lAt('verify'), 'fix', { backups: [`relay/${WORK_ID}-discarded-1`] }).code,
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
    const w = work([task(1, 'intake', 'blocked')], { size: null })
    expect(planStep(w, 'evidence')).toEqual({
      ok: false,
      error: '의도 승인 전에는 intake만 고를 수 있음 (6.3)',
    })
    const p = plan(w, 'intake')
    expect(p).toMatchObject({ kind: 'rewind', code: { kind: 'reset', to: 'start-1' } })
    expect(ids(p.discard)).toEqual(['t-01'])
    expect(stepChoices(w).map((c) => [c.node, c.allowed])).toEqual([
      ['intake', true],
      ['investigate', false],
      ['evidence', false],
      ['rca', false],
      ['fix', false],
      ['verify', false],
    ])
    expect(stepChoices(w)[1]?.why).toBe('의도 승인 전에는 intake만 고를 수 있음 (6.3)')
  })

  it('intake로 되감으면 모든 task를 폐기한다 (6.3)', () => {
    const p = plan(stoppedAfter('verify'), 'intake')
    expect(ids(p.discard)).toEqual(['t-01', 't-02', 't-03', 't-04', 't-05'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-1' })
  })

  it('완료나 포기한 Work에서는 고르지 않는다', () => {
    for (const status of ['completed', 'abandoned'] as const) {
      const w = { ...lAt('verify', 'approved'), status }
      expect(canSelectStep(w)).toBe(false)
      expect(planStep(w, 'fix')).toMatchObject({ ok: false })
      expect(stepChoices(w).every((c) => !c.allowed)).toBe(true)
    }
    expect(canSelectStep(lAt('rca'))).toBe(true)
    expect(canSelectStep(stoppedAfter('rca'))).toBe(true)
  })

  it('대화상자는 파이프라인 차례로 되감기와 건너뛰기, 지금 단계, 추천한 단계를 보인다 (D82, D23)', () => {
    const w: WorkState = {
      ...stoppedAfter('verify'),
      stop: { kind: 'recommended_back', task_id: 't-05', node: 'fix', reason: '완료조건 2 실패' },
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
      },
      {
        node: 'evidence',
        title: '재현과 관찰(evidence)',
        kind: 'rewind',
        allowed: true,
        why: null,
        current: false,
        recommended: false,
      },
      {
        node: 'rca',
        title: '원인 분석(rca)',
        kind: 'rewind',
        allowed: true,
        why: null,
        current: false,
        recommended: false,
      },
      {
        node: 'fix',
        title: '수정(fix)',
        kind: 'rewind',
        allowed: true,
        why: null,
        current: false,
        recommended: true,
      },
      {
        node: 'verify',
        title: '최종 검증(verify)',
        kind: 'rewind',
        allowed: true,
        why: null,
        current: true,
        recommended: false,
      },
    ])
    expect(stepChoices(lAt('evidence')).map((c) => c.kind)).toEqual([
      'rewind',
      'rewind',
      'skip',
      'skip',
      'skip',
    ])
  })
})

describe('크기별 단계 (D149)', () => {
  /** M 경로에서 앞 단계를 모두 승인하고 node가 지금 task인 Work */
  function mAt(node: NodeName, status: TaskStatus = 'working'): WorkState {
    const nodes: NodeName[] = ['intake', 'investigate', 'fix', 'verify']
    const upto = nodes.slice(0, nodes.indexOf(node) + 1)
    return work(
      upto.map((n, i) => task(i + 1, n, n === node ? status : 'approved')),
      { size: 'M' },
    )
  }

  it('M Work의 대화상자에는 M의 단계만 있고, evidence와 rca는 고를 수 없다', () => {
    const w = mAt('verify')
    expect(stepChoices(w).map((c) => [c.node, c.kind, c.allowed])).toEqual([
      ['intake', 'rewind', true],
      ['investigate', 'rewind', true],
      ['fix', 'rewind', true],
      ['verify', 'rewind', true],
    ])
    for (const node of ['evidence', 'rca'] as const) {
      expect(planStep(w, node)).toEqual({
        ok: false,
        error: 'size M의 단계가 아님. 크기를 바꾸려면 intake로 되감음 (D149)',
      })
    }
  })

  it('M Work에서 investigate로 되감으면 investigate부터 폐기하고 그 시작 커밋으로 되돌린다', () => {
    const p = plan(mAt('verify'), 'investigate')
    expect(p).toMatchObject({ kind: 'rewind', reason: 'rewind', keepCodeOffered: false })
    expect(ids(p.discard)).toEqual(['t-02', 't-03', 't-04'])
    expect(p.code).toMatchObject({ kind: 'reset', to: 'start-2' })
  })

  it('L Work는 investigate를 고를 수 없다', () => {
    expect(stepChoices(lAt('fix')).map((c) => c.node)).toEqual([
      'intake',
      'evidence',
      'rca',
      'fix',
      'verify',
    ])
    expect(planStep(lAt('fix'), 'investigate')).toMatchObject({ ok: false })
  })

  it('S Work는 경로 밖의 investigate를 고를 수 있다 (D66)', () => {
    const w = work([task(1, 'intake', 'approved'), task(2, 'fix', 'working')], { size: 'S' })
    expect(stepChoices(w).map((c) => [c.node, c.kind])).toEqual([
      ['intake', 'rewind'],
      ['investigate', 'rewind'],
      ['fix', 'rewind'],
      ['verify', 'skip'],
    ])
  })

  it('끝난 intake 뒤 기본 다음 단계가 아닌 단계를 고르면 건너뛴 단계가 없어도 건너뛰기다 (점검 A42)', () => {
    const intakeDone = (size: Size): WorkState => ({
      ...work([task(1, 'intake', 'approved')], { size }),
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-01' },
    })
    // S의 기본 다음 단계는 fix다. 경로 밖의 investigate는 건너뛰기다
    expect(plan(intakeDone('S'), 'investigate')).toMatchObject({
      kind: 'skip',
      skipped: [],
      discard: [],
      reason: 'skip',
    })
    expect(plan(intakeDone('S'), 'fix')).toMatchObject({ kind: 'skip', reason: 'default' })
    expect(plan(intakeDone('M'), 'investigate')).toMatchObject({ kind: 'skip', reason: 'default' })
    expect(plan(intakeDone('M'), 'fix')).toMatchObject({
      kind: 'skip',
      skipped: ['investigate'],
      reason: 'skip',
    })
  })
})

describe('미리 보기 (D82)', () => {
  const facts = {
    commits: 2,
    uncommitted: [' M src/avg.js', '?? notes.txt'],
    artifacts: { 't-04': ['fix.md'], 't-05': ['pr.md', 'verification.md'] },
  }

  it('폐기될 산출물, 되돌릴 커밋 수와 커밋 안 된 변경, 백업 브랜치, 중단할 task', () => {
    const w = lAt('verify')
    expect(stepPreview(w, plan(w, 'fix'), facts)).toEqual({
      node: 'fix',
      title: '수정(fix)',
      kind: 'rewind',
      reason: '되감기',
      expect: { taskId: 't-05', done: false },
      interrupt: '진행 중인 05 최종 검증의 세션을 끝냅니다',
      discard: [
        { taskId: 't-04', label: '04 수정', artifacts: ['fix.md'] },
        { taskId: 't-05', label: '05 최종 검증', artifacts: ['pr.md', 'verification.md'] },
      ],
      skipped: [],
      code: {
        kind: 'reset',
        to: 'start-4',
        commits: 2,
        uncommitted: [' M src/avg.js', '?? notes.txt'],
        backupBranch: `relay/${WORK_ID}-discarded-1`,
      },
      keepCodeOffered: true,
      intent: null,
    })
  })

  it('되돌릴 커밋도 커밋 안 된 변경도 없으면 백업 브랜치를 만들지 않는다 (D116)', () => {
    const w = stoppedAfter('rca')
    const preview = stepPreview(w, plan(w, 'evidence'), {
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
    const dirty = stepPreview(w, plan(w, 'evidence'), {
      commits: 0,
      uncommitted: ['?? x'],
      artifacts: {},
    })
    expect(dirty.code.backupBranch).toBe(`relay/${WORK_ID}-discarded-1`)
  })

  it('건너뛰기: 건너뛸 단계와 폐기할 task. 코드는 그대로이고 커밋 안 된 변경은 보이기만 한다', () => {
    const w = lAt('rca')
    const preview = stepPreview(w, plan(w, 'verify'), {
      commits: 0,
      uncommitted: ['?? x'],
      artifacts: { 't-03': ['rca.md'] },
    })
    expect(preview).toMatchObject({
      kind: 'skip',
      reason: '건너뛰기',
      interrupt: '진행 중인 03 원인 분석의 세션을 끝냅니다',
      discard: [{ taskId: 't-03', label: '03 원인 분석', artifacts: ['rca.md'] }],
      skipped: ['수정(fix)'],
      code: { kind: 'none', to: null, commits: 0, uncommitted: ['?? x'], backupBranch: null },
      keepCodeOffered: false,
    })
  })

  it('[현재 코드 위에서 이어서]와 대기열의 task', () => {
    const w = lAt('verify')
    expect(stepPreview(w, plan(w, 'fix', { keepCode: true }), facts).code).toEqual({
      kind: 'keep',
      to: null,
      commits: 0,
      uncommitted: [' M src/avg.js', '?? notes.txt'],
      backupBranch: null,
    })
    const queued = lAt('verify', 'queued')
    const q = {
      ...queued,
      tasks: queued.tasks.map((t) => (t.id === 't-05' ? { ...t, session: null } : t)),
    }
    expect(stepPreview(q, plan(q, 'fix'), facts).interrupt).toBe(
      '대기열의 05 최종 검증을(를) 대기열에서 뺍니다',
    )
  })

  it('intake로 되감으면 intent 새 버전을 만든다는 것을 보인다 (D40)', () => {
    const w = stoppedAfter('verify')
    expect(stepPreview(w, plan(w, 'intake'), facts).intent).toBe(
      '의도 승인 때 intent 새 버전(v2)을 만듭니다. 지금 버전(v1)을 출발점으로 고칩니다 (D40)',
    )
    const before = work([task(1, 'intake', 'idle')], { size: null })
    expect(stepPreview(before, plan(before, 'intake'), facts).intent).toBe(
      '의도 승인 전이라 intent를 처음부터 씁니다',
    )
  })
})
