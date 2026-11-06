#!/usr/bin/env node
// 장기 평가(sequence) 돌리기 (docs/eval.md 5절 '장기 평가 돌리기', relay-v3 docs/m3-design.md 6·7절). 쪽마다 회차마다 한 레포에서
// 요청 열(48-long-shop은 15개)을 차례로 하고, 열이 끝나면 같은 기준 에이전트로 봉인 과제를 돌린다(lib/sequence-run.mjs).
//   node eval/run-sequence.mjs --runs 3 --arms relay3,relay3-m2,cli --out eval/results/m3-seq
//   node eval/run-sequence.mjs --arms cli --until 2 --no-sealed --out eval/results/m3-pilot   (작은 시범: Work 1~2만)
//   node eval/run-sequence.mjs --dry --arms cli,relay3 --out /tmp/m3-dry                       (건식: 정답 패치, 모델 없음)
// 같은 --out으로 다시 돌리면 끝낸 걸음을 건너뛰고 이어 간다. 컨테이너가 다시 떠도 이어 가려면 --checkpoints를 git 체크아웃
// 안의 폴더로 주고 --archive-push를 붙인다(걸음마다 체크포인트를 커밋하고 push한다).
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { cleanEnv, findClaude } from './lib/env.mjs'
import { relay3FakeGh } from './lib/fake-gh.mjs'
import { qualityOverlay, overlayRecord, relay3Cli } from './lib/overlay.mjs'
import { RELAY3_APP } from './lib/relay3-arm.mjs'
import { DEBT_RULE } from './lib/sequence.mjs'
import { runJob } from './lib/sequence-run.mjs'
import { isMain, readJson, sleep, writeJson } from './lib/util.mjs'
import { isSequence } from './lib/works.mjs'

const EVAL = import.meta.dirname
const APP = path.resolve(EVAL, '..')
const SCENARIOS = process.env.RELAY_EVAL_SCENARIOS
  ? path.resolve(process.env.RELAY_EVAL_SCENARIOS)
  : path.join(EVAL, 'scenarios')

/** 장기 평가의 쪽(m3-design 6절) */
export const SEQUENCE_ARMS = ['relay3', 'relay3-m2', 'cli']

const HELP = `쓰는 법: node eval/run-sequence.mjs [옵션]

  --scenario <id>          장기 평가 시나리오 (기본 48-long-shop)
  --runs <n>               쪽마다 회차 (기본 1. 규약은 3)
  --arms <목록>            relay3(M3 장치 켬), relay3-m2(RELAY_M3=off), cli 가운데 (기본 셋 모두)
  --until <n>              Work n까지만 돈다(작은 시범). 봉인 과제와 구조 지표는 모든 Work가 끝나야 돈다
  --no-sealed              봉인 과제를 돌리지 않는다
  --parallel <n>           동시에 도는 줄(쪽 × 회차) 수 (기본 1)
  --retries <n>            도구 문제로 멈춘 걸음을 체크포인트에서 다시 하는 횟수 (기본 1)
  --agent-model, --effort, --human-model, --human-effort, --judge-model, --cli-permission, --no-vision,
  --max-minutes, --max-turns   run.mjs와 같다
  --baseline-model <모델>  봉인 과제의 기준 에이전트 모델 (기본 sonnet. 모든 쪽에 같다)
  --baseline-effort <수준> 기준 에이전트 effort (기본 medium)
  --baseline-minutes <n>   봉인 과제 하나의 시간 제한 (기본 30)
  --no-quality-overlay     평가 레포 첫 커밋에 relay-v3 relay init 초안의 .relay/quality.json을 넣지 않는다(기본은 넣는다:
                           M2·M2.1 규약처럼 모든 쪽에 같은 품질 기준)
  --dry                    건식: 사람 역할과 에이전트 대신 정답 패치를 얹는다(모델을 부르지 않음, 도구의 길만 확인)
  --out <폴더>             결과 폴더 (기본 eval/results/seq-<시각>). 같은 폴더로 다시 돌리면 이어 간다
  --checkpoints <폴더>     체크포인트 폴더 (기본 <out>/checkpoints)
  --archive-push           체크포인트 폴더가 git 체크아웃이면 걸음마다 커밋하고 push한다(RELAY_BATCH_TRAILER를 끝에 붙임)
`

/** config.json에서 이어 돌 때 같아야 하는 값(바뀌면 줄마다 조건이 섞인다) */
export const FIXED_KEYS = [
  'agentModel',
  'effort',
  'humanModel',
  'humanEffort',
  'judgeModel',
  'cliArgs',
  'vision',
  'baseline',
  'dry',
  'qualityOverlay',
]

/** 앞 config와 다른 고정 값의 이름 */
export function changedFixed(prev, now) {
  if (!prev) return []
  return FIXED_KEYS.filter(
    (k) => JSON.stringify(prev[k] ?? null) !== JSON.stringify(now[k] ?? null),
  )
}

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

function preflight(arms, o) {
  const problems = []
  const relay3 = arms.some((a) => a !== 'cli')
  if (relay3 && !fs.existsSync(relay3FakeGh(RELAY3_APP)))
    problems.push(`relay-v3 가짜 gh가 없습니다: ${relay3FakeGh(RELAY3_APP)}`)
  if (o.overlay && !fs.existsSync(relay3Cli(RELAY3_APP)))
    problems.push(`relay-v3 명령줄(${relay3Cli(RELAY3_APP)})이 없습니다. RELAY3_APP을 확인하세요`)
  if (relay3 && !o.dry) {
    if (!fs.existsSync(path.join(RELAY3_APP, 'out/main/index.js')))
      problems.push(`relay-v3 빌드(${RELAY3_APP}/out)가 없습니다`)
    if (!fs.existsSync(path.join(RELAY3_APP, 'node_modules/electron/dist/electron')))
      problems.push('relay-v3 Electron 실행 파일이 없습니다')
  }
  if (!o.dry) {
    if (!fs.existsSync(path.join(APP, 'node_modules/node-pty')))
      problems.push('의존성이 설치되지 않았습니다')
    try {
      findClaude()
    } catch (e) {
      problems.push(String(e.message))
    }
  }
  if (problems.length) throw new Error(`준비가 덜 됐습니다: ${problems.join('; ')}`)
}

const commitOf = (dir) => {
  try {
    const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir })
      .toString()
      .trim()
    const dirty =
      execFileSync('git', ['status', '--porcelain'], { cwd: dir }).toString().trim() !== ''
    return `${head}${dirty ? '+dirty' : ''}`
  } catch {
    return null
  }
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      help: { type: 'boolean' },
      scenario: { type: 'string', default: '48-long-shop' },
      runs: { type: 'string', default: '1' },
      arms: { type: 'string' },
      until: { type: 'string' },
      'no-sealed': { type: 'boolean' },
      parallel: { type: 'string', default: '1' },
      retries: { type: 'string', default: '1' },
      'agent-model': { type: 'string', default: 'sonnet' },
      effort: { type: 'string', default: 'medium' },
      'human-model': { type: 'string', default: 'sonnet' },
      'human-effort': { type: 'string', default: 'medium' },
      'judge-model': { type: 'string', default: 'sonnet' },
      'cli-permission': { type: 'string', default: 'skip' },
      'no-vision': { type: 'boolean' },
      'max-minutes': { type: 'string' },
      'max-turns': { type: 'string' },
      'baseline-model': { type: 'string', default: 'sonnet' },
      'baseline-effort': { type: 'string', default: 'medium' },
      'baseline-minutes': { type: 'string', default: '30' },
      'no-quality-overlay': { type: 'boolean' },
      dry: { type: 'boolean' },
      out: { type: 'string' },
      checkpoints: { type: 'string' },
      'archive-push': { type: 'boolean' },
    },
  })
  if (v.help) return console.log(HELP)
  const dir = path.join(SCENARIOS, v.scenario)
  const scenario = { dir, ...readJson(path.join(dir, 'scenario.json'), null) }
  if (!isSequence(scenario)) throw new Error(`장기 평가 시나리오가 아닙니다: ${v.scenario}`)
  const arms = (v.arms ?? SEQUENCE_ARMS.join(','))
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  for (const a of arms)
    if (!SEQUENCE_ARMS.includes(a))
      throw new Error(`장기 평가의 쪽은 ${SEQUENCE_ARMS.join(', ')}입니다: ${a}`)
  const dry = !!v.dry
  const wantOverlay = !v['no-quality-overlay']
  preflight(arms, { dry, overlay: wantOverlay })

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')
  const outDir = path.resolve(v.out ?? path.join(EVAL, 'results', `seq-${stamp}`))
  const workRoot = path.join(os.tmpdir(), 'relay-eval', path.basename(outDir))
  const checkpoints = path.resolve(v.checkpoints ?? path.join(outDir, 'checkpoints'))
  fs.mkdirSync(outDir, { recursive: true })
  const overlay = wantOverlay
    ? qualityOverlay(path.join(dir, 'repo'), relay3Cli(RELAY3_APP), path.join(workRoot, 'overlay'))
    : null
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
    apps: {},
    relay3App: RELAY3_APP,
    humanMode: 'normal',
    // relay-v3 쪽이 도는 평가라 판정 모델에 목적을 주지 않는다(짝 판정은 하지 않는다)
    judgePurpose: false,
    qualityOverlay: !!overlay,
    baseline: {
      model: v['baseline-model'],
      effort: v['baseline-effort'],
      minutes: Number(v['baseline-minutes']),
    },
    sealed: !v['no-sealed'],
    dry,
  }
  const config = {
    ...opts,
    qualityOverlay: overlayRecord(overlay),
    scenario: scenario.id,
    arms,
    runs: Number(v.runs),
    debtRule: DEBT_RULE,
  }
  const prev = readJson(path.join(outDir, 'config.json'), null)
  const changed = changedFixed(prev, config)
  if (changed.length)
    throw new Error(
      `같은 결과 폴더의 앞 설정과 다릅니다(${changed.join(', ')}). 새 --out으로 돌리세요`,
    )
  let claudeVersion = null
  try {
    if (!dry)
      claudeVersion = execFileSync(findClaude(), ['--version'], { env: cleanEnv() })
        .toString()
        .trim()
  } catch {
    // 적지 못해도 된다
  }
  writeJson(path.join(outDir, 'config.json'), {
    ...config,
    startedAt: prev?.startedAt ?? new Date().toISOString(),
    resumedAt: prev ? new Date().toISOString() : undefined,
    commit: commitOf(APP),
    appCommits: arms.some((a) => a !== 'cli') || overlay ? { relay3: commitOf(RELAY3_APP) } : {},
    claudeVersion,
  })
  console.log(`결과 폴더: ${outDir}\n작업 폴더: ${workRoot}\n체크포인트: ${checkpoints}`)

  const xvfb = !dry && arms.some((a) => a !== 'cli') ? await ensureDisplay() : null
  // 회차를 바깥에 두어 쪽이 시간대에 고르게 섞이게 한다(run.mjs와 같음)
  const jobs = []
  for (let i = 1; i <= Number(v.runs); i++) for (const arm of arms) jobs.push({ arm, index: i })
  const retries = Math.max(0, Number(v.retries))
  let failed = 0
  const worker = async () => {
    for (;;) {
      const job = jobs.shift()
      if (!job) return
      for (let attempt = 0; ; attempt++) {
        try {
          await runJob({
            scenario,
            scenarioDir: dir,
            arm: job.arm,
            index: job.index,
            opts,
            outDir,
            workRoot,
            checkpoints,
            archivePush: !!v['archive-push'],
            overlay,
            until: v.until ? Number(v.until) : undefined,
          })
          break
        } catch (e) {
          console.log(`[${job.arm}-${job.index}] 멈춤: ${e instanceof Error ? e.stack : e}`)
          if (attempt >= retries) {
            failed++
            break
          }
          console.log(
            `[${job.arm}-${job.index}] 체크포인트에서 다시 함 (${attempt + 1}/${retries})`,
          )
        }
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.max(1, Number(v.parallel)) }, worker))
  } finally {
    xvfb?.kill()
  }
  console.log(`\n집계: node eval/m3-primary.mjs ${path.relative(APP, outDir)}`)
  if (failed) process.exitCode = 1
}

if (isMain(import.meta.url))
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
