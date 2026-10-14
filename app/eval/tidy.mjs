#!/usr/bin/env node
// 지식 정리 실험의 지표 (docs/tidy-experiment/protocol.md 4절). 결과를 보기 전에 정했고 실험 중에 바꾸지 않는다.
// 결과 폴더(여럿 가능)의 실행마다: 후보로 채운 정리 Work를 시작했나(요청 글의 첫머리), 사이드바의 후보를 눌렀나(사람의
// 행동 기록), 심은 지식 문제의 해결 수, 버그(tidyRole: bug), 멀쩡한 항목(guard), 걸린 시간, 비용. 쪽마다와 무리마다 모은다.
// 무리: 정리를 말하지 않는 시나리오(버그 시험이 있음, "noask")와 정리를 요청하는 시나리오("ask")
//   node eval/tidy.mjs <결과 폴더>... [--out 파일.md]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { loadRuns, loadScenario } from './report.mjs'

/** 도구 문제로 끝난 실행은 뺀다(따로 센다) */
const TOOL_ERRORS = new Set(['harness_error', 'human_error'])

/** 지식 정리 후보로 채운 요청의 첫머리 (core/knowledge-tidy tidyRequest) */
export const TIDY_HEAD = '`docs/knowledge/`의 팀 지식을 정리한다. 앱이 모델 없이 찾은 후보는'

/**
 * 사이드바의 후보 단추(aria-label "지식 정리 후보 n건", D395). 대화상자의 접기 요약은 summary라 걸리지 않는다. D395는 실험
 * 뒤 버렸으므로 지금 빌드에서는 늘 0이다(그 실험의 결과 폴더를 다시 셀 때 쓴다). 보고서에서는 누른 실행이 있을 때만 열을 보인다
 */
const BADGE = /^button "지식 정리 후보 \d+건"$/

/** 요청 글이 후보로 채운 것인가. 사람이 뒤를 고쳤어도 첫머리가 남아 있으면 그렇다 */
export const isTidyRequest = (text) => typeof text === 'string' && text.includes(TIDY_HEAD)

/** 사람의 행동 기록(turns.jsonl의 줄들)에서 사이드바 후보를 누른 수 */
export function badgeClicks(turns) {
  return turns
    .flatMap((t) => t.actions ?? [])
    .filter((a) => a.do === 'click' && a.ok !== false && BADGE.test(a.label ?? '')).length
}

/** 시나리오의 시험 나누기: 버그(tidyRole: bug), 심은 지식 문제(그 밖의 guard 아닌 것), guard */
export function checkRoles(scenario) {
  const checks = scenario.checks ?? []
  return {
    bug: checks.filter((c) => c.tidyRole === 'bug').map((c) => c.name),
    planted: checks.filter((c) => !c.guard && c.tidyRole !== 'bug').map((c) => c.name),
    guard: checks.filter((c) => c.guard).map((c) => c.name),
  }
}

/**
 * 실행 하나의 값. requests는 그 실행의 Work마다 요청 글, turns는 사람의 행동 기록이다. 도구 오류면 null
 */
export function runMetrics(run, scenario, requests, turns) {
  if (TOOL_ERRORS.has(run.ending)) return null
  const roles = checkRoles(scenario)
  const pass = (name) => run.outcome?.checks?.find((c) => c.name === name)?.pass === true
  return {
    group: roles.bug.length ? 'noask' : 'ask',
    tidyWork: requests.some(isTidyRequest),
    badge: badgeClicks(turns) > 0,
    planted: roles.planted.filter(pass).length,
    plantedTotal: roles.planted.length,
    bug: roles.bug.length ? roles.bug.every(pass) : null,
    guard: roles.guard.every(pass),
    minutes: (run.wallMs ?? 0) / 60000,
    humanCost: run.human?.costUsd ?? 0,
  }
}

/** 실행 값들을 모은다 */
export function summarize(ms) {
  const n = ms.length
  const count = (f) => ms.filter(f).length
  const sum = (f) => ms.reduce((a, m) => a + f(m), 0)
  const planted = sum((m) => m.planted)
  const plantedTotal = sum((m) => m.plantedTotal)
  const bugRuns = ms.filter((m) => m.bug !== null)
  return {
    runs: n,
    tidyWork: count((m) => m.tidyWork),
    badge: count((m) => m.badge),
    planted,
    plantedTotal,
    plantedRate: plantedTotal ? planted / plantedTotal : null,
    bug: bugRuns.filter((m) => m.bug).length,
    bugRuns: bugRuns.length,
    guard: count((m) => m.guard),
    minutes: n ? sum((m) => m.minutes) / n : null,
    humanCost: sum((m) => m.humanCost),
  }
}

function readTurns(dir) {
  const file = path.join(dir, 'turns.jsonl')
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

function readRequests(dir) {
  const works = path.join(dir, 'works')
  if (!fs.existsSync(works)) return []
  return fs
    .readdirSync(works)
    .map((w) => path.join(works, w, 'request.md'))
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
}

/** 결과 폴더들의 판정 비용(짝 판정 파일의 costUsd) */
function judgeCost(dirs) {
  let cost = 0
  for (const d of dirs)
    for (const s of fs.readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory()))
      for (const f of fs.readdirSync(path.join(d, s.name)))
        if (/^judge-.*\.json$/.test(f)) {
          const j = JSON.parse(fs.readFileSync(path.join(d, s.name, f), 'utf8'))
          cost += typeof j.costUsd === 'number' ? j.costUsd : 0
        }
  return cost
}

const pct = (x) => (x === null ? '-' : `${(x * 100).toFixed(1)}%`)

/** 쪽마다 한 줄. 사이드바 후보 누름(D395, 버림)은 누른 실행이 있을 때만 열로 보인다 */
export function table(title, rows) {
  const badge = rows.some(([, s]) => s.badge > 0)
  const head = [
    '쪽',
    '실행',
    '후보로 정리 Work',
    ...(badge ? ['사이드바 후보 누름'] : []),
    '심은 문제 해결',
    '버그 고침',
    '멀쩡한 항목',
    '걸린 시간(분)',
    '사람 역할($)',
  ]
  const lines = [
    `### ${title}`,
    '',
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
  ]
  for (const [kind, s] of rows) {
    const cells = [
      kind,
      s.runs,
      `${s.tidyWork}/${s.runs}`,
      ...(badge ? [`${s.badge}/${s.runs}`] : []),
      `${s.planted}/${s.plantedTotal} (${pct(s.plantedRate)})`,
      s.bugRuns ? `${s.bug}/${s.bugRuns}` : '-',
      `${s.guard}/${s.runs}`,
      s.minutes === null ? '-' : s.minutes.toFixed(1),
      s.humanCost.toFixed(2),
    ]
    lines.push(`| ${cells.join(' | ')} |`)
  }
  return [...lines, ''].join('\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' } },
  })
  const dirs = positionals.map((d) => path.resolve(d))
  const all = []
  let errors = 0
  for (const d of dirs)
    for (const run of loadRuns(d)) {
      const m = runMetrics(
        run,
        loadScenario(run.scenario),
        readRequests(run.dir),
        readTurns(run.dir),
      )
      if (m) all.push({ scenario: run.scenario, kind: run.kind, ...m })
      else errors++
    }
  const kinds = [...new Set(all.map((m) => m.kind))].sort()
  const out = ['# 지식 정리 실험 지표', '', `결과 폴더: ${dirs.join(', ')}`, '']
  for (const id of [...new Set(all.map((m) => m.scenario))].sort())
    out.push(
      table(
        id,
        kinds.map((k) => [k, summarize(all.filter((m) => m.scenario === id && m.kind === k))]),
      ),
    )
  for (const g of ['noask', 'ask'])
    if (all.some((m) => m.group === g))
      out.push(
        table(
          `무리 ${g === 'noask' ? 'noask (정리를 말하지 않음)' : 'ask (정리를 요청함)'}`,
          kinds.map((k) => [k, summarize(all.filter((m) => m.group === g && m.kind === k))]),
        ),
      )
  out.push(`도구 오류로 뺀 실행: ${errors}`)
  out.push(
    `비용(total_cost_usd): 사람 역할 $${all.reduce((a, m) => a + m.humanCost, 0).toFixed(2)}, 짝 판정 $${judgeCost(dirs).toFixed(2)}`,
  )
  const text = out.join('\n')
  if (values.out) fs.writeFileSync(values.out, text + '\n')
  console.log(text)
}
