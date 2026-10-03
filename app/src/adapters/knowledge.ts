// 지식 파일 읽기 (core/knowledge). 레포(worktree)의 `docs/knowledge/`와, 이 앱에서 완료했지만 기준 브랜치에 아직
// 머지되지 않은 Work 브랜치의 지식 파일을 읽는다.
import fsp from 'node:fs/promises'
import path from 'node:path'
import { KNOWLEDGE_DIR, isKnowledgePath, type KnowledgeEntry } from '../core/knowledge'
import { branchExists, git, isAncestor, type GitOptions } from './git'

/** worktree의 지식 파일. 폴더가 없으면 빈 목록 */
export async function readRepoKnowledge(worktree: string): Promise<KnowledgeEntry[]> {
  const dir = path.join(worktree, KNOWLEDGE_DIR)
  let names: string[]
  try {
    names = await fsp.readdir(dir)
  } catch {
    return []
  }
  const out: KnowledgeEntry[] = []
  for (const name of names.sort()) {
    const rel = `${KNOWLEDGE_DIR}/${name}`
    if (!isKnowledgePath(rel)) continue
    try {
      const stat = await fsp.stat(path.join(dir, name))
      if (!stat.isFile()) continue
      out.push({ path: rel, text: await fsp.readFile(path.join(dir, name), 'utf8') })
    } catch {
      // 읽지 못한 파일은 넣지 않는다
    }
  }
  return out
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
