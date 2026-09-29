// 재시작과 복구 (시나리오 9, D76, D77, D91, D121~D126): 끊긴 여러 단계 작업을 어떻게 알리고 [다시 시도]·[무시]가
// 무엇을 하는지, 재시작 때 확인할 프로세스, 앱 소유 파일의 해시가 다를 때의 경고. 프로세스를 찾아 끝내는 것과
// 해시 계산, 파일 읽기는 main이 adapters로 한다. machine의 전이와 화면이 같은 규칙을 쓴다.
import type { NodeName } from '../shared/contracts'
import type { NoticeView, OperationView } from '../shared/views'
import type {
  CleanOperation,
  DeliverOperation,
  MergeOperation,
  OwnedFile,
  OwnedFileHashes,
  RespondOperation,
  RewindOperation,
  WorkOperation,
  WorkState,
} from '../shared/work'
import { DELIVERY_LABEL, DELIVERY_STAGE_LABEL, commitMessage, stashMessage } from './delivery'
import { NODE_INFO } from './pipeline'
import { localMinute } from './records'
import { RESPOND_STAGE_LABEL } from './respond'
import { taskLabel } from './review'
import { backupMessage } from './rewind'

const short = (commit: string) => commit.slice(0, 8)
const title = (node: NodeName) => `${NODE_INFO[node].title}(${node})`

// ---------- 끊긴 작업 (시나리오 9-4, D121~D123) ----------

/**
 * 끊긴 작업: 앱을 다시 켜며 남아 있던 진행 중 작업 기록 (재시작 조정이 표시한다). 없으면 undefined.
 * 진행 중 작업 기록은 명령 하나 안에서 쓰고 지우므로 명령 사이에 남는 것은 앱이 도중에 꺼졌을 때와,
 * 되감기가 코드를 바꾼 뒤 실패했을 때(D136)다
 */
export function cutOperation(work: WorkState): WorkOperation | undefined {
  return work.operation?.interrupted_at === undefined ? undefined : work.operation
}

/** 진행 중 작업 기록이 있는 동안 받지 않는 명령의 이유 (D122) */
export const OPERATION_BLOCKS = '끊긴 작업이 있음: 먼저 [다시 시도]나 [무시]를 누르세요'

/** 끊긴 전달을 실패로 남길 때의 오류 (D123) */
export const CUT_ERROR = '앱이 꺼져 끊김'

const REWIND_STAGE: Readonly<Record<RewindOperation['stage'], string>> = {
  backup: '백업 브랜치를 만드는 단계',
  reset: '코드를 되돌리는 단계',
}

const CLEAN_STAGE: Readonly<Record<CleanOperation['stage'], string>> = {
  worktree: 'worktree를 지우는 단계',
  branches: '브랜치를 지우는 단계(worktree는 지웠음)',
  remote: 'origin의 브랜치를 지우는 단계(worktree와 로컬 브랜치는 지웠음)',
}

/** 끊긴 작업의 알림 (D121): 무엇이 어디서 끊겼는지와 [다시 시도]·[무시]가 할 일 (D123). 없으면 null */
export function operationView(work: WorkState): OperationView | null {
  const op = cutOperation(work)
  if (!op) return null
  switch (op.kind) {
    case 'rewind':
      return rewindView(work, op)
    case 'deliver':
      return deliverView(op)
    case 'clean':
      return cleanView(op)
    case 'merge':
      return mergeView(op)
    case 'respond':
      return respondView(work, op)
  }
}

function respondView(work: WorkState, op: RespondOperation): OperationView {
  const rounds = op.rounds.map((id) => {
    const t = work.tasks.find((x) => x.id === id)
    return t ? `${taskLabel(t)} (라운드 ${t.respond?.round ?? '?'})` : id
  })
  return {
    kind: 'respond',
    title: 'PR 대응의 push와 답글 게시가 끊겼습니다',
    lines: [
      `끊긴 곳: ${RESPOND_STAGE_LABEL[op.stage]}${op.stage === 'reply' ? ' (push는 끝남)' : ''}`,
      `라운드: ${rounds.join(', ')}`,
    ],
    retry:
      '[다시 시도]: 끊긴 곳부터 잇습니다. 이미 원격에 있는 커밋은 다시 보내지 않고, 코멘트 id를 적은 답글은 건너뜁니다. ' +
      '게시 결과를 모르는 답글은 원격에서 보이지 않는 표시를 찾아 있으면 다시 게시하지 않습니다 (D194).',
    ignore:
      '[무시]: 기록만 지웁니다. PR 대응 task는 승인 대기로 남아 실패를 보이고, 승인 화면에서 [다시 시도]할 수 있습니다.',
    choice: null,
  }
}

function mergeView(op: MergeOperation): OperationView {
  return {
    kind: 'merge',
    title: '머지가 끊겼습니다',
    lines: [`방식: ${op.method}`, `머지할 head: ${short(op.head)}`],
    retry:
      '[다시 시도]: PR을 다시 읽어 이미 머지됐으면 완료(머지됨)합니다. 아니면 같은 head로 다시 머지합니다. ' +
      '그사이 새 커밋이 생겼으면 GitHub가 머지하지 않습니다.',
    ignore: '[무시]: 기록만 지웁니다. PR 진행으로 남고, 다음 읽기가 머지됐는지 봅니다.',
    choice: null,
  }
}

function rewindView(work: WorkState, op: RewindOperation): OperationView {
  const labels = op.discard.map((id) => {
    const t = work.tasks.find((x) => x.id === id)
    return t ? taskLabel(t) : id
  })
  const code =
    op.stage === 'backup'
      ? [`만들려던 백업 브랜치: ${op.backup_branch ?? '없음'}`, '코드는 아직 되돌리지 않았습니다.']
      : [
          op.backup_branch
            ? `백업 브랜치: ${op.backup_branch}${op.backup_commit ? ` (${short(op.backup_commit)})` : ''}`
            : '백업할 코드가 없었습니다.',
          '코드는 되돌렸을 수도 있습니다.',
        ]
  return {
    kind: 'rewind',
    title: '되감기가 끊겼습니다',
    lines: [
      `고른 단계: ${title(op.node)}`,
      `끊긴 곳: ${REWIND_STAGE[op.stage]}`,
      ...code,
      `되돌릴 커밋: ${short(op.reset_to)}`,
      `폐기할 task: ${labels.length ? labels.join(', ') : '없음'}`,
    ],
    retry:
      `[다시 시도]: 백업이 지금 코드와 다르면 한 번 더 백업하고 ${short(op.reset_to)}로 되돌린 뒤, ` +
      `폐기하고 ${title(op.node)}을(를) 되감기로 시작합니다.`,
    ignore:
      '[무시]: 기록만 지웁니다. 코드와 백업 브랜치는 지금 그대로이고, task는 폐기하지 않습니다.',
    choice: null,
  }
}

function deliverView(op: DeliverOperation): OperationView {
  const label = DELIVERY_LABEL[op.choice]
  const made = [
    ...(op.stash ? [`앱이 만든 stash: ${short(op.stash)}`] : []),
    ...(op.commit ? [`앱이 만든 커밋: ${short(op.commit)}`] : []),
  ]
  const prepare =
    op.stage === 'prepare'
      ? [
          '커밋 안 된 변경을 처리하다 만든 stash나 커밋은 [다시 시도]나 [무시]할 때 찾아 결과에 남깁니다.',
        ]
      : []
  return {
    kind: 'deliver',
    title: '전달이 끊겼습니다',
    lines: [
      `전달: [${label}]`,
      `끊긴 곳: ${DELIVERY_STAGE_LABEL[op.stage]}`,
      `브랜치: ${op.branch}`,
      ...made,
      ...prepare,
    ],
    retry:
      `[다시 시도]: 끊긴 시도를 실패로 남기고 [${label}]을(를) 처음부터 다시 합니다. 이미 push한 커밋은 ` +
      '다시 보내지 않고, 같은 브랜치의 열린 PR이 있으면 새로 만들지 않습니다. 커밋 안 된 변경이 남았으면 ' +
      '선택지를 다시 보입니다.',
    ignore:
      '[무시]: 끊긴 시도를 실패로 남깁니다. Work 완료 화면에서 [다시 시도]나 [전달 없이 완료]를 고를 수 있습니다.',
    choice: op.choice,
  }
}

function cleanView(op: CleanOperation): OperationView {
  return {
    kind: 'clean',
    title: 'Work 정리가 끊겼습니다',
    lines: [
      `끊긴 곳: ${CLEAN_STAGE[op.stage]}`,
      `지울 브랜치: ${op.delete_branches.length ? op.delete_branches.join(', ') : '없음'}`,
      ...(op.delete_remote ? [`지울 origin의 브랜치: ${op.delete_remote}`] : []),
      ...(op.force
        ? ['커밋 안 된 변경이나 잠금 파일을 확인하고 --force로 지우던 중이었습니다.']
        : []),
    ],
    retry:
      '[다시 시도]: 끊긴 단계부터 정리를 마치고 보관됨으로 바꿉니다. 반쯤 지운 worktree는 마저 지우고, ' +
      '이미 지운 브랜치는 건너뜁니다. 끊긴 뒤 worktree를 고치거나 커밋했으면 그것도 지우므로 [무시]를 누른 뒤 ' +
      '[Work 정리]로 다시 확인하세요.',
    ignore: '[무시]: 기록만 지웁니다. [Work 정리]를 다시 할 수 있습니다.',
    choice: null,
  }
}

// ---------- 끊긴 되감기의 [다시 시도] (D116, D123) ----------

/**
 * 끊긴 되감기가 이미 만든 백업: 기록(reset 단계)이나, backup 단계에서 계획한 이름으로 git에 있는 브랜치.
 * 이 Work의 되감기는 기록이 있는 동안 다른 되감기를 받지 않으므로(D122) 그 이름의 브랜치는 끊긴 되감기가 만든 것이다
 */
export interface MadeBackup {
  branch: string
  commit: string
  /** 백업할 때의 HEAD (backupHead) */
  head: string
  /** 백업 커밋의 tree */
  tree: string
}

/** 되감기를 다시 할 때 main이 git에서 읽는 사실 */
export interface RewindResumeFacts {
  /** 지금 HEAD */
  head: string
  /** 커밋 안 된 변경(추적하지 않는 파일 포함, 무시하는 파일 제외)이 있다 */
  dirty: boolean
  /** 지금 작업 트리의 tree(커밋 안 된 변경 포함). 이미 만든 백업과 비교할 때만 읽는다 */
  tree: string | null
  made: MadeBackup | null
}

export interface RewindResumePlan {
  /** 지금 코드를 다음 번호의 백업 브랜치에 남긴다 */
  backup: boolean
  /** 되돌릴 커밋으로 되돌린다 */
  reset: boolean
  /**
   * 새 task의 선택 기록(reset)에 남길 백업. made는 끊긴 되감기가 만든 백업, new는 이번에 만든 백업, none은
   * 백업이 없다. made가 있으면 이번에 만든 백업은 덤으로 남긴 것이다(사람이 그 뒤에 고친 코드)
   */
  keep: 'made' | 'new' | 'none'
  /** 선택 기록에 남길 되돌리기 전 HEAD. new면 지금 HEAD다 */
  from: string
}

/**
 * 끊긴 되감기를 끊긴 곳부터 잇는다 (D123). 코드가 이미 되돌릴 커밋이고 깨끗하면 백업도 되돌리기도 하지 않는다.
 * 이미 만든 백업이 지금 코드(HEAD와 커밋 안 된 변경)와 같으면 다시 만들지 않는다. 다르면(백업 전에 끊겼거나, 재시작
 * 뒤 사람이 고쳤으면) 다음 번호로 백업한 뒤 되돌린다. 되돌리기 전에 지금 코드가 늘 백업에 있다 (D116).
 */
export function rewindResumePlan(op: RewindOperation, f: RewindResumeFacts): RewindResumePlan {
  const atTarget = f.head === op.reset_to && !f.dirty
  const captured = f.made !== null && f.head === f.made.head && f.tree === f.made.tree
  const backup = !atTarget && !captured
  const keep = f.made ? 'made' : op.stage === 'backup' && backup ? 'new' : 'none'
  const from = f.made ? f.made.head : op.stage === 'reset' ? (op.head ?? f.head) : f.head
  return { backup, reset: !atTarget, keep, from }
}

/**
 * 백업 커밋이 가리키는 되돌리기 전 HEAD. 커밋 안 된 변경을 담은 백업 커밋(메시지로 안다, D116)이면 그 부모, 아니면
 * 백업 브랜치가 HEAD를 가리킨 것이라 그 커밋이다
 */
export function backupHead(
  workId: string,
  commit: { id: string; subject: string; parent: string | null },
): string {
  return commit.subject === backupMessage(workId) && commit.parent ? commit.parent : commit.id
}

// ---------- 끊긴 전달 (D123) ----------

/** stash 목록의 한 항목: stash 커밋과 제목(`On <브랜치>: <메시지>`) */
export interface StashEntry {
  commit: string
  subject: string
}

/**
 * 끊긴 전달의 [변경 버리고 진행]이 만들었지만 기록하지 못한 stash: 메시지가 이 Work의 것이고 결과에 없는 것.
 * git stash push --message의 제목은 `On <브랜치>: <메시지>`다 (git 문서 git-stash, 실행)
 */
export function lostStashes(
  workId: string,
  entries: readonly StashEntry[],
  known: readonly string[],
): string[] {
  const msg = stashMessage(workId)
  return entries
    .filter(
      (e) => (e.subject === msg || e.subject.endsWith(`: ${msg}`)) && !known.includes(e.commit),
    )
    .map((e) => e.commit)
}

/** 끊긴 전달의 [커밋하고 진행]이 만들었지만 기록하지 못한 커밋: HEAD의 메시지가 이 Work의 것이고 결과에 없으면 HEAD */
export function lostCommit(
  workId: string,
  head: { id: string; subject: string },
  known: readonly string[],
): string | null {
  return head.subject === commitMessage(workId) && !known.includes(head.id) ? head.id : null
}

/** 전달 결과와 끊긴 기록에 이미 있는 stash와 커밋 */
export function knownBackups(
  work: WorkState,
  op: DeliverOperation,
): { stashes: string[]; commits: string[] } {
  return {
    stashes: [...(work.delivery?.stashes ?? []), ...(op.stash ? [op.stash] : [])],
    commits: [...(work.delivery?.commits ?? []), ...(op.commit ? [op.commit] : [])],
  }
}

// ---------- 끊긴 정리 (D123) ----------

/** git status --porcelain=v1의 한 줄이 지운 추적 파일인가(XY 가운데 D가 있고 나머지는 공백이나 D) */
const DELETION = /^(?:D[ D]| D) /

export type CleanResume = { ok: true; force: boolean } | { ok: false; error: string }

/**
 * 끊긴 정리를 worktree 단계부터 다시 할 때 git worktree remove에 --force를 줄지 (D123). 기록이 --force였으면 준다.
 * 아니면 남은 변경이 지우다 만 추적 파일뿐일 때만 준다(git은 지운 추적 파일도 변경으로 보고 거부한다). 다른 변경이
 * 생겼으면 사람이 [Work 정리]로 다시 확인한다
 */
export function cleanResume(recordedForce: boolean, status: readonly string[]): CleanResume {
  if (recordedForce) return { ok: true, force: true }
  if (status.length === 0) return { ok: true, force: false }
  if (status.every((l) => DELETION.test(l))) return { ok: true, force: true }
  return {
    ok: false,
    error:
      'worktree에 지우다 만 것 말고 다른 변경이 있어 정리를 멈춤. [무시]를 누른 뒤 [Work 정리]로 다시 확인하세요',
  }
}

// ---------- 고아 프로세스 (시나리오 9-1, D76, D126) ----------

/** 재시작 때 확인할 프로세스 */
export interface RecordedProcess {
  /** task id. 정리 세션이면 null */
  taskId: string | null
  /** "03 원인 분석"이나 "정리 세션" */
  label: string
  pid: number
  startedAt: string
}

/**
 * 재시작 때 확인할 프로세스 (D76, D126): 모든 task의 세션과 살아 있던 정리 세션 가운데 시작 시각을 적은 것.
 * 시작 시각이 없으면 재사용된 ID를 가릴 수 없어 넣지 않는다. 끝난 세션도 넣는다: SessionEnd 뒤 늦게 끝나는
 * 프로세스가 있고, 시작 시각까지 같으면 같은 프로세스다
 */
export function recordedProcesses(work: WorkState): RecordedProcess[] {
  const out: RecordedProcess[] = []
  for (const t of work.tasks) {
    const s = t.session
    if (s?.process_started_at) {
      out.push({ taskId: t.id, label: taskLabel(t), pid: s.pid, startedAt: s.process_started_at })
    }
  }
  const c = work.cleanup_process
  if (c?.process_started_at) {
    out.push({ taskId: null, label: '정리 세션', pid: c.pid, startedAt: c.process_started_at })
  }
  return out
}

/** 끝낸 고아 프로세스의 알림 (D121) */
export function orphanNotice(killed: readonly RecordedProcess[]): Omit<NoticeView, 'id'> {
  return {
    kind: 'orphans',
    title: '앱을 다시 켜며 남아 있던 프로세스를 끝냈습니다',
    lines: killed.map((p) => `${p.label}의 claude (PID ${p.pid})`),
    hint: '앱이 다시 붙을 수 없는 세션이라 프로세스 트리를 끝냈습니다(D76). task는 [재개]로 이어서 할 수 있습니다.',
  }
}

// ---------- 앱 소유 파일 (6.1, D91, D124, D125) ----------

/** 해시를 적는 앱 소유 파일 (D124, D125) */
export const OWNED_FILES: readonly OwnedFile[] = ['request.md', 'intent.md', 'decisions.md']

/** 지금 파일의 해시. 파일이 없으면 null */
export type ActualHashes = Partial<Record<OwnedFile, string | null>>

/**
 * 적힌 해시와 지금 해시가 다른 파일 (D124). actual에 있는 파일만 본다. 적힌 해시가 없는데 파일이 있으면(앱이 쓰지
 * 않은 파일이 생김), 적힌 해시가 있는데 파일이 없으면(없어짐) 다르다
 */
export function changedFiles(recorded: OwnedFileHashes, actual: ActualHashes): OwnedFile[] {
  return OWNED_FILES.filter((f) => f in actual && (recorded[f] ?? null) !== (actual[f] ?? null))
}

/** 바뀐 파일 한 줄 (D124) */
export function changedFileLine(
  file: OwnedFile,
  recorded: string | null,
  actual: string | null,
  at: string,
  filePath: string,
): string {
  const what =
    actual === null ? '없어짐' : recorded === null ? '앱이 쓰지 않았는데 생김' : '내용이 바뀜'
  return `${file}: ${what} (${localMinute(at)}에 확인) — ${filePath}`
}

/** 바뀐 앱 소유 파일의 알림 (D121, D124). lines는 changedFileLine이다 */
export function filesNotice(lines: readonly string[]): Omit<NoticeView, 'id'> {
  return {
    kind: 'files',
    title: '앱 밖에서 바뀐 파일이 있습니다',
    lines: [...lines],
    hint: '앱은 되돌리지 않고 지금 내용을 씁니다. [확인]하면 지금 내용을 받아들입니다(D124).',
  }
}

/** work.json이 바뀌었을 때 옆에 남길 파일의 이름 (D124): work.json.changed-<현지 시각> */
export function changedCopyName(at: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(at)
  const stamp = m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}` : 'unknown'
  return `work.json.changed-${stamp}`
}

/** work.json이 앱 밖에서 바뀐 것을 안 때와, 바뀐 내용을 남긴 옆 파일. 파일이 없어졌으면 copy는 null이다 */
export interface WorkJsonChange {
  at: string
  copy: string | null
}

/** 앱 밖에서 바뀐 work.json의 알림 (D121, D124) */
export function workJsonNotice(changes: readonly WorkJsonChange[]): Omit<NoticeView, 'id'> {
  return {
    kind: 'work_json',
    title: 'work.json이 앱 밖에서 바뀌었습니다',
    lines: changes.map((c) =>
      c.copy === null
        ? `${localMinute(c.at)}: work.json이 없어져 있었음`
        : `${localMinute(c.at)}: 바뀐 내용 — ${c.copy}`,
    ),
    hint: '앱은 되돌리지 않은 자기 상태로 다시 썼습니다. 바뀐 내용은 옆 파일에 남겼습니다(D124).',
  }
}
