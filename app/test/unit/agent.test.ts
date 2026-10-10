import { describe, expect, it } from 'vitest'
import { agentLabel, sessionUnknown, taskEngine, taskEngineVersion } from '../../src/core/agent'
import { applyConfigPatch, normalizeConfig } from '../../src/core/config'
import { actions, createWork, currentTask, transition } from '../../src/core/machine'
import { autoApproveNote } from '../../src/core/approval'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import {
  AGENT_MODELS,
  changeDefaultEngine,
  changeDefaultModel,
  changeStepEngine,
  effortsFor,
  fitAgent,
  resolveAgent,
  setAgentStep,
  stepModel,
  type AgentEngine,
} from '../../src/shared/agent'
import type { WorkState } from '../../src/shared/work'
import type { Handoff } from '../../src/shared/contracts'

const at = '2026-09-30T10:00:00Z'
const codex = { ...DEFAULT_CONFIG, agent_engine: 'codex' as const }
const makeWork = (engine: AgentEngine = 'claude') =>
  createWork({
    type: 'bugfix',
    engine,
    workId: 'w-20260930-001',
    baseBranch: 'main',
    baseCommit: 'base',
    at,
  }).work

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

  it('알 수 없는 엔진은 재개와 자동 승인을 막고 재시작·설정 변경은 허용한다', () => {
    const initial = makeWork()
    const config = {
      ...DEFAULT_CONFIG,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: true },
    }
    const task = {
      ...firstTask(initial),
      node: 'fix' as const,
      status: 'awaiting_approval' as const,
      engine: JSON.parse('"future-engine"') as AgentEngine,
      countdown: { started_at: at, seconds: 10 },
    }
    const work: WorkState = { ...initial, tasks: [task] }
    expect(actions(work).resume).toBe(false)
    expect(autoApproveNote(work, task, config).on).toBe(false)
    const changed = transition(work, { type: 'config.updated', at }, config)
    expect(currentTask(changed.work)?.countdown).toBeUndefined()
    expect(transition(work, { type: 'resume', taskId: task.id, at }, config)).toMatchObject({
      rejected: expect.stringContaining('future-engine'),
      effects: [],
    })
    const restarted = transition(
      { ...work, tasks: [{ ...task, status: 'working' }] },
      {
        type: 'app.restarted',
        at,
        check: {
          handoff_present: true,
          status: 'awaiting_approval',
          errors: [],
          warnings: [],
        },
      },
      config,
    )
    expect(restarted.rejected).toBeUndefined()
    expect(currentTask(restarted.work)).toMatchObject({
      engine: 'future-engine',
      status: 'awaiting_approval',
    })
    expect(currentTask(restarted.work)?.countdown).toBeUndefined()
  })

  it('요구사항 추출의 extract는 기본 엔진이 Codex여도 claude로 돌고 Codex 모델을 물려받지 않는다 (결정 92)', () => {
    const initial = createWork({
      type: 'requirements',
      engine: 'claude',
      workId: 'w-20260930-002',
      baseBranch: 'main',
      baseCommit: 'base',
      at,
    }).work
    const ready: WorkState = {
      ...initial,
      intent: { version: 1 },
      tasks: [{ ...firstTask(initial), status: 'awaiting_approval' }],
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
        },
      },
      { ...codex, agent_model: 'gpt-6.1-sol', agent_effort: 'ultra' },
    )
    expect(next.rejected).toBeUndefined()
    expect(next.work.tasks.map((t) => [t.node, t.engine, t.model, t.effort])).toEqual([
      ['intake', 'claude', undefined, undefined],
      ['extract', 'claude', undefined, undefined],
    ])
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
      intent: { version: 1 },
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
        },
      },
      codex,
    )
    expect(next.rejected).toBeUndefined()
    expect(next.work.tasks.map((t) => [t.node, t.engine])).toEqual([
      ['fix', 'claude'],
      ['verify', 'codex'],
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

describe('[단위] 대화 ID를 받지 못한 세션', () => {
  it('Codex가 SessionStart 전에 끝나 대화 ID가 비었을 때만이다 (engines.md 4.3)', () => {
    const session = { id: '', alive: false } as const
    expect(sessionUnknown({ engine: 'codex', session } as never)).toBe(true)
    expect(sessionUnknown({ engine: 'codex', session: { ...session, id: 's-1' } } as never)).toBe(
      false,
    )
    expect(sessionUnknown({ engine: 'codex' } as never)).toBe(false)
    expect(sessionUnknown({ engine: 'claude', session } as never)).toBe(false)
  })
})

describe('[단위] 모델 카탈로그와 단계별 실행 설정 해석', () => {
  const base = { ...DEFAULT_CONFIG, agent_model: '', agent_effort: '', agent_steps: {} }

  it('엔진별 모델 목록은 고정이고 모델마다 지원하는 추론 수준이 있다 (F2, F9)', () => {
    expect(AGENT_MODELS.claude.map((m) => m.id)).toEqual(['fable', 'opus', 'sonnet', 'haiku'])
    expect(AGENT_MODELS.codex.map((m) => m.id)).toEqual([
      'gpt-6.1-sol',
      'gpt-6-astra',
      'gpt-6-sol',
      'gpt-6-luna',
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
    ])
    expect(effortsFor('claude', 'haiku')).toEqual([])
    expect(effortsFor('claude', 'opus')).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    expect(effortsFor('codex', 'gpt-6.1-sol')).toContain('ultra')
    expect(effortsFor('codex', 'gpt-6-luna')).not.toContain('ultra')
    // 엔진 기본 모델이면 엔진의 전체 수준, 그 엔진에 없는 모델이면 없음
    expect(effortsFor('codex', '')).toContain('ultra')
    expect(effortsFor('claude', '')).not.toContain('ultra')
    expect(effortsFor('claude', 'gpt-6-sol')).toEqual([])
  })

  it('아무것도 지정하지 않으면 기본 엔진만 있고 모델·추론 수준 키가 없다 (F8)', () => {
    expect(resolveAgent(base, 'implement')).toEqual({ engine: 'claude' })
    expect(resolveAgent({ ...base, agent_engine: 'codex' }, 'fix')).toEqual({ engine: 'codex' })
    // 새 키가 없는 옛 설정도 읽는다
    expect(resolveAgent({ agent_engine: 'claude' }, 'design')).toEqual({ engine: 'claude' })
  })

  it('미지정 단계는 기본 엔진·모델·추론 수준을, 지정한 단계는 그 값을 쓴다 (F6)', () => {
    const config = {
      ...base,
      agent_model: 'sonnet',
      agent_effort: 'medium',
      agent_steps: {
        design: { model: 'opus', effort: 'high' },
        implement: { engine: 'codex' as const, model: 'gpt-6.1-sol', effort: 'ultra' },
      },
    }
    expect(resolveAgent(config, 'verify')).toEqual({
      engine: 'claude',
      model: 'sonnet',
      effort: 'medium',
    })
    expect(resolveAgent(config, 'design')).toEqual({
      engine: 'claude',
      model: 'opus',
      effort: 'high',
    })
    expect(resolveAgent(config, 'implement')).toEqual({
      engine: 'codex',
      model: 'gpt-6.1-sol',
      effort: 'ultra',
    })
  })

  it('엔진을 고를 수 없는 단계는 그 엔진으로 해석한다: 기본 엔진이 같을 때만 기본 모델을 물려받는다 (결정 92)', () => {
    const fromCodex = { ...base, agent_engine: 'codex' as const, agent_model: 'gpt-6.1-sol' }
    expect(resolveAgent(fromCodex, 'extract', 'claude')).toEqual({ engine: 'claude' })
    expect(
      resolveAgent(
        {
          ...fromCodex,
          agent_steps: { extract: { engine: 'claude', model: 'opus', effort: 'high' } },
        },
        'extract',
        'claude',
      ),
    ).toEqual({ engine: 'claude', model: 'opus', effort: 'high' })
    expect(
      resolveAgent({ ...base, agent_model: 'opus', agent_effort: 'high' }, 'extract', 'claude'),
    ).toEqual({ engine: 'claude', model: 'opus', effort: 'high' })
  })

  it('단계 엔진이 기본 엔진과 다르면 기본 모델·추론 수준을 물려받지 않는다 (F6)', () => {
    const config = {
      ...base,
      agent_model: 'opus',
      agent_effort: 'max',
      agent_steps: { fix: { engine: 'codex' as const } },
    }
    expect(resolveAgent(config, 'fix')).toEqual({ engine: 'codex' })
  })

  it('고른 모델이 지원하지 않는 추론 수준은 버린다 (F6)', () => {
    const config = {
      ...base,
      agent_model: 'opus',
      agent_effort: 'high',
      agent_steps: { verify: { model: 'haiku' } },
    }
    expect(resolveAgent(config, 'verify')).toEqual({ engine: 'claude', model: 'haiku' })
  })
})

describe('[단위] 설정 화면의 엔진·모델·추론 수준 바꾸기 (F4, F9, F11)', () => {
  const base = {
    ...DEFAULT_CONFIG,
    agent_model: 'opus',
    agent_effort: 'max',
    agent_steps: {
      design: { model: 'sonnet', effort: 'high' },
      verify: { engine: 'codex' as const, model: 'gpt-6-sol', effort: 'ultra' },
    },
  }

  it('모델을 바꾸면 새 모델이 받지 않는 추론 수준을 비우고, 엔진에 없는 모델은 비운다', () => {
    expect(fitAgent('claude', 'haiku', 'high')).toEqual({ model: 'haiku', effort: '' })
    expect(fitAgent('claude', 'opus', 'high')).toEqual({ model: 'opus', effort: 'high' })
    expect(fitAgent('codex', 'opus', 'max')).toEqual({ model: '', effort: 'max' })
    expect(fitAgent('claude', 'gpt-6-sol', 'ultra')).toEqual({ model: '', effort: '' })
  })

  it('한 단계를 바꾸면 그 단계만 바뀌고 다른 단계는 그대로다. 빈 값은 기본 따름이라 뺀다', () => {
    const next = setAgentStep(base.agent_steps, 'implement', {
      engine: 'codex',
      model: 'gpt-6.1-sol',
      effort: '',
    })
    expect(next).toEqual({
      ...base.agent_steps,
      implement: { engine: 'codex', model: 'gpt-6.1-sol' },
    })
    expect(base.agent_steps).not.toHaveProperty('implement')
    expect(setAgentStep(next, 'design', { model: '' })).toEqual({
      verify: base.agent_steps.verify,
      implement: { engine: 'codex', model: 'gpt-6.1-sol' },
    })
  })

  it('단계의 엔진을 바꾸면 그 단계의 모델·추론 수준이 새 엔진에 없으면 되돌린다', () => {
    const next = setAgentStep(base.agent_steps, 'verify', {
      ...base.agent_steps.verify,
      engine: 'claude',
    })
    expect(next.verify).toEqual({ engine: 'claude' })
    expect(next.design).toEqual(base.agent_steps.design)
  })

  it('모델을 정하지 않은 단계의 추론 수준은 물려받는 모델로 보인다: 기본 모델이 haiku면 고를 수 없다 (F9)', () => {
    const haiku = { ...base, agent_model: 'haiku', agent_effort: '' }
    expect(stepModel(haiku, {})).toBe('haiku')
    expect(effortsFor('claude', stepModel(haiku, { engine: 'claude' }))).toEqual([])
    expect(stepModel(haiku, { model: 'opus' })).toBe('opus')
    // 단계 엔진이 기본 엔진과 다르면 기본 모델을 물려받지 않는다
    expect(stepModel(haiku, { engine: 'codex' })).toBe('')
    expect(effortsFor('codex', stepModel(haiku, { engine: 'codex' }))).toContain('ultra')
  })
  it('모델을 정하지 않은 단계의 추론 수준은 물려받는 모델에 맞춰 저장값이 화면과 같다', () => {
    const luna = {
      ...DEFAULT_CONFIG,
      agent_engine: 'codex' as const,
      agent_model: 'gpt-6-luna',
      agent_effort: 'high',
    }
    const sol = setAgentStep(
      luna.agent_steps,
      'implement',
      { model: 'gpt-6-sol', effort: 'ultra' },
      luna,
    )
    expect(sol.implement).toEqual({ model: 'gpt-6-sol', effort: 'ultra' })
    // 모델을 기본 따름으로 되돌리면 luna가 받지 않는 ultra도 비워 기본(high)을 따른다
    const back = setAgentStep(sol, 'implement', { ...sol.implement, model: '' }, luna)
    expect(back).toEqual({})
    expect(resolveAgent({ ...luna, agent_steps: back }, 'implement')).toEqual({
      engine: 'codex',
      model: 'gpt-6-luna',
      effort: 'high',
    })
    const config = { ...luna, agent_steps: back }
    expect(applyConfigPatch(luna, { agent_steps: config.agent_steps }).ok).toBe(true)
  })

  it('기본 모델을 바꾸면 기본 추론 수준과 물려받는 단계의 추론 수준을 새 모델에 맞추고 저장할 수 있다', () => {
    const steps = { design: { effort: 'high' }, verify: { model: 'opus', effort: 'max' } }
    const next = changeDefaultModel({ ...base, agent_steps: steps }, 'haiku')
    expect(next).toMatchObject({ agent_model: 'haiku', agent_effort: '' })
    expect(next.agent_steps).toEqual({ verify: { model: 'opus', effort: 'max' } })
    const patch = {
      agent_model: next.agent_model,
      agent_effort: next.agent_effort,
      agent_steps: { design: {}, verify: next.agent_steps.verify },
    }
    expect(applyConfigPatch({ ...base, agent_steps: steps }, patch).ok).toBe(true)
  })

  it('기본 엔진을 바꾸면 기본 줄과 엔진을 정하지 않은 단계를 새 엔진에 맞추고 저장할 수 있다', () => {
    const next = changeDefaultEngine(base, 'codex')
    expect(next).toMatchObject({ agent_engine: 'codex', agent_model: '', agent_effort: 'max' })
    expect(next.agent_steps).toEqual({
      design: { effort: 'high' },
      verify: base.agent_steps.verify,
    })
    const patch = {
      agent_engine: next.agent_engine,
      agent_model: next.agent_model,
      agent_effort: next.agent_effort,
      agent_steps: next.agent_steps,
    }
    expect(applyConfigPatch(base, patch).ok).toBe(true)
  })
})

describe('[단위] 직접 입력한 모델', () => {
  it('목록에 없는 모델 이름도 쓸 수 있고, 받는 추론 수준을 몰라 엔진의 전체 수준을 고를 수 있다', () => {
    const r = applyConfigPatch(DEFAULT_CONFIG, {
      agent_model: 'claude-opus-5-5[1m]',
      agent_effort: 'max',
      agent_steps: { implement: { engine: 'codex', model: 'gpt-7-preview', effort: 'ultra' } },
    })
    expect(r).toMatchObject({ ok: true })
    if (!r.ok) return
    expect(effortsFor('codex', 'gpt-7-preview')).toContain('ultra')
    expect(resolveAgent(r.value, 'design')).toEqual({
      engine: 'claude',
      model: 'claude-opus-5-5[1m]',
      effort: 'max',
    })
    expect(resolveAgent(r.value, 'implement')).toEqual({
      engine: 'codex',
      model: 'gpt-7-preview',
      effort: 'ultra',
    })
  })

  it('CLI 인자로 넘어가므로 띄어쓰기, 셸 글자, -로 시작하는 이름은 거절한다. 다른 엔진의 모델도 거절한다', () => {
    for (const model of ['my model', 'a&b', 'x"y', '-p', 'a|b', '%PATH%', 'x'.repeat(101)]) {
      const r = applyConfigPatch(DEFAULT_CONFIG, { agent_model: model })
      expect(r.ok, model).toBe(false)
      if (!r.ok) expect(r.error).toContain('직접 입력한 모델')
    }
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_model: 'gpt-6-sol' }).ok).toBe(false)
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_steps: { design: { model: 'a;b' } } }).ok).toBe(
      false,
    )
  })

  it('엔진이 바뀌는 줄의 직접 입력한 모델은 비우고, 엔진이 그대로인 단계는 둔다', () => {
    const c = {
      ...DEFAULT_CONFIG,
      agent_model: 'my-claude',
      agent_steps: {
        design: { model: 'my-claude', effort: 'high' },
        verify: { engine: 'claude' as const, model: 'my-claude' },
      },
    }
    const next = changeDefaultEngine(c, 'codex')
    expect(next.agent_model).toBe('')
    expect(next.agent_steps).toEqual({
      design: { effort: 'high' },
      verify: { engine: 'claude', model: 'my-claude' },
    })
    expect(changeStepEngine(c, c.agent_steps.design, 'codex')).toMatchObject({
      engine: 'codex',
      model: '',
    })
    expect(changeStepEngine(c, c.agent_steps.design, 'claude')).toMatchObject({
      model: 'my-claude',
    })
  })
})
