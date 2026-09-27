// context.md 조립 (시나리오 2-4, D19). 앱이 task를 시작할 때 task 디렉터리에 쓰고,
// 첫 프롬프트에는 이 파일의 경로만 넣는다. 스킬은 이 파일부터 읽는다 (5.6.3).
// 단계 선택(6.2)으로 들어온 task는 사람 추가 지시와, 되감기면 폐기된 시도 요약을 맨 위에 강조해 넣는다.
import type { AppConfig, QuestionMode, WorkSettings } from '../shared/config'
import type { NodeName } from '../shared/contracts'
import type { TaskRecord, WorkState } from '../shared/work'
import {
  NODES,
  NODE_INFO,
  WORK_COMPLETE,
  defaultNext,
  isPrevious,
  previousSteps,
  type NextStep,
} from './pipeline'
import { parseFrontMatter, sectionText } from './validate'

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

/**
 * 승인 버튼 이름과 조사 (D104). intake는 [의도 승인]이다. verify는 Work 완료 화면(시나리오 7-3)에서
 * 누를 수 있는 전달 버튼이다: [완료만]과, origin과 gh 점검(D67, D118)에 따라 [push], [PR 생성].
 * 전달 버튼이 [완료만]뿐이면 [완료만]이다.
 */
function approveButton(node: NodeName, delivery: readonly string[]): string | null {
  if (node === 'intake') return '[의도 승인]을'
  if (node !== 'verify') return null
  const buttons = delivery.length ? delivery : ['[완료만]']
  return buttons.length === 1 ? `${buttons[0] ?? ''}을` : `${buttons.join(', ')} 중 하나를`
}

/**
 * 마무리 안내 문구 (D104). 승인 방식과 노드에 따라 고정 문구를 쓴다.
 * delivery는 verify의 전달 버튼이다(core/delivery closingButtons). 없으면 [완료만]이다.
 */
export function closingMessage(
  node: NodeName,
  mode: ApprovalMode,
  delivery: readonly string[] = [],
): string {
  const button = approveButton(node, delivery)
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

/** 되감기로 폐기한 시도 하나 (6.2의 폐기된 시도 요약). 폐기한 task의 handoff에서 읽는다 */
export interface DiscardedAttempt extends TaskRef {
  /** handoff가 있었다 */
  handoff: boolean
  /** handoff 본문의 `## 요약` */
  summary: string | null
  /** handoff의 rejected */
  rejected: string[]
  /** handoff가 이전 단계를 추천했으면 그 단계와 이유 (D23) */
  recommended: { node: NodeName; reason: string } | null
}

/** 단계 선택(6.2)으로 들어온 task의 입력. context.md의 맨 위에 강조해 넣는다 (시나리오 2-4) */
export interface SelectionInput {
  /** 되감기, 건너뛰기, 기본 진행(건너뛴 것도 폐기한 것도 없음) */
  reason: 'rewind' | 'skip' | 'default'
  /** 단계를 고른 때의 지금 task */
  from: TaskRef
  instruction: string | null
  /** 되감기의 폐기된 시도 요약. 건너뛰기에는 넣지 않는다 (6.2) */
  discarded: readonly DiscardedAttempt[]
  /** 건너뛰기: 폐기한 task */
  dropped: readonly TaskRef[]
  /** 건너뛰기: 건너뛴 단계 */
  skipped: readonly NodeName[]
  /** fix로 되감으며 [현재 코드 위에서 이어서]를 골랐다 */
  keepCode: boolean
  /** 코드를 되돌렸다 (D116, D117) */
  reset: boolean
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
  /** 단계 선택으로 들어온 task (6.2). 아니면 없다 */
  selection?: SelectionInput | null
  /** verify: Work 완료 화면에서 누를 수 있는 전달 버튼 (D104, core/delivery closingButtons) */
  delivery?: readonly string[]
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

/** handoff 머리글의 이전 단계 추천 (D23). 머리글을 읽지 못하거나 이전 단계가 아니면 null이다 */
function recommendedBack(
  node: NodeName,
  data: Record<string, unknown>,
): DiscardedAttempt['recommended'] {
  const rec = data['recommended_next']
  if (!rec || typeof rec !== 'object') return null
  const { node: to, reason } = rec as Record<string, unknown>
  const target = NODES.find((n) => n === to)
  if (!target || typeof reason !== 'string' || !isPrevious(node, target)) return null
  return { node: target, reason }
}

/**
 * 폐기된 시도 요약 (6.2): 폐기한 task마다 handoff의 요약, 기각 목록, 이전 단계 추천.
 * handoff가 없으면 없다고만 적는다. 머리글을 읽지 못해도 본문의 요약은 읽는다.
 */
export function discardedAttempts(
  tasks: readonly (TaskRef & { handoff?: string })[],
): DiscardedAttempt[] {
  return tasks.map((t) => {
    const ref = { taskId: t.taskId, node: t.node }
    if (t.handoff === undefined) {
      return { ...ref, handoff: false, summary: null, rejected: [], recommended: null }
    }
    const fm = parseFrontMatter(t.handoff)
    return {
      ...ref,
      handoff: true,
      summary: sectionText(fm.body, '요약'),
      rejected: rejectedOf(t.handoff),
      recommended: fm.ok ? recommendedBack(t.node, fm.data) : null,
    }
  })
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

const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim()
const taskRef = (t: TaskRef) => `${t.taskId} ${nodeLabel(t.node)}`

/** 폐기된 시도 요약의 목록 (6.2) */
function attempts(items: readonly DiscardedAttempt[]): string {
  if (items.length === 0) return '없음'
  return items
    .map((a) => {
      if (!a.handoff) return `- ${taskRef(a)}: handoff 없음`
      const lines = [
        `- ${taskRef(a)}`,
        `  - 요약: ${a.summary ? oneLine(a.summary) : '없음'}`,
        ...(a.rejected.length
          ? a.rejected.map((r) => `  - 기각: ${oneLine(r)}`)
          : ['  - 기각: 없음']),
      ]
      if (a.recommended) {
        lines.push(
          `  - 이전 단계 추천: ${nodeLabel(a.recommended.node)} — ${oneLine(a.recommended.reason)}`,
        )
      }
      return lines.join('\n')
    })
    .join('\n')
}

/** 되감기의 코드 (6.2, D116, D117) */
function codeNote(sel: SelectionInput): string {
  if (sel.keepCode) {
    return '[현재 코드 위에서 이어서]: 폐기된 시도의 커밋이 남아 있다. 그 위에서 이어서 고친다.'
  }
  return sel.reset
    ? '고른 단계를 시작할 때의 커밋으로 되돌렸다. 폐기된 시도의 코드는 입력이 아니다.'
    : '코드는 되돌리지 않았다.'
}

/**
 * 단계 선택으로 들어온 경우의 절 (시나리오 2-4의 "맨 위 강조", 6.2).
 * 되감기: 사람 추가 지시, 폐기된 시도 요약, 코드. 건너뛰기: 건너뛴 단계와 폐기한 task, 사람 추가 지시.
 * 기본 진행으로 들어왔으면 사람 추가 지시가 있을 때만 넣는다.
 */
function selectionSection(sel: SelectionInput): [string, string] | null {
  const from = `${taskRef(sel.from)}에서 고름`
  const instruction = sel.instruction ? fenced(sel.instruction, 'text') : '없음'
  if (sel.reason === 'rewind') {
    return [
      '되감기로 들어옴 (먼저 읽을 것)',
      [
        `사람이 단계 선택으로 이 단계를 다시 실행한다(${from}). 폐기된 task의 산출물, 결정, 기각 목록은 아래 입력에서 뺐다. 사람 추가 지시를 따르고, 폐기된 시도를 그대로 되풀이하지 않는다.`,
        '',
        '### 사람 추가 지시',
        '',
        instruction,
        '',
        '### 폐기된 시도 요약',
        '',
        attempts(sel.discarded),
        '',
        '### 코드',
        '',
        codeNote(sel),
      ].join('\n'),
    ]
  }
  if (sel.reason === 'skip') {
    const skipped = sel.skipped.length ? sel.skipped.map(nodeLabel).join(', ') : '없음'
    const dropped = sel.dropped.length ? sel.dropped.map(taskRef).join(', ') : '없음'
    return [
      '건너뛰어 들어옴 (먼저 읽을 것)',
      [
        `사람이 단계 선택으로 이 단계를 실행한다(${from}). 입력은 지금까지 승인된 것이다. 코드는 되돌리지 않았다.`,
        '',
        `- 건너뛴 단계: ${skipped}`,
        `- 폐기한 task: ${dropped}`,
        '',
        '### 사람 추가 지시',
        '',
        instruction,
      ].join('\n'),
    ]
  }
  if (!sel.instruction) return null
  return [
    '사람 추가 지시 (먼저 읽을 것)',
    [`사람이 단계 선택으로 이 단계를 고르며 남긴 지시다(${from}).`, '', instruction].join('\n'),
  ]
}

/** context.md의 내용 (시나리오 2-4의 표) */
export function buildContext(input: ContextInput): string {
  const { work, task, config } = input
  const info = NODE_INFO[task.node]
  const mode = approvalMode(config, work.settings, task.node)
  const entry = input.selection ? selectionSection(input.selection) : null
  const sections: [string, string][] = [
    ...(entry ? [entry] : []),
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
    ['마무리 안내 문구', closingMessage(task.node, mode, input.delivery)],
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
