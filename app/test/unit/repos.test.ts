// [단위] 묶음 Work (D470~D483): core/repos의 규칙, 상태 기계의 레포별 전달·[레포 추가]·정리, 정리 요약, context.md의 레포
// 절, 승인 화면의 묶음 Work 사실과 서브모듈 [변경]의 범위.
import { describe, expect, it } from 'vitest'
import { cleanPreview, planClean, type CleanFacts } from '../../src/core/cleanup'
import { buildContext } from '../../src/core/context'
import { createWork, currentTask, transition, type MachineEvent } from '../../src/core/machine'
import { mergeGate } from '../../src/core/pr'
import {
  bundlePlan,
  focusLane,
  isBundle,
  linkWaiting,
  linkWaitingReason,
  prCards,
  relinkReason,
  relinkUncheckedReason,
  unfocusLane,
  linkMessage,
  mainEditable,
  repoDraftFile,
  repoLine,
  repoTarget,
  statusPath,
  withIssueRef,
  withLinkedPrs,
  withoutRepoPaths,
  type RepoDeliverFacts,
} from '../../src/core/repos'
import { emphasis, repoChangeRange } from '../../src/core/review'
import type { TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff } from '../../src/shared/contracts'
import type { WorkRepo, WorkState } from '../../src/shared/work'

let clock = 0
const at = () => `2026-10-24T10:${String(clock++ % 60).padStart(2, '0')}:00+09:00`

const LIB: WorkRepo = { path: 'lib', name: 'lib', base_branch: 'main', base_commit: 'lib0001' }
const UI: WorkRepo = {
  path: 'pkg/ui',
  name: 'ui',
  base_branch: 'develop',
  base_commit: 'ui0001',
  target_branch: 'release',
}

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

const VALID: TaskCheck = {
  handoff_present: true,
  status: 'awaiting_approval',
  errors: [],
  warnings: [],
  handoff: HANDOFF,
  handoffHeader: HANDOFF,
}

const MANUAL: AppConfig = {
  ...DEFAULT_CONFIG,
  auto_approve: {
    fix: false,
    design: false,
    implement: false,
    refactor: false,
    spec: false,
    execute: false,
    respond: false,
  },
}

const apply = (work: WorkState, e: MachineEvent) => transition(work, e, MANUAL)

function bundleWork(opts: { mainFixed?: boolean; repos?: WorkRepo[] } = {}): WorkState {
  return createWork({
    type: 'bugfix',
    workId: 'w-20261024-001',
    baseBranch: 'main',
    baseCommit: 'main0001',
    branch: 'relay/w-20261024-001-aaaa',
    repos: opts.repos ?? [LIB],
    ...(opts.mainFixed ? { mainFixed: true } : {}),
    at: at(),
  }).work
}

/** task를 띄우고 승인 대기로 둔다. 묶음 Work의 서브모듈 시작 커밋을 함께 알린다 */
function launchAndStop(work: WorkState, starts: Record<string, string>): WorkState {
  const task = currentTask(work)
  if (!task) throw new Error('task 없음')
  let w = apply(work, {
    type: 'session.started',
    taskId: task.id,
    at: at(),
    sessionId: `s-${task.id}`,
    pid: 100 + task.seq,
    startCommit: `start-${task.id}`,
    repoStarts: starts,
    skillHash: 'h',
  }).work
  w = apply(w, {
    type: 'Stop',
    taskId: task.id,
    at: at(),
    stopHookActive: false,
    handoffChanged: true,
    check: VALID,
  }).work
  return w
}

/** intake, fix를 승인하고 verify가 승인 대기인 묶음 Work */
function atVerify(opts: { mainFixed?: boolean; repos?: WorkRepo[] } = {}): WorkState {
  let w = bundleWork(opts)
  for (const n of [1, 2]) {
    w = launchAndStop(w, { lib: `lib-start-${n}` })
    const task = currentTask(w)
    w = apply(w, { type: 'approve', taskId: task?.id ?? '', at: at(), check: VALID }).work
  }
  return launchAndStop(w, { lib: 'lib-start-3' })
}

describe('core/repos (D470~D479)', () => {
  it('묶음 Work와 메인을 고치는지 가린다', () => {
    expect(isBundle({})).toBe(false)
    expect(isBundle({ repos: [] })).toBe(false)
    expect(isBundle({ repos: [LIB] })).toBe(true)
    expect(isBundle({ main_fixed: true })).toBe(true)
    expect(mainEditable({})).toBe(true)
    expect(mainEditable({ main_fixed: true })).toBe(false)
    expect(repoTarget(LIB)).toBe('main')
    expect(repoTarget(UI)).toBe('release')
    expect(repoDraftFile('pkg/ui')).toBe('pr/pkg/ui.md')
  })

  it('메인의 커밋 안 된 변경에서 고른 서브모듈의 자리만 뺀다 (D475)', () => {
    const lines = [' M lib', ' M README.md', 'R  old.txt -> lib2', ' M "pkg/ui"', '?? libx/a.txt']
    expect(withoutRepoPaths(lines, ['lib', 'pkg/ui'])).toEqual([
      ' M README.md',
      'R  old.txt -> lib2',
      '?? libx/a.txt',
    ])
    expect(withoutRepoPaths(lines, [])).toEqual(lines)
    expect(statusPath(' M lib/')).toBe('lib')
    expect(repoLine('lib', '?? a.txt')).toBe('lib: ?? a.txt')
  })

  it('메인이 새 커밋을 가리키게 하는 커밋 메시지와 PR 본문 끝 (D478, D479)', () => {
    expect(
      linkMessage('w-1', [
        { path: 'lib', sha: '0123456789abcdef' },
        { path: 'pkg/ui', sha: 'fedcba9876543210' },
      ]),
    ).toBe('relay(w-1): lib 서브모듈을 01234567로, pkg/ui 서브모듈을 fedcba98로')
    expect(withLinkedPrs('본문\n', [])).toBe('본문\n')
    expect(
      withLinkedPrs('본문\n\n', [
        { path: 'lib', url: 'https://github.com/o/lib/pull/3', linked: true },
        { path: 'pkg/ui', url: 'https://github.com/o/ui/pull/4', linked: false },
      ]),
    ).toBe(
      '본문\n\n## 함께 머지할 PR\n\n- `lib`: https://github.com/o/lib/pull/3 (이 PR보다 먼저 머지)\n- `pkg/ui`: https://github.com/o/ui/pull/4',
    )
    expect(withIssueRef('본문\n', 'o/app#12')).toBe('본문\n\n관련 이슈: o/app#12')
  })

  it('고른 전달을 확인한다: 커밋이 없거나 버튼이 꺼진 레포는 보내지 않고, 메인을 보낼 때만 가리키게 한다 (D477, D478)', () => {
    const on = { enabled: true, reason: null }
    const facts: RepoDeliverFacts[] = [
      { path: '', commits: true, push: on, pr: { enabled: false, reason: 'gh 없음' } },
      { path: 'lib', commits: true, push: on, pr: on },
      { path: 'pkg/ui', commits: false, push: on, pr: on },
    ]
    const labels = { '': 'app (메인)', lib: 'lib', 'pkg/ui': 'pkg/ui' }
    expect(
      bundlePlan(
        [
          { path: '', choice: 'push' },
          { path: 'lib', choice: 'pr', link: true },
          { path: 'pkg/ui', choice: null },
        ],
        facts,
        labels,
      ),
    ).toEqual({
      ok: true,
      plan: { main: 'push', repos: [{ path: 'lib', choice: 'pr' }], link: ['lib'] },
    })
    // 메인을 보내지 않으면 가리키게 하지 않는다
    expect(
      bundlePlan(
        [
          { path: '', choice: null },
          { path: 'lib', choice: 'push', link: true },
        ],
        facts,
        labels,
      ),
    ).toEqual({
      ok: true,
      plan: { main: null, repos: [{ path: 'lib', choice: 'push' }], link: [] },
    })
    expect(bundlePlan([{ path: '', choice: 'pr' }], facts, labels)).toEqual({
      ok: false,
      error: 'app (메인): [PR 생성]을 쓸 수 없음: gh 없음',
    })
    expect(bundlePlan([{ path: 'pkg/ui', choice: 'push' }], facts, labels)).toEqual({
      ok: false,
      error: 'pkg/ui: 보낼 커밋이 없음',
    })
    expect(bundlePlan([{ path: 'x', choice: 'push' }], facts, labels)).toEqual({
      ok: false,
      error: 'x: 이 Work의 레포가 아님',
    })
    expect(bundlePlan([{ path: '', choice: null }], facts, labels)).toMatchObject({ ok: false })
    // 메인을 고르지 않은 Work는 메인의 사실이 없지만 화면은 메인 줄을 보내지 않음으로 함께 보낸다 (D471)
    expect(
      bundlePlan(
        [
          { path: '', choice: null },
          { path: 'lib', choice: 'pr' },
        ],
        facts.slice(1),
        labels,
      ),
    ).toEqual({ ok: true, plan: { main: null, repos: [{ path: 'lib', choice: 'pr' }], link: [] } })
  })
})

describe('상태 기계의 묶음 Work (D470~D482)', () => {
  it('만들 때 고른 서브모듈과 메인을 고치는지를 적고 work.created에 남긴다', () => {
    const r = createWork({
      type: 'bugfix',
      workId: 'w-1',
      baseBranch: 'main',
      baseCommit: 'm1',
      repos: [LIB, UI],
      mainFixed: true,
      at: at(),
    })
    expect(r.work).toMatchObject({ repos: [LIB, UI], main_fixed: true })
    const created = r.effects.find((e) => e.type === 'log')
    expect(created?.type === 'log' && created.event.payload).toMatchObject({
      repos: [
        { path: 'lib', base_branch: 'main', base_commit: 'lib0001' },
        { path: 'pkg/ui', base_branch: 'develop', base_commit: 'ui0001', target_branch: 'release' },
      ],
      main_fixed: true,
    })
    // 메인만 고치는 Work에는 없다
    const plain = createWork({
      type: 'bugfix',
      workId: 'w-2',
      baseBranch: 'main',
      baseCommit: 'm',
      at: at(),
    })
    expect(plain.work.repos).toBeUndefined()
    expect(plain.work.main_fixed).toBeUndefined()
  })

  it('task를 시작할 때 서브모듈마다 시작 커밋을 적고, [변경]은 다음 task의 시작까지다 (D475)', () => {
    const w = atVerify()
    expect(w.tasks.map((t) => t.repo_starts)).toEqual([
      { lib: 'lib-start-1' },
      { lib: 'lib-start-2' },
      { lib: 'lib-start-3' },
    ])
    expect(repoChangeRange(w, 't-02', 'lib')).toEqual({ from: 'lib-start-2', to: 'lib-start-3' })
    expect(repoChangeRange(w, 't-03', 'lib')).toEqual({ from: 'lib-start-3', to: null })
    expect(repoChangeRange(w, 't-03', 'pkg/ui')).toBeNull()
    const archived: WorkState = {
      ...w,
      status: 'archived',
      cleaned: {
        at: at(),
        head: 'h',
        forced: false,
        deleted_branches: [],
        repos: { lib: { head: 'lib-end', deleted_branches: [] } },
      },
    }
    expect(repoChangeRange(archived, 't-03', 'lib')).toEqual({ from: 'lib-start-3', to: 'lib-end' })
  })

  it('레포별 전달은 진행 중 작업에 서브모듈 차례를 적고, 서브모듈이 끝날 때마다 그 기록을 남긴다 (D479)', () => {
    const w = atVerify()
    const r = apply(w, {
      type: 'deliver',
      at: at(),
      choice: 'push',
      uncommitted: 'commit',
      check: VALID,
      bundle: {
        main: 'push',
        repos: [{ path: 'lib', choice: 'pr', uncommitted: 'discard' }],
        link: ['lib'],
      },
    })
    expect(r.rejected).toBeUndefined()
    expect(r.work.operation).toMatchObject({
      kind: 'deliver',
      choice: 'push',
      uncommitted: 'commit',
      stage: 'prepare',
      repos: [
        { path: 'lib', choice: 'pr', uncommitted: 'discard', base: 'main', stage: 'prepare' },
      ],
      link: ['lib'],
    })
    expect(r.effects.find((e) => e.type === 'deliver')).toMatchObject({ bundle: true })
    // lib: stash를 적고 PR 단계를 거쳐 끝난다
    let x = apply(r.work, {
      type: 'delivery.repo',
      at: at(),
      path: 'lib',
      stage: 'push',
      stash: 'st1',
    }).work
    x = apply(x, { type: 'delivery.repo', at: at(), path: 'lib', stage: 'pr' }).work
    x = apply(x, {
      type: 'delivery.repo',
      at: at(),
      path: 'lib',
      stage: 'done',
      compareUrl: null,
      prUrl: 'https://github.com/o/lib/pull/7',
      draft: false,
      pr: { number: 7, head: 'libhead', ghVersion: '2.60.0' },
    }).work
    expect(x.repos?.[0]).toMatchObject({
      delivery: {
        choice: 'pr',
        status: 'succeeded',
        branch: 'relay/w-20261024-001-aaaa',
        pr_url: 'https://github.com/o/lib/pull/7',
        stashes: ['st1'],
      },
      pr: {
        number: 7,
        url: 'https://github.com/o/lib/pull/7',
        head: 'libhead',
        gh_version: '2.60.0',
      },
    })
    x = apply(x, { type: 'delivery.linked', at: at(), commit: 'link1' }).work
    expect(x.operation).toMatchObject({ link_commit: 'link1' })
    // 메인은 push만 했지만 서브모듈 PR이 있어 PR 진행이다 (D480)
    const done = apply(x, { type: 'delivery.succeeded', at: at(), compareUrl: null, check: VALID })
    expect(done.work).toMatchObject({
      status: 'pr',
      delivery: { choice: 'push', status: 'succeeded' },
    })
    expect(done.work.operation).toBeUndefined()
    expect(done.work.tasks.at(-1)?.status).toBe('approved')
  })

  it('[다시 시도]에서 앞 시도에 PR을 만든 서브모듈을 빼도 그 PR이 열려 있으면 PR 진행이다 (D480)', () => {
    const w = atVerify()
    const withPr: WorkState = {
      ...w,
      repos: (w.repos ?? []).map((r) => ({
        ...r,
        pr: {
          number: 7,
          url: 'https://github.com/o/lib/pull/7',
          head: 'h',
          gh_version: '2.60.0',
          started_at: at(),
        },
      })),
    }
    const pushing = apply(withPr, {
      type: 'deliver',
      at: at(),
      choice: 'push',
      uncommitted: null,
      check: VALID,
      bundle: { main: 'push', repos: [], link: [] },
    }).work
    const done = apply(pushing, {
      type: 'delivery.succeeded',
      at: at(),
      compareUrl: null,
      check: VALID,
    }).work
    expect(done.status).toBe('pr')
  })

  it('끊긴 레포별 전달은 하던 서브모듈의 stash를 그 레포의 전달 기록에 남긴다 (D479, D123)', () => {
    const w = atVerify({ repos: [LIB, UI] })
    const started = apply(w, {
      type: 'deliver',
      at: at(),
      choice: 'push',
      uncommitted: null,
      check: VALID,
      bundle: {
        main: 'push',
        repos: [
          { path: 'lib', choice: 'push', uncommitted: 'discard' },
          { path: 'pkg/ui', choice: 'push', uncommitted: null },
        ],
        link: [],
      },
    }).work
    const pushing = apply(started, {
      type: 'delivery.repo',
      at: at(),
      path: 'lib',
      stage: 'push',
      stash: 'st1',
    }).work
    // 앱이 꺼져 끊긴 기록이다 (D123)
    const interrupted: WorkState = {
      ...pushing,
      ...(pushing.operation ? { operation: { ...pushing.operation, interrupted_at: at() } } : {}),
    }
    const cut = apply(interrupted, { type: 'operationIgnore', at: at() }).work
    expect(cut.operation).toBeUndefined()
    expect(cut.repos?.find((r) => r.path === 'lib')?.delivery).toMatchObject({
      status: 'failed',
      stage: 'push',
      stashes: ['st1'],
    })
    // 시작하지 않은 서브모듈은 기록이 없다
    expect(cut.repos?.find((r) => r.path === 'pkg/ui')?.delivery).toBeUndefined()
  })

  it('메인을 보내지 않으면 메인의 전달 기록 없이 완료하고, 서브모듈 실패는 그 레포에 남긴다 (D477, D479)', () => {
    const w = atVerify({ mainFixed: true })
    const start = (choice: 'push' | 'pr') =>
      apply(w, {
        type: 'deliver',
        at: at(),
        choice,
        uncommitted: null,
        check: VALID,
        bundle: { main: null, repos: [{ path: 'lib', choice, uncommitted: null }], link: ['lib'] },
      }).work
    const pushing = start('push')
    expect(pushing.operation).toMatchObject({
      skip_main: true,
      repos: [{ path: 'lib', stage: 'push' }],
    })
    expect(pushing.operation?.kind === 'deliver' && pushing.operation.link).toBeUndefined()
    const failed = apply(pushing, {
      type: 'delivery.failed',
      at: at(),
      path: 'lib',
      error: 'push 거절',
    }).work
    expect(failed.operation).toBeUndefined()
    expect(failed.delivery).toBeUndefined()
    expect(failed.repos?.[0]?.delivery).toMatchObject({
      status: 'failed',
      stage: 'push',
      error: 'push 거절',
    })
    expect(failed.status).toBe('active')

    let ok = apply(start('push'), {
      type: 'delivery.repo',
      at: at(),
      path: 'lib',
      stage: 'done',
      compareUrl: 'u',
    }).work
    ok = apply(ok, { type: 'delivery.succeeded', at: at(), compareUrl: null, check: VALID }).work
    expect(ok.status).toBe('completed')
    expect(ok.delivery).toBeUndefined()
    expect(ok.repos?.[0]?.delivery).toMatchObject({
      choice: 'push',
      status: 'succeeded',
      compare_url: 'u',
    })
  })

  it('[레포 추가]는 진행 중이거나 멈춘 Work에 서브모듈을 더한다 (D473)', () => {
    const plain = createWork({
      type: 'bugfix',
      workId: 'w-3',
      baseBranch: 'main',
      baseCommit: 'm',
      at: at(),
    }).work
    const r = apply(plain, { type: 'repo.added', at: '2026-10-24T11:00:00+09:00', added: LIB })
    expect(r.work.repos).toEqual([{ ...LIB, added_at: '2026-10-24T11:00:00+09:00' }])
    expect(r.effects.map((e) => (e.type === 'log' ? e.event.type : e.type))).toEqual([
      'work.repo_added',
    ])
    expect(apply(r.work, { type: 'repo.added', at: at(), added: LIB }).rejected).toBe(
      '이미 고른 레포임',
    )
    expect(
      apply({ ...plain, status: 'completed' }, { type: 'repo.added', at: at(), added: LIB })
        .rejected,
    ).toBe('진행 중이거나 멈춘 Work에만 레포를 더함')
  })

  it('정리는 서브모듈마다 지울 것을 기록하고 끝나면 레포마다 결과를 남긴다 (D482)', () => {
    const done: WorkState = { ...bundleWork(), status: 'completed' }
    const steps = [
      { path: 'lib', force: true, delete_branches: ['b'], delete_remote: 'b', head: 'libhead' },
    ]
    const r = apply(done, {
      type: 'clean',
      at: at(),
      force: false,
      deleteBranches: [],
      head: 'mainhead',
      repos: steps,
    })
    expect(r.work.operation).toMatchObject({ kind: 'clean', repos: steps })
    expect(r.effects[0]).toMatchObject({ type: 'clean', repos: steps })
    let x = apply(r.work, { type: 'clean.removed', at: at() }).work
    // 메인에 지울 원격 브랜치가 없어도 서브모듈에 있으면 원격 단계로 간다
    x = apply(x, { type: 'clean.branchesDeleted', at: at() }).work
    expect(x.operation).toMatchObject({ stage: 'remote' })
    x = apply(x, { type: 'clean.done', at: at() }).work
    expect(x.cleaned?.repos).toEqual({
      lib: { head: 'libhead', deleted_branches: ['b'], deleted_remote_branch: 'b' },
    })
  })
})

describe('정리 요약의 서브모듈 (D482)', () => {
  const facts = (repo: Partial<NonNullable<CleanFacts['repos']>[number]> = {}): CleanFacts => ({
    worktree: true,
    uncommitted: [],
    locks: [],
    submodules: [],
    live: 0,
    branch: { name: 'b', exists: true, pushed: true, merged: false, lost: null },
    backups: [],
    merged: false,
    remote: null,
    repos: [
      {
        path: 'lib',
        worktree: true,
        uncommitted: [],
        locks: [],
        branch: { name: 'b', exists: true, pushed: false, merged: false, lost: null },
        merged: false,
        remote: null,
        pointed: false,
        ...repo,
      },
    ],
  })

  it('서브모듈의 커밋 안 된 변경은 확인받고, 브랜치는 push됐을 때만 지운다', () => {
    const p = cleanPreview(facts({ uncommitted: ['?? a.txt'] }))
    expect(p.confirm).toEqual(['lib: 커밋 안 된 변경 1개를 백업 없이 지웁니다'])
    expect(p.repos?.[0]?.branch.deletable).toBe(false)
    expect(p.expect.repos).toEqual([
      { path: 'lib', uncommitted: ['?? a.txt'], locks: [], remote: false, lost: [] },
    ])
    const base = { deleteBranch: false, deleteBackups: false, confirmed: true, expect: p.expect }
    expect(planClean(p, { ...base, repos: [{ path: 'lib', deleteBranch: true }] })).toEqual({
      ok: false,
      error: 'lib: 작업 브랜치는 push됐거나 머지됐을 때만 지움',
    })
    expect(planClean(p, base)).toMatchObject({
      ok: true,
      repos: [{ path: 'lib', force: true, delete_branches: [] }],
    })
    // 확인한 뒤 서브모듈이 바뀌면 받지 않는다
    const changed = cleanPreview(facts({ uncommitted: ['?? b.txt'] }))
    expect(planClean(changed, base)).toMatchObject({ ok: false })
  })

  it('머지로 끝난 서브모듈 PR의 원격 브랜치를 고를 수 있고, 메인 PR이 가리키면 알린다', () => {
    const p = cleanPreview(
      facts({
        branch: { name: 'b', exists: true, pushed: true, merged: false, lost: [] },
        merged: true,
        remote: { name: 'b', exists: true },
        pointed: true,
      }),
    )
    expect(p.repos?.[0]).toMatchObject({ pointed: true, remote: { name: 'b', exists: true } })
    expect(
      planClean(p, {
        deleteBranch: false,
        deleteBackups: false,
        confirmed: true,
        expect: p.expect,
        repos: [{ path: 'lib', deleteBranch: true, deleteRemote: true }],
      }),
    ).toMatchObject({
      ok: true,
      repos: [{ path: 'lib', delete_branches: ['b'], delete_remote: 'b' }],
    })
  })
})

describe('context.md의 레포 절 (D474)', () => {
  const input = (bundle: Parameters<typeof buildContext>[0]['bundle']) => {
    const work = bundleWork()
    const task = currentTask(work)
    if (!task) throw new Error('task 없음')
    return buildContext({
      work,
      task,
      config: DEFAULT_CONFIG,
      taskDir: '/t',
      draftsDir: '/d',
      projectId: 'p',
      request: { path: '/r', text: '요청' },
      intent: null,
      decisionLog: '',
      rejected: [],
      previousHandoff: null,
      artifacts: [],
      submodules: ['lib', 'vendor'],
      bundle,
    })
  }

  it('묶음 Work는 서브모듈 절 대신 레포 절이다: 폴더, 레포마다 커밋, gitlink는 앱이 맞춤, 고르지 않은 서브모듈', () => {
    const ctx = input({
      main: 'app',
      mainEditable: true,
      root: '/w',
      repos: [{ path: 'lib', baseBranch: 'main', baseCommit: 'lib0001', draft: 'pr/lib.md' }],
      others: ['vendor'],
      mainDraft: 'pr.md',
    })
    expect(ctx).toContain('## 레포')
    expect(ctx).not.toContain('## 서브모듈\n')
    expect(ctx).toContain('- 메인 레포 `app`: 지금 폴더 `/w`. 고친다. PR 초안: `pr.md`.')
    expect(ctx).toContain(
      '- 서브모듈 `lib`: 폴더 `lib/`. 고친다. 기준 브랜치 main, 기준 커밋 lib0001. PR 초안: `pr/lib.md`.',
    )
    expect(ctx).toContain(
      '메인 레포에 고른 서브모듈(`lib`)의 자리(가리키는 커밋)를 커밋하지 않는다',
    )
    expect(ctx).toContain('`git -C lib commit`')
    expect(ctx).toContain('고르지 않은 서브모듈: `vendor`.')
    expect(ctx).toContain('사람이 [레포 추가]로 더하면 그때 고친다')
  })

  it('메인을 고르지 않으면 메인을 고치지 말라고 하고, 묶음 Work가 아니면 서브모듈 절이다', () => {
    const fixed = input({ main: 'app', mainEditable: false, root: '/w', repos: [], others: [] })
    expect(fixed).toContain('고치지 않는다: 기준 커밋에 분리된 HEAD로 고정했다')
    expect(fixed).toContain('메인 레포의 파일은 고치지 않고, 메인 레포에서 커밋하지 않는다')
    expect(fixed).not.toContain('고르지 않은 서브모듈')
    expect(input(null)).toContain('## 서브모듈\n')
  })
})

describe('승인 화면의 묶음 Work 사실 (D471, D475)', () => {
  it('작업 브랜치에서 벗어난 서브모듈과 메인을 고르지 않은 Work의 메인 쪽 변경을 알린다', () => {
    const shown = emphasis({
      node: 'fix',
      type: 'bugfix',
      handoff: HANDOFF,
      errors: [],
      uncommitted: [],
      bundle: {
        mainChanges: [' M README.md'],
        offBranch: [{ path: 'lib', branch: null }],
        workBranch: 'relay/w',
        repaired: false,
      },
    })
    expect(shown.map((e) => e.kind)).toEqual(['submodule_guard', 'main_changes'])
    expect(shown[0]?.lines[0]).toContain(
      'lib: 작업 브랜치 relay/w에 있지 않습니다 (지금: 분리된 HEAD)',
    )
    expect(shown[1]?.lines).toEqual([' M README.md'])
  })
})

describe('PR 카드의 렌즈 (D480, D481, I174)', () => {
  const PR = (n: number) => ({
    number: n,
    url: `https://github.com/o/r${n}/pull/${n}`,
    head: `h${n}`,
    gh_version: null,
    started_at: at(),
  })
  /** 메인 PR과 lib PR이 있는 PR 진행 Work. lib는 메인이 가리킨다 */
  function prWork(): WorkState {
    const w = atVerify()
    return {
      ...w,
      status: 'pr',
      tasks: w.tasks.map((t) => ({ ...t, status: 'approved' as const })),
      pr: PR(1),
      repos: [{ ...LIB, target_branch: 'release', pr: PR(2), linked: true }],
    }
  }

  it('렌즈는 그 레포를 메인 자리에 두고, 되돌리면 그 레포에 적고 메인은 그대로다', () => {
    const w = prWork()
    const f = focusLane(w, 'lib')
    expect(f).toMatchObject({
      lens: 'lib',
      base_branch: 'main',
      base_commit: 'lib0001',
      target_branch: 'release',
      pr: { number: 2 },
    })
    expect(focusLane(w, '')).toBe(w)
    const changed = { ...f, base_commit: 'lib0002', pr: { ...PR(2), read_at: 'x' } }
    const back = unfocusLane(w, changed, 'lib')
    expect(back.lens).toBeUndefined()
    expect(back).toMatchObject({ base_commit: 'main0001', pr: { number: 1 } })
    expect(back.repos?.[0]).toMatchObject({
      base_commit: 'lib0002',
      target_branch: 'release',
      pr: { read_at: 'x' },
      linked: true,
    })
    expect(prCards(back).map((c) => c.lane)).toEqual(['', 'lib'])
  })

  it('서브모듈 카드의 이벤트는 그 PR에 적고, 카드 하나가 머지돼도 다른 카드가 남으면 PR 진행이다', () => {
    const w = prWork()
    const read = apply(w, {
      type: 'pr.read',
      at: at(),
      repo: 'lib',
      number: 2,
      state: 'OPEN',
      head: 'h2b',
      baseRef: 'release',
      received: [],
      notAccepted: [],
    })
    expect(read.work.repos?.[0]?.pr).toMatchObject({ head: 'h2b', read_at: expect.any(String) })
    expect(read.work.pr?.head).toBe('h1')
    const merged = apply(read.work, {
      type: 'pr.read',
      at: at(),
      repo: 'lib',
      number: 2,
      state: 'MERGED',
      head: 'h2b',
      baseRef: 'release',
      received: [],
      notAccepted: [],
    })
    expect(merged.work.status).toBe('pr')
    expect(merged.work.completed_at).toBeUndefined()
    expect(merged.work.repos?.[0]?.pr?.merged).toMatchObject({ outside: true })
    const logs = merged.effects.flatMap((e) => (e.type === 'log' ? [e.event.type] : []))
    expect(logs).toEqual(['pr.merged'])
    // 마지막 카드(메인)를 끝내면 완료다
    const ended = apply(merged.work, { type: 'pr.end', at: at() })
    expect(ended.work.status).toBe('completed')
    expect(ended.effects.flatMap((e) => (e.type === 'log' ? [e.event.type] : []))).toEqual([
      'work.completed',
    ])
  })

  it('끝난 카드는 다시 읽거나 머지하거나 대응하지 않는다 (D480)', () => {
    const w = prWork()
    const merged: WorkState = {
      ...w,
      pr: { ...PR(1), merged: { at: at(), head: 'h1', method: 'squash', outside: false } },
    }
    const reread = apply(merged, {
      type: 'pr.read',
      at: at(),
      number: 1,
      state: 'MERGED',
      head: 'h1',
      baseRef: 'main',
      received: [],
      notAccepted: [],
    })
    expect(reread.work).toBe(merged)
    expect(reread.effects).toEqual([])
    expect(apply(merged, { type: 'pr.end', at: at() }).rejected).toContain('이미 머지')
    expect(
      apply(merged, { type: 'pr.respond', at: at(), items: ['convo:1'], instruction: '' }).rejected,
    ).toContain('이미 머지')
    // lib 카드는 그대로 대응한다
    expect(
      apply(merged, { type: 'pr.respond', at: at(), repo: 'lib', items: ['c'], instruction: '' })
        .rejected,
    ).toBeUndefined()
  })

  it('이슈 기록은 마지막 카드가 끝날 때만 끝 코멘트와 닫기를 더한다 (D480, D346)', () => {
    const base = prWork()
    const w: WorkState = {
      ...base,
      issue: {
        linked: false,
        number: 5,
        url: 'https://github.com/o/r/issues/5',
        mark: 'w-20261024-001-ab',
        pending: [],
        posted: [{ key: 'body', at: at() }],
      },
    }
    const mainMerged = apply(w, {
      type: 'pr.read',
      at: at(),
      number: 1,
      state: 'MERGED',
      head: 'h1',
      baseRef: 'main',
      received: [],
      notAccepted: [],
    })
    expect(mainMerged.work.status).toBe('pr')
    expect(mainMerged.work.issue?.pending).toEqual([])
    expect(mainMerged.effects.some((e) => e.type === 'publishIssue')).toBe(false)
    const libEnded = apply(mainMerged.work, { type: 'pr.end', at: at(), repo: 'lib' })
    expect(libEnded.work.status).toBe('completed')
    expect(libEnded.work.issue?.pending.map((p) => p.kind)).toEqual(['end', 'close'])
  })

  it('서브모듈 카드의 [대응 시작]은 그 레포를 적고, 대응 task는 Work에 하나다', () => {
    const w = prWork()
    const r = apply(w, {
      type: 'pr.respond',
      at: at(),
      repo: 'lib',
      items: ['convo:1'],
      instruction: '',
    })
    expect(r.rejected).toBeUndefined()
    expect(r.work.tasks.at(-1)?.respond).toMatchObject({ repo: 'lib', round: 1 })
    // 메인 카드도 다른 카드도 대응을 시작하지 않는다
    expect(
      apply(r.work, { type: 'pr.respond', at: at(), items: ['convo:9'], instruction: '' }).rejected,
    ).toContain('끝나지 않은 PR 대응 task가 있음')
    // 메인 PR이 밖에서 머지돼도 lib 카드의 대응 task는 끝내지 않는다
    const mainMerged = apply(r.work, {
      type: 'pr.read',
      at: at(),
      number: 1,
      state: 'MERGED',
      head: 'h1',
      baseRef: 'main',
      received: [],
      notAccepted: [],
    })
    expect(mainMerged.work.status).toBe('pr')
    expect(mainMerged.work.tasks.at(-1)?.status).not.toBe('interrupted')
  })

  it('메인 PR의 [머지]는 가리키는 서브모듈의 PR이 머지되고 머지된 커밋을 가리켜야 켜진다 (D481)', () => {
    const w = prWork()
    expect(linkWaiting(w)).toEqual(['lib'])
    const read = {
      at: at(),
      state: 'OPEN' as const,
      head: 'h1',
      headRef: 'b',
      baseRef: 'main',
      isDraft: false,
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: null,
      checks: [],
      ci: 'pass' as const,
      sync: 'same' as const,
    }
    const gate = mergeGate({ work: w, read, items: [], localHead: 'h1' })
    expect(gate).toEqual({ enabled: false, reasons: [linkWaitingReason('lib')] })
    const done: WorkState = {
      ...w,
      repos: (w.repos ?? []).map((r) =>
        r.pr
          ? {
              ...r,
              pr: { ...r.pr, merged: { at: at(), head: 'h2', method: 'squash', outside: false } },
            }
          : r,
      ),
    }
    expect(mergeGate({ work: done, read, items: [], localHead: 'h1' }).enabled).toBe(true)
    expect(mergeGate({ work: done, read, items: [], localHead: 'h1', relink: ['lib'] })).toEqual({
      enabled: false,
      reasons: [relinkReason('lib')],
    })
    // 막 머지돼 메인 PR을 읽을 때 아직 확인하지 않았으면 확인할 때까지 막는다
    expect(mergeGate({ work: done, read, items: [], localHead: 'h1', relinkChecked: [] })).toEqual({
      enabled: false,
      reasons: [relinkUncheckedReason('lib')],
    })
    expect(
      mergeGate({ work: done, read, items: [], localHead: 'h1', relinkChecked: ['lib'] }).enabled,
    ).toBe(true)
    // 서브모듈 카드에는 이 조건이 없다
    expect(
      mergeGate({
        work: focusLane(w, 'lib'),
        read: { ...read, head: 'h2' },
        items: [],
        localHead: 'h2',
      }).enabled,
    ).toBe(true)
  })
})
