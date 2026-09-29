// [어댑터] 전달과 정리의 git·gh 작업 (시나리오 7, 8): push와 원격 추적 브랜치, 원격 주소, 커밋 안 된 변경의
// stash와 커밋, 조상 판정, worktree의 잠금 파일, worktree 지우기, 브랜치 지우기, gh pr list·create.
// 실제 git으로 레포, 로컬 bare 원격, worktree를 만들어 돌린다. gh는 가짜 gh(8.2)다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ghCreatePr, ghOpenPr, GhError } from '../../src/adapters/gh'
import {
  GitError,
  addWorktree,
  commitAll,
  deleteBranches,
  headCommit,
  isAncestor,
  lockFiles,
  pushBranch,
  refCommit,
  remoteUrl,
  removeWorktree,
  stashAll,
  statusLines,
} from '../../src/adapters/git'
import { FAKE_GH } from '../flow/harness'
import { git, makeRepo, writeFiles } from '../flow/repo'

const WORK_ID = 'w-20260927-001'
const BRANCH = `relay/${WORK_ID}`

let root: string
let repo: string
let remote: string
let tree: string
let base: string

beforeEach(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-deliver-')))
  const r = makeRepo(root, 'sample', {
    '.gitignore': 'node_modules/\n',
    'src/avg.js': 'export const avg = () => NaN\n',
  })
  repo = r.repo
  remote = r.remote
  base = git(repo, 'rev-parse', 'HEAD')
  tree = path.join(root, 'worktree')
  await addWorktree(repo, tree, BRANCH, base)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

/** worktree에서 fix가 커밋한다 */
function fix(text = 'export const avg = (xs) => (xs.length ? 1 : 0)\n'): string {
  writeFiles(tree, { 'src/avg.js': text })
  git(tree, 'commit', '-q', '-am', 'fix')
  return git(tree, 'rev-parse', 'HEAD')
}

describe('[어댑터] 전달의 git 작업 (시나리오 7)', () => {
  it('Work 브랜치를 origin의 같은 이름으로 push하면 원격 추적 브랜치와 upstream이 생긴다. 다시 push해도 된다', async () => {
    const fixed = fix()
    await pushBranch(tree, BRANCH)
    expect(git(remote, 'rev-parse', `refs/heads/${BRANCH}`)).toBe(fixed)
    expect(await refCommit(repo, `refs/remotes/origin/${BRANCH}`)).toBe(fixed)
    expect(git(repo, 'config', `branch.${BRANCH}.merge`)).toBe(`refs/heads/${BRANCH}`)
    await pushBranch(tree, BRANCH)
    expect(git(remote, 'rev-parse', `refs/heads/${BRANCH}`)).toBe(fixed)
  })

  it('fast-forward가 아니면 원격이 거부한다. 원격이 없으면 실패한다', async () => {
    fix()
    await pushBranch(tree, BRANCH)
    git(tree, 'reset', '-q', '--hard', base)
    fix('export const avg = () => 0\n')
    await expect(pushBranch(tree, BRANCH)).rejects.toBeInstanceOf(GitError)
    fs.renameSync(remote, `${remote}.off`)
    await expect(pushBranch(tree, BRANCH)).rejects.toThrow(/git push 실패/)
  })

  it('원격 주소는 fetch 주소다. pushurl을 따로 두어도 origin 레포의 주소를 읽는다 (git-remote)', async () => {
    expect(await remoteUrl(repo)).toBe(remote)
    expect(await remoteUrl(repo, 'upstream')).toBeNull()
    git(repo, 'remote', 'set-url', 'origin', 'https://github.com/relay-test/sample.git')
    git(repo, 'remote', 'set-url', '--push', 'origin', remote)
    expect(await remoteUrl(repo)).toBe('https://github.com/relay-test/sample.git')
    // push는 pushurl로 간다
    const fixed = fix()
    await pushBranch(tree, BRANCH)
    expect(git(remote, 'rev-parse', `refs/heads/${BRANCH}`)).toBe(fixed)
  })

  it('[변경 버리고 진행]: git stash -u로 추적하지 않는 파일까지 넣고 지운다. 무시하는 파일은 남고 stash는 메인 체크아웃에 보인다 (7-5)', async () => {
    fix()
    writeFiles(tree, {
      'src/avg.js': 'export const avg = () => 2\n',
      'notes.txt': '메모\n',
      'node_modules/pkg/index.js': 'keep\n',
    })
    const stash = await stashAll(tree, `relay(${WORK_ID}): 완료 전 버린 변경`)
    expect(await statusLines(tree)).toEqual([])
    expect(fs.existsSync(path.join(tree, 'notes.txt'))).toBe(false)
    expect(fs.existsSync(path.join(tree, 'node_modules', 'pkg', 'index.js'))).toBe(true)
    expect(git(repo, 'rev-parse', 'refs/stash')).toBe(stash)
    expect(git(repo, 'stash', 'list')).toContain(`relay(${WORK_ID}): 완료 전 버린 변경`)
    expect(
      git(repo, 'stash', 'show', '--include-untracked', '--name-only', stash).split('\n').sort(),
    ).toEqual(['notes.txt', 'src/avg.js'])
    // 넣을 것이 없으면 실패한다
    await expect(stashAll(tree, 'x')).rejects.toBeInstanceOf(GitError)
  })

  it('[커밋하고 진행]: 추적하지 않는 파일까지 커밋한다. 무시하는 파일은 넣지 않는다 (7-5)', async () => {
    const fixed = fix()
    writeFiles(tree, { 'notes.txt': '메모\n', 'node_modules/pkg/index.js': 'keep\n' })
    const head = await commitAll(tree, `relay(${WORK_ID}): 완료 전 남은 변경`)
    expect(head).toBe(await headCommit(tree))
    expect(git(tree, 'rev-parse', 'HEAD^')).toBe(fixed)
    expect(git(tree, 'log', '-1', '--format=%s')).toBe(`relay(${WORK_ID}): 완료 전 남은 변경`)
    expect(git(tree, 'show', '--name-only', '--format=', 'HEAD')).toBe('notes.txt')
    expect(await statusLines(tree)).toEqual([])
  })
})

describe('[어댑터] 정리의 git 작업 (시나리오 8)', () => {
  it('브랜치 커밋이 원격이나 기준 브랜치에 있는지 조상으로 본다', async () => {
    const fixed = fix()
    expect(await isAncestor(repo, base, fixed)).toBe(true)
    expect(await isAncestor(repo, fixed, base)).toBe(false)
    expect(await isAncestor(repo, fixed, fixed)).toBe(true)
    await expect(isAncestor(repo, 'no-such-ref', fixed)).rejects.toBeInstanceOf(GitError)
    expect(await refCommit(repo, `refs/remotes/origin/${BRANCH}`)).toBeNull()
    await pushBranch(tree, BRANCH)
    const pushed = await refCommit(repo, `refs/remotes/origin/${BRANCH}`)
    expect(pushed && (await isAncestor(repo, fixed, pushed))).toBe(true)
  })

  it('worktree의 git 폴더에 남은 잠금 파일을 찾는다. git worktree remove는 index.lock을 막지 않는다', async () => {
    expect(await lockFiles(tree)).toEqual([])
    const lock = path.resolve(tree, git(tree, 'rev-parse', '--git-path', 'index.lock'))
    fs.writeFileSync(lock, '')
    expect(await lockFiles(tree)).toEqual(['index.lock'])
    await removeWorktree(repo, tree, { force: false })
    expect(fs.existsSync(tree)).toBe(false)
    expect(fs.existsSync(lock)).toBe(false)
  })

  it('커밋 안 된 변경이 있으면 force 없이는 지우지 않는다. force면 무시하는 파일과 함께 지운다', async () => {
    fix()
    writeFiles(tree, { 'notes.txt': '메모\n', 'node_modules/pkg/index.js': 'keep\n' })
    await expect(removeWorktree(repo, tree, { force: false })).rejects.toBeInstanceOf(GitError)
    expect(fs.existsSync(path.join(tree, 'notes.txt'))).toBe(true)
    await removeWorktree(repo, tree, { force: true })
    expect(fs.existsSync(tree)).toBe(false)
    expect(git(repo, 'worktree', 'list', '--porcelain')).not.toContain('worktree ' + tree)
    // 브랜치와 커밋은 남는다
    expect(await refCommit(repo, `refs/heads/${BRANCH}`)).not.toBeNull()
  })

  it('무시하는 파일만 있으면 force 없이 지운다', async () => {
    writeFiles(tree, { 'node_modules/pkg/index.js': 'keep\n' })
    await removeWorktree(repo, tree, { force: false })
    expect(fs.existsSync(tree)).toBe(false)
  })

  it('worktree가 쓰는 브랜치는 지우지 않는다. worktree를 지운 뒤에는 작업 브랜치와 백업 브랜치를 지운다', async () => {
    const backup = `${BRANCH}-discarded-1`
    git(repo, 'branch', backup, base)
    await expect(deleteBranches(repo, [BRANCH])).rejects.toBeInstanceOf(GitError)
    await removeWorktree(repo, tree, { force: false })
    await deleteBranches(repo, [BRANCH, backup])
    expect(git(repo, 'branch', '--list', 'relay/*')).toBe('')
    await deleteBranches(repo, [])
  })
})

describe('[어댑터] gh pr list·create (7-4, 가짜 gh)', () => {
  const env = () => ({ ...process.env, FAKE_GH_RECORD: path.join(root, 'record') })
  const records = () =>
    fs
      .readFileSync(path.join(root, 'record', 'fake-gh.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string; args: string[]; cwd: string; body?: string })

  it('PR을 만들고 주소를 돌려준다. 본문은 --body-file로, draft는 --draft로 준다. 같은 head의 열린 PR을 찾는다', async () => {
    fix()
    await pushBranch(tree, BRANCH)
    const gh = { repo: remote, cwd: repo, env: env() }
    expect(await ghOpenPr(FAKE_GH, { ...gh, head: BRANCH })).toBeNull()
    const url = await ghCreatePr(FAKE_GH, {
      ...gh,
      base: 'main',
      head: BRANCH,
      title: '빈 배열의 평균을 0으로',
      body: '## 요약\n고쳤다 "따옴표" & 기호\n',
      draft: true,
    })
    expect(url).toBe('https://github.test/local/sample/pull/1')
    const create = records().find((r) => r.type === 'pr create')
    expect(create?.args).toEqual([
      'pr',
      'create',
      '--repo',
      remote,
      '--base',
      'main',
      '--head',
      BRANCH,
      '--title',
      '빈 배열의 평균을 0으로',
      '--body-file',
      expect.any(String),
      '--draft',
    ])
    expect(create?.body).toBe('## 요약\n고쳤다 "따옴표" & 기호\n')
    expect(fs.realpathSync.native(create?.cwd ?? '')).toBe(repo)
    // 본문 임시 파일은 지운다
    expect(fs.existsSync(create?.args[12] ?? '')).toBe(false)
    expect(await ghOpenPr(FAKE_GH, { ...gh, head: BRANCH })).toEqual({
      url,
      number: 1,
      isDraft: true,
      baseRefName: 'main',
    })
    expect(records().find((r) => r.type === 'pr list')?.args).toEqual([
      'pr',
      'list',
      '--repo',
      remote,
      '--head',
      BRANCH,
      '--state',
      'open',
      '--json',
      'url,number,isDraft,baseRefName',
      '--limit',
      '1',
    ])
  })

  it('gh가 실패하면 오류다. push하지 않은 브랜치로는 PR을 만들지 못한다', async () => {
    const gh = { repo: remote, cwd: repo, env: env() }
    const create = { ...gh, base: 'main', head: BRANCH, title: 't', body: 'b', draft: false }
    await expect(ghCreatePr(FAKE_GH, create)).rejects.toThrow(/Head sha can't be blank/)
    const failing = { ...gh, env: { ...env(), FAKE_GH_FAIL: 'list' } }
    await expect(ghOpenPr(FAKE_GH, { ...failing, head: BRANCH })).rejects.toBeInstanceOf(GhError)
    await expect(
      ghOpenPr(path.join(root, 'no-gh'), { ...gh, head: BRANCH }),
    ).rejects.toBeInstanceOf(GhError)
  })
})
