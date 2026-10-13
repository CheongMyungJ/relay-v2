// 설계 문서의 구현 나눔 읽기 (core/plan, D393). 새 Work 대화상자는 기준 브랜치의 커밋에서, 조각 Work의 context.md는
// 그 worktree에서 읽는다.
import fsp from 'node:fs/promises'
import path from 'node:path'
import { SPLIT_SECTION, parseSplit, type PlanDoc } from '../core/plan'
import { git, type GitOptions } from './git'

/** 한 번에 읽는 설계 문서의 상한. 넘으면 경로 차례로 앞의 것만 읽는다 */
const MAX_DOCS = 50

/**
 * ref의 트리에서 `## 구현 나눔` 절이 있는 Markdown 파일을 찾아 읽는다(git grep, 작업 트리를 건드리지 않음).
 * 표가 없거나 읽지 못한 문서는 뺀다. 찾지 못하면 빈 목록이다
 */
export async function readPlanDocs(
  repo: string,
  ref: string,
  opts?: GitOptions,
): Promise<PlanDoc[]> {
  let out: string
  try {
    out = await git(
      repo,
      ['grep', '-l', '--fixed-strings', '-e', `## ${SPLIT_SECTION}`, ref, '--', '*.md'],
      opts,
    )
  } catch {
    // 찾은 것이 없으면 git grep은 1로 끝난다
    return []
  }
  const prefix = `${ref}:`
  const paths = out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l))
    .sort()
    .slice(0, MAX_DOCS)
  const docs: PlanDoc[] = []
  for (const p of paths) {
    try {
      const doc = parseSplit(p, await git(repo, ['show', `${ref}:${p}`], opts))
      if (doc) docs.push(doc)
    } catch {
      // 읽지 못한 문서는 뺀다
    }
  }
  return docs
}

/** worktree의 설계 문서를 읽는다. 없거나 표가 없으면 null */
export async function readPlanDocAt(worktree: string, doc: string): Promise<PlanDoc | null> {
  try {
    return parseSplit(doc, await fsp.readFile(path.join(worktree, doc), 'utf8'))
  } catch {
    return null
  }
}
