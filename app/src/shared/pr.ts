// PR 진행의 항목 파일 pr-items.json (D191)의 모양. 파일에 쓰는 모양이라 키는 snake_case다.
// 항목은 앱이 GitHub에서 읽어 모으고(core/pr), 사람의 [제외]·[다시 넣기]·[받기]로 상태가 바뀐다 (D189, D199).

/** 항목의 종류 (D157, D193): 리뷰 본문, 인라인 코멘트(스레드의 답글 포함), 대화 코멘트, CI 실패, 충돌, 원격과 갈라짐 */
export type PrItemKind = 'review' | 'inline' | 'convo' | 'ci' | 'conflict' | 'diverged'

/**
 * 항목의 상태 (D189, D199): 새 항목(new), 받지 않음(not_accepted), 제외(excluded), 대응 중(responding, M10),
 * 처리됨(done, M10), 해소됨(resolved: 조건이 없어졌거나 GitHub에서 코멘트가 없어짐)
 */
export type PrItemStatus = 'new' | 'not_accepted' | 'excluded' | 'responding' | 'done' | 'resolved'

/** 코멘트의 작성자 (REST의 user와 author_association) */
export interface PrAuthor {
  login: string
  /** REST user.type이 Bot이다 (D161) */
  bot: boolean
  /** author_association (D160) */
  association: string
}

/** 실패한 체크 (CI 실패 항목) */
export interface PrCheckRef {
  name: string
  /** Actions 체크의 워크플로 이름. 커밋 상태(StatusContext)면 null */
  workflow: string | null
  /** CheckRun은 conclusion, StatusContext는 state */
  state: string
  url: string | null
  /** Actions의 실행과 작업 id (detailsUrl …/actions/runs/<실행>/job/<작업>, S7). Actions 밖 체크면 null */
  run: number | null
  job: number | null
}

export interface PrItem {
  /**
   * review:<id>, inline:<id>, convo:<id>(목록마다 따로 받는 GitHub의 id), ci:<head>:<체크>,
   * conflict:<기준 브랜치 커밋>, diverged:<원격 head> (D189)
   */
  id: string
  kind: PrItemKind
  status: PrItemStatus
  /** 사람이 정한 상태다([받기], [제외], [다시 넣기]). 아니면 읽을 때마다 거르기 규칙(D160, D161)으로 다시 정한다 */
  by_human?: boolean
  first_seen_at: string
  /** 해소됨이 된 때 (D199) */
  resolved_at?: string
  /** GitHub에서 코멘트가 없어졌다 */
  gone?: boolean
  // ---- 코멘트 ----
  author?: PrAuthor
  body?: string
  url?: string
  created_at?: string
  /** GitHub의 updated_at. 코멘트를 고쳐도 id는 같고 이것만 바뀐다 (S7) */
  updated_at?: string
  /** 인라인 코멘트의 파일과 줄 */
  path?: string
  line?: number | null
  /** 스레드의 답글이면 스레드 첫 코멘트의 id (in_reply_to_id) */
  reply_to?: number | null
  /** 리뷰의 상태 (APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED) */
  review_state?: string
  // ---- CI 실패 ----
  /** 실패한 head 커밋 */
  head?: string
  check?: PrCheckRef
  /** 실패한 스텝의 로그 끝부분. 아직 읽지 못했으면 없다 */
  log?: string
  /** 로그가 없는 까닭 (실행이 아직 끝나지 않음, Actions 밖 체크, 읽기 실패) */
  log_note?: string
  // ---- 충돌 ----
  /** fetch한 기준 브랜치의 커밋 (PR의 baseRefOid가 아님, S7) */
  base_commit?: string
  // ---- 원격과 갈라짐 ----
  remote_head?: string
  local_head?: string
}

/** fast-forward로 받은 원격 커밋 (D193). PR 패널의 대응 라운드 기록에 보인다 */
export interface PrSynced {
  at: string
  /** 받기 전의 로컬 HEAD */
  from: string
  /** 받은 커밋. 새것이 먼저다 (git rev-list) */
  commits: string[]
  /** 받은 커밋에 기준 브랜치 병합이 있어 옮긴 기준 커밋 (D181) */
  base_commit?: string
}

/** pr-items.json (D191). 앱 소유이고 편집은 deny 규칙으로 막으며, 해시는 확인하지 않는다 */
export interface PrItemsFile {
  schema_version: 1
  items: PrItem[]
  synced: PrSynced[]
}

export const EMPTY_PR_ITEMS: PrItemsFile = { schema_version: 1, items: [], synced: [] }
