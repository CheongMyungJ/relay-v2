// [어댑터] 서브모듈이 있는 레포 (D382, D384). relay는 서브모듈 안을 다루지 않는다: 커밋 안 된 변경에서 서브모듈 안의
// 수정과 새 파일은 빼고(따로 알림) 서브모듈이 가리키는 커밋이 바뀐 것만 넣는다. [변경 버리고 진행]은 가리키는 커밋을
// HEAD로 되돌린다. 받아 둔 서브모듈이 있는 worktree는 --force로만 지워진다. 실제 git으로 서브모듈과 worktree를 만들어 돌린다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  GitError,
  addWorktree,
  checkedOutSubmodules,
  commitAll,
  dirtySubmodules,
  discardChanges,
  headCommit,
  removeWorktree,
  stashAll,
  statusLines,
  submodulePaths,
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

describe('[어댑터] 서브모듈이 있는 레포 (D382, D384)', () => {
  it('새 worktree의 서브모듈은 빈 폴더다. 서브모듈은 .gitmodules와 index로 찾고, 받은 것은 따로 가린다', async () => {
    expect(fs.readdirSync(lib)).toEqual([])
    expect(await submodulePaths(tree)).toEqual(['lib'])
    expect(await checkedOutSubmodules(tree)).toEqual([])
    checkoutSubmodules(tree)
    expect(await checkedOutSubmodules(tree)).toEqual(['lib'])
    expect(await statusLines(tree)).toEqual([])
    expect(await dirtySubmodules(tree)).toEqual([])
  })

  it('.gitmodules가 없으면 서브모듈이 없다. .gitmodules 없이 더한 중첩 레포도 서브모듈로 보지 않는다', async () => {
    const plain = makeRepo(root, 'plain', { 'README.md': '# plain\n' }).repo
    expect(await submodulePaths(plain)).toEqual([])
    makeRepo(plain, 'nested', { 'a.txt': 'a\n' })
    git(plain, 'add', 'nested')
    expect(git(plain, 'ls-files', '--stage', 'nested')).toMatch(/^160000 /)
    expect(await submodulePaths(plain)).toEqual([])
    expect(await dirtySubmodules(plain)).toEqual([])
  })

  it('서브모듈 안의 수정과 새 파일은 커밋 안 된 변경이 아니고 따로 찾는다. 가리키는 커밋이 바뀐 것은 변경이다', async () => {
    checkoutSubmodules(tree)
    writeFiles(lib, { 'lib.txt': '바뀜\n' })
    expect(git(tree, 'status', '--porcelain')).toBe('M lib')
    expect(await statusLines(tree)).toEqual([])
    expect(await dirtySubmodules(tree)).toEqual(['lib'])

    git(lib, 'commit', '-q', '-am', '서브모듈 커밋')
    expect(await statusLines(tree)).toEqual([' M lib'])
    expect(await dirtySubmodules(tree)).toEqual([])
    writeFiles(lib, { 'scratch.txt': '메모\n' })
    expect(await dirtySubmodules(tree)).toEqual(['lib'])
  })

  it('[변경 버리고 진행]은 가리키는 커밋을 HEAD로 되돌리고 나머지를 stash한다. 그것만 있으면 stash가 없다 (7-5)', async () => {
    checkoutSubmodules(tree)
    const original = git(lib, 'rev-parse', 'HEAD')
    git(lib, 'commit', '-q', '--allow-empty', '-m', '서브모듈 커밋')
    const moved = git(lib, 'rev-parse', 'HEAD')
    writeFiles(tree, { 'notes.txt': '메모\n' })
    // git stash만으로는 가리키는 커밋을 넣지 못하고 남는다
    expect((await statusLines(tree)).sort()).toEqual([' M lib', '?? notes.txt'])

    const stash = await discardChanges(tree, '버린 변경')
    expect(stash).not.toBeNull()
    expect(
      git(repo, 'stash', 'show', '--include-untracked', '--name-only', stash ?? '').split('\n'),
    ).toEqual(['notes.txt'])
    expect(await statusLines(tree)).toEqual([])
    expect(git(lib, 'rev-parse', 'HEAD')).toBe(original)
    // 서브모듈 안의 커밋은 서브모듈 저장소에 남는다
    expect(git(lib, 'cat-file', '-t', moved)).toBe('commit')

    git(lib, 'checkout', '-q', moved)
    const before = git(repo, 'stash', 'list')
    expect(await discardChanges(tree, '버린 변경')).toBeNull()
    expect(git(repo, 'stash', 'list')).toBe(before)
    expect(await statusLines(tree)).toEqual([])
    // 깨끗하면 할 일이 없다
    expect(await discardChanges(tree, '버린 변경')).toBeNull()
  })

  it('체크아웃 안 된 서브모듈의 index만 바뀐 것(git rm --cached)도 되돌린다', async () => {
    git(tree, 'rm', '-q', '--cached', 'lib')
    expect(await statusLines(tree)).toEqual(['D  lib'])
    await expect(stashAll(tree, 'x')).rejects.toBeInstanceOf(GitError)
    expect(await discardChanges(tree, '버린 변경')).toBeNull()
    expect(await statusLines(tree)).toEqual([])
    expect(git(tree, 'ls-files', '--stage', 'lib')).toMatch(/^160000 /)
  })

  it('[커밋하고 진행]은 가리키는 커밋도 커밋한다', async () => {
    checkoutSubmodules(tree)
    git(lib, 'commit', '-q', '--allow-empty', '-m', '서브모듈 커밋')
    const moved = git(lib, 'rev-parse', 'HEAD')
    const before = await headCommit(tree)
    expect(await commitAll(tree, '남은 변경')).not.toBe(before)
    expect(git(tree, 'rev-parse', 'HEAD:lib')).toBe(moved)
    expect(await statusLines(tree)).toEqual([])
  })

  it('받아 둔 서브모듈이 있는 worktree는 변경이 없어도 --force로만 지워진다 (시나리오 8)', async () => {
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

  it('deinit한 뒤 서브모듈 저장소만 남아도 받아 둔 것으로 센다. git은 --force 없이 지우지 않는다', async () => {
    checkoutSubmodules(tree)
    git(tree, 'submodule', 'deinit', '-q', '--all', '-f')
    expect(fs.readdirSync(lib)).toEqual([])
    expect(await checkedOutSubmodules(tree)).toEqual(['lib'])
    await expect(removeWorktree(repo, tree, { force: false })).rejects.toThrow(
      /containing submodules/,
    )
    // .gitmodules에서 빠져도 서브모듈 저장소가 남았으면 그 폴더를 넣는다
    fs.rmSync(path.join(tree, '.gitmodules'))
    const modules = path.join(git(tree, 'rev-parse', '--absolute-git-dir'), 'modules')
    expect((await checkedOutSubmodules(tree)).map((p) => path.resolve(p))).toEqual([
      path.resolve(modules),
    ])
    await removeWorktree(repo, tree, { force: true })
    expect(fs.existsSync(tree)).toBe(false)
  })
})
