// 지식 파일의 읽고 쓰기 (I71, I72). 앱 저장소(<RELAY_HOME>/projects/<project-id>/knowledge/)의 나만·공유 대기·knowledge.json과,
// worktree나 커밋의 레포 지식 폴더를 읽고 쓴다. 파일 모양은 core/knowledge가 정한다(D306, D320). 쓰기는 원자적이다.
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  KNOWLEDGE_README_FILE,
  entryPath,
  isEntryFile,
  knowledgeReadme,
  parseEntry,
  renderEntry,
} from '../core/knowledge'
import {
  EMPTY_KNOWLEDGE_INDEX,
  KNOWLEDGE_KINDS,
  type KnowledgeEntry,
  type KnowledgeIndex,
  type KnowledgeKind,
} from '../shared/knowledge'
import { filesAt, showFile, type GitOptions } from './git'
import { jsonText, projectDir, readText, writeFileAtomic } from './store'

/** 앱 저장소의 지식 폴더 (I71) */
export function storeKnowledgeDir(home: string, projectId: string): string {
  return path.join(projectDir(home, projectId), 'knowledge')
}

/** 읽은 항목 하나: 항목, 전체 파일의 경로, 내용 */
export interface ReadEntry {
  entry: KnowledgeEntry
  /** 전체 파일의 경로 */
  file: string
  /** 지식 폴더 안의 상대 경로 (레포는 레포 루트에서, 앱 저장소는 scope 폴더에서) */
  rel: string
  text: string
}

/** 읽은 항목과, 읽지 못한 파일의 문제 */
export interface ReadEntries {
  entries: ReadEntry[]
  problems: string[]
}

function parsed(text: string, file: string, rel: string, out: ReadEntries): void {
  const r = parseEntry(text, rel)
  if (r.ok) out.entries.push({ entry: r.entry, file, rel, text })
  else out.problems.push(`${rel}: ${r.errors.map((e) => e.message).join('; ')}`)
}

async function listMd(dir: string): Promise<string[]> {
  try {
    const names = await fsp.readdir(dir)
    return names.filter((n) => n.endsWith('.md')).sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

/** 종류별 폴더의 항목 파일을 읽는다 (D306). README와 종류 밖의 파일은 읽지 않는다 */
async function readKinds(root: string, relBase: string): Promise<ReadEntries> {
  const out: ReadEntries = { entries: [], problems: [] }
  for (const kind of KNOWLEDGE_KINDS) {
    for (const name of await listMd(path.join(root, kind))) {
      const file = path.join(root, kind, name)
      const text = await readText(file)
      if (text !== null) parsed(text, file, `${relBase}${kind}/${name}`, out)
    }
  }
  return out
}

/** worktree(또는 레포 폴더)의 지식 폴더를 읽는다 (D288). dir은 레포 안의 상대 경로다(D305) */
export function readRepoKnowledge(root: string, dir: string): Promise<ReadEntries> {
  return readKinds(path.join(root, dir), dir)
}

/** 커밋의 지식 폴더를 읽는다: 기준 브랜치의 팀 지식 (I77) */
export async function readKnowledgeAt(
  repo: string,
  commit: string,
  dir: string,
  opts?: GitOptions,
): Promise<ReadEntries> {
  const out: ReadEntries = { entries: [], problems: [] }
  for (const rel of await filesAt(repo, commit, dir, opts)) {
    if (!isEntryFile(dir, rel)) continue
    const text = await showFile(repo, commit, rel, opts)
    if (text !== null) parsed(text, `${commit.slice(0, 12)}:${rel}`, rel, out)
  }
  return out
}

/**
 * 레포 지식 폴더에 항목을 쓴다 (I73). 폴더가 처음 생기면 README를 한 번 쓴다(D306). 쓴 파일의 레포 상대 경로를 돌려준다.
 * 같은 id의 파일이 다른 종류 폴더에 있으면 지운다(종류를 고친 대체)
 */
export async function writeRepoEntries(
  root: string,
  dir: string,
  entries: readonly KnowledgeEntry[],
): Promise<string[]> {
  const base = path.join(root, dir)
  const fresh = !(await exists(base))
  const written: string[] = []
  if (fresh && entries.length) {
    await writeFileAtomic(path.join(base, KNOWLEDGE_README_FILE), knowledgeReadme())
    written.push(`${dir}${KNOWLEDGE_README_FILE}`)
  }
  for (const e of entries) {
    await removeOtherKinds(base, e.kind, e.id)
    const rel = entryPath(dir, e.kind, e.id)
    await writeFileAtomic(path.join(root, rel), renderEntry(e))
    written.push(rel)
  }
  return written
}

async function removeOtherKinds(base: string, kind: KnowledgeKind, id: string): Promise<void> {
  for (const k of KNOWLEDGE_KINDS) {
    if (k !== kind) await fsp.rm(path.join(base, k, `${id}.md`), { force: true })
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fsp.stat(p)
    return true
  } catch {
    return false
  }
}

/** 앱 저장소의 나만과 공유 대기 (I71) */
export type StoreScope = 'mine' | 'pending'

/** 앱 저장소의 지식 (I71): mine/<kind>/<id>.md, pending/<kind>/<id>.md, knowledge.json */
export class KnowledgeStore {
  constructor(readonly dir: string) {}

  scopeDir(scope: StoreScope): string {
    return path.join(this.dir, scope)
  }

  file(scope: StoreScope, kind: KnowledgeKind, id: string): string {
    return path.join(this.scopeDir(scope), kind, `${id}.md`)
  }

  list(scope: StoreScope): Promise<ReadEntries> {
    return readKinds(this.scopeDir(scope), `${scope}/`)
  }

  /** 항목을 쓴다. 같은 id가 다른 종류 폴더에 있으면 지운다 */
  async write(scope: StoreScope, entry: KnowledgeEntry): Promise<void> {
    await removeOtherKinds(this.scopeDir(scope), entry.kind, entry.id)
    await writeFileAtomic(this.file(scope, entry.kind, entry.id), renderEntry(entry))
  }

  async remove(scope: StoreScope, id: string): Promise<void> {
    for (const k of KNOWLEDGE_KINDS) await fsp.rm(this.file(scope, k, id), { force: true })
  }

  /** knowledge.json (I71). 없거나 읽지 못하면 빈 기록이다 */
  async index(): Promise<KnowledgeIndex> {
    const text = await readText(path.join(this.dir, 'knowledge.json'))
    if (text === null) return { ...EMPTY_KNOWLEDGE_INDEX, carried: {} }
    try {
      const data = JSON.parse(text) as Partial<KnowledgeIndex>
      return { schema_version: 1, carried: { ...(data.carried ?? {}) } }
    } catch {
      return { ...EMPTY_KNOWLEDGE_INDEX, carried: {} }
    }
  }

  async saveIndex(index: KnowledgeIndex): Promise<void> {
    await writeFileAtomic(path.join(this.dir, 'knowledge.json'), jsonText(index))
  }
}
