// 장기 평가(sequence)의 git 쪽: Work의 결과를 기준 브랜치(main)에 넣기, 기준 트리 꺼내기, 이어 돌기의 체크포인트.
// - 맨 CLI(cli): 사람 역할이 끝내면 도구가 레포의 커밋하지 않은 변경을 커밋하고(그 사람이 다음 일을 그 작업 트리에서 이어
//   하므로), main 밖 로컬 브랜치 가운데 main에 없는 커밋이 있는 것을 오래된 차례로 main에 머지한 뒤(충돌하면 lib/repo.mjs
//   handoffRepo처럼 뒤 브랜치 쪽 -X theirs로 다시 머지) origin에 push한다. 다음 Work는 main에서 claude를 새로 띄운다.
// - relay-v3 쪽(relay3, relay3-m2): 앱의 [머지]가 가짜 gh(lib/fake-gh.mjs)로 원격의 main을 움직인다. 앱은 fetch하지 않으므로
//   Work가 끝나면 도구가 사람이 하듯 레포에서 fetch하고 로컬 main을 origin/main으로 맞춘다(syncMain). 앱으로 머지되지 않은
//   Work 브랜치(시간 제한, [끝내기]로 끝남 등)는 도구가 cli와 같이 그 worktree의 커밋하지 않은 변경을 커밋하고 머지한다
//   (lib/sequence-run.mjs landRelay3, mergeBranches, 'harness'로 적는다). 버린 Work는 넣지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { git, run } from './util.mjs'

const MSG = '평가 도구'

function setUser(dir) {
  git(dir, 'config', 'user.email', 'dev@example.com')
  git(dir, 'config', 'user.name', 'dev')
  git(dir, 'config', 'commit.gpgsign', 'false')
}

/** 커밋하지 않은 변경(추적하지 않는 파일 포함)을 지금 브랜치에 커밋한다. 커밋한 파일 수(없으면 0) */
export function commitLeftovers(repo, label) {
  const status = git(repo, 'status', '--porcelain').split('\n').filter(Boolean)
  if (!status.length) return 0
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '--no-verify', '-m', `${MSG}: 커밋하지 않은 변경 (${label})`)
  return status.length
}

/**
 * branches를 차례로 main에 머지한다(레포의 main을 체크아웃한다). 이미 main에 든 브랜치는 건너뛴다. 충돌하면 그 머지를 되돌리고
 * -X theirs로 다시 하고, 그래도 안 되면 failed에 둔다
 * @returns {{ merged: string[], conflicts: string[], failed: string[] }}
 */
export function mergeBranches(repo, branches, label) {
  const merged = []
  const conflicts = []
  const failed = []
  git(repo, 'checkout', '-q', 'main')
  for (const b of branches) {
    if (run('git', ['merge-base', '--is-ancestor', b, 'main'], { cwd: repo }).code === 0) continue
    const msg = `Merge ${b} (${MSG}, ${label})`
    let r = run('git', ['merge', '--no-ff', '--no-edit', '-m', msg, b], { cwd: repo })
    if (r.code !== 0) {
      run('git', ['merge', '--abort'], { cwd: repo })
      conflicts.push(b)
      r = run('git', ['merge', '--no-ff', '--no-edit', '-X', 'theirs', '-m', msg, b], {
        cwd: repo,
      })
      if (r.code !== 0) {
        run('git', ['merge', '--abort'], { cwd: repo })
        failed.push(b)
        continue
      }
    }
    merged.push(b)
  }
  return { merged, conflicts, failed }
}

/** main 밖 로컬 브랜치 가운데 main에 없는 커밋이 있는 것, 커밋 시각 차례 */
export function pendingBranches(repo, skip = []) {
  return git(
    repo,
    'for-each-ref',
    '--sort=committerdate',
    '--format=%(refname:short)',
    'refs/heads',
  )
    .split('\n')
    .filter((b) => b && b !== 'main' && !skip.includes(b))
    .filter((b) => run('git', ['merge-base', '--is-ancestor', b, 'main'], { cwd: repo }).code !== 0)
}

/** main을 origin에 push하고 fetch한다. origin/main이 main과 같아진다 */
export function pushMain(repo) {
  const r = run('git', ['push', '-q', 'origin', 'main'], { cwd: repo })
  if (r.code !== 0) throw new Error(`main을 push하지 못함: ${r.out.trim().slice(-500)}`)
  run('git', ['fetch', '-q', 'origin'], { cwd: repo })
  return git(repo, 'rev-parse', 'main')
}

/**
 * 맨 CLI의 Work 끝: 커밋하지 않은 변경을 커밋하고, main 밖 브랜치를 머지하고, push한다. 체크아웃은 main으로 둔다
 * @returns {{ via: 'harness', leftovers: number, merged: string[], conflicts: string[], failed: string[], head: string }}
 */
export function landCli(repo, label) {
  setUser(repo)
  const leftovers = commitLeftovers(repo, label)
  const m = mergeBranches(repo, pendingBranches(repo), label)
  return { via: 'harness', leftovers, ...m, head: pushMain(repo) }
}

/**
 * 원격의 main(앱이 가짜 gh로 머지한 것)을 레포에 가져와 로컬 main을 맞춘다. 로컬 main에 원격에 없는 커밋이 있으면 머지한다.
 * 레포는 main을 체크아웃한 채 둔다. 커밋하지 않은 변경은 건드리지 않는다(앱 쪽 레포 폴더는 세션이 쓰지 않는다)
 * @returns {{ moved: boolean, from: string, to: string }}
 */
export function syncMain(repo) {
  setUser(repo)
  const from = git(repo, 'rev-parse', 'main')
  run('git', ['fetch', '-q', 'origin'], { cwd: repo })
  git(repo, 'checkout', '-q', 'main')
  if (run('git', ['merge', '--ff-only', '-q', 'origin/main'], { cwd: repo }).code !== 0)
    git(repo, 'merge', '--no-edit', '-q', '-m', `Merge origin/main (${MSG})`, 'origin/main')
  const to = git(repo, 'rev-parse', 'main')
  return { moved: from !== to, from, to }
}

/** ref의 트리를 dir에 꺼낸다(.git 없이). 판정과 다음 Work의 diff 기준 */
export function exportTree(repo, ref, dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const tar = `${dir}.tar`
  git(repo, 'archive', '--format=tar', '-o', tar, ref)
  const r = run('tar', ['-xf', tar, '-C', dir])
  fs.rmSync(tar, { force: true })
  if (r.code !== 0) throw new Error(`트리를 꺼내지 못함: ${r.out}`)
  return dir
}

/** 원격 main을 새 폴더에 clone한다(봉인 과제의 레포). origin은 지운다(기준 에이전트가 원격을 바꾸지 않게) */
export function cloneMain(remote, dest) {
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  git(path.dirname(dest), 'clone', '-q', '--no-local', '-b', 'main', remote, dest)
  setUser(dest)
  git(dest, 'remote', 'remove', 'origin')
  return { repo: dest, head: git(dest, 'rev-parse', 'HEAD') }
}

/**
 * 체크포인트에서 뺄 것(이어 돌기에 필요 없고 크다). 묶는 폴더마다 그 아래 경로로 건다(레포 안의 같은 이름은 건드리지 않게):
 * 판정·스냅숏·꺼낸 폴더, 사람 역할의 설정과 스크린샷, 에이전트의 대화 기록(*.jsonl. Work마다의 토큰은 이미 셌다. 프로젝트
 * 메모리 *.md는 남긴다), Claude Code가 다시 받는 플러그인 목록과 캐시, 봉인 과제의 작업 폴더, Electron 캐시. node_modules는
 * 어디서든 뺀다(판정도 node_modules 없이 한다)
 */
export const CHECKPOINT_EXCLUDES = [
  'judge',
  'inspect',
  'snapshots',
  'branches',
  'base-tree',
  'told',
  'human/shots',
  'shots',
  'work-*/shots',
  'cfg-human*',
  'cfg-agent/projects/*.jsonl',
  'cfg-agent/plugins',
  'cfg-agent/cache',
  'sealed-*',
  'electron-user-data*/*Cache*',
  'relay3-home/electron/*Cache*',
]

/**
 * 폴더들(절대 경로)을 체크포인트 하나로 묶는다. 풀 때 같은 절대 경로로 돌아간다(worktree와 앱 저장소의 경로가 그대로여야
 * 한다). 쓰는 동안 끊겨도 앞 체크포인트가 남게 임시 파일에 쓰고 이름을 바꾼다
 */
export function saveCheckpoint(dirs, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  const rel = dirs.filter((d) => fs.existsSync(d)).map((d) => path.relative('/', path.resolve(d)))
  const excludes = rel.flatMap((r) => CHECKPOINT_EXCLUDES.map((x) => `--exclude=${r}/${x}`))
  const r = run(
    'tar',
    [
      '--anchored',
      ...excludes,
      '--no-anchored',
      '--exclude=node_modules',
      '-czf',
      tmp,
      '-C',
      '/',
      ...rel,
    ],
    { timeoutMs: 600_000 },
  )
  if (r.code !== 0) {
    fs.rmSync(tmp, { force: true })
    throw new Error(`체크포인트를 쓰지 못함: ${r.out.slice(-500)}`)
  }
  fs.renameSync(tmp, file)
  return file
}

/** 체크포인트를 푼다: 그 안의 폴더들(dirs)을 먼저 지우고 같은 절대 경로에 푼다 */
export function restoreCheckpoint(file, dirs) {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
  const r = run('tar', ['-xzf', file, '-C', '/'], { timeoutMs: 600_000 })
  if (r.code !== 0) throw new Error(`체크포인트를 풀지 못함: ${r.out.slice(-500)}`)
}

/**
 * 체크포인트 폴더가 git 체크아웃이면 그 파일을 커밋하고 push한다(컨테이너가 다시 떠도 남게, relay-v3
 * docs/experiments/m2.1/run-batch.sh와 같은 방식). push는 다섯 번 다시 해 보고 끝내 못 하면 false(커밋은 남는다).
 * 커밋 메시지 끝에 붙일 줄은 RELAY_BATCH_TRAILER로 준다
 */
export function archiveCommit(dir, files, message) {
  if (run('git', ['rev-parse', '--git-dir'], { cwd: dir }).code !== 0)
    throw new Error(`체크포인트 폴더가 git 체크아웃이 아님: ${dir}`)
  const rel = files.map((f) => path.relative(dir, f))
  run('git', ['add', '-f', '--', ...rel], { cwd: dir })
  if (run('git', ['diff', '--cached', '--quiet'], { cwd: dir }).code === 0) return true
  const trailer = process.env.RELAY_BATCH_TRAILER
  const msg = trailer ? `${message}\n\n${trailer}` : message
  const c = run('git', ['commit', '-q', '-m', msg], { cwd: dir })
  if (c.code !== 0) throw new Error(`체크포인트를 커밋하지 못함: ${c.out.slice(-500)}`)
  for (let i = 1; i <= 5; i++) {
    if (run('git', ['push', '-q', 'origin', 'HEAD'], { cwd: dir, timeoutMs: 300_000 }).code === 0)
      return true
    run('sleep', [String(i * 4)])
  }
  return false
}
