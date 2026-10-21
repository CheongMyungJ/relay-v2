// [어댑터] 서브모듈 Work의 git (D413~D416). 서브모듈 레포의 worktree를 메인 레포의 통합 검증 worktree 안 서브모듈
// 자리에 만든다. 메인 worktree에서 한 git submodule update가 서브모듈 저장소의 core.worktree를 바꿔 써 사용자
// 체크아웃을 깨는 것, 환경 변수 설정으로 막는 것, 앱이 되돌리는 것, 지우는 순서를 실제 git으로 본다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addDetachedWorktree,
  addWorktree,
  currentBranch,
  headBranch,
  initSubmodule,
  isGitlinkAt,
  originHead,
  removeWorktree,
  repairSubmoduleWorktree,
  statusLines,
  submoduleList,
} from '../../src/adapters/git'
import { submoduleGuardEnv } from '../../src/core/submodule'
import { addSubmodule, git, makeRepo, writeFiles } from '../support/repo'

const BRANCH = 'relay/w-20261020-001'
/** 로컬 경로의 서브모듈을 받게 한다 (git 2.38.1부터 file 전송은 기본으로 막힘) */
const FILE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'protocol.file.allow',
  GIT_CONFIG_VALUE_0: 'always',
}
/** 에이전트 세션의 환경 (D415): file 전송 설정 뒤에 lib의 update=none을 붙인다 */
const GUARDED: NodeJS.ProcessEnv = { ...FILE_ENV, ...submoduleGuardEnv(FILE_ENV, ['lib']) }

let root: string
let repo: string
/** 사용자 체크아웃의 서브모듈 폴더 (서브모듈 프로젝트의 레포 경로) */
let lib: string
/** 메인 통합 검증 worktree */
let main: string
/** 그 안의 서브모듈 Work worktree */
let tree: string

const coreWorktree = () =>
  git(root, 'config', '-f', path.join(repo, '.git', 'modules', 'lib', 'config'), 'core.worktree')

function gitEnv(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): void {
  // repo.ts의 git은 process.env를 쓴다. 여기서는 환경을 골라 돌린다
  execFileSync('git', args, { cwd, env, stdio: 'ignore' })
}

beforeEach(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-subwork-')))
  repo = makeRepo(root, 'app', { 'README.md': '# app\n' }).repo
  addSubmodule(repo, path.join(root, 'lib-src'), 'lib', { 'lib.txt': 'lib\n' })
  addSubmodule(repo, path.join(root, 'vendor-src'), 'vendor', { 'v.txt': 'v\n' })
  lib = path.join(repo, 'lib')
  main = path.join(root, 'worktrees', 'w')
  tree = path.join(main, 'lib')
  await addDetachedWorktree(repo, main, git(repo, 'rev-parse', 'HEAD'))
  await addWorktree(lib, tree, BRANCH, git(lib, 'rev-parse', 'HEAD'))
  git(tree, 'config', 'user.email', 'relay-test@example.com')
  git(tree, 'config', 'user.name', 'relay test')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

describe('[어댑터] 서브모듈 Work의 worktree (D413, D414)', () => {
  it('서브모듈 목록은 받아 둔 것을 가리고, 받지 않은 것은 받는다. origin/HEAD를 읽는다', async () => {
    expect(await submoduleList(repo)).toEqual([
      { name: 'lib', path: 'lib', initialized: true },
      { name: 'vendor', path: 'vendor', initialized: true },
    ])
    const clone = path.join(root, 'clone')
    git(root, 'clone', '-q', repo, clone)
    expect(await submoduleList(clone)).toEqual([
      { name: 'lib', path: 'lib', initialized: false },
      { name: 'vendor', path: 'vendor', initialized: false },
    ])
    await initSubmodule(clone, 'lib', { env: FILE_ENV })
    expect((await submoduleList(clone)).map((e) => e.initialized)).toEqual([true, false])
    expect(await originHead(path.join(clone, 'lib'))).toBe('main')
  })

  it('메인 worktree 안의 서브모듈 자리에 서브모듈 레포의 worktree가 있고, 커밋은 서브모듈 레포에 쌓인다', async () => {
    expect(await currentBranch(tree)).toBe(BRANCH)
    // Windows의 git은 경로를 /로 쓴다
    expect(path.resolve(git(tree, 'rev-parse', '--show-toplevel'))).toBe(tree)
    writeFiles(tree, { 'lib.txt': '고침\n' })
    git(tree, 'commit', '-q', '-am', '서브모듈 고침')
    expect(git(lib, 'log', '-1', '--format=%s', BRANCH)).toBe('서브모듈 고침')
    // 메인 worktree에는 가리키는 커밋이 바뀐 것으로만 보인다. 사용자 체크아웃은 그대로다
    expect(await statusLines(main)).toEqual([' M lib'])
    expect(git(repo, 'status', '--porcelain')).toBe('')
    expect(git(lib, 'status', '--porcelain')).toBe('')
  })

  it('보호 없이 git submodule update를 하면 사용자 체크아웃이 깨지고, 앱이 되돌린다 (D415)', async () => {
    const original = coreWorktree()
    expect(await repairSubmoduleWorktree(lib)).toBe(false)
    gitEnv(main, FILE_ENV, 'submodule', 'update', '--init', '--recursive')
    expect(coreWorktree()).not.toBe(original)
    expect(() => git(lib, 'status')).toThrow()

    expect(await repairSubmoduleWorktree(lib)).toBe(true)
    expect(coreWorktree()).toBe(original)
    expect(git(lib, 'status', '--porcelain')).toBe('')
    expect(await repairSubmoduleWorktree(lib)).toBe(false)
  })

  it('환경 변수 설정으로 막으면 이 서브모듈만 건너뛰고 다른 서브모듈은 받는다 (D415)', async () => {
    const original = coreWorktree()
    writeFiles(tree, { 'lib.txt': '고침\n' })
    git(tree, 'commit', '-q', '-am', '서브모듈 고침')
    gitEnv(main, GUARDED, 'submodule', 'update', '--init', '--recursive')
    expect(coreWorktree()).toBe(original)
    expect(await currentBranch(tree)).toBe(BRANCH)
    expect(fs.existsSync(path.join(main, 'vendor', 'v.txt'))).toBe(true)
    // 명시한 --checkout은 막지 못한다: 작업 브랜치에서 벗어나고 설정이 바뀐다. 앱이 되돌린다
    gitEnv(main, GUARDED, 'submodule', 'update', '--checkout', '--', 'lib')
    expect(await currentBranch(tree)).toBeNull()
    expect(await repairSubmoduleWorktree(lib)).toBe(true)
    expect(coreWorktree()).toBe(original)
  })

  it('여러 Work가 함께 되돌려도 하나만 고치고 잠금 파일에서 실패하지 않는다 (D415)', async () => {
    const original = coreWorktree()
    gitEnv(main, FILE_ENV, 'submodule', 'update', '--init', '--recursive')
    const results = await Promise.all([1, 2, 3, 4].map(() => repairSubmoduleWorktree(lib)))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(coreWorktree()).toBe(original)
  })

  it('메인 커밋에 서브모듈 자리가 있는지 본다. 브랜치는 분리된 HEAD와 git 실패를 가린다 (D414)', async () => {
    const first = git(repo, 'rev-list', '--max-parents=0', 'HEAD')
    expect(await isGitlinkAt(repo, 'HEAD', 'lib')).toBe(true)
    expect(await isGitlinkAt(repo, first, 'lib')).toBe(false)
    expect(await isGitlinkAt(repo, 'HEAD', 'README.md')).toBe(false)
    expect(await isGitlinkAt(repo, 'HEAD', 'li')).toBe(false)

    expect(await headBranch(tree)).toBe(BRANCH)
    git(tree, 'checkout', '-q', '--detach')
    expect(await headBranch(tree)).toBeNull()
    await expect(headBranch(path.join(root, 'missing'))).rejects.toThrow()
  })

  it('저장소가 체크아웃 안(.git 디렉터리)에 있으면 core.worktree가 없어야 한다', async () => {
    const inner = makeRepo(root, 'plain', { 'a.txt': 'a\n' }).repo
    expect(await repairSubmoduleWorktree(inner)).toBe(false)
    git(inner, 'config', 'core.worktree', path.join(root, 'elsewhere'))
    expect(await repairSubmoduleWorktree(inner)).toBe(true)
    expect(git(inner, 'status', '--porcelain')).toBe('')
    expect(await repairSubmoduleWorktree(path.join(root, 'missing'))).toBe(false)
  })

  it('서브모듈 worktree를 먼저, 메인 worktree를 --force로 지운다. 거꾸로 하면 안의 작업이 확인 없이 사라진다 (D416)', async () => {
    writeFiles(tree, { 'draft.txt': '커밋 안 함\n' })
    // 서브모듈 worktree는 커밋 안 된 변경이 있으면 --force 없이 지우지 않는다(정리 요약의 확인)
    await expect(removeWorktree(lib, tree, { force: false })).rejects.toThrow()
    await removeWorktree(lib, tree, { force: true })
    gitEnv(main, GUARDED, 'submodule', 'update', '--init', '--', 'vendor')
    writeFiles(main, { 'README.md': '메인 쪽 변경\n' })
    await removeWorktree(repo, main, { force: true })
    expect(fs.existsSync(main)).toBe(false)
    expect(git(repo, 'worktree', 'list', '--porcelain')).not.toContain(main)
    expect(git(lib, 'worktree', 'list', '--porcelain')).not.toContain(tree)
    expect(git(lib, 'status', '--porcelain')).toBe('')

    // 거꾸로: 메인 worktree를 먼저 지우면 git은 안의 서브모듈 worktree를 묻지 않고 지운다(실행)
    const main2 = path.join(root, 'worktrees', 'w2')
    const tree2 = path.join(main2, 'lib')
    await addDetachedWorktree(repo, main2, git(repo, 'rev-parse', 'HEAD'))
    await addWorktree(lib, tree2, `${BRANCH}-2`, git(lib, 'rev-parse', 'HEAD'))
    writeFiles(tree2, { 'draft.txt': '커밋 안 함\n' })
    await removeWorktree(repo, main2, { force: true })
    expect(fs.existsSync(path.join(tree2, 'draft.txt'))).toBe(false)
  })
})
