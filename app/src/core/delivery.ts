// 전달 (시나리오 7, D15, D67, D71, D118~D120): Work 완료 화면의 전달 버튼과 그 이유, 전달을 시작할 수 있는지,
// pr.md의 제목과 본문, push 뒤의 비교 URL, 커밋 안 된 변경을 처리하는 커밋과 stash의 메시지(7-5).
// git과 gh는 main이 adapters로 부른다. machine의 전달 전이와 승인 화면이 같은 판정을 쓴다.
import type { Handoff, NodeName } from '../shared/contracts'
import type { ProjectChecks } from '../shared/project'
import type { ButtonState, DeliveryButtons, DeliveryView, WorkActions } from '../shared/views'
import type {
  CheckSummary,
  DeliveryChoice,
  DeliveryRecord,
  DeliveryStage,
  TaskRecord,
  WorkState,
} from '../shared/work'
import { REVIEWABLE, approvalGate } from './approval'
import { isPrevious } from './pipeline'
import { normalizeText } from './validate'

/** 정리 세션이 열린 동안 받지 않는 명령의 이유 (D137) */
export const CLEANUP_BLOCKS =
  '정리 세션이 열려 있음: 먼저 [정리 세션 닫기]나 [정리 끝 → push/PR 진행]을 누르세요'

/**
 * 정리 세션이 열린 동안(대기열 포함)의 조작 (D137). 같은 worktree에서 다른 claude를 띄우거나 코드를 되돌리거나 Work를
 * 끝내는 조작을 끈다. 승인과 [완료만]도 받지 않는다(main이 막는다)
 */
export function cleanupActions(a: WorkActions): WorkActions {
  return { ...a, resume: false, retry: false, resumeWork: false, selectStep: false, abandon: false }
}

/** 전달 버튼의 이름 (시나리오 7-3) */
export const DELIVERY_LABEL: Readonly<Record<DeliveryChoice | 'none', string>> = {
  none: '완료만',
  push: 'push',
  pr: 'PR 생성',
}

/** 전달 단계의 이름 (D77) */
export const DELIVERY_STAGE_LABEL: Readonly<Record<DeliveryStage, string>> = {
  prepare: '커밋 안 된 변경 처리',
  push: 'push',
  pr: 'PR 만들기',
}

const NO_ORIGIN = 'origin 원격이 없음'
const NO_GH = 'gh가 없거나 로그인되지 않음'

const enabled: ButtonState = { enabled: true, reason: null }
const disabled = (reason: string): ButtonState => ({ enabled: false, reason })

/**
 * 전달 버튼 (7-4, D67): origin 원격이 없으면 [push]와 [PR 생성]을, gh가 없거나 로그인되지 않았으면
 * [PR 생성]만 이유와 함께 비활성화한다. 점검 결과는 verify를 시작할 때와 [다시 점검]으로 새로 한다 (D118).
 */
export function deliveryButtons(checks: Pick<ProjectChecks, 'origin' | 'gh'>): DeliveryButtons {
  return {
    none: enabled,
    push: checks.origin ? enabled : disabled(NO_ORIGIN),
    pr: !checks.origin ? disabled(NO_ORIGIN) : checks.gh ? enabled : disabled(NO_GH),
  }
}

/** 마무리 안내 문구(D104)에 넣을 verify의 버튼: Work 완료 화면에서 누를 수 있는 전달 버튼 */
export function closingButtons(checks: Pick<ProjectChecks, 'origin' | 'gh'>): string[] {
  const b = deliveryButtons(checks)
  return (['none', 'push', 'pr'] as const)
    .filter((k) => b[k].enabled)
    .map((k) => `[${DELIVERY_LABEL[k]}]`)
}

/**
 * 승인하면 Work가 멈추는가: 에이전트가 이전 단계를 추천했거나(D23) [이 단계 끝나면 멈춤]이 켜져 있다
 * (시나리오 3-4). verify에서는 전달 버튼 대신 [승인하고 멈춤] 하나를 보인다 (D119).
 */
export function approvalStops(
  work: Pick<WorkState, 'stop_after_step'>,
  node: NodeName,
  header: Pick<Handoff, 'recommended_next'> | null,
): boolean {
  const rec = header?.recommended_next
  return work.stop_after_step === true || (!!rec && isPrevious(node, rec.node))
}

/** verify에서 멈춘 Work의 verify task (D119). 아니면 undefined */
export function stoppedVerify(work: WorkState): TaskRecord | undefined {
  if (work.status !== 'stopped' || !work.stop) return undefined
  const task = work.tasks.find((t) => t.id === work.stop?.task_id)
  return task?.node === 'verify' && task.status === 'approved' ? task : undefined
}

/**
 * 전달을 시작할 수 있는 verify task (7-3, D119, D120). 둘 중 하나다:
 * - review: 진행 중인 Work의 지금 task가 verify이고, 에이전트가 턴을 끝냈고(D112), 승인할 수 있고(형식 오류
 *   없음), 승인해도 멈추지 않는다. 전달이 성공한 뒤 승인을 기록한다 (D120).
 * - stopped: verify에서 멈춘 Work다. verify는 이미 승인됐다 (D119).
 * 진행 중인 여러 단계 작업(D77)이 있으면 시작하지 않는다.
 */
export type DeliveryStart =
  { ok: true; from: 'review' | 'stopped'; task: TaskRecord } | { ok: false; error: string }

export function deliveryStart(
  work: WorkState,
  check: (CheckSummary & { handoffHeader?: Handoff | null }) | null,
): DeliveryStart {
  if (work.operation) return { ok: false, error: '진행 중인 작업이 있음' }
  const stopped = stoppedVerify(work)
  if (stopped) return { ok: true, from: 'stopped', task: stopped }
  if (work.status !== 'active') return { ok: false, error: '전달할 수 있는 Work가 아님' }
  const task = work.tasks[work.tasks.length - 1]
  if (task?.node !== 'verify') return { ok: false, error: '최종 검증의 Work 완료 화면이 아님' }
  if (!REVIEWABLE.includes(task.status)) {
    return { ok: false, error: `${task.id}는 승인할 수 있는 상태가 아님` }
  }
  if (!check || !approvalGate(task, check).approve) {
    return { ok: false, error: `${task.id}의 handoff가 유효하지 않음` }
  }
  if (approvalStops(work, task.node, check.handoffHeader ?? null)) {
    return { ok: false, error: '승인하면 Work가 멈춤: [승인하고 멈춤]을 누르세요' }
  }
  return { ok: true, from: 'review', task }
}

// ---------- pr.md (D62) ----------

export type PrText = { ok: true; title: string; body: string } | { ok: false; error: string }

/**
 * pr.md의 제목과 본문 (7-4, D62): 첫 줄 `# 제목`의 제목, 나머지가 본문이다.
 * 본문 앞의 빈 줄과 끝의 공백은 뗀다. 첫 줄이 `# 제목`이 아니면 오류다(형식 검사와 같은 규칙).
 */
export function prText(text: string): PrText {
  const [first = '', ...rest] = normalizeText(text).split('\n')
  const m = /^# +(\S.*)$/.exec(first)
  const title = m?.[1]?.trim()
  if (!title) return { ok: false, error: 'pr.md 첫 줄이 `# <PR 제목>`이 아님' }
  return {
    ok: true,
    title,
    body: rest
      .join('\n')
      .replace(/^\s*\n/, '')
      .trimEnd(),
  }
}

// ---------- 비교 URL (7-4) ----------

/** 원격 주소의 호스트, 소유자, 레포. GitHub 레포 주소로 읽을 수 없으면 null */
export interface RemoteRepo {
  host: string
  owner: string
  repo: string
}

/** 원격 서버의 URL (git 문서 urls: ssh://, git://, http[s]://. gh는 git+ssh://, git+https://도 받음) */
const URL_SCHEME = /^(?:ssh|git\+ssh|git|http|https|git\+https):\/\//i
/**
 * scp 꼴 ssh 주소 [<user>@]<host>:<path>. 첫 콜론 앞에 슬래시가 없을 때만이다(git 문서 urls).
 * 로컬 경로(/path, file://)와 Windows 드라이브 경로(C:\, C:/)는 원격 서버가 아니다
 */
const SCP_LIKE = /^(?:[^@/\\:]+@)?([^/\\:]+):(?!\/\/)(.+)$/

/**
 * origin 주소를 GitHub 레포로 읽는다: 호스트와, 경로의 소유자와 레포 둘. 호스트는 소문자로 바꾸고 www.를
 * 떼고, 레포 이름의 .git을 뗀다. 출처: cli/go-gh internal/git/url.go ParseURL, RepoInfoFromURL
 */
export function remoteRepo(url: string): RemoteRepo | null {
  const u = url.trim()
  let host: string
  let pathname: string
  if (URL_SCHEME.test(u)) {
    let parsed: URL
    try {
      parsed = new URL(u.replace(/^git\+/i, ''))
    } catch {
      return null
    }
    host = parsed.hostname
    pathname = decodeURIComponent(parsed.pathname)
  } else {
    if (/^[A-Za-z]:[\\/]/.test(u)) return null
    const m = SCP_LIKE.exec(u)
    if (!m) return null
    host = m[1] ?? ''
    pathname = m[2] ?? ''
  }
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/')
  if (!host || parts.length !== 2 || !parts[0] || !parts[1]) return null
  const repo = parts[1].replace(/\.git$/, '')
  if (!repo) return null
  return { host: host.toLowerCase().replace(/^www\./, ''), owner: parts[0], repo }
}

/**
 * gh --repo에 줄 origin의 레포: HOST/OWNER/REPO. gh는 --repo를 git@나 ssh:, https: 따위로 시작할 때만 URL로
 * 읽어서 사용자 이름이 git이 아닌 scp 꼴 주소(me@host:owner/repo)를 OWNER/REPO로 잘못 읽는다. 그래서 비교 URL과
 * 같은 규칙으로 읽어 넘긴다. 읽을 수 없으면(로컬 경로 등) 주소를 그대로 넘기고 gh의 오류를 보인다.
 * 출처: cli/go-gh pkg/repository/repository.go Parse, internal/git/url.go IsURL
 */
export function ghRepo(origin: string): string {
  const r = remoteRepo(origin)
  return r ? `${r.host}/${r.owner}/${r.repo}` : origin
}

/**
 * push 뒤 브라우저에서 PR을 만드는 비교 URL (7-4): https://<host>/<owner>/<repo>/compare/<base>...<head>?expand=1.
 * 브랜치 이름은 경로 조각으로 인코딩한다(relay/w-… → relay%2Fw-…). origin을 GitHub 레포로 읽을 수 없으면 null.
 * 출처: cli/cli pkg/cmd/pr/create/create.go generateCompareURL (gh pr create --web이 여는 주소)
 */
export function compareUrl(origin: string, base: string, head: string): string | null {
  const r = remoteRepo(origin)
  if (!r) return null
  const enc = encodeURIComponent
  return `https://${r.host}/${r.owner}/${r.repo}/compare/${enc(base)}...${enc(head)}?expand=1`
}

// ---------- 커밋 안 된 변경 (7-5) ----------

/** [커밋하고 진행]의 커밋 메시지 (7-5) */
export function commitMessage(workId: string): string {
  return `relay(${workId}): 완료 전 남은 변경`
}

/** [변경 버리고 진행]의 stash 메시지 (7-5). 되감기 백업 커밋(D116)과 같은 꼴이다 */
export function stashMessage(workId: string): string {
  return `relay(${workId}): 완료 전 버린 변경`
}

/** 사람에게 보인 변경 목록과 지금 목록이 같은가 (순서는 보지 않는다) */
export function sameChanges(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const x = [...a].sort()
  const y = [...b].sort()
  return x.every((v, i) => v === y[i])
}

// ---------- 화면 ----------

/** 전달 결과의 화면 모양 */
export function deliveryView(d: DeliveryRecord | undefined): DeliveryView | null {
  if (!d) return null
  return {
    choice: d.choice,
    label: DELIVERY_LABEL[d.choice],
    status: d.status,
    at: d.at,
    stage: d.stage ? DELIVERY_STAGE_LABEL[d.stage] : null,
    error: d.error ?? null,
    branch: d.branch ?? null,
    compareUrl: d.compare_url ?? null,
    prUrl: d.pr_url ?? null,
    prExisting: d.pr_existing === true,
    draft: d.draft === true,
  }
}

/** 완료한 Work의 전달: 성공한 [push]·[PR 생성]이면 그것, 아니면 [완료만] */
export function completedDelivery(work: WorkState): DeliveryChoice | 'none' {
  return work.delivery?.status === 'succeeded' ? work.delivery.choice : 'none'
}
