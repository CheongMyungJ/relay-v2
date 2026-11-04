// relay-v3 M2 평가 규약의 집계(m2-primary.mjs): 쪽 이름(hands-off), 지표 P1~P5, 짝 판정의 tests, 동등 판정, 그림자
// 정밀도, 판정 규칙. 결과를 보기 전에 정한 규칙이 그대로 적용되는지 본다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  equivalence,
  loadM2Runs,
  M2_METRICS,
  m2Report,
  shadowPrecision,
  verdicts,
  withTests,
} from '../m2-primary.mjs'
import { loadRuns } from '../report.mjs'
import { armOf } from '../lib/works.mjs'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

const metric = (key) => M2_METRICS.find((m) => m.key === key)

/** 실행 하나(run.json의 모양). 숨긴 시험, 차례, 시간, 토큰, 관문을 고른다 */
const runOf = (o) => ({
  scenario: o.scenario ?? '10-x',
  kind: o.kind ?? 'relay3',
  index: o.index ?? 1,
  ending: o.ending ?? 'done',
  wallMs: o.wallMs ?? 300_000,
  prepareMs: o.prepareMs ?? 10_000,
  outcome: { success: o.success ?? true, checks: [] },
  human: { turns: o.turns ?? 10, ms: o.humanMs ?? 50_000 },
  agent: { input: 1000, output: 10, cacheRead: o.cacheRead ?? 9000, cacheWrite: 0, sessions: 1 },
  works: o.gate ? [{ gate: o.gate }] : [],
  options: { humanMode: o.humanMode ?? 'normal' },
})

describe('쪽 이름', () => {
  it('hands-off 실행은 <쪽>-handsoff다. 예전 실행은 결과 폴더의 config.json을 본다', () => {
    expect(armOf({ kind: 'relay3', options: { humanMode: 'hands-off' } })).toBe('relay3-handsoff')
    expect(armOf({ kind: 'cli', options: { humanMode: 'normal' } })).toBe('cli')
    expect(armOf({ kind: 'cli', humanMode: 'hands-off' })).toBe('cli-handsoff')
    expect(armOf({ kind: 'relay@auto' })).toBe('relay@auto')

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2-old-'))
    dirs.push(root)
    fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ humanMode: 'hands-off' }))
    fs.mkdirSync(path.join(root, '10-x', 'cli-1'), { recursive: true })
    const old = runOf({ kind: 'cli' })
    delete old.options
    fs.writeFileSync(path.join(root, '10-x', 'cli-1', 'run.json'), JSON.stringify(old))
    const [r] = loadRuns(root)
    expect(r.humanMode).toBe('hands-off')
    expect(armOf(r)).toBe('cli-handsoff')
  })
})

describe('지표', () => {
  it('P4는 도구 준비와 사람 역할 응답을 뺀다. P5는 캐시를 넣은 입력 토큰(천)이다', () => {
    const r = runOf({ wallMs: 600_000, prepareMs: 60_000, humanMs: 120_000 })
    expect(metric('P4').of(r)).toBe(7)
    expect(metric('P5').of(r)).toBe(10)
    // 예전 결과(prepareMs 없음)는 준비를 넣은 채다
    expect(metric('P4').of({ ...r, prepareMs: undefined })).toBe(8)
  })

  it('P1은 판정 못 한 실행(success null)을 뺀다', () => {
    expect(metric('P1').of(runOf({ success: true }))).toBe(1)
    expect(metric('P1').of(runOf({ success: false }))).toBe(0)
    expect(metric('P1').of({ ...runOf({}), outcome: { success: null } })).toBeNull()
  })

  it('P2는 그 실행이 든 짝 판정들의 tests 평균이다(같은 결과 폴더, 같은 시나리오·회차)', () => {
    const runs = [
      runOf({ kind: 'relay3' }),
      runOf({ kind: 'cli' }),
      runOf({ kind: 'relay3-noreview' }),
    ]
    const judge = (a, b, ta, tb, index = 1) => ({
      scenario: '10-x',
      index,
      pair: [a, b],
      outcome: { [a]: { tests: ta }, [b]: { tests: tb } },
    })
    const out = withTests(runs, [
      judge('relay3', 'cli', 4, 2),
      judge('relay3-noreview', 'cli', 3, 3),
      judge('relay3', 'cli', 1, 1, 2),
    ])
    expect(out.map((r) => r.tests)).toEqual([4, 2.5, 3])
    expect(metric('P2').of(out[1])).toBe(2.5)
    expect(metric('P2').of(runOf({}))).toBeNull()
  })
})

describe('동등 판정 (5절)', () => {
  it('구간이 ±δ 안이면 같음, 모두 밖이면 다름, 걸치면 모름', () => {
    expect(equivalence({ lo: -0.1, hi: 0.1 }, 0.1)).toBe('같음')
    expect(equivalence({ lo: 0.11, hi: 0.4 }, 0.1)).toBe('다름')
    expect(equivalence({ lo: -0.5, hi: -0.2 }, 0.1)).toBe('다름')
    expect(equivalence({ lo: 0.05, hi: 0.3 }, 0.1)).toBe('모름')
    expect(equivalence({ lo: -3, hi: 1 }, 2)).toBe('모름')
    expect(equivalence({ lo: 0.1, hi: 2 }, null)).toBe('0보다 큼')
    expect(equivalence({ lo: -1, hi: 2 }, null)).toBe('0을 걸침')
    expect(equivalence(null, 0.1)).toBeNull()
  })
})

describe('판정 규칙', () => {
  const c = (diff, lo, hi, delta) => ({ diff, lo, hi, reading: equivalence({ lo, hi }, delta) })
  const table = (entries) => (a, b, key) => entries[`${a}|${b}|${key}`] ?? null

  it('Q1: P1 같음이고 P2가 0을 넘지 않으면 표본 리뷰로 줄이고, P2가 0보다 크면 유지한다', () => {
    const same = c(0, -0.05, 0.05, 0.1)
    expect(
      verdicts(
        table({
          'relay3|relay3-noreview|P1': same,
          'relay3|relay3-noreview|P2': c(0.1, -0.2, 0.4),
        }),
        null,
      ).Q1,
    ).toMatch(/표본 리뷰/)
    expect(
      verdicts(
        table({
          'relay3|relay3-noreview|P1': same,
          'relay3|relay3-noreview|P2': c(0.5, 0.2, 0.8),
        }),
        null,
      ).Q1,
    ).toMatch(/유지/)
    expect(verdicts(table({ 'relay3|relay3-noreview|P1': same }), null).Q1).toMatch(/P2.*없다/)
    expect(
      verdicts(table({ 'relay3|relay3-noreview|P1': c(0.1, -0.05, 0.25, 0.1) }), null).Q1,
    ).toMatch(/^모름/)
    expect(
      verdicts(table({ 'relay3|relay3-noreview|P1': c(0.3, 0.2, 0.4, 0.1) }), null).Q1,
    ).toMatch(/유지/)
  })

  it('Q2: relay@auto보다 P1이 다름(낮음)이면 M3로 가지 않고, 같음이고 P3이 다름(높음)이 아니면 간다', () => {
    const p3ok = c(1, -1, 1.5, 2)
    expect(
      verdicts(
        table({
          'relay3|relay@auto|P1': c(-0.3, -0.4, -0.2, 0.1),
          'relay3|relay@auto|P3': p3ok,
        }),
        null,
      ).Q2,
    ).toMatch(/가지 않고/)
    expect(
      verdicts(
        table({ 'relay3|relay@auto|P1': c(0, -0.08, 0.08, 0.1), 'relay3|relay@auto|P3': p3ok }),
        null,
      ).Q2,
    ).toMatch(/^M3로 간다/)
    expect(
      verdicts(
        table({
          'relay3|relay@auto|P1': c(0, -0.08, 0.08, 0.1),
          'relay3|relay@auto|P3': c(4, 2.5, 6, 2),
        }),
        null,
      ).Q2,
    ).toMatch(/정하지 않음/)
  })

  it('Q3: 보통 쪽이 다름(높음)이면 단계 2를 열지 않고, 같음이면 근거 하나다', () => {
    expect(
      verdicts(table({ 'relay3|relay3-handsoff|P1': c(0.3, 0.15, 0.45, 0.1) }), null).Q3,
    ).toMatch(/열지 않는다/)
    expect(verdicts(table({ 'relay3|relay3-handsoff|P1': c(0, -0.1, 0.1, 0.1) }), null).Q3).toMatch(
      /근거 하나/,
    )
  })

  it('Q4: 자동 조건을 채운 실행이 10개 아래면 모름, G1 95% 이상이면 조건 유지', () => {
    expect(verdicts(table({}), { auto: 3, g1: 1, wrongConditions: [] }).Q4).toMatch(/^모름/)
    expect(verdicts(table({}), { auto: 20, g1: 0.95, wrongConditions: [] }).Q4).toMatch(/그대로/)
    expect(verdicts(table({}), { auto: 20, g1: 0.9, wrongConditions: ['small'] }).Q4).toMatch(
      /빡빡하게.*small/,
    )
  })
})

describe('그림자 정밀도 (Q4)', () => {
  it('내보내기 결론이 있고 판정한 실행만으로 G1, G2를 센다', () => {
    const shadow = { conclusion: 'human_merge', shadow: true, export: true, condition: 'small' }
    const human = { conclusion: 'human_merge', shadow: false, export: true }
    const g = shadowPrecision([
      runOf({ gate: shadow, success: true }),
      runOf({ gate: shadow, success: false }),
      runOf({ gate: human, success: true }),
      runOf({ gate: { ...shadow, export: false }, success: true }),
      { ...runOf({ gate: shadow }), outcome: { success: null } },
    ])
    expect(g).toMatchObject({
      runs: 5,
      judged: 4,
      exported: 3,
      auto: 2,
      g1: 0.5,
      g1Pass: 1,
      pass: 2,
      g2: 0.5,
      wrongConditions: ['small'],
    })
  })
})

describe('보고서', () => {
  it('보통 배치와 hands-off 배치를 합쳐 읽어 relay3와 relay3-handsoff를 가르고, 도구 문제는 뺀다', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'm2-'))
    dirs.push(root)
    const write = (batch, mode, runs) => {
      const dir = path.join(root, batch)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ humanMode: mode }))
      for (const r of runs) {
        const d = path.join(dir, r.scenario, `${r.kind}-${r.index}`)
        fs.mkdirSync(d, { recursive: true })
        fs.writeFileSync(path.join(d, 'run.json'), JSON.stringify(r))
      }
      return dir
    }
    const normal = []
    const handsOff = []
    for (const scenario of ['10-x', '14-y'])
      for (let index = 1; index <= 3; index++) {
        normal.push(runOf({ scenario, index, kind: 'relay3', success: true }))
        normal.push(runOf({ scenario, index, kind: 'cli', success: index !== 1 }))
        handsOff.push(
          runOf({ scenario, index, kind: 'relay3', success: false, humanMode: 'hands-off' }),
        )
      }
    normal.push(runOf({ scenario: '10-x', index: 4, kind: 'relay3', ending: 'harness_error' }))
    const a = write('a', 'normal', normal)
    const b = write('b', 'hands-off', handsOff)
    const runs = loadM2Runs([a, b])
    expect([...new Set(runs.map((r) => r.arm))].sort()).toEqual([
      'cli',
      'relay3',
      'relay3-handsoff',
    ])
    const { text, verdicts: v, comparisons } = m2Report(runs, [a, b])
    expect(text).toContain('도구 문제로 뺀 실행 1개')
    // relay3는 모두 통과, 손 뗀 쪽은 모두 실패: 차이 1, 구간 [1, 1]이라 다름
    expect(comparisons['relay3|relay3-handsoff|P1']).toMatchObject({
      diff: 1,
      lo: 1,
      hi: 1,
      reading: '다름',
      scenarios: 2,
    })
    expect(v.Q3).toMatch(/열지 않는다/)
    expect(v.Q1).toBe('자료 없음')
    expect(v.Q4).toMatch(/^모름/)
  })
})
