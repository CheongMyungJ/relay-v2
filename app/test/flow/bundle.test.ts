// [흐름] 묶음 Work (D470~D483). 메인 레포와 고른 서브모듈을 한 Work에서 함께 고친다. 고른 서브모듈은 메인 worktree 안의
// 그 자리에 서브모듈 레포의 worktree로 있고, 레포마다 따로 커밋하고 전달한다. 메인이 가리키는 서브모듈 커밋은 앱이 전달 때
// 맞춘다. 정리는 서브모듈 worktree를 먼저 지운다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import { linkWaitingReason, relinkReason } from '../../src/core/repos'
import type { WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import {
  addSubmodule,
  git,
  harness,
  makeRepo,
  register,
  settle,
  writeFiles,
  type Harness,
  workBranchOf,
} from '../support/harness'
import { FakeGitHub } from '../support/github'
import { REQUEST, scenario, steps, type Scenario, type Step } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 로컬 경로의 서브모듈을 받게 한다 (git 2.38.1부터 file 전송은 기본으로 막힘). 앱의 보호는 이 뒤에 붙는다 */
const FILE_ENV = {
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'protocol.file.allow',
  GIT_CONFIG_VALUE_0: 'always',
}

const LIB_PR = '# lib: 평균 함수의 빈 배열\n\n## 요약\n\nlib 쪽 변경\n'

interface Setup {
  h: Harness
  checkout: string
  mainId: string
  libSource: string
  mainRemote: string
}

async function setup(s: Scenario): Promise<Setup> {
  h = await harness({ scenario: s, env: FILE_ENV })
  const hh = h
  const { repo, remote } = makeRepo(hh.root, 'app', { 'README.md': '# app\n' })
  const libSource = path.join(hh.root, 'lib-src')
  addSubmodule(repo, libSource, 'lib', { 'lib.txt': 'lib\n' })
  addSubmodule(repo, path.join(hh.root, 'vendor-src'), 'vendor', { 'v.txt': 'v\n' })
  git(repo, 'push', '-q', 'origin', 'main')
  const checkout = path.join(hh.root, 'checkout')
  git(hh.root, 'clone', '-q', remote, checkout)
  const mainId = await register(hh, checkout)
  // 레포 표 (D472): 메인 기준 커밋의 서브모듈. 아직 받지 않았다
  expect(await hh.relay.bundleRepos(mainId, 'main', 'local')).toEqual([
    { name: 'lib', path: 'lib', initialized: false, projectId: null },
    { name: 'vendor', path: 'vendor', initialized: false, projectId: null },
  ])
  // 고르면 메인 체크아웃에 받고 기준 브랜치를 읽는다
  const choice = await hh.relay.repoChoice(mainId, 'lib')
  expect(choice).toEqual({
    ok: true,
    view: { name: 'lib', path: 'lib', defaultBranch: 'main', branches: ['main'], origin: true },
  })
  // 가짜 claude와 앱이 메인과 서브모듈 레포에 커밋할 수 있게 사용자 설정을 둔다(CI에는 전역 설정이 없고, Windows의
  // git은 사용자 이름을 짐작하지 못한다)
  for (const dir of [checkout, path.join(checkout, 'lib')]) {
    git(dir, 'config', 'user.email', 'relay-test@example.com')
    git(dir, 'config', 'user.name', 'relay test')
    git(dir, 'config', 'commit.gpgsign', 'false')
  }
  return { h: hh, checkout, mainId, libSource, mainRemote: remote }
}

async function create(s: Setup, opts: { editMain?: boolean } = {}) {
  const r = await s.h.relay.createWork(s.mainId, {
    request: REQUEST,
    type: 'bugfix',
    baseBranch: 'main',
    baseLocation: 'remote',
    repos: [{ path: 'lib', baseBranch: 'main', baseLocation: 'remote' }],
    ...(opts.editMain === false ? { editMain: false } : {}),
  })
  if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
  const workId = r.workKey.split('/')[1] ?? ''
  const root = path.join(s.h.home, 'projects', s.mainId, 'worktrees', workId)
  return {
    key: r.workKey,
    workId,
    branch: workBranchOf(workId),
    dir: path.join(s.h.home, 'projects', s.mainId, 'works', workId),
    root,
    lib: path.join(root, 'lib'),
  }
}

type Created = Awaited<ReturnType<typeof create>>

const work = (w: Created) => JSON.parse(read(path.join(w.dir, 'work.json'))) as WorkState

async function toVerify(s: Setup, w: Created): Promise<void> {
  const r = await drive(s.h.relay, s.h.ui, w.key, {
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused' })
  await settle(s.h, w.key)
}

/** fix가 메인과 lib에 따로 커밋하고, verify가 lib의 PR 초안도 쓴다 */
function bundleScenario(opts: { main?: boolean } = {}): Scenario {
  const fix = steps('fix')
  const at = fix.findIndex((st) => st.do === 'commit')
  const commits: Step[] = [
    ...(opts.main === false ? [] : [{ ...(fix[at] as Step & { do: 'commit' }), exclude: ['lib'] }]),
    { do: 'commit', dir: 'lib', files: { 'lib.txt': 'lib 고침\n' }, message: 'fix: lib' },
  ]
  const verify = steps('verify')
  const pr = verify.findIndex((st) => st.do === 'write' && st.file === 'pr.md')
  return scenario({
    fix: [...fix.slice(0, at), ...commits, ...fix.slice(at + 1)],
    verify: [
      ...verify.slice(0, pr + 1),
      { do: 'write', file: 'pr/lib.md', text: LIB_PR },
      ...verify.slice(pr + 1),
    ],
  })
}

describe('[흐름] 묶음 Work (D470~D483)', () => {
  it('메인과 서브모듈을 함께 고쳐 레포마다 push하고, 메인이 새 서브모듈 커밋을 가리키게 한 뒤 정리한다', async () => {
    const s = await setup(bundleScenario())
    const w = await create(s)
    const mainHead = git(s.checkout, 'rev-parse', 'HEAD')
    const libBase = git(path.join(s.checkout, 'lib'), 'rev-parse', 'HEAD')
    // 작업 공간 (D471): 메인 worktree는 작업 브랜치, 그 안의 lib 자리는 서브모듈 레포의 worktree다
    expect(work(w)).toMatchObject({
      base_commit: mainHead,
      branch: w.branch,
      repos: [{ path: 'lib', name: 'lib', base_branch: 'main', base_commit: libBase }],
    })
    expect(work(w).main_fixed).toBeUndefined()
    expect(git(w.root, 'branch', '--show-current')).toBe(w.branch)
    expect(git(w.lib, 'branch', '--show-current')).toBe(w.branch)
    expect(s.h.ui.works.get(w.key)?.repos).toEqual([
      expect.objectContaining({ path: 'lib', baseBranch: 'main', worktree: w.lib }),
    ])

    await toVerify(s, w)
    // 에이전트는 메인 worktree 루트에서 시작하고 context.md의 레포 절을 받는다 (D474)
    const start = s.h.records().find((r) => r['type'] === 'start' && r['taskId'] === 't-02')
    expect(start?.['cwd']).toBe(w.root)
    const fix = work(w).tasks[1]
    if (!fix) throw new Error('fix task가 없음')
    const ctx = read(path.join(w.dir, 'tasks', taskDirName(fix), 'context.md'))
    expect(ctx).toContain('## 레포')
    expect(ctx).toContain('서브모듈 `lib`: 폴더 `lib/`. 고친다.')
    expect(ctx).toContain('고르지 않은 서브모듈: `vendor`')
    expect(ctx).not.toContain('## 서브모듈\n')
    expect(fix.repo_starts).toEqual({ lib: libBase })
    // verify는 레포마다 PR 초안 파일을 안다 (D476)
    const verify = work(w).tasks[2]
    if (!verify) throw new Error('verify task가 없음')
    expect(read(path.join(w.dir, 'tasks', taskDirName(verify), 'context.md'))).toContain(
      'PR 초안: `pr/lib.md`',
    )

    // 승인 화면은 레포마다 본다 (D475): 메인의 커밋 안 된 변경에서 lib 자리를 뺀다
    const review = await s.h.relay.review(w.key, 't-02')
    expect(review?.repoDiffs?.map((d) => d.path)).toEqual(['', 'lib'])
    expect(review?.repoDiffs?.[1]?.diff).toContain('+lib 고침')
    expect(review?.emphasis).toEqual([])
    const done = await s.h.relay.review(w.key, 't-03')
    expect(done?.completion?.repos?.map((r) => [r.path, r.branch?.ahead, r.linkable])).toEqual([
      ['', 1, false],
      ['lib', 1, true],
    ])

    // 레포마다 push하고 메인이 새 lib 커밋을 가리키게 한다 (D478, D479)
    const libHead = git(w.lib, 'rev-parse', 'HEAD')
    expect(
      await s.h.relay.deliver(w.key, {
        choice: 'push',
        uncommitted: null,
        repos: [
          { path: '', choice: 'push' },
          { path: 'lib', choice: 'push', link: true },
        ],
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(git(s.libSource, 'rev-parse', `refs/heads/${w.branch}`)).toBe(libHead)
    const pushed = git(s.mainRemote, 'rev-parse', `refs/heads/${w.branch}`)
    expect(git(s.mainRemote, 'ls-tree', pushed, 'lib')).toContain(libHead)
    expect(git(s.mainRemote, 'log', '-1', '--format=%s', pushed)).toBe(
      `relay(${w.workId}): lib 서브모듈을 ${libHead.slice(0, 8)}로`,
    )
    expect(work(w)).toMatchObject({
      status: 'completed',
      delivery: { choice: 'push', status: 'succeeded' },
      repos: [{ path: 'lib', delivery: { choice: 'push', status: 'succeeded', branch: w.branch } }],
    })
    // 메인 worktree는 깨끗하고 lib worktree는 작업 브랜치 그대로다
    expect(git(w.root, 'status', '--porcelain')).toBe('')
    expect(git(w.lib, 'branch', '--show-current')).toBe(w.branch)

    // 정리 (D482): 서브모듈 worktree를 먼저, 메인 worktree를 나중에 지우고 레포마다 브랜치를 지운다
    const p = await s.h.relay.cleanPreview(w.key)
    if (!p.ok) throw new Error(p.error)
    expect(p.preview.submodules).toEqual([])
    expect(p.preview.repos).toEqual([
      expect.objectContaining({
        path: 'lib',
        worktree: true,
        uncommitted: [],
        branch: expect.objectContaining({ name: w.branch, pushed: true, deletable: true }),
      }),
    ])
    expect(
      await s.h.relay.clean(w.key, {
        deleteBranch: true,
        deleteBackups: true,
        confirmed: true,
        expect: p.preview.expect,
        repos: [{ path: 'lib', deleteBranch: true }],
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(work(w)).toMatchObject({
      status: 'archived',
      cleaned: { repos: { lib: { head: libHead, deleted_branches: [w.branch] } } },
    })
    expect(fs.existsSync(w.root)).toBe(false)
    const libCheckout = path.join(s.checkout, 'lib')
    expect(git(libCheckout, 'worktree', 'list')).not.toContain(w.lib)
    expect(git(libCheckout, 'branch', '--list', w.branch)).toBe('')
    expect(git(libCheckout, 'status', '--porcelain')).toBe('')
    expect(git(s.checkout, 'branch', '--list', w.branch)).toBe('')
    // 보관된 Work의 [변경]은 서브모듈 저장소에서 커밋끼리 본다
    expect((await s.h.relay.review(w.key, 't-02'))?.repoDiffs?.[1]?.diff).toContain('+lib 고침')
  })

  it('메인을 고르지 않으면 메인 worktree를 고정하고 서브모듈만 보낸다. 메인 쪽 변경은 알리고 보내지 않는다', async () => {
    const s = await setup(bundleScenario({ main: false }))
    const w = await create(s, { editMain: false })
    expect(work(w).main_fixed).toBe(true)
    expect(git(w.root, 'branch', '--show-current')).toBe('')
    expect(git(s.checkout, 'branch', '--list', w.branch)).toBe('')
    await toVerify(s, w)
    writeFiles(w.root, { 'README.md': '메인 쪽 변경\n' })
    const shown = (await s.h.relay.review(w.key, 't-03'))?.emphasis ?? []
    expect(shown.map((e) => [e.kind, e.lines])).toEqual([['main_changes', [' M README.md']]])
    const completion = (await s.h.relay.review(w.key, 't-03'))?.completion
    expect(completion?.repos?.map((r) => [r.path, r.editable])).toEqual([
      ['', false],
      ['lib', true],
    ])
    // 메인은 보낼 수 없다
    const bad = await s.h.relay.deliver(w.key, {
      choice: 'push',
      uncommitted: null,
      repos: [{ path: '', choice: 'push' }],
    })
    expect(!bad.ok && bad.error).toContain('이 Work의 레포가 아님')
    // 화면처럼 메인 줄을 보내지 않음으로 함께 보낸다
    expect(
      await s.h.relay.deliver(w.key, {
        choice: 'push',
        uncommitted: null,
        repos: [
          { path: '', choice: null },
          { path: 'lib', choice: 'push' },
        ],
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(git(s.libSource, 'branch', '--list', w.branch)).toContain(w.branch)
    expect(git(s.mainRemote, 'branch', '--list', 'relay/*')).toBe('')
    expect(work(w).status).toBe('completed')
    expect(work(w).delivery).toBeUndefined()
    // 정리는 메인 쪽 변경을 확인받는다
    const p = await s.h.relay.cleanPreview(w.key)
    if (!p.ok) throw new Error(p.error)
    expect(p.preview.uncommitted).toEqual([' M README.md'])
    expect(
      await s.h.relay.clean(w.key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: true,
        expect: p.preview.expect,
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(fs.existsSync(w.root)).toBe(false)
  })

  it('보낼 레포의 커밋 안 된 변경은 레포마다 고르고, 메인의 [커밋하고 진행]은 lib 자리를 넣지 않는다 (D475)', async () => {
    const s = await setup(bundleScenario())
    const w = await create(s)
    await toVerify(s, w)
    writeFiles(w.root, { 'NOTE.md': '메인 메모\n' })
    writeFiles(w.lib, { 'more.txt': 'lib 메모\n' })
    const picks = [
      { path: '', choice: 'push' as const },
      { path: 'lib', choice: 'push' as const, link: false },
    ]
    const first = await s.h.relay.deliver(w.key, {
      choice: 'push',
      uncommitted: null,
      repos: picks,
    })
    expect(first).toMatchObject({
      ok: false,
      repoUncommitted: [
        { path: '', lines: ['?? NOTE.md'] },
        { path: 'lib', label: 'lib', lines: ['?? more.txt'] },
      ],
    })
    const libBefore = git(w.lib, 'rev-parse', 'HEAD')
    expect(
      await s.h.relay.deliver(w.key, {
        choice: 'push',
        uncommitted: null,
        repos: picks,
        repoUncommitted: [
          { path: '', action: 'commit', expect: ['?? NOTE.md'] },
          { path: 'lib', action: 'discard', expect: ['?? more.txt'] },
        ],
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    // 메인 커밋에는 lib 자리가 없다: 메인은 원래 lib 커밋을 가리킨다(link: false)
    const pushed = git(s.mainRemote, 'rev-parse', `refs/heads/${w.branch}`)
    expect(git(s.mainRemote, 'show', '--name-only', '--format=', pushed)).toBe('NOTE.md')
    expect(git(s.mainRemote, 'ls-tree', pushed, 'lib')).toContain(work(w).repos?.[0]?.base_commit)
    // lib는 버린 변경을 stash에 넣었다
    expect(git(w.lib, 'rev-parse', 'HEAD')).toBe(libBefore)
    expect(fs.existsSync(path.join(w.lib, 'more.txt'))).toBe(false)
    expect(work(w).repos?.[0]?.delivery?.stashes).toHaveLength(1)
  })

  it('레포마다 PR 초안으로 PR을 만들고, 메인 PR 본문에 함께 머지할 서브모듈 PR을 붙인다 (D476, D479)', async () => {
    const s = await setup(bundleScenario())
    const w = await create(s)
    await toVerify(s, w)
    expect(
      await s.h.relay.deliver(w.key, {
        choice: 'pr',
        uncommitted: null,
        repos: [
          { path: '', choice: 'pr' },
          { path: 'lib', choice: 'pr', link: true },
        ],
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    const creates = s.h.ghRecords().filter((r) => r['type'] === 'pr create') as {
      args: string[]
      body?: string
    }[]
    expect(creates.map((c) => c.args[3])).toEqual([s.libSource, expect.any(String)])
    expect(creates[0]?.args).toEqual(
      expect.arrayContaining(['--title', 'lib: 평균 함수의 빈 배열']),
    )
    expect(creates[0]?.body).toBe('## 요약\n\nlib 쪽 변경')
    const state = work(w)
    const libPr = state.repos?.[0]?.pr
    expect(libPr).toMatchObject({ head: git(w.lib, 'rev-parse', 'HEAD') })
    expect(creates[1]?.body).toContain(
      `## 함께 머지할 PR\n\n- \`lib\`: ${libPr?.url} (이 PR보다 먼저 머지)`,
    )
    expect(state).toMatchObject({
      status: 'pr',
      delivery: { choice: 'pr', status: 'succeeded' },
      repos: [{ path: 'lib', delivery: { choice: 'pr', status: 'succeeded', pr_url: libPr?.url } }],
    })
  })

  it('PR 카드마다 읽고 머지한다. 메인 PR은 서브모듈 PR을 기다리고, squash 머지 뒤 [서브모듈 커밋 맞추기]로 맞춘 뒤 머지한다 (D480, D481)', async () => {
    const s = await setup(bundleScenario())
    const w = await create(s)
    await toVerify(s, w)
    expect(
      await s.h.relay.deliver(w.key, {
        choice: 'pr',
        uncommitted: null,
        repos: [
          { path: '', choice: 'pr' },
          { path: 'lib', choice: 'pr', link: true },
        ],
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(work(w).repos?.[0]).toMatchObject({ linked: true })
    const gh = new FakeGitHub(path.join(s.h.root, 'record'), s.mainRemote, s.h.root)
    const mainNo = work(w).pr?.number ?? 0
    const libNo = work(w).repos?.[0]?.pr?.number ?? 0
    const green = (n: number, head: string) => {
      gh.setChecks(n, head, [gh.checkRun(n, {})])
      gh.setMergeable(n, 'MERGEABLE')
    }
    const libHead = work(w).repos?.[0]?.pr?.head ?? ''
    green(mainNo, work(w).pr?.head ?? '')
    green(libNo, libHead)
    const card = (repo: string) => {
      const v = s.h.ui.works.get(w.key)
      return repo ? v?.prs?.find((p) => p.repo === repo) : v?.pr
    }
    expect(await s.h.relay.prRefresh(w.key)).toEqual({ ok: true })
    expect(await s.h.relay.prRefresh(w.key, 'lib')).toEqual({ ok: true })
    await settle(s.h, w.key)
    // 카드마다 읽는다. 메인 PR은 lib PR이 먼저 머지되어야 한다 (D481)
    expect(card('lib')).toMatchObject({ number: libNo, gate: { enabled: true } })
    expect(card('')?.gate.reasons).toEqual([linkWaitingReason('lib')])
    expect(s.h.ui.works.get(w.key)?.badge.kind).toBe('mergeable')
    // 머지 창의 기본 방식은 카드의 레포 설정이다. 서브모듈 칸이 비면 메인의 값이다 (D483)
    expect(
      await s.h.relay.updateProjectSettings(s.mainId, {
        allowed_bots: [],
        merge_method: 'rebase',
        submodules: { lib: { merge_method: 'squash' } },
      }),
    ).toEqual({ ok: true })
    const preferred = async (repo?: string) => {
      const info = await s.h.relay.prMergeInfo(w.key, repo)
      return info.ok ? info.info.preferred : info.error
    }
    expect(await preferred('lib')).toBe('squash')
    expect(await preferred()).toBe('rebase')

    // lib PR을 squash로 머지한다: Work는 메인 카드가 남아 PR 진행이다
    expect(
      await s.h.relay.prMerge(w.key, { method: 'squash', head: libHead, repo: 'lib' }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(work(w)).toMatchObject({
      status: 'pr',
      repos: [{ pr: { merged: { method: 'squash', outside: false } } }],
    })
    expect(work(w).completed_at).toBeUndefined()
    // GitHub의 squash 머지: lib의 기준 브랜치에 새 커밋이 생겨 메인이 가리키는 커밋은 거기 없다
    git(s.libSource, 'merge', '--squash', '-q', w.branch)
    git(s.libSource, 'commit', '-q', '-m', 'lib: squash')
    const squash = git(s.libSource, 'rev-parse', 'HEAD')
    gh.setMergeCommit(libNo, squash)
    expect(await s.h.relay.prRefresh(w.key)).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(card('')?.relink).toEqual(['lib'])
    expect(card('')?.gate.reasons).toEqual([relinkReason('lib')])

    // [서브모듈 커밋 맞추기]: 메인 작업 브랜치에 squash 커밋을 가리키는 커밋을 더하고 push한다
    expect(await s.h.relay.prRelink(w.key)).toEqual({ ok: true })
    await settle(s.h, w.key)
    const pushed = git(s.mainRemote, 'rev-parse', `refs/heads/${w.branch}`)
    expect(git(s.mainRemote, 'ls-tree', pushed, 'lib')).toContain(squash)
    expect(git(w.root, 'status', '--porcelain', '--', 'lib')).toBe('M lib')
    green(mainNo, pushed)
    expect(await s.h.relay.prRefresh(w.key)).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(card('')).toMatchObject({ relink: [], head: pushed, gate: { enabled: true } })

    // 메인 PR을 머지하면 마지막 카드라 Work가 완료다
    expect(await s.h.relay.prMerge(w.key, { method: 'merge', head: pushed })).toEqual({
      ok: true,
    })
    await settle(s.h, w.key)
    expect(work(w)).toMatchObject({ status: 'completed', pr: { merged: { method: 'merge' } } })
    const events = read(path.join(w.dir, 'events.jsonl'))
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { type: string; payload: Record<string, unknown> })
    expect(events.filter((e) => e.type === 'work.completed')).toHaveLength(1)
    expect(events.find((e) => e.type === 'pr.relinked')?.payload).toMatchObject({
      links: [{ path: 'lib', sha: squash }],
    })
  })

  it('서브모듈 PR 카드의 [대응 시작]은 그 레포만 고치고 그 PR에 push하고 답글을 단다 (D480)', async () => {
    const respond: Step[] = [
      { do: 'prompt' },
      {
        do: 'commit',
        dir: 'lib',
        files: { 'lib.txt': 'lib 리뷰 반영\n' },
        message: 'fix: lib 리뷰 반영',
      },
      { do: 'respond', text: '{id}: 반영했습니다.' },
      {
        do: 'write',
        file: 'handoff.md',
        text: (
          steps('verify').find((x) => x.do === 'write' && x.file === 'handoff.md') as Step & {
            text: string
          }
        ).text,
      },
      { do: 'stop' },
    ]
    const base = bundleScenario()
    const s = await setup({ ...base, tasks: { ...base.tasks, 'pr-respond': respond } })
    const w = await create(s)
    await toVerify(s, w)
    expect(
      await s.h.relay.deliver(w.key, {
        choice: 'pr',
        uncommitted: null,
        repos: [
          { path: '', choice: 'pr' },
          { path: 'lib', choice: 'pr', link: false },
        ],
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    const gh = new FakeGitHub(path.join(s.h.root, 'record'), s.mainRemote, s.h.root)
    const libNo = work(w).repos?.[0]?.pr?.number ?? 0
    const comment = gh.convo(libNo, 'lib.txt 문구를 고쳐 주세요')
    expect(await s.h.relay.prRefresh(w.key, 'lib')).toEqual({ ok: true })
    await settle(s.h, w.key)
    const lib = s.h.ui.works.get(w.key)?.prs?.find((p) => p.repo === 'lib')
    expect(lib?.respond).toMatchObject({ enabled: true, items: [`convo:${comment}`] })
    expect(
      await s.h.relay.prRespond(w.key, {
        items: [`convo:${comment}`],
        instruction: '',
        repo: 'lib',
      }),
    ).toEqual({ ok: true })
    await s.h.ui.until(
      () => {
        const v = s.h.ui.works.get(w.key)
        const t = v?.tasks.find((x) => x.id === v.current)
        return t?.node === 'respond' && t.status === 'awaiting_approval' ? t : null
      },
      '대응 task의 승인 대기',
      30_000,
    )
    await settle(s.h, w.key)
    const task = work(w).tasks.at(-1)
    if (!task) throw new Error('대응 task가 없음')
    expect(task.respond).toMatchObject({ repo: 'lib', items: [`convo:${comment}`] })
    const ctx = read(path.join(w.dir, 'tasks', taskDirName(task), 'context.md'))
    expect(ctx).toContain('이 PR은 서브모듈 `lib`의 PR이다')
    // 메인 카드에서는 대응을 시작하지 못한다: 대응 task는 Work에 하나다
    expect(s.h.ui.works.get(w.key)?.pr?.respond.enabled).toBe(false)
    const mainBefore = git(s.mainRemote, 'rev-parse', `refs/heads/${w.branch}`)
    expect(await s.h.relay.approve(w.key, task.id, {})).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(work(w).tasks.at(-1)?.respond?.published_at).toBeDefined()
    // lib PR에만 push하고 답글을 단다
    expect(git(s.libSource, 'rev-parse', `refs/heads/${w.branch}`)).toBe(
      git(w.lib, 'rev-parse', 'HEAD'),
    )
    expect(git(s.mainRemote, 'rev-parse', `refs/heads/${w.branch}`)).toBe(mainBefore)
    expect(
      gh
        .comments(libNo)
        .map((c) => c.body)
        .join('\n'),
    ).toContain('반영했습니다.')
    expect(fs.existsSync(path.join(w.dir, 'pr-items.lib.json'))).toBe(true)
    const items = JSON.parse(read(path.join(w.dir, 'pr-items.lib.json'))) as {
      rounds: { task_id: string }[]
    }
    expect(items.rounds.map((x) => x.task_id)).toEqual([task.id])
  })

  it('[레포 추가]는 진행 중인 Work에 서브모듈을 더하고 다음 task부터 알린다 (D473)', async () => {
    const s = await setup(scenario())
    const r = await s.h.relay.createWork(s.mainId, {
      request: REQUEST,
      type: 'bugfix',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const workId = r.workKey.split('/')[1] ?? ''
    const root = path.join(s.h.home, 'projects', s.mainId, 'worktrees', workId)
    await drive(s.h.relay, s.h.ui, r.workKey, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    await settle(s.h, r.workKey)
    expect(s.h.ui.works.get(r.workKey)?.canAddRepo).toBe(true)
    expect(
      await s.h.relay.addRepo(r.workKey, {
        path: 'lib',
        baseBranch: 'main',
        baseLocation: 'local',
      }),
    ).toEqual({ ok: true })
    expect(git(path.join(root, 'lib'), 'branch', '--show-current')).toBe(workBranchOf(workId))
    const dir = path.join(s.h.home, 'projects', s.mainId, 'works', workId)
    const state = JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
    expect(state.repos).toEqual([
      expect.objectContaining({ path: 'lib', name: 'lib', added_at: expect.any(String) }),
    ])
    // 다시 더하면 받지 않는다
    const again = await s.h.relay.addRepo(r.workKey, {
      path: 'lib',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    expect(!again.ok && again.error).toBe('이미 고른 레포임: lib')
    expect(
      (await s.h.relay.addRepo(r.workKey, {
        path: 'nope',
        baseBranch: 'main',
        baseLocation: 'local',
      })) as { error?: string },
    ).toMatchObject({ ok: false, error: '메인 레포의 main에는 서브모듈 nope이 없습니다' })
  })

  it('고를 수 없는 것은 Work를 만들지 않는다', async () => {
    const s = await setup(scenario())
    const base = {
      request: REQUEST,
      type: 'bugfix' as const,
      baseBranch: 'main',
      baseLocation: 'local' as const,
    }
    const none = await s.h.relay.createWork(s.mainId, { ...base, editMain: false })
    expect(!none.ok && none.error).toBe('고칠 레포를 하나 이상 고르세요')
    const missing = await s.h.relay.createWork(s.mainId, {
      ...base,
      repos: [{ path: 'nope', baseBranch: 'main', baseLocation: 'local' }],
    })
    expect(!missing.ok && missing.error).toBe('메인 레포의 main에는 서브모듈 nope이 없습니다')
    const twice = await s.h.relay.createWork(s.mainId, {
      ...base,
      repos: [
        { path: 'lib', baseBranch: 'main', baseLocation: 'local' },
        { path: 'lib', baseBranch: 'main', baseLocation: 'local' },
      ],
    })
    expect(!twice.ok && twice.error).toBe('같은 서브모듈을 두 번 골랐습니다')
    const branch = await s.h.relay.createWork(s.mainId, {
      ...base,
      repos: [{ path: 'lib', baseBranch: 'nope', baseLocation: 'local' }],
    })
    expect(!branch.ok && branch.error).toBe('lib: 기준 브랜치를 찾을 수 없습니다: nope')
    expect(fs.existsSync(path.join(s.h.home, 'projects', s.mainId, 'worktrees'))).toBe(false)
    expect(
      git(path.join(s.checkout, 'lib'), 'worktree', 'list', '--porcelain').match(/^worktree /gm),
    ).toHaveLength(1)
  })
})
