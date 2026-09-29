// PR 읽기의 네트워크 부분 (시나리오 10-2, I51). gh로 PR 상태와 체크, 코멘트 목록 셋을 읽고(GraphQL 한 번과 REST 셋,
// S7 관찰 9), 처음 보는 Actions 실행의 이벤트를 읽고(D201), 원격 head가 로컬 Work 브랜치와 다르면 PR 브랜치를, 충돌이면
// 기준 브랜치를 fetch해 비교할 사실을 모은다(D193, D189). 새 CI 실패는 실패한 스텝의 로그를 읽는다. 작업 트리와 앱의
// 파일은 바꾸지 않는다(fetch는 원격 추적 브랜치만 바꿈). 반영(fast-forward, pr-items.json, work.json)은 WorkRunner가
// Work의 처리 줄에서 한다.
import { ghApi, ghApiList, ghFailedLog, ghPrView } from '../adapters/gh'
import {
  commitsWithParents,
  currentBranch,
  fetchBranch,
  hasCommit,
  isAncestor,
  refCommit,
  statusLines,
} from '../adapters/git'
import {
  checksOf,
  ciItemId,
  commentFacts,
  failedLogTail,
  repoArg,
  restRepo,
  rollupRuns,
  syncKind,
  type CheckFact,
  type CommentFact,
  type PrLocation,
} from '../core/pr'
import type { SyncKind } from '../shared/views'

export interface PrReadContext {
  ghBin: string
  env: NodeJS.ProcessEnv
  /** 메인 체크아웃. gh와 fetch를 여기서 부른다 */
  repo: string
  worktree: string
  /** Work 브랜치 relay/<work-id> */
  branch: string
  location: PrLocation
  /**
   * Actions 실행 id → 이벤트 (D201). 실행의 이벤트는 바뀌지 않아 WorkRunner가 메모리에 두고(I52), readPr이 처음 보는
   * 실행의 것을 읽어 더한다
   */
  runEvents: Map<number, string>
}

/** gh pr view --json으로 읽은 PR (PR #14의 필드) */
export interface PrViewFacts {
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  head: string
  headRef: string
  baseRef: string
  isDraft: boolean
  mergeable: string | null
  mergeStateStatus: string | null
  reviewDecision: string | null
}

export interface PrFetched {
  view: PrViewFacts
  checks: CheckFact[]
  comments: CommentFact[]
  /** 로컬 Work 브랜치의 커밋. 없으면 null */
  local: string | null
  /** 원격 head와 로컬의 비교(D193). 비교하지 못했으면(fetch 실패 등) null */
  sync: SyncKind | null
  /** 충돌이면 fetch한 기준 브랜치의 커밋, 충돌이 없으면 null, 모르면 undefined (D189, S7 관찰 7) */
  conflict: string | null | undefined
  /** CI 실패의 로그나 읽지 못한 까닭 (항목 id별) */
  logs: Map<string, { log?: string; note?: string }>
  /** 비교나 fetch에서 난 오류. 읽기는 계속한다 */
  warnings: string[]
}

const STATES = ['OPEN', 'CLOSED', 'MERGED'] as const

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

/** gh pr view --json의 결과를 읽는다. 모르는 state면 오류다 */
export function viewFacts(v: Record<string, unknown>): PrViewFacts {
  const state = STATES.find((s) => s === v['state'])
  const head = text(v['headRefOid'])
  if (!state || !head) {
    throw new Error(
      `gh pr view의 state나 headRefOid를 읽지 못함: ${JSON.stringify(v).slice(0, 200)}`,
    )
  }
  return {
    state,
    head,
    headRef: text(v['headRefName']) ?? '',
    baseRef: text(v['baseRefName']) ?? '',
    isDraft: v['isDraft'] === true,
    mergeable: text(v['mergeable']),
    mergeStateStatus: text(v['mergeStateStatus']),
    reviewDecision: text(v['reviewDecision']),
  }
}

/** 원격 브랜치를 fetch한 커밋. 실패하면 null과 오류 */
async function fetched(
  ctx: Pick<PrReadContext, 'repo' | 'env'>,
  branch: string,
): Promise<{ commit: string | null; error?: string }> {
  const opts = { env: ctx.env }
  try {
    await fetchBranch(ctx.repo, branch, 'origin', opts)
  } catch (e) {
    return { commit: null, error: `origin/${branch}를 fetch하지 못함: ${String(e)}` }
  }
  return { commit: await refCommit(ctx.repo, `refs/remotes/origin/${branch}`, opts) }
}

/**
 * 원격 PR head와 로컬 Work 브랜치를 비교한다 (D193, S7 관찰 8). 같으면 fetch하지 않는다. 다르면 PR 브랜치를 fetch하고
 * 두 방향 merge-base --is-ancestor로 가르며, 원격만 앞섰으면 worktree가 깨끗하고 Work 브랜치에 있는지도 본다
 */
async function compare(
  ctx: PrReadContext,
  view: PrViewFacts,
  local: string | null,
  warnings: string[],
): Promise<SyncKind | null> {
  if (!local) return null
  if (local === view.head) return 'same'
  const opts = { env: ctx.env }
  const f = await fetched(ctx, view.headRef || ctx.branch)
  if (f.error) warnings.push(f.error)
  if (!(await hasCommit(ctx.repo, view.head, opts))) {
    warnings.push(`원격 PR head ${view.head.slice(0, 8)}를 fetch하지 못함`)
    return null
  }
  const localInRemote = await isAncestor(ctx.repo, local, view.head, opts)
  const remoteInLocal = localInRemote ? false : await isAncestor(ctx.repo, view.head, local, opts)
  const clean = localInRemote ? (await statusLines(ctx.worktree, opts)).length === 0 : true
  const onBranch = localInRemote ? (await currentBranch(ctx.worktree, opts)) === ctx.branch : true
  return syncKind({ local, remote: view.head, localInRemote, remoteInLocal, clean, onBranch })
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * 처음 보는 Actions 실행의 이벤트를 읽어 ctx.runEvents에 더한다 (D201, I52): gh api repos/<owner>/<repo>/actions/runs/<실행>
 * ?exclude_pull_requests=true의 event(REST "Get a workflow run", gh run view와 같은 요청, 3절). 읽지 못하면 경고를 남기고
 * 다음 읽기에서 다시 읽는다. 그동안 그 실행의 체크는 실행 id로 가린다(core/pr checksOf)
 */
async function readRunEvents(
  ctx: PrReadContext,
  runs: readonly number[],
  warnings: string[],
): Promise<void> {
  const rest = restRepo(ctx.location)
  await Promise.all(
    runs
      .filter((id) => !ctx.runEvents.has(id))
      .map(async (id) => {
        try {
          const v = await ghApi(ctx.ghBin, {
            host: ctx.location.host,
            path: `${rest}/actions/runs/${id}?exclude_pull_requests=true`,
            cwd: ctx.repo,
            env: ctx.env,
          })
          const event = typeof v['event'] === 'string' && v['event'] !== '' ? v['event'] : null
          if (event) ctx.runEvents.set(id, event)
          else warnings.push(`실행 ${id}의 이벤트가 비어 있음`)
        } catch (e) {
          warnings.push(`실행 ${id}의 이벤트를 읽지 못함: ${errorText(e)}`)
        }
      }),
  )
}

/** 로그를 읽지 않는 까닭 */
const NOT_ACTIONS = 'GitHub Actions 밖의 체크라 로그를 읽지 않음'
const RUN_PENDING = '실행이 아직 끝나지 않아 로그를 읽지 못함. 다음 읽기에서 다시 봄'

/**
 * PR의 인라인 코멘트(`pulls/<n>/comments`)나 대화 코멘트(`issues/<n>/comments`) 목록 (모든 쪽). 읽기와 답글 게시(D194, D205)가
 * 같이 쓴다
 */
export function listPrComments(
  ctx: Pick<PrReadContext, 'ghBin' | 'env' | 'repo' | 'location'>,
  kind: 'inline' | 'convo',
): Promise<unknown[]> {
  const rest = restRepo(ctx.location)
  const n = ctx.location.number
  const path =
    kind === 'inline'
      ? `${rest}/pulls/${n}/comments?per_page=100`
      : `${rest}/issues/${n}/comments?per_page=100`
  return ghApiList(ctx.ghBin, { host: ctx.location.host, path, cwd: ctx.repo, env: ctx.env })
}

/**
 * PR을 한 번 읽는다 (시나리오 10-2). hasLog는 이미 로그를 읽은 CI 실패 항목이다: 새 CI 실패의 로그만 읽는다
 * (gh run view --log-failed는 REST 4번과 로그 zip, S7 관찰 9). gh가 실패하면 오류를 던진다
 */
export async function readPr(
  ctx: PrReadContext,
  hasLog: (itemId: string) => boolean,
): Promise<PrFetched> {
  const repo = repoArg(ctx.location)
  const gh = { repo, number: ctx.location.number, cwd: ctx.repo, env: ctx.env }
  const raw = await ghPrView(ctx.ghBin, gh)
  const view = viewFacts(raw)
  const rollup = raw['statusCheckRollup']
  const rest = restRepo(ctx.location)
  const list = (path: string) =>
    ghApiList(ctx.ghBin, { host: ctx.location.host, path, cwd: ctx.repo, env: ctx.env })
  const n = ctx.location.number
  const warnings: string[] = []
  const [reviews, inline, convo] = await Promise.all([
    list(`${rest}/pulls/${n}/reviews?per_page=100`),
    listPrComments(ctx, 'inline'),
    listPrComments(ctx, 'convo'),
    readRunEvents(ctx, rollupRuns(rollup), warnings),
  ])
  const checks = checksOf(rollup, ctx.runEvents)
  const local = await refCommit(ctx.repo, `refs/heads/${ctx.branch}`, { env: ctx.env })
  const sync = view.state === 'OPEN' ? await compare(ctx, view, local, warnings) : null
  let conflict: string | null | undefined = null
  if (view.mergeable === 'CONFLICTING') {
    // 충돌 항목의 id는 fetch한 기준 브랜치 커밋이다. PR의 baseRefOid는 PR 브랜치에 push하기 전까지 옛 커밋이다(S7)
    const f = await fetched(ctx, view.baseRef)
    if (f.error) warnings.push(f.error)
    conflict = f.commit ?? undefined
  } else if (view.mergeable !== 'MERGEABLE') {
    conflict = undefined
  }
  const logs = new Map<string, { log?: string; note?: string }>()
  for (const c of checks.filter((x) => x.bucket === 'fail')) {
    const id = ciItemId(view.head, c)
    if (hasLog(id)) continue
    if (c.job === null) {
      logs.set(id, { note: NOT_ACTIONS })
      continue
    }
    const r = await ghFailedLog(ctx.ghBin, { repo, job: c.job, cwd: ctx.repo, env: ctx.env })
    if (r.ok) logs.set(id, { log: failedLogTail(r.text) })
    else logs.set(id, { note: r.pending ? RUN_PENDING : `로그를 읽지 못함: ${r.error}` })
  }
  return {
    view,
    checks,
    comments: commentFacts({ reviews, inline, convo }),
    local,
    sync,
    conflict,
    logs,
    warnings,
  }
}

/**
 * fast-forward로 받은 커밋과, 그 가운데 기준 브랜치를 병합한 것의 기준 브랜치 쪽 부모 (D181, D193). 받은 커밋의 둘째
 * 이후 부모가 fetch한 기준 브랜치에 있으면(조상이거나 같음) 기준 브랜치 병합이다(S7 관찰 8). 지금 기준 커밋의 자손
 * 가운데 가장 새것(다른 후보가 모두 그 조상)으로 옮긴다. 병합 커밋이 있을 때만 기준 브랜치를 fetch한다(baseTip).
 * 옮길 것이 없거나 정할 수 없으면 base는 null이다
 */
export async function receivedCommits(
  ctx: Pick<PrReadContext, 'repo' | 'env'>,
  from: string,
  to: string,
  current: string,
  baseTip: () => Promise<string | null>,
): Promise<{ received: string[]; base: string | null }> {
  const opts = { env: ctx.env }
  const commits = await commitsWithParents(ctx.repo, from, to, opts)
  const received = commits.map((c) => c.commit)
  const parents = [...new Set(commits.flatMap((c) => c.parents.slice(1)))]
  if (!parents.length) return { received, base: null }
  const tip = await baseTip()
  if (!tip) return { received, base: null }
  const candidates: string[] = []
  for (const p of parents) {
    if (p === current) continue
    if (!(await isAncestor(ctx.repo, p, tip, opts))) continue
    if (!(await isAncestor(ctx.repo, current, p, opts))) continue
    candidates.push(p)
  }
  for (const c of candidates) {
    let newest = true
    for (const other of candidates) {
      if (other !== c && !(await isAncestor(ctx.repo, other, c, opts))) newest = false
    }
    if (newest) return { received, base: c }
  }
  return { received, base: null }
}

/** 원격 브랜치를 fetch하고 그 커밋을 돌려준다. 실패하면 null이다 */
export async function fetchTip(
  ctx: Pick<PrReadContext, 'repo' | 'env'>,
  branch: string,
): Promise<string | null> {
  return (await fetched(ctx, branch)).commit
}
