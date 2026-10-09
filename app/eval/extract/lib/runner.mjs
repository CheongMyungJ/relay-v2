// extract run 하나를 평가 조건으로 돌린다(결정 17): 시나리오 레포를 기준 커밋으로 만들고, 쪽의 조립본(지시·스키마)과
// 손으로 쓴 패킷으로 도구를 켠 claude -p를 부른다. 실행 인자는 앱과 같은 skills/extract/run.mjs의 runArgs다.
// 끝 판정은 15.3절을 따른다: 종료 코드 0, 오류 아님, 구조화 출력이 있고 조립한 스키마를 통과, 마지막 Stop에
// 백그라운드 작업 없음. worktree가 기준과 다르면 관문(0이어야 함) 위반으로 남긴다(결정 23, 39).
// 부드러운 마감(결정 25): 마감이 지나면 훅이 탐색 도구를 PreToolUse에서 거부하며 미완료와 checkpoint를 내라고 한다.
// 하드 상한이 지나면 프로세스 트리를 끝내고 실패로 친다.
// 제출 검사(결정 13·45의 1번 길, AI 결정 88): o.buildIndex(구성별 빌드 인덱스)가 있으면 StructuredOutput을 PreToolUse에서
// 규칙 config_active로 검사해 걸리면 이유와 함께 거부한다. 되돌림은 2회까지이고 그 뒤의 제출은 그대로 받아 남은 문제를 기록한다.
// integrate·review·summarize의 패킷은 시나리오의 기록으로 run 때 만든다(tasks.mjs, AI 결정 109, 127). integrate의 기록 목록은
// run의 작업 폴더(레포와 scratch 옆)에 쓰고 그 절대 경로를 패킷에 넣는다. 결과 폴더에도 사본(listing.md)을 남긴다.
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { checkResult } from '../../../../skills/extract/rules.mjs'
import { runArgs } from '../../../../skills/extract/run.mjs'
import { cleanEnv } from '../../lib/env.mjs'
import { copyTree } from '../../lib/util.mjs'
import { buildSide } from './sides.mjs'
import { renderTask } from './tasks.mjs'

export { renderPacket } from './tasks.mjs'

const TOKEN_ENV = 'RELAY_HOOK_TOKEN'
const SUBMIT_RULES = ['config_active']
const MAX_SUBMIT_DENIALS = 2
const EXPLORE = new Set(['Read', 'Grep', 'Glob', 'Bash'])
const HOOK_EVENTS = [
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'SessionEnd',
]
export const SOFT_REASON =
  'relay: the soft deadline for this run has passed. Do not explore further. Submit the structured output now: set outcome to incomplete, report what you confirmed, and fill checkpoint with what you checked, what remains and where to look next.'
/** summarize 결과에는 outcome과 checkpoint가 없다 */
export const SOFT_REASON_SUMMARIZE =
  'relay: the soft deadline for this run has passed. Do not explore further. Submit the structured output now with what you have written.'
/** 부드러운 마감의 거부 이유(종류마다 결과 칸이 다르다) */
export const softReason = (kind) => (kind === 'summarize' ? SOFT_REASON_SUMMARIZE : SOFT_REASON)
/** 제출 검사에 걸렸을 때의 이유(결정 13: 지적된 것만 고치고 다른 판단은 바꾸지 않는다) */
export function submitReason(problems) {
  return [
    "relay: the app's build index for each configuration disagrees with these items:",
    ...problems.map((p) => `- ${p}`),
    'Fix only these items: list the configurations whose build defines or compiles them, or correct the anchor if it cites the wrong lines. Keep everything else as it is and submit again.',
  ].join('\n')
}

/** 결과 하나의 제출 검사 문제 */
export function submitProblems(output, buildIndex) {
  return checkResult(output, { build: buildIndex })
    .filter((p) => SUBMIT_RULES.includes(p.rule))
    .map((p) => p.problem)
}

const FAKE = path.resolve(import.meta.dirname, '../../../test/support/fake-claude/print-run.mjs')

/** 시나리오 레포를 기준 커밋으로. 같은 내용이면 같은 커밋 id가 나오게 작성자와 시각을 고정한다 */
export function prepareRepo(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true })
  copyTree(src, dst)
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'relay-eval',
    GIT_AUTHOR_EMAIL: 'eval@relay.invalid',
    GIT_COMMITTER_NAME: 'relay-eval',
    GIT_COMMITTER_EMAIL: 'eval@relay.invalid',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00+00:00',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00+00:00',
  }
  const git = (...a) =>
    execFileSync('git', ['-c', 'core.autocrlf=false', ...a], { cwd: dst, env })
      .toString()
      .trim()
  git('init', '-q', '-b', 'main')
  git('add', '-A')
  git('commit', '-qm', 'base')
  return git('rev-parse', 'HEAD')
}

/** worktree가 기준 커밋 그대로인가: HEAD가 같고 바뀐·새 파일이 없다(무시된 파일 포함) */
export function worktreeChanged(dir, base) {
  const git = (...a) =>
    execFileSync('git', ['-c', 'core.autocrlf=false', ...a], { cwd: dir }).toString()
  const head = git('rev-parse', 'HEAD').trim()
  const status = git('status', '--porcelain', '--untracked-files=all', '--ignored').trim()
  return head !== base || status !== ''
}

function ruleAbs(p) {
  const posix = p.replace(/\\/g, '/')
  const m = /^([A-Za-z]):\/(.*)$/.exec(posix)
  return m ? `//${m[1].toLowerCase()}/${m[2]}` : `/${posix}`
}

function killTree(child) {
  if (!child.pid) return
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' })
    } catch {
      // 이미 끝났다
    }
  } else child.kill('SIGKILL')
}

/** stream-json에서 사용량 한도 실패를 가른다(결정 29). 녹화 못 함: 바이너리 문자열과 rate_limit_event의 모양으로 둔 가정 */
export function usageLimit(messages) {
  const rejected = messages.find(
    (m) => m.type === 'rate_limit_event' && m.rate_limit_info?.status === 'rejected',
  )
  const apiErr = messages.find(
    (m) =>
      m.type === 'assistant' &&
      (m.error === 'rate_limit' ||
        m.apiError === 'usage_limit_reached' ||
        m.api_error === 'usage_limit_reached'),
  )
  const result = messages.find((m) => m.type === 'result')
  const info =
    rejected?.rate_limit_info ??
    apiErr?.apiErrorParams?.rate_limit_info ??
    apiErr?.api_error_params?.rate_limit_info ??
    null
  const limited =
    !!rejected || !!apiErr || (result?.is_error === true && result?.api_error_status === 429)
  if (!limited) return null
  return { type: info?.rateLimitType ?? null, resetsAt: info?.resetsAt ?? null }
}

/**
 * run 하나.
 * @param {{ scenarioDir: string, scenario: object, task: object, side: string, label: string, rep: number,
 *   model: string, effort: string, outDir: string, workRoot: string, bin: string, dry?: boolean, fakePlan?: string,
 *   softMs: number, hardMs: number, buildIndex?: object | null }} o
 */
export async function runOne(o) {
  const id = `${o.label}.${o.scenario.id}.${o.task.id}.${o.rep}`
  const dir = path.join(o.outDir, 'runs', id)
  fs.mkdirSync(dir, { recursive: true })
  const work = path.join(o.workRoot, id)
  const wt = path.join(work, 'repo')
  const scratch = path.join(work, 'scratch')
  fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(scratch, { recursive: true })
  const base = prepareRepo(path.join(o.scenarioDir, 'repo'), wt)

  const listingPath = o.task.kind === 'integrate' ? path.join(work, 'listing.md') : null
  const input = renderTask(o.scenarioDir, o.task, {
    repo: wt,
    base,
    scratch,
    soft: o.softMs / 60_000,
    hard: o.hardMs / 60_000,
    listing: listingPath,
  })
  const built = buildSide(o.side, o.task.kind, o.task.lens ?? null, input.more)
  const instructionsPath = path.join(dir, 'instructions.md')
  fs.writeFileSync(instructionsPath, built.instructions)
  fs.writeFileSync(path.join(dir, 'schema.json'), built.schemaArg)
  const packet = input.packet
  fs.writeFileSync(path.join(dir, 'packet.md'), packet)
  if (input.listing !== null) {
    fs.writeFileSync(listingPath, input.listing)
    fs.writeFileSync(path.join(dir, 'listing.md'), input.listing)
  }

  const started = Date.now()
  const hooks = []
  let softHit = false
  /** @type {{ at: number, problems: string[], denied: boolean }[]} */
  const submits = []
  const server = http.createServer((req, res) => {
    let text = ''
    req.on('data', (c) => (text += c))
    req.on('end', () => {
      const event = /\/([A-Za-z]+)$/.exec(req.url ?? '')?.[1]
      let body
      try {
        body = JSON.parse(text)
      } catch {
        body = { invalid: text }
      }
      hooks.push({ at: Date.now() - started, event, body })
      let answer = {}
      if (event === 'PreToolUse' && body.tool_name === 'StructuredOutput' && o.buildIndex) {
        const problems = submitProblems(body.tool_input ?? {}, o.buildIndex)
        const denied =
          problems.length > 0 && submits.filter((x) => x.denied).length < MAX_SUBMIT_DENIALS
        submits.push({ at: Date.now() - started, problems, denied })
        if (denied)
          answer = {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: submitReason(problems),
            },
          }
      } else if (
        event === 'PreToolUse' &&
        EXPLORE.has(body.tool_name) &&
        Date.now() - started > o.softMs
      ) {
        softHit = true
        answer = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: softReason(o.task.kind),
          },
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(answer))
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const hook = (event) => [
    {
      hooks: [
        {
          type: 'http',
          url: `http://127.0.0.1:${port}/hook/${id}/${event}`,
          headers: { Authorization: `Bearer $${TOKEN_ENV}` },
          allowedEnvVars: [TOKEN_ENV],
          timeout: 600,
        },
      ],
    },
  ]
  const settingsPath = path.join(dir, 'settings.json')
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        hooks: Object.fromEntries(HOOK_EVENTS.map((e) => [e, hook(e)])),
        autoMemoryEnabled: false,
        permissions: {
          deny: [
            `Write(${ruleAbs(wt)}/**)`,
            `Edit(${ruleAbs(wt)}/**)`,
            // 기록 목록은 읽기 전용이다(AI 결정 109)
            ...(listingPath
              ? [`Write(${ruleAbs(listingPath)})`, `Edit(${ruleAbs(listingPath)})`]
              : []),
          ],
        },
      },
      null,
      2,
    ),
  )

  const sessionId = randomUUID()
  const args = runArgs({
    model: o.model,
    effort: o.effort,
    schema: built.schemaArg,
    instructionsPath,
    settingsPath,
    addDirs: [wt],
    sessionId,
  })
  const env = cleanEnv({
    [TOKEN_ENV]: 'eval-token',
    ...(o.dry ? { FAKE_CLAUDE_RUN: o.fakePlan } : {}),
  })
  const [file, argv] = o.dry ? [process.execPath, [FAKE, ...args]] : [o.bin, args]
  const child = spawn(file, argv, { cwd: scratch, env, stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  let timedOut = false
  child.stdout.on('data', (c) => (stdout += c))
  child.stderr.on('data', (c) => (stderr += c))
  child.stdin.end(packet)
  const timer = setTimeout(() => {
    timedOut = true
    killTree(child)
  }, o.hardMs)
  const code = await new Promise((r) => {
    child.on('error', () => r(null))
    child.on('close', (c) => r(c))
  })
  clearTimeout(timer)
  const ms = Date.now() - started
  await new Promise((r) => setTimeout(r, 500))
  await new Promise((r) => server.close(() => r()))
  fs.writeFileSync(path.join(dir, 'stdout.jsonl'), stdout)
  if (stderr) fs.writeFileSync(path.join(dir, 'stderr.txt'), stderr)
  fs.writeFileSync(
    path.join(dir, 'hooks.jsonl'),
    hooks.map((h) => JSON.stringify(h)).join('\n') + '\n',
  )

  const messages = stdout
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .flatMap((l) => {
      try {
        return [JSON.parse(l)]
      } catch {
        return []
      }
    })
  const result = messages.find((m) => m.type === 'result') ?? null
  const init = messages.find((m) => m.type === 'system' && m.subtype === 'init') ?? null
  const output = result?.structured_output ?? null
  const limited = usageLimit(messages)
  const windows = [...messages].reverse().find((m) => m.type === 'rate_limit_event')
    ?.rate_limit_info?.unifiedWindows

  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const validate = ajv.compile(built.schema)
  const schemaValid = output ? validate(output) : false
  const stops = hooks.filter((h) => h.event === 'Stop')
  const lastStopBackground = stops.at(-1)?.body?.background_tasks ?? null
  const changed = worktreeChanged(wt, base)
  const filesRead = [
    ...new Set(
      hooks
        .filter((h) => h.event === 'PostToolUse' && h.body.tool_name === 'Read')
        .map((h) => h.body.tool_input?.file_path),
    ),
  ]

  let failure = null
  if (timedOut) failure = 'hard_timeout'
  else if (limited) failure = 'usage_limit'
  else if (code !== 0) failure = `exit_${code}`
  else if (!result) failure = 'no_result'
  else if (result.is_error) failure = `error_${result.subtype}`
  else if (!output) failure = 'no_structured_output'
  else if (!schemaValid) failure = 'schema'
  else if (!Array.isArray(lastStopBackground) || lastStopBackground.length)
    failure = 'background_tasks'

  const record = {
    id,
    label: o.label,
    side: o.side,
    scenario: o.scenario.id,
    task: o.task.id,
    kind: o.task.kind,
    lens: o.task.lens ?? null,
    rep: o.rep,
    model: o.model,
    effort: o.effort,
    dry: !!o.dry,
    base,
    repo: wt,
    hashes: built.hashes,
    sessionId,
    startedAt: new Date(started).toISOString(),
    ms,
    exitCode: code,
    failure,
    usageLimit: limited,
    // 이 run이 받은 마지막 rate_limit_event의 창별 사용률(%, @internal 필드). get_usage는 오래된 값을 줄 수 있다(녹화)
    observedUsage: windows
      ? {
          weeklyPct:
            typeof windows.seven_day?.utilization === 'number'
              ? Math.round(windows.seven_day.utilization * 100)
              : null,
          fiveHourPct:
            typeof windows.five_hour?.utilization === 'number'
              ? Math.round(windows.five_hour.utilization * 100)
              : null,
        }
      : null,
    softDeadlineHit: softHit,
    // 제출 검사(o.buildIndex가 있을 때만): 제출마다 걸린 문제와 거부 여부. remaining은 받아들인 제출에 남은 문제
    submitCheck: o.buildIndex
      ? {
          rules: SUBMIT_RULES,
          submits,
          denials: submits.filter((x) => x.denied).length,
          remaining: output ? submitProblems(output, o.buildIndex) : null,
        }
      : null,
    worktreeChanged: changed,
    schemaValid,
    schemaErrors: schemaValid
      ? []
      : (validate.errors ?? []).slice(0, 20).map((e) => `${e.instancePath || '/'} ${e.message}`),
    lastStopBackground,
    init: init
      ? {
          tools: init.tools,
          mcp_servers: init.mcp_servers,
          skills: init.skills,
          model: init.model,
          version: init.claude_code_version,
        }
      : null,
    result: result
      ? {
          subtype: result.subtype,
          is_error: result.is_error,
          num_turns: result.num_turns,
          duration_ms: result.duration_ms,
          total_cost_usd: result.total_cost_usd,
          usage: result.usage,
          modelUsage: result.modelUsage,
          terminal_reason: result.terminal_reason,
          permission_denials: (result.permission_denials ?? []).length,
        }
      : null,
    filesRead,
    output,
  }
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(record, null, 2))
  fs.rmSync(work, { recursive: true, force: true })
  return record
}

export const WORK_ROOT = path.join(os.tmpdir(), 'relay-extract-eval')
