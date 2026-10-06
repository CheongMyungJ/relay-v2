import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { CODEX_HOOK_EVENTS, codexFirstPrompt, tomlValue } from '../core/codex'
import {
  HOOK_TOKEN_ENV,
  STOP_HOOK_TIMEOUT_SEC,
  relaySkillName,
  type LaunchInput,
  type ResumeInput,
} from '../core/settings'
import type { SkillName } from '../shared/config'
import type { WorkType } from '../shared/work'
import type { AgentSettingsInput } from './agent'
import {
  skillText,
  type AuthStatus,
  type ClaudeJsonInput,
  type ClaudeJsonResult,
  type DeployedSkill,
  type FindClaudeOptions,
} from './claude'
import { describeFailure, run } from './exec'
import { sha256, writeFileAtomic } from './store'

export const CODEX_INSTALL_GUIDE =
  'codex 실행 파일을 찾지 못했습니다. Codex CLI를 설치하세요 (npm install -g @openai/codex, 안내: https://developers.openai.com/codex/cli). 다른 위치라면 CODEX_BIN 환경 변수로 경로를 알려 주세요.'

export function findCodex(opts: FindClaudeOptions = {}): string | null {
  const env = opts.env ?? process.env
  const exists = opts.exists ?? fs.existsSync
  // 경로가 아닌 명령 이름이면 그대로 쓴다: 실행할 때 PATH에서 찾는다 (findClaude와 같음)
  const bin = env['CODEX_BIN']
  if (bin) return !/[\\/]/.test(bin) || exists(bin) ? bin : null
  const platform = opts.platform ?? process.platform
  const p = platform === 'win32' ? path.win32 : path.posix
  const candidates: string[] = []
  if (platform === 'win32') {
    if (env['APPDATA']) candidates.push(p.join(env['APPDATA'], 'npm', 'codex.cmd'))
    if (env['USERPROFILE'])
      candidates.push(p.join(env['USERPROFILE'], '.local', 'bin', 'codex.exe'))
  }
  const names = platform === 'win32' ? ['codex.exe', 'codex.cmd'] : ['codex']
  for (const dir of (env['PATH'] ?? env['Path'] ?? '').split(platform === 'win32' ? ';' : ':')) {
    if (dir) for (const name of names) candidates.push(p.join(dir, name))
  }
  return candidates.find(exists) ?? null
}

/** 번호만으로 허용하지 않고 필수 실행 기능을 실제 CLI에서 확인한다. */
export async function codexVersion(bin: string, env?: NodeJS.ProcessEnv): Promise<string> {
  const [version, help, features] = await Promise.all([
    run(bin, ['--version'], { env }),
    run(bin, ['--help'], { env }),
    run(bin, ['features', 'list'], { env }),
  ])
  if (version.code !== 0) throw new Error(`codex --version 실패: ${describeFailure(version)}`)
  if (
    help.code !== 0 ||
    !help.stdout.includes('--no-daemon') ||
    !help.stdout.includes('--dangerously-bypass-approvals-and-sandbox') ||
    features.code !== 0 ||
    !/^hooks\s/m.test(features.stdout)
  ) {
    throw new Error(
      `이 Codex CLI는 relay가 필요한 hooks와 --no-daemon 실행을 지원하지 않습니다 (${version.stdout.trim()}). Codex CLI를 업데이트하세요.`,
    )
  }
  return version.stdout.trim()
}

export async function codexAuthStatus(bin: string, env?: NodeJS.ProcessEnv): Promise<AuthStatus> {
  await codexVersion(bin, env)
  const result = await run(bin, ['login', 'status'], { env })
  if (result.code !== 0) return { ok: false, detail: describeFailure(result) }
  return { ok: true, detail: '로그인 및 필수 기능 확인됨' }
}

export function codexSkillPath(taskDir: string, skill: SkillName): string {
  return path.join(taskDir, '.agents', 'skills', relaySkillName(skill), 'SKILL.md')
}

/** 외부 스킬 경로는 발견을 가정하지 않고 첫 프롬프트와 MCP instructions로 전달한다. */
export async function deployCodexSkill(o: {
  source: string
  workDir: string
  taskDir?: string
  skill: SkillName
  type: WorkType
}): Promise<DeployedSkill> {
  const original = await skillText(o.source, o.skill, o.type)
  const body = original
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replaceAll('`AskUserQuestion`', '`mcp__relay__ask_human`')
  const writing =
    'Write or update current task artifacts and handoff.md with apply_patch. Shell redirects or heredocs containing previous task paths can be rejected by the conservative file guard, even when those paths are only references in the document. Never edit app-owned files or previous task files, and never bypass a tool denial.\n\n'
  const content = `---\nname: ${relaySkillName(o.skill)}\ndescription: The active relay ${o.skill} task. Follow only this step and wait for human answers through relay MCP.\n---\n${writing}${body}`
  const file = codexSkillPath(o.taskDir ?? o.workDir, o.skill)
  await writeFileAtomic(file, content)
  return { file, hash: `sha256:${sha256(content)}` }
}

function codexResourcePath(name: string): string {
  const installed = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  const candidate = installed ? path.join(installed, name) : null
  return candidate && fs.existsSync(candidate)
    ? candidate
    : path.resolve(__dirname, '../../scripts', name)
}

export interface CodexSettings {
  overrides: Record<string, unknown>
  skillPath?: string
}

export function codexBridgePath(): string {
  return codexResourcePath('codex-bridge.mjs')
}

/** 긴 설치 경로를 반복하지 않는다. cmd.exe의 8191자 제한과 경로 해석 문제를 피한다. */
export function bridgeCommands(): { command: string; commandWindows: string } {
  const windows = "$ErrorActionPreference='Stop'; & $env:RELAY_CODEX_HOOK_PS; exit $LASTEXITCODE"
  return {
    command: 'ELECTRON_RUN_AS_NODE=1 "$RELAY_CODEX_EXE" "$RELAY_CODEX_BRIDGE" hook',
    commandWindows: `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${Buffer.from(windows, 'utf16le').toString('base64')}`,
  }
}

export function codexHooks(): Record<string, unknown> {
  const commands = bridgeCommands()
  return Object.fromEntries(
    CODEX_HOOK_EVENTS.map((event) => [
      event,
      [
        {
          hooks: [
            {
              type: 'command',
              ...commands,
              // Stop은 verify의 지식 검토 호출(D300)을 기다린다: Claude의 Stop 훅과 같은 제한
              timeout:
                event === 'SessionEnd' || event === 'Interrupt'
                  ? 3
                  : event === 'Stop'
                    ? STOP_HOOK_TIMEOUT_SEC
                    : 30,
              // 문자 수가 아닌 대략 토큰 기준의 spill 임계값. 초과한 전문은 Codex가 파일에 보존한다.
              ...(event === 'SessionStart' ? { additionalContextLimit: 8000 } : {}),
            },
          ],
        },
      ],
    ]),
  )
}

export function codexSettings(input: AgentSettingsInput): CodexSettings {
  const bridge = codexBridgePath()
  if (!fs.existsSync(bridge))
    throw new Error('Codex 브리지 파일을 찾을 수 없습니다. relay 설치를 확인하세요.')
  const skillPath =
    input.skill && input.taskDir ? codexSkillPath(input.taskDir, input.skill) : undefined
  return {
    ...(skillPath ? { skillPath } : {}),
    overrides: {
      'features.hooks': true,
      'features.memories': false,
      'memories.use_memories': false,
      'memories.generate_memories': false,
      // task에 고정한 모델·추론 수준. 없으면 CLI 설정을 따른다. 재개도 같은 설정 파일로 같은 값을 준다
      ...(input.model ? { model: input.model } : {}),
      ...(input.effort ? { model_reasoning_effort: input.effort } : {}),
      ...Object.fromEntries(
        Object.entries(codexHooks()).map(([event, groups]) => [`hooks.${event}`, groups]),
      ),
      'mcp_servers.relay': {
        command: process.execPath,
        args: [bridge, 'mcp'],
        enabled: true,
        required: true,
        startup_timeout_sec: 30,
        tool_timeout_sec: 86400,
        env_vars: [HOOK_TOKEN_ENV, 'RELAY_HOOK_PORT', 'RELAY_HOOK_TASK'],
        env: { ELECTRON_RUN_AS_NODE: '1', ...(skillPath ? { RELAY_CODEX_SKILL: skillPath } : {}) },
      },
    },
  }
}

async function options(settingsPath: string): Promise<{ args: string[]; settings: CodexSettings }> {
  const settings = JSON.parse(await fsp.readFile(settingsPath, 'utf8')) as CodexSettings
  return {
    settings,
    args: [
      '--no-daemon',
      '--dangerously-bypass-approvals-and-sandbox',
      ...Object.entries(settings.overrides).flatMap(([key, value]) => [
        '-c',
        `${key}=${tomlValue(value)}`,
      ]),
    ],
  }
}

export async function codexLaunchArgs(input: LaunchInput): Promise<string[]> {
  const { args, settings } = await options(input.settingsPath)
  if (!settings.skillPath) throw new Error('이번 Codex task의 스킬이 없습니다.')
  return [
    ...args,
    '--add-dir',
    input.workDir,
    codexFirstPrompt(input.skill, settings.skillPath, input.contextPath),
  ]
}
export async function codexResumeArgs(input: ResumeInput): Promise<string[]> {
  return [
    ...(await options(input.settingsPath)).args,
    '--add-dir',
    input.workDir,
    'resume',
    input.sessionId,
    ...(input.prompt ? [input.prompt] : []),
  ]
}
export async function codexCleanupArgs(settingsPath: string): Promise<string[]> {
  return (await options(settingsPath)).args
}
export function codexLaunchEnv(
  token: string,
  port: number,
  taskId: string,
): Record<string, string> {
  return {
    [HOOK_TOKEN_ENV]: token,
    RELAY_HOOK_PORT: String(port),
    RELAY_HOOK_TASK: taskId,
    RELAY_CODEX_EXE: process.execPath,
    RELAY_CODEX_BRIDGE: codexBridgePath(),
    RELAY_CODEX_HOOK_PS: codexResourcePath('codex-hook.ps1'),
  }
}

// ---------- 짧은 모델 호출 (D300, D334) ----------

/**
 * codex exec를 한 번 부른다: 세션을 남기지 않음(--ephemeral), 읽기 전용 샌드박스, 구조화된 출력(--output-schema, 마지막
 * 메시지를 -o 파일로). 시스템 지시는 따로 넘길 곳이 없어 프롬프트 앞에 붙인다. 모델을 비우면 CLI 설정을 따른다. 비용은
 * 알려 주지 않아 null이다. 실패해도 던지지 않고 error에 적는다
 */
export async function codexJson(input: Omit<ClaudeJsonInput, 'effort'>): Promise<ClaudeJsonResult> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'relay-review-'))
  const schemaFile = path.join(dir, 'schema.json')
  const outFile = path.join(dir, 'out.json')
  const started = Date.now()
  const fail = (error: string): ClaudeJsonResult => ({
    data: null,
    ms: Date.now() - started,
    costUsd: null,
    usage: null,
    error,
  })
  try {
    await fsp.writeFile(schemaFile, JSON.stringify(input.schema))
    const args = [
      'exec',
      '--ephemeral',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--color',
      'never',
      '--json',
      '--cd',
      input.cwd,
      '--output-schema',
      schemaFile,
      '-o',
      outFile,
      ...(input.model ? ['-m', input.model] : []),
      '-',
    ]
    const r = await run(input.bin, args, {
      cwd: input.cwd,
      env: input.env,
      timeoutMs: input.timeoutMs,
      input: input.system ? `${input.system}\n\n${input.prompt}` : input.prompt,
    })
    if (r.code !== 0) return fail(describeFailure(r))
    let data: unknown
    try {
      data = JSON.parse(await fsp.readFile(outFile, 'utf8'))
    } catch {
      return fail('구조화된 출력 없음')
    }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    let usage: ClaudeJsonResult['usage'] = null
    for (const line of r.stdout.split('\n')) {
      let e: Record<string, unknown>
      try {
        e = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }
      const u = e['usage'] as Record<string, unknown> | undefined
      if (e['type'] === 'turn.completed' && u) {
        usage = {
          input: num(u['input_tokens']),
          output: num(u['output_tokens']),
          cacheRead: num(u['cached_input_tokens']),
          cacheCreation: 0,
        }
      }
    }
    return { data, ms: Date.now() - started, costUsd: null, usage, error: null }
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}
