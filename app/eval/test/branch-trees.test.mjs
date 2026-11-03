// 판정할 폴더: 체크아웃되지 않은 로컬 브랜치를 꺼낸다 (eval/lib/repo.mjs branchTrees). 맨 CLI와 relay가 같은 규칙을 쓴다
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { branchTrees } from '../lib/repo.mjs'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-trees-'))
  dirs.push(root)
  const r = path.join(root, 'repo')
  fs.mkdirSync(r)
  git(r, 'init', '-q', '-b', 'main')
  git(r, 'config', 'user.email', 'a@b')
  git(r, 'config', 'user.name', 'a')
  fs.writeFileSync(path.join(r, 'a.js'), 'a\n')
  git(r, 'add', '.')
  git(r, 'commit', '-qm', 'base')
  const commit = (branch, file) => {
    git(r, 'checkout', '-q', '-b', branch, 'main')
    fs.writeFileSync(path.join(r, file), `${file}\n`)
    git(r, 'add', '.')
    git(r, 'commit', '-qm', file)
    git(r, 'checkout', '-q', 'main')
  }
  return { root, r, base: git(r, 'rev-parse', 'main'), commit }
}

describe('판정할 브랜치 꺼내기', () => {
  it('기준 뒤에 커밋이 있고 판정 폴더에 들어 있지 않은 브랜치만 꺼낸다. 건너뛸 브랜치와 같은 커밋은 다시 꺼내지 않는다', () => {
    const { root, r, base, commit } = repo()
    commit('csv', 'csv.js')
    commit('money', 'money.js')
    commit('work', 'work.js')
    // work에 money를 합쳐 둔다: money는 work 폴더가 대신한다
    git(r, 'checkout', '-q', 'work')
    git(r, 'merge', '-q', '--no-edit', 'money')
    git(r, 'checkout', '-q', 'main')
    git(r, 'branch', 'empty', 'main')
    const exported = new Map()
    const o = {
      repo: r,
      base,
      heads: [git(r, 'rev-parse', 'work')],
      skipBranches: ['main', 'work'],
      dir: path.join(root, 'out'),
      exported,
    }
    const trees = branchTrees(o)
    expect(trees.map((t) => [t.label, t.git.branch, t.git.commits])).toEqual([
      ['branch-csv', 'csv', 1],
    ])
    expect(fs.existsSync(path.join(trees[0].path, 'csv.js'))).toBe(true)
    expect(fs.existsSync(path.join(trees[0].path, 'money.js'))).toBe(false)
    // 같은 커밋이면 다시 꺼내지 않는다(꺼낸 폴더를 지워도 그대로 둔다)
    fs.rmSync(path.join(trees[0].path, 'csv.js'))
    branchTrees(o)
    expect(fs.existsSync(path.join(trees[0].path, 'csv.js'))).toBe(false)
  })
})
