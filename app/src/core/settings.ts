// task 설정 파일(task.settings.json)의 내용과 claude 실행 인자 (시나리오 2-3, 2-5, 6절).
// 훅은 Claude Code 내장 HTTP 훅으로 앱의 로컬 서버에 보낸다 (D20, I13).
// deny 규칙은 git push, gh pr, 앱 소유 파일 편집을 막는다 (D17). 실수를 막는 장치다 (D91).
import type { SkillName } from '../shared/config'

/** 앱이 받는 훅 여섯 가지 (시나리오 2-3) */
export const HOOK_EVENTS = [
  'UserPromptSubmit',
  'Stop',
  'Notification',
  'SessionEnd',
  'PreToolUse',
  'PostToolUse',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

/** 도구 이름으로 가리는 훅. 질문 대기 표시에는 AskUserQuestion만 쓴다 (D24, D35) */
const MATCHERS: Partial<Record<HookEvent, string>> = {
  PreToolUse: 'AskUserQuestion',
  PostToolUse: 'AskUserQuestion',
}

/** 훅 토큰을 넘기는 PTY 환경 변수 (I13). 설정 파일에는 변수 이름만 적는다 */
export const HOOK_TOKEN_ENV = 'RELAY_HOOK_TOKEN'

/** 훅 요청의 제한 시간(초). 출처: spikes/lib/hooks.mjs HookServer.settings */
const HOOK_TIMEOUT_SEC = 30

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
}

/** 훅 URL: http://127.0.0.1:<port>/hook/<task-id>/<Event> (I13) */
export function hookUrl(port: number, taskId: string, event: HookEvent): string {
  return `http://127.0.0.1:${port}/hook/${taskId}/${event}`
}

/**
 * 이벤트마다 matcher 묶음 하나에 http 훅 하나를 둔다.
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
      timeout: HOOK_TIMEOUT_SEC,
    }
    const matcher = MATCHERS[event]
    return [matcher ? { matcher, hooks: [hook] } : { hooks: [hook] }]
  }
  return {
    UserPromptSubmit: group('UserPromptSubmit'),
    Stop: group('Stop'),
    Notification: group('Notification'),
    SessionEnd: group('SessionEnd'),
    PreToolUse: group('PreToolUse'),
    PostToolUse: group('PostToolUse'),
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

/** Work 디렉터리 안의 앱 소유 파일 (시나리오 2-3) */
const APP_OWNED_FILES = ['work.json', 'request.md', 'intent.md', 'decisions.md']

export interface DenyInput {
  /** Work 디렉터리(works/<work-id>)의 절대 경로 */
  workDir: string
  /** 이전 task 디렉터리의 절대 경로. 지금 task 디렉터리는 넣지 않는다 */
  previousTaskDirs: readonly string[]
}

/**
 * deny 규칙 (D17, 시나리오 2-3): git push, gh pr 계열, 앱 소유 파일(work.json, request.md, intent.md,
 * decisions.md, 이전 task 디렉터리, Work 디렉터리의 .claude/) 편집.
 * 출처: spikes/s4-permissions.mjs (Bash(git push*), Bash(gh pr*), Edit(ruleAbs(…)))
 */
export function denyRules(input: DenyInput): string[] {
  const work = ruleAbs(input.workDir)
  return [
    'Bash(git push*)',
    'Bash(gh pr*)',
    ...APP_OWNED_FILES.map((f) => `Edit(${ruleJoin(work, f)})`),
    ...input.previousTaskDirs.map((d) => `Edit(${ruleJoin(ruleAbs(d), '**')})`),
    `Edit(${ruleJoin(work, '.claude', '**')})`,
  ]
}

export interface TaskSettingsInput extends DenyInput {
  /** 훅 서버 포트 (I13) */
  port: number
  taskId: string
}

/** task 설정 파일의 내용 (시나리오 2-3) */
export function taskSettings(input: TaskSettingsInput): TaskSettings {
  return { hooks: hookSettings(input.port, input.taskId), permissions: { deny: denyRules(input) } }
}

/** relay 스킬의 이름. Work 디렉터리의 .claude/skills/<이름>/에 배포하고 /<이름>으로 부른다 (D32, D33) */
export function relaySkillName(skill: SkillName): string {
  return `relay-${skill}`
}

/** 첫 프롬프트: 스킬 호출과 context.md 경로만 담는다 (D19, 5.6.3) */
export function firstPrompt(skill: SkillName, contextPath: string): string {
  return `/${relaySkillName(skill)} 이 task의 컨텍스트: ${contextPath}`
}

export interface LaunchInput {
  /** --session-id로 줄 uuid */
  sessionId: string
  /** Work 디렉터리. 스킬을 읽게 --add-dir로 더한다 (D32) */
  workDir: string
  /** task 설정 파일 경로 */
  settingsPath: string
  skill: SkillName
  contextPath: string
}

/** claude 실행 인자 (시나리오 2-5, 6절) */
export function launchArgs(input: LaunchInput): string[] {
  return [
    '--dangerously-skip-permissions',
    '--session-id',
    input.sessionId,
    '--add-dir',
    input.workDir,
    '--settings',
    input.settingsPath,
    firstPrompt(input.skill, input.contextPath),
  ]
}

/** PTY에 넘길 환경 변수. 토큰은 여기로만 넘긴다 (I13) */
export function launchEnv(token: string): Record<string, string> {
  return { [HOOK_TOKEN_ENV]: token }
}
