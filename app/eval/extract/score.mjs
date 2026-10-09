#!/usr/bin/env node
// extract run 평가의 채점 (docs/extract-eval.md). run.json마다 score.json을 쓴다.
//   node eval/extract/score.mjs <결과 폴더>... [--judge-model sonnet] [--redo] [--no-judge] [--max-calls 150]
//     [--always-cap]
// 결정론 채점(lib/score.mjs)에 판정 모델의 정렬을 더한다. 판정은 run 폴더의 judge.json에 입력 해시와 함께 두고 같은
// 입력이면 다시 부르지 않는다(--redo면 다시 부른다). 판정을 부르기 전에도 사용량을 확인한다(결정 28).
// run 종류는 scenario.json의 과제에서 읽는다. 판정 지시는 종류마다 다르고(survey·trace는 예전 바이트 그대로라 판정 캐시가
// 이어진다), integrate·summarize의 '패킷에 없는 ID'는 run 폴더의 packet.md(integrate는 listing.md까지)의 전역 ID로 가른다.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { cleanEnv } from '../lib/env.mjs'
import { isMain } from '../lib/util.mjs'
import { runBin } from './lib/claude-bin.mjs'
import { callJudge } from './lib/judge.mjs'
import { loadScenario } from './run.mjs'
import {
  checkAnchors,
  collectAnchors,
  hasLeak,
  judgeItems,
  judgePrompt,
  JUDGE_SCHEMA,
  judgeSystem,
  scoreRun,
} from './lib/score.mjs'
import { knownIds, PLACEHOLDER_VARS, RECORD_KINDS, renderTask } from './lib/tasks.mjs'
import { guard, logCall } from './lib/usage.mjs'

export function loadTruth(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'truth.json'), 'utf8'))
}

/** 기준 커밋의 파일 = 시나리오의 repo/ (하네스가 그대로 커밋한다) */
export function repoReader(scenarioDir) {
  const root = path.join(scenarioDir, 'repo')
  return (rel) => {
    const f = path.resolve(root, rel)
    if (!f.startsWith(path.resolve(root)) || !fs.existsSync(f) || !fs.statSync(f).isFile())
      return null
    return fs.readFileSync(f, 'utf8')
  }
}

/** run의 종류: scenario.json의 과제가 정한다(run.json의 kind와 다르면 멈춘다) */
export function runKind(scenario, run) {
  const task = scenario.tasks.find((t) => t.id === run.task)
  if (!task) throw new Error(`${run.id}: 시나리오 ${scenario.id}에 과제 ${run.task}가 없음`)
  if (run.kind && run.kind !== task.kind)
    throw new Error(`${run.id}: run.json의 kind ${run.kind}와 scenario.json의 ${task.kind}가 다름`)
  return task
}

/** run이 받은 전역 ID: run 폴더의 packet.md(+ listing.md). 없으면 시나리오의 기록으로 다시 만든다(ID는 경로와 상관없다) */
export function runIds(dir, scenarioDir, task) {
  if (!RECORD_KINDS.includes(task.kind)) return undefined
  const read = (f) =>
    fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : null
  const packet = read('packet.md')
  if (packet !== null) return knownIds(packet, read('listing.md'))
  const r = renderTask(scenarioDir, task, PLACEHOLDER_VARS)
  return knownIds(r.packet, r.listing)
}

/** 판정이 필요 없는 run: 실패했거나 판정할 항목이 없다 */
function needsJudge(items) {
  return items.recall.length + items.must_not.length + items.resolvable.length > 0
}

async function judgeRun(run, truth, kind, o) {
  const items = judgeItems(truth, run.task, kind)
  if (!needsJudge(items))
    return { answer: { recall: [], must_not: [], resolvable: [] }, cached: true }
  const prompt = judgePrompt(run.output, truth, run.task, kind)
  const system = judgeSystem(kind)
  const hash = createHash('sha256').update(`${o.model}\n${system}\n${prompt}`).digest('hex')
  const file = path.join(o.dir, 'judge.json')
  if (!o.redo && fs.existsSync(file)) {
    const old = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (old.hash === hash) return { answer: old.answer, cached: true }
  }
  const g = await guard({
    bin: o.bin,
    env: o.env,
    callsFile: o.callsFile,
    observed: o.observed,
    maxCalls: o.maxCalls ?? 150,
    alwaysCap: !!o.alwaysCap,
  })
  if (!g.ok) throw new Error(`판정 전 멈춤: ${g.why}`)
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-extract-judge-'))
  let r
  try {
    r = await callJudge({
      bin: o.bin,
      model: o.model,
      system,
      schema: JUDGE_SCHEMA,
      prompt,
      cwd: cfg,
    })
  } catch {
    // 한 번 다시 한다(ai.mjs의 ask와 같음)
    r = await callJudge({
      bin: o.bin,
      model: o.model,
      system,
      schema: JUDGE_SCHEMA,
      prompt,
      cwd: cfg,
    })
  }
  fs.rmSync(cfg, { recursive: true, force: true })
  logCall(o.callsFile, { kind: 'judge', id: run.id, ms: r.ms, cost: r.costUsd })
  fs.writeFileSync(
    file,
    JSON.stringify({ hash, model: o.model, ms: r.ms, costUsd: r.costUsd, answer: r.data }, null, 2),
  )
  return { answer: r.data, cached: false }
}

export async function scoreDir(outDir, o) {
  const runsDir = path.join(outDir, 'runs')
  const ids = fs.existsSync(runsDir) ? fs.readdirSync(runsDir).sort() : []
  const cache = new Map()
  // 판정 전 사용량 확인에 쓸, run들이 본 가장 높은 사용률(get_usage는 오래된 값을 줄 수 있다)
  const observed = { weeklyPct: null, fiveHourPct: null }
  for (const id of ids) {
    const f = path.join(runsDir, id, 'run.json')
    if (!fs.existsSync(f)) continue
    const u = JSON.parse(fs.readFileSync(f, 'utf8')).observedUsage
    for (const k of ['weeklyPct', 'fiveHourPct'])
      if (typeof u?.[k] === 'number') observed[k] = Math.max(observed[k] ?? 0, u[k])
  }
  let judged = 0
  const one = async (id) => {
    const dir = path.join(runsDir, id)
    const file = path.join(dir, 'run.json')
    if (!fs.existsSync(file)) return
    const run = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!cache.has(run.scenario)) {
      const s = loadScenario(run.scenario)
      cache.set(run.scenario, { ...s, truth: loadTruth(s.dir), read: repoReader(s.dir) })
    }
    const s = cache.get(run.scenario)
    const task = runKind(s.scenario, run)
    const stdout = fs.existsSync(path.join(dir, 'stdout.jsonl'))
      ? fs.readFileSync(path.join(dir, 'stdout.jsonl'), 'utf8')
      : ''
    const base = {
      id: run.id,
      label: run.label,
      scenario: run.scenario,
      task: run.task,
      failure: run.failure,
    }
    if (run.failure || !run.output) {
      fs.writeFileSync(
        path.join(dir, 'score.json'),
        JSON.stringify(
          {
            ...base,
            gates: { leak: hasLeak(stdout, s.truth), worktreeChanged: run.worktreeChanged },
          },
          null,
          2,
        ),
      )
      return
    }
    let judge = null
    if (o.judge && !run.dry) {
      const j = await judgeRun(run, s.truth, task.kind, { ...o, dir, observed })
      judge = j.answer
      if (!j.cached) judged++
    }
    const anchors = checkAnchors(collectAnchors(run.output), s.read, run.repo)
    const score = scoreRun({
      out: run.output,
      truth: s.truth,
      task: run.task,
      kind: task.kind,
      ids: runIds(dir, s.dir, task),
      anchors,
      judge,
      leak: hasLeak(stdout, s.truth),
      worktreeChanged: run.worktreeChanged,
    })
    fs.writeFileSync(
      path.join(dir, 'score.json'),
      JSON.stringify(
        {
          ...base,
          ...score,
          anchorDetail: anchors.filter((a) => a.status !== 'ok' && a.status !== 'skipped'),
        },
        null,
        2,
      ),
    )
  }
  // 판정 호출만 시간이 들어 run을 몇 개씩 함께 채점한다(기본 1)
  const queue = [...ids]
  const workers = Array.from({ length: Math.max(1, o.concurrency ?? 1) }, async () => {
    while (queue.length) await one(queue.shift())
  })
  await Promise.all(workers)
  return { runs: ids.length, judged }
}

async function main() {
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'judge-model': { type: 'string', default: 'sonnet' },
      redo: { type: 'boolean', default: false },
      'no-judge': { type: 'boolean', default: false },
      concurrency: { type: 'string', default: '1' },
      'calls-file': { type: 'string' },
      'max-calls': { type: 'string', default: '150' },
      'always-cap': { type: 'boolean', default: false },
    },
  })
  const bin = runBin()
  const env = cleanEnv()
  for (const d of positionals) {
    const outDir = path.resolve(d)
    const r = await scoreDir(outDir, {
      judge: !v['no-judge'],
      model: v['judge-model'],
      redo: v.redo,
      concurrency: Number(v.concurrency),
      bin,
      env,
      callsFile: path.resolve(v['calls-file'] ?? path.join(outDir, 'calls.jsonl')),
      maxCalls: Number(v['max-calls']),
      alwaysCap: v['always-cap'],
    })
    console.log(`${outDir}: run ${r.runs}개 채점, 판정 호출 ${r.judged}번`)
  }
}

if (isMain(import.meta.url)) await main()
