// [어댑터] 되감기의 git 작업 (6.2, D115~D117): 되돌릴 커밋 수, 백업 브랜치 찾기, 커밋 안 된 변경까지 담는
// 백업 브랜치, worktree 되돌리기. 실제 git으로 worktree를 만들어 돌린다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GitError,
  addWorktree,
  countCommits,
  createBackup,
  headCommit,
  refNames,
  resetHard,
  statusLines,
} from '../../src/adapters/git'
import { backupMessage, backupPattern, nextBackupBranch } from '../../src/core/rewind'
import { git, makeRepo, writeFiles } from '../flow/repo'

const WORK_ID = 'w-20260927-001'
const BRANCH = `relay/${WORK_ID}`

let root: string
let repo: string
let tree: string
let base: string

beforeEach(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-git-')))
  repo = makeRepo(root, 'sample', {
    '.gitignore': 'node_modules/\n',
    'src/avg.js': 'export const avg = () => NaN\n',
    'README.md': '# sample\n',
  }).repo
  base = git(repo, 'rev-parse', 'HEAD')
  tree = path.join(root, 'worktree')
  await addWorktree(repo, tree, BRANCH, base)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

/** worktree에서 fix가 커밋하고, 커밋하지 않은 변경과 추적하지 않는 파일과 무시하는 파일을 남긴다 */
function dirtyAfterFix(): string {
  writeFiles(tree, { 'src/avg.js': 'export const avg = (xs) => (xs.length ? 1 : 0)\n' })
  git(tree, 'commit', '-q', '-am', 'fix')
  const fixed = git(tree, 'rev-parse', 'HEAD')
  writeFiles(tree, {
    'src/avg.js': 'export const avg = (xs) => (xs.length ? 2 : 0)\n',
    'notes.txt': '메모\n',
    'node_modules/pkg/index.js': 'keep\n',
  })
  fs.rmSync(path.join(tree, 'README.md'))
  return fixed
}

describe('[어댑터] 되감기의 git 작업 (6.2, D115~D117)', () => {
  it('Work 브랜치가 있으면 그 아래 이름은 git이 만들지 않는다. 백업 브랜치는 옆 이름이다 (D115)', () => {
    expect(() => git(repo, 'branch', `${BRANCH}/discarded-1`, base)).toThrow()
    git(repo, 'branch', `${BRANCH}-discarded-1`, base)
    expect(
      git(repo, 'branch', '--list', 'relay/*')
        .split('\n')
        .map((l) => l.slice(2)),
    ).toEqual([BRANCH, `${BRANCH}-discarded-1`])
  })

  it('되돌릴 커밋 수를 세고 이 Work의 백업 브랜치만 찾는다', async () => {
    expect(await countCommits(tree, base)).toBe(0)
    dirtyAfterFix()
    expect(await countCommits(tree, base)).toBe(1)
    git(repo, 'branch', `${BRANCH}-discarded-1`, base)
    git(repo, 'branch', `${BRANCH}-discarded-12`, base)
    git(repo, 'branch', 'relay/w-20260927-002-discarded-3', base)
    const found = await refNames(repo, backupPattern(WORK_ID))
    expect(found.sort()).toEqual([`${BRANCH}-discarded-1`, `${BRANCH}-discarded-12`])
    expect(nextBackupBranch(WORK_ID, found)).toBe(`${BRANCH}-discarded-13`)
  })

  it('커밋 안 된 변경은 백업 브랜치의 커밋 하나에 담고, worktree는 되돌릴 커밋과 같아진다 (D116)', async () => {
    const fixed = dirtyAfterFix()
    const before = await statusLines(tree)
    expect(before.sort()).toEqual([' D README.md', ' M src/avg.js', '?? notes.txt'])
    const backup = `${BRANCH}-discarded-1`

    const commit = await createBackup(tree, backup, {
      uncommitted: true,
      message: backupMessage(WORK_ID),
    })
    // 진짜 index, 작업 트리, Work 브랜치는 그대로다
    expect((await statusLines(tree)).sort()).toEqual(before.sort())
    expect(await headCommit(tree)).toBe(fixed)
    // 백업 커밋은 HEAD 위의 커밋 하나이고 작업 트리의 상태를 담는다. 무시하는 파일은 없다
    expect(git(repo, 'rev-parse', backup)).toBe(commit)
    expect(git(repo, 'rev-parse', `${commit}^`)).toBe(fixed)
    expect(git(repo, 'log', '-1', '--format=%s', commit)).toBe(backupMessage(WORK_ID))
    expect(git(repo, 'show', `${commit}:src/avg.js`)).toBe(
      'export const avg = (xs) => (xs.length ? 2 : 0)',
    )
    expect(git(repo, 'show', `${commit}:notes.txt`)).toBe('메모')
    expect(git(repo, 'ls-tree', '-r', '--name-only', commit).split('\n').sort()).toEqual([
      '.gitignore',
      'notes.txt',
      'src/avg.js',
    ])
    expect(git(repo, 'rev-list', '--count', `${base}..${backup}`)).toBe('2')

    await resetHard(tree, base, { clean: true })
    expect(await headCommit(tree)).toBe(base)
    expect(await statusLines(tree)).toEqual([])
    expect(git(repo, 'rev-parse', BRANCH)).toBe(base)
    // Windows의 core.autocrlf면 CRLF로 체크아웃된다
    expect(fs.readFileSync(path.join(tree, 'README.md'), 'utf8').replace(/\r\n/g, '\n')).toBe(
      '# sample\n',
    )
    expect(fs.existsSync(path.join(tree, 'notes.txt'))).toBe(false)
    // 무시하는 파일은 남는다(예: 설치한 의존성)
    expect(fs.existsSync(path.join(tree, 'node_modules', 'pkg', 'index.js'))).toBe(true)
    // 메인 체크아웃은 그대로다
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(base)
    expect(git(repo, 'status', '--porcelain')).toBe('')
  })

  it('커밋 안 된 변경을 백업하지 않으면 브랜치는 HEAD를 가리킨다', async () => {
    const fixed = dirtyAfterFix()
    git(tree, 'stash', '-u', '-q')
    expect(
      await createBackup(tree, `${BRANCH}-discarded-1`, { uncommitted: false, message: 'x' }),
    ).toBe(fixed)
    expect(git(repo, 'rev-parse', `${BRANCH}-discarded-1`)).toBe(fixed)
  })

  it('같은 이름의 백업 브랜치가 있으면 실패하고 아무것도 바꾸지 않는다', async () => {
    const fixed = dirtyAfterFix()
    git(repo, 'branch', `${BRANCH}-discarded-1`, base)
    const before = await statusLines(tree)
    await expect(
      createBackup(tree, `${BRANCH}-discarded-1`, { uncommitted: true, message: 'x' }),
    ).rejects.toBeInstanceOf(GitError)
    expect(git(repo, 'rev-parse', `${BRANCH}-discarded-1`)).toBe(base)
    expect(await headCommit(tree)).toBe(fixed)
    expect((await statusLines(tree)).sort()).toEqual(before.sort())
  })
})
