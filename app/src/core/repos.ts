// 묶음 Work (D470~D483): 메인 레포와 고른 서브모듈을 함께 고치는 Work의 순수 규칙. 메인 레포는 WorkState의 기준
// 브랜치·커밋과 전달·PR 기록이고, 서브모듈은 work.repos다. 작업 브랜치 이름은 모든 레포가 같다 (D471).
// git에서 읽는 것은 main이 넘긴다.
import type {
  DeliveryChoice,
  PullRequestRecord,
  TaskRecord,
  UncommittedAction,
  WorkRepo,
  WorkState,
} from '../shared/work'
import { unquote } from './submodule'

/** 묶음 Work다: 서브모듈을 함께 고르거나 메인 레포를 고르지 않았다 (D470) */
export function isBundle(work: Pick<WorkState, 'repos' | 'main_fixed'>): boolean {
  return (work.repos?.length ?? 0) > 0 || work.main_fixed === true
}

/** 메인 레포를 고치고 전달한다 (D471). 메인을 고르지 않은 묶음 Work만 아니다 */
export function mainEditable(work: Pick<WorkState, 'main_fixed'>): boolean {
  return work.main_fixed !== true
}

/** 묶음 Work의 서브모듈. 없으면 빈 목록이다 */
export function workRepos(work: Pick<WorkState, 'repos'>): readonly WorkRepo[] {
  return work.repos ?? []
}

/** 서브모듈 레포의 머지 대상 (D428, D470): 고르지 않았으면 기준 브랜치다 */
export function repoTarget(repo: Pick<WorkRepo, 'base_branch' | 'target_branch'>): string {
  return repo.target_branch ?? repo.base_branch
}

/** 메인 레포의 화면 이름에 붙이는 말 (D472) */
export const MAIN_LABEL = '메인'

/**
 * porcelain v1 한 줄의 경로. 이름을 바꾼 줄은 새 이름이다. git이 따옴표로 감싼 경로는 푼다 (core/submodule과 같은 규칙)
 */
export function statusPath(line: string): string {
  const rest = line.slice(3)
  const m = /^(?:"(?:[^"\\]|\\.)*"|.*?) -> (.*)$/.exec(rest)
  return unquote(m?.[1] ?? rest).replace(/\/$/, '')
}

/**
 * 메인 worktree의 커밋 안 된 변경에서 고른 서브모듈의 자리를 뺀다 (D475). 그 자리는 서브모듈 worktree의 HEAD가 옮겨
 * 늘 바뀐 것으로 보이고, 메인이 가리키는 커밋은 앱이 전달 때 맞춘다 (D478)
 */
export function withoutRepoPaths(lines: readonly string[], paths: readonly string[]): string[] {
  if (paths.length === 0) return [...lines]
  const set = new Set(paths)
  return lines.filter((l) => !set.has(statusPath(l)))
}

/** 서브모듈의 커밋 안 된 변경을 한 목록에 보일 때의 줄 (D475): `<경로>: <git status 줄>` */
export function repoLine(path: string, line: string): string {
  return `${path}: ${line}`
}

/** 메인이 새 서브모듈 커밋을 가리키게 하는 앱의 커밋 메시지 (D478) */
export function linkMessage(
  workId: string,
  links: readonly { path: string; sha: string }[],
): string {
  const what = links.map((l) => `${l.path} 서브모듈을 ${l.sha.slice(0, 8)}로`).join(', ')
  return `relay(${workId}): ${what}`
}

/** 묶음 Work의 Work 완료 화면에서 레포 하나에 고른 전달 (D477). null은 [보내지 않음]이다 */
export interface RepoPick {
  /** 서브모듈 경로. 메인 레포는 '' */
  path: string
  choice: DeliveryChoice | null
  /** 메인이 이 서브모듈의 새 커밋을 가리키게 한다 (D478). 서브모듈에만 쓴다 */
  link?: boolean
}

/** 레포 하나의 전달 판정에 쓰는 사실. main이 git과 점검에서 읽는다 */
export interface RepoDeliverFacts {
  path: string
  /** 기준 커밋 뒤의 커밋이 있다(커밋 안 된 변경을 커밋하고 진행하면 생기는 것도 센다) */
  commits: boolean
  /** [push]·[PR 생성]을 쓸 수 있는지 (점검, D477) */
  push: { enabled: boolean; reason: string | null }
  pr: { enabled: boolean; reason: string | null }
}

/** 묶음 Work의 전달 계획 (D477~D479). 서브모듈은 화면의 차례대로, 메인은 마지막이다 */
export interface BundlePlan {
  /** 메인의 전달. 보내지 않으면 null */
  main: DeliveryChoice | null
  repos: { path: string; choice: DeliveryChoice }[]
  /** 메인이 새 커밋을 가리키게 할 서브모듈 */
  link: string[]
}

/**
 * Work 완료 화면에서 고른 레포별 전달을 확인한다 (D477, D478). 커밋이 없는 레포는 보낼 것이 없다. 버튼이 꺼진 전달은
 * 받지 않는다. 메인이 새 커밋을 가리키게 하는 것은 메인과 그 서브모듈을 함께 보낼 때만이다. 모두 보내지 않으면 [완료만]이라
 * 여기서 받지 않는다
 */
export function bundlePlan(
  picks: readonly RepoPick[],
  facts: readonly RepoDeliverFacts[],
  labels: Readonly<Record<string, string>>,
): { ok: true; plan: BundlePlan } | { ok: false; error: string } {
  const byPath = new Map(facts.map((f) => [f.path, f]))
  let main: DeliveryChoice | null = null
  const repos: BundlePlan['repos'] = []
  const linked: string[] = []
  for (const p of picks) {
    const f = byPath.get(p.path)
    const name = labels[p.path] ?? p.path
    if (!f) return { ok: false, error: `${name}: 이 Work의 레포가 아님` }
    if (p.choice === null) continue
    if (!f.commits) return { ok: false, error: `${name}: 보낼 커밋이 없음` }
    const button = f[p.choice]
    if (!button.enabled) {
      return {
        ok: false,
        error: `${name}: [${p.choice === 'pr' ? 'PR 생성' : 'push'}]을 쓸 수 없음: ${button.reason ?? ''}`,
      }
    }
    if (p.path === '') main = p.choice
    else {
      repos.push({ path: p.path, choice: p.choice })
      if (p.link) linked.push(p.path)
    }
  }
  if (main === null && repos.length === 0) {
    return { ok: false, error: '보낼 레포를 고르세요. 모두 보내지 않으려면 [완료만]을 누르세요' }
  }
  return { ok: true, plan: { main, repos, link: main === null ? [] : linked } }
}

/** 레포마다 커밋 안 된 변경의 처리 (D475). expect는 사람에게 보인 그 레포의 변경 목록이다 */
export interface RepoUncommitted {
  path: string
  action: UncommittedAction
  expect: string[]
}

/** verify가 쓰는 서브모듈의 PR 초안 파일 (D476): task 디렉터리 안의 `pr/<서브모듈 경로>.md`. 메인은 pr.md다 */
export function repoDraftFile(path: string): string {
  return `pr/${path}.md`
}

/**
 * 메인 PR 본문 끝의 함께 머지할 PR (D479): 이번 전달로 만든 서브모듈 PR과, 메인이 그 새 커밋을 가리키면 그 PR을 먼저
 * 머지해야 한다는 것. 없으면 본문 그대로다
 */
export function withLinkedPrs(
  body: string,
  prs: readonly { path: string; url: string; linked: boolean }[],
): string {
  if (prs.length === 0) return body
  const lines = prs.map(
    (p) => `- \`${p.path}\`: ${p.url}${p.linked ? ' (이 PR보다 먼저 머지)' : ''}`,
  )
  return `${body.trimEnd()}\n\n## 함께 머지할 PR\n\n${lines.join('\n')}`
}

/** 서브모듈 PR 본문 끝의 이슈 링크 (D479). Closes는 메인 PR에만 붙인다 */
export function withIssueRef(body: string, ref: string): string {
  return `${body.trimEnd()}\n\n관련 이슈: ${ref}`
}

// ---------- PR 카드 (D480, D481) ----------

/** task의 PR 카드: PR 대응 task면 그 라운드의 레포, 아니면 메인('')이다 (D480) */
export function laneOf(task: Pick<TaskRecord, 'respond'>): string {
  return task.respond?.repo ?? ''
}

/**
 * 서브모듈 PR 카드의 렌즈 (D480, I174): 그 레포의 PR, 기준 브랜치·커밋, 머지 대상, 전달을 Work의 메인 자리에 둔 모양이다.
 * PR 진행의 판정과 전이(core/pr, core/respond, machine)가 메인 PR과 같은 코드로 그 카드를 다룬다. lens에 레포를 적는다.
 * 메인('')이면 그대로다
 */
export function focusLane(work: WorkState, lane: string): WorkState {
  if (!lane) return work
  const r = work.repos?.find((x) => x.path === lane)
  const rest: WorkState = { ...work }
  delete rest.pr
  delete rest.target_branch
  delete rest.delivery
  if (!r) return { ...rest, lens: lane }
  return {
    ...rest,
    base_branch: r.base_branch,
    base_commit: r.base_commit,
    ...(r.target_branch ? { target_branch: r.target_branch } : {}),
    ...(r.pr ? { pr: r.pr } : {}),
    ...(r.delivery ? { delivery: r.delivery } : {}),
    lens: lane,
  }
}

/**
 * 렌즈로 바꾼 Work를 되돌린다 (I174): 그 레포 자리의 PR, 기준 커밋, 머지 대상, 전달을 그 레포에 적고, 메인 자리는 원래
 * Work의 것으로 되돌린다. 그 밖(상태, task, 진행 중 작업, 설정)은 바꾼 것을 쓴다
 */
export function unfocusLane(orig: WorkState, focused: WorkState, lane: string): WorkState {
  if (!lane) return focused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pr, base_commit, target_branch, delivery, lens, base_branch, ...rest } = focused
  const next: WorkState = {
    ...rest,
    base_branch: orig.base_branch,
    base_commit: orig.base_commit,
    ...(orig.target_branch ? { target_branch: orig.target_branch } : {}),
    ...(orig.pr ? { pr: orig.pr } : {}),
    ...(orig.delivery ? { delivery: orig.delivery } : {}),
  }
  next.repos = (orig.repos ?? []).map((r) => {
    if (r.path !== lane) return r
    const out: WorkRepo = { ...r, base_commit }
    delete out.target_branch
    delete out.pr
    delete out.delivery
    return {
      ...out,
      ...(target_branch && target_branch !== r.base_branch ? { target_branch } : {}),
      ...(pr ? { pr } : {}),
      ...(delivery ? { delivery } : {}),
    }
  })
  return next
}

/** PR 카드: 메인 PR이 있으면 맨 앞이고 PR을 만든 서브모듈이 뒤다 (D480) */
export function prCards(
  work: Pick<WorkState, 'pr' | 'repos'>,
): { lane: string; pr: PullRequestRecord }[] {
  return [
    ...(work.pr ? [{ lane: '', pr: work.pr }] : []),
    ...(work.repos ?? []).flatMap((r) => (r.pr ? [{ lane: r.path, pr: r.pr }] : [])),
  ]
}

/** 카드가 끝났다: 머지했거나 [머지 없이 끝내기]를 눌렀다 */
export function cardDone(pr: PullRequestRecord): boolean {
  return pr.merged !== undefined || pr.ended_at !== undefined
}

/**
 * 메인 PR의 [머지]를 막는 서브모듈 (D481): 메인이 새 커밋을 가리키게 한 서브모듈 가운데 PR이 머지되지 않은 것. 머지하지 않고
 * 끝낸 PR도 막는다(그 커밋이 머지 대상에 없다)
 */
export function linkWaiting(work: Pick<WorkState, 'repos'>): string[] {
  return (work.repos ?? []).filter((r) => r.linked && r.pr && !r.pr.merged).map((r) => r.path)
}

/** 메인 PR의 [머지]를 막는 까닭 (D481) */
export function linkWaitingReason(path: string): string {
  return `서브모듈 ${path}의 PR이 먼저 머지되어야 함 (메인이 그 새 커밋을 가리킴, D481)`
}

/** [서브모듈 커밋 맞추기]의 커밋 메시지 (D481) */
export function relinkMessage(
  workId: string,
  links: readonly { path: string; sha: string }[],
): string {
  const what = links.map((l) => `${l.path} 서브모듈을 머지된 ${l.sha.slice(0, 8)}로`).join(', ')
  return `relay(${workId}): ${what}`
}

/** 메인 PR의 [머지]를 막는 까닭: 메인이 머지된 서브모듈 커밋을 가리키지 않는다 (D481) */
export function relinkReason(path: string): string {
  return `메인이 서브모듈 ${path}의 머지된 커밋을 가리키지 않음: [서브모듈 커밋 맞추기]를 누르세요 (D481)`
}
