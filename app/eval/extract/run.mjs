#!/usr/bin/env node
// extract run 단위 평가 하네스 (docs/extract-eval.md, requirements-extraction-flow.md 결정 17~23, 28).
//   node eval/extract/run.mjs --side base --label A --reps 5 [--scenarios e1-twoboard] [--tasks survey,trace-timing]
//     [--model sonnet] [--effort medium] [--concurrency 2] [--out 폴더] [--dry]
// 쪽(지침 판) 하나를 시나리오·과제마다 회차만큼 돌려 runs/<label>.<시나리오>.<과제>.<회차>/run.json에 남긴다.
// 채점은 score.mjs, 집계와 비교는 report.mjs가 한다. A/A는 같은 쪽을 다른 --label로 두 번 돌린다.
// 사용량: run을 띄우기 전마다 guard(usage.mjs)가 주간 사용률을 보고 남은 비율이 하한에 닿으면 멈춘다(결정 28).
// 사용량 한도로 실패하면(결정 29) 5시간 창은 재설정 시각까지 기다렸다 같은 run부터 잇고, 주간이면 멈춘다.
// --dry는 가짜 claude(test/support/fake-claude/print-run.mjs)로 하네스만 확인한다(사용량 없음).
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { cleanEnv } from '../lib/env.mjs'
import { isMain } from '../lib/util.mjs'
import { runBin } from './lib/claude-bin.mjs'
import { runOne, WORK_ROOT } from './lib/runner.mjs'
import { sideId } from './lib/sides.mjs'
import { guard, logCall } from './lib/usage.mjs'

const HERE = import.meta.dirname
export const SCENARIOS = path.join(HERE, 'scenarios')

export function loadScenario(id) {
  const dir = path.join(SCENARIOS, id)
  return { dir, scenario: JSON.parse(fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8')) }
}

export function listScenarios() {
  return fs
    .readdirSync(SCENARIOS)
    .filter((d) => fs.existsSync(path.join(SCENARIOS, d, 'scenario.json')))
    .sort()
}

/** 돌릴 차례: 회차 바깥, 시나리오·과제 안쪽(회차마다 모든 과제가 한 번씩 돈다) */
export function plan({ scenarios, tasks, reps }) {
  const items = []
  for (let rep = 1; rep <= reps; rep++)
    for (const id of scenarios) {
      const { dir, scenario } = loadScenario(id)
      for (const task of scenario.tasks.filter((t) => !tasks || tasks.includes(t.id)))
        items.push({ rep, dir, scenario, task })
    }
  return items
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      side: { type: 'string', default: 'base' },
      label: { type: 'string' },
      reps: { type: 'string', default: '5' },
      scenarios: { type: 'string' },
      tasks: { type: 'string' },
      model: { type: 'string', default: 'sonnet' },
      effort: { type: 'string', default: 'medium' },
      concurrency: { type: 'string', default: '2' },
      out: { type: 'string' },
      'soft-min': { type: 'string', default: '15' },
      'hard-min': { type: 'string', default: '30' },
      'floor-pct': { type: 'string', default: '50' },
      'max-calls': { type: 'string', default: '150' },
      'calls-file': { type: 'string' },
      dry: { type: 'boolean', default: false },
      'fake-plan': { type: 'string' },
    },
  })
  const scenarios = v.scenarios ? v.scenarios.split(',') : listScenarios()
  const tasks = v.tasks ? v.tasks.split(',') : null
  const items = plan({ scenarios, tasks, reps: Number(v.reps) })
  const combos = [...new Set(items.map((i) => `${i.task.kind}|${i.task.lens ?? ''}`))].map((s) => {
    const [k, l] = s.split('|')
    return [k, l || null]
  })
  const side = sideId(v.side, combos)
  const label = v.label ?? side
  const outDir = path.resolve(
    v.out ?? path.join(HERE, 'results', `${new Date().toISOString().slice(0, 10)}-${side}`),
  )
  fs.mkdirSync(outDir, { recursive: true })
  const callsFile = path.resolve(v['calls-file'] ?? path.join(outDir, 'calls.jsonl'))
  const bin = runBin()
  const env = cleanEnv()
  const meta = {
    side,
    sideName: v.side,
    label,
    model: v.model,
    effort: v.effort,
    scenarios,
    tasks,
    reps: Number(v.reps),
    dry: v.dry,
    bin,
  }
  fs.writeFileSync(path.join(outDir, `meta.${label}.json`), JSON.stringify(meta, null, 2))
  console.log(`쪽 ${side}, 이름표 ${label}, run ${items.length}개 → ${outDir}`)

  const done = new Set(
    fs.existsSync(path.join(outDir, 'runs'))
      ? fs.readdirSync(path.join(outDir, 'runs')).filter((d) => {
          const f = path.join(outDir, 'runs', d, 'run.json')
          if (!fs.existsSync(f)) return false
          return JSON.parse(fs.readFileSync(f, 'utf8')).failure !== 'usage_limit'
        })
      : [],
  )
  const queue = items.filter((i) => !done.has(`${label}.${i.scenario.id}.${i.task.id}.${i.rep}`))
  if (queue.length < items.length)
    console.log(`이미 있는 run ${items.length - queue.length}개는 건너뛴다`)
  let stopped = null
  let waitUntil = 0
  let observed = null

  async function worker() {
    while (queue.length && !stopped) {
      if (Date.now() < waitUntil) {
        await new Promise((r) => setTimeout(r, Math.min(60_000, waitUntil - Date.now())))
        continue
      }
      const g = await guard({
        bin,
        env,
        callsFile,
        floorPct: Number(v['floor-pct']),
        maxCalls: Number(v['max-calls']),
        dry: v.dry,
        observed,
      })
      if (!g.ok) {
        stopped = g.why
        break
      }
      const item = queue.shift()
      if (!item) break
      const t0 = Date.now()
      const rec = await runOne({
        scenarioDir: item.dir,
        scenario: item.scenario,
        task: item.task,
        side: v.side,
        label,
        rep: item.rep,
        model: v.model,
        effort: v.effort,
        outDir,
        workRoot: path.join(WORK_ROOT, path.basename(outDir)),
        bin,
        dry: v.dry,
        fakePlan: v['fake-plan'] ? path.resolve(v['fake-plan']) : undefined,
        softMs: Number(v['soft-min']) * 60_000,
        hardMs: Number(v['hard-min']) * 60_000,
      })
      if (rec.observedUsage) observed = rec.observedUsage
      if (!v.dry)
        logCall(callsFile, {
          kind: 'run',
          id: rec.id,
          ms: rec.ms,
          cost: rec.result?.total_cost_usd ?? null,
        })
      const cost = rec.result?.total_cost_usd
      console.log(
        `${rec.id}: ${rec.failure ?? 'ok'} ${(rec.ms / 60000).toFixed(1)}분 ${cost !== undefined ? `$${cost.toFixed(3)}` : ''} (${g.why}, ${Math.round((Date.now() - t0) / 1000)}s)`,
      )
      if (rec.failure === 'usage_limit') {
        queue.unshift(item)
        const type = rec.usageLimit?.type ?? ''
        if (/seven_day|weekly/.test(type) || !rec.usageLimit?.resetsAt) {
          stopped = `사용량 한도(${type || '종류 모름'})로 멈춤`
          break
        }
        waitUntil = rec.usageLimit.resetsAt * 1000 + 60_000
        console.log(`5시간 창 한도: ${new Date(waitUntil).toISOString()}까지 기다린다`)
      }
    }
  }
  await Promise.all(Array.from({ length: Number(v.concurrency) }, () => worker()))
  if (stopped) {
    console.log(`멈춤: ${stopped}`)
    process.exitCode = 2
  } else console.log('끝')
}

if (isMain(import.meta.url)) await main()
