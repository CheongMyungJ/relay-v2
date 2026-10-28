// Work를 진행하는 쪽 (D519~D523): 사람(앱 화면)과 relay MCP 호출자. 한 Work의 질문 답, 승인, 전달은 진행하는 쪽만 한다.
// 사람의 [즉시 중단], 카운트다운 [취소], [Work 포기], 터미널 입력은 진행하는 쪽과 관계없이 받는다 (D523)
import type { ApprovalBy, TaskRecord, TaskStatus, WorkDriver, WorkState } from '../shared/work'

/** 명령을 보낸 쪽: 앱 화면(IPC)의 사람이나 relay MCP 호출자 */
export type Actor = WorkDriver

/** 사람이 caller Work를 승인하거나 답하려 할 때 (D523) */
export const CALLER_DRIVES = 'MCP 호출자가 진행하는 Work입니다. [직접 맡기]를 누른 뒤 하세요'

/** 호출자가 사람이 진행하는 Work를 승인하거나 답하려 할 때 (D519, D523) */
export const HUMAN_DRIVES = '사람이 진행하는 Work입니다. 승인과 질문 답은 앱 화면에서 사람이 합니다'

export function workDriver(work: Pick<WorkState, 'driver'>): WorkDriver {
  return work.driver === 'caller' ? 'caller' : 'human'
}

/** actor가 이 Work의 질문 답, 승인, 전달을 할 수 없으면 그 까닭. 할 수 있으면 null */
export function driverBlock(work: Pick<WorkState, 'driver'>, actor: Actor): string | null {
  const driver = workDriver(work)
  if (driver === actor) return null
  return driver === 'caller' ? CALLER_DRIVES : HUMAN_DRIVES
}

/** 진행하는 쪽이 한 승인의 기록 (5.4, D522). 자동 승인은 따로 auto다 */
export function approvalBy(work: Pick<WorkState, 'driver'>): ApprovalBy {
  return workDriver(work) === 'caller' ? 'caller' : 'human'
}

/**
 * 이 task의 질문을 relay MCP의 ask_human으로 묻는가 (D521). Codex는 늘 그 길이다. Claude는 caller Work에서 시작한
 * task(ask: 'mcp')만이다: 시작할 때 정한 길을 재개도 쓴다(단계 절차의 질문 도구 이름이 바뀌어 있다)
 */
export function asksViaMcp(task: Pick<TaskRecord, 'ask'>, engine: 'claude' | 'codex'): boolean {
  return engine === 'codex' || task.ask === 'mcp'
}

/**
 * "알아서 해" 답 (5.6.1, D521). caller Work의 questions가 recommend면 앱이 질문마다 이 글로 답한다. 무엇이 추천인지는
 * 에이전트가 정한다: 앱은 선택지를 골라 주지 않는다
 */
export const RECOMMEND_ANSWER =
  '알아서 해 (relay MCP 호출자가 추천안으로 진행하라고 맡겼습니다. 추천안으로 정하고 by: ai로 적으세요)'

/** 질문마다 "알아서 해"로 채운 답 */
export function recommendAnswers(questions: readonly { id: string }[]): Record<string, string[]> {
  return Object.fromEntries(questions.map((q) => [q.id, [RECOMMEND_ANSWER]]))
}

/**
 * 고칠 점(D524)을 담은 파일을 가리키는 다시 연 세션의 첫 입력. 글은 task 디렉터리의 파일에 두고 한 줄만 인자로 준다:
 * 여러 줄 인자는 Windows의 .cmd 래퍼(npm으로 설치한 claude)에서 첫 줄 뒤가 잘리고, '-'로 시작하는 글(목록)은 옵션으로 읽힌다
 */
export function revisePrompt(file: string): string {
  return `relay: MCP 호출자가 이 단계에 고칠 점을 보냈습니다. ${file}를 읽고 이 단계 안에서 반영하세요.`
}

/** 고칠 점의 파일 이름 (task 디렉터리 안). .md가 아니라 산출물로 보이지 않는다 */
export function reviseFile(n: number): string {
  return `revise-${n}.txt`
}

/**
 * 고칠 점(D524)을 받는 task 상태: 턴이 끝났다(승인 대기, 대기, 막힘, 세션 종료, 중단됨). 살아 있는 세션은 끝내고 다시 연다
 */
export const REVISABLE: readonly TaskStatus[] = [
  'awaiting_approval',
  'idle',
  'blocked',
  'session_ended',
  'interrupted',
]
