#!/usr/bin/env node
// extract run 평가의 집계와 쪽 비교 (docs/extract-eval.md, 결정 23).
//   node eval/extract/report.mjs <결과 폴더>... [--pair A,B] [--out 보고서.md]
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

export function render(rows, pair) {
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
  }
  return lines.join('\n')
}

async function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: { pair: { type: 'string' }, out: { type: 'string' } },
  })
  const rows = loadRows(positionals)
  const text = render(rows, v.pair ? v.pair.split(',') : null)
  if (v.out) fs.writeFileSync(v.out, text + '\n')
  console.log(text)
}

if (isMain(import.meta.url)) await main()
