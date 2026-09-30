/** Codex MCP 질문과 앱 질문창이 공유하는 값. 답은 모델의 기본값으로 자동 제출하지 않는다. */
export interface HumanQuestion {
  id: string
  header: string
  question: string
  options?: { label: string; description: string }[]
  multiSelect?: boolean
}

export interface PendingQuestionView {
  id: string
  questions: HumanQuestion[]
}

export type HumanAnswers = Record<string, string[]>

export interface HumanAnswerReply {
  cancelled: boolean
  answers?: HumanAnswers
  reason?: string
}
