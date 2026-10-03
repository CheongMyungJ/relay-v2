import { git, type GitOptions } from './git'

export const KNOWLEDGE_FILE = '.relay/knowledge.md'
export const KNOWLEDGE_LIMIT = 12_000

/** Only the current committed snapshot travels between tasks and clones. */
export async function sharedKnowledge(repo: string, opts?: GitOptions): Promise<string> {
  const entries = await git(repo, ['ls-tree', 'HEAD', '--', KNOWLEDGE_FILE], opts)
  if (!entries) return ''
  if (!entries.startsWith('100644 blob ') && !entries.startsWith('100755 blob '))
    return '공유 지식이 일반 파일이 아니므로 사용하지 않았다.'
  const blob = entries.split(/\s+/)[2]
  if (!blob || !/^[a-f0-9]{40,64}$/.test(blob))
    return '공유 지식의 Git 출처를 확인하지 못하여 사용하지 않았다.'
  const size = Number(await git(repo, ['cat-file', '-s', blob], opts))
  if (size > KNOWLEDGE_LIMIT)
    return `공유 지식이 ${KNOWLEDGE_LIMIT}바이트를 초과하여 사용하지 않았다. 문서를 정리하거나 필요한 사실을 질문한다.`
  const text = await git(repo, ['cat-file', 'blob', blob], opts)
  return `출처: ${KNOWLEDGE_FILE}, Git blob ${blob}\n\n${text}`
}
