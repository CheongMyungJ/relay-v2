import { describe, expect, it } from 'vitest'
import {
  afterRun,
  answerRevision,
  applyResult,
  chainProblem,
  closeRevision,
  currentClaims,
  codeAnchorProblems,
  emptyPointer,
  fold,
  judgeRun,
  normQuote,
  outputAnchorProblems,
  pickUnit,
  renderExtraction,
  renderHandoff,
  renderPacket,
  reopenTargets,
  repoPath,
  requirementsView,
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

  it('렌즈·범위가 같은 끝난 단위가 있어도 새로 만들지 않고 그 단위를 가리킨다 (결정 37, 103)', () => {
    const { revs, applied } = afterSurvey()
    const c = closeRevision(applied.next, 'u-0002', 'stalled', '수렴 안 됨', null, AT)
    const state = fold([...revs, c.revision])
    const t = applyResult({
      state,
      next: c.next,
      unit: must(state.units[0]),
      run: 'r-0003',
      result: survey({
        human_decisions: [
          { key: 'd1', trigger: 'product_intent', question: 'Q', options: [], refs: ['k1'] },
        ],
      }),
      base: 'abc',
      repo: REPO,
      blobs: {},
      at: AT,
    })
    expect(t.revision.units).toEqual([])
    expect(t.warnings).toEqual([
      expect.stringMatching(/k1.*끝난 단위 u-0002\(stalled\).*새로 만들지 않았다/),
      expect.stringMatching(/k2.*끝난 단위 u-0003\(open\)|k2.*열린 단위 u-0003/),
    ])
    // 결정은 그 단위를 가리킨다
    expect(t.revision.decisions[0]?.blocks).toEqual(['u-0002'])
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
    const ans = answerRevision(
      fold(revs),
      applied.next,
      [{ decision: 'h-0001', answer: 'A', at: AT }],
      AT,
    )
    expect(ans.revision.cause.kind).toBe('human')
    // 기다리던 단위는 열려 있어 다시 열지 않는다
    expect(ans.revision.unit_updates).toEqual([])
    expect(pickUnit(fold([...revs, ans.revision])).unit?.id).toBe('u-0002')
  })

  it('모든 단위가 끝난 뒤 나온 결정의 답은 결정을 낸 단위를 같은 revision에서 다시 연다 (결정 103)', () => {
    const { revs, applied } = afterSurvey(survey({ units: [] }))
    // trace 단위 하나를 만들고 끝낸다: 그 run이 단위를 가리키지 않는 결정을 낸다
    const s1 = fold(revs)
    const u = applyResult({
      state: s1,
      next: applied.next,
      unit: must(s1.units[0]),
      run: 'r-0001',
      result: survey({ units: [must(survey().units[1])] }),
      base: 'abc',
      repo: REPO,
      blobs: {},
      at: AT,
    })
    const s2 = fold([...revs, u.revision])
    const unit = must(s2.units.find((x) => x.kind === 'trace'))
    const t = applyResult({
      state: s2,
      next: u.next,
      unit,
      run: 'r-0002',
      result: trace({
        human_decisions: [
          {
            key: 'd1',
            trigger: 'product_intent',
            question: '빈 입력은 오류인가?',
            options: ['오류', '0'],
            refs: ['o1'],
          },
        ],
      }),
      base: 'abc',
      repo: REPO,
      blobs: {},
      at: AT,
    })
    const done = fold([...revs, u.revision, t.revision])
    expect(done.units.map((x) => x.status)).toEqual(['done', 'done'])
    expect(done.decisions).toMatchObject([{ id: 'h-0001', unit: unit.id, blocks: [] }])
    expect(pickUnit(done).unit).toBeNull()

    const answers = [{ decision: 'h-0001', answer: '오류', at: AT }]
    expect(reopenTargets(done, answers)).toEqual([{ unit: unit.id, decision: 'h-0001' }])
    const ans = answerRevision(done, t.next, answers, AT)
    expect(ans.revision.cause.note).toBe(`사람 결정 필요의 답. 다시 연 단위 ${unit.id}`)
    const after = fold([...revs, u.revision, t.revision, ans.revision])
    const reopened = must(pickUnit(after).unit ?? undefined)
    expect(reopened).toMatchObject({ id: unit.id, reopened_by: 'h-0001' })
    // 다시 연 단위의 패킷은 결정과 답을 알린다
    const packet = renderPacket({
      unit: reopened,
      state: after,
      intent: 'x',
      repo: REPO,
      base: 'abc',
      scratch: '/s',
      budget: DEFAULT_REQUIREMENTS_BUDGET,
    })
    expect(packet).toContain('Analyse it again with the answer')
    expect(packet).toContain('  - Q: 빈 입력은 오류인가?\n  - A: 오류')
    // 이미 답한 결정은 다시 열지 않는다
    expect(reopenTargets(after, answers)).toEqual([])
    // 다시 돌아 끝나면 extraction.md는 다시 열어 돌렸다고 적는다
    const again = applyResult({
      state: after,
      next: ans.next,
      unit: reopened,
      run: 'r-0003',
      result: trace(),
      base: 'abc',
      repo: REPO,
      blobs: {},
      at: AT,
    })
    const final = fold([...revs, u.revision, t.revision, ans.revision, again.revision])
    expect(renderExtraction(final, 'abc')).toContain(
      `h-0001 (product_intent): 빈 입력은 오류인가? — 답: 오류. 끝난 단위 ${unit.id}를 답을 받아 다시 열어 돌렸다`,
    )
  })

  it('survey만 내는 절은 마지막 survey run의 것이 지금의 것이다 (결정 103)', () => {
    const { state } = afterSurvey()
    const again = applyResult({
      state,
      next: { ...emptyPointer().next, unit: 9, claim: 9, evidence: 9, revision: 3 },
      unit: must(state.units[0]),
      run: 'r-0009',
      result: survey({ units: [] }),
      base: 'abc',
      repo: REPO,
      blobs: {},
      at: AT,
    })
    const s = fold([...afterSurvey().revs, { ...again.revision, number: 3, parent: 2 }])
    expect(s.claims.filter((c) => c.section === 'configs')).toHaveLength(2)
    expect(currentClaims(s, 'configs').map((c) => c.run)).toEqual(['r-0009'])
    expect(currentClaims(s, 'inventory').map((c) => c.run)).toEqual(['r-0009'])
    expect(renderExtraction(s, 'abc').match(/- lo \(confirmed\)/g)).toHaveLength(1)
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

describe('실행 출력의 인용 대조 (quote_match, 결정 42, 101)', () => {
  // 실제 run: 앵커는 출력 1행을 가리켰으나 인용은 10~11행에 있었다 (docs/checks.md)
  const output = [
    '$ node rank.mjs',
    ...Array.from({ length: 8 }, (_, i) => `row ${i + 2}`),
    'sorted: 10,2,9',
    'expected: 2,9,10',
  ].join('\n')
  const out = (start: number, end: number, quote: string, path = 'out/rank.txt') => ({
    kind: 'tool_output' as const,
    path,
    start,
    end,
    quote,
    command: 'node rank.mjs',
  })
  const read = (p: string) => (p === 'out/rank.txt' ? output : null)
  it('인용이 출력 파일의 그 줄에 있으면 문제가 없다', () => {
    expect(
      outputAnchorProblems({ a: [out(10, 11, 'sorted: 10,2,9 expected: 2,9,10')] }, read),
    ).toEqual([])
  })
  it('줄이 틀리면 그 줄의 실제 내용과 인용이 있는 줄을 알린다', () => {
    expect(outputAnchorProblems({ a: [out(1, 1, 'sorted: 10,2,9')] }, read)).toEqual([
      {
        rule: 'quote_match',
        problem: expect.stringMatching(
          /output out\/rank\.txt:1-1 reads "\$ node rank\.mjs.*the quote is at line 10/,
        ),
      },
    ])
  })
  it('출력에 없는 인용, 찾지 못한 출력 파일도 문제다. code 앵커는 보지 않는다', () => {
    expect(must(outputAnchorProblems({ a: [out(1, 1, 'not printed')] }, read)[0]).problem).toMatch(
      /not in this file/,
    )
    expect(
      must(outputAnchorProblems({ a: [out(1, 1, 'x', 'gone.txt')] }, read)[0]).problem,
    ).toMatch(/output file gone\.txt was not found/)
    expect(outputAnchorProblems({ a: [anchor('src/tach.c', 1, 'nope')] }, read)).toEqual([])
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

  it('extraction.md는 intake의 기본 완료조건을 판정할 절을 둔다: 분석 범위, 후보의 원본 위치, 필요한 자료, 누락 가능성, 검증 계획', () => {
    const { revs, state, applied } = afterSurvey(
      survey({
        boundaries: [
          {
            key: 'b1',
            path: 'Drivers/HAL',
            kind: 'vendor_hal',
            reason: '벤더 코드',
            anchors: [anchor('/w/repo/Makefile', 3, 'lo: CFLAGS += -DLO')],
          },
        ],
      }),
    )
    const unit = must(state.units.find((u) => u.lens === 'command'))
    const t = applyResult({
      state,
      next: applied.next,
      unit,
      run: 'r-0002',
      result: trace({
        requirements: [
          {
            key: 'r1',
            type: 'functional',
            condition: '틱마다',
            behavior: '센다',
            result: '수가 오른다',
            configs: ['lo'],
            refs: ['o1'],
            basis: 'code',
          },
        ],
        unknowns: [{ key: 'u1', question: '틱 주기는?', needs: 'measurement', refs: [] }],
      }),
      base: 'abc',
      repo: REPO,
      blobs: { 'src/tach.c': 'b2' },
      at: AT,
    })
    const x = renderExtraction(fold([...revs, t.revision]), 'abc')
    expect(x).toContain('## 분석 범위')
    expect(x).toMatch(/- c-\d+: `Drivers\/HAL` \(벤더 HAL\): 벤더 코드/)
    // 요구사항 후보는 refs가 가리키는 관찰의 근거 위치까지 보인다
    expect(x).toMatch(/틱마다 → 센다 → 수가 오른다 — 근거: c-\d+\(src\/tach\.c:30-30\)/)
    expect(x).toContain('틱 주기는? — 필요한 자료: 측정')
    expect(x).toContain('| u-0001 | survey | 구성·진입점·경계를 찾고 분석 단위를 나눈다 |')
    expect(x).toContain('## 누락 가능성')
    expect(x).toContain('- 경계 1곳의 내부는 보지 않았다')
    expect(x).toContain('## 검증 계획')
    expect(x).toContain('미확정은 필요한 자료(측정 1)를 받아 확인한다')
  })
})

describe('진행 상자 (15.5, 결정 98)', () => {
  const decision = {
    key: 'd1',
    trigger: 'shipping_config' as const,
    question: '어느 구성이 출하되나?',
    options: ['lo', 'hi'],
    refs: ['k1'],
  }

  it('run 수와 상한, 단위 수, 지금 run의 목적, 멈춘 까닭을 보인다', () => {
    const { revs, applied } = afterSurvey()
    const c = closeRevision(applied.next, 'u-0003', 'stalled', '미완료 3', null, AT)
    const state = fold([...revs, c.revision])
    const pointer = {
      ...emptyPointer(),
      runs_used: 4,
      runs_extra: 10,
      halt: { at: AT, reason: 'failures' as const, detail: '연속 실패 3' },
    }
    const v = requirementsView({
      pointer,
      state,
      pending: [],
      current: { run: 'r-0005', unit: 'u-0002', tool: 'Read' },
      budget: DEFAULT_REQUIREMENTS_BUDGET,
    })
    expect(v).toEqual({
      runsUsed: 4,
      runLimit: DEFAULT_REQUIREMENTS_BUDGET.run_limit + 10,
      units: { open: 1, done: 1, stopped: 1 },
      current: { run: 'r-0005', unit: 'u-0002', purpose: '회전 감시 시간', tool: 'Read' },
      halt: { reason: 'failures', label: '연속 실패', detail: '연속 실패 3' },
      usageWait: null,
      decisions: [],
    })
  })

  it('열린 결정을 보이고, 포인터에 반영 대기가 있을 때만 보낸 답을 붙인다 (결정 41)', () => {
    const { state } = afterSurvey(survey({ human_decisions: [decision] }))
    const sent = [{ decision: 'h-0001', answer: 'lo만', at: AT }]
    const view = (pending_answers?: { file: string; hash: string }[]) =>
      requirementsView({
        pointer: { ...emptyPointer(), ...(pending_answers ? { pending_answers } : {}) },
        state,
        pending: sent,
        current: null,
        budget: DEFAULT_REQUIREMENTS_BUDGET,
      }).decisions
    expect(view([{ file: 'a.json', hash: 'sha256:0' }])).toEqual([
      { id: 'h-0001', question: '어느 구성이 출하되나?', options: ['lo', 'hi'], pending: 'lo만' },
    ])
    // 이미 revision이 된 답(반영 대기 없음)은 붙이지 않는다
    expect(view()[0]?.pending).toBeNull()
  })
})
