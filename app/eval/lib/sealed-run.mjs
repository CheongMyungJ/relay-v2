// 장기 평가의 봉인 과제(docs/eval.md 5절, relay-v3 docs/m3-design.md 6절 '뒤 Work 비용'): 요청 열이 끝난 뒤 각 쪽의 마지막
// 레포(원격 main) 사본에서 같은 기준 에이전트가 사람 없이 과제를 한다. 기준 에이전트는 맨 claude CLI 하나(claude -p, 권한 확인
// 없음, 쪽과 상관없이 같은 모델·effort·시간 제한·프롬프트)이고, 레포에 남은 것(CLAUDE.md, docs/knowledge, .relay/)은 그대로
// 읽을 수 있다. 판정은 그 과제의 숨긴 시험(sealed/hidden)과, 마지막 Work의 누적 시험 가운데 과제가 뺀 것을 뺀 것이다.
// 누적 시험은 과제 전 마지막 main에서도 판정해, 거기서 이미 실패하던 것(preBroken, 쪽의 C2가 센다)은 과제의 통과에 세지 않는다.
// 봉인: 과제의 시험 이름과 출력을 결과에 남기지 않는다(통과 여부와 차례 번호만). 누적 시험은 id(w01-1 등)와 통과만 남긴다.
// 격리: 기준 에이전트는 쪽의 작업 폴더 밖, 쪽 이름도 회차도 없는 새 임시 폴더(task-XXXXXX)에서 돌고(Claude Code는 cwd를 시스템
// 프롬프트에 넣는다), 판정은 또 다른 임시 폴더에서 한다. 둘 다 과제가 끝나면 지운다(앞 과제의 판정이 뒤 과제에 닿지 않게).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cleanEnv, findClaude, makeClaudeConfig } from './env.mjs'
import { judgeTree } from './repo.mjs'
import { cloneMain } from './sequence-git.mjs'
import { keptChecks, sealedPass } from './sequence.mjs'
import { agentUsage, git, run, withTempDir } from './util.mjs'

/** 기준 에이전트에게 주는 글: 과제의 요청 뒤에 붙는 한 줄(모든 쪽에 같다) */
export const BASELINE_NOTE =
  '(이 요청을 한 사람에게는 물을 수 없다. 요청과 레포만 보고 끝까지 하고, 바꾼 것을 커밋한다.)'

/** 기준 에이전트의 프롬프트 */
export const baselinePrompt = (task) =>
  [...(Array.isArray(task.report) ? task.report : [task.report]), '', BASELINE_NOTE].join('\n')

/**
 * claude -p를 레포에서 한 번 돌린다(도구는 기본, 권한 확인 없음). 프롬프트는 표준 입력으로 준다
 * @returns {Promise<{ ending: 'done' | 'timeout' | 'error', ms: number, costUsd: number | null, result: object | null, error: string | null }>}
 */
function runBaseline({ prompt, cwd, configDir, model, effort, timeoutMs }) {
  const args = ['-p', '--model', model, '--output-format', 'json', '--dangerously-skip-permissions']
  const env = cleanEnv({ CLAUDE_CONFIG_DIR: configDir, CLAUDE_CODE_EFFORT_LEVEL: effort })
  const started = Date.now()
  return new Promise((resolve) => {
    const p = spawn(findClaude(), args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      p.kill('SIGKILL')
    }, timeoutMs)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => {
      clearTimeout(timer)
      let result = null
      try {
        result = JSON.parse(out)
      } catch {
        // 시간 초과나 오류로 JSON이 없다
      }
      resolve({
        ending: timedOut ? 'timeout' : code === 0 ? 'done' : 'error',
        ms: Date.now() - started,
        costUsd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
        result,
        error: code === 0 ? null : (err || out).slice(-1000),
      })
    })
    p.stdin.end(prompt)
  })
}

/**
 * 기준 에이전트가 자기 폴더 밖의 평가 자료에 손댔나(격리 감사): 대화 기록의 도구 호출 가운데 입력이 평가의 자리(시나리오 폴더와
 * 숨긴 시험, 줄의 작업 폴더, 판정·마지막 트리 임시 폴더)를 가리키는 수. 격리는 폴더를 떼어 둘 뿐 같은 사용자의 파일 읽기를
 * 막지 못하므로(평가 도구의 시나리오 폴더는 디스크에 평문으로 있다) 닿았는지를 센다. 0이 아니면 그 과제는 봉인이 깨졌을 수 있다
 * @param {string} configDir 기준 에이전트의 설정 폴더(대화 기록)
 * @param {string[]} marks 가리키면 센다(경로 또는 경로 조각)
 * @returns {{ calls: number, reach: number }} 도구 호출 수와 그 가운데 평가 자리를 가리킨 수
 */
export function outsideReach(configDir, marks) {
  const out = { calls: 0, reach: 0 }
  const seen = new Set()
  const dir = path.join(configDir, 'projects')
  if (!fs.existsSync(dir)) return out
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.jsonl'))
        for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
          if (!line.includes('"tool_use"')) continue
          let content
          try {
            content = JSON.parse(line).message?.content
          } catch {
            continue
          }
          for (const c of Array.isArray(content) ? content : []) {
            if (c?.type !== 'tool_use' || seen.has(c.id)) continue
            seen.add(c.id)
            out.calls++
            const text = JSON.stringify(c.input ?? {})
            if (marks.some((m) => m && text.includes(m))) out.reach++
          }
        }
    }
  }
  walk(dir)
  return out
}

/** 평가의 자리(outsideReach): 시나리오 폴더, 평가 도구가 쓰는 임시 폴더들의 이름. 봉인 과제의 폴더(task-)는 넣지 않는다 */
export const evalMarks = (scenarioDir) => [
  path.resolve(scenarioDir),
  'eval/scenarios',
  'sealed/hidden',
  'reference-',
  path.join(os.tmpdir(), 'relay-eval'),
  'relay-judge-',
  'relay-final-',
  'eval-hidden',
]

/** 시험 결과에서 봉인할 것을 뺀다: 과제의 시험은 차례 번호와 통과만, 누적 시험은 이름과 통과만 */
const sealedView = (checks) => checks.map((c, k) => ({ k: k + 1, pass: c.pass }))
const keptView = (checks) => checks.map((c) => ({ name: c.name, pass: c.pass }))

/**
 * 봉인 과제 하나를 돌리고 판정한다.
 * @param {object} o
 * @param {{ id: string, type?: string, report: string | string[], checks: object[], retires?: string[] }} o.task
 * @param {object} o.scenario
 * @param {string} o.scenarioDir
 * @param {string} o.remote 그 쪽의 원격(bare). main이 마지막 레포다
 * @param {string} o.finalTree 마지막 main의 트리(판정 diff의 기준)
 * @param {object[]} o.lastActive 마지막 Work의 누적 시험(activeChecks)
 * @param {{ model: string, effort: string, minutes: number, dry?: boolean }} o.opts
 * @param {typeof runBaseline} [o.runAgent] 시험용: 기준 에이전트 대신 부를 것(runBaseline과 같은 인자와 결과)
 */
export function runSealedTask(o) {
  return withTempDir('task-', (dir) => sealedIn(o, dir))
}

async function sealedIn(o, dir) {
  const { task, scenario, opts } = o
  const sealedDir = path.join(o.scenarioDir, scenario.sequence?.sealed?.dir ?? 'sealed')
  const { repo, head } = cloneMain(o.remote, path.join(dir, 'repo'))
  const configDir = makeClaudeConfig(path.join(dir, 'cfg'))
  let ran
  if (o.runAgent) {
    ran = await o.runAgent({
      prompt: baselinePrompt(task),
      cwd: repo,
      configDir,
      model: opts.model,
      effort: opts.effort,
      timeoutMs: opts.minutes * 60_000,
    })
  } else if (opts.dry) {
    // 건식: 기준 에이전트 대신 과제의 정답 패치를 얹는다(도구의 길을 확인한다. 모델을 부르지 않는다)
    const patch = path.join(sealedDir, `reference-${task.id}.patch`)
    const r = run('git', ['apply', '--whitespace=nowarn', patch], { cwd: repo })
    ran = {
      ending: r.code === 0 ? 'done' : 'error',
      ms: 0,
      costUsd: 0,
      result: null,
      error: r.code === 0 ? null : 'apply 실패',
    }
  } else {
    ran = await runBaseline({
      prompt: baselinePrompt(task),
      cwd: repo,
      configDir,
      model: opts.model,
      effort: opts.effort,
      timeoutMs: opts.minutes * 60_000,
    })
  }
  const judgeScenario = (checks) => ({ ...scenario, checks })
  // 판정은 기준 에이전트가 끝난 뒤 다른 임시 폴더에서 하고 바로 지운다
  const judge = (tree, hiddenDir, checks) =>
    withTempDir('relay-judge-', (work) =>
      judgeTree({ tree, baseDir: o.finalTree, hiddenDir, scenario: judgeScenario(checks), work }),
    )
  const own = judge(repo, path.join(sealedDir, 'hidden'), task.checks ?? [])
  const kept = keptChecks(o.lastActive, task)
  const cumulativeHidden = path.join(o.scenarioDir, 'hidden')
  const cumulative = judge(repo, cumulativeHidden, kept)
  // 과제 전(마지막 main)의 남은 누적 시험: 거기서 이미 실패하던 것은 기준 에이전트의 탓이 아니다
  const before = judge(o.finalTree, cumulativeHidden, kept).checks
  const passedBefore = new Set(before.filter((c) => c.pass).map((c) => c.name))
  const agent = agentUsage(configDir)
  const outside = outsideReach(configDir, evalMarks(o.scenarioDir))
  let commits = null
  try {
    commits = Number(git(repo, 'rev-list', '--count', `${head}..HEAD`))
  } catch {
    // 세지 못해도 된다
  }
  return {
    id: task.id,
    type: task.type ?? null,
    ending: ran.ending,
    error: ran.error,
    wallMs: ran.ms,
    costUsd: ran.costUsd,
    agent,
    outside,
    pass: sealedPass(own.checks, cumulative.checks, before),
    own: {
      total: own.checks.length,
      pass: own.checks.filter((c) => c.pass).length,
      checks: sealedView(own.checks),
    },
    kept: {
      total: cumulative.checks.length,
      pass: cumulative.checks.filter((c) => c.pass).length,
      retired: (task.retires ?? []).length,
      preBroken: kept.filter((c) => !passedBefore.has(c.name)).length,
      broke: cumulative.checks.filter((c) => !c.pass && passedBefore.has(c.name)).length,
      checks: keptView(cumulative.checks),
    },
    repoTestsPass: own.repoTests.pass,
    files: own.files.length,
    lines: own.linesAdded + own.linesRemoved,
    commits,
    uncommitted: git(repo, 'status', '--porcelain').split('\n').filter(Boolean).length,
    options: { model: opts.model, effort: opts.effort, minutes: opts.minutes, dry: !!opts.dry },
  }
}
