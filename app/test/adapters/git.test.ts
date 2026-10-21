// [어댑터] git 작업: 커밋 수, D418 전 되감기의 백업 브랜치 찾기([Work 정리]가 지운다, D115, D424), 머지한 PR에 없는
// 커밋(D329). 실제 git으로 worktree를 만들어 돌린다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addWorktree, commitsOnlyIn, countCommits, refNames } from '../../src/adapters/git'
import { backupPattern } from '../../src/core/cleanup'
import { git, makeRepo, writeFiles } from '../support/repo'

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

describe('[어댑터] D418 전 되감기의 백업 브랜치 (D115, D424)', () => {
  it('Work 브랜치가 있으면 그 아래 이름은 git이 만들지 않는다. 백업 브랜치는 옆 이름이다 (D115)', () => {
    expect(() => git(repo, 'branch', `${BRANCH}/discarded-1`, base)).toThrow()
    git(repo, 'branch', `${BRANCH}-discarded-1`, base)
    expect(
      git(repo, 'branch', '--list', 'relay/*')
        .split('\n')
        .map((l) => l.slice(2)),
    ).toEqual([BRANCH, `${BRANCH}-discarded-1`])
  })

  it('커밋 수를 세고 이 Work의 백업 브랜치만 찾는다', async () => {
    expect(await countCommits(tree, base)).toBe(0)
    dirtyAfterFix()
    expect(await countCommits(tree, base)).toBe(1)
    git(repo, 'branch', `${BRANCH}-discarded-1`, base)
    git(repo, 'branch', `${BRANCH}-discarded-12`, base)
    git(repo, 'branch', 'relay/w-20260927-002-discarded-3', base)
    const found = await refNames(repo, backupPattern(WORK_ID))
    expect(found.sort()).toEqual([`${BRANCH}-discarded-1`, `${BRANCH}-discarded-12`])
  })
})

describe('[어댑터] 머지한 PR에 없는 커밋 (D329)', () => {
  it('작업 브랜치에만 있는 커밋을 오래된 차례로 돌려준다. 머지한 head를 찾지 못하면 null', async () => {
    writeFiles(tree, { 'a.txt': '1\n' })
    git(tree, 'add', '.')
    git(tree, 'commit', '-q', '-m', '머지한 커밋')
    const merged = git(tree, 'rev-parse', 'HEAD')
    expect(await commitsOnlyIn(repo, `refs/heads/${BRANCH}`, merged)).toEqual([])
    writeFiles(tree, { 'b.txt': '2\n' })
    git(tree, 'add', '.')
    git(tree, 'commit', '-q', '-m', '미룬 push 하나')
    writeFiles(tree, { 'c.txt': '3\n' })
    git(tree, 'add', '.')
    git(tree, 'commit', '-q', '-m', '미룬 push 둘')
    const only = await commitsOnlyIn(repo, `refs/heads/${BRANCH}`, merged)
    expect(only?.map((c) => c.subject)).toEqual(['미룬 push 하나', '미룬 push 둘'])
    expect(only?.[1]?.sha).toBe(git(tree, 'rev-parse', 'HEAD'))
    expect(await commitsOnlyIn(repo, `refs/heads/${BRANCH}`, 'f'.repeat(40))).toBeNull()
  })
})
