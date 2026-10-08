// extract run 하나를 평가 조건으로 돌린다(결정 17): 시나리오 레포를 기준 커밋으로 만들고, 쪽의 조립본(지시·스키마)과
// 손으로 쓴 패킷으로 도구를 켠 claude -p를 부른다. 실행 인자는 앱과 같은 skills/extract/run.mjs의 runArgs다.
// 끝 판정은 15.3절을 따른다: 종료 코드 0, 오류 아님, 구조화 출력이 있고 조립한 스키마를 통과, 마지막 Stop에
// 백그라운드 작업 없음. worktree가 기준과 다르면 관문(0이어야 함) 위반으로 남긴다(결정 23, 39).
// 부드러운 마감(결정 25): 마감이 지나면 훅이 탐색 도구를 PreToolUse에서 거부하며 미완료와 checkpoint를 내라고 한다.
// 하드 상한이 지나면 프로세스 트리를 끝내고 실패로 친다.
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { runArgs } from '../../../../skills/extract/run.mjs'
import { cleanEnv } from '../../lib/env.mjs'
import { copyTree } from '../../lib/util.mjs'
import { buildSide } from './sides.mjs'

const TOKEN_ENV = 'RELAY_HOOK_TOKEN'
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

export function renderPacket(template, vars) {
  return template.replace(/\{(repo|base|scratch)\}/g, (_, k) => vars[k])
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
 *   softMs: number, hardMs: number }} o
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

  const built = buildSide(o.side, o.task.kind, o.task.lens ?? null)
  const instructionsPath = path.join(dir, 'instructions.md')
  fs.writeFileSync(instructionsPath, built.instructions)
  fs.writeFileSync(path.join(dir, 'schema.json'), built.schemaArg)
  const packet = renderPacket(fs.readFileSync(path.join(o.scenarioDir, o.task.packet), 'utf8'), {
    repo: wt,
    base,
    scratch,
  })
  fs.writeFileSync(path.join(dir, 'packet.md'), packet)

  const started = Date.now()
  const hooks = []
  let softHit = false
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
      if (
        event === 'PreToolUse' &&
        EXPLORE.has(body.tool_name) &&
        Date.now() - started > o.softMs
      ) {
        softHit = true
        answer = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: SOFT_REASON,
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
        permissions: { deny: [`Write(${ruleAbs(wt)}/**)`, `Edit(${ruleAbs(wt)}/**)`] },
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
    softDeadlineHit: softHit,
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
