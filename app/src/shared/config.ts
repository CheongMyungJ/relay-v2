// 앱 설정 config.json (5.1.1)과 Work별 덮어쓰기 (D72).
// 파일에 쓰는 모양이라 키는 snake_case다.

/**
 * relay 스킬 (5.6). 질문 방식을 스킬마다 고른다 (D26). investigate는 evidence와 root-cause를 합친 스킬이다 (D148).
 * pr-respond는 파이프라인 밖의 PR 대응 task다 (D168, D187)
 */
export type SkillName =
  | 'work-start'
  | 'investigate'
  | 'evidence'
  | 'root-cause'
  | 'fix'
  | 'review'
  | 'final-verify'
  | 'pr-respond'

/** 질문 방식 (5.6.1). 초안 우선 / 결정마다 확인 */
export type QuestionMode = 'draft_first' | 'confirm_each'

/**
 * 자동 승인을 켤 수 있는 노드. intake(의도 승인)와 verify(Work 완료)는 항상 수동이다 (4.2). review는 지적이 없을 때만
 * 자동 승인한다 (D213). respond는 PR 대응 task다 (D169)
 */
export type AutoApproveNode = 'investigate' | 'evidence' | 'rca' | 'fix' | 'review' | 'respond'

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
  /** PR 진행인 Work를 읽는 주기 (D158) */
  pr_poll_interval_sec: number
  /** 받은 새 항목이 생기면 PR 대응 task를 자동으로 시작한다 (D154, D210) */
  respond_auto_start: boolean
  /** 사람 손 없이 이어지는 대응 라운드의 상한 (D171) */
  respond_auto_round_max: number
  /** 앱이 게시하는 답글 끝에 붙이는 표시 (D173) */
  reply_signature: string
}

/** work.json의 settings. 앱 설정과 같은 키를 쓰고, 없는 키는 앱 설정을 따른다 (D72) */
export interface WorkSettings {
  auto_approve?: Partial<Record<AutoApproveNode, boolean>>
  question_mode?: Partial<Record<SkillName, QuestionMode>>
  /** 대응 자동 시작 (D154, 5.1.1) */
  respond_auto_start?: boolean
}

/**
 * Work 설정을 바꾸는 값 (D72). 준 키만 바꾼다. 자동 승인과 질문 방식은 빈 객체, 대응 자동 시작은 null이면 그 키를 지워
 * 앱 설정을 따른다
 */
export interface WorkSettingsPatch {
  auto_approve?: Partial<Record<AutoApproveNode, boolean>>
  question_mode?: Partial<Record<SkillName, QuestionMode>>
  respond_auto_start?: boolean | null
}

/**
 * 스킬과 그 노드의 화면 이름 (D109). 설정 화면과 Work 설정의 질문 방식 목록에 쓴다.
 * core/pipeline의 NODE_INFO와 같은지 [단위]가 확인한다.
 */
export const SKILL_TITLES: readonly (readonly [SkillName, string])[] = [
  ['work-start', '의도 정리'],
  ['investigate', '재현과 원인 분석'],
  ['evidence', '재현과 관찰'],
  ['root-cause', '원인 분석'],
  ['fix', '수정'],
  ['review', '리뷰'],
  ['final-verify', '최종 검증'],
  ['pr-respond', 'PR 대응'],
]

/**
 * 자동 승인을 켤 수 있는 노드와 그 화면 이름 (4.2, D109). 설정 화면과 Work 설정의 자동 승인 목록에 쓴다.
 * 리뷰는 지적이 없을 때만 자동 승인한다 (D213). core/pipeline의 NODE_INFO와 같은지 [단위]가 확인한다.
 */
export const AUTO_APPROVE_TITLES: readonly (readonly [AutoApproveNode, string])[] = [
  ['investigate', '재현과 원인 분석'],
  ['evidence', '재현과 관찰'],
  ['rca', '원인 분석'],
  ['fix', '수정'],
  ['review', '리뷰'],
  ['respond', 'PR 대응'],
]

/** 질문 방식의 화면 이름 (5.6.1) */
export const QUESTION_MODE_LABEL: Readonly<Record<QuestionMode, string>> = {
  draft_first: '초안 우선',
  confirm_each: '결정마다 확인',
}

/**
 * 앱 설정의 기본값 (5.1.1). 자동 승인은 수정(D214)과 지적이 없는 리뷰(D213)만 켠다. 결과는 뒤 단계의 승인 화면과
 * Work 완료 화면에서 사람이 본다 (D7)
 */
export const DEFAULT_CONFIG: AppConfig = {
  schema_version: 1,
  session_limit: 3,
  auto_approve: {
    investigate: false,
    evidence: false,
    rca: false,
    fix: true,
    review: true,
    respond: false,
  },
  auto_approve_countdown_sec: 15,
  question_mode: {
    'work-start': 'draft_first',
    investigate: 'draft_first',
    evidence: 'draft_first',
    'root-cause': 'draft_first',
    fix: 'draft_first',
    review: 'draft_first',
    'final-verify': 'draft_first',
    'pr-respond': 'draft_first',
  },
  pr_draft: false,
  handoff_body_warn_chars: 1500,
  intent_warn_chars: 1500,
  format_error_bounce_max: 2,
  pr_poll_interval_sec: 120,
  respond_auto_start: false,
  respond_auto_round_max: 3,
  reply_signature: '— relay(AI)가 작성함',
}
