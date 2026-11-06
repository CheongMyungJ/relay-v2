// 장기 평가의 봉인 과제(docs/eval.md 5절, relay-v3 docs/m3-design.md 6절 '뒤 Work 비용'): 요청 열이 끝난 뒤 각 쪽의 마지막
// 레포(원격 main) 사본에서 같은 기준 에이전트가 사람 없이 과제를 한다. 기준 에이전트는 맨 claude CLI 하나(claude -p, 권한 확인
// 없음, 쪽과 상관없이 같은 모델·effort·시간 제한·프롬프트)이고, 레포에 남은 것(CLAUDE.md, docs/knowledge, .relay/)은 그대로
// 읽을 수 있다. 판정은 그 과제의 숨긴 시험(sealed/hidden)과, 마지막 Work의 누적 시험 가운데 과제가 뺀 것을 뺀 것이다.
// 봉인: 과제의 시험 이름과 출력을 결과에 남기지 않는다(통과 여부와 차례 번호만). 누적 시험은 id(w01-1 등)와 통과만 남긴다.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { cleanEnv, findClaude, makeClaudeConfig } from './env.mjs'
import { judgeTree } from './repo.mjs'
import { cloneMain } from './sequence-git.mjs'
import { keptChecks, sealedPass } from './sequence.mjs'
import { agentUsage, git, run } from './util.mjs'

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
 * @param {string} o.workDir 이 과제의 작업 폴더
 * @param {{ model: string, effort: string, minutes: number, dry?: boolean }} o.opts
 */
export async function runSealedTask(o) {
  const { task, scenario, opts } = o
  const sealedDir = path.join(o.scenarioDir, scenario.sequence?.sealed?.dir ?? 'sealed')
  fs.rmSync(o.workDir, { recursive: true, force: true })
  const { repo, head } = cloneMain(o.remote, path.join(o.workDir, 'repo'))
  const configDir = makeClaudeConfig(path.join(o.workDir, 'cfg-sealed'))
  let ran
  if (opts.dry) {
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
  const own = judgeTree({
    tree: repo,
    baseDir: o.finalTree,
    hiddenDir: path.join(sealedDir, 'hidden'),
    scenario: judgeScenario(task.checks ?? []),
    work: path.join(o.workDir, 'judge-own'),
  })
  const kept = keptChecks(o.lastActive, task)
  const cumulative = judgeTree({
    tree: repo,
    baseDir: o.finalTree,
    hiddenDir: path.join(o.scenarioDir, 'hidden'),
    scenario: judgeScenario(kept),
    work: path.join(o.workDir, 'judge-kept'),
  })
  const agent = agentUsage(configDir)
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
    pass: sealedPass(own.checks, cumulative.checks),
    own: {
      total: own.checks.length,
      pass: own.checks.filter((c) => c.pass).length,
      checks: sealedView(own.checks),
    },
    kept: {
      total: cumulative.checks.length,
      pass: cumulative.checks.filter((c) => c.pass).length,
      retired: (task.retires ?? []).length,
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
