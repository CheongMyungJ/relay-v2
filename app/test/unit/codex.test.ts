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
  it('TOML 인라인 객체와 문자열을 구분하고 토큰을 훅 설정에 넣지 않는다', () => {
    expect(tomlValue({ input: { cmd: '한글 "quoted"\nline' }, enabled: true })).toBe(
      '{ "input" = { "cmd" = "한글 \\"quoted\\"\\nline" }, "enabled" = true }',
    )
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
      auto_hold: { reasons: ['completion_unknown'] },
    })
    expect(currentTask(done)?.countdown).toBeUndefined()
  })
})
