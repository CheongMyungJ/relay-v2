#!/usr/bin/env node
// extract run 평가의 집계와 쪽 비교 (docs/extract-eval.md, 결정 23).
//   node eval/extract/report.mjs <결과 폴더>... [--runs 저장본.runs.json]... [--pair B,base] [--adopt] [--out 보고서.md]
//     [--runs-out 저장본.runs.json] [--as 이름표=새이름표[@시나리오]]... [--tasks integrate,review,summarize]
// --tasks는 그 과제의 행만 읽는다: survey·trace의 10층과 integrate·review·summarize의 6층(AI 결정 127)을 따로 판정한다.
// 결과 폴더는 git에 넣지 않으므로 run마다의 점수를 .runs.json으로 남기고(--runs-out), 다음에 그것을 기준선으로 읽는다(--runs).
// --adopt는 --pair의 앞을 새 쪽, 뒤를 기준선으로 보고 채택 규칙(결정 62, docs/extract-eval.md 5절)을 판정한다.
// 주지표: PM-A 잘못된 확정 수(낮을수록 좋음), PM-B 알려진 항목 재현율(높을수록 좋음). 관문(0이어야 함): 누출 카나리,
// worktree 변경. 보조: 실패율, 지어낸 앵커 비율, 줄 어긋남 비율, 소극화(코드로 풀 수 있었는데 미확정), 비용, 시간, 턴.
// 비교는 시나리오·과제를 층으로 둔 bootstrap 95% 구간이다(eval/primary.mjs의 compare). 실패한 run은 주지표에서 빼고
// 실패율로 따로 센다(AI 결정 53).
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { compare } from '../primary.mjs'
import { isMain } from '../lib/util.mjs'

export function loadRows(dirs) {
  const rows = []
  for (const d of dirs) {
    const runs = path.join(path.resolve(d), 'runs')
    if (!fs.existsSync(runs)) continue
    for (const id of fs.readdirSync(runs).sort()) {
      const rf = path.join(runs, id, 'run.json')
      const sf = path.join(runs, id, 'score.json')
      if (!fs.existsSync(rf)) continue
      const run = JSON.parse(fs.readFileSync(rf, 'utf8'))
      const score = fs.existsSync(sf) ? JSON.parse(fs.readFileSync(sf, 'utf8')) : null
      rows.push({ run, score })
    }
  }
  return rows
}

/**
 * 이름표 바꾸기: "A=BASE@e1-twoboard"면 이름표 A이고 시나리오가 e1-twoboard인 행을 BASE로 한다(@ 없으면 모든 시나리오,
 * "@e1-twoboard.survey"처럼 과제까지 줄 수 있다). 지시 바이트가 같은 층의 run을 고친 판의 이름표로 묶을 때도 쓴다.
 * 같은 때의 기준선이 한 시나리오에만 있을 때 다른 시나리오의 저장한 기준선과 묶어 한 쪽으로 견준다(AI 결정 79)
 */
export function relabel(rows, specs) {
  const rules = specs.map((x) => {
    const m = /^([^=]+)=([^@]+)(?:@(.+))?$/.exec(x)
    if (!m) throw new Error(`--as 꼴이 아님: ${x} (예: A=BASE@e1-twoboard)`)
    return { from: m[1], to: m[2], scenario: m[3] ?? null }
  })
  return rows.map((r) => {
    const rule = rules.find(
      (q) =>
        q.from === r.run.label &&
        (!q.scenario ||
          q.scenario === r.run.scenario ||
          q.scenario === `${r.run.scenario}.${r.run.task}`),
    )
    return rule ? { ...r, run: { ...r.run, label: rule.to } } : r
  })
}

/** 과제 id로 행을 고른다(tasks가 없으면 모두) */
export function filterTasks(rows, tasks) {
  return tasks ? rows.filter((r) => tasks.includes(r.run.task)) : rows
}

/** run.json·score.json 행을 저장본(.runs.json)의 run 항목으로. 주지표와 보조 지표에 쓰는 값만 남긴다 */
export function toStored(rows) {
  return rows.map(({ run, score }) => ({
    id: run.id,
    label: run.label,
    side: run.side,
    scenario: run.scenario,
    task: run.task,
    kind: run.kind ?? null,
    rep: run.rep,
    failure: run.failure ?? null,
    pmA: score?.pmA ?? null,
    pmB: score?.pmB ?? null,
    violated: score?.violated ?? [],
    missed: Object.entries(score?.recall ?? {})
      .filter(([, v]) => v === false)
      .map(([k]) => k),
    softened: score?.softened ?? [],
    anchors: score?.anchors ?? null,
    gates: {
      leak: !!score?.gates?.leak,
      worktreeChanged: !!(score?.gates?.worktreeChanged || run.worktreeChanged),
    },
    costUsd: run.result?.total_cost_usd ?? null,
    minutes: Math.round((run.ms / 60000) * 100) / 100,
    turns: run.result?.num_turns ?? null,
    softDeadlineHit: !!run.softDeadlineHit,
    hashes: run.hashes,
    model: run.init?.model ?? run.model,
    effort: run.effort,
    claude: run.init?.version ?? null,
  }))
}

/** 저장본의 run 항목을 loadRows의 행 모양으로. 관문 칸이 없는 옛 저장본(2026-10-09)은 관문 위반 0으로 읽는다 */
export function fromStored(stored) {
  return (stored.runs ?? []).map((r) => {
    const ok = !r.failure && r.pmA !== null && r.pmA !== undefined
    return {
      run: {
        id: r.id,
        label: r.label,
        side: r.side,
        scenario: r.scenario,
        task: r.task,
        kind: r.kind ?? null,
        rep: r.rep,
        failure: r.failure ?? null,
        model: r.model,
        effort: r.effort ?? 'medium',
        ms: (r.minutes ?? 0) * 60000,
        result: { total_cost_usd: r.costUsd, num_turns: r.turns },
        softDeadlineHit: !!r.softDeadlineHit,
        worktreeChanged: !!r.gates?.worktreeChanged,
        stored: true,
      },
      score: ok
        ? {
            pmA: r.pmA,
            pmB: r.pmB,
            violated: r.violated ?? [],
            recall: Object.fromEntries((r.missed ?? []).map((m) => [m, false])),
            softened: r.softened ?? [],
            anchors: r.anchors ?? { total: 0, ok: 0, lineMismatch: 0, fabricated: 0 },
            gates: { leak: !!r.gates?.leak, worktreeChanged: !!r.gates?.worktreeChanged },
          }
        : { gates: { leak: !!r.gates?.leak, worktreeChanged: !!r.gates?.worktreeChanged } },
    }
  })
}

/**
 * 채택 규칙(결정 62). a가 새 쪽, b가 기준선. 두 쪽이 함께 있는 층만 본다.
 * 관문 0, 실패율 차이 ≤ +10%p, 그리고 (PM-A 상한 < 0이고 PM-B 하한 ≥ −0.03) 또는 (PM-B 하한 > 0이고 PM-A 상한 ≤ +0.25)
 */
export function adoption(summary, a, b) {
  const groups = [...new Set(summary.map((s) => s.group))].filter(
    (g) =>
      summary.some((s) => s.label === a && s.group === g) &&
      summary.some((s) => s.label === b && s.group === g),
  )
  const rows = (label) => summary.filter((s) => s.label === label && groups.includes(s.group))
  const rate = (label) => {
    const r = rows(label)
    const n = r.reduce((x, s) => x + s.n, 0)
    return n ? r.reduce((x, s) => x + s.failed, 0) / n : 0
  }
  const gates = rows(a).reduce((x, s) => x + s.gates, 0)
  const failDiff = rate(a) - rate(b)
  const c = comparePair(
    summary.filter((s) => groups.includes(s.group)),
    a,
    b,
  )
  const pmA = c['PM-A']
  const pmB = c['PM-B']
  const reasons = []
  if (!pmA || !pmB) return { adopt: false, groups: groups.length, reasons: ['비교할 층 없음'] }
  const gateOk = gates === 0
  const failOk = failDiff <= 0.1
  const fewerWrong = pmA.hi < 0 && pmB.lo >= -0.03
  const moreFound = pmB.lo > 0 && pmA.hi <= 0.25
  reasons.push(`관문 위반 ${gates}`)
  reasons.push(`실패율 차이 ${(failDiff * 100).toFixed(0)}%p`)
  reasons.push(
    `PM-A 상한 ${pmA.hi.toFixed(3)} < 0 그리고 PM-B 하한 ${pmB.lo.toFixed(3)} ≥ −0.03: ${fewerWrong ? '예' : '아니오'}`,
  )
  reasons.push(
    `PM-B 하한 ${pmB.lo.toFixed(3)} > 0 그리고 PM-A 상한 ${pmA.hi.toFixed(3)} ≤ +0.25: ${moreFound ? '예' : '아니오'}`,
  )
  return {
    adopt: gateOk && failOk && (fewerWrong || moreFound),
    groups: groups.length,
    gates,
    failDiff,
    pmA,
    pmB,
    reasons,
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const f = (x, d = 2) =>
  x === null || x === undefined || Number.isNaN(x) ? '-' : Number(x).toFixed(d)

/** 쪽마다, 시나리오·과제마다 집계 */
export function summarize(rows) {
  const by = new Map()
  for (const r of rows) {
    const key = `${r.run.label}|${r.run.scenario}.${r.run.task}`
    if (!by.has(key)) by.set(key, [])
    by.get(key).push(r)
  }
  const out = []
  for (const [key, rs] of [...by.entries()].sort()) {
    const [label, group] = key.split('|')
    const ok = rs.filter((r) => !r.run.failure && r.score && r.score.pmA !== undefined)
    const anchors = ok.map((r) => r.score.anchors)
    const total = anchors.reduce((a, x) => a + x.total, 0)
    out.push({
      label,
      group,
      n: rs.length,
      failed: rs.filter((r) => r.run.failure).length,
      failures: rs.filter((r) => r.run.failure).map((r) => r.run.failure),
      gates: rs.filter((r) => r.score?.gates?.leak || r.run.worktreeChanged).length,
      pmA: mean(ok.map((r) => r.score.pmA)),
      pmB: mean(ok.map((r) => r.score.pmB).filter((x) => x !== null)),
      pmAValues: ok.map((r) => r.score.pmA),
      pmBValues: ok.map((r) => r.score.pmB).filter((x) => x !== null),
      fabricated: total ? anchors.reduce((a, x) => a + x.fabricated, 0) / total : null,
      lineMismatch: total ? anchors.reduce((a, x) => a + x.lineMismatch, 0) / total : null,
      softened: mean(ok.map((r) => r.score.softened.length)),
      cost: mean(rs.map((r) => r.run.result?.total_cost_usd).filter((x) => typeof x === 'number')),
      minutes: mean(rs.map((r) => r.run.ms / 60000)),
      turns: mean(rs.map((r) => r.run.result?.num_turns).filter((x) => typeof x === 'number')),
      softDeadline: rs.filter((r) => r.run.softDeadlineHit).length,
      violated: ok.flatMap((r) => r.score.violated),
      missed: ok.flatMap((r) =>
        Object.entries(r.score.recall)
          .filter(([, v]) => v === false)
          .map(([k]) => k),
      ),
    })
  }
  return out
}

/** 두 쪽의 주지표 차이(a - b)와 bootstrap 95% 구간 */
export function comparePair(summary, a, b) {
  const groups = [...new Set(summary.map((s) => s.group))]
  const pick = (label, g, k) => summary.find((s) => s.label === label && s.group === g)?.[k] ?? []
  const res = {}
  for (const [name, k] of [
    ['PM-A', 'pmAValues'],
    ['PM-B', 'pmBValues'],
  ])
    res[name] = compare(groups.map((g) => ({ a: pick(a, g, k), b: pick(b, g, k) })))
  return res
}

const counts = (xs) =>
  Object.entries(xs.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {}))
    .sort((x, y) => y[1] - x[1])
    .map(([k, n]) => `${k}×${n}`)
    .join(', ')

export function render(rows, pair, o = {}) {
  const s = summarize(rows)
  const lines = ['# extract run 평가', '']
  const labels = [...new Set(s.map((x) => x.label))]
  for (const label of labels) {
    const mine = s.filter((x) => x.label === label)
    const all = rows.filter((r) => r.run.label === label)
    const side = all[0]?.run.side
    lines.push(`## ${label} (쪽 ${side}, 모델 ${all[0]?.run.model}/${all[0]?.run.effort})`, '')
    lines.push(
      `- run ${all.length}개, 실패 ${all.filter((r) => r.run.failure).length}, 관문 위반 ${mine.reduce((a, x) => a + x.gates, 0)}`,
    )
    const costs = all.map((r) => r.run.result?.total_cost_usd).filter((x) => typeof x === 'number')
    const mins = all.map((r) => r.run.ms / 60000)
    lines.push(
      `- run당 비용 평균 $${f(mean(costs), 3)}(최대 $${f(Math.max(...costs), 3)}), 시간 평균 ${f(mean(mins), 1)}분(최대 ${f(Math.max(...mins), 1)}분)`,
    )
    lines.push('')
    lines.push(
      '| 시나리오.과제 | n | 실패 | PM-A | PM-B | 지어낸 앵커 | 줄 어긋남 | 소극화 | 비용 | 분 | 턴 | 마감 |',
    )
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (const x of mine)
      lines.push(
        `| ${x.group} | ${x.n} | ${x.failed} | ${f(x.pmA)} | ${f(x.pmB)} | ${f(x.fabricated)} | ${f(x.lineMismatch)} | ${f(x.softened)} | ${f(x.cost, 3)} | ${f(x.minutes, 1)} | ${f(x.turns, 0)} | ${x.softDeadline} |`,
      )
    lines.push('')
    const viol = mine.flatMap((x) => x.violated)
    const miss = mine.flatMap((x) => x.missed)
    const fails = mine.flatMap((x) => x.failures)
    if (viol.length) lines.push(`- 잘못된 확정: ${counts(viol)}`)
    if (miss.length) lines.push(`- 놓친 항목: ${counts(miss)}`)
    if (fails.length) lines.push(`- 실패: ${counts(fails)}`)
    lines.push('')
  }
  if (pair) {
    const [a, b] = pair
    const c = comparePair(s, a, b)
    lines.push(`## 비교 ${a} - ${b} (시나리오·과제 층 bootstrap 95%)`, '')
    for (const [name, r] of Object.entries(c))
      lines.push(
        r
          ? `- ${name}: ${f(r.diff, 3)} [${f(r.lo, 3)}, ${f(r.hi, 3)}] (층 ${r.scenarios})`
          : `- ${name}: 비교할 층 없음`,
      )
    lines.push('')
    if (o.adopt) {
      const d = adoption(s, a, b)
      lines.push(
        `## 채택 판정 ${a} 대 ${b} (결정 62, 층 ${d.groups}): ${d.adopt ? '채택' : '채택하지 않음'}`,
        '',
      )
      for (const r of d.reasons) lines.push(`- ${r}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}

async function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      pair: { type: 'string' },
      out: { type: 'string' },
      runs: { type: 'string', multiple: true, default: [] },
      'runs-out': { type: 'string' },
      adopt: { type: 'boolean', default: false },
      as: { type: 'string', multiple: true, default: [] },
      tasks: { type: 'string' },
    },
  })
  const loaded = filterTasks(
    [
      ...loadRows(positionals),
      ...v.runs.flatMap((f) => fromStored(JSON.parse(fs.readFileSync(f, 'utf8')))),
    ],
    v.tasks ? v.tasks.split(',') : null,
  )
  const rows = v.as.length ? relabel(loaded, v.as) : loaded
  const text = render(rows, v.pair ? v.pair.split(',') : null, { adopt: v.adopt })
  if (v.out) fs.writeFileSync(v.out, text + '\n')
  if (v['runs-out']) {
    const own = rows.filter((r) => !r.run.stored)
    fs.writeFileSync(
      v['runs-out'],
      JSON.stringify(
        {
          note: 'run마다의 점수(report.mjs --runs-out). 결과 폴더는 git에 넣지 않는다',
          runs: toStored(own),
        },
        null,
        1,
      ) + '\n',
    )
  }
  console.log(text)
}

if (isMain(import.meta.url)) await main()
