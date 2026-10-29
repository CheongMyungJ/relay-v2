import { describe, expect, it } from 'vitest'
import {
  HOOK_EVENTS,
  cleanupArgs,
  continuePrompt,
  denyRules,
  firstPrompt,
  forkPrompt,
  hookSettings,
  hookUrl,
  launchArgs,
  launchEnv,
  promptSnapshotOff,
  relaySkillName,
  resumeArgs,
  ruleAbs,
  sessionArgs,
  sessionSettings,
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
    expect(launchEnv(token)).toEqual({
      RELAY_HOOK_TOKEN: token,
      CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN: '1',
    })
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
      `Edit(${w}/tasks/01-intake/**)`,
      `Edit(${w}/tasks/02-fix/**)`,
      `Edit(${w}/.claude/**)`,
      `Edit(${w}/type/**)`,
    ])
  })

  it('지금 task 디렉터리는 막지 않는다', () => {
    const rules = denyRules({ workDir: WORK_DIR, previousTaskDirs: [`${TASKS}\\01-intake`] })
    expect(rules.join('\n')).not.toContain('02-fix')
  })

  it('지금 task 디렉터리를 주면 그 안의 단계 절차(instructions.md)만 막는다 (D443)', () => {
    const rules = denyRules({
      workDir: WORK_DIR,
      previousTaskDirs: [`${TASKS}\\01-intake`],
      taskDir: `${TASKS}\\02-fix`,
    })
    const w = '//c/Users/u/.relay/projects/my-api-3f9a1c/works/w-20260926-001'
    expect(rules.filter((r) => r.includes('02-fix'))).toEqual([
      `Edit(${w}/tasks/02-fix/instructions.md)`,
    ])
    expect(rules).toEqual([
      ...denyRules({ workDir: WORK_DIR, previousTaskDirs: [`${TASKS}\\01-intake`] }).slice(0, -2),
      `Edit(${w}/tasks/02-fix/instructions.md)`,
      `Edit(${w}/.claude/**)`,
      `Edit(${w}/type/**)`,
    ])
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
  it('권한 확인 없이, 세션 id, Work 디렉터리, 설정 파일, 단계 절차, 첫 프롬프트로 실행한다 (D440)', () => {
    const context = `${TASKS}\\03-verify\\context.md`
    expect(
      launchArgs({
        sessionId: '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
        workDir: WORK_DIR,
        settingsPath: `${TASKS}\\03-verify\\task.settings.json`,
        instructionsPath: `${TASKS}\\03-verify\\instructions.md`,
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
      '--append-system-prompt-file',
      `${TASKS}\\03-verify\\instructions.md`,
      `relay verify 단계를 시작합니다. 이 task의 컨텍스트: ${context}`,
    ])
  })

  it('재개는 같은 옵션(단계 절차 포함) + --resume이고 --session-id와 첫 프롬프트는 뺀다 (시나리오 3-4, S6, D441)', () => {
    expect(
      resumeArgs({
        sessionId: '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
        workDir: WORK_DIR,
        settingsPath: `${TASKS}\\03-verify\\task.settings.json`,
        instructionsPath: `${TASKS}\\03-verify\\instructions.md`,
      }),
    ).toEqual([
      '--dangerously-skip-permissions',
      '--resume',
      '0b8f0d8e-6c1a-4f1e-9d9b-3c2f4a5e6d7f',
      '--add-dir',
      WORK_DIR,
      '--settings',
      `${TASKS}\\03-verify\\task.settings.json`,
      '--append-system-prompt-file',
      `${TASKS}\\03-verify\\instructions.md`,
    ])
  })

  it('의도 정리의 대화를 이어받는 시작은 --resume <id> --fork-session에 새 세션 id를 주고, 절차를 새로 주게 기록하지 않는다 (D531)', () => {
    const args = launchArgs({
      sessionId: 'new-id',
      workDir: WORK_DIR,
      settingsPath: 'S',
      instructionsPath: 'I',
      skill: 'fix',
      contextPath: 'C',
      forkFrom: 'intake-id',
    })
    expect(args).toEqual([
      '--dangerously-skip-permissions',
      '--resume',
      'intake-id',
      '--fork-session',
      '--session-id',
      'new-id',
      '--add-dir',
      WORK_DIR,
      '--settings',
      'S',
      '--system-prompt-snapshot',
      'off',
      '--append-system-prompt-file',
      'I',
      forkPrompt('fix', 'C'),
    ])
    expect(forkPrompt('fix', 'C').startsWith(firstPrompt('fix', 'C'))).toBe(true)
    // 이어받은 task를 다시 열 때도 기록하지 않는다. 아니면 넣지 않는다
    const resume = {
      sessionId: 'new-id',
      workDir: WORK_DIR,
      settingsPath: 'S',
      instructionsPath: 'I',
    }
    expect(resumeArgs({ ...resume, snapshotOff: true })).toEqual(
      expect.arrayContaining(['--system-prompt-snapshot', 'off']),
    )
    expect(resumeArgs(resume)).not.toContain('--system-prompt-snapshot')
  })

  it('시작과 재개는 단계 절차를 같은 옵션으로 준다. 빼면 압축 뒤 절차가 사라진다 (D441, 스파이크 S8)', () => {
    const common = {
      sessionId: 'id-1',
      workDir: WORK_DIR,
      settingsPath: 'S',
      instructionsPath: 'I',
    }
    const flag = (args: string[]) =>
      args.slice(
        args.indexOf('--append-system-prompt-file'),
        args.indexOf('--append-system-prompt-file') + 2,
      )
    const launched = launchArgs({ ...common, skill: 'fix', contextPath: 'C' })
    const resumed = resumeArgs({ ...common, prompt: continuePrompt(false) })
    expect(flag(launched)).toEqual(['--append-system-prompt-file', 'I'])
    expect(flag(resumed)).toEqual(flag(launched))
    // 이 변경 전에 스킬로 시작한 task는 단계 절차 파일이 없어 넣지 않는다
    expect(resumeArgs({ sessionId: 'id-1', workDir: WORK_DIR, settingsPath: 'S' })).not.toContain(
      '--append-system-prompt-file',
    )
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

  it('첫 프롬프트는 단계 이름과 context.md 경로만 담는다. 스킬을 부르지 않는다 (D442)', () => {
    expect(relaySkillName('work-start')).toBe('relay-work-start')
    expect(firstPrompt('work-start', 'C:\\x\\context.md')).toBe(
      'relay work-start 단계를 시작합니다. 이 task의 컨텍스트: C:\\x\\context.md',
    )
    expect(firstPrompt('work-start', 'C:\\x\\context.md')).not.toMatch(/^\//)
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
    instructionsPath: 'instructions.md',
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
      'relay implement 단계를 시작합니다. 이 task의 컨텍스트: context.md',
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

describe('[단위] 서브모듈 Work의 메인 통합 검증 worktree (D414)', () => {
  it('시작, 재개, 곁 세션에 Work 디렉터리 다음 --add-dir로 더한다. 없으면 지금과 같다', () => {
    const base = { sessionId: 'id-1', workDir: WORK_DIR, settingsPath: 'S' }
    const launched = launchArgs({
      ...base,
      instructionsPath: 'I',
      skill: 'implement',
      contextPath: 'context.md',
      extraDirs: ['/main'],
    })
    expect(launched.slice(3, 7)).toEqual(['--add-dir', WORK_DIR, '--add-dir', '/main'])
    expect(resumeArgs({ ...base, extraDirs: ['/main'] }).slice(3, 7)).toEqual([
      '--add-dir',
      WORK_DIR,
      '--add-dir',
      '/main',
    ])
    expect(
      sideArgs({ ...base, resume: false, guidePath: 'G', extraDirs: ['/main'] }).slice(3, 7),
    ).toEqual(['--add-dir', WORK_DIR, '--add-dir', '/main'])
    expect(resumeArgs({ ...base, extraDirs: [] })).toEqual(resumeArgs(base))
    expect(cleanupArgs('S', ['/main'])).toEqual([
      '--dangerously-skip-permissions',
      '--add-dir',
      '/main',
      '--settings',
      'S',
    ])
    expect(cleanupArgs('S')).toEqual(['--dangerously-skip-permissions', '--settings', 'S'])
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
      '--system-prompt-snapshot',
      'off',
    ])
    expect(sideArgs({ ...input, resume: true }).slice(1, 3)).toEqual(['--resume', 's-1'])
    expect(sideArgs({ ...input, resume: true })).toHaveLength(11)
    // 설정의 모델·추론 수준 (D391)
    expect(sideArgs({ ...input, resume: true, model: 'haiku', effort: 'low' }).slice(11)).toEqual([
      '--model',
      'haiku',
      '--effort',
      'low',
    ])
  })

  it('앱 소유 파일, tasks/ 아래, .claude/만 막는다. push와 gh는 막지 않는다', () => {
    const s = sideSettings({ port: 51234, taskId: 'side', workDir: WORK_DIR })
    expect(s.permissions.deny).toEqual([
      `Edit(${work}/work.json)`,
      `Edit(${work}/request.md)`,
      `Edit(${work}/intent.md)`,
      `Edit(${work}/decisions.md)`,
      `Edit(${work}/pr-items.json)`,
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

describe('[단위] 다시 연 곁·기본 세션의 안내 (D446)', () => {
  it('곁·기본 세션은 시작과 재개 모두 시스템 프롬프트를 기록해 다시 쓰지 않는다. task는 기록한 것을 쓴다 (D441)', () => {
    const snapshotOff = (args: string[]) => {
      const i = args.indexOf('--system-prompt-snapshot')
      return i >= 0 && args[i + 1] === 'off'
    }
    const side = { sessionId: 's-1', workDir: WORK_DIR, settingsPath: 'S', guidePath: 'G' }
    const session = { sessionId: 's-1', home: WORK_DIR, settingsPath: 'S', guidePath: 'G' }
    for (const resume of [false, true]) {
      expect(snapshotOff(sideArgs({ ...side, resume }))).toBe(true)
      expect(snapshotOff(sessionArgs({ ...session, resume }))).toBe(true)
    }
    const task = { sessionId: 't', workDir: WORK_DIR, settingsPath: 'S', instructionsPath: 'I' }
    expect(launchArgs({ ...task, skill: 'fix', contextPath: 'C' })).not.toContain(
      '--system-prompt-snapshot',
    )
    expect(resumeArgs(task)).not.toContain('--system-prompt-snapshot')
  })

  it('옵션이 생긴 2.1.257 이상일 때만 준다. 버전을 모르면 주지 않는다: 모르는 옵션이면 claude가 뜨지 않는다', () => {
    expect(promptSnapshotOff('2.1.308 (Claude Code)')).toBe(true)
    expect(promptSnapshotOff('2.1.257 (Claude Code)')).toBe(true)
    expect(promptSnapshotOff('2.1.256 (Claude Code)')).toBe(false)
    expect(promptSnapshotOff('2.0.999 (Claude Code)')).toBe(false)
    expect(promptSnapshotOff(null)).toBe(false)
    expect(promptSnapshotOff('dev build')).toBe(false)
    const side = { sessionId: 's-1', workDir: WORK_DIR, settingsPath: 'S', guidePath: 'G' }
    expect(sideArgs({ ...side, resume: true, refreshGuide: false })).not.toContain(
      '--system-prompt-snapshot',
    )
    expect(
      sessionArgs({ ...side, home: WORK_DIR, resume: false, refreshGuide: false }),
    ).not.toContain('--system-prompt-snapshot')
  })
})

describe('기본 세션 (시나리오 12, D399, D401)', () => {
  const HOME = 'C:\\Users\\u\\.relay'
  const home = ruleAbs(HOME)

  it('곁 세션과 같은 모양으로 첫 프롬프트 없이 RELAY_HOME을 붙이고 안내를 시스템 프롬프트에 덧붙인다. 다시 열면 --resume이다', () => {
    const input = { sessionId: 's-1', home: HOME, settingsPath: 'S', guidePath: 'G' }
    expect(sessionArgs({ ...input, resume: false })).toEqual([
      '--dangerously-skip-permissions',
      '--session-id',
      's-1',
      '--add-dir',
      HOME,
      '--settings',
      'S',
      '--append-system-prompt-file',
      'G',
      '--system-prompt-snapshot',
      'off',
    ])
    expect(sessionArgs({ ...input, resume: true }).slice(1, 3)).toEqual(['--resume', 's-1'])
    expect(sessionArgs({ ...input, resume: true, model: 'opus', effort: 'max' }).slice(11)).toEqual(
      ['--model', 'opus', '--effort', 'max'],
    )
  })

  it('config.json, projects/ 아래, sessions/*/session.json만 막는다. push와 gh는 막지 않고 자동 메모리는 CLI 설정을 따른다', () => {
    const s = sessionSettings({ port: 51234, home: HOME })
    expect(s.permissions.deny).toEqual([
      `Edit(${home}/config.json)`,
      `Edit(${home}/projects/**)`,
      `Edit(${home}/sessions/*/session.json)`,
    ])
    expect(home).toBe('//c/Users/u/.relay')
    expect(s.permissions.deny.some((r) => r.startsWith('Bash('))).toBe(false)
    expect(s).not.toHaveProperty('autoMemoryEnabled')
  })

  it('훅은 UserPromptSubmit 하나이고 URL은 /hook/session/이다 (I133)', () => {
    const s = sessionSettings({ port: 51234, home: HOME })
    expect(Object.keys(s.hooks)).toEqual(['UserPromptSubmit'])
    expect(s.hooks.UserPromptSubmit[0]?.hooks[0]?.url).toBe(
      hookUrl(51234, 'session', 'UserPromptSubmit'),
    )
  })
})
