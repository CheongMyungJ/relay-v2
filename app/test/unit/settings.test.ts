import { describe, expect, it } from 'vitest'
import {
  HOOK_EVENTS,
  denyRules,
  firstPrompt,
  hookSettings,
  hookUrl,
  launchArgs,
  launchEnv,
  relaySkillName,
  resumeArgs,
  ruleAbs,
  taskSettings,
} from '../../src/core/settings'

const WORK_DIR = 'C:\\Users\\u\\.relay\\projects\\my-api-3f9a1c\\works\\w-20260926-001'
const TASKS = `${WORK_DIR}\\tasks`

describe('훅 (I13, 시나리오 2-3)', () => {
  const hooks = hookSettings(51234, 't-03')

  it('여섯 가지 훅을 둔다', () => {
    expect(Object.keys(hooks)).toEqual([
      'UserPromptSubmit',
      'Stop',
      'Notification',
      'SessionEnd',
      'PreToolUse',
      'PostToolUse',
    ])
    expect(HOOK_EVENTS).toEqual(Object.keys(hooks))
  })

  it.each(HOOK_EVENTS)(
    '%s: http 훅 하나, URL은 /hook/<task-id>/<Event>, 토큰은 변수 이름만',
    (event) => {
      const groups = hooks[event]
      expect(groups).toHaveLength(1)
      expect(groups[0]?.hooks).toEqual([
        {
          type: 'http',
          url: `http://127.0.0.1:51234/hook/t-03/${event}`,
          headers: { Authorization: 'Bearer $RELAY_HOOK_TOKEN' },
          allowedEnvVars: ['RELAY_HOOK_TOKEN'],
          timeout: 30,
        },
      ])
    },
  )

  it('PreToolUse와 PostToolUse만 AskUserQuestion으로 가린다 (D24, D35)', () => {
    const matchers = Object.fromEntries(HOOK_EVENTS.map((e) => [e, hooks[e][0]?.matcher]))
    expect(matchers).toEqual({
      UserPromptSubmit: undefined,
      Stop: undefined,
      Notification: undefined,
      SessionEnd: undefined,
      PreToolUse: 'AskUserQuestion',
      PostToolUse: 'AskUserQuestion',
    })
  })

  it('훅 URL', () => {
    expect(hookUrl(8080, 't-01', 'Stop')).toBe('http://127.0.0.1:8080/hook/t-01/Stop')
  })

  it('토큰 값은 설정 파일에 들어가지 않고 PTY 환경 변수로만 넘긴다', () => {
    const token = 'secret-token-123'
    const settings = taskSettings({
      port: 1,
      taskId: 't-01',
      workDir: WORK_DIR,
      previousTaskDirs: [],
    })
    expect(JSON.stringify(settings)).not.toContain(token)
    expect(launchEnv(token)).toEqual({ RELAY_HOOK_TOKEN: token })
  })
})

describe('deny 규칙 (D17, 시나리오 2-3)', () => {
  it('Windows 경로를 규칙의 절대 경로로 바꾼다', () => {
    expect(ruleAbs('C:\\Users\\u\\.relay\\x\\work.json')).toBe('//c/Users/u/.relay/x/work.json')
    expect(ruleAbs('D:\\repo')).toBe('//d/repo')
    expect(ruleAbs('/home/u/.relay/x')).toBe('//home/u/.relay/x')
  })

  it('git push, gh pr, 앱 소유 파일, 이전 task 디렉터리, Work 디렉터리의 .claude/ 편집을 막는다', () => {
    const rules = denyRules({
      workDir: WORK_DIR,
      previousTaskDirs: [`${TASKS}\\01-intake`, `${TASKS}\\02-evidence`],
    })
    const w = '//c/Users/u/.relay/projects/my-api-3f9a1c/works/w-20260926-001'
    expect(rules).toEqual([
      'Bash(git push*)',
      'Bash(gh pr*)',
      `Edit(${w}/work.json)`,
      `Edit(${w}/request.md)`,
      `Edit(${w}/intent.md)`,
      `Edit(${w}/decisions.md)`,
      `Edit(${w}/tasks/01-intake/**)`,
      `Edit(${w}/tasks/02-evidence/**)`,
      `Edit(${w}/.claude/**)`,
    ])
  })

  it('지금 task 디렉터리는 막지 않는다', () => {
    const rules = denyRules({ workDir: WORK_DIR, previousTaskDirs: [`${TASKS}\\01-intake`] })
    expect(rules.join('\n')).not.toContain('03-rca')
  })

  it('끝의 경로 구분자가 있어도 같은 규칙이다', () => {
    expect(denyRules({ workDir: `${WORK_DIR}\\`, previousTaskDirs: [] })).toEqual(
      denyRules({ workDir: WORK_DIR, previousTaskDirs: [] }),
    )
  })
})

describe('task 설정 파일 (시나리오 2-3)', () => {
  it('훅, deny 규칙, 자동 메모리 끔(D113)을 담고 JSON으로 그대로 쓸 수 있다', () => {
    const input = {
      port: 51234,
      taskId: 't-03',
      workDir: WORK_DIR,
      previousTaskDirs: [`${TASKS}\\01-intake`, `${TASKS}\\02-evidence`],
    }
    const settings = taskSettings(input)
    expect(Object.keys(settings)).toEqual(['hooks', 'permissions', 'autoMemoryEnabled'])
    expect(settings.hooks).toEqual(hookSettings(51234, 't-03'))
    expect(settings.permissions.deny).toEqual(denyRules(input))
    expect(settings.autoMemoryEnabled).toBe(false)
    expect(JSON.parse(JSON.stringify(settings))).toEqual(settings)
  })
})

describe('실행 인자 (시나리오 2-5, 6절)', () => {
  it('권한 확인 없이, 세션 id, Work 디렉터리, 설정 파일, 첫 프롬프트로 실행한다', () => {
    const context = `${TASKS}\\03-rca\\context.md`
    expect(
      launchArgs({
        sessionId: '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
        workDir: WORK_DIR,
        settingsPath: `${TASKS}\\03-rca\\task.settings.json`,
        skill: 'root-cause',
        contextPath: context,
      }),
    ).toEqual([
      '--dangerously-skip-permissions',
      '--session-id',
      '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
      '--add-dir',
      WORK_DIR,
      '--settings',
      `${TASKS}\\03-rca\\task.settings.json`,
      `/relay-root-cause 이 task의 컨텍스트: ${context}`,
    ])
  })

  it('재개는 같은 옵션 + --resume이고 --session-id와 첫 프롬프트는 뺀다 (시나리오 3-4, S6)', () => {
    expect(
      resumeArgs({
        sessionId: '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
        workDir: WORK_DIR,
        settingsPath: `${TASKS}\\03-rca\\task.settings.json`,
      }),
    ).toEqual([
      '--dangerously-skip-permissions',
      '--resume',
      '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
      '--add-dir',
      WORK_DIR,
      '--settings',
      `${TASKS}\\03-rca\\task.settings.json`,
    ])
  })

  it('첫 프롬프트는 스킬 호출과 context.md 경로만 담는다 (D19)', () => {
    expect(relaySkillName('work-start')).toBe('relay-work-start')
    expect(firstPrompt('work-start', 'C:\\x\\context.md')).toBe(
      '/relay-work-start 이 task의 컨텍스트: C:\\x\\context.md',
    )
  })
})
