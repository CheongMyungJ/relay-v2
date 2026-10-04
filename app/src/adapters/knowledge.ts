// 지식 파일 읽기 (core/knowledge). 레포(worktree)의 `docs/knowledge/`와, 이 앱에서 완료했지만 기준 브랜치에 아직
// 머지되지 않은 Work 브랜치의 지식 파일을 읽는다.
import fsp from 'node:fs/promises'
import path from 'node:path'
import { KNOWLEDGE_DIR, isKnowledgePath, type KnowledgeEntry } from '../core/knowledge'
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
 * 앞 Work들의 브랜치에서 그 Work가 더하거나 고친 지식 파일. 브랜치가 없거나 이미 head의 조상(머지됨)이면 건너뛴다.
 * 차례는 sources의 차례다
 */
export async function readPendingKnowledge(
  repo: string,
  head: string,
  sources: readonly KnowledgeSource[],
  opts?: GitOptions,
): Promise<KnowledgeEntry[]> {
  const out: KnowledgeEntry[] = []
  for (const s of sources) {
    try {
      if (!(await branchExists(repo, s.branch, opts))) continue
      if (await isAncestor(repo, s.branch, head, opts)) continue
      const names = (
        await git(
          repo,
          [
            'diff',
            '--name-only',
            '--no-renames',
            '--diff-filter=AM',
            s.baseCommit,
            s.branch,
            '--',
            KNOWLEDGE_DIR,
          ],
          opts,
        )
      )
        .split(/\r?\n/)
        .filter((n) => n && isKnowledgePath(n))
      for (const name of names) {
        const text = await git(repo, ['show', `${s.branch}:${name}`], opts)
        out.push({ path: name, text, pendingFrom: s.workId })
      }
    } catch {
      // 읽지 못한 Work는 건너뛴다
    }
  }
  return out
}
