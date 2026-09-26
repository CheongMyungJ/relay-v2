// context.md 조립 (시나리오 2-4, D19). 앱이 task를 시작할 때 task 디렉터리에 쓰고,
// 첫 프롬프트에는 이 파일의 경로만 넣는다. 스킬은 이 파일부터 읽는다 (5.6.3).
// 되감기로 들어온 경우의 항목(사람 추가 지시, 폐기된 시도 요약)은 M4에서 더한다.
import type { AppConfig, QuestionMode, WorkSettings } from '../shared/config'
import type { NodeName } from '../shared/contracts'
import type { TaskRecord, WorkState } from '../shared/work'
import { NODE_INFO, WORK_COMPLETE, defaultNext, previousSteps, type NextStep } from './pipeline'
import { parseFrontMatter } from './validate'

export type ApprovalMode = 'manual' | 'auto'

/** 승인 방식. intake와 verify는 항상 수동이고, 나머지는 Work 설정, 앱 설정 순서로 본다 (4.2, D72) */
export function approvalMode(
  config: AppConfig,
  settings: WorkSettings,
  node: NodeName,
): ApprovalMode {
  if (node !== 'evidence' && node !== 'rca' && node !== 'fix') return 'manual'
  return (settings.auto_approve?.[node] ?? config.auto_approve[node]) ? 'auto' : 'manual'
}

/** 이 노드 스킬의 질문 방식. Work 설정, 앱 설정 순서로 본다 (D26, D72) */
export function questionMode(
  config: AppConfig,
  settings: WorkSettings,
  node: NodeName,
): QuestionMode {
  const skill = NODE_INFO[node].skill
  return settings.question_mode?.[skill] ?? config.question_mode[skill]
}

const CLOSING: Record<ApprovalMode, string> = {
  manual:
    '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 고칠 점은 여기에 말해 주세요.',
  auto:
    '산출물과 handoff를 썼습니다. 자동 승인이 켜진 단계라 조건을 만족하면 카운트다운 뒤 승인됩니다. ' +
    '멈추려면 [취소]를 누르거나 여기에 말해 주세요.',
}

/** 승인 버튼 이름과 조사. intake는 [의도 승인], verify는 [Work 완료]다 (D104) */
const APPROVE_BUTTON: Partial<Record<NodeName, string>> = {
  intake: '[의도 승인]을',
  verify: '[Work 완료]를',
}

/** 마무리 안내 문구 (D104). 승인 방식과 노드에 따라 고정 문구를 쓴다 */
export function closingMessage(node: NodeName, mode: ApprovalMode): string {
  const button = APPROVE_BUTTON[node]
  return button ? CLOSING[mode].replace('[승인]을', button) : CLOSING[mode]
}

const APPROVAL_LABEL: Record<ApprovalMode, string> = { manual: '수동 승인', auto: '자동 승인' }

/** 질문 방식의 이름. _common.md의 표와 같다 (5.6.1) */
const QUESTION_LABEL: Record<QuestionMode, string> = {
  draft_first: '초안 우선 (`draft_first`)',
  confirm_each: '결정마다 확인 (`confirm_each`)',
}

/** 이전 task의 파일이나 값. 폐기된 task는 넣지 않는다 (5.4, 6.2) */
export interface TaskRef {
  taskId: string
  node: NodeName
}

export interface ContextInput {
  work: WorkState
  /** 시작하는 task */
  task: TaskRecord
  /** task를 시작하는 때의 앱 설정. 질문 방식은 이때의 값을 쓴다 (D73) */
  config: AppConfig
  /** 이 task 디렉터리의 절대 경로 */
  taskDir: string
  /** request.md의 절대 경로와 내용. intake에는 본문을, 이후 task에는 경로를 넣는다 (D34) */
  request: { path: string; text: string }
  /** 승인된 최신 intent.md의 내용. 의도 승인 전에는 null */
  intent: string | null
  /** decisions.md의 내용. 폐기된 task의 항목은 뺀 것이다 (5.4) */
  decisionLog: string
  /** 이전 handoff의 rejected (누적 기각 목록) */
  rejected: readonly (TaskRef & { items: readonly string[] })[]
  /** 직전 handoff.md의 내용 */
  previousHandoff: (TaskRef & { text: string }) | null
  /** 이전 task의 산출물 경로 (D89). 경로만 넣는다 */
  artifacts: readonly (TaskRef & { path: string })[]
}

/** 이전 task에서 main이 읽은 것. 폐기되지 않은 task를 순서대로 넘긴다 */
export interface PreviousTask extends TaskRef {
  /** handoff.md의 내용. 없으면 undefined */
  handoff?: string
  /** 산출물의 절대 경로 (D89: task 디렉터리의 .md 중 context.md와 handoff.md를 뺀 것) */
  artifacts: readonly string[]
}

/** handoff 머리글의 rejected. 머리글을 읽지 못하거나 목록이 아니면 빈 목록이다 */
function rejectedOf(handoff: string): string[] {
  const fm = parseFrontMatter(handoff)
  const items = fm.ok ? fm.data['rejected'] : undefined
  return Array.isArray(items) ? items.filter((i): i is string => typeof i === 'string') : []
}

/**
 * context.md의 누적 기각 목록, 직전 handoff, 필요한 산출물 (시나리오 2-4).
 * 기각 목록은 이전 모든 handoff의 rejected이고, 직전 handoff는 마지막 handoff다.
 * 산출물은 경로만 넣는다. intake의 intent 초안은 확정한 intent가 대신하므로 뺀다 (D89).
 */
export function previousInputs(
  previous: readonly PreviousTask[],
): Pick<ContextInput, 'rejected' | 'previousHandoff' | 'artifacts'> {
  const withHandoff = previous.filter((p) => p.handoff !== undefined)
  const last = withHandoff[withHandoff.length - 1]
  return {
    rejected: withHandoff.map((p) => ({
      taskId: p.taskId,
      node: p.node,
      items: rejectedOf(p.handoff ?? ''),
    })),
    previousHandoff: last
      ? { taskId: last.taskId, node: last.node, text: last.handoff ?? '' }
      : null,
    artifacts: previous
      .filter((p) => p.node !== 'intake')
      .flatMap((p) => p.artifacts.map((path) => ({ taskId: p.taskId, node: p.node, path }))),
  }
}

const nodeLabel = (node: NodeName) => `${node} (${NODE_INFO[node].title})`
const stepLabel = (step: NextStep) => (step === WORK_COMPLETE ? 'Work 완료' : nodeLabel(step))

/** 내용에 든 어떤 백틱 줄보다 긴 코드 펜스로 감싼다. 넣은 문서의 제목이 이 파일의 절과 섞이지 않는다 */
function fenced(text: string, lang = 'markdown'): string {
  const body = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((m) => m[0].length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}${lang}\n${body}\n${fence}`
}

/** 목록. 항목 안의 줄바꿈은 한 줄로 편다 */
function list(items: readonly string[]): string {
  return items.length ? items.map((i) => `- ${i.replace(/\s*\n\s*/g, ' ')}`).join('\n') : '없음'
}

function nextSteps(work: WorkState, node: NodeName): string[] {
  // intake의 기본 다음 단계는 의도 승인 때 정하는 size에 달렸다 (3.4)
  const next =
    node === 'intake'
      ? `의도 승인 뒤 size에 따라 ${stepLabel(defaultNext(node, 'M'))}, size가 S이면 ${stepLabel(defaultNext(node, 'S'))}`
      : stepLabel(defaultNext(node, work.intent?.size ?? 'M'))
  const previous = previousSteps(node)
  return [
    `기본 다음 단계: ${next}`,
    `이전 단계: ${previous.length ? previous.map(nodeLabel).join(', ') : '없음'}`,
  ]
}

/** context.md의 내용 (시나리오 2-4의 표) */
export function buildContext(input: ContextInput): string {
  const { work, task, config } = input
  const info = NODE_INFO[task.node]
  const mode = approvalMode(config, work.settings, task.node)
  const sections: [string, string][] = [
    [
      'task 정보',
      list([
        `work_id: ${work.work_id}`,
        `task_id: ${task.id}`,
        `node: ${nodeLabel(task.node)}`,
        `skill: ${info.skill}`,
        `승인된 intent 버전: ${work.intent ? String(work.intent.version) : '없음 (의도 승인 전)'}`,
        `task 디렉터리: ${input.taskDir}`,
        `기준 브랜치: ${work.base_branch}`,
        `기준 커밋: ${work.base_commit}`,
      ]),
    ],
    ['승인 방식', APPROVAL_LABEL[mode]],
    ['마무리 안내 문구', closingMessage(task.node, mode)],
    ['질문 방식', QUESTION_LABEL[questionMode(config, work.settings, task.node)]],
    ['선택 가능한 다음 단계', list(nextSteps(work, task.node))],
    [
      work.intent ? `intent (버전 ${work.intent.version})` : 'intent',
      input.intent === null ? '없음 (의도 승인 전)' : fenced(input.intent),
    ],
    [
      'Work 요청 원문',
      task.node === 'intake'
        ? `경로: ${input.request.path}\n\n${fenced(input.request.text, 'text')}`
        : `경로: ${input.request.path}`,
    ],
    ['결정 로그', input.decisionLog.trim() ? fenced(input.decisionLog) : '없음'],
    [
      '누적 기각 목록',
      list(input.rejected.flatMap((r) => r.items.map((i) => `${r.taskId} ${r.node}: ${i}`))),
    ],
    [
      input.previousHandoff
        ? `직전 handoff (${input.previousHandoff.taskId} ${input.previousHandoff.node})`
        : '직전 handoff',
      input.previousHandoff ? fenced(input.previousHandoff.text) : '없음',
    ],
    ['필요한 산출물', list(input.artifacts.map((a) => `${a.taskId} ${a.node}: ${a.path}`))],
  ]
  return [
    '# relay task 컨텍스트',
    '',
    '앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.',
    ...sections.flatMap(([title, body]) => ['', `## ${title}`, '', body]),
    '',
  ].join('\n')
}
