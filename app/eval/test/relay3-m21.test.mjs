// relay-v3 M2.1 쪽(relay3-m21, relay3-m2p; relay-v3 docs/m2.1-design.md 14절): 쪽 등록과 체크아웃, 설명서, 기본 짝, 리뷰 세기
// (V23: 다시 쓴 리뷰와 멈춘 리뷰를 뺌), 내보내기마다의 관문 요약과 끝(V22), work.json의 exports[] 읽기, 장치 지표(ended.how,
// 상자, 되먹임, 기준 확인, 예시 자료, 올림). 기록의 이름과 칸은 relay-v3 main이 events.jsonl에 남기는 그대로다
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { guideName, screenKind } from '../lib/human.mjs'
import { isRelay3, RELAY3, relay3Build, relay3Env } from '../lib/kind.mjs'
import {
  deviceMetrics,
  endMetrics,
  examplesMetrics,
  factKeys,
  feedbackMetrics,
  feedbackOutcomes,
  findingKey,
  integrationMetrics,
  probeMetrics,
  raiseMetrics,
  raises,
  raisesV4,
  savedDevices,
} from '../lib/relay3-devices.mjs'
import {
  exportsOf,
  gateSummary,
  RELAY3_APP,
  RELAY3_M2P_APP,
  Relay3Arm,
  relay3AppOf,
  reviewUsage,
  workedAfterReview,
  workEnd,
} from '../lib/relay3-arm.mjs'
import { defaultPairs } from '../lib/works.mjs'
import { autoGate, autoRun, exportGates, relay3Rows } from '../report.mjs'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
const GUIDES = path.resolve(import.meta.dirname, '../guides')

describe('쪽 등록 (M2.1)', () => {
  it('relay3-m21과 relay3-m2p도 relay-v3 쪽이고 환경 변수를 더 받지 않는다. M2의 두 쪽은 그대로다', () => {
    expect(RELAY3).toEqual(['relay3', 'relay3-noreview', 'relay3-m21', 'relay3-m2p', 'relay3-m2'])
    expect(RELAY3.map(isRelay3)).toEqual([true, true, true, true, true])
    expect(['relay3-m21@auto', 'relay3-m2p-off', 'relay3-m3'].map(isRelay3)).toEqual([
      false,
      false,
      false,
    ])
    expect(relay3Env('relay3-m21')).toEqual({})
    expect(relay3Env('relay3-m2p')).toEqual({})
    expect(relay3Env('relay3-noreview')).toEqual({ RELAY_ABLATE: 'review' })
    expect(RELAY3.map(screenKind)).toEqual(['relay3', 'relay3', 'relay3', 'relay3', 'relay3'])
  })

  it('relay3-m2p만 RELAY3_M2P_APP의 체크아웃이고 나머지는 RELAY3_APP이다(기본은 relay-v2 옆)', () => {
    expect(RELAY3.map(relay3Build)).toEqual(['main', 'main', 'main', 'm2p', 'main'])
    expect(relay3Build('cli')).toBeNull()
    expect(relay3AppOf('relay3-m21')).toBe(RELAY3_APP)
    expect(relay3AppOf('relay3')).toBe(RELAY3_APP)
    expect(relay3AppOf('relay3-m2p')).toBe(RELAY3_M2P_APP)
    expect(relay3AppOf('relay@auto')).toBeNull()
    expect(relay3AppOf('relay3-m2p', { main: '/a', m2p: '/b' })).toBe('/b')
    expect(relay3AppOf('relay3-m21', { main: '/a', m2p: '/b' })).toBe('/a')
    if (!process.env.RELAY3_M2P_APP)
      expect(RELAY3_M2P_APP).toBe(path.resolve(import.meta.dirname, '../../../../relay-v3-m2p'))
  })

  it('relay3-m2p는 M2 화면의 설명서(M2의 relay3.md 그대로)를, relay3-m21은 M2.1 화면의 relay3.md를 쓴다', () => {
    expect(guideName('relay3-m2p', 'relay3')).toBe('relay3-m2p')
    expect(guideName('relay3-m21', 'relay3')).toBe('relay3')
    const m2 = fs.readFileSync(path.join(GUIDES, 'relay3-m2p.md'), 'utf8')
    const m21 = fs.readFileSync(path.join(GUIDES, 'relay3.md'), 'utf8')
    expect(m2).toContain('[끝 확정]')
    expect(m2).toContain('[고쳐 달라고 하기]')
    // M2.1: 한 번 끝, 걸린 끝과 [취소], 열린 것만 보이는 상자, 늘 보이는 고칠 점 칸, [세션에 넘기기]
    expect(m21).not.toContain('[끝 확정]')
    expect(m21).not.toContain('[고쳐 달라고 하기]')
    for (const label of [
      '리뷰 끝나면 끝냄',
      '[취소]',
      '[그래도 끝내기]',
      '[더 고치기]',
      '[세션에 넘기기]',
      "'고칠 점' 칸",
      '[보내기]',
    ])
      expect(m21).toContain(label)
    // 화면 조작만 고친다: 일을 나누는 방법을 권하지 않는다(V21을 정직하게 잰다)
    expect(m21).not.toMatch(/Work 하나로|한 Work로|Work를 나누/)
  })

  it('relay3-m21이 돌면 relay3-m2p와 relay@auto 옆에서 짝 판정한다(M2.1에는 맨 CLI가 없다)', () => {
    const s = { id: 'x', report: 'r' }
    expect(defaultPairs(s, ['relay3-m21', 'relay3-m2p', 'relay@auto'])).toEqual([
      ['relay', 'cli'],
      ['relay3-m21', 'relay3-m2p'],
      ['relay3-m21', 'relay@auto'],
    ])
    // 설계 셋은 relay3-m21만 돈다
    expect(defaultPairs(s, ['relay3-m21'])).toEqual([['relay', 'cli']])
    // M2의 짝은 그대로
    expect(defaultPairs(s, ['relay3', 'cli'])).toEqual([
      ['relay', 'cli'],
      ['relay3', 'cli'],
    ])
  })
})

describe('리뷰 세기 (V23)', () => {
  const usage = (n) => ({ input_tokens: n, output_tokens: 1, cache_read_input_tokens: 10 * n })
  const events = [
    { type: 'review', trigger: 'prepared', status: 'done', findings: 1, usage: usage(100) },
    // 같은 head·계약의 미리 리뷰를 [끝내기]가 다시 씀: claude -p를 부르지 않았다
    { type: 'review', trigger: 'end', reused: true, status: 'done', findings: 1 },
    // head가 바뀌어 멈춘 리뷰
    { type: 'review', trigger: 'prepared', aborted: true },
    { type: 'review', trigger: 'end', status: 'failed', findings: 0 },
    { type: 'review', trigger: 'pr', status: 'done', findings: 2, usage: usage(7) },
  ]

  it('다시 쓴 리뷰와 멈춘 리뷰는 호출로도 토큰으로도 세지 않고 따로 센다. 미리 리뷰는 돈 것 가운데 센다', () => {
    expect(reviewUsage(events)).toEqual({
      calls: 3,
      done: 2,
      failed: 1,
      skipped: 0,
      prepared: 1,
      reused: 1,
      aborted: 1,
      usageUnknown: 1,
      input: 107,
      output: 2,
      cacheRead: 1070,
      cacheWrite: 0,
    })
  })

  it('리뷰 뒤 세션이 일했는지는 실제로 돈 첫 리뷰부터 본다(다시 쓴 것, 멈춘 것은 아님)', () => {
    const hook = { type: 'hook', event: 'PreToolUse', tool: 'Edit' }
    expect(workedAfterReview([events[2], hook, events[1]])).toBeNull()
    expect(workedAfterReview([events[2], hook, events[0]])).toBe(false)
    expect(workedAfterReview([events[0], hook])).toBe(true)
  })
})

describe('내보내기마다의 관문과 끝 (V22)', () => {
  const ev = (head, exp, extra = {}) => ({ type: 'evidence', head, export: exp, ...extra })
  const shadow = { conclusion: 'human_merge', shadow: true, condition: 'small', decisive: 'd' }

  it('관문 요약은 그 단위의 evidence 기록만 보고 통합 증거는 뺀다', () => {
    const events = [
      ev('a', true),
      { type: 'evidence', head: 'w', integration: true, open: 0 },
      ev('u1', true, { unit: 'csv' }),
      ev('u2', false, { unit: 'money' }),
    ]
    // one_branch: 마지막이 통합 증거여도 Work 브랜치 내보내기의 기록으로 본다
    expect(gateSummary(shadow, events, 'a', 'a').export).toBe(true)
    expect(gateSummary(shadow, events, 'u1', 'u1', 'csv')).toEqual({
      conclusion: 'human_merge',
      condition: 'small',
      shadow: true,
      decisive: 'd',
      export: true,
      unit: 'csv',
    })
    // 이 단위의 마지막 재기가 내보내기가 아님(미리 리뷰)
    expect(gateSummary(shadow, events, 'u2', 'u2', 'money').export).toBe(false)
  })

  it('옛 기록(M2, relay3-m2p)은 Work의 칸을 Work 브랜치의 내보내기 하나로 읽는다', () => {
    expect(
      exportsOf({ branch: 'relay/x', gate: shadow, exported_head: 'a', evidence_path: '/e' }),
    ).toEqual({
      modern: false,
      exports: [
        {
          unit: null,
          branch: 'relay/x',
          gate: shadow,
          exportedHead: 'a',
          evidencePath: '/e',
          pr: null,
        },
      ],
    })
    const m21 = exportsOf({
      branch: 'relay/x',
      exports: [
        { unit: 'csv', branch: 'relay/x--csv', gate: shadow, exported_head: 'u1' },
        { unit: 'money', branch: 'relay/x--money', gate: null, exported_head: null },
      ],
    })
    expect(m21.modern).toBe(true)
    expect(m21.exports.map((x) => [x.unit, x.branch, x.exportedHead])).toEqual([
      ['csv', 'relay/x--csv', 'u1'],
      ['money', 'relay/x--money', null],
    ])
  })

  it('끝: ended 기록은 어떻게 끝냈든 confirmed다. 앱에서 끝내지 않았으면 내보내기가 모두 그 끝에서 잰 것일 때만 prepared', () => {
    for (const how of ['once', 'armed', 'box'])
      expect(workEnd({ state: 'done', events: [{ type: 'ended', how, head: 'a' }] })).toBe(
        'confirmed',
      )
    const events = [ev('u1', true, { unit: 'csv' }), ev('u2', true, { unit: 'money' })]
    const both = [
      { unit: 'csv', exportedHead: 'u1', tip: 'u1' },
      { unit: 'money', exportedHead: 'u2', tip: 'u2' },
    ]
    expect(workEnd({ state: 'working', events, exports: both, clean: true })).toBe('prepared')
    // 한 단위 브랜치가 그 뒤 움직임
    expect(
      workEnd({
        state: 'working',
        events,
        exports: [both[0], { ...both[1], tip: 'u3' }],
        clean: true,
      }),
    ).toBe('stale')
    // 한 단위만 내보냈다
    expect(
      workEnd({
        state: 'working',
        events: [events[0]],
        exports: [both[0], { unit: 'money', exportedHead: null, tip: 'u2' }],
        clean: true,
      }),
    ).toBe('stale')
    expect(workEnd({ state: 'working', events: [], exports: both, clean: true })).toBeNull()
  })

  it('M2.1의 자동 조건은 실행의 내보내기 모두(autoRun), M2는 하나라도(autoGate)다. 버린 Work는 보지 않는다', () => {
    const g = (o) => ({ conclusion: 'human_merge', shadow: false, export: true, ...o })
    const run = (...works) => ({ works })
    const both = run({ gates: [g({ shadow: true }), g({ conclusion: 'auto_merge_candidate' })] })
    const one = run({ gates: [g({ shadow: true }), g({})] })
    const notExported = run({ gates: [g({ shadow: true }), g({ shadow: true, export: false })] })
    const abandoned = run({ gate: g({ shadow: true }) }, { status: 'abandoned', gate: g({}) })
    expect([both, one, notExported, abandoned].map(autoRun)).toEqual([true, false, false, true])
    expect([both, one, notExported].map(autoGate)).toEqual([true, true, true])
    expect(autoRun(run())).toBe(false)
    // gates가 없는 예전 결과는 gate 하나다
    expect(exportGates(run({ gate: g({ shadow: true }) }))).toHaveLength(1)
    expect(exportGates(notExported)).toHaveLength(1)
  })
})

describe('장치 지표', () => {
  it('[끝내기] 누름은 바로 끝남·걸림·바로 뜬 상자로 센다. 걸린 끝이 풀려 뜬 상자는 누름이 아니다', () => {
    const e = endMetrics([
      // 1: 걸렸다가 상자, [더 고치기]
      { type: 'end_armed', head: 'a' },
      { type: 'end_box', head: 'a', open: 2 },
      { type: 'end_cancelled', head: 'a', armed: false, reason: 'human' },
      // 2: 바로 상자, 세션이 커밋해 지움
      { type: 'end_box', head: 'b', open: 1 },
      { type: 'end_moved', from: 'b', to: 'c', armed: false },
      // 3: 걸렸는데 [취소]
      { type: 'end_armed', head: 'c' },
      { type: 'end_cancelled', head: 'c', armed: true, reason: 'human' },
      // 4: 계약이 바뀌어 지움
      { type: 'end_armed', head: 'c' },
      { type: 'end_cancelled', head: 'c', armed: true, reason: 'contract' },
      // 5: 걸렸다가 재기 실패
      { type: 'end_armed', head: 'c' },
      { type: 'end_failed', head: 'c' },
      // 6: 걸렸다가 끝남
      { type: 'end_armed', head: 'c' },
      { type: 'ended', how: 'armed', head: 'c' },
    ])
    expect(e).toEqual({
      how: 'armed',
      presses: 6,
      ready: 1,
      armed: 5,
      boxes: 2,
      forced: 0,
      cancelled: 2,
      cancelledByContract: 1,
      moved: 1,
      failed: 1,
    })
    expect(endMetrics([{ type: 'ended', how: 'once', head: 'a' }])).toMatchObject({
      how: 'once',
      presses: 1,
      ready: 1,
    })
    // 상자에서 [그래도 끝내기]는 누름이 아니라 forced
    expect(
      endMetrics([
        { type: 'end_box', head: 'a', open: 1 },
        { type: 'ended', how: 'box', head: 'a', open: 1 },
      ]),
    ).toMatchObject({ how: 'box', presses: 1, ready: 1, boxes: 1, forced: 1 })
    // M2의 [끝 확정]은 how가 없다
    expect(endMetrics([{ type: 'ended' }])).toMatchObject({ how: null, presses: 0 })
  })

  it('되먹임: relay가 보낸 라운드(결정론·리뷰)와 사람이 넘긴 것, 보내지 않은 까닭', () => {
    expect(
      feedbackMetrics([
        { type: 'feedback', n: 1, head: 'a', by: 'relay', facts: 2, findings: 0, keys: [] },
        { type: 'feedback', n: 2, head: 'b', by: 'relay', facts: 0, findings: 1, keys: [] },
        { type: 'feedback', n: 3, head: 'b', by: 'human', facts: 0, findings: 2, keys: [] },
        { type: 'feedback_held', head: 'b', reason: 'human_input', facts: 1, findings: 0 },
        { type: 'feedback_held', head: 'c', reason: 'human_input', facts: 1, findings: 0 },
        { type: 'feedback_held', head: 'c', reason: 'cap', facts: 1, findings: 0 },
      ]),
    ).toEqual({
      rounds: 2,
      factRounds: 1,
      findingRounds: 1,
      facts: 2,
      findings: 1,
      passed: 1,
      passedFindings: 2,
      held: { human_input: 2, cap: 1 },
    })
  })

  it('되먹임 사실의 이름은 relay-v3 feedbackFacts·findingKey와 같은 규칙이다', () => {
    const bundle = {
      quality: { hash: 'h', from: 'base' },
      contract: { id: 'fix-1', hash: 'c' },
      lines: [
        { line: 'C1', status: 'not_met' },
        { line: 'C2', status: 'met' },
        { line: 'C3', status: 'missing_evidence' },
      ],
      commands: [
        { id: 'test', outcome: 'fail' },
        { id: 'lint', outcome: 'pass' },
        { id: 'e2e', outcome: 'not_run' },
        { id: 'flaky', outcome: 'flaky' },
      ],
      ratchets: [
        { id: 'tests', status: 'worse' },
        { id: 'lines', status: 'unknown' },
      ],
      examples_file: { path: 'p', status: 'differs', diffs: [] },
      missing: [],
    }
    expect(factKeys(bundle)).toEqual([
      'line:C1:not_met',
      'line:C3:missing_evidence',
      'command:test:fail',
      'command:e2e:not_run',
      'ratchet:tests:worse',
      'examples:differs',
    ])
    // 수용 시험 명령이 없으면 줄 사실은 없다. 품질 기준이 없으면 아무것도 없다
    expect(factKeys({ ...bundle, missing: ['acceptance'] })).not.toContain('line:C1:not_met')
    expect(factKeys({ ...bundle, quality: { from: 'none' } })).toEqual([])
    expect(findingKey({ id: 'R1', raise: 'structure', severity: 'medium', text: 't' })).toBe(
      'review:["structure","medium",null,null,"t"]',
    )
  })

  it('보낸 사실은 다음 head의 묶음에 같은 사실이 없으면 고쳐짐이고, 지적은 다음 리뷰가 다시 올리지 않으면 고쳐짐이다', () => {
    const q = { quality: { from: 'base' }, contract: { id: 'c' }, missing: [] }
    const f1 = { id: 'R1', raise: 'structure', severity: 'medium', text: 'a' }
    const f2 = { id: 'R2', raise: 'security', severity: 'low', text: 'b' }
    const byHead = {
      h1: {
        ...q,
        lines: [
          { line: 'C1', status: 'not_met' },
          { line: 'C2', status: 'met' },
        ],
        commands: [{ id: 'test', outcome: 'fail' }],
        review: { status: 'done', findings: [f1, f2] },
      },
      // 결정론 사실이 고쳐졌지만 C2가 못 미침이 됨(해로움). 리뷰는 아직(미리 리뷰 앞)
      h2: {
        ...q,
        lines: [
          { line: 'C1', status: 'met' },
          { line: 'C2', status: 'not_met' },
        ],
        commands: [{ id: 'test', outcome: 'fail' }],
        review: null,
      },
      // 다음 리뷰: f1은 다시 올림, f2는 없음
      h3: { ...q, lines: [], commands: [], review: { status: 'done', findings: [f1] } },
    }
    const keys = ['line:C1:not_met', 'command:test:fail', findingKey(f1), findingKey(f2)]
    const events = [
      { type: 'evidence', head: 'h1', export: false },
      { type: 'feedback', n: 1, head: 'h1', by: 'relay', facts: 2, findings: 2, keys },
      { type: 'evidence', head: 'h2', export: false },
      { type: 'evidence', head: 'h3', export: false },
      // 사람이 넘긴 것: 그 뒤 잰 head가 없다
      { type: 'feedback', n: 2, head: 'h3', by: 'human', facts: 0, findings: 1, keys: [keys[2]] },
      // 단위 브랜치의 되먹임: head마다의 묶음이 남지 않는다
      {
        type: 'feedback',
        n: 3,
        head: 'u',
        by: 'relay',
        unit: 'csv',
        facts: 1,
        findings: 0,
        keys: ['x'],
      },
    ]
    expect(feedbackOutcomes(events, byHead)).toEqual({
      relay: {
        facts: { fixed: 1, kept: 1, unknown: 1 },
        findings: { fixed: 1, kept: 1, unknown: 0 },
        harmful: 1,
      },
      human: {
        facts: { fixed: 0, kept: 0, unknown: 0 },
        findings: { fixed: 0, kept: 0, unknown: 1 },
        harmful: 0,
      },
    })
  })

  it('기준 확인: 부른 제출, 돈 확인, 돌려보낸 제출과 줄, 걸린 시간', () => {
    expect(
      probeMetrics([
        { type: 'probe', tool: 'submit_contract', ran: true, problems: 2, ms: 40_000 },
        { type: 'probe', tool: 'submit_contract', ran: true, problems: 0, ms: 20_000 },
        {
          type: 'probe',
          tool: 'request_contract_change',
          ran: false,
          problems: 0,
          ms: 0,
          note: 'n',
        },
      ]),
    ).toEqual({ calls: 3, ran: 2, rejected: 1, problems: 2, ms: [40_000, 20_000] })
  })

  it('예시 자료: 잰 묶음마다의 상태와 내보내기의 마지막 상태', () => {
    const b = (status) => ({ examples_file: status && { path: 'p', status, diffs: [] } })
    expect(
      examplesMetrics(
        [b('absent'), b('differs'), b('same'), b(null), {}],
        [{ unit: null, bundle: b('same') }],
      ),
    ).toEqual({ bundles: 3, absent: 1, differs: 1, unreadable: 0, facts: 2, final: ['same'] })
  })

  it('올림(V26): 구조/low와 갈래가 없는 지적은 메모, 모르는 갈래는 올림. request_gap은 어느 묶음에서든 센다', () => {
    expect(
      [
        { raise: 'structure', severity: 'low' },
        { raise: 'structure', severity: 'medium' },
        { raise: 'out_of_contract', severity: 'low' },
        { raise: 'request_gap', severity: 'low' },
        { raise: 'new_kind', severity: 'low' },
        { severity: 'high' },
      ].map(raises),
    ).toEqual([false, true, true, true, true, false])
    const reviewed = (findings, status = 'done') => ({ review: { status, findings } })
    const gap = { id: 'R1', raise: 'request_gap', severity: 'low', text: 't' }
    const low = { id: 'R2', raise: 'structure', severity: 'low', text: 't' }
    const med = { id: 'R3', raise: 'structure', severity: 'medium', text: 't' }
    const earlier = reviewed([gap])
    const last = reviewed([low, med])
    const r = raiseMetrics(
      [earlier, last, reviewed([gap], 'failed')],
      [
        { unit: null, bundle: last },
        { unit: 'csv', bundle: null },
      ],
    )
    expect(r).toEqual({
      rule: 'v26',
      exports: [
        {
          unit: null,
          reviewed: true,
          raised: 1,
          notes: 1,
          requestGap: 0,
          byKind: { structure: 1 },
          bySeverity: { medium: 1 },
        },
        {
          unit: 'csv',
          reviewed: false,
          raised: 0,
          notes: 0,
          requestGap: 0,
          byKind: {},
          bySeverity: {},
        },
      ],
      requestGapBundles: 1,
    })
  })

  it('옛 규칙(V4, M2·relay3-m2p의 관문): 갈래가 있는 지적은 구조/low도 올림이고 갈래가 없는 것만 메모다', () => {
    expect(
      [
        { raise: 'structure', severity: 'low' },
        { raise: 'request_gap', severity: 'low' },
        { raise: null, severity: 'high' },
        { severity: 'high' },
      ].map(raisesV4),
    ).toEqual([true, true, false, false])
    const last = {
      review: {
        status: 'done',
        findings: [
          { raise: 'structure', severity: 'low', text: 'a' },
          { raise: 'structure', severity: 'low', text: 'b' },
          { severity: 'medium', text: 'c' },
        ],
      },
    }
    const finals = [{ unit: null, bundle: last }]
    expect(raiseMetrics([last], finals, 'v4')).toMatchObject({
      rule: 'v4',
      exports: [{ raised: 2, notes: 1, byKind: { structure: 2 }, bySeverity: { low: 2 } }],
    })
    expect(raiseMetrics([last], finals)).toMatchObject({
      rule: 'v26',
      exports: [{ raised: 0, notes: 3, byKind: {} }],
    })
    // request_gap은 올림 규칙과 상관없이 리뷰어가 낸 것을 센다: 메모 빌드(V30 메모)에서는 메모로 가르고 수는 그대로
    const gap = {
      review: { status: 'done', findings: [{ raise: 'request_gap', severity: 'low', text: 'g' }] },
    }
    const gapFinals = [{ unit: null, bundle: gap }]
    expect(raiseMetrics([gap], gapFinals)).toMatchObject({
      exports: [{ raised: 1, notes: 0, requestGap: 1 }],
      requestGapBundles: 1,
    })
    expect(raiseMetrics([gap], gapFinals, 'memo')).toMatchObject({
      rule: 'memo',
      exports: [{ raised: 0, notes: 1, requestGap: 1 }],
      requestGapBundles: 1,
    })
    // 그 빌드의 관문 규칙으로 센다: M2.1 기록(exports[])은 V26, 옛 기록(M2, relay3-m2p)은 V4
    const old = deviceMetrics({ events: [], rec: { gate: null }, finals, all: [last] })
    expect(old.raises).toMatchObject({ rule: 'v4', exports: [{ raised: 2, notes: 1 }] })
    const modern = deviceMetrics({ events: [], rec: { exports: [{}] }, finals, all: [last] })
    expect(modern.raises).toMatchObject({ rule: 'v26', exports: [{ raised: 0, notes: 3 }] })
  })

  it('통합 증거(V22): 잰 수, 마지막 것의 열린 것, 커밋이 Work 브랜치에 없는 단위 브랜치(마지막 관문의 사실, 브랜치마다 한 번)', () => {
    const outside = (b) => `통합 증거: 단위 브랜치의 커밋이 Work 브랜치에 없음: ${b}`
    const rec = {
      exports: [
        {
          unit: 'csv',
          gate: {
            conclusion: 'human_merge',
            decisive: outside('relay/x--money'),
            reasons: [outside('relay/x--money'), '통합 증거: 수용 시험 줄 1: 못 미침'],
          },
        },
        {
          unit: 'money',
          gate: { conclusion: 'human_merge', reasons: [outside('relay/x--money')] },
        },
        { unit: 'report', gate: null },
      ],
    }
    const events = [
      { type: 'evidence', head: 'a', integration: true, open: 0 },
      { type: 'evidence', head: 'a', export: false, unit: 'csv', conclusion: 'human_merge' },
      { type: 'evidence', head: 'b', integration: true, open: 2 },
    ]
    expect(integrationMetrics(events, rec)).toEqual({
      measures: 2,
      lastOpen: true,
      notOnWorkBranch: 1,
    })
    expect(
      integrationMetrics([{ type: 'evidence', head: 'b', integration: true, open: 0 }], rec),
    ).toMatchObject({ measures: 1, lastOpen: false })
    // one_branch와 옛 기록: 통합 증거가 없다
    expect(integrationMetrics([{ type: 'evidence', head: 'a', export: true }], {})).toEqual({
      measures: 0,
      lastOpen: null,
      notOnWorkBranch: 0,
    })
    expect(deviceMetrics({ events, rec }).integration).toEqual({
      measures: 2,
      lastOpen: true,
      notOnWorkBranch: 1,
    })
  })

  it('Work의 장치 지표는 내보내기 수, 단위, 전달 방식, 없는 단위 브랜치를 함께 둔다. 옛 기록은 modern이 아니다', () => {
    const d = deviceMetrics({
      events: [{ type: 'export_missing', unit: 'money', branch: 'relay/x--money' }],
      rec: { exports: [{ unit: 'csv' }, { unit: 'money' }] },
      contract: {
        delivery: 'branch_per_unit',
        lines: [{ unit: 'csv' }, { unit: 'money' }, { unit: 'csv' }, {}],
      },
    })
    expect(d).toMatchObject({
      modern: true,
      exports: 2,
      units: 2,
      delivery: 'branch_per_unit',
      missingExports: 1,
    })
    expect(deviceMetrics({ events: [], rec: { gate: null } })).toMatchObject({
      modern: false,
      exports: 1,
      units: 0,
      delivery: null,
    })
  })

  it('결과 폴더에 남긴 Work에서 장치 지표를 다시 센다(예전 결과)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay3-saved-'))
    dirs.push(root)
    const bundle = {
      head: 'a',
      examples_file: { path: 'p', status: 'differs', diffs: [] },
      review: { status: 'done', findings: [{ id: 'R1', raise: 'request_gap', severity: 'low' }] },
    }
    fs.writeFileSync(path.join(root, 'work.json'), JSON.stringify({ exports: [{ unit: null }] }))
    fs.writeFileSync(path.join(root, 'evidence.json'), JSON.stringify(bundle))
    fs.writeFileSync(
      path.join(root, 'events.jsonl'),
      `${JSON.stringify({ type: 'ended', how: 'once', head: 'a' })}\n{"type":"pro`,
    )
    expect(savedDevices(root)).toMatchObject({
      modern: true,
      end: { how: 'once', presses: 1 },
      examples: { differs: 1, final: ['differs'] },
      raises: { requestGapBundles: 1, exports: [{ requestGap: 1, raised: 1 }] },
    })
    expect(savedDevices(path.join(root, 'none'))).toBeNull()
  })

  it('보고서의 relay-v3 표는 내보내기마다 관문을 세고 끝낸 방식을 보인다', () => {
    const g = { conclusion: 'human_merge', shadow: true, export: true }
    const rows = Object.fromEntries(
      relay3Rows([
        {
          outcome: { success: true },
          works: [
            {
              status: 'done',
              ended: true,
              end: 'confirmed',
              gate: null,
              gates: [g, { ...g, shadow: false }],
              devices: { end: { how: 'once' } },
            },
          ],
        },
        {
          outcome: { success: false },
          works: [{ status: 'done', ended: true, gate: g, devices: { end: { how: 'box' } } }],
        },
      ]),
    )
    expect(rows['관문 결론(Work마다 마지막)']).toBe('사람 머지(내보내기) 3')
    expect(rows['끝낸 방식(V25: 한 번·걸림·상자, Work마다)']).toBe(
      '한 번 1, 상자에서 [그래도 끝내기] 1',
    )
  })
})

describe('앱 저장소 읽기 (M2.1 work.json)', () => {
  /** 평가 레포, Work worktree(작업 브랜치), 단위 브랜치 하나, 세션이 따로 만든 브랜치 하나 */
  function setup() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay3-m21-'))
    dirs.push(root)
    const repo = path.join(root, 'repo')
    fs.mkdirSync(repo)
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'config', 'user.email', 'a@b')
    git(repo, 'config', 'user.name', 'a')
    fs.writeFileSync(path.join(repo, 'a.js'), 'a\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'base')
    const base = git(repo, 'rev-parse', 'HEAD')
    const id = '5b6c7d8e-0000-4000-8000-000000000000'
    const home = path.join(root, 'relay3-home')
    const wt = path.join(home, 'worktrees', id)
    git(repo, 'worktree', 'add', '-q', '-b', 'relay/fix-5b6c', wt, 'main')
    fs.writeFileSync(path.join(wt, 'b.js'), 'b\n')
    git(wt, 'add', '.')
    git(wt, 'commit', '-qm', 'fix')
    const head = git(wt, 'rev-parse', 'HEAD')
    git(repo, 'branch', 'relay/fix-5b6c--csv', head)
    git(repo, 'branch', 'side', head)
    git(repo, 'branch', 'empty', 'main')
    return { root, repo, base, id, home, wt, head }
  }

  it('내보내기마다 관문 요약(브랜치 ref로 낡음을 봄), 장치 지표, 묶음을 읽고 재지 않은 브랜치를 센다', () => {
    const { root, repo, base, id, home, wt, head } = setup()
    const arm = new Relay3Arm({ dir: root, repo, base, agentEnv: {}, agentConfigDir: root })
    const evDir = path.join(home, 'evidence', 'k')
    fs.mkdirSync(evDir, { recursive: true })
    const work = path.join(home, 'works', id)
    fs.mkdirSync(path.join(work, 'evidence'), { recursive: true })
    // 앞 head(미리 리뷰가 request_gap을 올림)와 지금 head(내보내기)의 묶음: 엔진은 head마다 파일 하나를 쓴다
    const earlier = 'a'.repeat(40)
    fs.writeFileSync(
      path.join(evDir, `${earlier}.json`),
      JSON.stringify({
        head: earlier,
        examples_file: { path: 'p', status: 'absent', diffs: [] },
        review: { status: 'done', findings: [{ id: 'R1', raise: 'request_gap', severity: 'low' }] },
      }),
    )
    fs.writeFileSync(
      path.join(evDir, `${head}.json`),
      JSON.stringify({
        head,
        examples_file: { path: 'p', status: 'same', diffs: [] },
        review: { status: 'done', findings: [{ id: 'R1', raise: 'structure', severity: 'low' }] },
      }),
    )
    const unitBundle = path.join(work, 'evidence', 'unit-csv.json')
    fs.writeFileSync(unitBundle, JSON.stringify({ head, review: { status: 'done', findings: [] } }))
    const shadow = { conclusion: 'human_merge', shadow: true, condition: 'small', decisive: 'd' }
    fs.writeFileSync(
      path.join(work, 'work.json'),
      JSON.stringify({
        id,
        state: 'done',
        branch: 'relay/fix-5b6c',
        worktree: wt,
        exports: [
          {
            unit: null,
            branch: 'relay/fix-5b6c',
            gate: shadow,
            exported_head: head,
            evidence_path: path.join(evDir, `${head}.json`),
            pr: null,
            prepared_reviews: 1,
          },
          {
            unit: 'csv',
            branch: 'relay/fix-5b6c--csv',
            gate: shadow,
            exported_head: head,
            evidence_path: unitBundle,
            pr: null,
            prepared_reviews: 1,
          },
        ],
        integration_path: null,
        end_pending: null,
        feedback: { rounds: 1, sent: [] },
        probe: null,
      }),
    )
    fs.writeFileSync(
      path.join(work, 'events.jsonl'),
      [
        { type: 'evidence', head: earlier, export: false, conclusion: 'human_merge' },
        { type: 'review', trigger: 'prepared', status: 'done', findings: 1 },
        { type: 'feedback', n: 1, head: earlier, by: 'relay', facts: 1, findings: 0, keys: [] },
        { type: 'probe', tool: 'submit_contract', ran: true, problems: 0, ms: 1000 },
        { type: 'evidence', head, integration: true, open: 1 },
        { type: 'evidence', head, export: true, conclusion: 'human_merge', shadow: true },
        { type: 'evidence', head, export: true, unit: 'csv', conclusion: 'human_merge' },
        { type: 'review', trigger: 'end', reused: true, status: 'done', findings: 1 },
        { type: 'ended', how: 'once', head },
      ]
        .map((e) => JSON.stringify(e))
        .join('\n'),
    )
    const [w] = arm.works()
    expect(w).toMatchObject({
      status: 'done',
      end: 'confirmed',
      ended: true,
      gate: null,
      gates: [
        { shadow: true, export: true },
        { shadow: true, export: true, unit: 'csv' },
      ],
      exportedHead: null,
      review: { calls: 1, prepared: 1, reused: 1 },
      devices: {
        modern: true,
        exports: 2,
        end: { how: 'once', presses: 1, ready: 1 },
        feedback: { rounds: 1, facts: 1 },
        probe: { calls: 1, ran: 1, rejected: 0, ms: [1000] },
        examples: { bundles: 2, absent: 1, facts: 1, final: ['same', null] },
        raises: { rule: 'v26', requestGapBundles: 1 },
        integration: { measures: 1, lastOpen: true, notOnWorkBranch: 0 },
      },
    })
    expect(w.devices.raises.exports.map((x) => [x.unit, x.raised, x.notes])).toEqual([
      [null, 0, 1],
      ['csv', 0, 0],
    ])
    expect(w.files['evidence.json']).toBe(path.join(evDir, `${head}.json`))
    expect(autoRun({ works: [w] })).toBe(true)
    // 단위 브랜치와 Work 브랜치는 relay가 잰다. 기준 뒤에 커밋이 없는 브랜치는 세지 않는다
    expect(arm.unmeasuredBranches()).toEqual(['side'])
  })

  it('M2.1 기록의 내보내기 끝은 worktree의 checkout이 아니라 Work 브랜치의 ref다(V21)', () => {
    const { root, repo, base, id, home, wt, head } = setup()
    const arm = new Relay3Arm({ dir: root, repo, base, agentEnv: {}, agentConfigDir: root })
    const work = path.join(home, 'works', id)
    fs.mkdirSync(work, { recursive: true })
    const rec = {
      id,
      state: 'working',
      branch: 'relay/fix-5b6c',
      worktree: wt,
      exports: [{ unit: null, branch: 'relay/fix-5b6c', gate: null, exported_head: head }],
    }
    fs.writeFileSync(path.join(work, 'work.json'), JSON.stringify(rec))
    fs.writeFileSync(
      path.join(work, 'events.jsonl'),
      JSON.stringify({ type: 'evidence', head, export: true }),
    )
    // 세션이 worktree에서 다른 브랜치로 옮김: 재는 대상(ref)은 그대로라 끝낸 커밋 그대로다
    git(wt, 'checkout', '-q', '-b', 'other')
    fs.writeFileSync(path.join(wt, 'c.js'), 'c\n')
    git(wt, 'add', '.')
    git(wt, 'commit', '-qm', 'other')
    expect(arm.works()[0].end).toBe('prepared')
    // 옛 기록은 worktree의 HEAD를 본다
    const { exports, ...old } = rec
    fs.writeFileSync(
      path.join(work, 'work.json'),
      JSON.stringify({ ...old, exported_head: exports[0].exported_head }),
    )
    expect(arm.works()[0].end).toBe('stale')
  })
})
