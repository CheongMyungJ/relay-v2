// 장기 평가(sequence)의 한 줄(쪽 하나 × 회차 하나)을 돈다: 요청 15개를 한 레포에서 차례로 하고(Work마다 episode.mjs를 한 번),
// Work마다 결과를 기준 브랜치(main)에 넣고(lib/sequence-git.mjs), main에서 누적 숨긴 시험을 판정하고, 사람 역할의 기억을 고치고,
// 체크포인트를 쓴다. 열이 끝나면 봉인 과제 셋(lib/sealed-run.mjs)과 구조 지표(lib/structure.mjs)를 센다. 이어 돌기는 걸음마다
// (Work 하나, 봉인 과제 하나, 구조 지표)다: 걸음을 시작할 때 state.inProgress를 쓰고 끝나면 지우고 체크포인트를 쓴다. 다시 돌릴
// 때 inProgress가 남았거나 결과 폴더가 없으면(컨테이너가 다시 뜸) 마지막 체크포인트를 풀어 그 걸음부터 다시 한다.
//
// 결과 폴더 <out>/<시나리오>/<쪽>-<회차>/: state.json(걸음과 기억), work-NN/(episode의 run.json, turns.jsonl, 앱 Work 기록과
// sequence.json: 넣기, 누적 시험, 사람의 부담, 토큰, 장치 지표), sealed-<id>.json, structure.json, 다 끝나면 run.json(모음,
// m3-primary.mjs가 읽는다). 봉인: 숨긴 시험의 출력은 결과에 남기지 않는다(이름과 통과만, 봉인 과제는 차례 번호와 통과만).
import fs from 'node:fs'
import path from 'node:path'
import { outcomeSuccess, runEpisode } from './episode.mjs'
import { fakeGhSetup } from './fake-gh.mjs'
import { ledgerMetrics, m3WorkMetrics, parseLedger, repoM3, repoRules } from './m3-metrics.mjs'
import {
  exportsOf,
  parseEvents,
  sumReviews,
  withReviewUsage,
  workBundles,
  workLabel,
} from './relay3-arm.mjs'
import { judgeTree, makeRepo } from './repo.mjs'
import { evalMarks, GITHUB_MARKS, outsideReach, runSealedTask } from './sealed-run.mjs'
import {
  cumulativeSummary,
  doneWorks,
  emptyMemory,
  nextStep,
  personaScenario,
  rememberWork,
} from './sequence.mjs'
import {
  archiveCommit,
  commitLeftovers,
  exportTree,
  landCli,
  mergeBranches,
  pushMain,
  restoreCheckpoint,
  saveCheckpoint,
  syncMain,
} from './sequence-git.mjs'
import { structureMetrics } from './structure.mjs'
import { overlayFiles, overlayRecord } from './overlay.mjs'
import { git, readJson, run, withTempDir, writeJson } from './util.mjs'
import { activeChecks, workParts } from './works.mjs'

const TOOL_ERRORS = new Set(['harness_error', 'human_error'])
const pad = (n) => String(n + 1).padStart(2, '0')

/** 걸음 하나를 시도하는 수의 상한(이어 돌기를 넘어 센다). 다 쓰면 그 줄은 멈추고 다시 하지 않는다(규약 9절) */
export const MAX_ATTEMPTS = 3

/** 시도를 다 써서 멈춘 것(run-sequence.mjs는 다시 하지 않는다) */
export class AttemptsExhausted extends Error {
  exhausted = true
}

/**
 * Work 에이전트의 격리 감사(outsideReach)에 쓰는 평가의 자리와 닿아도 되는 곳. 사람 역할의 설정 폴더(cfg-human-N: 그 Work의
 * 물으면 답함 규칙이 든 사람 역할 프롬프트), 감사 폴더(told), 사람 역할의 화면(human), 판정 임시 폴더, 시나리오 폴더, 결과·
 * 체크포인트 폴더, 다른 줄의 작업 폴더가 평가의 자리다. 자기 레포, 원격, 앱 저장소(relay-v3 worktree), 가짜 gh, claude 심은
 * 닿아도 된다(줄의 작업 폴더 안이지만 지운 뒤 센다)
 */
export function workAudit(p, o) {
  return {
    marks: [
      ...evalMarks(o.scenarioDir, [o.outDir, o.checkpoints, o.workRoot]),
      path.join(p.workDir, 'told'),
      path.join(p.workDir, 'human'),
      path.join(p.workDir, 'judge'),
    ],
    allow: [
      p.repo,
      p.remote,
      p.home,
      path.join(p.workDir, 'gh-bin'),
      path.join(p.workDir, 'bin'),
      path.join(p.workDir, 'cfg-agent'),
      path.join(p.workDir, 'electron-user-data'),
    ],
  }
}

/** 앞 값을 뺀 것(감사의 누적 수에서 이 Work의 몫) */
const minus = (now, before) =>
  Object.fromEntries(Object.entries(now).map(([k, v]) => [k, v - (before?.[k] ?? 0)]))

/** 봉인 과제 목록(sealed/tasks.json). 없으면 빈 것 */
export function sealedTasks(scenarioDir, scenario) {
  const dir = scenario.sequence?.sealed?.dir ?? 'sealed'
  return readJson(path.join(scenarioDir, dir, 'tasks.json'), { tasks: [] })?.tasks ?? []
}

/** 한 줄의 폴더들 */
export function jobPaths(o) {
  const name = `${o.arm}-${o.index}`
  const repoName = o.scenario.repoName ?? 'repo'
  const workDir = path.join(o.workRoot, `${o.scenario.id}-${name}`)
  return {
    name,
    resultDir: path.join(o.outDir, o.scenario.id, name),
    workDir,
    repo: path.join(workDir, repoName),
    remote: path.join(workDir, `${repoName}.git`),
    home: path.join(workDir, 'relay3-home'),
    checkpoint: path.join(o.checkpoints, o.scenario.id, `${name}.tar.gz`),
  }
}

const isRelay3Arm = (arm) => arm !== 'cli'

/** 앱 저장소의 Work id들 */
function appWorkIds(home) {
  const dir = path.join(home, 'works')
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
}

/**
 * 건식 Work(--dry, 시험): 사람 역할과 에이전트 대신 그 Work의 정답 패치(reference-<n>.patch)를 얹는다. cli는 브랜치에 커밋해
 * 두고(도구가 main에 합친다), relay-v3 쪽은 작업 브랜치를 push하고 가짜 gh로 PR을 열어 squash로 머지한다(앱의 [머지]와 같은
 * 길). 사람은 규칙 항목 가운데 물으면 답함·처음부터 앎을 모두 말한 것으로 둔다(이미 말함은 다시 말하지 않음). 모델을 부르지 않는다
 */
export function dryWork(o) {
  const { n, repo, scenarioDir, knowledge, arm, ghEnv } = o
  const branch = arm === 'cli' ? `dry/w${pad(n)}` : `relay/dry-w${pad(n)}`
  const env = { ...process.env, ...(ghEnv ?? {}) }
  git(repo, 'checkout', '-q', '-B', branch, 'main')
  const patch = path.join(scenarioDir, `reference-${n + 1}.patch`)
  const a = run('git', ['apply', '--whitespace=nowarn', patch], { cwd: repo })
  if (a.code !== 0) throw new Error(`건식 Work ${n + 1}: 정답 패치를 얹지 못함`)
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '--no-verify', '-m', `dry: Work ${n + 1}`)
  const merged = []
  if (arm !== 'cli') {
    git(repo, 'push', '-q', 'origin', branch)
    const gh = (...args) => run(ghEnv.RELAY_GH_BIN, args, { cwd: repo, env })
    const c = gh('pr', 'create', '--head', branch, '--base', 'main', '--title', `dry ${n + 1}`)
    if (c.code !== 0) throw new Error(`건식 Work ${n + 1}: PR을 열지 못함: ${c.out}`)
    const number = Number(/pull\/(\d+)/.exec(c.out)?.[1])
    const head = git(repo, 'rev-parse', 'HEAD')
    const m = gh('pr', 'merge', String(number), '--squash', '--match-head-commit', head)
    if (m.code !== 0) throw new Error(`건식 Work ${n + 1}: PR을 머지하지 못함: ${m.out}`)
    merged.push(branch)
    git(repo, 'checkout', '-q', 'main')
  }
  const told = knowledge
    .map((k, i) => (k.rule && (k.share === 'on_ask' || k.share === 'upfront') ? i + 1 : null))
    .filter(Boolean)
  return {
    ending: 'done',
    prepareMs: 0,
    merged,
    workResult: {
      work: n + 1,
      ending: 'done',
      wallMs: 0,
      humanCostUsd: 0,
      human: {
        turns: 0,
        told,
        carriedTold: 0,
        carriedTotal: knowledge.filter((k) => k.carry).length,
      },
      agent: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        messages: 0,
        sessions: 0,
        questions: 0,
      },
    },
    works: [],
  }
}

/**
 * relay-v3 쪽 Work의 결과를 main에 넣는다. 앱이 머지한 것(가짜 gh가 원격 main을 움직임)은 가져오고, 머지되지 않았고 버리지 않은
 * Work 브랜치는 도구가 머지한다. 그 Work의 worktree에 커밋하지 않은 변경(시간 제한 등으로 세션이 커밋하지 못한 것)은 cli와 같게
 * 먼저 그 브랜치에 커밋한다(leftovers: 커밋한 파일 수. 앞 Work가 끊긴 같은 상태가 쪽에 따라 다음 Work의 기준을 다르게 만들지
 * 않게). squash 머지는 브랜치가 main의 조상이 아니므로 앱이 머지한 Work의 브랜치는 다시 넣지 않는다
 * @param {{ branch: string | null, worktree?: string | null, merged: boolean, abandoned: boolean }[]} works 이 Work에서 생긴 앱 Work
 */
export function landRelay3(repo, works, label) {
  const sync = syncMain(repo)
  const app = works.filter((w) => w.merged).map((w) => w.branch)
  const open = works.filter((w) => !w.merged && !w.abandoned && w.branch)
  let leftovers = 0
  for (const w of open)
    if (w.worktree && fs.existsSync(w.worktree)) leftovers += commitLeftovers(w.worktree, label)
  const left = open
    .map((w) => w.branch)
    .filter(
      (b) =>
        run('git', ['rev-parse', '--verify', '-q', `refs/heads/${b}`], { cwd: repo }).code === 0,
    )
  const m = mergeBranches(repo, left, label)
  const head = pushMain(repo)
  const via = app.length
    ? m.merged.length
      ? 'app+harness'
      : 'app'
    : m.merged.length
      ? 'harness'
      : 'none'
  return { via, app, sync, leftovers, ...m, head }
}

/** 앱 Work 하나의 M3 지표와 요약(이 Work에서 생긴 것) */
function appWorkOf(home, id, summary) {
  const dir = path.join(home, 'works', id)
  const rec = readJson(path.join(dir, 'work.json'), null)
  const events = fs.existsSync(path.join(dir, 'events.jsonl'))
    ? parseEvents(fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8'))
    : []
  const request = fs.existsSync(path.join(dir, 'request.md'))
    ? fs.readFileSync(path.join(dir, 'request.md'), 'utf8')
    : ''
  const { exports } = exportsOf(rec)
  const bundles = workBundles(events, exports)
  const final = bundles.finals.find((x) => x.unit === null)?.bundle ?? null
  return {
    id: summary?.id ?? workLabel(0, id),
    workId: id,
    status: rec?.state ?? null,
    branch: rec?.branch ?? null,
    worktree: rec?.worktree ?? null,
    end: summary?.end ?? null,
    merged: summary?.end === 'merged',
    abandoned: rec?.state === 'abandoned',
    gates: summary?.gates ?? [],
    devices: summary?.devices ?? null,
    review: summary?.review ?? null,
    m3: m3WorkMetrics({ rec, events, request, final, all: bundles.all }),
  }
}

/** 판정 결과에서 봉인할 것(출력)을 뺀다 */
const checkView = (defs, checks) =>
  defs.map((c) => ({
    name: c.name,
    regression: !!c.regression,
    pass: checks.find((x) => x.name === c.name)?.pass ?? false,
  }))

/**
 * 한 줄을 끝까지(또는 o.until까지) 돈다. 이미 끝낸 걸음은 건너뛴다(이어 돌기)
 * @param {object} o
 * @param {object} o.scenario 장기 평가 시나리오
 * @param {string} o.scenarioDir
 * @param {string} o.arm relay3 | relay3-m2 | cli
 * @param {number} o.index 회차(1부터)
 * @param {object} o.opts run.mjs와 같은 실행 옵션에 더해 baseline { model, effort, minutes }, dry, retries
 * @param {string} o.outDir 결과 폴더
 * @param {string} o.workRoot 작업 폴더의 뿌리(이어 돌 때 같은 경로여야 한다)
 * @param {string} o.checkpoints 체크포인트 폴더
 * @param {boolean} [o.archivePush] 체크포인트 폴더가 git 체크아웃이면 걸음마다 커밋하고 push한다
 * @param {{ path: string, text: string, sha256: string } | null} [o.overlay] 품질 기준 덧씌우기
 * @param {number} [o.until] 이번에 돌릴 마지막 Work(1부터). 봉인 과제와 구조 지표는 모든 Work가 끝나야 돈다
 * @param {(m: string) => void} [o.log]
 * @param {number} [o.maxAttempts] 걸음 하나의 시도 상한(기본 MAX_ATTEMPTS, 이어 돌기를 넘어 센다)
 * @param {Function} [o.sealedAgent] 시험용: 봉인 과제의 기준 에이전트 대신 부를 것(runSealedTask의 runAgent)
 */
export async function runJob(o) {
  const { scenario, arm, opts } = o
  const p = jobPaths(o)
  const say =
    o.log ??
    ((m) =>
      console.log(`${new Date().toISOString().slice(11, 19)} [${scenario.id} ${p.name}] ${m}`))
  const parts = workParts(scenario)
  const tasks = sealedTasks(o.scenarioDir, scenario)
  const stateFile = path.join(p.resultDir, 'state.json')
  const relay3 = isRelay3Arm(arm)

  const checkpoint = (label) => {
    saveCheckpoint([p.workDir, p.resultDir], p.checkpoint)
    if (o.archivePush) {
      const pushed = archiveCommit(
        o.checkpoints,
        [p.checkpoint],
        `장기 평가 체크포인트: ${p.name} ${label}`,
      )
      if (!pushed) say('체크포인트 push 실패(커밋은 남음)')
    }
  }

  // 이어 돌기: 걸음 중간에 끊겼거나 결과 폴더가 없으면 마지막 체크포인트로 돌아간다
  let state = readJson(stateFile, null)
  if ((!state || state.inProgress) && fs.existsSync(p.checkpoint)) {
    say(
      `체크포인트에서 이어 감 (${state?.inProgress ? `끊긴 걸음 ${JSON.stringify(state.inProgress)}` : '결과 폴더 없음'})`,
    )
    // 걸음마다 시도한 수와 그 까닭은 체크포인트 뒤의 것(끊긴 시도)도 남긴다. 컨테이너가 다시 떠 결과 폴더가 없으면 체크포인트의
    // 것이다. 끊긴 걸음의 마지막 시도에 까닭이 없으면 도구 문제로 멈춘 것이 아니라 끊긴 것(restart: kill, 컨테이너가 다시 뜸)이다
    const tried = state?.attempts ?? {}
    const causes = state?.failures ?? {}
    if (state?.inProgress) {
      const key = stepKey(state.inProgress)
      const n = tried[key] ?? 0
      if (n > 0 && !(causes[key] ?? []).some((c) => c.attempt === n))
        causes[key] = [...(causes[key] ?? []), { attempt: n, cause: 'restart', error: null }]
    }
    restoreCheckpoint(p.checkpoint, [p.workDir, p.resultDir])
    state = readJson(stateFile, null)
    if (state) {
      for (const [k, v] of Object.entries(tried))
        state.attempts[k] = Math.max(state.attempts[k] ?? 0, v)
      state.failures = { ...(state.failures ?? {}) }
      for (const [k, v] of Object.entries(causes))
        if (v.length > (state.failures[k]?.length ?? 0)) state.failures[k] = v
      // 합친 수를 바로 적는다(시도를 다 써서 바로 멈춰도 다음 실행이 같은 수를 본다)
      writeJson(stateFile, state)
    }
  }
  if (state?.inProgress) state = null // 첫 체크포인트 전에 끊김: 처음부터
  if (!state) {
    fs.rmSync(p.workDir, { recursive: true, force: true })
    fs.rmSync(p.resultDir, { recursive: true, force: true })
    fs.mkdirSync(p.workDir, { recursive: true })
    const made = makeRepo(
      p.workDir,
      scenario.repoName ?? 'repo',
      path.join(o.scenarioDir, 'repo'),
      overlayFiles(o.overlay ?? null),
    )
    state = {
      scenario: scenario.id,
      arm,
      index: o.index,
      base: made.base,
      prepared: false,
      step: 0,
      inProgress: null,
      works: {},
      sealed: {},
      structure: null,
      memory: emptyMemory(),
      attempts: {},
      failures: {},
      options: { qualityOverlay: overlayRecord(o.overlay ?? null), dry: !!opts.dry },
    }
    writeJson(stateFile, state)
    checkpoint('준비')
    say(`준비 (${p.repo})`)
  }
  const save = () => writeJson(stateFile, state)

  for (;;) {
    const step = nextStep(state, {
      works: parts.length,
      sealed: tasks.map((t) => t.id),
      until: o.until,
      runSealed: opts.sealed !== false,
    })
    if (!step) break
    const key = stepKey(step)
    const max = o.maxAttempts ?? MAX_ATTEMPTS
    if ((state.attempts[key] ?? 0) >= max)
      throw new AttemptsExhausted(
        `${key}: 시도 ${state.attempts[key]}번을 다 씀(상한 ${max}). 이 줄은 멈춘다(규약 9절: 처음부터 새 회차로)`,
      )
    state.inProgress = step
    state.attempts[key] = (state.attempts[key] ?? 0) + 1
    save()
    try {
      if (step.kind === 'work') await doWork(step.n)
      else if (step.kind === 'sealed') await doSealed(step.id)
      else doStructure()
    } catch (e) {
      // 도구 문제로 멈춘 시도의 까닭(다시 돌리면 체크포인트로 돌아가도 남는다). inProgress는 그대로 둔다
      state.failures ??= {}
      state.failures[key] = [
        ...(state.failures[key] ?? []),
        {
          attempt: state.attempts[key],
          cause: 'tool_error',
          error: String(e instanceof Error ? e.message : e).slice(0, 300),
        },
      ]
      save()
      throw e
    }
    state.inProgress = null
    state.step++
    save()
    checkpoint(key)
  }
  const summary = composeRun(p.resultDir, state, parts.length, tasks)
  writeJson(path.join(p.resultDir, 'run.json'), summary)
  say(
    `끝: Work ${doneWorks(state, parts.length)}/${parts.length}, 봉인 과제 ${Object.keys(state.sealed).length}/${tasks.length}`,
  )
  return summary

  async function doWork(n) {
    const label = `Work ${n + 1}`
    git(p.repo, 'checkout', '-q', 'main')
    const base = git(p.repo, 'rev-parse', 'main')
    const baseDir = exportTree(p.repo, 'main', path.join(p.workDir, 'base-tree'))
    const ws = personaScenario(scenario, n, state.memory)
    const gh = relay3 ? fakeGhSetup(p.workDir, opts.relay3App) : null
    const appEnv = gh ? { ...gh.env, PATH: `${gh.pathDir}:${process.env.PATH ?? ''}` } : {}
    const before = new Set(appWorkIds(p.home))
    const workOut = path.join(p.resultDir, `work-${pad(n)}`)
    say(`${label}/${parts.length} 시작 (기준 ${base.slice(0, 7)})`)
    let result
    if (opts.dry) {
      result = dryWork({
        n,
        repo: p.repo,
        scenarioDir: o.scenarioDir,
        knowledge: ws.knowledge,
        arm,
        ghEnv: gh?.env,
      })
      fs.mkdirSync(workOut, { recursive: true })
    } else {
      result = await runEpisode({
        scenario,
        scenarioDir: o.scenarioDir,
        kind: arm,
        index: o.index,
        opts,
        outDir: workOut,
        workDir: p.workDir,
        overlay: o.overlay ?? null,
        sequence: {
          n,
          fresh: !state.prepared,
          repo: p.repo,
          remote: p.remote,
          base,
          baseDir,
          scenario: ws,
          appEnv,
        },
      })
    }
    const wr = result.workResults?.[0] ?? result.workResult ?? null
    const ending = wr?.ending ?? result.ending
    if (TOOL_ERRORS.has(result.ending) || TOOL_ERRORS.has(ending))
      throw new Error(
        `${label}: 도구 문제로 멈춤 (${result.ending}): ${String(result.error ?? '').slice(0, 300)}`,
      )

    // 기준 브랜치에 넣기
    const fresh = appWorkIds(p.home).filter((id) => !before.has(id))
    const appWorks = relay3
      ? fresh.map((id) =>
          appWorkOf(
            p.home,
            id,
            (result.works ?? []).find((w) => w.id === workLabel(0, id)),
          ),
        )
      : []
    let landing
    if (arm === 'cli') landing = landCli(p.repo, label)
    else if (opts.dry)
      landing = landRelay3(
        p.repo,
        (result.merged ?? []).map((b) => ({ branch: b, merged: true })),
        label,
      )
    else landing = landRelay3(p.repo, appWorks, label)

    // main에서 누적 숨긴 시험. 판정 폴더(숨긴 시험을 겹친 사본)는 줄의 작업 폴더 밖에 두고 바로 지운다: 작업 폴더에 남으면
    // 다음 Work의 에이전트가 레포 위(cli는 한 층, relay-v3 worktree는 두 층)에서 앞으로 올 Work의 숨긴 시험까지 읽을 수 있다
    const defs = activeChecks(scenario, n)
    let rules = null
    const j = withTempDir('relay-judge-', (d) => {
      const tree = exportTree(p.repo, 'main', path.join(d, 'main'))
      // 이 Work를 넣은 main의 규칙 승격(V42 '쓸모없음': 앞 Work에서 승격된 검사가 뒤에 rules에서 빠졌나)
      rules = repoRules(tree)
      return judgeTree({
        tree,
        baseDir,
        hiddenDir: path.join(o.scenarioDir, 'hidden'),
        scenario: { ...ws, checks: defs },
        work: path.join(d, 'work'),
      })
    })
    // Work 에이전트의 격리 감사: 에이전트 설정 폴더는 줄 내내 하나라 누적 수를 state에 두고 이 Work의 몫만 적는다
    const audit = workAudit(p, o)
    const agentCfg = path.join(p.workDir, 'cfg-agent')
    const totals = {
      ...outsideReach(agentCfg, audit.marks, { allow: audit.allow, results: true }),
      github: outsideReach(agentCfg, GITHUB_MARKS).reach,
    }
    const outside = minus(totals, state.outsideTotals)
    state.outsideTotals = totals
    // 바로 앞 Work를 끝낸 main에서 통과했던 시험이 이번에 실패하면 이 Work가 깨뜨린 것이다
    const prev =
      n > 0
        ? (readJson(path.join(p.resultDir, `work-${pad(n - 1)}`, 'sequence.json'), null)?.outcome
            ?.checks ?? [])
        : []
    const cumulative = cumulativeSummary(defs, j.checks, prev)

    // 사람 역할의 기억: 감사가 있으면 감사, 없으면 자기 보고
    const told = wr?.human?.toldAudit ?? wr?.human?.told ?? []
    const before2 = state.memory
    state.memory = rememberWork(state.memory, scenario, n, ws.knowledge, told, ending)
    const retold = state.memory.retold.length - (before2.retold?.length ?? 0)

    const ledger = relay3
      ? ledgerMetrics(
          parseLedger(
            fs.existsSync(path.join(p.home, 'ledger.jsonl'))
              ? fs.readFileSync(path.join(p.home, 'ledger.jsonl'), 'utf8')
              : '',
          ),
          fresh,
        )
      : null
    const record = {
      work: n + 1,
      type: ws.type ?? null,
      ending,
      summary: wr?.summary ?? '',
      base,
      landing,
      mainHead: landing.head,
      outcome: {
        success: outcomeSuccess(j.checks),
        checks: checkView(defs, j.checks),
        repoTestsPass: j.repoTests.pass,
        files: j.files.map((f) => f.file),
        linesChanged: j.linesAdded + j.linesRemoved,
        unrelated: j.unrelated,
        knowledgeFiles: j.knowledgeFiles,
      },
      cumulative,
      knowledge: ws.knowledge.map((k) => ({
        share: k.share,
        rule: k.rule ?? null,
        carry: !!k.carry,
      })),
      told,
      retold,
      human: wr?.human ?? null,
      humanCostUsd: wr?.humanCostUsd ?? null,
      // 이 Work에서 생긴 에이전트 세션의 토큰에 이 Work의 앱 Work가 부른 독립 리뷰(claude -p)를 더한다(M2 규약 P5와 같음)
      agent: wr?.agent
        ? withReviewUsage(wr.agent, sumReviews(appWorks.map((w) => w.review)))
        : null,
      wallMs: wr?.wallMs ?? null,
      prepareMs: result.prepareMs ?? null,
      survey: wr?.survey ?? null,
      appWorks,
      ledger,
      outside,
      rules,
    }
    writeJson(path.join(workOut, 'sequence.json'), record)
    state.works[n] = { done: true, mainHead: landing.head, ending, via: landing.via }
    state.prepared = true
    say(
      `${label} 끝: ${ending}, 넣기 ${landing.via}, 누적 시험 ${cumulative.pass}/${cumulative.total}${cumulative.broken.length ? ` (실패한 앞 Work 시험 ${cumulative.broken.join(',')}${cumulative.regressed.length ? `, 이번에 깨짐 ${cumulative.regressed.join(',')}` : ''})` : ''}${retold ? `, 다시 말함 ${retold}` : ''}`,
    )
  }

  /** 마지막 main의 트리를 임시 폴더에 꺼내 fn에 준다(끝나면 지운다) */
  function withFinalTree(fn) {
    git(p.repo, 'checkout', '-q', 'main')
    return withTempDir('relay-final-', (d) => fn(exportTree(p.repo, 'main', path.join(d, 'tree'))))
  }

  async function doSealed(id) {
    const task = tasks.find((t) => t.id === id)
    say(`봉인 과제 ${tasks.indexOf(task) + 1}/${tasks.length} 시작`)
    // 기준 에이전트는 쪽의 작업 폴더 밖, 쪽 이름이 없는 새 임시 폴더에서 돈다(runSealedTask)
    const r = await withFinalTree((finalTree) =>
      runSealedTask({
        task,
        scenario,
        scenarioDir: o.scenarioDir,
        remote: p.remote,
        finalTree,
        lastActive: activeChecks(scenario, parts.length - 1),
        opts: { ...opts.baseline, dry: !!opts.dry },
        marks: [o.outDir, o.checkpoints],
        runAgent: o.sealedAgent,
      }),
    )
    // 기준 에이전트가 돌지 못한 것(API·CLI 오류, 건식의 패치 실패)은 과제의 실패가 아니라 도구 문제다: 멈추고 --retries로
    // 체크포인트에서 다시 한다. 시간 초과는 과제의 실패로 센다
    if (r.ending === 'error')
      throw new Error(
        `봉인 과제 ${tasks.indexOf(task) + 1}: 기준 에이전트가 돌지 못함 (도구 문제): ${String(r.error ?? '').slice(0, 300)}`,
      )
    writeJson(path.join(p.resultDir, `sealed-${id}.json`), r)
    state.sealed[id] = { done: true, pass: r.pass }
    say(`봉인 과제 ${tasks.indexOf(task) + 1} 끝: ${r.ending}, ${r.pass ? '통과' : '실패'}`)
  }

  function doStructure() {
    const lines = scenario.sequence?.lines ?? {}
    const so = { include: lines.include, maxLines: scenario.sequence?.bait?.maxLines ?? 600 }
    const ledgerFile = path.join(p.home, 'ledger.jsonl')
    const s = {
      base: structureMetrics(path.join(o.scenarioDir, 'repo'), so),
      ...withFinalTree((tree) => ({ final: structureMetrics(tree, so), repo: repoM3(tree) })),
      ledger:
        relay3 && fs.existsSync(ledgerFile)
          ? ledgerMetrics(parseLedger(fs.readFileSync(ledgerFile, 'utf8')))
          : null,
      agentMemory: agentMemory(path.join(p.workDir, 'cfg-agent')),
    }
    writeJson(path.join(p.resultDir, 'structure.json'), s)
    state.structure = { done: true }
  }
}

/** 걸음의 이름(state.attempts의 키) */
export const stepKey = (step) =>
  step.kind === 'work'
    ? `work-${pad(step.n)}`
    : step.kind === 'sealed'
      ? `sealed-${step.id}`
      : 'structure'

/**
 * 에이전트 설정 폴더의 Claude Code 프로젝트 메모리(projects/<작업 폴더 키>/memory 아래 파일). 맨 CLI는 한 레포 경로라 키가 하나로
 * 이어지고, relay-v3 세션은 Work마다 새 worktree라 키가 Work마다 다르다(규약 12절). 프로젝트 키 수, 메모리가 있는 키 수, 파일 수
 */
export function agentMemory(configDir) {
  const dir = path.join(configDir, 'projects')
  const out = { projects: 0, withMemory: 0, files: 0 }
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    out.projects++
    const mem = path.join(dir, e.name, 'memory')
    if (!fs.existsSync(mem)) continue
    const files = fs
      .readdirSync(mem, { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile())
    if (files.length) out.withMemory++
    out.files += files.length
  }
  return out
}

/** 한 줄의 결과를 모은다(run.json). complete는 모든 Work와 봉인 과제, 구조 지표가 끝났는가다 */
export function composeRun(resultDir, state, workCount, tasks) {
  const works = []
  for (let n = 0; n < workCount; n++) {
    const r = readJson(path.join(resultDir, `work-${pad(n)}`, 'sequence.json'), null)
    if (r) works.push(r)
  }
  const sealed = tasks
    .map((t) => readJson(path.join(resultDir, `sealed-${t.id}.json`), null))
    .filter(Boolean)
  return {
    scenario: state.scenario,
    kind: state.arm,
    index: state.index,
    sequence: true,
    complete: works.length === workCount && sealed.length === tasks.length && !!state.structure,
    works,
    sealed,
    structure: readJson(path.join(resultDir, 'structure.json'), null),
    retold: state.memory?.retold ?? [],
    attempts: state.attempts,
    failures: state.failures ?? {},
    options: state.options,
  }
}
