// 지식 파일 읽기 (core/knowledge). 레포(worktree)의 `docs/knowledge/`와, 이 앱에서 완료했지만 기준 브랜치에 아직
// 머지되지 않은 Work 브랜치의 지식 파일을 읽는다.
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  KNOWLEDGE_DIR,
  isKnowledgePath,
  type KnowledgeEntry,
  type KnowledgeFileChange,
} from '../core/knowledge'
import { branchExists, git, isAncestor, type GitOptions } from './git'

/** worktree의 지식 파일: `docs/knowledge/`와 그 아래 영역 폴더 한 단계 (D293). 폴더가 없으면 빈 목록 */
export async function readRepoKnowledge(worktree: string): Promise<KnowledgeEntry[]> {
  const out: KnowledgeEntry[] = []
  for (const rel of await listKnowledge(worktree)) {
    try {
      out.push({ path: rel, text: await fsp.readFile(path.join(worktree, rel), 'utf8') })
    } catch {
      // 읽지 못한 파일은 넣지 않는다
    }
  }
  return out
}

/** worktree의 지식 파일 경로 (레포 기준, `/`로 이음). 차례는 경로 순 */
async function listKnowledge(worktree: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (rel: string, depth: number) => {
    let ents: import('node:fs').Dirent[]
    try {
      ents = await fsp.readdir(path.join(worktree, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const child = `${rel}/${e.name}`
      if (e.isDirectory() && depth === 0) await walk(child, 1)
      else if (e.isFile() && isKnowledgePath(child)) out.push(child)
    }
  }
  await walk(KNOWLEDGE_DIR, 0)
  return out.sort()
}

/**
 * 이 Work가 기준 커밋에서 더하거나 고친 지식 파일 (D294): 커밋한 것과 커밋하지 않은 것, 추적하지 않는 새 파일. 지운 파일은 뺀다
 */
export async function changedKnowledge(
  worktree: string,
  base: string,
  opts?: GitOptions,
): Promise<{ path: string; text: string }[]> {
  const diff = await git(
    worktree,
    ['diff', '--name-only', '--no-renames', '--diff-filter=AM', base, '--', KNOWLEDGE_DIR],
    opts,
  )
  const untracked = await git(
    worktree,
    ['ls-files', '--others', '--exclude-standard', '--', KNOWLEDGE_DIR],
    opts,
  )
  const names = [...new Set([...diff.split(/\r?\n/), ...untracked.split(/\r?\n/)])]
    .filter((n) => n && isKnowledgePath(n))
    .sort()
  const out: { path: string; text: string }[] = []
  for (const name of names) {
    try {
      out.push({ path: name, text: await fsp.readFile(path.join(worktree, name), 'utf8') })
    } catch {
      // 지워졌거나 읽지 못한 파일은 뺀다
    }
  }
  return out
}

/** 이 Work가 기준 커밋에서 지운 지식 파일 (D297): 커밋한 것과 커밋하지 않은 것 */
export async function removedKnowledge(
  worktree: string,
  base: string,
  opts?: GitOptions,
): Promise<string[]> {
  const out = await git(
    worktree,
    ['diff', '--name-only', '--no-renames', '--diff-filter=D', base, '--', KNOWLEDGE_DIR],
    opts,
  )
  return out
    .split(/\r?\n/)
    .filter((n) => n && isKnowledgePath(n))
    .sort()
}

/** 이 Work가 기준 커밋에서 바꾼 지식 밖의 파일 (D296): 커밋하지 않은 것과 추적하지 않는 새 파일 포함 */
export async function changedCodePaths(
  worktree: string,
  base: string,
  opts?: GitOptions,
): Promise<string[]> {
  const diff = await git(worktree, ['diff', '--name-only', '--no-renames', base], opts)
  const untracked = await git(worktree, ['ls-files', '--others', '--exclude-standard'], opts)
  return [...new Set([...diff.split(/\r?\n/), ...untracked.split(/\r?\n/)])]
    .filter((n) => n && !n.startsWith(`${KNOWLEDGE_DIR}/`))
    .sort()
}

/**
 * Work 완료 화면의 지식 변경 (D298): from에서 to(null이면 작업 트리)까지 더하거나 고치거나 지운 지식 파일과 그 앞뒤 글.
 * 작업 트리면 추적하지 않는 새 파일도 넣는다. 앞 글은 from의 글이고, 새 파일이 pendingBranch(경로 → 머지 전 앞 Work의
 * 브랜치)에 있으면 그 브랜치의 글이다
 */
export async function knowledgeFileChanges(
  cwd: string,
  from: string,
  to: string | null,
  pendingBranch: ReadonlyMap<string, string>,
  opts?: GitOptions,
): Promise<KnowledgeFileChange[]> {
  const status = await git(
    cwd,
    ['diff', '--name-status', '--no-renames', from, ...(to ? [to] : []), '--', KNOWLEDGE_DIR],
    opts,
  )
  const files: { path: string; status: 'A' | 'M' | 'D' }[] = []
  for (const line of status.split(/\r?\n/)) {
    const [st, name] = line.split('\t')
    if (!name || !isKnowledgePath(name)) continue
    files.push({ path: name, status: st === 'D' ? 'D' : st === 'A' ? 'A' : 'M' })
  }
  if (!to) {
    const untracked = await git(
      cwd,
      ['ls-files', '--others', '--exclude-standard', '--', KNOWLEDGE_DIR],
      opts,
    )
    for (const name of untracked.split(/\r?\n/))
      if (name && isKnowledgePath(name) && !files.some((f) => f.path === name))
        files.push({ path: name, status: 'A' })
  }
  const show = (rev: string, p: string) => git(cwd, ['show', `${rev}:${p}`], opts).catch(() => null)
  const out: KnowledgeFileChange[] = []
  for (const f of files) {
    const text =
      f.status === 'D'
        ? null
        : to
          ? await show(to, f.path)
          : await fsp.readFile(path.join(cwd, f.path), 'utf8').catch(() => null)
    const branch = f.status === 'A' ? pendingBranch.get(f.path) : undefined
    const before = branch
      ? await show(branch, f.path)
      : f.status === 'A'
        ? null
        : await show(from, f.path)
    out.push({ ...f, text, before })
  }
  return out
}

/** 커밋에 있는 지식 파일 경로 */
export async function knowledgePathsAt(
  dir: string,
  commit: string,
  opts?: GitOptions,
): Promise<string[]> {
  const out = await git(dir, ['ls-tree', '-r', '--name-only', commit, '--', KNOWLEDGE_DIR], opts)
  return out.split(/\r?\n/).filter((n) => n && isKnowledgePath(n))
}

/** 지식을 읽을 앞 Work: 브랜치와 그 Work의 기준 커밋 */
export interface KnowledgeSource {
  workId: string
  branch: string
  baseCommit: string
}

/**
 * 앞 Work들의 브랜치에서 그 Work가 더하거나 고친 지식 파일과 지운 지식 파일(D297, `removed`). 브랜치가 없거나 이미 head의
 * 조상(머지됨)이면 건너뛴다. squash나 rebase로 머지돼 조상이 아니어도, 그 파일의 같은 글(blob)이 head의 역사에 있었으면 이미
 * 들어간 것으로 보고 뺀다: head에서 그 뒤에 고친 글을 옛 글로 덮지 않는다. 지운 것은 head에 그 파일이 없으면 뺀다.
 * 차례는 sources의 차례다
 */
export async function readPendingKnowledge(
  repo: string,
  head: string,
  sources: readonly KnowledgeSource[],
  opts?: GitOptions,
): Promise<KnowledgeEntry[]> {
  const read = async (s: KnowledgeSource): Promise<KnowledgeEntry[]> => {
    try {
      if (!(await branchExists(repo, s.branch, opts))) return []
      if (await isAncestor(repo, s.branch, head, opts)) return []
      const status = await git(
        repo,
        ['diff', '--name-status', '--no-renames', s.baseCommit, s.branch, '--', KNOWLEDGE_DIR],
        opts,
      )
      const files = status
        .split(/\r?\n/)
        .map((line) => line.split('\t'))
        .filter((f): f is [string, string] => !!f[1] && isKnowledgePath(f[1]))
      const out = await Promise.all(
        files.map(async ([st, name]): Promise<KnowledgeEntry | null> => {
          if (st === 'D') {
            const there = await git(repo, ['cat-file', '-e', `${head}:${name}`], opts).then(
              () => true,
              () => false,
            )
            return there ? { path: name, text: '', pendingFrom: s.workId, removed: true } : null
          }
          if (await landedIn(repo, head, s.branch, name, opts)) return null
          const text = await git(repo, ['show', `${s.branch}:${name}`], opts)
          return { path: name, text, pendingFrom: s.workId }
        }),
      )
      return out.filter((e): e is KnowledgeEntry => e !== null)
    } catch {
      // 읽지 못한 Work는 건너뛴다
      return []
    }
  }
  return (await Promise.all(sources.map(read))).flat()
}

/** 브랜치의 그 파일 글(blob)이 head의 역사에서 그 경로에 한 번이라도 있었나 (squash·rebase 머지 판별) */
async function landedIn(
  repo: string,
  head: string,
  branch: string,
  file: string,
  opts?: GitOptions,
): Promise<boolean> {
  const blob = await git(repo, ['rev-parse', `${branch}:${file}`], opts)
  const log = await git(repo, ['log', '--raw', '--no-abbrev', '--format=', head, '--', file], opts)
  // :<옛 모드> <새 모드> <옛 blob> <새 blob> <상태>\t<경로>
  return log.split(/\r?\n/).some((line) => line.split(/\s+/)[3] === blob)
}
