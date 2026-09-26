// 앱 설정 config.json (5.1.1)과 Work별 덮어쓰기 (D72).
// 파일에 쓰는 모양이라 키는 snake_case다.

/** relay 스킬 (5.6). 질문 방식을 스킬마다 고른다 (D26) */
export type SkillName = 'work-start' | 'evidence' | 'root-cause' | 'fix' | 'final-verify'

/** 질문 방식 (5.6.1). 초안 우선 / 결정마다 확인 */
export type QuestionMode = 'draft_first' | 'confirm_each'

/** 자동 승인을 켤 수 있는 노드. intake(의도 승인)와 verify(Work 완료)는 항상 수동이다 (4.2) */
export type AutoApproveNode = 'evidence' | 'rca' | 'fix'

export interface AppConfig {
  schema_version: 1
  /** 살아 있는 세션 합계 상한 (D18) */
  session_limit: number
  /** 단계별 자동 승인 (4.2) */
  auto_approve: Record<AutoApproveNode, boolean>
  /** 자동 승인 전 카운트다운 (4.3) */
  auto_approve_countdown_sec: number
  /** 스킬별 질문 방식 (5.6.1) */
  question_mode: Record<SkillName, QuestionMode>
  /** true면 draft PR로 만든다 (D71) */
  pr_draft: boolean
  /** handoff 본문 분량 경고 기준 (5.2) */
  handoff_body_warn_chars: number
  /** intent 분량 경고 기준 (5.3) */
  intent_warn_chars: number
  /** 형식 오류를 Stop 훅으로 되돌리는 연속 횟수 (D21) */
  format_error_bounce_max: number
}

/** work.json의 settings. 앱 설정과 같은 키를 쓰고, 없는 키는 앱 설정을 따른다 (D72) */
export interface WorkSettings {
  auto_approve?: Partial<Record<AutoApproveNode, boolean>>
  question_mode?: Partial<Record<SkillName, QuestionMode>>
}

/**
 * 스킬과 그 노드의 화면 이름 (D109). 설정 화면과 Work 설정의 질문 방식 목록에 쓴다.
 * core/pipeline의 NODE_INFO와 같은지 [단위]가 확인한다.
 */
export const SKILL_TITLES: readonly (readonly [SkillName, string])[] = [
  ['work-start', '의도 정리'],
  ['evidence', '재현과 관찰'],
  ['root-cause', '원인 분석'],
  ['fix', '수정'],
  ['final-verify', '최종 검증'],
]

/** 질문 방식의 화면 이름 (5.6.1) */
export const QUESTION_MODE_LABEL: Readonly<Record<QuestionMode, string>> = {
  draft_first: '초안 우선',
  confirm_each: '결정마다 확인',
}

/** 앱 설정의 기본값 (5.1.1) */
export const DEFAULT_CONFIG: AppConfig = {
  schema_version: 1,
  session_limit: 3,
  auto_approve: { evidence: false, rca: false, fix: false },
  auto_approve_countdown_sec: 15,
  question_mode: {
    'work-start': 'draft_first',
    evidence: 'draft_first',
    'root-cause': 'draft_first',
    fix: 'draft_first',
    'final-verify': 'draft_first',
  },
  pr_draft: false,
  handoff_body_warn_chars: 1500,
  intent_warn_chars: 1500,
  format_error_bounce_max: 2,
}
