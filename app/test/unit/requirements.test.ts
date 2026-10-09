import { describe, expect, it } from 'vitest'
import {
  afterRun,
  answerRevision,
  applyResult,
  chainProblem,
  closeRevision,
  codeAnchorProblems,
  emptyPointer,
  fold,
  judgeRun,
  normQuote,
  pickUnit,
  renderExtraction,
  renderHandoff,
  renderPacket,
  repoPath,
  revisionFile,
  startRevision,
  type RunFacts,
} from '../../src/core/requirements'
import { checkHandoff } from '../../src/core/validate'
import {
  DEFAULT_REQUIREMENTS_BUDGET,
  type ExtractSurvey,
  type ExtractTrace,
  type RequirementsRevision,
} from '../../src/shared/requirements'

const AT = '2026-10-09T10:00:00+09:00'
/** 있어야 하는 값 */
function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('값이 없다')
  return v
}
const REPO = '/w/repo'
const anchor = (path: string, start: number, quote: string) => ({
  kind: 'code' as const,
  path,
  start,
  end: start,
  quote,
  command: null,
})

function survey(over: Partial<ExtractSurvey> = {}): ExtractSurvey {
  return {
    outcome: 'done',
    outcome_reason: '빌드 파일과 시작 코드를 봤다',
    configs: [
      {
        key: 'c1',
        name: 'lo',
        status: 'confirmed',
        select: 'make lo',
        build_command: 'make lo',
        anchors: [anchor('/w/repo/Makefile', 3, 'lo: CFLAGS += -DLO')],
      },
    ],
    inventory: [
      {
        key: 'i1',
        kind: 'isr',
        name: 'TIM4_IRQHandler',
        configs: ['lo'],
        anchors: [anchor('src/tach.c', 30, 'void TIM4_IRQHandler(void)')],
        notes: '',
      },
    ],
    boundaries: [],
    units: [
      {
        key: 'k1',
        purpose: '회전 감시 시간',
        lens: 'timing',
        scope: 'src/tach.c  Spin timing',
        priority: 'medium',
        depends_on: ['k2'],
        reason: '',
      },
      {
        key: 'k2',
        purpose: '명령 경로',
        lens: 'command',
        scope: 'SET_SPEED',
        priority: 'high',
        depends_on: [],
        reason: '',
      },
    ],
    not_found: [],
    unknowns: [],
    human_decisions: [],
    checkpoint: null,
    ...over,
  } as ExtractSurvey
}

function trace(over: Partial<ExtractTrace> = {}): ExtractTrace {
  return {
    outcome: 'done',
    outcome_reason: '끝까지 따라갔다',
    observations: [
      {
        key: 'o1',
        text: 'lo에서 매 틱 센다',
        configs: ['lo'],
        anchors: [anchor('src/tach.c', 30, 'void TIM4_IRQHandler(void)')],
        inference: false,
      },
    ],
    quantities: [],
    requirements: [],
    constraints: [],
    impl_choices: [],
    unknowns: [],
    conflicts: [],
    absences: [],
    checklist: {},
    followups: [],
    human_decisions: [],
    checkpoint: null,
    ...over,
  } as ExtractTrace
}

/** 첫 revision과 survey 반영까지 */
function afterSurvey(result = survey()) {
  const start = startRevision(emptyPointer().next, AT)
  let state = fold([start.revision])
  const unit = must(state.units[0])
  const applied = applyResult({
    state,
    next: start.next,
    unit,
    run: 'r-0001',
    result,
    base: 'abc',
    repo: REPO,
    blobs: { Makefile: 'b1', 'src/tach.c': 'b2' },
    at: AT,
  })
  const revs = [start.revision, applied.revision]
  state = fold(revs)
  return { revs, state, applied }
}

describe('기록 접기 (결정 93)', () => {
  it('첫 revision은 survey 단위 하나이고 번호와 이름은 6자리 파일이다', () => {
    const { revision, next } = startRevision(emptyPointer().next, AT)
    expect(revision.number).toBe(1)
    expect(revision.parent).toBeNull()
    expect(revision.units).toMatchObject([{ id: 'u-0001', kind: 'survey', lens: null, from: null }])
    expect(next).toMatchObject({ unit: 2, revision: 2 })
    expect(revisionFile(12)).toBe('000012.json')
  })

  it('사슬이 끊기거나 parent가 틀리면 무결성 문제다 (결정 38)', () => {
    const { revs } = afterSurvey()
    expect(chainProblem(revs)).toBeNull()
    expect(chainProblem([must(revs[1])])).toMatch(/자리에 2/)
    const bad = { ...must(revs[1]), parent: 5 } as RequirementsRevision
    expect(chainProblem([must(revs[0]), bad])).toMatch(/parent/)
  })
})

describe('run 결과를 변경분으로 (결정 34, 35, 94, 95)', () => {
  it('key가 있는 항목은 주장이 되고 앵커는 근거 ID로 바뀌며, 같은 앵커는 근거 하나다', () => {
    const { state, applied } = afterSurvey()
    expect(applied.revision.cause).toEqual({ kind: 'run', run: 'r-0001', note: '' })
    expect(state.claims.map((c) => [c.id, c.section, c.key])).toEqual([
      ['c-0001', 'configs', 'c1'],
      ['c-0002', 'inventory', 'i1'],
    ])
    expect(must(state.claims[1]).body.anchors).toEqual([{ evidence: 'e-0002' }])
    expect(state.evidence[0]).toMatchObject({ path: 'Makefile', commit: 'abc', blob: 'b1' })
    // trace가 같은 앵커를 다시 쓰면 새 근거를 만들지 않는다
    const unit = must(state.units.find((u) => u.lens === 'timing'))
    const t = applyResult({
      state,
      next: applied.next,
      unit,
      run: 'r-0002',
      result: trace(),
      base: 'abc',
      repo: REPO,
      blobs: { 'src/tach.c': 'b2' },
      at: AT,
    })
    expect(t.revision.evidence).toEqual([])
    expect(must(t.revision.claims[0]).body.anchors).toEqual([{ evidence: 'e-0002' }])
  })

  it('survey의 units는 trace 단위가 되고 depends_on은 같은 결과의 key만 잇는다', () => {
    const { state } = afterSurvey()
    const traces = state.units.filter((u) => u.kind === 'trace')
    expect(traces.map((u) => [u.id, u.lens, u.depends_on, u.from])).toEqual([
      ['u-0002', 'timing', ['u-0003'], { run: 'r-0001', key: 'k1' }],
      ['u-0003', 'command', [], { run: 'r-0001', key: 'k2' }],
    ])
    expect(state.units[0]).toMatchObject({ status: 'done', run: 'r-0001' })
  })

  it('같은 렌즈와 같은 범위 글의 열린 단위가 있으면 새 단위를 만들지 않고 경고한다', () => {
    const { state, applied } = afterSurvey()
    const unit = must(state.units.find((u) => u.lens === 'command'))
    const t = applyResult({
      state,
      next: applied.next,
      unit,
      run: 'r-0002',
      result: trace({
        followups: [
          {
            key: 'f1',
            purpose: '다시',
            lens: 'timing',
            scope: 'SRC/TACH.C spin   timing',
            priority: 'low',
            depends_on: [],
            reason: '',
          },
        ],
      }),
      base: 'abc',
      repo: REPO,
      blobs: {},
      at: AT,
    })
    expect(t.revision.units).toEqual([])
    expect(t.warnings).toEqual([expect.stringMatching(/u-0002/)])
  })

  it('미완료는 checkpoint와 함께 열린 채로 남는다', () => {
    const cp = { checked: ['a'], remaining: ['b'], next: 'c' }
    const { state } = afterSurvey(survey({ outcome: 'incomplete', checkpoint: cp, units: [] }))
    expect(state.units[0]).toMatchObject({ status: 'open', checkpoint: cp })
  })

  it('사람 결정은 refs가 가리키는 이 결과의 단위를 기다리게 한다 (결정 7)', () => {
    const { state } = afterSurvey(
      survey({
        human_decisions: [
          {
            key: 'd1',
            trigger: 'shipping_config',
            question: '어느 구성이 출하되나?',
            options: ['lo', 'hi'],
            refs: ['k1', 'nope'],
          },
        ],
      }),
    )
    expect(state.decisions).toMatchObject([{ id: 'h-0001', blocks: ['u-0002'], answer: null }])
    const pick = pickUnit(state)
    expect(pick.waiting.map((u) => u.id)).toEqual(['u-0002'])
  })
})

describe('다음 단위 (결정 95)', () => {
  it('의존이 끝난 열린 단위 가운데 우선순위, 만든 차례다', () => {
    const { state } = afterSurvey()
    // u-0002(timing, medium)는 u-0003(command, high)에 의존한다
    expect(pickUnit(state).unit?.id).toBe('u-0003')
  })

  it('답을 받으면 기다리던 단위가 풀린다 (결정 41)', () => {
    const { revs, applied } = afterSurvey(
      survey({
        units: [must(survey().units[1])],
        human_decisions: [
          { key: 'd1', trigger: 'product_intent', question: 'Q', options: [], refs: ['k2'] },
        ],
      }),
    )
    expect(pickUnit(fold(revs)).unit).toBeNull()
    const ans = answerRevision(applied.next, [{ decision: 'h-0001', answer: 'A', at: AT }], AT)
    expect(ans.revision.cause.kind).toBe('human')
    expect(pickUnit(fold([...revs, ans.revision])).unit?.id).toBe('u-0002')
  })

  it('앱이 끝낸 단위(failed, stalled)는 끝난 상태다', () => {
    const { revs, applied } = afterSurvey()
    const c = closeRevision(applied.next, 'u-0003', 'failed', '연속 실패 2', null, AT)
    const state = fold([...revs, c.revision])
    expect(state.units.find((u) => u.id === 'u-0003')?.status).toBe('failed')
    expect(pickUnit(state).unit?.id).toBe('u-0002')
  })
})

describe('연속 횟수와 멈춤 (결정 6, 30, 40)', () => {
  const B = DEFAULT_REQUIREMENTS_BUDGET
  it('같은 항목 연속 실패 2면 그 항목을 failed로 끝낸다', () => {
    let o = afterRun(emptyPointer(), 'u-1', 'failed', B)
    expect(o.close).toBeNull()
    o = afterRun(o.pointer, 'u-1', 'failed', B)
    expect(o.close).toBe('failed')
    expect(o.pointer.streaks['u-1']).toBeUndefined()
    expect(o.pointer.runs_used).toBe(2)
  })

  it('항목과 관계없이 연속 실패 3이면 전체를 멈춘다', () => {
    let p = emptyPointer()
    for (const u of ['a', 'b']) p = afterRun(p, u, 'failed', B).pointer
    expect(afterRun(p, 'c', 'failed', B).halt).toBe('failures')
  })

  it('실패와 미완료는 서로를 끊지 않고 끝난 상태만 끊는다. 미완료 3이면 stalled', () => {
    let o = afterRun(emptyPointer(), 'u', 'incomplete', B)
    o = afterRun(o.pointer, 'u', 'failed', B)
    o = afterRun(o.pointer, 'u', 'incomplete', B)
    expect(o.pointer.streaks.u).toEqual({ failures: 1, incompletes: 2 })
    expect(afterRun(o.pointer, 'u', 'incomplete', B).close).toBe('stalled')
    expect(afterRun(o.pointer, 'u', 'closed', B).pointer.streaks.u).toBeUndefined()
  })

  it('사용량 한도나 사람의 중단은 세지 않는다', () => {
    const o = afterRun(emptyPointer(), 'u', 'uncounted', B)
    expect(o.pointer.runs_used).toBe(0)
  })
})

describe('run 판정 (15.3)', () => {
  const ok: RunFacts = {
    stoppedByApp: false,
    timedOut: false,
    exitCode: 0,
    result: { is_error: false, structured_output: { outcome: 'done' } },
    schemaValid: true,
    lastStop: { background_tasks: [], session_crons: [] },
    usageLimit: null,
    worktreeChanged: false,
    inputRevision: 3,
    currentRevision: 3,
    applyProblems: [],
  }
  it('모두 맞으면 성공', () => {
    expect(judgeRun(ok)).toEqual({ ok: true })
  })
  it('마지막 Stop에 background_tasks나 session_crons가 없으면 실패다 (17.12, D129의 run용 판정)', () => {
    expect(judgeRun({ ...ok, lastStop: { background_tasks: [] } })).toMatchObject({
      failure: 'stop_fields_missing',
      end: 'failed',
    })
    expect(judgeRun({ ...ok, lastStop: null })).toMatchObject({ failure: 'stop_fields_missing' })
    expect(
      judgeRun({ ...ok, lastStop: { background_tasks: ['x'], session_crons: [] } }),
    ).toMatchObject({ failure: 'background_tasks' })
  })
  it('worktree가 기준과 다르면 세지 않고 전체를 멈춘다 (결정 39)', () => {
    expect(judgeRun({ ...ok, worktreeChanged: true })).toMatchObject({
      end: 'uncounted',
      halt: 'source_changed',
    })
  })
  it('사용량 한도: 5시간 창은 재설정까지 기다리고 주간이나 시각 없음은 멈춘다 (결정 29)', () => {
    expect(
      judgeRun({ ...ok, usageLimit: { type: 'five_hour', resetsAt: 1700000000 } }),
    ).toMatchObject({ end: 'uncounted', waitUntil: 1700000000 })
    expect(judgeRun({ ...ok, usageLimit: { type: 'seven_day', resetsAt: 1 } })).toMatchObject({
      halt: 'usage_weekly',
    })
    expect(judgeRun({ ...ok, usageLimit: { type: null, resetsAt: null } })).toMatchObject({
      halt: 'usage_weekly',
    })
  })
  it('종료 코드, 오류, 구조화 출력, 스키마, 입력 revision, 반영 검사', () => {
    expect(judgeRun({ ...ok, timedOut: true })).toMatchObject({ failure: 'hard_timeout' })
    expect(judgeRun({ ...ok, exitCode: 1 })).toMatchObject({ failure: 'exit_1' })
    expect(judgeRun({ ...ok, result: null })).toMatchObject({ failure: 'no_result' })
    expect(
      judgeRun({ ...ok, result: { is_error: true, subtype: 'error_max_turns' } }),
    ).toMatchObject({ failure: 'error_error_max_turns' })
    expect(judgeRun({ ...ok, result: { is_error: false } })).toMatchObject({
      failure: 'no_structured_output',
    })
    expect(judgeRun({ ...ok, schemaValid: false })).toMatchObject({ failure: 'schema' })
    expect(judgeRun({ ...ok, currentRevision: 4 })).toMatchObject({ failure: 'stale_revision' })
    expect(judgeRun({ ...ok, applyProblems: ['x'] })).toMatchObject({ failure: 'apply_check' })
    expect(judgeRun({ ...ok, stoppedByApp: true })).toMatchObject({ end: 'uncounted' })
  })
})

describe('기준 커밋의 인용 대조 (path_at_base, quote_match, 결정 13, 37)', () => {
  const file = ['int x;', '', 'void TIM4_IRQHandler(void)', '{', '    cnt++;', '}'].join('\n')
  const read = (p: string) => (p === 'src/tach.c' ? file : null)
  it('경로와 인용이 맞으면 문제가 없다. Read 출력의 줄 번호 머리와 공백은 무시한다', () => {
    expect(normQuote('  3\tvoid TIM4_IRQHandler(void)\n  4\t{')).toBe(
      'void TIM4_IRQHandler(void) {',
    )
    expect(
      codeAnchorProblems(
        { a: [anchor('/w/repo/src/tach.c', 3, '3→void TIM4_IRQHandler(void)')] },
        REPO,
        read,
      ),
    ).toEqual([])
  })
  it('줄이 틀리면 그 줄의 실제 내용과 인용이 있는 줄을 알린다', () => {
    const p = codeAnchorProblems(
      { a: [anchor('src/tach.c', 5, 'void TIM4_IRQHandler(void)')] },
      REPO,
      read,
    )
    expect(p).toEqual([
      {
        rule: 'quote_match',
        problem: expect.stringMatching(/reads "cnt\+\+;.*the quote is at line 3/),
      },
    ])
  })
  it('기준 커밋에 없는 파일, 파일에 없는 인용', () => {
    expect(codeAnchorProblems({ a: [anchor('src/no.c', 1, 'x')] }, REPO, read)).toMatchObject([
      { rule: 'path_at_base' },
    ])
    expect(
      must(codeAnchorProblems({ a: [anchor('src/tach.c', 1, 'not here')] }, REPO, read)[0]).problem,
    ).toMatch(/not in this file/)
  })
  it('code가 아닌 앵커는 보지 않는다 (결정 42)', () => {
    expect(
      codeAnchorProblems(
        { a: [{ ...anchor('README.md', 1, 'x'), kind: 'doc_claim' }] },
        REPO,
        read,
      ),
    ).toEqual([])
    expect(repoPath('C:\\w\\repo\\src\\a.c', 'C:/w/repo')).toBe('src/a.c')
  })
})

describe('패킷과 문서 (결정 96, 99)', () => {
  it('패킷은 평가의 패킷과 같은 절이고, trace에는 survey의 구성과 checkpoint, 답한 결정이 든다', () => {
    const { state } = afterSurvey()
    const unit = must(state.units.find((u) => u.lens === 'command'))
    const text = renderPacket({
      unit: { ...unit, checkpoint: { checked: ['a'], remaining: ['b'], next: 'c' } },
      state: {
        ...state,
        decisions: [
          {
            id: 'h-0001',
            unit: 'u-0001',
            run: 'r-0001',
            key: 'd1',
            trigger: 'shipping_config',
            question: 'Q?',
            options: [],
            blocks: [],
            answer: { decision: 'h-0001', answer: 'lo만', at: AT },
          },
        ],
      },
      intent: '## 목표\n\n펌웨어의 요구사항',
      repo: REPO,
      base: 'abc',
      scratch: '/w/scratch/r-0002',
      budget: DEFAULT_REQUIREMENTS_BUDGET,
    })
    expect(text).toContain('# Packet: trace (lens: command)')
    expect(text).toContain('- lo (confirmed): `make lo`; selected by make lo')
    expect(text).toContain('Continue from its checkpoint')
    expect(text).toContain('  A: lo만')
    expect(text).toContain('Soft deadline: 15 minutes. Hard limit: 30 minutes.')
  })

  it('handoff.md는 기존 형식 검사를 통과하고 extraction.md는 단위와 근거 위치를 보인다', () => {
    const { state } = afterSurvey()
    const h = checkHandoff(renderHandoff(state), { node: 'spec', type: 'spec', warnChars: 99999 })
    expect(h.errors).toEqual([])
    const x = renderExtraction(state, 'abc')
    expect(x).toContain('| u-0001 | survey |')
    expect(x).toContain('- lo (confirmed): make lo, `make lo`')
  })
})
