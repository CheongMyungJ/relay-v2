// git CLI의 얇은 래퍼 (I12). 사용자의 git 설정과 자격 증명을 그대로 쓴다.
import path from 'node:path'
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

export async function headCommit(dir: string, opts?: GitOptions): Promise<string> {
  return git(dir, ['rev-parse', 'HEAD'], opts)
}

/** from 커밋과 작업 트리의 차이 (커밋한 것과 커밋 안 한 추적 파일 모두) */
export async function diffFrom(dir: string, from: string, opts?: GitOptions): Promise<string> {
  return git(dir, ['diff', '--no-color', '--no-ext-diff', from], opts)
}

/** 커밋 안 된 변경 (git status --porcelain). 추적하지 않는 파일도 넣는다 */
export async function statusLines(dir: string, opts?: GitOptions): Promise<string[]> {
  return lines(await git(dir, ['status', '--porcelain=v1', '--untracked-files=all'], opts))
}
