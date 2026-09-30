import { AGENT_LABELS, isAgentEngine, type AgentEngine } from '../shared/agent'
import type { TaskRecord } from '../shared/work'

/** 읽기·정책 판정용. 알 수 없는 엔진은 수동 처리하고, 실행 시에는 taskEngine으로 거절한다. */
export function knownTaskEngine(task: Pick<TaskRecord, 'engine'>): AgentEngine | null {
  if (task.engine === undefined) return 'claude'
  return isAgentEngine(task.engine) ? task.engine : null
}

/** 기존 기록만 Claude로 해석한다. 명시된 알 수 없는 엔진은 자동 대체하지 않는다. */
export function taskEngine(task: Pick<TaskRecord, 'engine'>): AgentEngine {
  const engine = knownTaskEngine(task)
  if (engine === null) throw new Error(agentLabel(task))
  return engine
}

/** 손으로 고친 기록도 표시할 수 있도록, 표시만 할 때는 알 수 없는 엔진을 그대로 알린다. */
export function agentLabel(task: Pick<TaskRecord, 'engine'>): string {
  if (task.engine === undefined) return AGENT_LABELS.claude
  return isAgentEngine(task.engine)
    ? AGENT_LABELS[task.engine]
    : `지원하지 않는 엔진: ${String(task.engine)}`
}

export function taskEngineVersion(
  task: Pick<TaskRecord, 'engine' | 'engine_version' | 'claude_version'>,
): string | undefined {
  return (
    task.engine_version ??
    (task.engine === undefined || task.engine === 'claude' ? task.claude_version : undefined)
  )
}
