#!/usr/bin/env node
// relay 대 맨 CLI 사용성 평가 (docs/eval.md). 시나리오마다 두 쪽을 n번 돌리고, 짝지어 판정하고, report.md를 만든다.
// Work 여럿을 잇는 시나리오(works, 21~27)의 두 쪽은 relay 대 지식을 끈 relay(relay-off)다.
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
import { armBase, armType, isRelay3, RELAY3, words } from './lib/kind.mjs'
import { RELAY3_APP } from './lib/relay3-arm.mjs'
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
  --scenarios <목록>       1,3 또는 01-slug,03-cart 또는 all (기본 all). all은 개발용(scenario.json의
                           dev, 25~27)을 빼고, 개발용은 번호나 이름으로만 고른다
  --runs <n>               시나리오와 쪽마다 돌릴 횟수 (기본 1)
  --arms <목록>            relay, relay-off(지식을 끈 relay), relay-ask(의도 정리의 질문 방식을 결정마다 확인으로 둔 relay), cli, --app으로 준 빌드 이름(뒤에 -off를 붙이면
                           그 빌드에서 지식을 끔) 가운데 (기본: 시나리오의 짝. works가 있는 시나리오는
                           relay,relay-off, 나머지는 relay,cli). relay 쪽 뒤에 @<유형>을 붙이면(예: relay@general)
                           시나리오의 유형 대신 그 유형으로 새 Work를 만든다(교차 비교, I93).
                           relay3(relay-v3 앱), relay3-noreview(같은 앱에서 독립 리뷰를 끔, RELAY_ABLATE=review)도
                           쓸 수 있다. relay-v3 체크아웃은 RELAY3_APP(기본 relay-v2 옆의 relay-v3)이고 먼저
                           npm run build를 돌려 둔다. relay-v3 쪽이 돌면 판정 모델에 목적을 주지 않는다.
                           cli와 함께 돌리면 relay3, relay3-noreview, relay@<유형> 각각 대 cli도 짝 판정한다
                           (--pairs가 없을 때). 결과 폴더 여럿의 규약 판정은 eval/m2-primary.mjs
  --app <이름=폴더>        다른 relay 빌드를 쪽으로 쓴다. 폴더는 빌드한 app/ (eval/ref-app.sh). 여럿이면 쉼표.
                           이름 relay, cli, relay3…, -off로 끝나는 이름은 못 쓴다.
                           예: --app base=/tmp/relay-ref/base/app,m17=/tmp/relay-ref/m17/app
  --pairs <목록>           짝 판정할 짝. 예: relay:base,relay:m17 (기본: 시나리오의 짝, 위의 relay-v3·relay@<유형> 대 cli)
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
  --human-mode <방식>      normal(기본) 또는 hands-off: 사람 역할이 의도 승인 뒤 결과를 확인하거나 지적하지 않는다
  --no-judge-purpose       판정 모델에 시나리오의 평가 목적을 주지 않는다(relay-v3 쪽이 돌면 늘 주지 않음)
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
  if (!spec || spec === 'all') return all.filter((s) => !s.dev)
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

const ARMS = ['relay', 'relay-off', 'relay-ask', 'cli', ...RELAY3]

/** 쪽 이름이 쓸 앱 폴더. cli는 null, relay3 쪽은 relay-v3 체크아웃 */
const appOf = (arm, apps) => {
  if (arm === 'cli') return null
  if (isRelay3(arm)) return RELAY3_APP
  const build = armBase(arm).replace(/-off$/, '')
  return build === 'relay' || build === 'relay-ask' ? APP : (apps[build] ?? null)
}

/** 폴더 안 파일 가운데 가장 늦게 고친 때(ms). 없으면 0 */
function newestMtime(dir) {
  if (!fs.existsSync(dir)) return 0
  let newest = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    newest = Math.max(newest, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs)
  }
  return newest
}

function preflight(arms, apps) {
  const problems = []
  for (const dir of new Set(arms.map((a) => appOf(a, apps)).filter(Boolean))) {
    const built = path.join(dir, 'out/main/index.js')
    if (!fs.existsSync(built)) problems.push(`앱 빌드(${dir}/out)가 없습니다`)
    // 소스를 고치고 빌드하지 않으면 예전 앱으로 평가한다 (2026-11-03 평가에서 실제로 있었다)
    else if (newestMtime(path.join(dir, 'src')) > fs.statSync(built).mtimeMs)
      problems.push(
        `앱 빌드(${dir}/out)가 src보다 오래됐습니다. ${dir}에서 npm run build를 돌리세요`,
      )
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
      'human-mode': { type: 'string', default: 'normal' },
      'no-judge-purpose': { type: 'boolean' },
      out: { type: 'string' },
    },
  })
  if (v.help) return console.log(HELP)
  const all = listScenarios()
  if (v.list) {
    for (const s of all)
      console.log(
        `${s.id}  [${words(s).label}${s.dev ? ', 개발용' : ''}] ${s.title}\n    ${s.purpose}`,
      )
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
        if (
          !name ||
          !dir ||
          ['relay', 'cli'].includes(name) ||
          name.startsWith('relay3') ||
          name.endsWith('-off')
        )
          throw new Error(
            `--app 형식: 이름=폴더 (relay, cli, relay3…, -off로 끝나는 이름은 못 씀): ${x}`,
          )
        return [name, path.resolve(dir)]
      }),
  )
  const knownBase = (a) => ARMS.includes(a) || !!apps[a.replace(/-off$/, '')]
  // relay@<유형>: @ 앞은 relay 앱의 쪽이고 뒤는 아는 유형이다 (I93). relay-v3(relay3)와 맨 CLI에는 유형이 없다
  const known = (a) =>
    a === armBase(a)
      ? knownBase(a)
      : !!armType(a) && armBase(a) !== 'cli' && !isRelay3(armBase(a)) && knownBase(armBase(a))
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
    // relay-v3 앱의 체크아웃 (relay3, relay3-noreview 쪽)
    relay3App: RELAY3_APP,
    pairs,
    // hands-off: 사람 역할이 의도(계약) 승인 뒤 결과를 확인하거나 지적하지 않는다(relay-v3 M2 평가 규약 Q3, E-auto)
    humanMode: v['human-mode'] === 'hands-off' ? 'hands-off' : 'normal',
    // 판정 모델에 시나리오의 목적(무엇이 relay의 강점인지)을 주지 않는다(relay-v3 M2 평가 규약 6절). relay-v3 쪽이 도는
    // 배치는 그 규약의 평가라 --no-judge-purpose가 없어도 주지 않는다
    judgePurpose: !v['no-judge-purpose'] && !arms.some(isRelay3),
  }
  if (!['normal', 'hands-off'].includes(v['human-mode']))
    throw new Error(`--human-mode는 normal이나 hands-off입니다: ${v['human-mode']}`)
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
  // relay-v3는 커밋하지 않은 변경이 있으면 표시한다(빌드는 작업 트리에서 한다)
  if (arms.some(isRelay3)) {
    let dirty = false
    try {
      dirty =
        execFileSync('git', ['status', '--porcelain'], { cwd: RELAY3_APP }).toString().trim() !== ''
    } catch {
      // 적지 못해도 된다
    }
    appCommits.relay3 = `${commitOf(RELAY3_APP)}${dirty ? '+dirty' : ''}`
  }
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
