import { describe, expect, it } from 'vitest'
import {
  HOOK_EVENTS,
  continuePrompt,
  denyRules,
  firstPrompt,
  hookSettings,
  hookUrl,
  launchArgs,
  launchEnv,
  relaySkillName,
  resumeArgs,
  ruleAbs,
  sideArgs,
  sideSettings,
  taskSettings,
} from '../../src/core/settings'

const WORK_DIR = 'C:\\Users\\u\\.relay\\projects\\my-api-3f9a1c\\works\\w-20260926-001'
const TASKS = `${WORK_DIR}\\tasks`

describe('훅 (I13, 시나리오 2-3)', () => {
  const hooks = hookSettings(51234, 't-03')

  it('일곱 가지 훅을 둔다. 실패한 도구는 PostToolUse 대신 PostToolUseFailure로 온다 (D216)', () => {
    expect(Object.keys(hooks)).toEqual([
      'UserPromptSubmit',
      'Stop',
      'Notification',
      'SessionEnd',
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
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
          // Stop은 verify의 지식 검토 호출을 기다린다 (D300)
          timeout: event === 'Stop' ? 180 : 30,
        },
      ])
    },
  )

  it('훅은 matcher 없이 건다. 도구 훅은 모든 도구에서 온다: 질문 대기(D24, D35)와 진행 표시(D216)', () => {
    const matchers = Object.fromEntries(HOOK_EVENTS.map((e) => [e, hooks[e][0]?.matcher]))
    expect(matchers).toEqual({
      UserPromptSubmit: undefined,
      Stop: undefined,
      Notification: undefined,
      SessionEnd: undefined,
      PreToolUse: undefined,
      PostToolUse: undefined,
      PostToolUseFailure: undefined,
    })
    for (const e of HOOK_EVENTS) expect(Object.keys(hooks[e][0] ?? {})).toEqual(['hooks'])
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

  it('git push, gh pr, 앱 소유 파일, 요구사항 기록, 이전 task 디렉터리, Work 디렉터리의 .claude/ 편집을 막는다', () => {
    const rules = denyRules({
      workDir: WORK_DIR,
      previousTaskDirs: [`${TASKS}\\01-intake`, `${TASKS}\\02-fix`],
    })
    const w = '//c/Users/u/.relay/projects/my-api-3f9a1c/works/w-20260926-001'
    expect(rules).toEqual([
      'Bash(git push*)',
      'Bash(gh pr*)',
      `Edit(${w}/work.json)`,
      `Edit(${w}/request.md)`,
      `Edit(${w}/intent.md)`,
      `Edit(${w}/decisions.md)`,
      `Edit(${w}/pr-items.json)`,
      `Edit(${w}/requirements/**)`,
      `Edit(${w}/tasks/01-intake/**)`,
      `Edit(${w}/tasks/02-fix/**)`,
      `Edit(${w}/.claude/**)`,
    ])
  })

  it('지금 task 디렉터리는 막지 않는다', () => {
    const rules = denyRules({ workDir: WORK_DIR, previousTaskDirs: [`${TASKS}\\01-intake`] })
    expect(rules.join('\n')).not.toContain('02-fix')
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
      previousTaskDirs: [`${TASKS}\\01-intake`, `${TASKS}\\02-fix`],
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
    const context = `${TASKS}\\03-verify\\context.md`
    expect(
      launchArgs({
        sessionId: '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
        workDir: WORK_DIR,
        settingsPath: `${TASKS}\\03-verify\\task.settings.json`,
        skill: 'verify',
        contextPath: context,
      }),
    ).toEqual([
      '--dangerously-skip-permissions',
      '--session-id',
      '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
      '--add-dir',
      WORK_DIR,
      '--settings',
      `${TASKS}\\03-verify\\task.settings.json`,
      `/relay-verify 이 task의 컨텍스트: ${context}`,
    ])
  })

  it('재개는 같은 옵션 + --resume이고 --session-id와 첫 프롬프트는 뺀다 (시나리오 3-4, S6)', () => {
    expect(
      resumeArgs({
        sessionId: '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
        workDir: WORK_DIR,
        settingsPath: `${TASKS}\\03-verify\\task.settings.json`,
      }),
    ).toEqual([
      '--dangerously-skip-permissions',
      '--resume',
      '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
      '--add-dir',
      WORK_DIR,
      '--settings',
      `${TASKS}\\03-verify\\task.settings.json`,
    ])
  })

  it('중단됨의 [재개]는 이어서 하라는 첫 입력을 맨 뒤에 준다. 앱이 꺼져 끊겼으면 그렇다고 적는다 (D218, D219)', () => {
    const args = resumeArgs({
      sessionId: 'id-1',
      workDir: WORK_DIR,
      settingsPath: 'task.settings.json',
      prompt: continuePrompt(true),
    })
    expect(args.slice(0, 3)).toEqual(['--dangerously-skip-permissions', '--resume', 'id-1'])
    expect(args.at(-1)).toBe(
      'relay: 앱이 꺼져 세션이 끊겼다가 [재개]로 다시 열렸습니다. 끊기기 전의 마지막 상태(끝나지 않은 명령 등)를 확인하고 하던 일을 이어서 하세요. 사람에게 물을 것이 있었다면 다시 물으세요.',
    )
    expect(continuePrompt(false)).toBe(
      'relay: 사람이 [즉시 중단]한 세션이 [재개]로 다시 열렸습니다. 끊기기 전의 마지막 상태(끝나지 않은 명령 등)를 확인하고 하던 일을 이어서 하세요. 사람에게 물을 것이 있었다면 다시 물으세요.',
    )
  })

  it('첫 프롬프트는 스킬 호출과 context.md 경로만 담는다 (D19)', () => {
    expect(relaySkillName('work-start')).toBe('relay-work-start')
    expect(firstPrompt('work-start', 'C:\\x\\context.md')).toBe(
      '/relay-work-start 이 task의 컨텍스트: C:\\x\\context.md',
    )
  })
})

describe('Codex 훅의 제한 시간 (D300)', () => {
  it('Stop은 지식 검토 호출을 기다리도록 Claude의 Stop 훅과 같은 180초다', async () => {
    const { codexHooks } = await import('../../src/adapters/codex')
    const hooks = codexHooks() as Record<string, { hooks: { timeout: number }[] }[]>
    expect(hooks['Stop']?.[0]?.hooks[0]?.timeout).toBe(180)
    expect(hooks['UserPromptSubmit']?.[0]?.hooks[0]?.timeout).toBe(30)
    const bridge = (await import('node:fs')).readFileSync(
      new URL('../../scripts/codex-bridge.mjs', import.meta.url),
      'utf8',
    )
    expect(bridge).toContain("body.hook_event_name === 'Stop'")
    expect(bridge).toContain('170_000')
  })
})

describe('[단위] 모델·추론 수준 인자 (F7, F8, F10)', () => {
  const launch = {
    sessionId: 'id-1',
    workDir: WORK_DIR,
    settingsPath: 'task.settings.json',
    skill: 'implement' as const,
    contextPath: 'context.md',
  }
  const resume = { sessionId: 'id-1', workDir: WORK_DIR, settingsPath: 'task.settings.json' }

  it('값이 있으면 시작과 재개 모두 --model, --effort를 첫 프롬프트 앞에 준다', () => {
    const args = launchArgs({ ...launch, model: 'opus', effort: 'high' })
    expect(args.slice(-5)).toEqual([
      '--model',
      'opus',
      '--effort',
      'high',
      '/relay-implement 이 task의 컨텍스트: context.md',
    ])
    const resumed = resumeArgs({ ...resume, model: 'opus', effort: 'high', prompt: '이어서' })
    expect(resumed.slice(-5)).toEqual(['--model', 'opus', '--effort', 'high', '이어서'])
    expect(launchArgs({ ...launch, model: 'haiku' })).not.toContain('--effort')
    expect(resumeArgs({ ...resume, effort: 'low' })).not.toContain('--model')
  })

  it('값이 없으면 지금과 같은 인자다', () => {
    expect(launchArgs(launch)).not.toContain('--model')
    expect(launchArgs(launch)).not.toContain('--effort')
    expect(resumeArgs(resume)).toHaveLength(7)
  })
})

describe('곁 세션 (시나리오 11, D386, D388)', () => {
  const work = ruleAbs(WORK_DIR)

  it('첫 프롬프트 없이 Work 디렉터리를 붙이고 안내를 시스템 프롬프트에 덧붙인다. 다시 열면 --resume이다', () => {
    const input = { sessionId: 's-1', workDir: WORK_DIR, settingsPath: 'S', guidePath: 'G' }
    expect(sideArgs({ ...input, resume: false })).toEqual([
      '--dangerously-skip-permissions',
      '--session-id',
      's-1',
      '--add-dir',
      WORK_DIR,
      '--settings',
      'S',
      '--append-system-prompt-file',
      'G',
    ])
    expect(sideArgs({ ...input, resume: true }).slice(1, 3)).toEqual(['--resume', 's-1'])
    expect(sideArgs({ ...input, resume: true })).toHaveLength(9)
    // 설정의 모델·추론 수준 (D391)
    expect(sideArgs({ ...input, resume: true, model: 'haiku', effort: 'low' }).slice(9)).toEqual([
      '--model',
      'haiku',
      '--effort',
      'low',
    ])
  })

  it('앱 소유 파일, 요구사항 기록, tasks/ 아래, .claude/만 막는다. push와 gh는 막지 않는다', () => {
    const s = sideSettings({ port: 51234, taskId: 'side', workDir: WORK_DIR })
    expect(s.permissions.deny).toEqual([
      `Edit(${work}/work.json)`,
      `Edit(${work}/request.md)`,
      `Edit(${work}/intent.md)`,
      `Edit(${work}/decisions.md)`,
      `Edit(${work}/pr-items.json)`,
      `Edit(${work}/requirements/**)`,
      `Edit(${work}/tasks/**)`,
      `Edit(${work}/.claude/**)`,
    ])
    expect(s.permissions.deny.some((r) => r.startsWith('Bash('))).toBe(false)
    expect(s.autoMemoryEnabled).toBe(false)
  })

  it('훅은 UserPromptSubmit 하나다: 받은 session_id로 다시 열 대화를 적는다 (D389)', () => {
    const s = sideSettings({ port: 51234, taskId: 'side', workDir: WORK_DIR })
    expect(Object.keys(s.hooks)).toEqual(['UserPromptSubmit'])
    expect(s.hooks.UserPromptSubmit[0]?.hooks[0]?.url).toBe(
      hookUrl(51234, 'side', 'UserPromptSubmit'),
    )
  })
})
