// task 설정 파일(task.settings.json)의 내용과 claude 실행 인자 (시나리오 2-3, 2-5, 3-4, 6절).
// 단계 절차는 task 디렉터리의 instructions.md를 시스템 프롬프트에 덧붙여 준다 (D440).
// 훅은 Claude Code 내장 HTTP 훅으로 앱의 로컬 서버에 보낸다 (D20, I13).
// deny 규칙은 git push, gh pr, 앱 소유 파일 편집을 막는다 (D17). 실수를 막는 장치다 (D91).
// 자동 메모리는 끈다 (D113).
import type { SkillName } from '../shared/config'
import { older } from './pr'

/** 앱이 받는 훅 일곱 가지 (시나리오 2-3) */
export const HOOK_EVENTS = [
  'UserPromptSubmit',
  'Stop',
  'Notification',
  'SessionEnd',
  'PreToolUse',
  'PostToolUse',
  // 도구가 실패하면 PostToolUse 대신 온다(Claude Code 2.1.285의 훅 설명). 진행 표시에서 도구가 끝난 것으로 본다 (D216)
  'PostToolUseFailure',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

/** 훅 토큰을 넘기는 PTY 환경 변수 (I13). 설정 파일에는 변수 이름만 적는다 */
export const HOOK_TOKEN_ENV = 'RELAY_HOOK_TOKEN'

/** 훅 요청의 제한 시간(초). 출처: spikes/lib/hooks.mjs HookServer.settings */
const HOOK_TIMEOUT_SEC = 30

/** Stop 훅의 제한 시간(초). verify의 지식 검토 호출(D300, 90초까지)을 기다린다 */
export const STOP_HOOK_TIMEOUT_SEC = 180

export interface HttpHook {
  type: 'http'
  url: string
  headers: Record<string, string>
  allowedEnvVars: string[]
  timeout: number
}

export interface HookGroup {
  matcher?: string
  hooks: HttpHook[]
}

/** Claude Code 설정 파일 중 relay가 쓰는 부분 */
export interface TaskSettings {
  hooks: Record<HookEvent, HookGroup[]>
  permissions: { deny: string[] }
  /**
   * 자동 메모리를 끈다 (D113). 켜 두면 task와 Work 사이를 context.md 밖으로 잇는다.
   * --settings로 준 파일에서도 읽힌다 (Claude Code 문서 settings-reference autoMemoryEnabled)
   */
  autoMemoryEnabled: false
}

/** 훅 URL: http://127.0.0.1:<port>/hook/<task-id>/<Event> (I13) */
export function hookUrl(port: number, taskId: string, event: HookEvent): string {
  return `http://127.0.0.1:${port}/hook/${taskId}/${event}`
}

/**
 * 이벤트마다 묶음 하나에 http 훅 하나를 둔다. PreToolUse, PostToolUse, PostToolUseFailure는 matcher 없이 모든
 * 도구에 건다: 질문 대기 표시(D24, D35)는 AskUserQuestion으로, 진행 표시(D216)는 나머지 도구로 한다.
 * 출처: spikes/lib/hooks.mjs HookServer.settings (이벤트별 matcher, type: http, timeout).
 * 토큰 머리글은 I13에서 더했다. $RELAY_HOOK_TOKEN은 allowedEnvVars에 있어야 풀린다 (Claude Code 문서 hooks).
 */
export function hookSettings(port: number, taskId: string): Record<HookEvent, HookGroup[]> {
  const group = (event: HookEvent): HookGroup[] => {
    const hook: HttpHook = {
      type: 'http',
      url: hookUrl(port, taskId, event),
      headers: { Authorization: `Bearer $${HOOK_TOKEN_ENV}` },
      allowedEnvVars: [HOOK_TOKEN_ENV],
      timeout: event === 'Stop' ? STOP_HOOK_TIMEOUT_SEC : HOOK_TIMEOUT_SEC,
    }
    return [{ hooks: [hook] }]
  }
  return {
    UserPromptSubmit: group('UserPromptSubmit'),
    Stop: group('Stop'),
    Notification: group('Notification'),
    SessionEnd: group('SessionEnd'),
    PreToolUse: group('PreToolUse'),
    PostToolUse: group('PostToolUse'),
    PostToolUseFailure: group('PostToolUseFailure'),
  }
}

/**
 * Windows 경로를 Claude Code 권한 규칙의 절대 경로(//c/...)로 바꾼다. POSIX 절대 경로는 //로 시작한다.
 * 출처: spikes/lib/util.mjs ruleAbs
 */
export function ruleAbs(p: string): string {
  const posix = p.replace(/\\/g, '/')
  const m = /^([A-Za-z]):\/(.*)$/.exec(posix)
  return m ? `//${(m[1] ?? '').toLowerCase()}/${m[2] ?? ''}` : `/${posix}`
}

/** 규칙 경로 뒤에 이름을 붙인다 */
function ruleJoin(base: string, ...names: string[]): string {
  return [base.replace(/\/+$/, ''), ...names].join('/')
}

/** Work 디렉터리 안의 앱 소유 파일 (시나리오 2-3). pr-items.json은 PR 진행의 항목이다 (D191) */
const APP_OWNED_FILES = ['work.json', 'request.md', 'intent.md', 'decisions.md', 'pr-items.json']

/** task 디렉터리의 단계 절차. 앱이 조립해 쓰고 --append-system-prompt-file로 준다 (D440, 5.6.3) */
export const INSTRUCTIONS_FILE = 'instructions.md'

export interface DenyInput {
  /** Work 디렉터리(works/<work-id>)의 절대 경로 */
  workDir: string
  /** 이전 task 디렉터리의 절대 경로. 지금 task 디렉터리는 넣지 않는다 */
  previousTaskDirs: readonly string[]
  /** 지금 task 디렉터리. 있으면 그 안의 단계 절차(instructions.md) 편집을 막는다 (D443) */
  taskDir?: string
}

/**
 * deny 규칙 (D17, 시나리오 2-3): git push, gh pr 계열, 앱 소유 파일(work.json, request.md, intent.md,
 * decisions.md, pr-items.json(D191), 이전 task 디렉터리, 이번 task의 instructions.md(D443), Work 디렉터리의 .claude/와 커스텀 유형 복사본 type/(D458)) 편집.
 * 출처: spikes/s4-permissions.mjs (Bash(git push*), Bash(gh pr*), Edit(ruleAbs(…)))
 */
export function denyRules(input: DenyInput): string[] {
  const work = ruleAbs(input.workDir)
  return [
    'Bash(git push*)',
    'Bash(gh pr*)',
    ...APP_OWNED_FILES.map((f) => `Edit(${ruleJoin(work, f)})`),
    ...input.previousTaskDirs.map((d) => `Edit(${ruleJoin(ruleAbs(d), '**')})`),
    ...(input.taskDir ? [`Edit(${ruleJoin(ruleAbs(input.taskDir), INSTRUCTIONS_FILE)})`] : []),
    `Edit(${ruleJoin(work, '.claude', '**')})`,
    // 커스텀 Work의 유형 복사본: 뒤 단계의 절차가 된다 (D458)
    `Edit(${ruleJoin(work, 'type', '**')})`,
  ]
}

export interface TaskSettingsInput extends DenyInput {
  /** 훅 서버 포트 (I13) */
  port: number
  taskId: string
}

/** task 설정 파일의 내용 (시나리오 2-3). 재개할 때도 새로 만든다(포트와 토큰이 바뀔 수 있음, I13) */
export function taskSettings(input: TaskSettingsInput): TaskSettings {
  return {
    hooks: hookSettings(input.port, input.taskId),
    permissions: { deny: denyRules(input) },
    autoMemoryEnabled: false,
  }
}

/** relay 스킬의 이름. Codex task의 스킬 배포본 폴더 이름이다 (engines.md) */
export function relaySkillName(skill: SkillName): string {
  return `relay-${skill}`
}

/** 첫 프롬프트: 단계 이름과 context.md 경로만 담는다. 절차는 시스템 프롬프트에 있다 (D442, 5.6.3) */
export function firstPrompt(skill: SkillName, contextPath: string): string {
  return `relay ${skill} 단계를 시작합니다. 이 task의 컨텍스트: ${contextPath}`
}

/**
 * 의도 정리의 대화를 이어받은 세션의 첫 입력 (D531). 앞 대화의 절차(의도 정리)가 끝났고 이제 이 단계의 절차를 따른다고
 * 알린다. 이미 읽은 코드는 다시 읽지 않아도 된다
 */
export function forkPrompt(skill: SkillName, contextPath: string): string {
  return (
    `${firstPrompt(skill, contextPath)} 위의 대화는 의도 정리 단계였고 의도는 승인됐습니다. 이제부터는 시스템 ` +
    '프롬프트에 있는 이 단계의 절차를 따르세요. 앞에서 읽은 코드와 알게 된 것은 그대로 써도 되지만, 이 task의 ' +
    'context.md와 승인된 intent.md는 먼저 읽으세요.'
  )
}

/** 대화의 시스템 프롬프트를 기록하지 않고 요청마다 새로 만든다 (D446, D531). 이어받은 대화에 새 절차를 준다 */
const SNAPSHOT_OFF: readonly string[] = ['--system-prompt-snapshot', 'off']

export interface LaunchInput {
  /** --session-id로 줄 uuid */
  sessionId: string
  /** Work 디렉터리. 산출물과 앞 단계 파일을 읽게 --add-dir로 더한다 (D32) */
  workDir: string
  /** --add-dir로 더 줄 폴더. 서브모듈 Work의 메인 통합 검증 worktree다 (D414). 없으면 넣지 않는다 */
  extraDirs?: readonly string[]
  /** task 설정 파일 경로 */
  settingsPath: string
  /** 시스템 프롬프트에 덧붙일 단계 절차(instructions.md) 경로 (D440). Codex는 쓰지 않는다 */
  instructionsPath: string
  skill: SkillName
  contextPath: string
  /** task에 고정한 모델. 없으면 엔진의 기본 */
  model?: string
  /** task에 고정한 추론 수준. 없으면 엔진의 기본 */
  effort?: string
  /**
   * 질문을 relay MCP로 묻는 task(D521)의 MCP 설정 파일 (relayMcpConfig). 있으면 --mcp-config로 주고 AskUserQuestion을
   * 뺀다. 없으면 넣지 않아 지금과 같은 인자다
   */
  mcpConfigPath?: string
  /**
   * 이어받을 의도 정리 세션 id (D531). 있으면 --resume <id> --fork-session으로 그 대화를 이어받은 새 세션(sessionId)을
   * 띄우고, 시스템 프롬프트를 기록하지 않아 이 단계의 절차를 준다
   */
  forkFrom?: string
}

/** 앱 질문창 대신 터미널에서 묻는 Claude Code 도구 (D24). relay MCP로 묻는 task에서는 뺀다 (D521) */
export const CLI_ASK_TOOL = 'AskUserQuestion'

/** relay MCP의 질문 도구 (engines.md, D521). 단계 절차의 질문 도구 이름을 이것으로 바꾼다 */
export const RELAY_ASK_TOOL = 'mcp__relay__ask_human'

/**
 * Claude task의 relay MCP 서버 이름 (D521). 사람이 사용자 범위로 등록하는 바깥 호출자용 relay MCP(이름 relay, README)와
 * 겹치지 않게 따로 둔다: 앱은 --strict-mcp-config를 주지 않아 둘 다 보인다
 */
export const CLAUDE_ASK_SERVER = 'relay_task'

/** Claude task의 질문 도구 (D521) */
export const CLAUDE_ASK_TOOL = `mcp__${CLAUDE_ASK_SERVER}__ask_human`

/** 단계 절차의 질문 도구를 relay MCP의 것으로 바꾼다 (engines.md, D521). Claude task는 CLAUDE_ASK_TOOL이다 */
export function askViaRelay(text: string, tool: string = RELAY_ASK_TOOL): string {
  return text.replaceAll(`\`${CLI_ASK_TOOL}\``, `\`${tool}\``)
}

/**
 * relay MCP 호출자가 답하는 task의 절차 끝에 붙이는 안내 (D521). 호출자는 터미널을 보지 못하므로 답에 필요한 것을 질문에
 * 담게 한다(설계 문답의 쟁점 목록처럼 터미널에 먼저 쓰라는 절차가 있다)
 */
export const CALLER_ASK_NOTE =
  '\n## Who answers\n\nA relay MCP caller (another agent working for the human) answers your questions and approves this step. It cannot see this terminal. Put everything it needs to answer (lists, scenarios, explanations you would write in terminal text) into the question text itself.\n'

/**
 * 질문을 relay MCP로 묻는 task의 옵션 (D521): relay 서버를 더하고 터미널의 질문 도구를 뺀다. 두 옵션은 값을 여럿 받아
 * 뒤에 오는 첫 프롬프트까지 값으로 먹는다(Claude Code 2.1.312에서 확인): 늘 --settings 앞에 둔다
 */
function askArgs(input: { mcpConfigPath?: string }): string[] {
  return input.mcpConfigPath
    ? ['--mcp-config', input.mcpConfigPath, '--disallowedTools', CLI_ASK_TOOL]
    : []
}

/** relay MCP 서버 (D521). 브리지는 Codex task와 같은 것이고 훅 서버의 /question으로 묻는다 */
export interface RelayMcpConfig {
  mcpServers: Record<
    string,
    { type: 'stdio'; command: string; args: string[]; env: Record<string, string> }
  >
}

/**
 * --mcp-config로 줄 relay 서버 (D521). command는 앱 실행 파일(ELECTRON_RUN_AS_NODE로 Node처럼 돈다), bridge는
 * codex-bridge.mjs다. 포트와 task id는 비밀이 아니라 파일에 두고, 훅 토큰은 PTY 환경 변수(launchEnv)로만 넘긴다:
 * claude는 MCP 서버에 자기 환경을 물려준다(Claude Code 2.1.312에서 확인)
 */
export function relayMcpConfig(o: {
  command: string
  bridge: string
  port: number
  taskId: string
}): RelayMcpConfig {
  return {
    mcpServers: {
      [CLAUDE_ASK_SERVER]: {
        type: 'stdio',
        command: o.command,
        args: [o.bridge, 'mcp'],
        env: {
          ELECTRON_RUN_AS_NODE: '1',
          RELAY_HOOK_PORT: String(o.port),
          RELAY_HOOK_TASK: o.taskId,
        },
      },
    },
  }
}

/** 더 줄 폴더의 --add-dir (D414). 없으면 넣지 않아 지금과 같은 인자다 */
export function extraDirArgs(input: { extraDirs?: readonly string[] }): string[] {
  return (input.extraDirs ?? []).flatMap((d) => ['--add-dir', d])
}

/** 단계 절차를 시스템 프롬프트 끝에 덧붙이는 옵션 (D440). 기본 시스템 프롬프트는 그대로 둔다 */
function instructionsArgs(input: { instructionsPath?: string }): string[] {
  return input.instructionsPath ? ['--append-system-prompt-file', input.instructionsPath] : []
}

/** 모델·추론 수준 옵션. 값이 없으면 넣지 않아 지금과 같은 인자다 */
function modelArgs(input: { model?: string; effort?: string }): string[] {
  return [
    ...(input.model ? ['--model', input.model] : []),
    ...(input.effort ? ['--effort', input.effort] : []),
  ]
}

/** claude 실행 인자 (시나리오 2-5, 6절) */
export function launchArgs(input: LaunchInput): string[] {
  const fork = input.forkFrom
  return [
    '--dangerously-skip-permissions',
    ...(fork ? ['--resume', fork, '--fork-session'] : []),
    '--session-id',
    input.sessionId,
    '--add-dir',
    input.workDir,
    ...extraDirArgs(input),
    ...askArgs(input),
    '--settings',
    input.settingsPath,
    ...(fork ? SNAPSHOT_OFF : []),
    ...instructionsArgs(input),
    ...modelArgs(input),
    fork ? forkPrompt(input.skill, input.contextPath) : firstPrompt(input.skill, input.contextPath),
  ]
}

export type ResumeInput = Omit<LaunchInput, 'skill' | 'contextPath' | 'instructionsPath'> & {
  /**
   * task를 시작할 때 쓴 단계 절차 (D441). 빼면 압축 뒤 절차가 사라지므로 늘 준다(스파이크 S8).
   * 없으면 이 변경 전에 스킬로 시작한 task라 넣지 않는다
   */
  instructionsPath?: string
  /** 다시 연 세션에 줄 첫 입력 (D218). 없으면 다시 연 세션은 사람의 입력을 기다린다 (S6) */
  prompt?: string
  /**
   * 의도 정리의 대화를 이어받은 task (D531). 이어받은 기록에 의도 정리의 시스템 프롬프트가 남아 있어, 다시 열 때도 기록하지
   * 않게 해 이 단계의 절차를 준다
   */
  snapshotOff?: boolean
}

/**
 * 끝난 세션을 다시 여는 인자 (시나리오 3-4, 6절): 같은 옵션 + --resume <세션 id>.
 * --settings, --add-dir, 권한 확인 끈 모드는 --resume이 복원하지 않아 다시 준다(Claude Code 문서 sessions).
 * 단계 절차도 같은 파일을 다시 준다. Claude Code는 처음 만든 시스템 프롬프트를 압축 전까지 쓰고, 압축하면 이때의 플래그로
 * 다시 만든다 (D441, 스파이크 S8).
 * --session-id는 새 세션에 쓰는 것이라 빼고, 첫 프롬프트는 단계를 다시 시작하므로 뺀다. 확인: 스파이크 S6.
 * 중단됨의 [재개]는 대신 이어서 하라는 첫 입력을 맨 뒤에 준다 (D218). 모델·추론 수준도 task에 고정한 값을 다시 준다
 */
export function resumeArgs(input: ResumeInput): string[] {
  return [
    '--dangerously-skip-permissions',
    '--resume',
    input.sessionId,
    '--add-dir',
    input.workDir,
    ...extraDirArgs(input),
    ...askArgs(input),
    '--settings',
    input.settingsPath,
    ...(input.snapshotOff ? SNAPSHOT_OFF : []),
    ...instructionsArgs(input),
    ...modelArgs(input),
    ...(input.prompt ? [input.prompt] : []),
  ]
}

/**
 * 중단됨 task의 [재개]에 주는 첫 입력 (D218). --resume으로 다시 연 세션은 입력을 기다리므로(S6) 하던 일을 이어서
 * 하라고 알린다. 시작 인자라 실행 중인 세션에 글을 넣지 않는다(1.2). 앱이 꺼져 끊겼으면 그렇다고 적는다 (D219)
 */
export function continuePrompt(appEnded: boolean): string {
  const why = appEnded ? '앱이 꺼져 세션이 끊겼다가' : '사람이 [즉시 중단]한 세션이'
  return (
    `relay: ${why} [재개]로 다시 열렸습니다. 끊기기 전의 마지막 상태(끝나지 않은 명령 등)를 확인하고 ` +
    '하던 일을 이어서 하세요. 사람에게 물을 것이 있었다면 다시 물으세요.'
  )
}

/**
 * 대체 화면(전체 화면)을 쓰지 않게 하는 Claude Code의 환경 변수 (D527). Claude Code는 설정 폴더의 두 번째 실행부터
 * 대체 화면에 그리고 마우스를 잡는다(2.1.312에서 확인). 그러면 세션이 끝나 대체 화면을 나올 때 대화가 터미널에서 사라지고
 * "Resume this session with: claude --resume …"만 남는다
 */
export const INLINE_SCREEN_ENV = 'CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN'

/**
 * PTY에 넘길 환경 변수. 토큰은 여기로만 넘긴다 (I13). 대화가 터미널 스크롤에 남게 대체 화면을 끈다 (D527): 끝난 단계의
 * 터미널(pty.log를 다시 그린 것 포함)에서 대화를 다시 읽고, 마우스를 잡지 않아 끌어 고르기와 Ctrl+클릭이 된다
 */
export function launchEnv(token: string): Record<string, string> {
  return { [HOOK_TOKEN_ENV]: token, [INLINE_SCREEN_ENV]: '1' }
}

/**
 * 정리 세션([AI 세션 열기], 시나리오 7-5)의 실행 인자. 기록하지 않는 일반 터미널이라 세션 id, 스킬,
 * 첫 프롬프트가 없고 사람이 터미널에서 시킨다. 설정 파일로 훅(턴이 끝날 때 git status를 확인),
 * deny 규칙(push와 PR은 계속 막힘, D17), 자동 메모리 끔(D113)을 준다. 서브모듈 Work는 메인 통합 검증 worktree를
 * --add-dir로 더한다(D414).
 */
export function cleanupArgs(settingsPath: string, extraDirs: readonly string[] = []): string[] {
  return [
    '--dangerously-skip-permissions',
    ...extraDirArgs({ extraDirs }),
    '--settings',
    settingsPath,
  ]
}

// ---------- 곁 세션 (시나리오 11, D385~D390) ----------

/** 곁 세션 설정 파일의 내용 (D388). 훅은 UserPromptSubmit 하나다 */
export interface SideSettings {
  hooks: Pick<Record<HookEvent, HookGroup[]>, 'UserPromptSubmit'>
  permissions: { deny: string[] }
  autoMemoryEnabled: false
}

/**
 * 곁 세션의 deny 규칙 (D388): 앱 소유 파일, tasks/ 아래 전부, Work 디렉터리의 .claude/ 편집. 사람이 옆에서 허락하는
 * 세션이라 git push와 gh는 막지 않는다(task의 D17과 다름)
 */
export function sideDenyRules(workDir: string): string[] {
  const work = ruleAbs(workDir)
  return [
    ...APP_OWNED_FILES.map((f) => `Edit(${ruleJoin(work, f)})`),
    `Edit(${ruleJoin(work, 'tasks', '**')})`,
    `Edit(${ruleJoin(work, '.claude', '**')})`,
  ]
}

/**
 * 곁 세션 설정 (D388): deny 규칙, 자동 메모리 끔(D113), UserPromptSubmit 훅. 훅의 session_id로 다시 열 대화를 적는다
 * (D389). /clear 뒤에는 id가 바뀌므로 첫 요청 때마다 받는다
 */
export interface SideSettingsInput {
  port: number
  taskId: string
  workDir: string
  /** 설정에서 정한 모델·추론 수준 (D391). Claude는 실행 인자로 주고, Codex는 설정 덮어쓰기로 준다 */
  model?: string
  effort?: string
}

export function sideSettings(input: SideSettingsInput): SideSettings {
  return {
    hooks: { UserPromptSubmit: hookSettings(input.port, input.taskId).UserPromptSubmit },
    permissions: { deny: sideDenyRules(input.workDir) },
    autoMemoryEnabled: false,
  }
}

export interface SideArgsInput {
  /** 새 대화면 --session-id로, 이어 가면 --resume으로 준다 */
  sessionId: string
  resume: boolean
  /** Work 디렉터리. 에이전트가 산출물을 스스로 읽게 --add-dir로 더한다 (D386) */
  workDir: string
  /** --add-dir로 더 줄 폴더 (D414). 없으면 넣지 않는다 */
  extraDirs?: readonly string[]
  settingsPath: string
  /** 안내(시스템 프롬프트, D387) 파일 */
  guidePath: string
  /**
   * 시스템 프롬프트를 기록하지 않아 다시 열 때 새 안내가 바로 쓰이게 한다(--system-prompt-snapshot off, D446). 없으면 준다.
   * 그 옵션이 없는 Claude Code(promptSnapshotOff)면 false다
   */
  refreshGuide?: boolean
  /** 설정에서 정한 모델·추론 수준 (D391). 없으면 엔진의 기본 */
  model?: string
  effort?: string
}

/**
 * 곁 세션의 실행 인자 (D386). 첫 프롬프트를 주지 않아 열어도 사람의 입력을 기다린다. 안내는 시스템 프롬프트에 덧붙인다:
 * 대화 기록에 남지 않아 다시 열 때도 다시 준다. 이어서 하라는 입력(D218)은 주지 않는다.
 * --system-prompt-snapshot off로 처음 연 때 기록한 시스템 프롬프트를 쓰지 않고 요청마다 다시 만들어, 다시 연 세션에
 * 그때 새로 쓴 안내가 바로 들어간다 (D446, 스파이크 S8). task는 이 옵션을 주지 않는다: 한 대화 안의 절차가 같아야 한다(D441)
 */
export function sideArgs(input: SideArgsInput): string[] {
  return [
    '--dangerously-skip-permissions',
    input.resume ? '--resume' : '--session-id',
    input.sessionId,
    '--add-dir',
    input.workDir,
    ...extraDirArgs(input),
    '--settings',
    input.settingsPath,
    '--append-system-prompt-file',
    input.guidePath,
    ...(input.refreshGuide === false ? [] : ['--system-prompt-snapshot', 'off']),
    ...modelArgs(input),
  ]
}

/** --system-prompt-snapshot이 생긴 Claude Code 버전 (Claude Code 문서 cli-reference) */
export const PROMPT_SNAPSHOT_VERSION = '2.1.257'

/**
 * 곁·기본 세션에 --system-prompt-snapshot off를 줄 수 있는가 (D446). `claude --version`의 결과(예: "2.1.308 (Claude Code)")를
 * 숫자로 읽을 수 없거나 모르면 주지 않는다: 모르는 옵션이면 claude가 뜨지 않으므로, 처음 연 때의 안내가 남는 쪽이 낫다
 * (ghAuthActive와 같은 판단)
 */
export function promptSnapshotOff(version: string | null | undefined): boolean {
  return version ? older(version, PROMPT_SNAPSHOT_VERSION) === false : false
}

// ---------- 기본 세션 (시나리오 12, D397~D406) ----------

/**
 * 기본 세션 설정 파일의 내용 (D401). 훅은 UserPromptSubmit 하나다. 자동 메모리 설정을 넣지 않아 CLI 설정을 따른다:
 * task는 메모리를 끄므로(D113) 기본 세션의 메모리가 task에 들지 않는다
 */
export interface SessionSettings {
  hooks: Pick<Record<HookEvent, HookGroup[]>, 'UserPromptSubmit'>
  permissions: { deny: string[] }
}

/** 기본 세션의 훅 URL(/hook/session/<Event>)의 id (I133). 세션마다 토큰으로 가른다 */
export const SESSION_HOOK_ID = 'session'

/**
 * 기본 세션의 deny 규칙 (D401): RELAY_HOME의 config.json, projects/ 아래 전부(Work 디렉터리와 worktree),
 * sessions/*\/session.json 편집. home/과 Work 초안 폴더는 써야 하므로 RELAY_HOME 전체를 막지 않는다. 사람이 옆에서 허락하는
 * 세션이라 git push와 gh는 막지 않는다(D388과 같음)
 */
export function sessionDenyRules(home: string): string[] {
  const root = ruleAbs(home)
  return [
    `Edit(${ruleJoin(root, 'config.json')})`,
    `Edit(${ruleJoin(root, 'projects', '**')})`,
    `Edit(${ruleJoin(root, 'sessions', '*', 'session.json')})`,
  ]
}

export interface SessionSettingsInput {
  port: number
  /** RELAY_HOME */
  home: string
  /** 설정에서 정한 모델·추론 수준 (D399). Claude는 실행 인자로 주고, Codex는 설정 덮어쓰기로 준다 */
  model?: string
  effort?: string
}

/** 기본 세션 설정 (D401): deny 규칙과 UserPromptSubmit 훅. 훅의 session_id로 다시 열 대화를, prompt로 이름을 적는다 */
export function sessionSettings(input: SessionSettingsInput): SessionSettings {
  return {
    hooks: { UserPromptSubmit: hookSettings(input.port, SESSION_HOOK_ID).UserPromptSubmit },
    permissions: { deny: sessionDenyRules(input.home) },
  }
}

export interface SessionArgsInput {
  /** 새 대화면 --session-id로, 이어 가면 --resume으로 준다 */
  sessionId: string
  resume: boolean
  /** RELAY_HOME. 에이전트가 프로젝트와 Work를 스스로 읽게 --add-dir로 더한다 (D399) */
  home: string
  settingsPath: string
  /** 안내(시스템 프롬프트, D400) 파일 */
  guidePath: string
  /** 곁 세션(SideArgsInput)과 같다 (D446) */
  refreshGuide?: boolean
  /** 설정에서 정한 모델·추론 수준 (D399). 없으면 엔진의 기본 */
  model?: string
  effort?: string
}

/**
 * 기본 세션의 실행 인자 (D399). 곁 세션(sideArgs)과 같은 모양이고 --add-dir만 RELAY_HOME이다. 첫 프롬프트를 주지 않아
 * 사람의 입력을 기다리고, 안내는 시스템 프롬프트에 덧붙여 다시 열 때도 다시 준다. 다시 연 때의 안내가 바로 쓰인다(D446)
 */
export function sessionArgs(input: SessionArgsInput): string[] {
  const { home, ...rest } = input
  return sideArgs({ ...rest, workDir: home })
}
