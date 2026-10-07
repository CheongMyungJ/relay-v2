// [어댑터] 서브모듈이 있는 레포 (D382). relay는 서브모듈 안을 다루지 않는다: 커밋 안 된 변경에서 서브모듈 안의 수정과
// 새 파일은 빼고 서브모듈이 가리키는 커밋이 바뀐 것만 넣는다. 체크아웃된 서브모듈이 있는 worktree는 --force로만
// 지워진다. 실제 git으로 서브모듈과 worktree를 만들어 돌린다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GitError,
  addWorktree,
  checkedOutSubmodules,
  commitAll,
  headCommit,
  onlySubmoduleChanges,
  removeWorktree,
  stashAll,
  statusLines,
} from '../../src/adapters/git'
import { addSubmodule, checkoutSubmodules, git, makeRepo, writeFiles } from '../support/repo'

const BRANCH = 'relay/w-20261007-001'

let root: string
let repo: string
let tree: string
let lib: string

beforeEach(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-submodule-')))
  repo = makeRepo(root, 'sample', { 'README.md': '# sample\n' }).repo
  addSubmodule(repo, path.join(root, 'lib-src'), 'lib', { 'lib.txt': 'lib\n' })
  tree = path.join(root, 'worktree')
  lib = path.join(tree, 'lib')
  await addWorktree(repo, tree, BRANCH, git(repo, 'rev-parse', 'HEAD'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

describe('[어댑터] 서브모듈이 있는 레포 (D382)', () => {
  it('새 worktree의 서브모듈은 빈 폴더다. 체크아웃한 서브모듈만 찾는다', async () => {
    expect(fs.readdirSync(lib)).toEqual([])
    expect(await checkedOutSubmodules(tree)).toEqual([])
    checkoutSubmodules(tree)
    expect(await checkedOutSubmodules(tree)).toEqual(['lib'])
    expect(await statusLines(tree)).toEqual([])
    expect(await onlySubmoduleChanges(tree)).toBe(false)
  })

  it('서브모듈 안의 수정과 새 파일은 커밋 안 된 변경이 아니다. 가리키는 커밋이 바뀐 것은 변경이다', async () => {
    checkoutSubmodules(tree)
    writeFiles(lib, { 'lib.txt': '바뀜\n', 'scratch.txt': '메모\n' })
    expect(git(tree, 'status', '--porcelain')).toBe('M lib')
    expect(await statusLines(tree)).toEqual([])
    expect(await onlySubmoduleChanges(tree)).toBe(false)

    git(lib, 'commit', '-q', '-am', '서브모듈 커밋')
    expect(await statusLines(tree)).toEqual([' M lib'])
    expect(await onlySubmoduleChanges(tree)).toBe(true)

    writeFiles(tree, { 'notes.txt': '메모\n' })
    expect((await statusLines(tree)).sort()).toEqual([' M lib', '?? notes.txt'])
    expect(await onlySubmoduleChanges(tree)).toBe(false)
  })

  it('stash는 가리키는 커밋이 바뀐 것을 넣지 않고 둔다. 커밋하면 그것도 커밋한다 (7-5)', async () => {
    checkoutSubmodules(tree)
    git(lib, 'commit', '-q', '--allow-empty', '-m', '서브모듈 커밋')
    const moved = git(lib, 'rev-parse', 'HEAD')
    writeFiles(tree, { 'notes.txt': '메모\n' })

    const stash = await stashAll(tree, '버린 변경')
    expect(
      git(repo, 'stash', 'show', '--include-untracked', '--name-only', stash).split('\n'),
    ).toEqual(['notes.txt'])
    expect(await statusLines(tree)).toEqual([' M lib'])
    // 그것만 남으면 넣을 것이 없어 실패한다. 전달은 그때 stash하지 않는다
    await expect(stashAll(tree, 'x')).rejects.toBeInstanceOf(GitError)

    const before = await headCommit(tree)
    const commit = await commitAll(tree, '남은 변경')
    expect(commit).not.toBe(before)
    expect(git(tree, 'rev-parse', 'HEAD:lib')).toBe(moved)
    expect(await statusLines(tree)).toEqual([])
  })

  it('체크아웃된 서브모듈이 있는 worktree는 변경이 없어도 --force로만 지워진다 (시나리오 8)', async () => {
    checkoutSubmodules(tree)
    expect(await statusLines(tree)).toEqual([])
    await expect(removeWorktree(repo, tree, { force: false })).rejects.toThrow(
      /containing submodules/,
    )
    expect(fs.existsSync(path.join(lib, 'lib.txt'))).toBe(true)
    await removeWorktree(repo, tree, { force: true })
    expect(fs.existsSync(tree)).toBe(false)
    expect(git(repo, 'worktree', 'list', '--porcelain')).not.toContain(tree)
  })
})
