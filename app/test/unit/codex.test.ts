import { describe, expect, it } from 'vitest'
import { codexToolDenial, tomlValue } from '../../src/core/codex'
import { actions, createWork, currentTask, transition } from '../../src/core/machine'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { Handoff } from '../../src/shared/contracts'

describe('Codex 보호 범위', () => {
  const input = {
    workDir: '/home/relay/work',
    worktree: '/repo',
    taskDir: '/home/relay/work/tasks/02-fix',
    previousTaskDirs: ['/home/relay/work/tasks/01-intake'],
  }
  it('직접 push·gh pr, 이전 기록 편집과 패치 이동을 거절하되 현재 산출물과 읽기는 허용한다', () => {
    for (const command of [
      'git push origin main',
      'git -C /repo push',
      'echo hi; gh pr create',
      'gh --repo owner/repo pr view',
    ])
      expect(codexToolDenial(input, 'exec_command', { cmd: command })).toBeTruthy()
    for (const p of [
      '/home/relay/work/work.json',
      '/home/relay/work/tasks/01-intake/handoff.md',
      '../home/relay/work/work.json',
      '/home/relay/work/tasks/02-fix/.agents/skills/relay-code-fix/SKILL.md',
    ])
      expect(codexToolDenial(input, 'Edit', { file_path: p })).toBeTruthy()
    expect(
      codexToolDenial(input, 'apply_patch', {
        command:
          '*** Begin Patch\n*** Update File: src/a.js\n*** Move to: /home/relay/work/work.json\n*** End Patch',
      }),
    ).toBeTruthy()
    expect(
      codexToolDenial(input, 'exec_command', { cmd: 'cat /home/relay/work/request.md' }),
    ).toBeNull()
    expect(
      codexToolDenial(input, 'Write', { path: '/home/relay/work/tasks/02-fix/handoff.md' }),
    ).toBeNull()
  })
  it('Windows 대소문자와 .. 경로로 보호 파일을 우회하지 않는다', () => {
    const win = {
      workDir: 'C:\\Relay\\work',
      worktree: 'C:\\repo',
      previousTaskDirs: ['C:\\Relay\\work\\tasks\\01-intake'],
    }
    expect(
      codexToolDenial(win, 'apply_patch', {
        command: '*** Update File: C:\\RELAY\\work\\tasks\\..\\work.json',
      }),
    ).toBeTruthy()
    expect(codexToolDenial(win, 'Write', { path: 'src/a.js' })).toBeNull()
  })
  it('push·PR 명령을 설명하는 일반 패치는 허용하고 실행과 보호 대상 편집은 거절한다', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: README.md',
      '@@',
      '+To publish, run git push origin main or gh pr create.',
      '+> Read the previous task at /home/relay/work/tasks/01-intake/handoff.md.',
      '*** End Patch',
    ].join('\n')
    expect(codexToolDenial(input, 'apply_patch', { input: patch })).toBeNull()
    expect(
      codexToolDenial(input, 'apply_patch', {
        input: patch.replace('README.md', '/home/relay/work/work.json'),
      }),
    ).toBeTruthy()
    for (const tool of ['Bash', 'exec_command', 'shell_command', 'shell']) {
      expect(codexToolDenial(input, tool, { command: 'git push origin main' })).toBeTruthy()
      expect(codexToolDenial(input, tool, { cmd: 'gh pr create' })).toBeTruthy()
      expect(codexToolDenial(input, tool, { input: 'rm /home/relay/work/work.json' })).toBeTruthy()
    }
  })
  it('실행 도구의 workdir·cwd와 상대 경로를 정규화해 보호한다', () => {
    const cases = [
      { cmd: 'printf changed > request.md', workdir: input.workDir },
      { cmd: 'rm handoff.md', workdir: input.previousTaskDirs[0] },
      { command: 'tee ./request.md', cwd: '/home/relay/work/tasks/..' },
      { command: 'mv notes.md ../request.md', cwd: input.taskDir + '/..' },
      { cmd: 'rm ./context.md', workdir: input.taskDir },
      { cmd: 'rm -rf .agents', workdir: input.workDir },
      { cmd: 'rm -rf .', workdir: input.workDir },
      { cmd: 'rm handoff.md', workdir: '../home/relay/work/tasks/01-intake' },
      { cmd: 'printf changed > ../home/relay/work/request.md' },
    ]
    for (const args of cases)
      expect(codexToolDenial(input, 'exec_command', args), JSON.stringify(args)).toBeTruthy()
    expect(
      codexToolDenial(input, 'exec_command', { cmd: 'cat request.md', workdir: input.workDir }),
    ).toBeNull()
    expect(
      codexToolDenial(input, 'exec_command', {
        cmd: 'printf request.md > notes.md',
        workdir: input.workDir,
      }),
    ).toBeNull()
    expect(
      codexToolDenial(input, 'exec_command', {
        cmd: 'printf changed > handoff.md',
        workdir: input.taskDir,
      }),
    ).toBeNull()
    expect(
      codexToolDenial(input, 'exec_command', {
        cmd: 'rm request.md',
        workdir: input.workDir + '-other',
      }),
    ).toBeNull()
    expect(
      codexToolDenial(input, 'apply_patch', {
        input: '*** Update File: request.md',
        cwd: input.workDir,
      }),
    ).toBeTruthy()
    expect(
      codexToolDenial({ ...input, cwd: input.taskDir }, 'exec_command', { cmd: 'rm context.md' }),
    ).toBeTruthy()
    expect(
      codexToolDenial({ ...input, cwd: input.taskDir }, 'exec_command', {
        cmd: 'rm handoff.md',
        workdir: '../01-intake',
      }),
    ).toBeTruthy()
    const win = {
      workDir: 'C:\\Relay Work',
      worktree: 'C:\\repo',
      previousTaskDirs: ['C:\\Relay Work\\tasks\\01-intake'],
    }
    expect(
      codexToolDenial(win, 'shell_command', {
        command: 'Set-Content -Path "./request.md" -Value changed',
        workdir: 'c:\\RELAY WORK\\tasks\\..',
      }),
    ).toBeTruthy()
    expect(
      codexToolDenial(win, 'shell_command', {
        command: 'Remove-Item .\\handoff.md',
        cwd: 'C:\\Relay Work\\tasks\\01-intake',
      }),
    ).toBeTruthy()
    expect(
      codexToolDenial(input, 'exec_command', {
        cmd: 'printf changed > "request.md"',
        workdir: input.workDir,
      }),
    ).toBeTruthy()
  })
  it('TOML 인라인 객체와 문자열을 구분하고 토큰을 훅 설정에 넣지 않는다', () => {
    expect(tomlValue({ input: { cmd: '한글 "quoted"\nline' }, enabled: true })).toBe(
      '{ "input" = { "cmd" = "한글 \\"quoted\\"\\nline" }, "enabled" = true }',
    )
  })
  it('중복 구분자와 ..를 같은 보호 경로로 해석하되 다른 경로와 현재 산출물은 허용한다', () => {
    for (const target of [
      '/home/relay//work/request.md',
      '/home/relay/work//tasks//../request.md',
      '/home//relay/work/tasks//01-intake/handoff.md',
      '/home/relay/work/tasks/02-fix//context.md',
    ]) {
      expect(
        codexToolDenial(input, 'apply_patch', { input: `*** Update File: ${target}` }),
      ).toBeTruthy()
      expect(
        codexToolDenial(input, 'exec_command', { cmd: `printf changed > ${target}` }),
      ).toBeTruthy()
    }
    expect(
      codexToolDenial(input, 'exec_command', {
        cmd: 'rm request.md',
        workdir: '/home/relay//work//tasks//..',
      }),
    ).toBeTruthy()
    expect(
      codexToolDenial(input, 'exec_command', { cmd: 'rm -rf /home/relay/work/../../..' }),
    ).toBeTruthy()
    expect(
      codexToolDenial(input, 'apply_patch', {
        input: '*** Update File: /home//relay/work/tasks//02-fix/handoff.md',
      }),
    ).toBeNull()
    expect(
      codexToolDenial(input, 'apply_patch', {
        input: '*** Update File: /home//relay/work-other/request.md',
      }),
    ).toBeNull()
    expect(
      codexToolDenial(
        { workDir: 'C:\\Relay Work', worktree: 'C:\\repo', previousTaskDirs: [] },
        'shell_command',
        { command: 'Remove-Item request.md', workdir: 'c:\\RELAY WORK\\\\tasks\\\\..' },
      ),
    ).toBeTruthy()
  })
})

describe('Codex 완료와 자동 승인', () => {
  it('신뢰 전 중단하여 실제 ID가 없으면 재개 대신 새 task로 다시 실행할 수 있다', () => {
    let work = createWork({
      engine: 'codex',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: 'base',
      at: 'now',
    }).work
    work = transition(
      work,
      {
        type: 'session.started',
        taskId: 't-01',
        at: 'now',
        sessionId: '',
        pid: 1,
        startCommit: 'base',
        skillHash: 'skill',
      },
      DEFAULT_CONFIG,
    ).work
    work = transition(
      work,
      { type: 'interrupt', taskId: 't-01', at: 'now', reason: 'human' },
      DEFAULT_CONFIG,
    ).work
    expect(actions(work)).toMatchObject({ resume: false, retry: true })
    expect(
      transition(work, { type: 'resume', taskId: 't-01', at: 'now' }, DEFAULT_CONFIG).rejected,
    ).toBeTruthy()
    const retry = transition(work, { type: 'retry', taskId: 't-01', at: 'now' }, DEFAULT_CONFIG)
    expect(retry.rejected).toBeUndefined()
    expect(currentTask(retry.work)).toMatchObject({ id: 't-02', engine: 'claude', session: null })
  })
  it('유효한 handoff의 Stop을 받아도 알 수 없는 미완료 작업을 없음으로 보지 않는다', () => {
    const config = {
      ...DEFAULT_CONFIG,
      agent_engine: 'codex' as const,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: true },
    }
    let work = createWork({
      engine: 'codex',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: 'base',
      at: 'now',
    }).work
    const task = currentTask(work)
    if (!task) throw new Error('task 없음')
    work = { ...work, intent: { version: 1, size: 'S' }, tasks: [{ ...task, node: 'fix' }] }
    work = transition(
      work,
      {
        type: 'session.started',
        taskId: task.id,
        at: 'now',
        sessionId: '',
        pid: 1,
        startCommit: 'base',
        skillHash: 'skill',
        engineVersion: 'codex v1',
      },
      config,
    ).work
    work = transition(
      work,
      { type: 'session.identified', taskId: task.id, at: 'now', sessionId: 'real-id' },
      config,
    ).work
    const header: Handoff = {
      status: 'awaiting_approval',
      decisions: [],
      assumptions: [],
      rejected: [],
      open_questions: [],
      intent_deviation: null,
      risks: [],
      recommended_next: null,
    }
    const done = transition(
      work,
      {
        type: 'turn.completed',
        taskId: task.id,
        at: 'now',
        pending: 'unknown',
        stopHookActive: false,
        handoffChanged: true,
        check: {
          handoff_present: true,
          status: 'awaiting_approval',
          errors: [],
          warnings: [],
          handoffHeader: header,
        },
      },
      config,
    ).work
    expect(currentTask(done)).toMatchObject({
      engine: 'codex',
      session: { id: 'real-id', alive: true },
      status: 'awaiting_approval',
    })
    expect(currentTask(done)?.countdown).toBeUndefined()
    expect(currentTask(done)?.auto_hold).toBeUndefined()
    // 훅이 완료를 주장하거나 기본 엔진을 바꿔도 Codex task는 수동 승인이다.
    const claimedDone = transition(
      work,
      {
        type: 'turn.completed',
        taskId: task.id,
        at: 'now',
        pending: 'none',
        stopHookActive: false,
        handoffChanged: true,
        check: {
          handoff_present: true,
          status: 'awaiting_approval',
          errors: [],
          warnings: [],
          handoffHeader: header,
        },
      },
      { ...config, agent_engine: 'claude' },
    ).work
    expect(currentTask(claimedDone)?.countdown).toBeUndefined()
    // 옛 버전/손으로 고친 기록의 타이머가 도착해도 승인 또는 다음 task를 실행하지 않는다.
    const stale = {
      ...done,
      tasks: done.tasks.map((t) => ({ ...t, countdown: { started_at: 'old', seconds: 1 } })),
    }
    const fired = transition(
      stale,
      {
        type: 'autoApprove',
        taskId: task.id,
        at: 'now',
        startedAt: 'old',
        check: null,
      },
      config,
    )
    expect(currentTask(fired.work)?.status).toBe('awaiting_approval')
    expect(currentTask(fired.work)?.auto_hold?.reasons).toEqual(['settings'])
    expect(fired.effects.some((e) => e.type === 'startTask' || e.type === 'respond')).toBe(false)
  })
})
