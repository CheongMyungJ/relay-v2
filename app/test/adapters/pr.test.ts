// [어댑터] PR 진행의 gh·git 작업 (docs/implementation.md M9, 시나리오 10). gh는 가짜 gh(8.2)이고 명령의 모양은 S7에서
// 확인한 것이다: gh --version, pr view --json, api --hostname --paginate --slurp, run view --log-failed,
// repo view --json …Allowed, pr merge --match-head-commit. git은 실제 git으로 fast-forward, 받은 커밋과 부모,
// 원격 브랜치 확인과 삭제를 본다 (D178, D193).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ghApiList,
  ghCreatePr,
  ghFailedLog,
  ghMerge,
  ghMergeSettings,
  ghPrView,
  ghVersion,
} from '../../src/adapters/gh'
import {
  GitError,
  addWorktree,
  commitsWithParents,
  deleteRemoteBranch,
  fetchBranch,
  hasCommit,
  mergeFastForward,
  pushBranch,
  remoteBranchExists,
} from '../../src/adapters/git'
import { FakeGitHub } from '../flow/github'
import { FAKE_GH } from '../flow/harness'
import { git, makeRepo, writeFiles } from '../flow/repo'

const BRANCH = 'relay/w-20260929-001'
const REPO = 'github.test/local/sample'

let root: string
let repo: string
let remote: string
let tree: string
let record: string

beforeEach(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-pr-')))
  const r = makeRepo(root, 'sample', { 'src/a.js': 'export const a = 1\n' })
  repo = r.repo
  remote = r.remote
  tree = path.join(root, 'worktree')
  record = path.join(root, 'record')
  await addWorktree(repo, tree, BRANCH, git(repo, 'rev-parse', 'HEAD'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

const env = (extra: Record<string, string> = {}) => ({
  ...process.env,
  FAKE_GH_RECORD: record,
  ...extra,
})

function commit(dir: string, files: Record<string, string>, message: string): string {
  writeFiles(dir, files)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
  return git(dir, 'rev-parse', 'HEAD')
}

/** Work 브랜치를 push하고 가짜 gh로 PR을 만든다 */
async function openPr(): Promise<{ head: string; url: string }> {
  const head = commit(tree, { 'src/a.js': 'export const a = 2\n' }, 'fix')
  await pushBranch(tree, BRANCH)
  const url = await ghCreatePr(FAKE_GH, {
    repo: remote,
    cwd: repo,
    env: env(),
    base: 'main',
    head: BRANCH,
    title: 't',
    body: 'b',
    draft: false,
  })
  return { head, url }
}

describe('[어댑터] gh로 PR 읽기와 머지 (가짜 gh, S7)', () => {
  it('gh --version의 버전을 읽는다. gh가 없으면 null이다 (D198)', async () => {
    expect(await ghVersion(FAKE_GH, env())).toBe('2.101.0')
    expect(await ghVersion(FAKE_GH, env({ FAKE_GH_VERSION: '2.40.1' }))).toBe('2.40.1')
    expect(await ghVersion(path.join(root, 'no-gh'), env())).toBeNull()
  })

  it('PR 주소는 GitHub 모양이고, pr view --json이 상태와 head, 빈 체크 목록을 준다 (I50, S7 관찰 2)', async () => {
    const { head, url } = await openPr()
    expect(url).toBe(`https://${REPO}/pull/1`)
    const view = await ghPrView(FAKE_GH, { repo: REPO, number: 1, cwd: repo, env: env() })
    expect(view).toMatchObject({
      number: 1,
      url,
      state: 'OPEN',
      isDraft: false,
      headRefName: BRANCH,
      headRefOid: head,
      baseRefName: 'main',
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      reviewDecision: '',
      statusCheckRollup: [],
      mergedAt: null,
      mergeCommit: null,
    })
    await expect(
      ghPrView(FAKE_GH, { repo: REPO, number: 9, cwd: repo, env: env() }),
    ).rejects.toThrow(/Could not resolve to a PullRequest with the number of 9/)
  })

  it('REST 목록은 --hostname과 --paginate --slurp로 모든 쪽을 읽어 한 목록으로 편다', async () => {
    await openPr()
    const gh = new FakeGitHub(record, remote, root)
    for (let i = 0; i < 150; i++) gh.convo(1, `코멘트 ${i}`)
    const list = await ghApiList(FAKE_GH, {
      host: 'github.test',
      path: 'repos/local/sample/issues/1/comments?per_page=100',
      cwd: repo,
      env: env(),
    })
    expect(list).toHaveLength(150)
    expect((list[149] as { body: string }).body).toBe('코멘트 149')
    const empty = await ghApiList(FAKE_GH, {
      host: 'github.test',
      path: 'repos/local/sample/pulls/1/reviews?per_page=100',
      cwd: repo,
      env: env(),
    })
    expect(empty).toEqual([])
    const call = fs
      .readFileSync(path.join(record, 'fake-gh.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; args: string[] })
      .find((r) => r.type === 'api')
    expect(call?.args).toEqual([
      'api',
      '--hostname',
      'github.test',
      '--paginate',
      '--slurp',
      'repos/local/sample/issues/1/comments?per_page=100',
    ])
  })

  it('실패 로그는 실행이 끝나야 준다. 끝나기 전에는 pending이다 (3절, S7 관찰 2)', async () => {
    await openPr()
    const gh = new FakeGitHub(record, remote, root)
    const check = gh.checkRun(1, { conclusion: 'FAILURE', pending: true }) as { detailsUrl: string }
    const job = Number(/job\/(\d+)$/.exec(check.detailsUrl)?.[1])
    const o = { repo: REPO, job, cwd: repo, env: env() }
    const pending = await ghFailedLog(FAKE_GH, o)
    expect(pending).toMatchObject({ ok: false, pending: true })
    expect(!pending.ok && pending.error).toMatch(/is still in progress; logs will be available/)
    gh.logReady(job, 'test\tRun\t2026-09-29T00:00:00Z 실패\n')
    expect(await ghFailedLog(FAKE_GH, o)).toEqual({
      ok: true,
      text: 'test\tRun\t2026-09-29T00:00:00Z 실패\n',
    })
    expect(await ghFailedLog(FAKE_GH, { ...o, job: 1 })).toMatchObject({
      ok: false,
      pending: false,
    })
  })

  it('허용하는 머지 방식을 읽는다 (D177)', async () => {
    const gh = new FakeGitHub(record, remote, root)
    gh.setMethods({ merge: false })
    expect(await ghMergeSettings(FAKE_GH, { repo: REPO, cwd: repo, env: env() })).toEqual({
      mergeCommitAllowed: false,
      squashMergeAllowed: true,
      rebaseMergeAllowed: true,
    })
  })

  it('머지는 머지 창의 head일 때만 한다. 그사이 새 커밋이 생겼으면 GitHub가 거절한다. 성공하면 출력이 없다 (S7 관찰 6)', async () => {
    const { head } = await openPr()
    const o = { repo: REPO, number: 1, cwd: repo, env: env(), method: 'squash' as const }
    const moved = await ghMerge(FAKE_GH, { ...o, head: 'f'.repeat(40) })
    expect(moved).toMatchObject({ ok: false, headMoved: true })
    expect(!moved.ok && moved.error).toContain('Head branch was modified')
    // 브랜치 보호로 막히면 gh가 GitHub에 묻기 전에 멈춘다
    const gh = new FakeGitHub(record, remote, root)
    gh.setMergeable(1, 'MERGEABLE', 'BLOCKED')
    const blocked = await ghMerge(FAKE_GH, { ...o, head })
    expect(blocked).toMatchObject({ ok: false, headMoved: false })
    expect(!blocked.ok && blocked.error).toContain('the base branch policy prohibits the merge')
    gh.setMergeable(1, 'MERGEABLE')
    expect(await ghMerge(FAKE_GH, { ...o, head })).toEqual({ ok: true })
    expect(
      await ghPrView(FAKE_GH, { repo: REPO, number: 1, cwd: repo, env: env() }, ['state']),
    ).toEqual({ state: 'MERGED' })
    // 이미 머지된 PR은 gh가 아무것도 하지 않고 성공한다
    expect(await ghMerge(FAKE_GH, { ...o, head })).toEqual({ ok: true })
  })
})

describe('[어댑터] PR 진행의 git 작업 (D178, D193)', () => {
  it('원격만 앞선 PR 브랜치를 fetch해 fast-forward로 받는다. 받은 커밋과 부모를 새것부터 준다', async () => {
    const local = commit(tree, { 'src/a.js': 'export const a = 2\n' }, 'fix')
    await pushBranch(tree, BRANCH)
    // 다른 clone에서 커밋을 더한다 (웹 편집)
    const other = path.join(root, 'other')
    git(root, 'clone', '-q', '-b', BRANCH, remote, other)
    git(other, 'config', 'user.email', 'o@example.com')
    git(other, 'config', 'user.name', 'o')
    const remoteHead = commit(other, { 'b.txt': 'b\n' }, '원격 커밋')
    git(other, 'push', '-q', 'origin', BRANCH)
    expect(await hasCommit(repo, remoteHead)).toBe(false)
    await fetchBranch(repo, BRANCH)
    expect(await hasCommit(repo, remoteHead)).toBe(true)
    expect(await commitsWithParents(repo, local, remoteHead)).toEqual([
      { commit: remoteHead, parents: [local] },
    ])
    await mergeFastForward(tree, remoteHead)
    expect(git(tree, 'rev-parse', 'HEAD')).toBe(remoteHead)
  })

  it('fast-forward가 아니면 git이 거부하고 아무것도 바꾸지 않는다', async () => {
    const base = git(tree, 'rev-parse', 'HEAD')
    const mine = commit(tree, { 'mine.txt': 'm\n' }, '로컬')
    git(tree, 'branch', 'other', base)
    git(tree, 'checkout', '-q', 'other')
    const theirs = commit(tree, { 'theirs.txt': 't\n' }, '다른 쪽')
    git(tree, 'checkout', '-q', BRANCH)
    await expect(mergeFastForward(tree, theirs)).rejects.toBeInstanceOf(GitError)
    expect(git(tree, 'rev-parse', 'HEAD')).toBe(mine)
    expect(git(tree, 'status', '--porcelain')).toBe('')
  })

  it('기준 브랜치를 병합한 커밋은 둘째 부모가 기준 브랜치 커밋이다 (D181)', async () => {
    const start = git(tree, 'rev-parse', 'HEAD')
    const pr = commit(tree, { 'pr.txt': 'p\n' }, 'PR')
    const baseTip = commit(repo, { 'base.txt': 'b\n' }, '기준 브랜치')
    git(tree, 'merge', '-q', '--no-ff', '-m', '기준 브랜치 병합', 'main')
    const merge = git(tree, 'rev-parse', 'HEAD')
    const got = await commitsWithParents(tree, pr, merge)
    expect(got).toEqual([
      { commit: merge, parents: [pr, baseTip] },
      { commit: baseTip, parents: [start] },
    ])
  })

  it('원격 브랜치가 있는지 보고 지운다. 원격에 닿지 못하면 오류다 (D178)', async () => {
    commit(tree, { 'src/a.js': 'export const a = 3\n' }, 'fix')
    expect(await remoteBranchExists(repo, BRANCH)).toBe(false)
    await pushBranch(tree, BRANCH)
    expect(await remoteBranchExists(repo, BRANCH)).toBe(true)
    await deleteRemoteBranch(repo, BRANCH)
    expect(await remoteBranchExists(repo, BRANCH)).toBe(false)
    expect(git(remote, 'branch', '--list', BRANCH)).toBe('')
    fs.renameSync(remote, `${remote}.off`)
    await expect(remoteBranchExists(repo, BRANCH)).rejects.toBeInstanceOf(GitError)
  })
})
