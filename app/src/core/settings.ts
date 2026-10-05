// task 설정 파일(task.settings.json)의 내용과 claude 실행 인자 (시나리오 2-3, 2-5, 3-4, 6절).
// 훅은 Claude Code 내장 HTTP 훅으로 앱의 로컬 서버에 보낸다 (D20, I13).
// deny 규칙은 git push, gh pr, 앱 소유 파일 편집을 막는다 (D17). 실수를 막는 장치다 (D91).
// 자동 메모리는 끈다 (D113).
import type { SkillName } from '../shared/config'

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

export interface DenyInput {
  /** Work 디렉터리(works/<work-id>)의 절대 경로 */
  workDir: string
  /** 이전 task 디렉터리의 절대 경로. 지금 task 디렉터리는 넣지 않는다 */
  previousTaskDirs: readonly string[]
}

/**
 * deny 규칙 (D17, 시나리오 2-3): git push, gh pr 계열, 앱 소유 파일(work.json, request.md, intent.md,
 * decisions.md, pr-items.json(D191), 이전 task 디렉터리, Work 디렉터리의 .claude/) 편집.
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

/** task 설정 파일의 내용 (시나리오 2-3). 재개할 때도 새로 만든다(포트와 토큰이 바뀔 수 있음, I13) */
export function taskSettings(input: TaskSettingsInput): TaskSettings {
  return {
    hooks: hookSettings(input.port, input.taskId),
    permissions: { deny: denyRules(input) },
    autoMemoryEnabled: false,
  }
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

export type ResumeInput = Omit<LaunchInput, 'skill' | 'contextPath'> & {
  /** 다시 연 세션에 줄 첫 입력 (D218). 없으면 다시 연 세션은 사람의 입력을 기다린다 (S6) */
  prompt?: string
}

/**
 * 끝난 세션을 다시 여는 인자 (시나리오 3-4, 6절): 같은 옵션 + --resume <세션 id>.
 * --settings, --add-dir, 권한 확인 끈 모드는 --resume이 복원하지 않아 다시 준다(Claude Code 문서 sessions).
 * --session-id는 새 세션에 쓰는 것이라 빼고, 첫 프롬프트는 스킬을 다시 시작하므로 뺀다. 확인: 스파이크 S6.
 * 중단됨의 [재개]는 대신 이어서 하라는 첫 입력을 맨 뒤에 준다 (D218)
 */
export function resumeArgs(input: ResumeInput): string[] {
  return [
    '--dangerously-skip-permissions',
    '--resume',
    input.sessionId,
    '--add-dir',
    input.workDir,
    '--settings',
    input.settingsPath,
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

/** PTY에 넘길 환경 변수. 토큰은 여기로만 넘긴다 (I13) */
export function launchEnv(token: string): Record<string, string> {
  return { [HOOK_TOKEN_ENV]: token }
}

/**
 * 정리 세션([AI 세션 열기], 시나리오 7-5)의 실행 인자. 기록하지 않는 일반 터미널이라 세션 id, 스킬,
 * 첫 프롬프트가 없고 사람이 터미널에서 시킨다. 설정 파일로 훅(턴이 끝날 때 git status를 확인),
 * deny 규칙(push와 PR은 계속 막힘, D17), 자동 메모리 끔(D113)을 준다.
 */
export function cleanupArgs(settingsPath: string): string[] {
  return ['--dangerously-skip-permissions', '--settings', settingsPath]
}
