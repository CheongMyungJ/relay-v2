#!/usr/bin/env node
// relay 대 맨 CLI 사용성 평가 (docs/eval.md). 시나리오마다 두 쪽을 n번 돌리고, 짝지어 판정하고, report.md를 만든다.
// Work 둘을 잇는 시나리오(works, 21~23)의 두 쪽은 relay 대 지식을 끈 relay(relay-off)다.
//   node eval/run.mjs --list
//   node eval/run.mjs --scenarios 3 --runs 5
//   node eval/run.mjs --scenarios 1,2,5 --runs 2 --arms relay,cli --parallel 2
// 먼저 eval/setup.sh로 준비한다. 가상 화면(Xvfb)은 DISPLAY가 없으면 스스로 띄운다.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { runEpisode } from './lib/episode.mjs'
import { cleanEnv, findClaude } from './lib/env.mjs'
import { armBase, armType, words } from './lib/kind.mjs'
import { sleep, writeJson } from './lib/util.mjs'
import { pairOf } from './lib/works.mjs'
import { buildReport, judgeAll } from './report.mjs'

const EVAL = import.meta.dirname
const APP = path.resolve(EVAL, '..')
// RELAY_EVAL_SCENARIOS가 있으면 그 폴더의 시나리오를 쓴다(봉인을 푼 hold-out을 따로 둘 때)
const SCENARIOS = process.env.RELAY_EVAL_SCENARIOS
  ? path.resolve(process.env.RELAY_EVAL_SCENARIOS)
  : path.join(EVAL, 'scenarios')

const HELP = `쓰는 법: node eval/run.mjs [옵션]

  --list                   시나리오 목록
  --scenarios <목록>       1,3 또는 01-slug,03-cart 또는 all (기본 all)
  --runs <n>               시나리오와 쪽마다 돌릴 횟수 (기본 1)
  --arms <목록>            relay, relay-off(지식을 끈 relay), cli, --app으로 준 빌드 이름(뒤에 -off를 붙이면
                           그 빌드에서 지식을 끔) 가운데 (기본: 시나리오의 짝. works가 있는 시나리오는
                           relay,relay-off, 나머지는 relay,cli). relay 쪽 뒤에 @<유형>을 붙이면(예: relay@general)
                           시나리오의 유형 대신 그 유형으로 새 Work를 만든다(교차 비교, I93)
  --app <이름=폴더>        다른 relay 빌드를 쪽으로 쓴다. 폴더는 빌드한 app/ (eval/ref-app.sh). 여럿이면 쉼표.
                           예: --app base=/tmp/relay-ref/base/app,m17=/tmp/relay-ref/m17/app
  --pairs <목록>           짝 판정할 짝. 예: relay:base,relay:m17 (기본: 시나리오의 짝)
  --parallel <n>           동시에 돌릴 실행 수 (기본 1, 2까지 권함)
  --agent-model <모델>     relay와 CLI 안의 claude 모델 (기본 sonnet)
  --effort <수준>          에이전트 effort: low / medium / high (기본 medium)
  --human-model <모델>     사람 역할 모델 (기본 sonnet)
  --human-effort <수준>    사람 역할 effort (기본 medium)
  --judge-model <모델>     판정 모델 (기본 sonnet)
  --cli-permission <모드>  skip(--dangerously-skip-permissions, relay와 같음) / default (기본 skip)
  --no-vision              relay 사람 역할이 스크린샷 없이 글자만 본다
  --max-minutes <n>        실행 하나의 시간 제한 (기본은 시나리오 값)
  --max-turns <n>          사람 차례 제한 (기본은 시나리오 값)
  --no-judge               짝 판정을 하지 않는다
  --out <폴더>             결과 폴더 (기본 eval/results/<시각>)
`

export function listScenarios() {
  return fs
    .readdirSync(SCENARIOS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SCENARIOS, d.name, 'scenario.json')))
    .map((d) => ({
      dir: path.join(SCENARIOS, d.name),
      ...JSON.parse(fs.readFileSync(path.join(SCENARIOS, d.name, 'scenario.json'), 'utf8')),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function pickScenarios(spec, all) {
  if (!spec || spec === 'all') return all
  return spec
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((x) => {
      const s = /^\d+$/.test(x)
        ? all.find((c) => Number(c.id.split('-')[0]) === Number(x))
        : all.find((c) => c.id === x || c.id.endsWith(`-${x}`))
      if (!s) throw new Error(`시나리오 ${x}가 없습니다. --list로 보세요.`)
      return s
    })
}

/** DISPLAY가 없으면 Xvfb를 띄운다 */
async function ensureDisplay() {
  if (process.env.DISPLAY) return null
  for (let n = 90; n < 120; n++) {
    if (fs.existsSync(`/tmp/.X${n}-lock`)) continue
    const x = spawn('Xvfb', [`:${n}`, '-screen', '0', '1600x1000x24', '-nolisten', 'tcp'], {
      stdio: 'ignore',
    })
    await sleep(1500)
    if (x.exitCode === null) {
      process.env.DISPLAY = `:${n}`
      return x
    }
  }
  throw new Error('Xvfb를 띄우지 못했습니다')
}

const ARMS = ['relay', 'relay-off', 'cli']

/** 쪽 이름이 쓸 앱 폴더. cli는 null */
const appOf = (arm, apps) => {
  if (arm === 'cli') return null
  const build = armBase(arm).replace(/-off$/, '')
  return build === 'relay' ? APP : (apps[build] ?? null)
}

function preflight(arms, apps) {
  const problems = []
  for (const dir of new Set(arms.map((a) => appOf(a, apps)).filter(Boolean))) {
    if (!fs.existsSync(path.join(dir, 'out/main/index.js')))
      problems.push(`앱 빌드(${dir}/out)가 없습니다`)
    if (!fs.existsSync(path.join(dir, 'node_modules/electron/dist/electron')))
      problems.push('Electron 실행 파일이 없습니다')
  }
  if (!fs.existsSync(path.join(APP, 'node_modules/node-pty')))
    problems.push('의존성이 설치되지 않았습니다')
  try {
    findClaude()
  } catch (e) {
    problems.push(String(e.message))
  }
  if (problems.length)
    throw new Error(`준비가 덜 됐습니다: ${problems.join('; ')}. eval/setup.sh를 먼저 돌리세요.`)
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      list: { type: 'boolean' },
      help: { type: 'boolean' },
      scenarios: { type: 'string' },
      runs: { type: 'string', default: '1' },
      arms: { type: 'string' },
      app: { type: 'string' },
      pairs: { type: 'string' },
      parallel: { type: 'string', default: '1' },
      'agent-model': { type: 'string', default: 'sonnet' },
      effort: { type: 'string', default: 'medium' },
      'human-model': { type: 'string', default: 'sonnet' },
      'human-effort': { type: 'string', default: 'medium' },
      'judge-model': { type: 'string', default: 'sonnet' },
      'cli-permission': { type: 'string', default: 'skip' },
      'no-vision': { type: 'boolean' },
      'max-minutes': { type: 'string' },
      'max-turns': { type: 'string' },
      'no-judge': { type: 'boolean' },
      out: { type: 'string' },
    },
  })
  if (v.help) return console.log(HELP)
  const all = listScenarios()
  if (v.list) {
    for (const s of all) console.log(`${s.id}  [${words(s).label}] ${s.title}\n    ${s.purpose}`)
    return
  }
  const scenarios = pickScenarios(v.scenarios, all)
  const given = v.arms
    ?.split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  const apps = Object.fromEntries(
    (v.app ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [name, dir] = x.split('=')
        if (!name || !dir || ['relay', 'cli'].includes(name) || name.endsWith('-off'))
          throw new Error(`--app 형식: 이름=폴더 (relay, cli, -off로 끝나는 이름은 못 씀): ${x}`)
        return [name, path.resolve(dir)]
      }),
  )
  const knownBase = (a) => ARMS.includes(a) || !!apps[a.replace(/-off$/, '')]
  // relay@<유형>: @ 앞은 relay 앱의 쪽이고 뒤는 아는 유형이다 (I93)
  const known = (a) =>
    a === armBase(a) ? knownBase(a) : !!armType(a) && armBase(a) !== 'cli' && knownBase(armBase(a))
  for (const a of given ?? [])
    if (!known(a))
      throw new Error(`모르는 쪽: ${a} (--app으로 빌드를 주거나 @ 뒤에 유형을 바르게 쓰세요)`)
  const armsOf = (s) => given ?? pairOf(s)
  const arms = [...new Set(scenarios.flatMap((s) => armsOf(s)))]
  const pairs = v.pairs
    ? v.pairs.split(',').map((x) => {
        const p = x.split(':').map((y) => y.trim())
        if (p.length !== 2 || !p.every((y) => arms.includes(y)))
          throw new Error(`--pairs의 짝은 돌리는 쪽 둘이어야 합니다: ${x}`)
        return p
      })
    : null
  const runs = Number(v.runs)
  preflight(arms, apps)

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')
  const outDir = path.resolve(v.out ?? path.join(EVAL, 'results', stamp))
  const workRoot = path.join(os.tmpdir(), 'relay-eval', path.basename(outDir))
  fs.mkdirSync(outDir, { recursive: true })
  const opts = {
    agentModel: v['agent-model'],
    effort: v.effort,
    humanModel: v['human-model'],
    humanEffort: v['human-effort'],
    judgeModel: v['judge-model'],
    cliArgs: v['cli-permission'] === 'default' ? [] : ['--dangerously-skip-permissions'],
    vision: !v['no-vision'],
    maxMinutes: v['max-minutes'] ? Number(v['max-minutes']) : undefined,
    maxTurns: v['max-turns'] ? Number(v['max-turns']) : undefined,
    workRoot,
    apps,
    pairs,
  }
  let claudeVersion = null
  try {
    claudeVersion = execFileSync(findClaude(), ['--version'], { env: cleanEnv() }).toString().trim()
  } catch {
    // 적지 못해도 된다
  }
  const commitOf = (dir) => {
    try {
      return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir }).toString().trim()
    } catch {
      return null // 적지 못해도 된다
    }
  }
  const commit = commitOf(APP)
  const appCommits = Object.fromEntries(Object.entries(apps).map(([k, d]) => [k, commitOf(d)]))
  writeJson(path.join(outDir, 'config.json'), {
    startedAt: new Date().toISOString(),
    commit,
    appCommits,
    claudeVersion,
    scenarios: scenarios.map((s) => s.id),
    runs,
    arms,
    ...opts,
  })
  console.log(`결과 폴더: ${outDir}`)
  console.log(`작업 폴더: ${workRoot}`)

  const xvfb = arms.some((a) => a !== 'cli') ? await ensureDisplay() : null
  // 다른 빌드의 첫 실행 창 수락 등은 같은 도구가 한다. 빌드마다 화면이 다르면 relay-arm.mjs를 맞춘다
  // 회차를 바깥에 두어 쪽과 시나리오가 시간대에 고르게 섞이게 한다
  const jobs = []
  for (let i = 1; i <= runs; i++)
    for (const s of scenarios) for (const kind of armsOf(s)) jobs.push({ s, kind, i })
  const total = jobs.length
  let done = 0
  const worker = async () => {
    for (;;) {
      const job = jobs.shift()
      if (!job) return
      const { s, kind, i } = job
      try {
        await runEpisode({
          scenario: s,
          scenarioDir: s.dir,
          kind,
          index: i,
          opts,
          outDir: path.join(outDir, s.id, `${kind}-${i}`),
          workDir: path.join(workRoot, `${s.id}-${kind}-${i}`),
        })
      } catch (e) {
        console.log(`[${s.id} ${kind}#${i}] 실행 실패: ${e instanceof Error ? e.stack : e}`)
      }
      done++
      console.log(`== 진행 ${done}/${total}`)
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.max(1, Number(v.parallel)) }, worker))
  } finally {
    xvfb?.kill()
  }

  // 짝(--pairs, 없으면 시나리오의 짝)이 모두 돈 회차만 판정한다
  if (!v['no-judge']) await judgeAll(outDir, opts)
  const text = buildReport(outDir)
  console.log(`\n${text}\n`)
  console.log(`보고서: ${path.join(outDir, 'report.md')}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
