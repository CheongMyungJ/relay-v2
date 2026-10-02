// 평가 레포 만들기와 결과 판정(숨긴 시험, 기존 시험, 바뀐 파일, 범위).
// 기준은 시나리오의 repo/ 폴더 그대로다. 결과 폴더를 .git 없이 복사해 git diff --no-index로 비교하므로
// relay의 worktree, 맨 CLI의 레포, 지워진 worktree의 스냅숏을 똑같이 다룬다.
import fs from 'node:fs'
import path from 'node:path'
import { copyTree, git, run } from './util.mjs'

/** 시나리오의 repo/를 git 레포로 만든다. origin은 로컬 bare 레포다(test/flow/repo.ts의 makeRepo와 같음) */
export function makeRepo(root, name, srcDir) {
  const repo = path.join(root, name)
  const remote = path.join(root, `${name}.git`)
  copyTree(srcDir, repo)
  git(root, 'init', '-q', '--bare', '-b', 'main', remote)
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.email', 'dev@example.com')
  git(repo, 'config', 'user.name', 'dev')
  git(repo, 'config', 'commit.gpgsign', 'false')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'init')
  git(repo, 'remote', 'add', 'origin', remote)
  git(repo, 'push', '-q', '-u', 'origin', 'main')
  return { repo, remote, base: git(repo, 'rev-parse', 'HEAD') }
}

/** git 레포(또는 worktree)의 커밋과 커밋 안 된 변경 */
export function gitState(dir, base) {
  if (!fs.existsSync(path.join(dir, '.git'))) return null
  try {
    return {
      branch: git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'),
      commits: Number(git(dir, 'rev-list', '--count', `${base}..HEAD`)),
      log: git(dir, 'log', '--format=%s', `${base}..HEAD`).split('\n').filter(Boolean),
      uncommitted: git(dir, 'status', '--porcelain').split('\n').filter(Boolean),
    }
  } catch (e) {
    return { error: String(e) }
  }
}

/** git diff --no-index --numstat base tree의 경로: "{base => tree}/a", "/dev/null => tree/a", "base/a => /dev/null" */
function numstatPath(p) {
  const m =
    /^\{base => tree\}\/(.*)$/.exec(p) ??
    /^\/dev\/null => tree\/(.*)$/.exec(p) ??
    /^base\/(.*) => \/dev\/null$/.exec(p) ??
    /^base\/.* => tree\/(.*)$/.exec(p)
  return m ? m[1] : p
}

// **/ → 폴더 0개 이상, ** → 아무 경로, * → 폴더 안의 이름. 앞에서 바꾼 것의 *를 뒤에서 다시 바꾸지 않게 자리표를 쓴다
const globToRe = (g) =>
  new RegExp(
    `^${g
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replaceAll('**/', '\u0000')
      .replaceAll('**', '\u0001')
      .replaceAll('*', '[^/]*')
      .replaceAll('\u0000', '(?:.*/)?')
      .replaceAll('\u0001', '.*')}$`,
  )

/**
 * 결과 폴더 하나를 판정한다.
 * @param {object} o
 * @param {string} o.tree 결과 폴더 (.git이 있어도 없어도 된다)
 * @param {string} o.baseDir 시나리오의 repo/
 * @param {string} o.hiddenDir 시나리오의 hidden/
 * @param {object} o.scenario
 * @param {string} o.work 판정용 임시 폴더
 */
export function judgeTree(o) {
  const { copy, files, diff } = diffTree(o.tree, o.baseDir, o.work)
  const allowed = (o.scenario.expectedFiles ?? []).map(globToRe)
  const unrelated = files.filter((f) => !allowed.some((re) => re.test(f.file))).map((f) => f.file)

  // 레포의 시험 (에이전트가 더한 시험 포함). 숨긴 시험을 eval-hidden/에 복사하기 전에 돌린다.
  // 인자 없는 "node --test"는 eval-hidden/*.test.js도 찾아 돌리므로 순서를 바꾸면 레포 시험 결과가 달라진다
  const repoTest = run('npm', ['test', '--silent'], { cwd: copy, timeoutMs: 120_000 })
  // 숨긴 시험: hidden/의 파일을 레포에 겹쳐 놓고 돌린다
  if (fs.existsSync(o.hiddenDir))
    fs.cpSync(o.hiddenDir, path.join(copy, 'eval-hidden'), { recursive: true })
  const checks = (o.scenario.checks ?? []).map((c) => {
    const r = run('node', ['--test', path.join('eval-hidden', c.file)], {
      cwd: copy,
      env: { ...process.env, ...(c.env ?? {}) },
      timeoutMs: 60_000,
    })
    return { name: c.name, bug: c.bug ?? null, pass: r.code === 0, output: r.out.slice(-3000) }
  })
  return {
    files,
    linesAdded: files.reduce((a, f) => a + f.add, 0),
    linesRemoved: files.reduce((a, f) => a + f.del, 0),
    unrelated,
    repoTests: { pass: repoTest.code === 0, output: repoTest.out.slice(-3000) },
    checks,
    diff,
  }
}

/** 기준(시나리오의 repo/)과 결과 폴더의 차이. work 아래에 base와 tree를 복사해 비교한다 */
export function diffTree(tree, baseDir, work) {
  const copy = path.join(work, 'tree')
  copyTree(tree, copy)
  const base = path.join(work, 'base')
  copyTree(baseDir, base)
  const numstat = run('git', ['diff', '--no-index', '--numstat', 'base', 'tree'], { cwd: work })
  const diff = run('git', ['diff', '--no-index', 'base', 'tree'], { cwd: work }).out
  const files = numstat.out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [add, del, ...rest] = l.split('\t')
      return { file: numstatPath(rest.join('\t')), add: Number(add) || 0, del: Number(del) || 0 }
    })
  return { copy, files, diff }
}

/**
 * 팀원 교대(works의 teammate Work, docs/knowledge-experiment.md). 앞 사람의 레포에서 main 밖의 로컬 브랜치 가운데
 * main에 아직 없는 커밋이 있는 것을 오래된 차례로 main에 머지하고(PR 머지와 같음), 팀 원격(bare)에 올린 뒤 새로 clone한다.
 * 커밋하지 않은 변경은 건너가지 않는다. 충돌하면 그 머지를 되돌리고 뒤 브랜치 쪽(-X theirs)으로 다시 머지하고 적는다.
 * @param {string} prevRepo 앞 사람의 레포
 * @param {string} remote 팀 원격(makeRepo의 bare 레포)
 * @param {string} dest 새 사람의 clone 경로
 * @returns {{ repo: string, merged: string[], conflicts: string[], failed: string[], head: string }}
 */
export function handoffRepo(prevRepo, remote, dest) {
  const work = `${dest}-merge`
  fs.rmSync(work, { recursive: true, force: true })
  git(path.dirname(work), 'clone', '-q', '--no-local', prevRepo, work)
  setUser(work)
  run('git', ['checkout', '-q', 'main'], { cwd: work })
  const refs = git(
    work,
    'for-each-ref',
    '--sort=committerdate',
    '--format=%(refname:short)',
    'refs/remotes/origin',
  )
    .split('\n')
    .filter((r) => r && r !== 'origin/HEAD' && r !== 'origin/main' && r !== 'origin')
  const merged = []
  const conflicts = []
  const failed = []
  for (const ref of refs) {
    if (run('git', ['merge-base', '--is-ancestor', ref, 'HEAD'], { cwd: work }).code === 0) continue
    const msg = `Merge ${ref.replace(/^origin\//, '')} (팀 공유 머지, 평가 도구)`
    let r = run('git', ['merge', '--no-ff', '--no-edit', '-m', msg, ref], { cwd: work })
    if (r.code !== 0) {
      run('git', ['merge', '--abort'], { cwd: work })
      conflicts.push(ref)
      r = run('git', ['merge', '--no-ff', '--no-edit', '-X', 'theirs', '-m', msg, ref], {
        cwd: work,
      })
      if (r.code !== 0) {
        run('git', ['merge', '--abort'], { cwd: work })
        failed.push(ref)
        continue
      }
    }
    merged.push(ref.replace(/^origin\//, ''))
  }
  git(work, 'push', '-q', '-f', remote, 'HEAD:main')
  fs.rmSync(dest, { recursive: true, force: true })
  git(path.dirname(dest), 'clone', '-q', '--no-local', remote, dest)
  setUser(dest)
  fs.rmSync(work, { recursive: true, force: true })
  return { repo: dest, merged, conflicts, failed, head: git(dest, 'rev-parse', 'HEAD') }
}

function setUser(dir) {
  git(dir, 'config', 'user.email', 'dev@example.com')
  git(dir, 'config', 'user.name', 'dev')
  git(dir, 'config', 'commit.gpgsign', 'false')
}
