#!/usr/bin/env node
// 지식 실험의 주지표 (docs/knowledge-experiment.md 4절). 실험 전에 정했고 실험 중에 바꾸지 않는다.
// 결과 폴더(여럿 가능)의 run.json에서 재는 Work(시나리오의 measure, 기본은 첫 Work를 뺀 모두)를 실행마다 모아 쪽마다
// 평균을 내고, 두 쪽의 차이를 시나리오마다 층을 나눈 bootstrap 95% 구간으로 보인다.
//   node eval/primary.mjs <결과 폴더>... [--pair relay:relay-off] [--out 파일.md]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { loadRuns, loadScenario } from './report.mjs'
import { measuredWorks } from './lib/works.mjs'

/** 도구 문제로 끝난 실행은 뺀다(따로 센다) */
const TOOL_ERRORS = new Set(['harness_error', 'human_error'])

/**
 * 지표. better는 좋은 방향(-1 낮을수록, +1 높을수록). primary는 판정 규칙(5절)에 쓰는 것이다.
 * of(run, scenario)는 실행 하나의 값이고, null이면 그 실행은 그 지표에서 빠진다
 */
export const METRICS = [
  {
    key: 'retold',
    name: 'PM1 앞 Work의 사실을 다시 알려 준 수 (재는 Work 합, 감사)',
    primary: true,
    better: -1,
    of: (r, sc) => {
      const ws = measured(r, sc)
      if (!ws || !ws.some((w) => w.human?.carriedTotal)) return null
      // 감사(판정 모델이 사람의 말을 읽고 가름)가 없는 Work가 있으면 그 실행은 뺀다
      if (ws.some((w) => w.human?.carriedTotal && typeof w.human?.carriedToldAudit !== 'number'))
        return null
      return sum(ws, (w) => w.human?.carriedToldAudit ?? 0)
    },
  },
  {
    key: 'retoldSelf',
    name: '앞 Work의 사실을 다시 알려 준 수 (사람 역할의 자기 보고)',
    better: -1,
    of: (r, sc) => {
      const ws = measured(r, sc)
      if (!ws || !ws.some((w) => w.human?.carriedTotal)) return null
      return sum(ws, (w) => w.human?.carriedTold ?? 0)
    },
  },
  {
    key: 'success',
    name: 'PM2 재는 Work의 숨긴 시험 모두 통과 (비율)',
    primary: true,
    better: 1,
    of: (r, sc) => {
      const ws = measured(r, sc)
      if (!ws) return null
      return ws.every((w) => w.outcome?.success) ? 1 : 0
    },
  },
  {
    key: 'chars',
    name: '재는 Work의 사람 입력 글자',
    better: -1,
    of: (r, sc) => mSum(r, sc, (w) => w.human?.charsTyped),
  },
  {
    key: 'questions',
    name: '재는 Work의 에이전트 질문 수',
    better: -1,
    of: (r, sc) => mSum(r, sc, (w) => w.agent?.questions),
  },
  {
    key: 'turns',
    name: '재는 Work의 사람 차례',
    better: -1,
    of: (r, sc) => mSum(r, sc, (w) => w.human?.turns),
  },
  {
    key: 'tokens',
    name: '재는 Work의 에이전트 입력 토큰(천, 캐시 포함)',
    better: -1,
    of: (r, sc) =>
      mSum(r, sc, (w) =>
        w.agent ? (w.agent.input + w.agent.cacheRead + w.agent.cacheWrite) / 1000 : null,
      ),
  },
  {
    key: 'agentMin',
    name: '재는 Work의 걸린 시간 − 사람 역할 응답(분)',
    better: -1,
    of: (r, sc) => mSum(r, sc, (w) => (w.wallMs - (w.human?.ms ?? 0)) / 60000),
  },
  {
    key: 'allActions',
    name: '모든 Work의 사람 행동 수(지식을 모으는 수고 포함)',
    better: -1,
    of: (r) => (r.workResults ? sum(r.workResults, (w) => w.human?.actionsTotal ?? 0) : null),
  },
  {
    key: 'allTokens',
    name: '모든 Work의 에이전트 입력 토큰(천, 캐시 포함)',
    better: -1,
    of: (r) => (r.agent ? (r.agent.input + r.agent.cacheRead + r.agent.cacheWrite) / 1000 : null),
  },
  {
    key: 'allSuccess',
    name: '모든 Work의 숨긴 시험 모두 통과 (비율)',
    better: 1,
    of: (r) => (r.workResults ? (r.outcome.success ? 1 : 0) : null),
  },
]

const sum = (xs, fn) => xs.reduce((a, x) => a + (fn(x) ?? 0), 0)

/** 재는 Work의 결과. 재는 Work가 하나라도 없으면(앞에서 멈춤) null이 아니라 빈 결과를 실패로 둔다 */
function measured(r, sc) {
  if (!r.workResults) return null
  const want = measuredWorks(sc)
  return want.map(
    (n) =>
      r.workResults.find((w) => w.work === n + 1) ?? {
        missing: true,
        human: {},
        outcome: { success: false },
      },
  )
}

function mSum(r, sc, fn) {
  const ws = measured(r, sc)
  if (!ws || ws.some((w) => w.missing)) return null
  const vals = ws.map(fn)
  if (vals.some((v) => v === null || v === undefined)) return null
  return vals.reduce((a, b) => a + b, 0)
}

/** 씨앗이 있는 난수(같은 자료면 같은 구간) */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/**
 * 두 쪽의 차이(a − b). 시나리오마다 두 쪽의 평균 차를 구해 시나리오 수로 평균한다(시나리오마다 같은 무게).
 * bootstrap은 시나리오 안에서 쪽마다 실행을 복원 추출한다
 */
export function compare(groups, iters = 10000, seed = 20261002) {
  const usable = groups.filter((g) => g.a.length && g.b.length)
  if (!usable.length) return null
  const point = mean(usable.map((g) => mean(g.a) - mean(g.b)))
  const rand = rng(seed)
  const pick = (xs) => {
    let t = 0
    for (let i = 0; i < xs.length; i++) t += xs[Math.floor(rand() * xs.length)]
    return t / xs.length
  }
  const boots = []
  for (let i = 0; i < iters; i++) boots.push(mean(usable.map((g) => pick(g.a) - pick(g.b))))
  boots.sort((x, y) => x - y)
  return {
    diff: point,
    lo: boots[Math.floor(0.025 * iters)],
    hi: boots[Math.ceil(0.975 * iters) - 1],
    scenarios: usable.length,
  }
}

export function primaryReport(dirs, pair) {
  const runs = dirs.flatMap((d) => loadRuns(path.resolve(d)))
  const scenarios = new Map()
  const sc = (id) => {
    if (!scenarios.has(id)) scenarios.set(id, loadScenario(id))
    return scenarios.get(id)
  }
  const excluded = runs.filter(
    (r) =>
      TOOL_ERRORS.has(r.ending) || (r.workResults ?? []).some((w) => TOOL_ERRORS.has(w.ending)),
  )
  const ok = runs.filter((r) => !excluded.includes(r))
  const ids = [...new Set(ok.map((r) => r.scenario))].sort()
  const kinds = [...new Set(ok.map((r) => r.kind))].sort()
  const [a, b] = pair ?? kinds
  const f = (x, d = 2) => (x === null || x === undefined ? '-' : Number(x).toFixed(d))
  const lines = [
    '# 지식 실험 주지표',
    '',
    `- 결과 폴더: ${dirs.map((d) => `\`${d}\``).join(', ')}`,
    `- 실행 ${runs.length}개, 도구 문제로 뺀 실행 ${excluded.length}개${excluded.length ? ` (${excluded.map((r) => `${r.scenario} ${r.kind}#${r.index}`).join(', ')})` : ''}`,
    `- 견주는 짝: ${a} − ${b}. 구간은 시나리오마다 층을 나눈 bootstrap 95% (10,000번, 씨앗 고정)`,
    '',
  ]
  lines.push('## 쪽마다 평균 (시나리오별 n)', '')
  const head = ['지표', '시나리오', ...kinds.map((k) => `${k} (n)`)]
  const rows = []
  for (const m of METRICS) {
    for (const id of ids) {
      const cells = kinds.map((k) => {
        const vals = ok
          .filter((r) => r.scenario === id && r.kind === k)
          .map((r) => m.of(r, sc(id)))
          .filter((v) => v !== null && v !== undefined)
        return vals.length ? `${f(mean(vals))} (${vals.length})` : '-'
      })
      if (cells.every((c) => c === '-')) continue
      rows.push([m.name, id, ...cells])
    }
  }
  lines.push(table(head, rows), '')
  lines.push(`## 차이: ${a} − ${b}`, '')
  const crows = []
  const result = {}
  for (const m of METRICS) {
    const groups = ids.map((id) => ({
      id,
      a: ok
        .filter((r) => r.scenario === id && r.kind === a)
        .map((r) => m.of(r, sc(id)))
        .filter((v) => v !== null && v !== undefined),
      b: ok
        .filter((r) => r.scenario === id && r.kind === b)
        .map((r) => m.of(r, sc(id)))
        .filter((v) => v !== null && v !== undefined),
    }))
    const c = compare(groups)
    result[m.key] = c
    if (!c) continue
    const better = c.diff * m.better > 0
    const sure = m.better < 0 ? c.hi < 0 : c.lo > 0
    const worseSure = m.better < 0 ? c.lo > 0 : c.hi < 0
    crows.push([
      `${m.primary ? '**' : ''}${m.name}${m.primary ? '**' : ''}`,
      `${c.scenarios}`,
      f(c.diff),
      `[${f(c.lo)}, ${f(c.hi)}]`,
      sure
        ? `${a}가 나음(구간이 0을 넘지 않음)`
        : worseSure
          ? `${b}가 나음(구간이 0을 넘지 않음)`
          : better
            ? `${a} 쪽으로 기울었지만 불확실`
            : c.diff === 0
              ? '같음'
              : `${b} 쪽으로 기울었지만 불확실`,
    ])
  }
  lines.push(table(['지표', '시나리오 수', '차이', '95% 구간', '읽기'], crows), '')
  lines.push('## 판정 규칙 (5절, 마지막 hold-out 비교에만 쓴다)', '')
  const r1 = result.retold
  const r2 = result.success
  const pm1Better = r1 && r1.hi < 0
  const pm2Better = r2 && r2.lo > 0
  const pm1NotWorse = !r1 || r1.diff <= 0.25
  const pm2NotWorse = !r2 || r2.diff >= -0.1
  const verdict =
    (pm1Better && pm2NotWorse) || (pm2Better && pm1NotWorse)
      ? `효과 있음: ${a}가 ${b}보다 주지표 하나에서 확실히 낫고 다른 주지표에서 정한 한도 넘게 나쁘지 않다`
      : `효과를 보이지 못함: 규칙을 채우지 못했다`
  lines.push(
    `- PM1(다시 알려 줌) 확실히 나음: ${pm1Better ? '예' : '아니오'} / 한도(+0.25) 안: ${pm1NotWorse ? '예' : '아니오'}`,
    `- PM2(숨긴 시험) 확실히 나음: ${pm2Better ? '예' : '아니오'} / 한도(−10%p) 안: ${pm2NotWorse ? '예' : '아니오'}`,
    `- 결론: ${verdict}`,
    '',
  )
  return { text: lines.join('\n'), result }
}

const table = (head, rows) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: { pair: { type: 'string' }, out: { type: 'string' } },
  })
  if (!positionals.length) {
    console.error('쓰는 법: node eval/primary.mjs <결과 폴더>... [--pair a:b] [--out 파일.md]')
    process.exit(2)
  }
  const { text } = primaryReport(positionals, v.pair ? v.pair.split(':') : null)
  if (v.out) fs.writeFileSync(v.out, text)
  console.log(text)
}
