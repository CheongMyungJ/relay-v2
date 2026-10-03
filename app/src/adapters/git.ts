// git CLI의 얇은 래퍼 (I12). 사용자의 git 설정과 자격 증명을 그대로 쓴다.
import { createHash } from 'node:crypto'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizePath } from '../shared/knowledge'
import { describeFailure, run } from './exec'

export class GitError extends Error {}

/** 한글 파일 이름을 따옴표와 8진수로 바꾸지 않는다 */
const BASE_ARGS = ['-c', 'core.quotepath=false']

export interface GitOptions {
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
}

function gitEnv(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  // 앱에는 터미널이 없으므로 자격 증명을 터미널에서 묻지 않는다. 창으로 묻는 도우미는 그대로 쓴다.
  return { ...(env ?? process.env), GIT_TERMINAL_PROMPT: '0' }
}

/** git을 실행하고 표준 출력을 돌려준다. 끝의 줄바꿈 하나만 뗀다. 실패하면 GitError */
export async function git(
  cwd: string,
  args: readonly string[],
  opts: GitOptions = {},
): Promise<string> {
  const r = await run('git', [...BASE_ARGS, ...args], {
    cwd,
    env: gitEnv(opts.env),
    timeoutMs: opts.timeoutMs ?? 60_000,
  })
  if (r.code !== 0) throw new GitError(`git ${args[0] ?? ''} 실패: ${describeFailure(r)}`)
  return r.stdout.replace(/\r?\n$/, '')
}

async function tryGit(
  cwd: string,
  args: readonly string[],
  opts?: GitOptions,
): Promise<string | null> {
  try {
    return await git(cwd, args, opts)
  } catch {
    return null
  }
}

const lines = (out: string) => out.split(/\r?\n/).filter(Boolean)

/** 레포 루트. git 레포가 아니면 null (시나리오 0의 점검) */
export async function repoRoot(dir: string, opts?: GitOptions): Promise<string | null> {
  const out = await tryGit(dir, ['rev-parse', '--show-toplevel'], opts)
  return out ? path.resolve(out) : null
}

/** 원격이 있는가 (D67: origin이 없으면 경고) */
export async function hasRemote(repo: string, name = 'origin', opts?: GitOptions) {
  return (await tryGit(repo, ['remote', 'get-url', name], opts)) !== null
}

/** 기본 브랜치: origin/HEAD, 없으면 현재 브랜치 (시나리오 0-3). 둘 다 없으면 null */
export async function defaultBranch(repo: string, opts?: GitOptions): Promise<string | null> {
  const remoteHead = await tryGit(
    repo,
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    opts,
  )
  if (remoteHead?.startsWith('origin/')) return remoteHead.slice('origin/'.length)
  return tryGit(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD'], opts)
}

/** 로컬 브랜치와 origin의 원격 추적 브랜치 이름 (시나리오 1의 기준 브랜치 목록) */
export async function branches(
  repo: string,
  opts?: GitOptions,
): Promise<{ local: string[]; remote: string[] }> {
  const format = '--format=%(refname:short)'
  const local = lines(await git(repo, ['for-each-ref', format, 'refs/heads'], opts))
  const remote = lines(await git(repo, ['for-each-ref', format, 'refs/remotes/origin'], opts))
    .map((r) => r.replace(/^origin\//, ''))
    // refs/remotes/origin/HEAD의 짧은 이름은 origin이다
    .filter((r) => r !== 'HEAD' && r !== 'origin')
  return { local, remote }
}

export async function branchExists(repo: string, name: string, opts?: GitOptions) {
  return (
    (await tryGit(repo, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`], opts)) !== null
  )
}

/** 원격의 브랜치 하나를 가져와 origin/<branch>를 맞춘다 (시나리오 1: 기준 위치가 원격) */
export async function fetchBranch(
  repo: string,
  branch: string,
  remote = 'origin',
  opts?: GitOptions,
): Promise<void> {
  const refspec = `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`
  await git(repo, ['fetch', '--no-tags', remote, refspec], {
    ...opts,
    timeoutMs: opts?.timeoutMs ?? 120_000,
  })
}

/** 커밋 id. 없는 ref면 GitError */
export async function commitOf(repo: string, ref: string, opts?: GitOptions): Promise<string> {
  return git(repo, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], opts)
}

/**
 * 새 브랜치로 worktree를 만든다 (시나리오 1). 경로가 길어질 수 있어 core.longpaths를 켠다 (7절).
 * worktree는 레포의 설정을 함께 쓰므로 에이전트가 worktree에서 하는 git 명령에도 적용된다.
 */
export async function addWorktree(
  repo: string,
  dir: string,
  branch: string,
  commit: string,
  opts?: GitOptions,
): Promise<void> {
  await git(repo, ['config', 'core.longpaths', 'true'], opts)
  await git(repo, ['worktree', 'add', '-b', branch, dir, commit], opts)
}

/** HEAD가 가리키는 브랜치 이름. 분리된 HEAD면 null (git 문서 git-symbolic-ref) */
export async function currentBranch(dir: string, opts?: GitOptions): Promise<string | null> {
  return tryGit(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD'], opts)
}

export async function headCommit(dir: string, opts?: GitOptions): Promise<string> {
  return git(dir, ['rev-parse', 'HEAD'], opts)
}

/**
 * from 커밋부터 to 커밋까지의 차이. to가 null이면 작업 트리까지다(커밋한 것과 커밋 안 한 추적 파일 모두)
 */
export async function diffFrom(
  dir: string,
  from: string,
  to: string | null,
  opts?: GitOptions,
): Promise<string> {
  return git(dir, ['diff', '--no-color', '--no-ext-diff', from, ...(to ? [to] : [])], opts)
}

/**
 * from 커밋과 지금 작업 트리의 차이에서 바뀐 파일과 상태 (git diff --name-status --no-renames -z <from>). 이름을 바꾼 파일은
 * 지운 것(D)과 새 것(A)으로 나온다. 추적하지 않는 새 파일은 없다. PR 대응 승인 화면의 기존 테스트 변경(D202)에 쓴다
 */
export async function changedPaths(
  dir: string,
  from: string,
  opts?: GitOptions,
): Promise<{ status: string; path: string }[]> {
  const out = await git(dir, ['diff', '--name-status', '--no-renames', '-z', from], opts)
  const parts = out.split('\0').filter((p) => p !== '')
  const changes: { status: string; path: string }[] = []
  for (let i = 0; i + 1 < parts.length; i += 2) {
    changes.push({ status: parts[i] ?? '', path: parts[i + 1] ?? '' })
  }
  return changes
}

/** 커밋 안 된 변경 (git status --porcelain). 추적하지 않는 파일도 넣는다 */
export async function statusLines(dir: string, opts?: GitOptions): Promise<string[]> {
  return lines(await git(dir, ['status', '--porcelain=v1', '--untracked-files=all'], opts))
}

/** from에서 닿지 않고 to에서 닿는 커밋 수 (git rev-list --count from..to). 되감기의 미리 보기 (D82) */
export async function countCommits(
  dir: string,
  from: string,
  to = 'HEAD',
  opts?: GitOptions,
): Promise<number> {
  return Number(await git(dir, ['rev-list', '--count', `${from}..${to}`], opts))
}

/** 패턴에 맞는 ref의 짧은 이름 (git for-each-ref, 패턴은 fnmatch). 이 Work의 백업 브랜치를 찾는다 (D115) */
export async function refNames(
  repo: string,
  pattern: string,
  opts?: GitOptions,
): Promise<string[]> {
  return lines(await git(repo, ['for-each-ref', '--format=%(refname:short)', pattern], opts))
}

export interface BackupOptions extends GitOptions {
  /** 커밋 안 된 변경도 백업한다 (D116) */
  uncommitted: boolean
  /** 커밋 안 된 변경을 담는 커밋의 메시지 */
  message: string
}

/**
 * 작업 트리 전체(커밋 안 된 변경과 추적하지 않는 파일 포함, 무시하는 파일 제외)를 담은 tree (D116).
 * 진짜 index는 건드리지 않는다: 다른 index 파일(GIT_INDEX_FILE)에 git add -A하고 write-tree한다
 * (git 문서 git, git-add, git-write-tree). 끊긴 되감기를 다시 할 때 이미 만든 백업과 비교하는 데도 쓴다 (D123).
 */
export async function worktreeTree(dir: string, opts: GitOptions = {}): Promise<string> {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'relay-backup-'))
  const index = path.join(tmp, 'index')
  const withIndex: GitOptions = {
    ...opts,
    env: { ...(opts.env ?? process.env), GIT_INDEX_FILE: index },
  }
  try {
    // 진짜 index를 복사해 시작하면 파일 상태 캐시를 써 빠르다. 없으면 HEAD에서 만든다
    const real = path.resolve(dir, await git(dir, ['rev-parse', '--git-path', 'index'], opts))
    try {
      await fsp.copyFile(real, index)
    } catch {
      await git(dir, ['read-tree', 'HEAD'], withIndex)
    }
    await git(dir, ['add', '-A'], withIndex)
    return await git(dir, ['write-tree'], withIndex)
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true })
  }
}

/**
 * 되감기의 백업 브랜치를 만든다 (6.2, D115, D116). 브랜치는 HEAD를 가리킨다. 커밋 안 된 변경도 백업하면
 * 작업 트리 전체(무시하는 파일 제외)를 담은 커밋 하나를 HEAD 위에 더해 그 커밋을 가리킨다.
 * 진짜 index와 작업 트리, 지금 브랜치는 건드리지 않는다: worktreeTree로 tree를 만들고 commit-tree로 커밋 객체만
 * 만든다. commit-tree는 git commit과 달리 훅을 부르지 않는다 (git 문서 git-commit-tree, githooks).
 * 같은 이름의 브랜치가 있으면 git branch가 실패하고 아무것도 바꾸지 않는다. 백업한 커밋을 돌려준다.
 */
export async function createBackup(
  dir: string,
  branch: string,
  opts: BackupOptions,
): Promise<string> {
  const head = await headCommit(dir, opts)
  let commit = head
  if (opts.uncommitted) {
    const tree = await worktreeTree(dir, opts)
    commit = await git(dir, ['commit-tree', tree, '-p', head, '-m', opts.message], opts)
  }
  await git(dir, ['branch', branch, commit], opts)
  return commit
}

/** 커밋의 tree */
export async function treeOf(dir: string, commit: string, opts?: GitOptions): Promise<string> {
  return git(dir, ['rev-parse', '--verify', '--end-of-options', `${commit}^{tree}`], opts)
}

/** 커밋의 id, 제목(첫 줄), 첫 부모. 부모가 없으면 null */
export async function commitInfo(
  dir: string,
  commit: string,
  opts?: GitOptions,
): Promise<{ id: string; subject: string; parent: string | null }> {
  const out = await git(dir, ['log', '-1', '--format=%H%x00%s%x00%P', commit, '--'], opts)
  const [id = '', subject = '', parents = ''] = out.split('\0')
  return { id, subject, parent: parents.split(' ').find(Boolean) ?? null }
}

/**
 * 작업 트리를 커밋으로 되돌린다 (6.2): git reset --hard는 index와 작업 트리를 커밋에 맞춘다.
 * 추적하지 않는 파일은 reset이 지우지 않으므로 clean이면 git clean -d -f로 지운다. 무시하는 파일은 남는다
 * (git 문서 git-reset, git-clean). 커밋 안 된 변경은 먼저 백업한다 (D116).
 */
export async function resetHard(
  dir: string,
  commit: string,
  opts: GitOptions & { clean: boolean },
): Promise<void> {
  await git(dir, ['reset', '--hard', '--quiet', commit], opts)
  if (opts.clean) await git(dir, ['clean', '-d', '-f', '--quiet'], opts)
}

// ---------- 전달 (시나리오 7) ----------

/** 원격의 주소 (git remote get-url). insteadOf를 푼 fetch 주소다(git 문서 git-remote). 원격이 없으면 null */
export async function remoteUrl(
  repo: string,
  name = 'origin',
  opts?: GitOptions,
): Promise<string | null> {
  return tryGit(repo, ['remote', 'get-url', name], opts)
}

/**
 * 브랜치를 원격의 같은 이름으로 push하고 추적 브랜치(upstream)로 둔다 (7-4, git push -u).
 * 원격 추적 브랜치(refs/remotes/<remote>/<branch>)도 함께 바뀐다. 이미 같으면 아무것도 보내지 않고 성공한다.
 * fast-forward가 아니면 원격이 거부한다(git 문서 git-push PUSH RULES). 사용자의 pre-push 훅과 자격 증명을 쓴다.
 */
export async function pushBranch(
  dir: string,
  branch: string,
  remote = 'origin',
  opts?: GitOptions,
): Promise<void> {
  const ref = `refs/heads/${branch}`
  await git(dir, ['push', '--set-upstream', remote, `${ref}:${ref}`], {
    ...opts,
    timeoutMs: opts?.timeoutMs ?? 300_000,
  })
}

/** ref가 가리키는 커밋. 없으면 null */
export async function refCommit(
  dir: string,
  ref: string,
  opts?: GitOptions,
): Promise<string | null> {
  return tryGit(
    dir,
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`],
    opts,
  )
}

/**
 * 커밋 안 된 변경을 stash에 넣는다 (7-5의 [변경 버리고 진행], git stash push -u). 추적하지 않는 파일도 넣고
 * 작업 트리에서 지운다. 무시하는 파일은 남는다. refs/stash는 레포의 모든 worktree가 함께 써서 메인 체크아웃의
 * git stash list에 보인다(git 문서 git-stash, git-worktree REFS). 만든 stash 커밋을 돌려준다.
 */
export async function stashAll(dir: string, message: string, opts?: GitOptions): Promise<string> {
  const before = await refCommit(dir, 'refs/stash', opts)
  await git(dir, ['stash', 'push', '--include-untracked', '--message', message], opts)
  const after = await refCommit(dir, 'refs/stash', opts)
  if (!after || after === before) throw new GitError('git stash가 변경을 넣지 않음')
  return after
}

/**
 * stash 목록: stash 커밋과 제목. 최신이 먼저다. git stash list는 git log의 형식 옵션을 받고, 제목(%gs)은
 * `On <브랜치>: <메시지>`다 (git 문서 git-stash, 실행). 끊긴 전달이 만든 stash를 메시지로 찾는다 (D123)
 */
export async function stashEntries(
  dir: string,
  opts?: GitOptions,
): Promise<{ commit: string; subject: string }[]> {
  return lines(await git(dir, ['stash', 'list', '--format=%H%x00%gs'], opts)).map((l) => {
    const [commit = '', subject = ''] = l.split('\0')
    return { commit, subject }
  })
}

/**
 * 커밋 안 된 변경을 모두 커밋한다 (7-5의 [커밋하고 진행]): git add -A 뒤 git commit. 무시하는 파일은 넣지
 * 않는다. 사용자의 커밋 훅과 서명 설정을 그대로 쓴다. 새 HEAD를 돌려준다.
 */
export async function commitAll(dir: string, message: string, opts?: GitOptions): Promise<string> {
  await git(dir, ['add', '-A'], opts)
  await git(dir, ['commit', '--quiet', '--message', message], {
    ...opts,
    timeoutMs: opts?.timeoutMs ?? 120_000,
  })
  return headCommit(dir, opts)
}

// ---------- 지식 (I72, I73) ----------

/** 레포 상대 경로는 지식 항목과 같은 규칙으로 맞춘다. pathHashes의 키를 isStale·withHashes가 같은 함수로 찾는다 */
const relPath = normalizePath

/**
 * 커밋의 경로 개체 해시 (I72): `git ls-tree <커밋> -- <경로>`가 주는 개체 해시다(파일은 blob, 디렉터리는 tree). 없는
 * 경로는 null이다
 */
export async function objectHash(
  dir: string,
  commit: string,
  p: string,
  opts?: GitOptions,
): Promise<string | null> {
  const rel = relPath(p)
  const out = await git(dir, ['ls-tree', '-z', commit, '--', rel], opts)
  for (const line of out.split('\0')) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    if (line.slice(tab + 1) === rel) return line.slice(0, tab).split(' ')[2] ?? null
  }
  return null
}

/**
 * 지식 폴더를 품은 디렉터리의 해시 (I72, D320 (3)): `git ls-tree -r <커밋> -- <디렉터리>`의 목록에서 지식 폴더 밑의 줄을
 * 뺀 글의 SHA-1이다. 지식 커밋이 그 디렉터리의 해시를 바꾸지 않는다. 디렉터리가 없으면 null이다
 */
export async function treeHashWithout(
  dir: string,
  commit: string,
  p: string,
  excluded: string,
  opts?: GitOptions,
): Promise<string | null> {
  const rel = relPath(p)
  const skip = relPath(excluded)
  const out = await git(dir, ['ls-tree', '-r', '-z', commit, '--', rel], opts)
  const kept = out.split('\0').filter((line) => {
    const tab = line.indexOf('\t')
    if (tab < 0) return false
    const file = line.slice(tab + 1)
    return file !== skip && !file.startsWith(`${skip}/`)
  })
  if (kept.length === 0 && !out) return null
  return createHash('sha1').update(kept.join('\n')).digest('hex')
}

/**
 * 경로들의 내용 해시 (I72). 키는 맞춘 경로이고(`파일:심볼`은 그대로), 해시는 `:` 앞의 파일로 구한다(D320 (3)). 지식 폴더를
 * 품은 디렉터리는 지식 폴더를 빼고 해시한다. 없는 경로는 null이다
 */
export async function pathHashes(
  dir: string,
  commit: string,
  paths: readonly string[],
  knowledgeDir: string,
  opts?: GitOptions,
): Promise<Record<string, string | null>> {
  const kd = relPath(knowledgeDir)
  const out: Record<string, string | null> = {}
  const plain = new Map<string, string[]>()
  for (const raw of paths) {
    const key = relPath(raw)
    if (!key || key in out) continue
    const i = key.indexOf(':')
    const file = i > 0 ? key.slice(0, i) : key
    out[key] = null
    if (kd === file || kd.startsWith(`${file}/`)) {
      out[key] = await treeHashWithout(dir, commit, file, kd, opts)
    } else {
      plain.set(file, [...(plain.get(file) ?? []), key])
    }
  }
  // 나머지는 `git ls-tree` 한 번: 경로마다 그 경로의 줄(파일은 blob, 디렉터리는 tree)이 나온다
  if (plain.size) {
    const list = await git(dir, ['ls-tree', '-z', commit, '--', ...plain.keys()], opts)
    for (const line of list.split('\0')) {
      const tab = line.indexOf('\t')
      if (tab < 0) continue
      const hash = line.slice(0, tab).split(' ')[2] ?? null
      for (const key of plain.get(line.slice(tab + 1)) ?? []) out[key] = hash
    }
  }
  return out
}

/**
 * 정한 경로만 올린 커밋 (I73): `git add -A -- <경로>` 뒤 `git commit -- <경로>`. 다른 변경(index에 올린 것 포함)은
 * 커밋하지 않는다. 사용자의 커밋 훅과 서명 설정을 그대로 쓴다. 새 HEAD를 돌려준다
 */
export async function commitPaths(
  dir: string,
  paths: readonly string[],
  message: string,
  opts?: GitOptions,
): Promise<string> {
  await git(dir, ['add', '-A', '--', ...paths], opts)
  await git(dir, ['commit', '--quiet', '--message', message, '--', ...paths], {
    ...opts,
    timeoutMs: opts?.timeoutMs ?? 120_000,
  })
  return headCommit(dir, opts)
}

/** 경로 아래에 커밋할 변경이 있는가 (추적하지 않는 새 파일 포함) */
export async function pathsDirty(
  dir: string,
  paths: readonly string[],
  opts?: GitOptions,
): Promise<boolean> {
  const out = await git(
    dir,
    ['status', '--porcelain=v1', '--untracked-files=all', '--', ...paths],
    opts,
  )
  return out.trim() !== ''
}

/**
 * 커밋의 파일 내용 (`git show <커밋>:<경로>`). 없으면 null이다. 끝의 줄바꿈까지 그대로 돌려준다
 */
export async function showFile(
  dir: string,
  commit: string,
  p: string,
  opts?: GitOptions,
): Promise<string | null> {
  const r = await run('git', [...BASE_ARGS, 'show', `${commit}:${relPath(p)}`], {
    cwd: dir,
    env: gitEnv(opts?.env),
    timeoutMs: opts?.timeoutMs ?? 60_000,
  })
  return r.code === 0 ? r.stdout : null
}

/**
 * 커밋의 파일 여럿 (`git cat-file --batch-check`와 `--batch` 한 번씩). 키는 맞춘 경로이고 없는 파일과 디렉터리는 null이다.
 * 지식 파일처럼 UTF-8 글을 읽는 데 쓴다. 출력을 나누지 못하면(UTF-8이 아닌 내용 등) 파일마다 showFile로 읽는다
 */
export async function showFiles(
  dir: string,
  commit: string,
  paths: readonly string[],
  opts?: GitOptions,
): Promise<Map<string, string | null>> {
  const keys = [...new Set(paths.map(relPath).filter(Boolean))]
  const out = new Map<string, string | null>(keys.map((k) => [k, null]))
  if (keys.length === 0) return out
  const batch = (mode: string, ks: readonly string[]) =>
    run('git', [...BASE_ARGS, 'cat-file', mode], {
      cwd: dir,
      env: gitEnv(opts?.env),
      timeoutMs: opts?.timeoutMs ?? 60_000,
      input: ks.map((k) => `${commit}:${k}\n`).join(''),
    })
  // 종류를 먼저 본다: 디렉터리(tree)의 내용은 글이 아니다
  const check = await batch('--batch-check', keys)
  // showFile처럼 읽지 못하면 없는 것으로 본다
  if (check.code !== 0) return out
  const types = check.stdout.split('\n').slice(0, keys.length)
  const blobs = keys.filter((_, i) => / blob \d+$/.test(types[i] ?? ''))
  if (blobs.length === 0) return out
  const r = await batch('--batch', blobs)
  const parsed = r.code === 0 ? splitBatch(Buffer.from(r.stdout, 'utf8'), blobs.length) : null
  for (const [i, k] of blobs.entries()) {
    out.set(k, parsed ? (parsed[i] ?? null) : await showFile(dir, commit, k, opts))
  }
  return out
}

/** `git cat-file --batch`의 출력: 입력마다 `<개체> blob <크기>\n<내용>\n`. 나누지 못하면 null */
function splitBatch(buf: Buffer, count: number): string[] | null {
  const out: string[] = []
  let at = 0
  for (let i = 0; i < count; i++) {
    const nl = buf.indexOf(0x0a, at)
    if (nl < 0) return null
    const m = /^[0-9a-f]+ blob (\d+)$/.exec(buf.subarray(at, nl).toString('utf8'))
    if (!m) return null
    at = nl + 1
    const size = Number(m[1])
    if (at + size > buf.length || buf[at + size] !== 0x0a) return null
    out.push(buf.subarray(at, at + size).toString('utf8'))
    at += size + 1
  }
  return at === buf.length ? out : null
}

/** 커밋에서 경로 아래의 파일 (`git ls-tree -r --name-only`) */
export async function filesAt(
  dir: string,
  commit: string,
  p: string,
  opts?: GitOptions,
): Promise<string[]> {
  const out = await git(dir, ['ls-tree', '-r', '-z', '--name-only', commit, '--', relPath(p)], opts)
  return out.split('\0').filter(Boolean)
}

// ---------- 정리 (시나리오 8) ----------

/**
 * a가 b의 조상인가(같은 커밋 포함). git merge-base --is-ancestor는 참이면 0, 거짓이면 1로 끝나고,
 * 그 밖의 종료 코드는 오류다(git 문서 git-merge-base).
 */
export async function isAncestor(
  dir: string,
  a: string,
  b: string,
  opts: GitOptions = {},
): Promise<boolean> {
  const r = await run('git', [...BASE_ARGS, 'merge-base', '--is-ancestor', a, b], {
    cwd: dir,
    env: gitEnv(opts.env),
    timeoutMs: opts.timeoutMs ?? 60_000,
  })
  if (r.code === 0) return true
  if (r.code === 1) return false
  throw new GitError(`git merge-base 실패: ${describeFailure(r)}`)
}

/** worktree의 git 폴더에 남은 잠금 파일(index.lock 등)의 이름. git 폴더를 찾지 못하면 빈 목록이다 */
export async function lockFiles(dir: string, opts?: GitOptions): Promise<string[]> {
  const gitDir = await tryGit(dir, ['rev-parse', '--absolute-git-dir'], opts)
  if (!gitDir) return []
  try {
    const entries = await fsp.readdir(gitDir, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.lock'))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * worktree를 지운다 (시나리오 8, git worktree remove). 수정하거나 추적하지 않는 파일이 있으면 git이 거부하므로
 * 사람이 확인한 뒤 force(--force)로 지운다. 무시하는 파일은 함께 지워지고, worktree의 git 폴더(잠금 파일 포함)도
 * 지워진다(git 문서 git-worktree, 실행). 메인 체크아웃(repo)에서 부른다.
 */
export async function removeWorktree(
  repo: string,
  dir: string,
  opts: GitOptions & { force: boolean },
): Promise<void> {
  await git(repo, ['worktree', 'remove', ...(opts.force ? ['--force'] : []), dir], {
    ...opts,
    timeoutMs: opts.timeoutMs ?? 300_000,
  })
}

/** 폴더가 없어진 worktree의 관리 파일을 치운다 (git worktree prune) */
export async function pruneWorktrees(repo: string, opts?: GitOptions): Promise<void> {
  await git(repo, ['worktree', 'prune'], opts)
}

/**
 * 브랜치를 지운다 (git branch -D). 지우면 reflog도 지운다. worktree가 쓰는 브랜치는 git이 거부한다
 * (git 문서 git-branch, 실행). 머지 여부는 앱이 먼저 본다.
 */
export async function deleteBranches(
  repo: string,
  names: readonly string[],
  opts?: GitOptions,
): Promise<void> {
  if (names.length === 0) return
  await git(repo, ['branch', '-D', '--', ...names], opts)
}

// ---------- PR 진행 (시나리오 10, D193, D178) ----------

/** 커밋이 이 레포에 있는가 (git cat-file -e). fetch한 뒤 원격 head를 받았는지 본다 */
export async function hasCommit(dir: string, commit: string, opts?: GitOptions): Promise<boolean> {
  return (await tryGit(dir, ['cat-file', '-e', `${commit}^{commit}`], opts)) !== null
}

/**
 * 원격만 앞선 브랜치를 받는다 (D193): worktree에서 git merge --ff-only <커밋>. fast-forward가 아니면 git이 거부하고
 * 아무것도 바꾸지 않는다(git 문서 git-merge). S7 관찰 8에서 fetch 뒤 이렇게 받았다
 */
export async function mergeFastForward(
  dir: string,
  commit: string,
  opts?: GitOptions,
): Promise<void> {
  await git(dir, ['merge', '--ff-only', '--quiet', commit], opts)
}

/**
 * from에서 닿지 않고 to에서 닿는 커밋과 그 부모 (git rev-list --parents from..to). 새것이 먼저다. 받은 커밋 가운데
 * 기준 브랜치 병합(둘째 이후 부모가 기준 브랜치 커밋)을 가린다 (S7 관찰 8, D181)
 */
export async function commitsWithParents(
  dir: string,
  from: string,
  to: string,
  opts?: GitOptions,
): Promise<{ commit: string; parents: string[] }[]> {
  return lines(await git(dir, ['rev-list', '--parents', `${from}..${to}`], opts)).map((l) => {
    const [commit = '', ...parents] = l.split(' ')
    return { commit, parents }
  })
}

/** 원격에 브랜치가 있는가 (git ls-remote --heads). 원격에 닿지 못하면 GitError (D178 정리 창) */
export async function remoteBranchExists(
  repo: string,
  branch: string,
  remote = 'origin',
  opts?: GitOptions,
): Promise<boolean> {
  const out = await git(repo, ['ls-remote', '--heads', remote, `refs/heads/${branch}`], {
    ...opts,
    timeoutMs: opts?.timeoutMs ?? 120_000,
  })
  return out.trim() !== ''
}

/**
 * 원격의 브랜치를 지운다 (D178): git push <원격> --delete <브랜치> (S7 관찰 6에서 머지 뒤 이렇게 지웠다). 사용자의
 * 자격 증명과 pre-push 훅을 그대로 쓴다
 */
export async function deleteRemoteBranch(
  repo: string,
  branch: string,
  remote = 'origin',
  opts?: GitOptions,
): Promise<void> {
  await git(repo, ['push', remote, '--delete', branch], {
    ...opts,
    timeoutMs: opts?.timeoutMs ?? 300_000,
  })
}

/**
 * 이름들 가운데 파일 내용에 낱말로 나오는 것 (`git grep -F -w -o`). commit이 null이면 작업 트리(무시하지 않은 추적 안 된
 * 파일 포함)를 본다. 이번 Work가 만든 코드 이름을 가린다 (D336)
 */
export async function namesIn(
  dir: string,
  commit: string | null,
  names: readonly string[],
  opts?: GitOptions,
): Promise<Set<string>> {
  if (names.length === 0) return new Set()
  const r = await run(
    'git',
    [
      ...BASE_ARGS,
      'grep',
      '-F',
      '-w',
      '-o',
      '-h',
      '-I',
      ...(commit ? [] : ['--untracked']),
      ...names.flatMap((n) => ['-e', n]),
      ...(commit ? [commit] : []),
      '--',
    ],
    { cwd: dir, env: gitEnv(opts?.env), timeoutMs: opts?.timeoutMs ?? 60_000 },
  )
  // 1은 찾은 것이 없음
  if (r.code === 1) return new Set()
  if (r.code !== 0) throw new GitError(`git grep 실패: ${describeFailure(r)}`)
  return new Set(lines(r.stdout))
}

/** 경로들 가운데 커밋에 있는 것 (파일이나 디렉터리) */
export async function pathsAt(
  dir: string,
  commit: string,
  paths: readonly string[],
  opts?: GitOptions,
): Promise<Set<string>> {
  const keys = [...new Set(paths.map(relPath).filter(Boolean))]
  if (keys.length === 0) return new Set()
  const r = await run('git', [...BASE_ARGS, 'cat-file', '--batch-check'], {
    cwd: dir,
    env: gitEnv(opts?.env),
    timeoutMs: opts?.timeoutMs ?? 60_000,
    input: keys.map((k) => `${commit}:${k}\n`).join(''),
  })
  if (r.code !== 0) throw new GitError(`git cat-file 실패: ${describeFailure(r)}`)
  const types = r.stdout.split('\n')
  return new Set(keys.filter((_, i) => !/ missing$/.test(types[i] ?? ' missing')))
}
