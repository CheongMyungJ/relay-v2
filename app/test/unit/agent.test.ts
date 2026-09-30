import { describe, expect, it } from 'vitest'
import { agentLabel, taskEngine, taskEngineVersion } from '../../src/core/agent'
import { applyConfigPatch, normalizeConfig } from '../../src/core/config'
import { createWork, currentTask, transition } from '../../src/core/machine'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { AgentEngine } from '../../src/shared/agent'
import type { WorkState } from '../../src/shared/work'
import type { Handoff } from '../../src/shared/contracts'

const at = '2026-09-30T10:00:00Z'
const codex = { ...DEFAULT_CONFIG, agent_engine: 'codex' as const }
const makeWork = (engine: AgentEngine = 'claude') =>
  createWork({ engine, workId: 'w-20260930-001', baseBranch: 'main', baseCommit: 'base', at }).work

const handoff: Handoff = {
  status: 'awaiting_approval',
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}
const firstTask = (work: WorkState) => {
  const task = currentTask(work)
  if (!task) throw new Error('시험 Work에 task가 없음')
  return task
}

describe('엔진 선택과 이전 기록 (E3, E5)', () => {
  it('없는 기본값은 Claude이고, 잘못된 설정은 경고한다. 설정 화면에서는 거절한다', () => {
    expect(normalizeConfig({}).config.agent_engine).toBe('claude')
    expect(normalizeConfig({ agent_engine: 'codex' }).config.agent_engine).toBe('codex')
    const invalid = normalizeConfig({ agent_engine: 'unknown' })
    expect(invalid.config.agent_engine).toBe('claude')
    expect(invalid.warnings).toHaveLength(1)
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_engine: 'unknown' }).ok).toBe(false)
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_engine: 'codex' })).toMatchObject({
      ok: true,
      value: { agent_engine: 'codex' },
    })
  })

  it('기존 task는 Claude로 읽고, 명시된 알 수 없는 엔진은 자동 대체하지 않는다', () => {
    expect(taskEngine({})).toBe('claude')
    expect(taskEngineVersion({ claude_version: 'old' })).toBe('old')
    expect(taskEngineVersion({ engine: 'codex', claude_version: 'old' })).toBeUndefined()
    // 디스크 JSON은 컴파일러의 검사를 받지 않는다.
    const corrupt = JSON.parse('{"engine":"unknown"}') as { engine: AgentEngine }
    expect(() => taskEngine(corrupt)).toThrow('지원하지 않는 엔진')
    expect(agentLabel(corrupt)).toContain('unknown')
  })

  it('처음 만든 task의 엔진은 대기열과 설정 변경 후에도 유지한다', () => {
    const initial = makeWork('codex')
    const queued = transition(
      initial,
      { type: 'task.queued', taskId: 't-01', at },
      DEFAULT_CONFIG,
    ).work
    const changed = transition(queued, { type: 'config.updated', at }, DEFAULT_CONFIG).work
    expect(currentTask(changed)).toMatchObject({ engine: 'codex', status: 'queued' })
    expect(currentTask(initial)?.engine).toBe('codex')
  })

  it('새 task를 생성하는 승인에는 그 순간의 기본 엔진을 쓰고 이전 task는 보존한다', () => {
    const initial = makeWork()
    const ready: WorkState = {
      ...initial,
      intent: { version: 1, size: 'S' },
      tasks: [{ ...firstTask(initial), node: 'fix', status: 'awaiting_approval' }],
    }
    const next = transition(
      ready,
      {
        type: 'approve',
        taskId: 't-01',
        at,
        check: {
          handoff_present: true,
          status: 'awaiting_approval',
          errors: [],
          warnings: [],
          handoff,
          handoffHeader: handoff,
          intentDraft: null,
        },
      },
      codex,
    )
    expect(next.rejected).toBeUndefined()
    expect(next.work.tasks.map((t) => [t.node, t.engine])).toEqual([
      ['fix', 'claude'],
      ['review', 'codex'],
    ])
  })

  it('handoff 없이 끝난 단계를 새 세션으로 다시 하면 현재 기본 엔진으로 새 task를 만든다', () => {
    const initial = makeWork()
    const ended: WorkState = {
      ...initial,
      tasks: [{ ...firstTask(initial), status: 'session_ended' }],
    }
    const retried = transition(ended, { type: 'retry', taskId: 't-01', at }, codex)
    expect(retried.rejected).toBeUndefined()
    expect(retried.work.tasks.map((t) => t.engine)).toEqual(['claude', 'codex'])
  })

  it('다른 기본 엔진을 고른 뒤 재개해도 기존 엔진과 대화 ID를 유지하고 버전만 갱신한다', () => {
    const started = transition(
      makeWork(),
      {
        type: 'session.started',
        taskId: 't-01',
        at,
        sessionId: 'claude-session',
        pid: 10,
        startCommit: 'base',
        skillHash: 'hash',
        engineVersion: 'v1',
      },
      DEFAULT_CONFIG,
    ).work
    const interrupted = transition(
      started,
      { type: 'interrupt', taskId: 't-01', at, reason: 'human' },
      codex,
    ).work
    const resumed = transition(
      interrupted,
      {
        type: 'session.resumed',
        taskId: 't-01',
        at,
        pid: 11,
        engineVersion: 'v2',
        check: { handoff_present: false, status: null, errors: [], warnings: [] },
      },
      codex,
    ).work
    expect(currentTask(resumed)).toMatchObject({
      engine: 'claude',
      engine_version: 'v2',
      claude_version: 'v2',
      session: { id: 'claude-session', pid: 11, alive: true },
    })
  })
})
