// relay-v3 M2.1 평가의 집계(m21-primary.mjs, relay-v3 docs/m2.1-design.md 14절): P1 m21 − m2p의 −10%p 규칙, P3 마찰의 −2 규칙,
// P3 막대(M2 Q2의 δ 2), 거짓 자동(14·H2·H3, 내보내기 모두), 온라인 G1·G2(Q4 규칙), 규칙 4(P5), 결론은 봉인 셋에서만,
// 장치 지표 표와 최소 n. 결과를 보기 전에 정한 규칙이 그대로 적용되는지 본다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { equivalence } from '../m2-primary.mjs'
import {
  AUTO,
  deviceRows,
  DESIGN,
  falseAutos,
  falseAutoScenariosOf,
  frictionReading,
  H1,
  H2,
  H3,
  hadRequestGap,
  loadM21Runs,
  M21,
  M2P,
  m21Report,
  m21Verdicts,
  minNRows,
  p1Reading,
  p5Base,
  runHow,
  sealedOf,
} from '../m21-primary.mjs'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

/** 내보내기 결론(relay3-arm.mjs gateSummary의 모양) */
const gate = (o = {}) => ({
  conclusion: 'human_merge',
  condition: 'small',
  shadow: false,
  decisive: 'd',
  export: true,
  ...o,
})
const AUTOG = gate({ shadow: true })

/** Work 하나(relay3-arm.mjs works()의 모양) */
const work = (o = {}) => ({
  id: o.id ?? 'w1',
  status: o.status ?? 'done',
  ended: o.ended ?? true,
  gate: o.gates ? null : (o.gate ?? gate()),
  ...(o.gates ? { gates: o.gates } : {}),
  review: o.review ?? { calls: 1, prepared: 1, reused: 1, aborted: 0 },
  ...(o.devices === null ? {} : { devices: o.devices ?? devices() }),
})

/** 장치 지표(relay3-devices.mjs deviceMetrics의 모양) */
const devices = (o = {}) => ({
  modern: true,
  exports: 1,
  units: 0,
  delivery: null,
  missingExports: 0,
  end: { how: 'once', presses: 1, ready: 1, armed: 0, boxes: 0, cancelled: 0, moved: 0 },
  feedback: {
    rounds: 1,
    factRounds: 1,
    findingRounds: 0,
    facts: 2,
    findings: 0,
    passed: 0,
    outcomes: {
      relay: {
        facts: { fixed: 1, kept: 1, unknown: 0 },
        findings: { fixed: 0, kept: 0, unknown: 0 },
        harmful: 0,
      },
      human: {
        facts: { fixed: 0, kept: 0, unknown: 0 },
        findings: { fixed: 0, kept: 0, unknown: 0 },
        harmful: 0,
      },
    },
  },
  probe: { calls: 1, ran: 1, rejected: 0, problems: 0, ms: [30_000] },
  examples: { bundles: 1, absent: 0, differs: 0, unreadable: 0, facts: 0, final: ['same'] },
  raises: {
    exports: [
      {
        unit: null,
        reviewed: true,
        raised: 0,
        notes: 1,
        requestGap: 0,
        byKind: {},
        bySeverity: {},
      },
    ],
    requestGapBundles: 0,
  },
  ...o,
})

/** 실행 하나(run.json에 arm을 붙인 모양, loadM2Runs) */
const runOf = (o = {}) => ({
  scenario: o.scenario ?? H1,
  kind: o.arm ?? M21,
  arm: o.arm ?? M21,
  index: o.index ?? 1,
  ending: o.ending ?? 'done',
  wallMs: 300_000,
  prepareMs: 10_000,
  outcome: { success: 'success' in o ? o.success : true, checks: [], ...(o.outcome ?? {}) },
  human: { turns: o.turns ?? 10, ms: 50_000 },
  agent: {
    input: 1000,
    output: 10,
    cacheRead: o.cacheRead ?? 9000,
    cacheWrite: 0,
    sessions: 1,
    review: { input: 10, cacheRead: 990, cacheWrite: 0 },
  },
  ...(o.tests !== undefined ? { tests: o.tests } : {}),
  works: o.works ?? [work(o.work)],
  options: { qualityOverlay: { path: '.relay/quality.json', sha256: 'x' } },
})

describe('읽기 규칙 (14절)', () => {
  it('P1 m21 − m2p: 아래 끝이 −10%p보다 위면 낮지 않음, 위 끝이 −10%p보다 아래면 낮음, 그 밖은 모름', () => {
    expect(p1Reading({ lo: -0.09, hi: 0.2 })).toBe('낮지 않음')
    expect(p1Reading({ lo: -0.4, hi: -0.11 })).toBe('낮음')
    expect(p1Reading({ lo: -0.3, hi: 0.05 })).toBe('모름')
    // 경계: 아래 끝이 꼭 −10%p면 '위'가 아니다
    expect(p1Reading({ lo: -0.1, hi: 0.1 })).toBe('모름')
    expect(p1Reading(null)).toBeNull()
  })

  it('P3 마찰 m21 − m2p: 구간의 위 끝이 −2보다 아래일 때만 줄었음', () => {
    expect(frictionReading({ lo: -6, hi: -2.1 })).toBe('줄었음')
    expect(frictionReading({ lo: -6, hi: -2 })).toBe('줄었음 아님')
    expect(frictionReading({ lo: -6, hi: -1 })).toBe('줄었음 아님')
    expect(frictionReading(null)).toBeNull()
  })
})

describe('판정 규칙 (14절)', () => {
  const c = (diff, lo, hi, delta) => ({ diff, lo, hi, reading: equivalence({ lo, hi }, delta) })
  const table = (entries) => (a, b, key) => entries[`${a}|${b}|${key}`] ?? null
  const none = { runs: 0, judged: 0, auto: 0, wrong: [], partial: [] }

  it('규칙 1: P1이 낮음이면 V24, V25, V23, V26 차례로 하나씩 되돌리고, 모름이면 그대로 둔다', () => {
    const v = (p1) => m21Verdicts(table({ [`${M21}|${M2P}|P1`]: p1 }), { falseAuto: none }).P1
    expect(v(c(-0.3, -0.4, -0.2))).toMatch(/^낮음.*V24, V25, V23, V26/)
    expect(v(c(-0.1, -0.3, 0.05))).toMatch(/^모름.*그대로/)
    expect(v(c(0, -0.05, 0.1))).toMatch(/^낮지 않음/)
    expect(v(null)).toBe('자료 없음')
  })

  it('규칙 2: P3 마찰이 줄었음이 아니면 장치별 지표로 보고하고 끄는 조건대로 처리한다', () => {
    const v = (p3) => m21Verdicts(table({ [`${M21}|${M2P}|P3`]: p3 }), { falseAuto: none }).P3
    expect(v(c(-4, -6, -2.5, 2))).toMatch(/^줄었음/)
    expect(v(c(-3, -6, -1, 2))).toMatch(/^줄었음이 아님.*끄는 조건/)
  })

  it('P3 막대: m21 − relay@auto에 M2 Q2 규칙(δ 2)을 쓰고 M3로 갈지는 사용자와 정한다', () => {
    const v = (p1, p3) =>
      m21Verdicts(table({ [`${M21}|${AUTO}|P1`]: p1, [`${M21}|${AUTO}|P3`]: p3 }), {
        falseAuto: none,
      }).bar
    const same = c(0, -0.05, 0.05, 0.1)
    expect(v(same, c(1, -1, 1.5, 2))).toMatch(/^P3 같음\(δ 2\).*M3로 간다.*사용자와 정한다/)
    expect(v(same, c(4, 2.5, 6, 2))).toMatch(/^P3 다름.*정하지 않음/)
    expect(v(c(-0.3, -0.4, -0.2, 0.1), c(1, -1, 1.5, 2))).toMatch(/가지 않고/)
    expect(v(same, null)).toBe('자료 없음')
  })

  it('규칙 3: 거짓 자동이 났고 그 실행에 request_gap이 없었으면 V30 끄는 조건에 넣고 사용자에게 올린다', () => {
    const fa = (wrong) => ({ runs: 5, judged: 5, auto: wrong.length, wrong, partial: [] })
    const v = (wrong) => m21Verdicts(table({}), { falseAuto: fa(wrong) }).falseAuto
    expect(v([])).toBe('거짓 자동 0(목표)')
    expect(v([{ scenario: H3, index: 2, requestGap: false, conditions: ['small'] }])).toMatch(
      /거짓 자동 1회\(09-stock-negative#2\).*request_gap이 없던 실행 1회.*V30.*사용자에게 올린다/,
    )
    expect(v([{ scenario: H3, index: 2, requestGap: true, conditions: ['small'] }])).toMatch(
      /목표 0을 채우지 못했다/,
    )
    expect(m21Verdicts(table({}), { falseAuto: none }).falseAuto).toBe('자료 없음')
  })

  it('규칙 4: P5가 m2p보다 20% 넘게 늘고 P3 마찰이 줄지 않았을 때만 미리 리뷰 상한을 1로 내린다', () => {
    const v = (p5, p3) =>
      m21Verdicts(table({ [`${M21}|${M2P}|P5`]: p5, [`${M21}|${M2P}|P3`]: p3 }), {
        falseAuto: none,
        p5Base: 1000,
      }).P5
    const flat = c(-1, -3, 1, 2)
    expect(v(c(300, 100, 500), flat)).toMatch(/^P5 \+30%.*상한을 1로/)
    expect(v(c(300, 100, 500), c(-4, -6, -2.5, 2))).toMatch(/그대로/)
    expect(v(c(150, 0, 300), flat)).toMatch(/^P5 \+15%.*그대로/)
    expect(m21Verdicts(table({}), { falseAuto: none, p5Base: 1000 }).P5).toBe('자료 없음')
  })

  it('G1: Q4 규칙(자동 조건을 채운 실행 10회 이상, 95%)', () => {
    const q4 = (shadow) => m21Verdicts(table({}), { falseAuto: none, shadow }).Q4
    expect(q4({ auto: 4, g1: 1, wrongConditions: [] })).toMatch(/^모름/)
    expect(q4({ auto: 12, g1: 1, wrongConditions: [] })).toMatch(/그대로/)
    expect(q4({ auto: 12, g1: 0.9, wrongConditions: ['small'] })).toMatch(/빡빡하게.*small/)
  })
})

describe('거짓 자동과 request_gap', () => {
  it('실행의 내보내기가 모두 자동 조건을 채웠는데 숨긴 시험이 실패하면 거짓 자동이다. 하나만 채운 것은 참고로 따로 센다', () => {
    const fa = falseAutos([
      runOf({ success: false, work: { gates: [AUTOG, AUTOG] } }),
      runOf({ index: 2, success: false, work: { gates: [AUTOG, gate()] } }),
      runOf({ index: 3, success: true, work: { gate: AUTOG } }),
      runOf({ index: 4, success: false, work: { gate: gate() } }),
      runOf({ index: 5, success: null, work: { gate: AUTOG } }),
    ])
    expect(fa).toMatchObject({ runs: 5, judged: 4, auto: 2 })
    expect(fa.wrong).toEqual([{ scenario: H1, index: 1, requestGap: false, conditions: ['small'] }])
    expect(fa.partial.map((x) => x.index)).toEqual([2])
  })

  it('request_gap은 마지막 묶음이 아니어도 실행의 어느 리뷰에서든 센다', () => {
    const gapLater = devices({
      raises: {
        exports: [
          { reviewed: true, raised: 1, notes: 0, requestGap: 1, byKind: {}, bySeverity: {} },
        ],
        requestGapBundles: 1,
      },
    })
    const gapEarlier = devices({ raises: { exports: [], requestGapBundles: 2 } })
    expect(hadRequestGap(runOf({ work: { devices: gapLater } }))).toBe(true)
    expect(hadRequestGap(runOf({ work: { devices: gapEarlier } }))).toBe(true)
    expect(hadRequestGap(runOf({}))).toBe(false)
    expect(hadRequestGap(runOf({ work: { devices: null } }))).toBe(false)
  })
})

describe('보고서', () => {
  /** 봉인 셋 셋 × 쪽 셋 × 3회와 설계 셋 하나(14, m21만) */
  function batch({ m21Turns = 10, m2pTurns = 16, autoTurns = 9, h2 = H2 } = {}) {
    const runs = []
    for (const scenario of sealedOf(h2))
      for (let i = 1; i <= 3; i++) {
        runs.push(runOf({ scenario, index: i, arm: M21, turns: m21Turns + i, cacheRead: 9000 }))
        runs.push(runOf({ scenario, index: i, arm: M2P, turns: m2pTurns + i, cacheRead: 9000 }))
        runs.push(
          runOf({
            scenario,
            index: i,
            arm: AUTO,
            turns: autoTurns + i,
            works: [],
            cacheRead: 9000,
          }),
        )
      }
    // 설계 셋: 차례가 아주 많아도 결론에 들지 않는다. 거짓 자동은 14에서도 센다
    for (let i = 1; i <= 3; i++)
      runs.push(
        runOf({
          scenario: '14-double-notify',
          index: i,
          arm: M21,
          turns: 80,
          success: false,
          work: { gate: AUTOG },
        }),
      )
    return runs
  }

  it('결론(주지표와 판정)은 봉인 셋에서만 내고 설계 셋은 쪽마다 평균에만 보인다', () => {
    const r = m21Report(batch())
    // 봉인 셋에서 m21이 m2p보다 6 적다: 줄었음. 설계 셋 14의 80차례는 넣지 않는다
    expect(r.comparisons[`${M21}|${M2P}|P3`]).toMatchObject({ diff: -6, scenarios: 3 })
    expect(r.verdicts.P3).toMatch(/^줄었음/)
    expect(r.verdicts.P1).toMatch(/^낮지 않음/)
    expect(r.text).toContain('| P3 사람 차례 | 14-double-notify | 설계(기제만) | 80.00 (3) |')
    expect(r.text).toContain(`- 봉인 셋(결론): ${H1}, ${H2}, ${H3}`)
    // 14의 거짓 자동 셋(request_gap 없음)은 규칙 3에 걸린다
    expect(r.falseAuto.wrong.map((x) => `${x.scenario}#${x.index}`)).toEqual([
      '14-double-notify#1',
      '14-double-notify#2',
      '14-double-notify#3',
    ])
    expect(r.verdicts.falseAuto).toMatch(/^거짓 자동 3회.*V30/)
    // G1(온라인)은 m21 모든 실행: 자동 조건 3회, 모두 실패
    expect(r.shadow).toMatchObject({ auto: 3, g1Pass: 0 })
    expect(r.verdicts.Q4).toMatch(/^모름/)
    expect(r.text).toContain('## 장치 지표')
    expect(r.text).toContain(`| 지표 | ${M21} · 봉인 | ${M21} · 설계(기제만) | ${M2P} · 봉인 |`)
  })

  it('P3 마찰이 2보다 덜 줄면 줄었음이 아니고, P3 막대는 relay@auto와 δ 2로 읽는다', () => {
    const r = m21Report(batch({ m21Turns: 15, m2pTurns: 16, autoTurns: 14 }))
    expect(r.comparisons[`${M21}|${M2P}|P3`].diff).toBe(-1)
    expect(r.verdicts.P3).toMatch(/^줄었음이 아님/)
    expect(r.comparisons[`${M21}|${AUTO}|P3`].diff).toBe(1)
    expect(r.verdicts.bar).toMatch(/^P3 같음/)
  })

  it('H2의 id를 바꿔 줄 수 있다', () => {
    const r = m21Report(batch({ h2: '48-new-h2' }), { h2: '48-new-h2' })
    expect(r.comparisons[`${M21}|${M2P}|P3`].scenarios).toBe(3)
    expect(r.text).toContain(`${H1}, 48-new-h2, ${H3}`)
    expect(falseAutoScenariosOf('48-new-h2')).toEqual(['14-double-notify', '48-new-h2', H3])
    // 바꾸지 않으면 그 시나리오는 봉인 셋이 아니다: 두 시나리오로만 견준다
    expect(m21Report(batch({ h2: '48-new-h2' })).comparisons[`${M21}|${M2P}|P3`].scenarios).toBe(2)
  })

  it('도구 문제로 끝난 실행은 빼고, P5 바탕은 두 쪽이 모두 돈 시나리오의 m2p 평균이다', () => {
    const runs = [
      runOf({ arm: M2P, cacheRead: 9000 }),
      runOf({ arm: M21, cacheRead: 11_000 }),
      runOf({ scenario: H3, arm: M2P, cacheRead: 19_000 }),
    ]
    expect(p5Base(runs)).toBe(10)
    const r = m21Report([...runs, runOf({ arm: M21, ending: 'harness_error', turns: 99 })])
    expect(r.text).toMatch(/도구 문제로 뺀 실행 1개/)
    expect(r.verdicts.P5).toMatch(/^P5 \+20%.*그대로/)
  })

  it('설계 셋 상수와 봉인 셋', () => {
    expect(DESIGN).toEqual([
      '07-two-bugs',
      '14-double-notify',
      '19-split-report',
      '40-three-libraries',
    ])
    expect(sealedOf()).toEqual([H1, H2, H3])
  })
})

describe('장치 지표 표', () => {
  it('실행 묶음마다 Work·내보내기, 끝낸 방식, 누를 때 리뷰가 끝나 있던 비율, 되먹임, 기준 확인, 올림을 센다', () => {
    const boxed = devices({
      end: { how: 'box', presses: 2, ready: 0, armed: 2, boxes: 1, cancelled: 1, moved: 0 },
      feedback: {
        rounds: 2,
        factRounds: 1,
        findingRounds: 1,
        facts: 1,
        findings: 2,
        passed: 1,
        held: { human_input: 1 },
      },
      probe: { calls: 2, ran: 1, rejected: 1, problems: 1, ms: [90_000] },
      examples: { bundles: 2, absent: 1, differs: 0, unreadable: 0, facts: 1, final: ['same'] },
      raises: {
        exports: [
          {
            unit: null,
            reviewed: true,
            raised: 2,
            notes: 0,
            requestGap: 1,
            byKind: { request_gap: 1, out_of_contract: 1 },
            bySeverity: { low: 2 },
          },
        ],
        requestGapBundles: 1,
      },
    })
    const rows = Object.fromEntries(
      deviceRows([
        runOf({ outcome: { unmeasuredBranches: ['side'] } }),
        runOf({ index: 2, work: { devices: boxed }, outcome: { unmeasuredBranches: [] } }),
      ]),
    )
    expect(rows['Work 수/회']).toBe('1.00')
    expect(rows['끝낸 방식, Work (V25)']).toBe('상자 1, 한 번 1')
    expect(rows['[끝내기] 누름/회']).toBe('1.50')
    expect(rows['누를 때 리뷰·증거가 끝나 있던 비율 (V23)']).toBe('33% (1/3)')
    expect(rows['되먹임을 보내지 않은 까닭 (합)']).toBe('human_input 1')
    expect(rows['되먹임으로 보낸 사실 · 지적 (합)']).toBe('3 · 2')
    expect(rows['기준 확인이 돈 제출 (V28)']).toBe('67% (2/3)')
    expect(rows['기준 확인 시간 중앙값(초)']).toBe('60.0')
    expect(rows['예시 자료 사실이 난 Work (V27: 없음·다름·읽지 못함)']).toMatch(/^50% \(1\/2\)/)
    expect(rows['갈래별 올림 (합)']).toBe('out_of_contract 1, request_gap 1')
    expect(rows['request_gap을 올린 실행 (V30)']).toBe('50% (1/2)')
    expect(rows['미리 리뷰 · 다시 쓴 리뷰 · 멈춘 리뷰 /Work (V23)']).toBe('1.00 · 1.00 · 0.00')
    expect(rows['재지 않은 브랜치/회 (V21)']).toBe('0.50')
    // 되먹임 결과: 첫 실행의 두 사실 가운데 하나가 고쳐짐. 둘째 실행은 결과 칸이 없다
    expect(rows['보낸 사실이 고쳐짐 (relay: 결정론 · 리뷰, 다음 head를 모르는 것)']).toBe(
      '50% (1/2) · -, 모름 0',
    )
  })

  it('옛 기록(M2, relay3-m2p)은 M2.1에만 있는 장치의 칸이 비고 올림·메모만 센다', () => {
    const legacy = devices({ modern: false })
    const rows = Object.fromEntries(deviceRows([runOf({ arm: M2P, work: { devices: legacy } })]))
    expect(rows['끝낸 방식, Work (V25)']).toBe('-')
    expect(rows['[끝내기] 누름/회']).toBe('-')
    expect(rows['기준 확인이 돈 제출 (V28)']).toBe('-')
    expect(rows['올림 · 메모 /리뷰한 내보내기 (V26)']).toBe('0.00 · 1.00 (내보내기 1)')
  })

  it('실행의 끝낸 방식은 Work 가운데 상자, 걸림, 한 번 차례로 본다', () => {
    const w = (how) => work({ devices: devices({ end: { how } }) })
    expect(runHow(runOf({ works: [w('once'), w('box')] }))).toBe('box')
    expect(runHow(runOf({ works: [w('once'), w('armed')] }))).toBe('armed')
    expect(runHow(runOf({ works: [w('once')] }))).toBe('once')
    expect(runHow(runOf({ works: [w(null)] }))).toBeNull()
  })

  it('최소 n이 차지 않은 장치는 모름이다(판정 규칙 5)', () => {
    const cmp = () => null
    const rows = minNRows([runOf({}), runOf({ index: 2 })], cmp)
    const byDevice = Object.fromEntries(rows.map((r) => [r[0], r]))
    expect(byDevice['V25 한 번 끝'].slice(2, 5)).toEqual(['2', '30', '모름(n 모자람)'])
    expect(byDevice['V24 되먹임(결정론)'][2]).toBe('4')
    const many = Array.from({ length: 30 }, (_, i) => runOf({ index: i + 1 }))
    const full = Object.fromEntries(minNRows(many, cmp).map((r) => [r[0], r]))
    expect(full['V25 한 번 끝'][4]).toBe('찼음')
    expect(full['V28 제출 때 기준 확인'][4]).toBe('찼음')
    expect(full['V29 계약이 요청을 설명'][4]).toBe('모름(n 모자람)')
  })
})

describe('결과 폴더 읽기', () => {
  it('run.json에 장치 지표가 없으면 남긴 Work 폴더에서 다시 센다', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm21-load-'))
    dirs.push(root)
    const runDir = path.join(root, H1, `${M21}-1`)
    const saved = path.join(runDir, 'works', 'w1')
    fs.mkdirSync(saved, { recursive: true })
    const r = runOf({ work: { devices: null } })
    delete r.arm
    fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(r))
    fs.writeFileSync(path.join(saved, 'work.json'), JSON.stringify({ exports: [{ unit: null }] }))
    fs.writeFileSync(
      path.join(saved, 'events.jsonl'),
      `${JSON.stringify({ type: 'end_armed', head: 'a' })}\n${JSON.stringify({ type: 'ended', how: 'armed', head: 'a' })}\n`,
    )
    const [run] = loadM21Runs([root])
    expect(run.arm).toBe(M21)
    expect(run.works[0].devices).toMatchObject({
      modern: true,
      end: { how: 'armed', presses: 1, ready: 0 },
    })
  })
})
