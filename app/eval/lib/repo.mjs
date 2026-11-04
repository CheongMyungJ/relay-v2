// 평가 레포 만들기와 결과 판정(숨긴 시험, 기존 시험, 바뀐 파일, 범위).
// 기준은 시나리오의 repo/ 폴더다(품질 기준 덧씌우기를 켜면 그 파일을 얹은 것, lib/overlay.mjs). 결과 폴더를 .git 없이
// 복사해 git diff --no-index로 비교하므로 relay의 worktree, 맨 CLI의 레포, 지워진 worktree의 스냅숏을 똑같이 다룬다.
import fs from 'node:fs'
import path from 'node:path'
import { isIssue } from './issue-judge.mjs'
import { writeFiles } from './overlay.mjs'
import { copyTree, git, run } from './util.mjs'

/**
 * 시나리오의 repo/를 git 레포로 만든다. origin은 로컬 bare 레포다(test/support/repo.ts의 makeRepo와 같음). files(경로 →
 * 내용)는 첫 커밋에 함께 넣는다(품질 기준 덧씌우기, lib/overlay.mjs). 팀원 교대의 clone은 이 커밋에서 이어지므로 따로 넣지 않는다
 */
export function makeRepo(root, name, srcDir, files = {}) {
  const repo = path.join(root, name)
  const remote = path.join(root, `${name}.git`)
  copyTree(srcDir, repo)
  writeFiles(repo, files)
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
 * relay의 지식 파일(relay D283, D293). 앱이 Work를 마무리하는 단계(옛 Work는 verify)에서 남기는 팀 지식이라 코드 결과로 보지 않는다: 판정 diff, 바뀐 파일과
 * 줄 수, 기대 밖 파일에서 빼고 따로 센다(docs/eval.md 6절). 맨 CLI에는 없는 파일이라 판정 diff에 두면 relay가 드러나
 * 가림도 깨진다. 지식 자체의 질은 knowledge-quality.mjs가 저장한 diff(final/*.diff)에서 따로 본다
 */
const KNOWLEDGE_FILE = /^docs\/knowledge\/.+\.md$/
const isKnowledge = (file) => KNOWLEDGE_FILE.test(file)

/** diffTree의 diff(git diff --no-index base tree)에서 지식 파일의 부분을 뺀다 */
export function withoutKnowledge(diff) {
  return diff
    .split(/^(?=diff --git )/m)
    .filter((part) => {
      const head = /^diff --git a\/\S+? b\/(?:tree|base)\/(\S+)/.exec(part)
      return !head || !isKnowledge(head[1])
    })
    .join('')
}

/**
 * run.json의 결과에서 지식 파일을 뺀 코드 결과. 지식 파일을 따로 두기 전의 결과(바뀐 파일과 기대 밖 파일에 지식이
 * 섞임)도 같은 값으로 읽는다
 */
export function codeOutcome(outcome) {
  const files = (outcome.trees ?? []).flatMap((t) => [
    ...(t.files ?? []),
    ...(t.knowledgeFiles ?? []).map((file) => ({ file, add: 0, del: 0, knowledge: true })),
  ])
  const knowledge = [
    ...new Set(files.filter((f) => f.knowledge || isKnowledge(f.file)).map((f) => f.file)),
  ]
  const code = files.filter((f) => !f.knowledge && !isKnowledge(f.file))
  return {
    filesChanged: (outcome.filesChanged ?? []).filter((f) => !isKnowledge(f)),
    linesChanged: (outcome.trees ?? []).length
      ? code.reduce((a, f) => a + f.add + f.del, 0)
      : outcome.linesChanged,
    unrelated: (outcome.unrelated ?? []).filter((f) => !isKnowledge(f)),
    knowledgeFiles: knowledge,
  }
}

/**
 * relay-v3의 계약 예시 자료. relay-v3 세션은 승인된 계약의 예시를 `.relay/examples/<계약 id>.json`에 커밋하고 수용 시험이
 * 그 파일을 읽는다(relay-v3 core/instructions.ts). 시험 자료라 test/**처럼 기대 밖 파일로 세지 않는다. diff와 바뀐 줄에는
 * 그대로 둔다(시험이 읽는 자료라 판정 모델도 본다)
 */
const RELAY3_EXAMPLES = /^\.relay\/examples\/[^/]+\.json$/

/** 기대 파일(시나리오의 expectedFiles glob)에 들지 않는 바뀐 파일. relay-v3의 예시 자료는 기대 파일로 본다 */
export function unrelatedFiles(files, expectedFiles = []) {
  const allowed = expectedFiles.map(globToRe)
  return files.filter((f) => !RELAY3_EXAMPLES.test(f) && !allowed.some((re) => re.test(f)))
}

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
  const { copy, files: all, diff } = diffTree(o.tree, o.baseDir, o.work)
  // 지식 파일은 코드 결과에서 뺀다. diff는 그대로 돌려줘 저장한다(지식의 질은 따로 본다)
  const files = all.filter((f) => !isKnowledge(f.file))
  const knowledgeFiles = all.filter((f) => isKnowledge(f.file)).map((f) => f.file)
  const unrelated = unrelatedFiles(
    files.map((f) => f.file),
    o.scenario.expectedFiles,
  )

  // 레포의 시험 (에이전트가 더한 시험 포함). 숨긴 시험을 eval-hidden/에 복사하기 전에 돌린다.
  // 인자 없는 "node --test"는 eval-hidden/*.test.js도 찾아 돌리므로 순서를 바꾸면 레포 시험 결과가 달라진다
  const repoTest = run('npm', ['test', '--silent'], { cwd: copy, timeoutMs: 120_000 })
  // 숨긴 시험: hidden/의 파일을 레포에 겹쳐 놓고 돌린다
  if (fs.existsSync(o.hiddenDir))
    fs.cpSync(o.hiddenDir, path.join(copy, 'eval-hidden'), { recursive: true })
  const checks = (o.scenario.checks ?? []).map((c) => {
    // 범위 guard (relay I111): 기대 밖 파일(지식 파일 제외)을 바꾸지 않았으면 통과다
    if (c.scope)
      return {
        name: c.name,
        bug: c.bug ?? null,
        pass: unrelated.length === 0,
        output: unrelated.length ? `기대 밖 파일: ${unrelated.join(', ')}` : '',
      }
    // 숨긴 쟁점 (relay I111): 판정 모델이 가른다(lib/issue-judge.mjs). 여기서는 자리만 둔다
    if (isIssue(c))
      return {
        name: c.name,
        bug: c.bug ?? null,
        issue: true,
        pending: true,
        pass: false,
        output: '',
      }
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
    knowledgeFiles,
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
 * 팀원 교대(works의 teammate Work, docs/knowledge-experiment/protocol.md). 앞 사람의 레포에서 main 밖의 로컬 브랜치 가운데
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

/**
 * 체크아웃되지 않은 로컬 브랜치 가운데 기준 뒤에 커밋이 있고 이미 판정하는 폴더(heads의 커밋)에 들어 있지 않은 것을 git
 * archive로 꺼낸다. 에이전트가 고친 것을 부분마다 브랜치에 나눠 두면 체크아웃된 폴더만으로는 보이지 않으므로 그런 브랜치를
 * 따로 판정한다(레포는 건드리지 않는다). exported는 label → 꺼낸 커밋이고 같은 커밋이면 다시 꺼내지 않는다
 * @param {{ repo: string, base: string, heads: string[], skipBranches: string[], dir: string, exported: Map<string, string> }} o
 * @returns {{ path: string, label: string, git: { branch: string, commits: number, log: string[], uncommitted: string[] } }[]}
 */
export function branchTrees(o) {
  let branches
  try {
    branches = git(o.repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads')
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
  const out = []
  for (const b of branches) {
    if (o.skipBranches.includes(b)) continue
    try {
      const sha = git(o.repo, 'rev-parse', b)
      const commits = Number(git(o.repo, 'rev-list', '--count', `${o.base}..${sha}`))
      if (commits === 0) continue
      // 판정하는 폴더에 이미 들어 있으면 그 폴더가 대신한다
      if (
        o.heads.some(
          (h) => run('git', ['merge-base', '--is-ancestor', sha, h], { cwd: o.repo }).code === 0,
        )
      )
        continue
      const label = `branch-${b.replace(/[^\w.-]+/g, '-')}`
      const dir = path.join(o.dir, label)
      if (o.exported.get(label) !== sha) {
        fs.rmSync(dir, { recursive: true, force: true })
        fs.mkdirSync(dir, { recursive: true })
        const tar = `${dir}.tar`
        git(o.repo, 'archive', '--format=tar', '-o', tar, sha)
        run('tar', ['-xf', tar, '-C', dir])
        fs.rmSync(tar, { force: true })
        o.exported.set(label, sha)
      }
      const log = git(o.repo, 'log', '--format=%s', `${o.base}..${sha}`).split('\n').filter(Boolean)
      out.push({ path: dir, label, git: { branch: b, commits, log, uncommitted: [] } })
    } catch {
      // 브랜치를 읽지 못하면 그 브랜치만 빼고 판정한다
    }
  }
  return out
}
