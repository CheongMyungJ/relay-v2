// [어댑터] 묶음 Work의 git (D471~D478). 메인 worktree를 작업 브랜치로 두고 그 안에 서브모듈 레포의 worktree 둘을 둔다.
// 커밋의 서브모듈 읽기, 메인의 [커밋하고 진행]·[변경 버리고 진행]이 고른 서브모듈 자리를 건드리지 않는 것, 메인이 새 서브모듈
// 커밋을 가리키게 하는 커밋, 받아 둔 서브모듈 비우기를 실제 git으로 본다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addWorktree,
  commitAll,
  clearSubmodule,
  commitGitlinks,
  discardChanges,
  gitlinkAt,
  initSubmodule,
  removeWorktree,
  statusLines,
  submodulesAt,
} from '../../src/adapters/git'
import { withoutRepoPaths } from '../../src/core/repos'
import { addSubmodule, git, makeRepo, writeFiles } from '../support/repo'

const BRANCH = 'relay/w-20261024-001'
/** 로컬 경로의 서브모듈을 받게 한다 (git 2.38.1부터 file 전송은 기본으로 막힘) */
const FILE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'protocol.file.allow',
  GIT_CONFIG_VALUE_0: 'always',
}
const opts = { env: FILE_ENV }

let root: string
let repo: string
/** 메인 worktree (작업 브랜치) */
let main: string

beforeEach(async () => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-bundle-')))
  repo = makeRepo(root, 'app', { 'README.md': '# app\n' }).repo
  addSubmodule(repo, path.join(root, 'lib-src'), 'lib', { 'lib.txt': 'lib\n' })
  addSubmodule(repo, path.join(root, 'ui-src'), 'pkg/ui', { 'ui.txt': 'ui\n' })
  addSubmodule(repo, path.join(root, 'vendor-src'), 'vendor', { 'v.txt': 'v\n' })
  main = path.join(root, 'worktrees', 'w')
  await addWorktree(repo, main, BRANCH, git(repo, 'rev-parse', 'HEAD'), opts)
  // 고른 서브모듈마다 메인 worktree 안의 그 자리에 서브모듈 레포의 worktree를 만든다 (D471)
  for (const p of ['lib', 'pkg/ui']) {
    const sub = path.join(repo, ...p.split('/'))
    git(sub, 'config', 'user.email', 'relay-test@example.com')
    git(sub, 'config', 'user.name', 'relay test')
    git(sub, 'config', 'commit.gpgsign', 'false')
    await addWorktree(
      sub,
      path.join(main, ...p.split('/')),
      BRANCH,
      git(sub, 'rev-parse', 'HEAD'),
      opts,
    )
  }
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

/** 서브모듈 worktree에 커밋하고 새 HEAD를 돌려준다 */
function commitIn(p: string, file: string, text: string): string {
  const dir = path.join(main, ...p.split('/'))
  writeFiles(dir, { [file]: text })
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', `${p} 고침`)
  return git(dir, 'rev-parse', 'HEAD')
}

describe('[어댑터] 묶음 Work의 git (D471~D478)', () => {
  it('커밋의 서브모듈은 그 커밋의 .gitmodules와 tree의 gitlink로 읽는다 (D472)', async () => {
    const head = git(repo, 'rev-parse', 'HEAD')
    expect(await submodulesAt(repo, head, opts)).toEqual([
      { name: 'lib', path: 'lib' },
      { name: 'pkg/ui', path: 'pkg/ui' },
      { name: 'vendor', path: 'vendor' },
    ])
    // 서브모듈을 더하기 전의 커밋에는 없다
    const first = git(repo, 'rev-list', '--max-parents=0', 'HEAD')
    expect(await submodulesAt(repo, first, opts)).toEqual([])
  })

  it('서브모듈 worktree에 커밋하면 메인에는 그 자리만 바뀐 것으로 보이고, 걸러 내면 메인 쪽 변경만 남는다 (D475)', async () => {
    commitIn('lib', 'lib.txt', 'lib 고침\n')
    writeFiles(main, { 'README.md': '메인 고침\n' })
    const lines = await statusLines(main, opts)
    expect(lines).toEqual([' M README.md', ' M lib'])
    expect(withoutRepoPaths(lines, ['lib', 'pkg/ui'])).toEqual([' M README.md'])
  })

  it('메인의 [커밋하고 진행]은 고른 서브모듈 자리를 넣지 않는다 (D475)', async () => {
    const before = await gitlinkAt(main, 'HEAD', 'lib', opts)
    commitIn('lib', 'lib.txt', 'lib 고침\n')
    writeFiles(main, { 'NOTE.md': '메모\n' })
    await commitAll(main, 'relay(w): 완료 전 남은 변경', opts, ['lib', 'pkg/ui'])
    expect(git(main, 'show', '--name-only', '--format=', 'HEAD')).toBe('NOTE.md')
    expect(await gitlinkAt(main, 'HEAD', 'lib', opts)).toBe(before)
    // lib 자리는 여전히 바뀐 채이고 lib worktree는 작업 브랜치 그대로다
    expect(await statusLines(main, opts)).toEqual([' M lib'])
    expect(git(path.join(main, 'lib'), 'branch', '--show-current')).toBe(BRANCH)
  })

  it('메인의 [변경 버리고 진행]은 고른 서브모듈 자리를 되돌리지 않고 나머지만 stash한다 (D475)', async () => {
    const libHead = commitIn('lib', 'lib.txt', 'lib 고침\n')
    writeFiles(main, { 'README.md': '버릴 변경\n' })
    const stash = await discardChanges(main, 'relay(w): 완료 전 버린 변경', opts, ['lib', 'pkg/ui'])
    expect(stash).toMatch(/^[0-9a-f]{40}$/)
    expect(fs.readFileSync(path.join(main, 'README.md'), 'utf8')).toBe('# app\n')
    expect(git(path.join(main, 'lib'), 'rev-parse', 'HEAD')).toBe(libHead)
    expect(git(path.join(main, 'lib'), 'branch', '--show-current')).toBe(BRANCH)
    // 고른 자리만 남으면 넣을 것이 없다
    expect(await discardChanges(main, 'x', opts, ['lib', 'pkg/ui'])).toBeNull()
  })

  it('[변경 버리고 진행]은 git이 따옴표로 감싼 경로(공백)의 서브모듈 자리도 뺀다 (D475)', async () => {
    addSubmodule(repo, path.join(root, 'mod-src'), 'my lib', { 'm.txt': 'm\n' })
    const tree = path.join(root, 'worktrees', 'w2')
    await addWorktree(repo, tree, `${BRANCH}-2`, git(repo, 'rev-parse', 'HEAD'), opts)
    const sub = path.join(repo, 'my lib')
    git(sub, 'config', 'user.email', 'relay-test@example.com')
    git(sub, 'config', 'user.name', 'relay test')
    git(sub, 'config', 'commit.gpgsign', 'false')
    const dir = path.join(tree, 'my lib')
    await addWorktree(sub, dir, `${BRANCH}-2`, git(sub, 'rev-parse', 'HEAD'), opts)
    writeFiles(dir, { 'm.txt': 'm 고침\n' })
    git(dir, 'commit', '-qam', 'my lib 고침')
    expect(await statusLines(tree, opts)).toEqual([' M "my lib"'])
    expect(await discardChanges(tree, 'x', opts, ['my lib'])).toBeNull()
    expect(git(dir, 'branch', '--show-current')).toBe(`${BRANCH}-2`)
  })

  it('메인이 새 서브모듈 커밋을 가리키게 하는 커밋은 그 자리만 넣는다 (D478)', async () => {
    const lib = commitIn('lib', 'lib.txt', 'lib 고침\n')
    const ui = commitIn('pkg/ui', 'ui.txt', 'ui 고침\n')
    writeFiles(main, { 'README.md': '커밋하지 않을 변경\n' })
    const head = await commitGitlinks(
      main,
      [
        { path: 'lib', sha: lib },
        { path: 'pkg/ui', sha: ui },
      ],
      'relay(w): 서브모듈 맞춤',
      opts,
    )
    expect(git(main, 'rev-parse', 'HEAD')).toBe(head)
    expect(await gitlinkAt(main, 'HEAD', 'lib', opts)).toBe(lib)
    expect(await gitlinkAt(main, 'HEAD', 'pkg/ui', opts)).toBe(ui)
    expect(git(main, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort()).toEqual([
      'lib',
      'pkg/ui',
    ])
    expect(await statusLines(main, opts)).toEqual([' M README.md'])
    expect(await gitlinkAt(main, 'HEAD', 'README.md', opts)).toBeNull()
  })

  it('받아 둔 서브모듈은 비운 뒤 그 자리에 worktree를 만들 수 있다 (D473)', async () => {
    await initSubmodule(main, 'vendor', opts)
    const vendor = path.join(main, 'vendor')
    expect(fs.existsSync(path.join(vendor, 'v.txt'))).toBe(true)
    await clearSubmodule(main, 'vendor')
    expect(fs.readdirSync(vendor)).toEqual([])
    // 사용자 체크아웃의 서브모듈 등록(함께 쓰는 .git/config)은 그대로다
    expect(git(repo, 'config', '--get', 'submodule.vendor.url')).toContain('vendor-src')
    const sub = path.join(repo, 'vendor')
    await initSubmodule(repo, 'vendor', opts)
    await addWorktree(sub, vendor, BRANCH, git(sub, 'rev-parse', 'HEAD'), opts)
    expect(git(vendor, 'branch', '--show-current')).toBe(BRANCH)
    // 정리: 서브모듈 worktree를 먼저 지우면 메인 worktree를 지울 수 있다 (D482)
    for (const p of ['lib', 'pkg/ui', 'vendor']) {
      await removeWorktree(path.join(repo, ...p.split('/')), path.join(main, ...p.split('/')), {
        ...opts,
        force: false,
      })
    }
    await removeWorktree(repo, main, { ...opts, force: true })
    expect(fs.existsSync(main)).toBe(false)
    expect(git(path.join(repo, 'lib'), 'status', '--porcelain')).toBe('')
  })
})
