#!/usr/bin/env node
// relay-v3 M2 평가 규약(relay-v3 docs/experiments/m2/protocol.md 4~5절)의 지표와 판정 규칙. 결과를 보기 전에 정했고
// 배치 중에 바꾸지 않는다. 결과 폴더(여럿: 보통 배치와 --human-mode hands-off 배치)의 run.json과 짝 판정을 모아
// 쪽마다(hands-off 실행은 <쪽>-handsoff) 시나리오 평균을 내고, 두 쪽의 차이를 시나리오마다 층을 나눈 bootstrap 95%
// 구간(primary.mjs의 compare)으로 보인 뒤 Q1~Q4의 규칙을 적용한다.
//   node eval/m2-primary.mjs <결과 폴더>... [--out 파일.md]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { compare } from './primary.mjs'
import { autoGate, exportGates, loadRuns } from './report.mjs'
import { isMain, readJson } from './lib/util.mjs'
import { armOf } from './lib/works.mjs'

/** 도구 문제로 끝난 실행은 빼고 따로 센다(4절). 시간·차례 제한과 포기는 실패로 센다 */
const TOOL_ERRORS = new Set(['harness_error', 'human_error'])

/**
 * 지표(4절). better는 좋은 방향(-1 낮을수록, +1 높을수록), delta는 동등 한계 δ(5절, P1 10%포인트, P3 사람 차례 2).
 * of(run)이 null이면 그 실행은 그 지표에서 빠진다
 */
export const M2_METRICS = [
  {
    key: 'P1',
    name: 'P1 숨긴 시험 모두 통과(비율)',
    better: 1,
    delta: 0.1,
    // 숨긴 쟁점을 판정하지 못한 실행(success null)은 뺀다
    of: (r) => (typeof r.outcome?.success === 'boolean' ? (r.outcome.success ? 1 : 0) : null),
  },
  {
    key: 'P2',
    name: 'P2 판정 tests(1~5)',
    better: 1,
    delta: null,
    of: (r) => (typeof r.tests === 'number' ? r.tests : null),
  },
  {
    key: 'P3',
    name: 'P3 사람 차례',
    better: -1,
    delta: 2,
    of: (r) => (typeof r.human?.turns === 'number' ? r.human.turns : null),
  },
  {
    key: 'P4',
    name: 'P4 걸린 시간 − 도구 준비 − 사람 역할 응답(분)',
    better: -1,
    delta: null,
    of: (r) =>
      typeof r.wallMs === 'number'
        ? (r.wallMs - (r.prepareMs ?? 0) - (r.human?.ms ?? 0)) / 60000
        : null,
  },
  {
    key: 'P5',
    name: 'P5 에이전트 입력 토큰(천, 캐시 포함, 앱이 부른 claude -p 포함)',
    better: -1,
    delta: null,
    of: (r) => (r.agent ? (r.agent.input + r.agent.cacheRead + r.agent.cacheWrite) / 1000 : null),
  },
]

/** 견주는 짝(1절). [a, b]는 a − b다 */
export const M2_PAIRS = [
  { q: 'Q1', a: 'relay3', b: 'relay3-noreview' },
  { q: 'Q2', a: 'relay3', b: 'relay@auto' },
  { q: 'Q2', a: 'relay3', b: 'cli' },
  { q: 'Q3', a: 'relay3', b: 'relay3-handsoff' },
  { q: 'Q3', a: 'cli', b: 'cli-handsoff' },
]

/**
 * 동등 판정(5절): 차이의 95% 구간이 ±δ 안이면 '같음', 구간 전체가 δ 밖이면 '다름', 걸치면 '모름'. δ가 없는 지표는 구간이
 * 0을 넘는지만 본다
 */
export function equivalence(c, delta) {
  if (!c) return null
  if (delta === null || delta === undefined)
    return c.lo > 0 ? '0보다 큼' : c.hi < 0 ? '0보다 작음' : '0을 걸침'
  if (c.lo >= -delta && c.hi <= delta) return '같음'
  if (c.lo > delta || c.hi < -delta) return '다름'
  return '모름'
}

/**
 * 결과 폴더 하나의 실행에 짝 판정의 tests 점수(P2)를 붙인다. 한 실행이 여러 짝(예: relay3:cli, relay3-noreview:cli의 cli)에
 * 들었으면 평균이다. 판정은 그 결과 폴더 안의 것만 본다(같은 회차 번호가 다른 폴더에도 있다)
 */
export function withTests(runs, judges) {
  return runs.map((r) => {
    const scores = judges
      .filter((j) => j.scenario === r.scenario && j.index === r.index && j.pair?.includes(r.kind))
      .map((j) => j.outcome?.[r.kind]?.tests)
      .filter((x) => typeof x === 'number')
    return scores.length ? { ...r, tests: scores.reduce((a, b) => a + b, 0) / scores.length } : r
  })
}

/** 결과 폴더의 짝 판정들(<시나리오>/judge-*.json) */
function loadJudges(dir) {
  const out = []
  for (const s of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!s.isDirectory()) continue
    for (const f of fs.readdirSync(path.join(dir, s.name)))
      if (/^judge-(.+-)?\d+\.json$/.test(f)) out.push(readJson(path.join(dir, s.name, f)))
  }
  return out
}

/** 여러 결과 폴더의 실행: 쪽 이름(arm)을 붙이고(armOf), P2 점수를 붙인다 */
export function loadM2Runs(dirs) {
  return dirs.flatMap((d) => {
    const dir = path.resolve(d)
    return withTests(loadRuns(dir), loadJudges(dir)).map((r) => ({ ...r, arm: armOf(r) }))
  })
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** 두 쪽의 한 지표 차이(a − b): 시나리오마다 층을 나눈 bootstrap 95% 구간과 동등 판정 */
export function m2Compare(runs, a, b, metric) {
  const ids = [...new Set(runs.map((r) => r.scenario))].sort()
  const vals = (arm, id) =>
    runs
      .filter((r) => r.arm === arm && r.scenario === id)
      .map((r) => metric.of(r))
      .filter((v) => v !== null && v !== undefined)
  const c = compare(ids.map((id) => ({ id, a: vals(a, id), b: vals(b, id) })))
  return c ? { ...c, reading: equivalence(c, metric.delta) } : null
}

/**
 * relay3 실행의 그림자 정밀도(Q4, 4절 G1·G2). 내보내기(리뷰 포함) 결론이 있고 숨긴 시험을 판정한 실행만 센다
 * (report.mjs exportGates). 자동 조건을 채운 실행 가운데 숨긴 시험 모두 통과가 G1, 통과 가운데 자동 조건이 G2다
 */
export function shadowPrecision(runs) {
  const judged = runs.filter((r) => typeof r.outcome?.success === 'boolean')
  const exported = judged.filter((r) => exportGates(r).length > 0)
  const auto = exported.filter(autoGate)
  const pass = exported.filter((r) => r.outcome.success)
  const autoPass = auto.filter((r) => r.outcome.success)
  // 틀린 실행(자동 조건을 채웠는데 숨긴 시험 실패)의 조건 이름: 어느 조건이 느슨한지
  const wrong = auto
    .filter((r) => !r.outcome.success)
    .flatMap((r) => exportGates(r).map((g) => g.condition ?? '?'))
  return {
    runs: runs.length,
    judged: judged.length,
    exported: exported.length,
    auto: auto.length,
    g1: auto.length ? autoPass.length / auto.length : null,
    g1Pass: autoPass.length,
    g2: pass.length ? pass.filter(autoGate).length / pass.length : null,
    pass: pass.length,
    wrongConditions: [...new Set(wrong)],
  }
}

/**
 * 판정 규칙(5절)을 적용한다. cmp(a, b, key)는 a − b의 m2Compare 결과(없으면 null), g는 relay3의 shadowPrecision이다.
 * 규칙이 정하지 않은 경우는 그렇다고 적는다(사람이 본다)
 */
export function verdicts(cmp, g) {
  const out = {}
  // Q1 (리뷰): relay3 − relay3-noreview의 P1과 P2
  {
    const p1 = cmp('relay3', 'relay3-noreview', 'P1')
    const p2 = cmp('relay3', 'relay3-noreview', 'P2')
    if (!p1) out.Q1 = '자료 없음'
    else if ((p1.reading === '다름' && p1.diff > 0) || (p2 && p2.lo > 0))
      out.Q1 = '늘 돎을 유지한다(리뷰 쪽이 P1에서 다름(높음)이거나 P2 구간이 0보다 큼)'
    else if (p1.reading === '모름')
      out.Q1 = '모름: 늘 돎을 유지하고 등록부에 모름으로 적는다(M3에서 n을 늘린다)'
    else if (p1.reading === '같음' && !p2)
      out.Q1 = '정하지 못함: P1은 같음이지만 P2(짝 판정의 tests)가 없다'
    else if (p1.reading === '같음')
      out.Q1 = "독립 리뷰를 '표본 리뷰'로 줄인다. 자동 머지 경로에서는 그대로 늘 돈다(V4)"
    else out.Q1 = '규칙 밖: 리뷰 쪽의 P1이 다름(낮음). 사람이 본다'
  }
  // Q2 (방향): relay3 − relay@auto의 P1, P3
  {
    const p1 = cmp('relay3', 'relay@auto', 'P1')
    const p3 = cmp('relay3', 'relay@auto', 'P3')
    if (!p1) out.Q2 = '자료 없음'
    else if (p1.reading === '다름' && p1.diff < 0)
      out.Q2 = 'M3로 가지 않고 원인을 찾는다(relay3이 relay@auto보다 P1에서 다름(낮음))'
    else if (p1.reading === '모름') out.Q2 = '모름: P1 구간이 δ에 걸친다(규칙이 정하지 않음)'
    else if (p3 && p3.reading === '다름' && p3.diff > 0)
      out.Q2 =
        '규칙이 정하지 않음: P1은 같음이나 높음이지만 P3(사람 차례)이 relay@auto보다 다름(높음)'
    else if (!p3) out.Q2 = '정하지 못함: P3 자료가 없다'
    else out.Q2 = 'M3로 간다(P1이 같음이나 높음이고 P3이 다름(높음)이 아님)'
  }
  // Q3 (사람 손): relay3 − relay3-handsoff의 P1. cli − cli-handsoff는 보고만 한다
  {
    const p1 = cmp('relay3', 'relay3-handsoff', 'P1')
    if (!p1) out.Q3 = '자료 없음'
    else if (p1.reading === '다름' && p1.diff > 0)
      out.Q3 = '사람의 사후 교정 몫이 크다. 이 모델에서는 자율 단계 2(계약만 사람)를 열지 않는다'
    else if (p1.reading === '같음')
      out.Q3 = '단계 2를 열 근거 하나. 열지는 그림자 실적과 함께 사람이 정한다'
    else if (p1.reading === '모름') out.Q3 = '모름'
    else out.Q3 = '규칙 밖: 손 뗀 쪽의 P1이 다름(높음). 사람이 본다'
  }
  // Q4 (관문): G1이 95% 이상이고 자동 조건을 채운 실행이 10개 이상
  if (!g || g.auto < 10) out.Q4 = `모름: 자동 조건을 채운 실행이 ${g?.auto ?? 0}개(10개 아래)`
  else if (g.g1 >= 0.95) out.Q4 = '자동 머지 단계 1의 조건을 그대로 둔다(G1 95% 이상)'
  else
    out.Q4 = `조건을 빡빡하게 고친 뒤 다시 잰다(G1 95% 아래). 틀린 실행의 조건: ${g.wrongConditions.join(', ') || '-'}`
  return out
}

const f = (x, d = 2) => (x === null || x === undefined ? '-' : Number(x).toFixed(d))
const pctText = (a, n) => (n ? `${Math.round((100 * a) / n)}% (${a}/${n})` : '-')
const table = (head, rows) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')

/** 보고서. runs는 loadM2Runs의 결과다 */
export function m2Report(runs, dirs = []) {
  const excluded = runs.filter((r) => TOOL_ERRORS.has(r.ending))
  const ok = runs.filter((r) => !excluded.includes(r))
  const ORDER = [
    'relay3',
    'relay3-noreview',
    'relay@auto',
    'cli',
    'relay3-handsoff',
    'cli-handsoff',
  ]
  const arms = [
    ...ORDER.filter((a) => ok.some((r) => r.arm === a)),
    ...[...new Set(ok.map((r) => r.arm))].filter((a) => !ORDER.includes(a)).sort(),
  ]
  const ids = [...new Set(ok.map((r) => r.scenario))].sort()
  const lines = [
    '# M2 평가 주지표 (relay-v3 docs/experiments/m2/protocol.md 4~5절)',
    '',
    ...(dirs.length ? [`- 결과 폴더: ${dirs.map((d) => `\`${d}\``).join(', ')}`] : []),
    `- 실행 ${runs.length}개, 도구 문제로 뺀 실행 ${excluded.length}개${excluded.length ? ` (${excluded.map((r) => `${r.scenario} ${r.arm}#${r.index} ${r.ending}`).join(', ')})` : ''}`,
    `- 숨긴 시험을 판정하지 못한 실행(P1에서 뺌): ${ok.filter((r) => typeof r.outcome?.success !== 'boolean').length}개`,
    '- 구간은 시나리오마다 층을 나눈 bootstrap 95%(10,000번, 씨앗 고정). 동등 한계 δ: P1 10%포인트, P3 사람 차례 2',
    '- P4는 도구 준비(prepareMs)와 사람 역할 응답을 뺀 시간이다. P5는 앱이 따로 부른 claude -p(relay-v3 독립 리뷰, relay 독립 리뷰·지식 검토)를 넣는다',
    '',
    '## 쪽마다 평균 (시나리오별, 괄호는 n)',
    '',
  ]
  const rows = []
  for (const m of M2_METRICS)
    for (const id of ids) {
      const cells = arms.map((a) => {
        const v = ok
          .filter((r) => r.arm === a && r.scenario === id)
          .map((r) => m.of(r))
          .filter((x) => x !== null && x !== undefined)
        return v.length ? `${f(mean(v))} (${v.length})` : '-'
      })
      if (cells.some((c) => c !== '-')) rows.push([m.name, id, ...cells])
    }
  lines.push(table(['지표', '시나리오', ...arms], rows), '')

  const results = new Map()
  const cmp = (a, b, key) => {
    const k = `${a}|${b}|${key}`
    if (!results.has(k)) {
      const m = M2_METRICS.find((x) => x.key === key)
      results.set(k, m2Compare(ok, a, b, m))
    }
    return results.get(k)
  }
  lines.push('## 차이 (a − b)', '')
  const crows = []
  for (const p of M2_PAIRS)
    for (const m of M2_METRICS) {
      const c = cmp(p.a, p.b, m.key)
      if (!c) continue
      crows.push([
        p.q,
        `${p.a} − ${p.b}`,
        m.name,
        `${c.scenarios}`,
        f(c.diff),
        `[${f(c.lo)}, ${f(c.hi)}]`,
        c.reading,
      ])
    }
  lines.push(
    crows.length
      ? table(['질문', '짝', '지표', '시나리오 수', '차이', '95% 구간', '읽기'], crows)
      : '(견줄 짝이 없다)',
    '',
  )

  const g = shadowPrecision(ok.filter((r) => r.arm === 'relay3'))
  lines.push(
    '## Q4 관문 (relay3)',
    '',
    table(
      ['지표', '값'],
      [
        ['내보내기 결론이 있는 실행(판정한 실행 가운데)', pctText(g.exported, g.judged)],
        ['자동 조건을 채운 실행', `${g.auto}`],
        ['G1 그 가운데 숨긴 시험 모두 통과', pctText(g.g1Pass, g.auto)],
        ['G2 숨긴 시험 모두 통과 가운데 자동 조건을 채움', g.pass ? `${f(g.g2 * 100, 0)}%` : '-'],
      ],
    ),
    '',
  )

  // 규칙을 읽기 전에 볼 것: hands-off 규칙을 어긴 실행(Q3이 약해진다), 번호 빠진 스크린샷, main을 움직인 실행
  const checks = arms.map((a) => {
    const own = ok.filter((r) => r.arm === a)
    return [
      a,
      `${own.length}`,
      a.endsWith('-handsoff')
        ? pctText(
            own.filter((r) => (r.human?.handsOffViolations?.total ?? 0) > 0).length,
            own.length,
          )
        : '-',
      own.some((r) => r.screenshots)
        ? `${own.reduce((s, r) => s + (r.screenshots?.unmarked ?? 0), 0)}`
        : '-',
      own.some((r) => r.outcome && 'mainMoved' in r.outcome)
        ? `${own.filter((r) => r.outcome?.mainMoved).length}`
        : '-',
    ]
  })
  lines.push(
    '## 실행 점검',
    '',
    table(
      ['쪽', '실행', 'hands-off 규칙 어긴 실행', '번호 빠진 스크린샷', 'main이 움직인 실행'],
      checks,
    ),
    '',
  )

  const v = verdicts(cmp, g)
  lines.push(
    '## 판정 규칙 (5절)',
    '',
    `- Q1 (리뷰): ${v.Q1}`,
    `- Q2 (방향): ${v.Q2}`,
    `- Q3 (사람 손): ${v.Q3}`,
    `- Q4 (관문): ${v.Q4}`,
    '',
  )
  return {
    text: lines.join('\n'),
    verdicts: v,
    shadow: g,
    comparisons: Object.fromEntries(results),
  }
}

if (isMain(import.meta.url)) {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' } },
  })
  if (!positionals.length) {
    console.error('쓰는 법: node eval/m2-primary.mjs <결과 폴더>... [--out 파일.md]')
    process.exit(2)
  }
  const { text } = m2Report(loadM2Runs(positionals), positionals)
  if (v.out) fs.writeFileSync(v.out, text)
  console.log(text)
}
