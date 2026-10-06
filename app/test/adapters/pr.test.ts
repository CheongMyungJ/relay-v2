// [어댑터] PR 진행의 gh·git 작업 (docs/implementation.md M9, 시나리오 10). gh는 가짜 gh(8.2)이고 명령의 모양은 S7에서
// 확인한 것이다: gh --version, pr view --json, api --hostname --paginate --slurp, api …/actions/runs/<실행>(D201),
// run view --log-failed,
// repo view --json …Allowed, pr merge --match-head-commit. git은 실제 git으로 fast-forward, 받은 커밋과 부모,
// 원격 브랜치 확인과 삭제를 본다 (D178, D193). PR 대응(M10)은 답글 POST(api -X POST --input -), run rerun --failed,
// 라운드의 바뀐 파일(D202)을 본다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { run } from '../../src/adapters/exec'
import {
  GhApiError,
  GhError,
  ghApi,
  ghApiList,
  ghApiPost,
  ghCreatePr,
  ghFailedLog,
  ghMerge,
  ghMergeSettings,
  ghPrView,
  ghRerunFailed,
  ghVersion,
  httpStatusOf,
} from '../../src/adapters/gh'
import {
  GitError,
  addWorktree,
  changedPaths,
  commitsWithParents,
  deleteRemoteBranch,
  fetchBranch,
  hasCommit,
  mergeFastForward,
  pushBranch,
  remoteBranchExists,
} from '../../src/adapters/git'
import { FakeGitHub } from '../support/github'
import { FAKE_GH } from '../support/harness'
import { git, makeRepo, writeFiles } from '../support/repo'

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

  it('가짜 gh의 baseRefOid는 기준 브랜치가 움직여도 PR 브랜치에 push하기 전까지 옛 커밋이다 (S7 관찰 7)', async () => {
    await openPr()
    const view = () =>
      ghPrView(FAKE_GH, { repo: REPO, number: 1, cwd: repo, env: env() }, [
        'headRefOid',
        'baseRefOid',
      ])
    const before = await view()
    const base0 = git(remote, 'rev-parse', 'refs/heads/main')
    expect(before['baseRefOid']).toBe(base0)
    // 기준 브랜치에 커밋이 생긴다
    commit(repo, { 'base.txt': 'b\n' }, '기준 브랜치')
    git(repo, 'push', '-q', 'origin', 'main')
    const base1 = git(remote, 'rev-parse', 'refs/heads/main')
    expect((await view())['baseRefOid']).toBe(base0)
    // PR 브랜치에 push하면 따라온다
    commit(tree, { 'more.txt': 'm\n' }, '더')
    await pushBranch(tree, BRANCH)
    expect(await view()).toEqual({ headRefOid: git(tree, 'rev-parse', 'HEAD'), baseRefOid: base1 })
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

  it('Actions 실행의 이벤트는 REST 객체 하나로 읽는다 (D201, 3절)', async () => {
    await openPr()
    const gh = new FakeGitHub(record, remote, root)
    const check = gh.checkRun(1, { event: 'push' }) as { detailsUrl: string }
    const run = Number(/runs\/(\d+)\//.exec(check.detailsUrl)?.[1])
    const path1 = `repos/local/sample/actions/runs/${run}?exclude_pull_requests=true`
    const o = { host: 'github.test', path: path1, cwd: repo, env: env() }
    expect(await ghApi(FAKE_GH, o)).toMatchObject({ id: run, event: 'push' })
    const call = fs
      .readFileSync(path.join(record, 'fake-gh.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; args: string[] })
      .find((r) => r.type === 'api run')
    expect(call?.args).toEqual(['api', '--hostname', 'github.test', path1])
    await expect(
      ghApi(FAKE_GH, {
        ...o,
        path: 'repos/local/sample/actions/runs/9?exclude_pull_requests=true',
      }),
    ).rejects.toThrow(GhError)
    await expect(ghApi(FAKE_GH, { ...o, env: env({ FAKE_GH_FAIL: 'event' }) })).rejects.toThrow(
      /HTTP 502/,
    )
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

describe('[어댑터] PR 대응의 gh·git 작업 (docs/implementation.md M10, 3절)', () => {
  const post = (target: string, body: string, extra: Record<string, string> = {}) =>
    ghApiPost(FAKE_GH, {
      host: 'github.test',
      path: target,
      body: { body },
      cwd: repo,
      env: env(extra),
    })

  it('인라인 답글은 스레드 첫 코멘트의 replies로, 스레드 없는 답글은 대화 코멘트로 올린다. 본문은 표준 입력의 JSON이다', async () => {
    await openPr()
    const gh = new FakeGitHub(record, remote, root)
    const top = gh.inline(1, { body: '여기 고쳐 주세요', path: 'src/a.js', line: 1 })
    const reply = await post(
      `repos/local/sample/pulls/1/comments/${top}/replies`,
      '고쳤습니다\n<!-- relay:w/inline:1/1 -->',
    )
    expect(reply).toMatchObject({
      body: '고쳤습니다\n<!-- relay:w/inline:1/1 -->',
      in_reply_to_id: top,
      path: 'src/a.js',
      user: { login: 'relay-owner', type: 'User' },
      author_association: 'OWNER',
    })
    expect(typeof reply['id']).toBe('number')
    expect(String(reply['html_url'])).toMatch(/#discussion_r\d+$/)
    // 인라인 답글을 달면 본문이 빈 리뷰가 하나 더 생긴다 (S7 관찰 3)
    const reviews = (gh.read().prs['1']?.reviews ?? []) as { body: string }[]
    expect(reviews.map((r) => r.body)).toEqual([''])
    const convo = await post('repos/local/sample/issues/1/comments', '> 링크\n\n답')
    expect(String(convo['html_url'])).toMatch(/#issuecomment-\d+$/)
    expect(gh.comments(1).map((c) => [c.kind, c.reply_to])).toEqual([
      ['inline', null],
      ['inline', top],
      ['convo', null],
    ])
    // 본문은 명령줄에 없고 표준 입력으로 갔다
    const calls = fs
      .readFileSync(path.join(record, 'fake-gh.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; args: string[]; input?: string })
      .filter((c) => c.type === 'api post')
    expect(calls[0]?.args).toEqual([
      'api',
      '--hostname',
      'github.test',
      '-X',
      'POST',
      `repos/local/sample/pulls/1/comments/${top}/replies`,
      '--input',
      '-',
    ])
    expect(JSON.parse(calls[0]?.input ?? '{}')).toEqual({
      body: '고쳤습니다\n<!-- relay:w/inline:1/1 -->',
    })
  })

  it('없는 코멘트에 답하면 HTTP 404이고, 응답이 없으면 게시됐는지 모른다. 게시하고도 오류를 돌려줄 수 있다 (D194, D205)', async () => {
    await openPr()
    const gh = new FakeGitHub(record, remote, root)
    const err = await post('repos/local/sample/pulls/1/comments/999/replies', '답').catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(GhApiError)
    expect((err as GhApiError).status).toBe(404)
    gh.postFaults(['error', 'posted'])
    const e1 = await post('repos/local/sample/issues/1/comments', '첫째').catch((e: unknown) => e)
    expect((e1 as GhApiError).status).toBe(502)
    expect(gh.comments(1)).toEqual([])
    const e2 = await post('repos/local/sample/issues/1/comments', '둘째').catch((e: unknown) => e)
    expect((e2 as GhApiError).status).toBe(502)
    expect(gh.comments(1).map((c) => c.body)).toEqual(['둘째'])
    expect(await post('repos/local/sample/issues/1/comments', '셋째')).toMatchObject({
      body: '셋째',
    })
    const down = await post('repos/local/sample/issues/1/comments', '넷째', {
      FAKE_GH_FAIL: 'post',
    }).catch((e: unknown) => e)
    expect((down as GhApiError).status).toBe(502)
    expect(httpStatusOf('gh: Not Found (HTTP 404)\n')).toBe(404)
    expect(httpStatusOf('connection reset')).toBeNull()
  })

  it('실패한 작업은 gh run rerun <실행> --repo <레포> --failed로 다시 돌린다. 성공하면 출력이 없다 (D203, 3절)', async () => {
    await openPr()
    const gh = new FakeGitHub(record, remote, root)
    gh.checkRun(1, { conclusion: 'FAILURE', event: 'push', run: 77 })
    const o = { repo: REPO, run: 77, cwd: repo, env: env() }
    expect(await ghRerunFailed(FAKE_GH, o)).toEqual({ ok: true })
    expect(gh.reruns()).toEqual([77])
    const refused = await ghRerunFailed(FAKE_GH, { ...o, env: env({ FAKE_GH_FAIL: 'rerun' }) })
    expect(refused).toMatchObject({
      ok: false,
      error: expect.stringContaining('run 77 cannot be rerun'),
    })
    expect(await ghRerunFailed(FAKE_GH, { ...o, run: 5 })).toMatchObject({ ok: false })
  })

  it('라운드 시작 커밋과 지금 작업 트리의 차이에서 바뀐 파일과 상태를 준다. 이름에 공백과 한글이 있어도 된다 (D202)', async () => {
    const start = commit(
      tree,
      { 'test/a.test.js': 'a\n', 'test/지울 것.test.js': 'b\n', 'src/b.js': 'b\n' },
      '시작',
    )
    commit(tree, { 'test/a.test.js': 'a2\n', 'test/new.test.js': 'n\n' }, '고침')
    git(tree, 'rm', '-q', 'test/지울 것.test.js')
    writeFiles(tree, { 'src/b.js': 'b2\n' })
    expect(await changedPaths(tree, start)).toEqual([
      { status: 'M', path: 'src/b.js' },
      { status: 'M', path: 'test/a.test.js' },
      { status: 'A', path: 'test/new.test.js' },
      { status: 'D', path: 'test/지울 것.test.js' },
    ])
  })

  it('명령에 표준 입력을 주면 다 쓴 뒤 닫는다 (gh api --input -)', async () => {
    const r = await run(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], {
      input: '한글 본문\n',
    })
    expect(r).toMatchObject({ code: 0, stdout: '한글 본문\n' })
  })
})
