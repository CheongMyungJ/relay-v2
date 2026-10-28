// [단위] Work를 진행하는 쪽 (D519~D524): 승인 기록, 진행하는 쪽만 받는 승인, [직접 맡기], relay MCP로 묻는 Claude task의 인자
import { describe, expect, it } from 'vitest'
import {
  CALLER_DRIVES,
  HUMAN_DRIVES,
  REVISABLE,
  RECOMMEND_ANSWER,
  approvalBy,
  asksViaMcp,
  driverBlock,
  recommendAnswers,
  workDriver,
} from '../../src/core/driver'
import { createWork, currentTask, transition, type MachineEvent } from '../../src/core/machine'
import { decisionsBlock } from '../../src/core/records'
import {
  CALLER_ASK_NOTE,
  RELAY_ASK_TOOL,
  askViaRelay,
  launchArgs,
  relayMcpConfig,
  resumeArgs,
} from '../../src/core/settings'
import type { TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { Handoff } from '../../src/shared/contracts'
import type { WorkState } from '../../src/shared/work'

let clock = 0
const at = () => `2026-10-28T10:${String(clock++ % 60).padStart(2, '0')}:00+09:00`

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [{ what: '원인은 쉼표', why: '가격 문자열', by: 'ai' }],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

const VALID: TaskCheck = {
  handoff_present: true,
  status: 'awaiting_approval',
  errors: [],
  warnings: [],
  handoff: HANDOFF,
  handoffHeader: HANDOFF,
}

const MANUAL = {
  ...DEFAULT_CONFIG,
  auto_approve: Object.fromEntries(
    Object.keys(DEFAULT_CONFIG.auto_approve).map((k) => [k, false]),
  ) as typeof DEFAULT_CONFIG.auto_approve,
}

const apply = (work: WorkState, event: MachineEvent) => transition(work, event, MANUAL)

/** 승인 대기인 intake의 Work */
function waiting(driver?: 'caller'): WorkState {
  let work = createWork({
    type: 'bugfix',
    workId: 'w-20261028-001',
    baseBranch: 'main',
    baseCommit: 'base0001',
    at: at(),
    ...(driver ? { driver } : {}),
  }).work
  const task = currentTask(work)
  if (!task) throw new Error('task 없음')
  work = apply(work, {
    type: 'session.started',
    taskId: task.id,
    at: at(),
    sessionId: 's-1',
    pid: 1001,
    startCommit: 'start',
    skillHash: 'h',
    engineVersion: '2.1.312 (Claude Code)',
    ...(driver ? { ask: 'mcp' as const } : {}),
  }).work
  return apply(work, {
    type: 'Stop',
    taskId: task.id,
    at: at(),
    stopHookActive: false,
    handoffChanged: true,
    check: VALID,
  }).work
}

describe('[단위] Work를 진행하는 쪽 (D519, D523)', () => {
  it('driver가 없으면 사람이 진행하고, 진행하는 쪽이 아니면 승인·답·전달을 받지 않는다', () => {
    expect(workDriver({})).toBe('human')
    expect(workDriver({ driver: 'caller' })).toBe('caller')
    expect(driverBlock({}, 'human')).toBeNull()
    expect(driverBlock({}, 'caller')).toBe(HUMAN_DRIVES)
    expect(driverBlock({ driver: 'caller' }, 'caller')).toBeNull()
    expect(driverBlock({ driver: 'caller' }, 'human')).toBe(CALLER_DRIVES)
    expect(approvalBy({})).toBe('human')
    expect(approvalBy({ driver: 'caller' })).toBe('caller')
  })

  it('Claude task는 caller Work에서 시작한 것만 relay MCP로 묻고 Codex는 늘 그렇다 (D521)', () => {
    expect(asksViaMcp({}, 'claude')).toBe(false)
    expect(asksViaMcp({ ask: 'mcp' }, 'claude')).toBe(true)
    expect(asksViaMcp({}, 'codex')).toBe(true)
  })

  it('"알아서 해"는 질문마다 같은 글이고 선택지를 고르지 않는다 (5.6.1, D521)', () => {
    expect(recommendAnswers([{ id: 'a' }, { id: 'b' }])).toEqual({
      a: [RECOMMEND_ANSWER],
      b: [RECOMMEND_ANSWER],
    })
    expect(RECOMMEND_ANSWER).toMatch(/^알아서 해/)
  })

  it('고칠 점은 턴이 끝난 task만 받는다 (D524)', () => {
    expect(REVISABLE).toEqual(
      expect.arrayContaining(['awaiting_approval', 'idle', 'blocked', 'interrupted']),
    )
    expect(REVISABLE).not.toContain('working')
    expect(REVISABLE).not.toContain('asking')
  })
})

describe('[단위] caller Work의 상태 기계 (D519, D522, D523)', () => {
  it('createWork가 driver와 질문 처리를 적는다. 사람의 Work에는 질문 처리를 적지 않는다', () => {
    const base = {
      type: 'bugfix' as const,
      workId: 'w-1',
      baseBranch: 'main',
      baseCommit: 'c',
      at: at(),
    }
    expect(
      createWork({ ...base, driver: 'caller', callerQuestions: 'recommend' }).work,
    ).toMatchObject({ driver: 'caller', caller_questions: 'recommend' })
    const human = createWork({ ...base, callerQuestions: 'recommend' }).work
    expect(human.driver).toBeUndefined()
    expect(human.caller_questions).toBeUndefined()
  })

  it('세션 시작의 ask를 task 기록에 남긴다 (D521)', () => {
    expect(currentTask(waiting('caller'))?.ask).toBe('mcp')
    expect(currentTask(waiting())?.ask).toBeUndefined()
  })

  it('사람은 caller Work를 승인하지 못하고, 호출자의 승인은 호출자 승인으로 남는다', () => {
    const work = waiting('caller')
    const human = apply(work, { type: 'approve', taskId: 't-01', at: at(), check: VALID })
    expect(human.rejected).toBe(CALLER_DRIVES)
    expect(currentTask(human.work)?.status).toBe('awaiting_approval')
    const r = apply(work, { type: 'approve', taskId: 't-01', at: at(), check: VALID, by: 'caller' })
    expect(r.rejected).toBeUndefined()
    expect(r.work.tasks[0]).toMatchObject({ status: 'approved', approved_by: 'caller' })
    expect(r.effects).toContainEqual(
      expect.objectContaining({ type: 'appendDecisions', by: 'caller' }),
    )
  })

  it('호출자는 사람이 진행하는 Work를 승인하지 못한다', () => {
    const r = apply(waiting(), {
      type: 'approve',
      taskId: 't-01',
      at: at(),
      check: VALID,
      by: 'caller',
    })
    expect(r.rejected).toBe(HUMAN_DRIVES)
  })

  it('[직접 맡기]는 driver와 질문 처리를 지우고 기록을 남기며, 그 뒤 사람이 승인한다', () => {
    const work = { ...waiting('caller'), caller_questions: 'recommend' as const }
    const r = apply(work, { type: 'driver.take', at: at() })
    expect(r.work.driver).toBeUndefined()
    expect(r.work.caller_questions).toBeUndefined()
    expect(r.effects).toContainEqual(
      expect.objectContaining({
        type: 'log',
        event: expect.objectContaining({ type: 'work.taken_over' }),
      }),
    )
    expect(apply(r.work, { type: 'driver.take', at: at() }).rejected).toBeTruthy()
    const approved = apply(r.work, { type: 'approve', taskId: 't-01', at: at(), check: VALID })
    expect(approved.work.tasks[0]?.approved_by).toBe('human')
  })

  it('decisions.md의 머리 줄에 호출자 승인을 적는다 (5.4)', () => {
    const block = decisionsBlock({
      taskId: 't-01',
      node: 'intake',
      at: '2026-10-28T10:00:00+09:00',
      by: 'caller',
      decisions: [],
    })
    expect(block).toContain('(호출자 승인)')
  })
})

describe('[단위] relay MCP로 묻는 Claude task의 인자 (D521)', () => {
  const launch = {
    sessionId: 'id',
    workDir: '/w',
    settingsPath: '/s',
    instructionsPath: '/i',
    skill: 'work-start' as const,
    contextPath: '/c',
  }

  it('MCP 설정을 주면 --mcp-config와 AskUserQuestion 빼기를 넣고, 없으면 지금과 같다', () => {
    const args = launchArgs({ ...launch, mcpConfigPath: '/m.json' })
    expect(args).toEqual(
      expect.arrayContaining(['--mcp-config', '/m.json', '--disallowedTools', 'AskUserQuestion']),
    )
    expect(args.at(-1)).toMatch(/^relay work-start 단계를 시작합니다/)
    // 두 옵션은 값을 여럿 받아 바로 뒤의 첫 프롬프트를 먹는다: 값이 하나인 --settings가 끊는다
    expect(args.indexOf('--disallowedTools')).toBeLessThan(args.indexOf('--settings'))
    expect(args.indexOf('--mcp-config')).toBeLessThan(args.indexOf('--settings'))
    expect(launchArgs(launch)).not.toContain('--mcp-config')
    const resumed = resumeArgs({
      sessionId: 'id',
      workDir: '/w',
      settingsPath: '/s',
      mcpConfigPath: '/m.json',
      prompt: '고칠 점',
    })
    expect(resumed).toEqual(expect.arrayContaining(['--mcp-config', '/m.json']))
    expect(resumed.at(-1)).toBe('고칠 점')
  })

  it('relay 서버는 앱 실행 파일로 브리지를 띄우고 포트와 task id만 파일에 둔다(토큰은 환경 변수)', () => {
    const c = relayMcpConfig({ command: '/relay', bridge: '/b.mjs', port: 4321, taskId: 't-02' })
    expect(c.mcpServers.relay).toEqual({
      type: 'stdio',
      command: '/relay',
      args: ['/b.mjs', 'mcp'],
      env: { ELECTRON_RUN_AS_NODE: '1', RELAY_HOOK_PORT: '4321', RELAY_HOOK_TASK: 't-02' },
    })
    expect(JSON.stringify(c)).not.toContain('TOKEN')
  })

  it('절차의 질문 도구 이름을 바꾸고, 호출자가 답하는 안내는 터미널을 보지 못한다고 알린다', () => {
    expect(askViaRelay('Use only the `AskUserQuestion` tool.')).toBe(
      `Use only the \`${RELAY_ASK_TOOL}\` tool.`,
    )
    expect(CALLER_ASK_NOTE).toMatch(/cannot see this terminal/)
  })
})
