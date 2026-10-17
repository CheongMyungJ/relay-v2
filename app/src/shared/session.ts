// 기본 세션 (시나리오 12, D397~D406)의 기록 sessions/<session-id>/session.json (5.1, D402)과 Work 초안 (D404).
// 파일에 쓰는 모양이라 키는 snake_case다.
import type { AgentEngine } from './agent'
import type { CleanupProcess, WorkType } from './work'

/** 이름을 지은 쪽 (D403): 앱(첫 요청의 첫 줄)이나 사람([이름 바꾸기]). 사람이 고친 이름은 앱이 다시 바꾸지 않는다 */
export type SessionNamedBy = 'app' | 'human'

/** 기본 세션 하나의 기록 (D402). task가 아니므로 work.json 밖에 둔다 */
export interface SessionRecord {
  /** s-<날짜>-<nnn> (nextSessionId) */
  id: string
  /** 이름. 짓기 전에는 없고 화면은 "새 세션"이다 (D403) */
  name?: string
  named_by?: SessionNamedBy
  /** 만들 때 고른 폴더. 그 뒤 바꾸지 않는다 (D398) */
  cwd: string
  created_at: string
  /** 다시 열 대화의 엔진 (D399). 지금 설정과 다르면 이어 가지 않고 새 대화로 연다 */
  engine?: AgentEngine
  /** 다시 열 대화. 첫 요청(UserPromptSubmit)이 와 대화가 생긴 뒤에 있다 */
  session_id?: string
  /** 살아 있는 동안의 프로세스. 재시작 때 task와 같이 확인해 끝낸다 (D76) */
  process?: CleanupProcess
}

/** 이름을 짓기 전의 화면 이름 (D403) */
export const NEW_SESSION_NAME = '새 세션'

/** 세션 이름의 길이 상한(코드 포인트). 넘으면 앞 20자 뒤에 …를 붙인다 (D403) */
export const SESSION_NAME_MAX = 20

/**
 * Work 초안을 만든 곳 (D404). 지금은 기본 세션뿐이다. 곁 세션과 Work 마무리로 넓힐 때 여기에 종류를 더하고 초안 폴더만
 * 정한다 (9절)
 */
export type DraftSource = { kind: 'session'; id: string }

/** 초안 하나의 자리: 만든 곳과 파일 이름. 새 Work를 만들면 앱이 이 초안을 지운다 (D404) */
export interface DraftRef {
  source: DraftSource
  /** 초안 폴더 안의 파일 이름 (<이름>.md) */
  name: string
}

/** 읽은 초안 (D404, I135). 틀린 칸은 null이고 까닭은 errors에 있다 */
export interface ParsedDraft {
  /** 등록된 프로젝트 id */
  project: string | null
  type: WorkType | null
  /** 기준 브랜치. 선택이라 없으면 null이다 */
  base: string | null
  /** 본문 (request.md가 될 글) */
  request: string
  errors: string[]
}
