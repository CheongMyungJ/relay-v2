// 지식 관리의 타입 (D283~D323, I69). 지식 파일(레포의 지식 폴더와 앱 저장소의 나만·공유 대기)은 같은 모양이고(D306),
// 머리글은 docs/contracts/knowledge-entry.v1.schema.json이다(D320). 파일에 쓰는 모양이라 키는 snake_case다.
// 판정은 core/knowledge가, 파일과 git은 adapters/knowledge가 한다.
import type { KnowledgeEntryHeader, TaskNode } from './contracts'

/** 지식 종류 여섯 (D291, D299) */
export type KnowledgeKind = KnowledgeEntryHeader['kind']

/** 종류의 갈래 (D299): 제약의 외부 호환, 결정의 하지 않기로 함, 구조 사실의 용어 */
export type KnowledgeSubkind = NonNullable<KnowledgeEntryHeader['subkind']>

/** 종류의 차례. 지식 화면과 거르기 칸이 이 차례로 보인다 */
export const KNOWLEDGE_KINDS: readonly KnowledgeKind[] = [
  'domain',
  'recipe',
  'failure',
  'constraint',
  'decision',
  'structure',
]

/** 종류의 화면 이름 (B.3) */
export const KNOWLEDGE_KIND_LABEL: Readonly<Record<KnowledgeKind, string>> = {
  domain: '도메인 규칙',
  recipe: '검증 레시피',
  failure: '실패 부류',
  constraint: '제약',
  decision: '결정',
  structure: '구조 사실',
}

/** 갈래의 화면 이름 (D299) */
export const KNOWLEDGE_SUBKIND_LABEL: Readonly<Record<KnowledgeSubkind, string>> = {
  compat: '외부 호환',
  non_goal: '하지 않기로 함',
  term: '용어',
}

/** 갈래가 속한 종류 (D299) */
export const SUBKIND_KIND: Readonly<Record<KnowledgeSubkind, KnowledgeKind>> = {
  compat: 'constraint',
  non_goal: 'decision',
  term: 'structure',
}

/** 지식 항목의 출처 (D320): Work, task, 누가 정했나 */
export interface KnowledgeSource {
  work: string
  task: string
  by: 'human' | 'ai'
}

/** 지식 항목 하나 (D320): 머리글과 본문(`# <규칙>`, 이유·코드불가·유인) */
export interface KnowledgeEntry {
  /** <kind>-<소문자와 숫자 8자> */
  id: string
  kind: KnowledgeKind
  subkind: KnowledgeSubkind | null
  /** 유효(active)나 대체됨(superseded, D302) */
  status: 'active' | 'superseded'
  superseded_by: string | null
  /** 레포 안의 경로. 디렉터리, 파일, `파일:심볼` (D320) */
  paths: string[]
  /** 용어 1~5개 (D299, D311) */
  terms: string[]
  /** 경로마다 내용 해시 (D316, D320, I72) */
  hashes: Record<string, string>
  source: KnowledgeSource
  /** 규칙 한 줄 */
  rule: string
  why: string
  not_in_code: string
  incentive: string
}

/**
 * 항목이 있는 곳 (D285, D288, I74): 기준 브랜치에 머지된 팀 지식(team), 이 Work의 PR에 실린 것(carried: worktree의 지식
 * 폴더에 있고 Work의 기준 커밋과 내용이 다름), 앱 저장소의 공유 대기(pending)와 나만(mine)
 */
export type KnowledgeScope = 'team' | 'carried' | 'pending' | 'mine'

/** 항목의 화면 이름 */
export const KNOWLEDGE_SCOPE_LABEL: Readonly<Record<KnowledgeScope, string>> = {
  team: '팀',
  carried: '이 Work의 PR',
  pending: '공유 대기',
  mine: '나만',
}

/** 공유 대기 항목이 실린 곳 (I71). knowledge.json에 둔다. PR이 머지되면 항목과 함께 지우고, 머지 없이 끝나면 지운다 (D310) */
export interface PendingCarried {
  work: string
  branch: string
  /** 실린 PR 번호. PR을 만들기 전(지식 커밋 뒤 push 전)이면 null */
  pr: number | null
  /** 지식 커밋 */
  commit: string | null
  at: string
}

/** 앱 저장소의 knowledge.json (I71) */
export interface KnowledgeIndex {
  schema_version: 1
  /** 공유 대기 id → 실린 곳. 없으면 실리지 않았다 */
  carried: Record<string, PendingCarried>
}

export const EMPTY_KNOWLEDGE_INDEX: KnowledgeIndex = { schema_version: 1, carried: {} }

// ---------- 거르기 (D300~D304, I75) ----------

/** 거르기에서 보이는 기존 항목 */
export interface KnowledgeRefView {
  id: string
  scope: KnowledgeScope
  kind: KnowledgeKind
  kindLabel: string
  rule: string
  paths: string[]
  terms: string[]
  /** 전체 파일의 경로 */
  file: string
  /** 열린 PR에 실린 공유 대기면 그 PR (D310 (3)). 아니면 null */
  carriedPr: number | null
  /** 재확인 필요 (D316, D317) */
  stale: boolean
  /** 이 Work의 task가 따랐고 맞았다고 알렸다 (knowledge_confirmed, D330) */
  confirmed?: boolean
}

/**
 * 이 Work의 후보 하나 (D283, D296, D299, D304): 에이전트 후보(사람 결정과 묶였으면 by가 human)나 다듬지 않은 사람 결정
 * (unrefined). key는 Work 안에서 같은 후보를 가리킨다
 */
export interface KnowledgeCandidateView {
  key: string
  taskId: string
  node: TaskNode
  /** 다듬지 않은 사람 결정이다 (D304). 종류, 용어, 경로를 사람이 정해야 채택된다 */
  unrefined: boolean
  by: 'human' | 'ai'
  kind: KnowledgeKind | null
  subkind: KnowledgeSubkind | null
  rule: string
  paths: string[]
  terms: string[]
  why: string
  not_in_code: string
  incentive: string
  /** 묶인 사람 결정의 what (D299) */
  decision: string | null
  /**
   * 같은 사람 결정에서 앞 task가 먼저 올린 후보의 key (D324). 있으면 같은 규칙의 중복이라 채택 안 함이 기본이다
   */
  sameDecisionAs: string | null
  /**
   * 다른 task가 앞서 올린 비슷한 후보(종류가 같고 경로가 겹침)의 key (D326). 있으면 같은 규칙의 중복일 수 있어 채택 안 함이
   * 기본이다
   */
  similarTo: string | null
  /**
   * 코드로 알 수 있다고 본 까닭 (D297의 코드불가 관문, 지식 탐색 K22): 시험 명령만 말하는 레시피, 코드불가 칸이 코드에 있다고
   * 적었거나 package.json·README를 가리킴. 있으면 채택 안 함이 기본이다
   */
  inCode: string | null
  /**
   * 규칙이 기존 항목과 거의 같다 (지식 탐색 K7, D331). 있으면 같은 규칙을 또 쌓지 않게 채택 안 함이 기본이다. 바꾸는 것이면
   * 사람이 채택하고 대체를 고른다
   */
  sameAs: KnowledgeRefView | null
  /**
   * 이번 Work에서만 정한 범위로 보인 까닭 (지식 탐색 K21, D331): "이번에는", "이번 Work" 같은 말. 있으면 채택 안 함이
   * 기본이다
   */
  workScoped: string | null
  /** 대체할 항목 (D299, D313). 모르는 id면 null이고 unknownSupersedes에 남긴다 */
  supersedes: KnowledgeRefView | null
  unknownSupersedes: string | null
  /** 같은 id의 틀렸다는 보고 (D318) */
  feedback: string[]
  /** 종류·경로·용어가 겹치는 기존 항목 (D302) */
  overlaps: KnowledgeRefView[]
}

/** 틀렸다는 보고 하나 (D318). 같은 id를 대체하는 후보가 있으면 그 후보에 붙고 여기에는 없다 */
export interface KnowledgeFeedbackView {
  id: string
  taskId: string
  notes: string[]
  /** 가리킨 항목. 모르는 id면 null */
  entry: KnowledgeRefView | null
}

/** Work 완료 화면과 정리 창의 지식 칸 (I75, I76) */
export interface KnowledgeReview {
  /** 이 Work의 후보 (에이전트 후보, 다듬지 않은 사람 결정) */
  candidates: KnowledgeCandidateView[]
  /** 함께 실릴 공유 대기 (D308). 열린 PR에 실린 것은 빠진다 (D310) */
  pending: KnowledgeRefView[]
  /** 이 Work가 건드린 경로의 재확인 항목 (D317) */
  stale: KnowledgeRefView[]
  /** 틀렸다는 보고 (D318) */
  feedback: KnowledgeFeedbackView[]
  /** 이 Work의 task가 따랐고 맞았다고 알린 항목 (D330). 보이기만 한다 */
  confirmed: KnowledgeRefView[]
  /** 팀 공유가 켜져 있다 (D322). 꺼져 있으면 팀/나만 고르기가 없다 */
  share: boolean
  /** 지식 폴더 (D305) */
  dir: string
}

/** 후보를 고친 값 (I75). 준 것만 바꾼다 */
export interface CandidateEdit {
  kind?: KnowledgeKind
  subkind?: KnowledgeSubkind | null
  rule?: string
  paths?: string[]
  terms?: string[]
  why?: string
}

/** 후보 하나의 선택 (D301, D302, D289) */
export interface CandidateChoice {
  adopt: boolean
  share: 'team' | 'mine'
  /** 대체할 기존 항목 id. null이면 새로 더함 (D302) */
  replace: string | null
  edit?: CandidateEdit
}

/** 함께 실릴 공유 대기의 선택 (D308): 싣기, 이번에는 빼기, 나만으로 돌리기, 버림 */
export type PendingAction = 'share' | 'hold' | 'mine' | 'drop'

/**
 * 재확인 항목과 틀렸다는 보고의 선택 (D317, D318): 그대로 둠(leave), 그대로 맞음(confirm, 해시를 새로 적음, D320 (4)),
 * 대체(replace: 고친 규칙으로 새 항목, D302), 버림(drop)
 */
export type EntryAction = 'leave' | 'confirm' | 'replace' | 'drop'

export interface EntryChoice {
  action: EntryAction
  /** replace의 새 규칙 */
  rule?: string
}

/** 거르기의 선택 (I75). 없는 키는 기본 선택이다 (D303) */
export interface KnowledgeChoices {
  candidates?: Record<string, CandidateChoice>
  pending?: Record<string, PendingAction>
  stale?: Record<string, EntryChoice>
  feedback?: Record<string, EntryChoice>
}

/**
 * 채택 결과 (I73). 전달 명령과 함께 진행 중 작업 기록에 적고([다시 시도]가 같은 것을 씀), [완료만]은 승인과 함께 쓴다.
 * 해시는 쓰기 바로 전에 main이 그때의 커밋으로 채운다 (I72)
 */
export interface KnowledgePlan {
  /** 레포의 지식 폴더에 쓸 항목 ([PR 생성]이고 팀 공유가 켜져 있을 때만) */
  repo: KnowledgeEntry[]
  /** 앱 저장소의 공유 대기에 쓸 항목 */
  pending: KnowledgeEntry[]
  /** 앱 저장소의 나만에 쓸 항목 */
  mine: KnowledgeEntry[]
  /** 지울 공유 대기와 나만 */
  removePending: string[]
  removeMine: string[]
  /** 이 PR에 실을 공유 대기 id (knowledge.json에 실린 곳을 적음, D310) */
  carry: string[]
  /** 화면과 기록에 쓰는 수: 팀 지식(레포나 공유 대기로 간 것), 나만, 공유 대기 */
  counts: { team: number; mine: number; pending: number }
}

/** 전달 결과와 승인 기록의 지식 (I73) */
export interface KnowledgeOutcome {
  team: number
  mine: number
  pending: number
  /** 지식 커밋 */
  commit?: string
}

// ---------- 지식 화면 (D307, I77) ----------

export interface KnowledgeScreenEntry extends KnowledgeRefView {
  subkind: KnowledgeSubkind | null
  status: 'active' | 'superseded'
  why: string
  not_in_code: string
  incentive: string
  source: KnowledgeSource
}

export interface KnowledgeScreen {
  team: KnowledgeScreenEntry[]
  mine: KnowledgeScreenEntry[]
  pending: KnowledgeScreenEntry[]
  share: boolean
  dir: string
  /** 팀 지식을 읽은 커밋과 출처(origin/<브랜치> 또는 로컬 브랜치) */
  teamFrom: string | null
  /** 팀 지식을 읽다 난 문제 */
  warnings: string[]
}

export type KnowledgeScreenResult =
  { ok: true; screen: KnowledgeScreen } | { ok: false; error: string }

/** 지식 화면의 조작 (D307, I77) */
export type KnowledgeEditInput =
  | { op: 'edit'; scope: 'team' | 'mine' | 'pending'; id: string; edit: CandidateEdit }
  | { op: 'drop'; scope: 'team' | 'mine' | 'pending'; id: string }
  | { op: 'move'; scope: 'mine' | 'pending'; id: string }
  | { op: 'confirm'; id: string }

// ---------- 거르기의 선택 (I75). 렌더러도 전달 버튼 줄의 한 줄을 이것으로 센다 ----------

/** 경로를 맞춘다: `\`를 `/`로, 앞의 `./`와 `/`, 끝의 `/`를 뗀다 */
export function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

/**
 * 기본 선택 (D301, D303, D304, D299, D313, D324, D326): 에이전트 후보는 채택, 다듬지 않은 사람 결정, 같은 결정에서 뒤에
 * 올린 후보, 다른 task가 앞서 올린 비슷한 후보가 있는 후보, 코드로 알 수 있다고 본 후보(K22)는 채택 안 함, supersedes는 대체
 */
export function defaultCandidateChoice(c: KnowledgeCandidateView, share: boolean): CandidateChoice {
  const replace = c.supersedes && c.supersedes.carriedPr === null ? c.supersedes.id : null
  return {
    adopt:
      !c.unrefined && !c.sameDecisionAs && !c.similarTo && !c.inCode && !c.sameAs && !c.workScoped,
    share: share ? 'team' : 'mine',
    replace,
  }
}

/** 고른 것과 기본 선택을 합친 후보 선택 */
export function candidateChoice(
  c: KnowledgeCandidateView,
  choices: KnowledgeChoices | undefined,
  share: boolean,
): CandidateChoice {
  const d = defaultCandidateChoice(c, share)
  const got = choices?.candidates?.[c.key]
  if (!got) return d
  return { ...d, ...got, share: share ? got.share : 'mine' }
}

export function pendingAction(id: string, choices: KnowledgeChoices | undefined): PendingAction {
  return choices?.pending?.[id] ?? 'share'
}

/**
 * 재확인·보고 항목의 선택. 고르지 않았으면 그대로 두기이고, 이 Work가 확인한 재확인 항목(D330)은 [그대로 맞음]이
 * 기본이다
 */
export function entryChoice(
  group: 'stale' | 'feedback',
  id: string,
  choices: KnowledgeChoices | undefined,
  confirmed = false,
): EntryChoice {
  return choices?.[group]?.[id] ?? { action: group === 'stale' && confirmed ? 'confirm' : 'leave' }
}

/** 고친 후보 (I75). 다듬지 않은 사람 결정은 사람이 정한 종류, 용어, 경로를 받는다 */
export function editedCandidate(c: KnowledgeCandidateView, edit: CandidateEdit | undefined) {
  const kind = edit?.kind ?? c.kind
  const subkind = edit?.subkind !== undefined ? edit.subkind : c.subkind
  return {
    kind,
    subkind: subkind && kind && SUBKIND_KIND[subkind] === kind ? subkind : null,
    rule: (edit?.rule ?? c.rule).trim(),
    paths: (edit?.paths ?? c.paths).map(normalizePath).filter(Boolean),
    terms: (edit?.terms ?? c.terms).map((t) => t.trim()).filter(Boolean),
    why: (edit?.why ?? c.why).trim(),
  }
}

/** 채택할 수 있는 후보인가 (D299): 종류, 규칙, 용어 1~5개, 제약은 경로, 구조 사실은 경로 둘 이상. 아니면 까닭 */
export function candidateProblem(e: ReturnType<typeof editedCandidate>): string | null {
  if (!e.kind) return '종류를 정해야 함'
  if (!e.rule) return '규칙이 비어 있음'
  if (e.terms.length < 1 || e.terms.length > 5) return '용어는 1~5개'
  if (e.kind === 'constraint' && e.paths.length < 1) return '제약은 경로가 하나 이상 필요함'
  if (e.kind === 'structure' && e.paths.length < 2) return '구조 사실은 경로가 둘 이상 필요함'
  return null
}

/** 전달 버튼 줄의 한 줄 (I75). 쓸 것이 없으면 null */
export function planLine(
  review: KnowledgeReview,
  choices: KnowledgeChoices | undefined,
): string | null {
  const team = review.candidates.filter((c) => {
    const ch = candidateChoice(c, choices, review.share)
    return ch.adopt && ch.share === 'team' && !candidateProblem(editedCandidate(c, ch.edit))
  }).length
  const mine = review.candidates.filter((c) => {
    const ch = candidateChoice(c, choices, review.share)
    return ch.adopt && ch.share === 'mine' && !candidateProblem(editedCandidate(c, ch.edit))
  }).length
  const shipped = review.pending.filter((p) => pendingAction(p.id, choices) === 'share').length
  const parts: string[] = []
  if (review.share && team + shipped > 0) {
    const what = [team ? `팀 지식 ${team}건` : '', shipped ? `공유 대기 ${shipped}건` : '']
      .filter(Boolean)
      .join('과 ')
    parts.push(`${what}은 [PR 생성]이면 PR에 함께 실리고, [완료만]·[push]면 공유 대기로 남음`)
  }
  if (mine) parts.push(`나만 ${mine}건은 앱 저장소에만 둠`)
  return parts.length ? parts.join('. ') : null
}
