// PR 진행의 항목 파일 pr-items.json (D191)의 모양. 파일에 쓰는 모양이라 키는 snake_case다.
// 항목은 앱이 GitHub에서 읽어 모으고(core/pr), 사람의 [제외]·[다시 넣기]·[받기]로 상태가 바뀐다 (D189, D199).
// PR 대응 task(M10)의 라운드마다 push한 커밋과 게시한 답글을 적는다 (D191, D194).

/** 항목의 종류 (D157, D193): 리뷰 본문, 인라인 코멘트(스레드의 답글 포함), 대화 코멘트, CI 실패, 충돌, 원격과 갈라짐 */
export type PrItemKind = 'review' | 'inline' | 'convo' | 'ci' | 'conflict' | 'diverged'

/**
 * 항목의 상태 (D189, D199): 새 항목(new), 받지 않음(not_accepted), 제외(excluded), 대응 중(responding: 대응 task에
 * 넣었고 그 라운드의 push와 게시가 끝나지 않음), 처리됨(done: 그 라운드의 push와 게시가 끝남), 해소됨(resolved: 조건이
 * 없어졌거나 GitHub에서 코멘트가 없어짐)
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
  /** 실행을 부른 이벤트 (D201). Actions 밖 체크이거나 읽지 못했으면 null이나 없음 */
  event?: string | null
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

/**
 * 게시할 답글 하나 (D172, D190, D194, D205, D207). 승인할 때 replies.md의 초안으로 게시할 본문을 정해 둔다. 게시하기
 * 전에 attempted_at을 적고, 게시하면 comment_id를 바로 적는다
 */
export interface PrReply {
  /** 답하는 코멘트 항목 */
  item: string
  /** 인라인 코멘트면 스레드 첫 코멘트의 id다: 그 스레드에 답글로 단다. 아니면 null이고 PR 대화 코멘트로 올린다 (D207) */
  thread: number | null
  /** 게시할 본문: 원래 코멘트 링크(스레드 없는 답글, D207), 초안, 표시 문구(D173), 보이지 않는 표시(D194) */
  body: string
  /** 보이지 않는 표시 `<!-- relay:<work-id>/<항목 id>/<라운드> -->` (D194) */
  marker: string
  /** 게시를 시도한 때. 이것이 있는데 comment_id가 없으면 게시 결과를 모르는 요청이다 (D194) */
  attempted_at?: string
  /** 게시한 코멘트의 id와 주소 (D194) */
  comment_id?: number
  url?: string
  posted_at?: string
  /** 게시하지 않은 까닭: GitHub에서 없어진 코멘트다 (D205) */
  skipped?: string
}

/**
 * 대응 라운드의 기록 (화면 구성의 PR 패널): push한 커밋과 답글. 승인할 때 게시할 답글을 적어 두고, push와 게시의 결과를
 * 더한다. 라운드의 항목과 사람 지시, 승인과 미룸은 work.json의 task 기록(respond)에 있다
 */
export interface PrRound {
  /** PR 대응 task */
  task_id: string
  round: number
  /**
   * push한 때와 로컬 head, 이번에 원격에 올라간 커밋(새것이 먼저), 그 가운데 기준 브랜치 병합으로 옮길 기준 커밋(D181).
   * push하기 전이거나 미뤘으면 없다 (D193)
   */
  pushed?: { at: string; head: string; commits: string[]; base_commit?: string }
  /** push를 미룬 이 라운드를 함께 push한 뒤 라운드의 task (D193). 커밋은 그 라운드의 기록에 있다 */
  pushed_with?: string
  replies: PrReply[]
}

/** pr-items.json (D191). 앱 소유이고 편집은 deny 규칙으로 막으며, 해시는 확인하지 않는다 */
export interface PrItemsFile {
  schema_version: 1
  items: PrItem[]
  synced: PrSynced[]
  /** 대응 라운드 (M10). M9 때 쓴 파일에는 없어 읽을 때 빈 목록으로 둔다 */
  rounds: PrRound[]
}

export const EMPTY_PR_ITEMS: PrItemsFile = { schema_version: 1, items: [], synced: [], rounds: [] }
