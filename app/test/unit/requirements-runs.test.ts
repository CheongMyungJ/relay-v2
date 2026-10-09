// [단위] 요구사항 추출의 integrate·review·summarize run (requirements-extraction-flow.md 16.4, AI 결정 107~114):
// 앱이 만드는 단위의 때, 종류별 결과 반영(연결, coverage, review 묶음, 맹검 비교, 서술), 고르는 차례, 패킷, 문서
import { describe, expect, it } from 'vitest'
import { loadPerspectives } from '../../../skills/extract/load.mjs'
import {
  allowsBuild,
  answerRevision,
  applyResult,
  buildIndexRevision,
  buildIndexWork,
  buildPacket,
  closeRevision,
  currentCoverage,
  emptyPointer,
  fold,
  isPartial,
  partialRevision,
  pickUnit,
  renderExtraction,
  renderPacket,
  renderHandoff,
  rewindRevision,
  rewoundPointer,
  scheduleRevision,
  scopeRevision,
  startRevision,
  surveyInventory,
  type ApplyInput,
} from '../../src/core/requirements'
import { checkHandoff } from '../../src/core/validate'
import {
  DEFAULT_REQUIREMENTS_BUDGET,
  type ExtractResult,
  type NextIds,
  type RequirementsRevision,
  type RequirementsState,
  type UnitState,
} from '../../src/shared/requirements'

const AT = '2026-10-09T10:00:00+09:00'
const REPO = '/w/repo'
const PERSPECTIVES = loadPerspectives().map((p) => p.id)
const anchor = (path: string, start: number, quote: string) => ({
  kind: 'code' as const,
  path,
  start,
  end: start,
  quote,
  command: null,
})
function must<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error('값이 없다')
  return v
}

/** 기록을 차례로 쌓는 도우미 */
class Record_ {
  revs: RequirementsRevision[] = []
  next: NextIds
  run = 0
  constructor() {
    const s = startRevision(emptyPointer().next, AT)
    this.revs.push(s.revision)
    this.next = s.next
  }
  get state(): RequirementsState {
    return fold(this.revs)
  }
  unit(id: string): UnitState {
    return must(this.state.units.find((u) => u.id === id))
  }
  apply(unitId: string, result: unknown, extra: Partial<ApplyInput> = {}) {
    const out = applyResult({
      state: this.state,
      next: this.next,
      unit: this.unit(unitId),
      run: `r-${String(++this.run).padStart(4, '0')}`,
      result: result as ExtractResult,
      base: 'abc',
      repo: REPO,
      blobs: { 'src/pump.c': 'b1', Makefile: 'b2' },
      at: AT,
      ...extra,
    })
    this.revs.push(out.revision)
    this.next = out.next
    return out
  }
  schedule(every?: number) {
    const s = scheduleRevision(this.state, this.next, AT, every)
    if (s) {
      this.revs.push(s.revision)
      this.next = s.next
    }
    return s
  }
}

const survey = (units: object[] = []) => ({
  outcome: 'done',
  outcome_reason: '봤다',
  configs: [
    {
      key: 'g1',
      name: 'a',
      status: 'confirmed',
      select: 'make a',
      build_command: 'build.bat a',
      anchors: [anchor('Makefile', 1, 'a:')],
    },
    {
      key: 'g2',
      name: 'b',
      status: 'confirmed',
      select: 'make b',
      build_command: 'build.bat b',
      anchors: [anchor('Makefile', 2, 'b:')],
    },
  ],
  inventory: [
    {
      key: 'i1',
      kind: 'isr',
      name: 'PUMP_IRQHandler',
      configs: ['all'],
      anchors: [anchor('src/pump.c', 10, 'void PUMP_IRQHandler(void)')],
      notes: '',
    },
  ],
  boundaries: [],
  units,
  not_found: [],
  unknowns: [{ key: 'u1', question: '정지 지연의 단위?', needs: 'other', refs: [] }],
  human_decisions: [],
  checkpoint: null,
})

const unitProposal = (key: string, lens: string, scope: string) => ({
  key,
  purpose: `${lens} 추적`,
  lens,
  scope,
  priority: 'medium',
  depends_on: [],
  reason: '',
})

const trace = (over: Record<string, unknown> = {}) => ({
  outcome: 'done',
  outcome_reason: '끝',
  observations: [
    {
      key: 'o1',
      text: '모든 구성에서 정지 요청이면 펌프를 끈다',
      configs: ['all'],
      anchors: [anchor('src/pump.c', 20, 'pump_off();')],
      inference: false,
    },
  ],
  quantities: [
    {
      key: 'q1',
      symbol: 'STOP_TICKS',
      expr: '20',
      values: [
        { configs: ['a'], value: '20 tick' },
        { configs: ['b'], value: '5 tick' },
      ],
      unit: 'tick',
      unit_status: 'derived',
      nature: 'setting',
      chain: [],
      anchors: [anchor('src/pump.c', 5, '#define STOP_TICKS 20')],
    },
  ],
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
})

const integrate = (over: Record<string, unknown> = {}) => ({
  outcome: 'done',
  outcome_reason: '봤다',
  links: [],
  coverage: Object.fromEntries(
    PERSPECTIVES.map((p) => [
      p,
      [{ configs: ['all'], status: 'unknown', ids: [], units: [], searches: [], note: '' }],
    ]),
  ),
  units: [],
  unknowns: [],
  human_decisions: [],
  checkpoint: null,
  ...over,
})

/** survey 하나(trace 단위 하나를 냄)와 그 trace까지 */
function surveyed() {
  const r = new Record_()
  r.apply('u-0001', survey([unitProposal('k1', 'command', 'src/pump.c stop')]))
  r.apply('u-0002', trace())
  return r
}

describe('앱이 만드는 단위의 때 (AI 결정 111, 113)', () => {
  it('돌릴 survey·trace가 남았으면 주기(10번)에 닿을 때만 integrate를 만든다', () => {
    const r = new Record_()
    r.apply(
      'u-0001',
      survey([unitProposal('k1', 'command', 'x'), unitProposal('k2', 'timing', 'y')]),
    )
    expect(r.schedule()).toBeNull()
    const s = must(r.schedule(1))
    expect(s.kind).toBe('integrate')
    expect(s.revision.cause.note).toMatch(/1번 뒤의 integrate/)
    expect(s.revision.units[0]).toMatchObject({ kind: 'integrate', lens: null, priority: 'high' })
    // 열린 integrate가 있으면 더 만들지 않는다
    expect(r.schedule(1)).toBeNull()
    // integrate가 trace보다 먼저 돈다(같은 층, high)
    expect(pickUnit(r.state).unit?.kind).toBe('integrate')
  })

  it('돌릴 survey·trace가 없으면 마지막 integrate, review 뒤에 summarize, 그 뒤에는 없다', () => {
    const r = surveyed()
    const i = must(r.schedule())
    expect(i.kind).toBe('integrate')
    expect(i.revision.cause.note).toMatch(/마지막 integrate/)
    const out = r.apply(must(i.revision.units[0]).id, integrate())
    // review 묶음: 위험 등급(수치, 모든 구성)과 표본
    const reviews = out.revision.units.filter((u) => u.kind === 'review')
    expect(reviews.length).toBe(1)
    expect(reviews[0]?.claims?.length).toBeGreaterThan(0)
    // 열린 review가 있으면 만들지 않고 review를 고른다
    expect(r.schedule()).toBeNull()
    expect(pickUnit(r.state).unit?.kind).toBe('review')
    const close = closeRevision(r.next, must(reviews[0]).id, 'failed', '실패', null, AT)
    r.revs.push(close.revision)
    r.next = close.next
    const sum = must(r.schedule())
    expect(sum.kind).toBe('summarize')
    r.apply(must(sum.revision.units[0]).id, {
      overview: [{ text: '개요', ids: ['u-0001'] }],
      handoff_summary: { text: '요약', ids: [] },
      risks: [],
    })
    expect(r.schedule()).toBeNull()
    expect(pickUnit(r.state).unit).toBeNull()
  })

  it('integrate 뒤에 survey·trace 결과가 반영되면 마지막 integrate를 다시 만든다', () => {
    const r = surveyed()
    const i = must(r.schedule())
    r.apply(
      must(i.revision.units[0]).id,
      integrate({ units: [unitProposal('n1', 'lifecycle', 'src/power.c')] }),
    )
    const lifecycle = must(r.state.units.find((u) => u.lens === 'lifecycle'))
    // 새 단위가 열려 있으면 integrate를 만들지 않고 trace를 고른다(review보다 먼저)
    expect(r.schedule()).toBeNull()
    expect(pickUnit(r.state).unit?.id).toBe(lifecycle.id)
    r.apply(lifecycle.id, trace({ observations: [], quantities: [] }))
    expect(must(r.schedule()).kind).toBe('integrate')
  })

  it('열린 사람 결정이 있거나 결정에 걸린 단위가 남으면 마지막 integrate를 만들지 않는다 (결정 7)', () => {
    const r = new Record_()
    r.apply('u-0001', {
      ...survey([unitProposal('k1', 'command', 'x')]),
      human_decisions: [
        { key: 'd1', trigger: 'shipping_config', question: '출하?', options: [], refs: ['k1'] },
      ],
    })
    expect(pickUnit(r.state).unit).toBeNull()
    expect(r.schedule()).toBeNull()
  })
})

describe('integrate 결과의 반영 (AI 결정 110~112)', () => {
  it('연결은 l- 전역 ID와 근거를 받고 상태를 바꾸지 않는다. coverage는 단위의 checklist에 둔다', () => {
    const r = surveyed()
    const i = must(r.schedule())
    const before = r.state
    const unknown = must(before.claims.find((c) => c.section === 'unknowns'))
    const quantity = must(before.claims.find((c) => c.section === 'quantities'))
    const out = r.apply(
      must(i.revision.units[0]).id,
      integrate({
        links: [
          {
            key: 'l1',
            kind: 'resolves',
            from: [unknown.id],
            to: [quantity.id],
            reason: 'trace가 단위를 이었다',
            anchors: [anchor('src/pump.c', 5, '#define STOP_TICKS 20')],
          },
        ],
        unknowns: [{ key: 'x1', question: '새 미확정', needs: 'external_doc', refs: [] }],
      }),
    )
    expect(out.revision.links).toEqual([
      {
        id: 'l-0001',
        run: 'r-0003',
        kind: 'resolves',
        from: [unknown.id],
        to: [quantity.id],
        reason: 'trace가 단위를 이었다',
        evidence: [expect.stringMatching(/^e-/)],
      },
    ])
    // 미확정은 닫히지 않는다 (결정 12)
    expect(out.revision.unit_updates.map((u) => u.id)).toEqual([must(i.revision.units[0]).id])
    expect(out.revision.claims.map((c) => c.section)).toEqual(['unknowns'])
    const state = r.state
    expect(Object.keys(must(currentCoverage(state)))).toEqual(PERSPECTIVES)
    expect(state.links).toHaveLength(1)
    expect(r.next.link).toBe(2)
  })

  it('합쳐진 주장은 review 묶음에서 빼고, 묶은 주장은 다음 integrate에서 다시 묶지 않는다', () => {
    const r = surveyed()
    const i = must(r.schedule())
    const obs = must(r.state.claims.find((c) => c.section === 'observations'))
    const inv = must(r.state.claims.find((c) => c.section === 'inventory'))
    const out = r.apply(
      must(i.revision.units[0]).id,
      integrate({
        links: [
          { key: 'l1', kind: 'merges', from: [obs.id], to: [inv.id], reason: '같다', anchors: [] },
        ],
      }),
    )
    const queued = out.revision.units.flatMap((u) => u.claims ?? [])
    expect(queued).not.toContain(obs.id)
    // 수치(위험 등급)는 묶는다
    expect(queued).toContain(must(r.state.claims.find((c) => c.section === 'quantities')).id)
    // 다음 integrate는 이미 묶은 주장을 다시 묶지 않는다
    for (const u of out.revision.units) {
      const c = closeRevision(r.next, u.id, 'failed', '실패', null, AT)
      r.revs.push(c.revision)
      r.next = c.next
    }
    const again = r.apply(must(i.revision.units[0]).id, integrate())
    expect(again.revision.units.filter((u) => u.kind === 'review')).toEqual([])
  })
})

describe('review 결과의 반영 (결정 12, AI 결정 112)', () => {
  function reviewed(answers: object, verdicts: object) {
    const r = surveyed()
    const i = must(r.schedule())
    const out = r.apply(must(i.revision.units[0]).id, integrate())
    const review = must(out.revision.units.find((u) => u.kind === 'review'))
    const built = buildPacket({
      unit: r.unit(review.id),
      state: r.state,
      intent: '목표',
      repo: REPO,
      base: 'abc',
      scratch: '/s',
      budget: DEFAULT_REQUIREMENTS_BUDGET,
      listingPath: '/l.md',
    })
    const res = r.apply(review.id, {
      outcome: 'done',
      outcome_reason: '봤다',
      answers,
      verdicts,
      unknowns: [],
      checkpoint: null,
    })
    return { r, built, res }
  }

  it('패킷은 주장의 값과 ID를 주지 않고 질문·서술 키를 낸다', () => {
    const { built } = reviewed({}, {})
    expect(built.keys).toEqual({ answers: ['q1', 'q2'], verdicts: ['s1'] })
    expect(built.packet).toContain('what value does `STOP_TICKS` take')
    expect(built.packet).not.toContain('20 tick')
    expect(built.packet).not.toMatch(/c-\d{4}/)
  })

  it('맹검 값이 어긋나면 충돌로 내리고, 맞으면 이력이다. 서술의 반증은 내린다', () => {
    const at = [anchor('src/pump.c', 5, '#define STOP_TICKS 20')]
    const { res } = reviewed(
      {
        // q1: 수치(위험 등급 number가 먼저), q2: survey 대상의 구성
        q1: {
          status: 'answered',
          text: 'b는 4 tick',
          values: [
            { configs: ['a'], value: '20 tick' },
            { configs: ['b'], value: '4 tick' },
          ],
          configs: [],
          anchors: at,
          searches: [],
        },
        q2: {
          status: 'answered',
          text: '둘 다',
          values: [],
          configs: ['a', 'b'],
          anchors: at,
          searches: [],
        },
      },
      { s1: { verdict: 'overclaimed', attempts: ['b를 봤다'], anchors: at, note: 'b는 다르다' } },
    )
    expect(res.revision.reviews?.map((x) => [x.item, x.kind, x.result, x.status])).toEqual([
      ['q1', 'value', 'conflict', 'conflict'],
      ['q2', 'configs', 'agree', null],
      ['s1', 'statement', 'overclaimed', 'overclaim'],
    ])
    expect(res.revision.reviews?.[2]?.note).toMatch(/b는 다르다 — 시도: b를 봤다/)
  })
})

describe('문서 (AI 결정 110~114)', () => {
  it('extraction.md는 개요, coverage 행렬, 접힌 주장, 검토, 부분 분석, 사람 메모를 보이고 handoff는 서술과 위험을 쓴다', () => {
    const r = surveyed()
    const i = must(r.schedule())
    const obs = must(r.state.claims.find((c) => c.section === 'observations'))
    const inv = must(r.state.claims.find((c) => c.section === 'inventory'))
    const cov = integrate().coverage as Record<string, unknown[]>
    cov['lifecycle'] = [
      { configs: ['a'], status: 'covered', ids: ['u-0002'], units: [], searches: [], note: '' },
      { configs: ['b'], status: 'unreached', ids: [], units: ['n1'], searches: [], note: '' },
    ]
    r.apply(
      must(i.revision.units[0]).id,
      integrate({
        links: [
          {
            key: 'l1',
            kind: 'merges',
            from: [obs.id],
            to: [inv.id],
            reason: '같은 말',
            anchors: [],
          },
        ],
        coverage: cov,
        units: [unitProposal('n1', 'lifecycle', 'src/power.c b')],
      }),
    )
    const held = must(r.state.units.find((u) => u.lens === 'lifecycle'))
    r.revs.push({
      schema_version: 0,
      number: r.next.revision,
      parent: r.next.revision - 1,
      at: AT,
      cause: { kind: 'human', run: null, note: '부분 분석' },
      units: [],
      unit_updates: [
        {
          id: held.id,
          status: 'held',
          reason: '보류: 예산 상한',
          run: null,
          checkpoint: null,
          checklist: null,
        },
      ],
      claims: [],
      evidence: [],
      decisions: [],
      answers: [],
      notes: [{ at: AT, by: 'human', text: 'b 보드는 빼고 본다', units: [] }],
      summary: {
        run: 'r-0009',
        overview: [{ text: '두 구성의 펌프를 봤다', ids: ['u-0001'] }],
        handoff_summary: { text: '보류가 있다', ids: [held.id] },
        risks: [{ text: 'b의 수명주기를 못 봤다', ids: [held.id] }],
      },
    })
    r.next = { ...r.next, revision: r.next.revision + 1 }
    const state = r.state
    const md = renderExtraction(state, 'abc')
    expect(md).toContain('**부분 분석**')
    expect(md).toContain('## 개요')
    expect(md).toContain('두 구성의 펌프를 봤다 (u-0001)')
    expect(md).toContain('| lifecycle | 다룸 (u-0002) | **못 닿음** |')
    expect(md).toContain('## 대체되거나 합쳐진 주장')
    expect(md).toMatch(
      new RegExp(`- ${obs.id} \\(observations, u-0002\\).*→ ${inv.id} \\(같은 말, l-0001`),
    )
    expect(md).toContain('## 사람 메모')
    expect(md).toContain('lifecycle[b] 못 닿음')
    expect(md).toContain(`| ${held.id} | trace(lifecycle) | lifecycle 추적 | 보류: 예산 상한 |`)
    // 관찰 절에는 접힌 주장이 없다
    const obsSection = md.split('## 관찰')[1]?.split('\n## ')[0] ?? ''
    expect(obsSection).not.toContain(obs.id)
    const handoff = renderHandoff(state)
    expect(handoff).toContain('risks:\n  - "b의 수명주기를 못 봤다')
    expect(handoff).toContain('보류가 있다')
    expect(handoff).toContain('부분 분석이다')
    expect(
      checkHandoff(handoff, { node: 'extract', type: 'requirements', warnChars: 99999 }).errors,
    ).toEqual([])
  })
})

describe('범위 줄이기, 부분 분석, 되감기의 revision (결정 26, 120, AI 결정 114)', () => {
  function twoOpen() {
    const r = new Record_()
    r.apply(
      'u-0001',
      survey([unitProposal('k1', 'command', 'x'), unitProposal('k2', 'timing', 'y')]),
    )
    return r
  }
  const push = (r: Record_, out: { revision: RequirementsRevision; next: NextIds }) => {
    r.revs.push(out.revision)
    r.next = out.next
  }

  it('범위 줄이기는 고른 열린 단위만 범위 밖으로 닫고 메모를 남긴다. 열린 단위가 아니면 무시한다', () => {
    const r = twoOpen()
    const out = scopeRevision(r.state, r.next, ['u-0002', 'u-0001', 'u-9999'], '타이밍은 뺀다', AT)
    expect(out.units).toEqual(['u-0002'])
    expect(out.revision.cause).toMatchObject({ kind: 'human', note: '범위 줄이기: u-0002' })
    push(r, out)
    expect(r.unit('u-0002')).toMatchObject({ status: 'out_of_scope' })
    expect(r.state.notes).toEqual([
      { at: AT, by: 'human', text: '타이밍은 뺀다', units: ['u-0002'] },
    ])
    expect(r.unit('u-0003').status).toBe('open')
  })

  it('부분 분석은 열린 단위를 보류로 닫고 summarize 하나만 연다. 그 뒤로 앱은 단위를 만들지 않는다', () => {
    const r = twoOpen()
    push(r, partialRevision(r.state, r.next, AT))
    expect(isPartial(r.state)).toBe(true)
    expect(r.state.units.filter((u) => u.status === 'held').map((u) => u.id)).toEqual([
      'u-0002',
      'u-0003',
    ])
    expect(pickUnit(r.state).unit?.kind).toBe('summarize')
    expect(r.schedule()).toBeNull()
    // 이미 summarize가 열려 있으면 또 열지 않는다
    expect(partialRevision(r.state, r.next, AT).revision.units).toEqual([])
  })

  it('되감기 이어서: 지금 revision을 parent로, 추가 지시는 메모, 보류는 다시 열고 integrate를 연다', () => {
    const r = twoOpen()
    push(r, partialRevision(r.state, r.next, AT))
    const parent = r.state.revision
    const out = rewindRevision(r.state, r.next, {
      keep: true,
      instruction: '  c-0002는 철회 후보: 구성 b를 다시 본다 ',
      at: AT,
      parent,
    })
    expect(out.revision.parent).toBe(parent)
    expect(out.revision.cause).toMatchObject({
      kind: 'human',
      note: '되감기: 현재 기록 위에서 이어서',
    })
    push(r, out)
    expect(isPartial(r.state)).toBe(false)
    expect(r.state.notes.at(-1)?.text).toBe('c-0002는 철회 후보: 구성 b를 다시 본다')
    expect(pickUnit(r.state).unit?.kind).toBe('integrate')
    // 열린 integrate가 있으면 하나 더 열지 않는다
    expect(
      rewindRevision(r.state, r.next, { keep: true, instruction: null, at: AT, parent: 9 }).revision
        .units,
    ).toEqual([])
  })

  it('되감기 처음부터: parent 없는 새 시작 revision이고 이전 계보는 접지 않는다. ID는 이어서 센다', () => {
    const r = twoOpen()
    const before = r.next
    const out = rewindRevision(r.state, r.next, {
      keep: false,
      instruction: '보드 B만',
      at: AT,
      parent: r.state.revision,
    })
    expect(out.revision.parent).toBeNull()
    expect(out.revision.number).toBe(before.revision)
    expect(out.revision.units).toMatchObject([
      { id: `u-${String(before.unit).padStart(4, '0')}`, kind: 'survey' },
    ])
    expect(out.revision.notes).toEqual([{ at: AT, by: 'human', text: '보드 B만', units: [] }])
    const fresh = fold([out.revision])
    expect(fresh.units.map((u) => u.kind)).toEqual(['survey'])
    expect(fresh.claims).toEqual([])
  })

  it('되감기로 연 계보의 포인터는 연속 횟수·멈춤·대기·답·내보내기를 비우고 run 수는 둔다', () => {
    const p = {
      ...emptyPointer(),
      revision: 7,
      revision_hash: 'sha256:x',
      runs_used: 31,
      runs_extra: 20,
      failures_in_row: 2,
      streaks: { 'u-0003': { failures: 1, incompletes: 0 } },
      halt: { at: AT, reason: 'run_limit' as const, detail: '' },
      usage_wait: { until: AT, unit: 'u-0003' },
      pending_answers: [{ file: 'a.json', hash: 'sha256:0' }],
      stop_after_run: true,
      open_decisions: 1,
      exported: { path: 'docs/requirements/w-1', commit: 'c1', at: AT },
      task: 't-02',
    }
    expect(rewoundPointer(p, 't-04')).toEqual({
      revision: 7,
      revision_hash: 'sha256:x',
      next: p.next,
      runs_used: 31,
      runs_extra: 20,
      failures_in_row: 0,
      streaks: {},
      task: 't-04',
    })
  })
})

describe('구성별 빌드 인덱스 (AI 결정 118)', () => {
  /** make 명령이 있는 survey(구성 a, b)와 그 trace 단위 제안 하나 */
  const makeSurvey = () => {
    const sv = survey([unitProposal('k1', 'command', 'src/pump.c stop')])
    sv.configs = sv.configs.map((c) => ({ ...c, build_command: `make ${c.name}` }))
    return sv
  }
  const push = (r: Record_, out: { revision: RequirementsRevision; next: NextIds }) => {
    r.revs.push(out.revision)
    r.next = out.next
  }

  it('make 명령이 있으면 명령을 보이고 묻는 앱의 결정을 내고, 답할 때까지 survey가 낸 단위를 기다리게 한다', () => {
    const r = new Record_()
    r.apply('u-0001', makeSurvey())
    const d = must(r.state.decisions[0])
    expect(d).toMatchObject({
      kind: 'build_index',
      key: 'build_index',
      trigger: 'toolchain_material',
      options: ['허용', '허용하지 않음'],
      blocks: ['u-0002'],
    })
    expect(d.question).toContain('- a: `make a`')
    expect(d.question).toContain('별도 체크아웃')
    expect(pickUnit(r.state).unit).toBeNull()
    expect(buildIndexWork(r.state)).toBeNull()
    // 같은 계보의 다음 survey는 다시 묻지 않는다
    r.apply('u-0001', makeSurvey())
    expect(r.state.decisions.filter((x) => x.kind === 'build_index')).toHaveLength(1)
  })

  it('make 명령이 없으면 묻지 않고 "만들 수 없음"을 남긴다. 빌드 명령이 없으면 아무것도 남기지 않는다', () => {
    const r = new Record_()
    r.apply('u-0001', survey([unitProposal('k1', 'command', 'x')]))
    expect(r.state.decisions).toEqual([])
    expect(r.state.build_index).toMatchObject({ status: 'unavailable', file: null })
    expect(r.state.build_index?.detail).toContain('make 계열 빌드 명령이 없음')
    const none = new Record_()
    const sv = survey()
    sv.configs = sv.configs.map((c) => ({ ...c, build_command: null as unknown as string }))
    none.apply('u-0001', sv)
    expect(none.state.build_index).toBeNull()
  })

  it('답: "허용"이면 만들 구성, 아니면 거절. 답이 단위를 다시 열지는 않는다', () => {
    expect(['허용', ' 허용 (gcc 12)', 'yes', 'Allow'].map(allowsBuild)).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect(['허용하지 않음', '아니오', ''].map(allowsBuild)).toEqual([false, false, false])
    const r = new Record_()
    r.apply('u-0001', makeSurvey())
    const answer = (text: string) =>
      answerRevision(r.state, r.next, [{ decision: 'h-0001', answer: text, at: AT }], AT)
    const yes = answer('허용')
    expect(yes.revision.unit_updates).toEqual([])
    push(r, yes)
    expect(buildIndexWork(r.state)).toEqual({
      kind: 'build',
      targets: [
        { name: 'a', command: 'make a' },
        { name: 'b', command: 'make b' },
      ],
    })
    expect(pickUnit(r.state).unit?.id).toBe('u-0002')
    const other = new Record_()
    other.apply('u-0001', makeSurvey())
    push(
      other,
      answerRevision(
        other.state,
        other.next,
        [{ decision: 'h-0001', answer: '허용하지 않음', at: AT }],
        AT,
      ),
    )
    expect(buildIndexWork(other.state)).toEqual({ kind: 'denied', answer: '허용하지 않음' })
  })

  it('인덱스와 목록이 맞지 않으면 survey를 문제와 함께 다시 열고, 그 survey의 패킷이 문제를 보인다', () => {
    const r = new Record_()
    r.apply('u-0001', makeSurvey())
    push(r, answerRevision(r.state, r.next, [{ decision: 'h-0001', answer: '허용', at: AT }], AT))
    // 다시 볼 목록: 근거가 되살아난다
    expect(surveyInventory(r.state).inventory).toMatchObject([
      {
        name: 'PUMP_IRQHandler',
        configs: ['all'],
        anchors: [{ kind: 'code', path: 'src/pump.c', start: 10 }],
      },
    ])
    const out = buildIndexRevision(r.state, r.next, AT, {
      status: 'built',
      configs: ['a', 'b'],
      file: 'build-index/abc.json',
      detail: '',
      problems: ['inventory c-0003 (PUMP_IRQHandler): configuration b does not define it'],
    })
    expect(out.reopened).toBe('u-0001')
    expect(out.revision.cause.note).toMatch(/목록 문제 1건으로 survey를 다시 엶/)
    push(r, out)
    expect(r.state.build_index).toMatchObject({ status: 'built', file: 'build-index/abc.json' })
    expect(buildIndexWork(r.state)).toBeNull()
    const survey1 = r.unit('u-0001')
    expect(survey1.status).toBe('open')
    // survey가 trace보다 먼저 돈다
    expect(pickUnit(r.state).unit?.id).toBe('u-0001')
    const packet = renderPacket({
      unit: survey1,
      state: r.state,
      intent: '의도',
      repo: REPO,
      base: 'abc',
      scratch: '/w/scratch',
      budget: DEFAULT_REQUIREMENTS_BUDGET,
    })
    expect(packet).toContain('per-configuration build index')
    expect(packet).toContain('configuration b does not define it')
    // 문제가 없으면 상태만 남긴다
    const clean = buildIndexRevision(r.state, r.next, AT, {
      status: 'failed',
      configs: [],
      file: null,
      detail: '빠진 구성: a: make -n -B 실패',
      problems: [],
    })
    expect(clean.reopened).toBeNull()
    expect(clean.revision.unit_updates).toEqual([])
  })
})
