// Work 하나의 지식 (M17, D283~D323). WorkRunner가 부르는 조립이다: task를 시작할 때 넣을 지식(D286, D315, I74), Work 완료
// 화면과 정리 창의 후보(I75, I76), 채택 결과의 쓰기(I73), PR 진행의 머지와 끝(D288, D310), PR 대응의 지식 파일(I79, D323).
// 판정은 core/knowledge가, 파일과 git은 adapters/knowledge와 adapters/git이 한다. 앱 저장소의 쓰기는 같은 프로젝트의 Work끼리
// 한 줄로 한다(lock).
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import {
  changedPaths,
  commitInfo,
  commitPaths,
  fetchBranch,
  headCommit,
  pathHashes,
  pathsDirty,
  refCommit,
  showFiles,
  statusLines,
} from '../adapters/git'
import {
  readKnowledgeAt,
  readRepoKnowledge,
  writeRepoEntries,
  type KnowledgeStore,
  type StoreScope,
} from '../adapters/knowledge'
import { readText } from '../adapters/store'
import { projectKnowledgeDir, projectKnowledgeShare } from '../core/config'
import {
  duplicateOf,
  entryPath,
  entryPaths,
  hashCommitMessage,
  isEntryFile,
  isKnowledgeCommit,
  isStale,
  knowledgeCommitMessage,
  mergePool,
  newEntryId,
  normalizePath,
  parseEntry,
  pathsInText,
  pendingMerged,
  planKnowledge,
  refView,
  renderEntry,
  refreshHashes,
  renderKnowledge,
  reviewKnowledge,
  withHashes,
  worktreeScope,
  type CandidateTask,
  type KnowledgeDelivery,
  type PoolEntry,
} from '../core/knowledge'
import { checkKnowledgeFile, sectionText } from '../core/validate'
import {
  SUBKIND_KIND,
  candidateProblem,
  type CandidateEdit,
  type KnowledgeChoices,
  type KnowledgeEditInput,
  type KnowledgeEntry,
  type KnowledgeIndex,
  type KnowledgePlan,
  type KnowledgeReview,
  type KnowledgeScreen,
  type KnowledgeScreenEntry,
} from '../shared/knowledge'
import type { ProjectState } from '../shared/project'
import type { FormatIssue, TaskRecord, WorkState } from '../shared/work'

export interface WorkKnowledgeOptions {
  env: NodeJS.ProcessEnv
  worktree: string
  store: KnowledgeStore
  /** 같은 프로젝트의 앱 저장소 쓰기를 한 줄로 한다 */
  lock: <T>(fn: () => Promise<T>) => Promise<T>
  project: () => ProjectState
  work: () => WorkState
  problem: (text: string) => void
  at: () => string
}

/** 고른 지식과 그 절 */
export interface KnowledgeSection {
  text: string
  ids: string[]
}

/** PR 대응 라운드의 지식 파일 (I79): 고친 것과 지운 것, 머리글 오류 */
export interface RoundKnowledge {
  changed: string[]
  deleted: string[]
  errors: FormatIssue[]
}

/** 실린 곳의 기록을 지운다 (I71) */
function uncarry(index: KnowledgeIndex, id: string): void {
  index.carried = Object.fromEntries(Object.entries(index.carried).filter(([k]) => k !== id))
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 새 항목 id의 무작위 8자 (D320 (1)) */
const random8 = () => randomBytes(4).toString('hex')

export class WorkKnowledge {
  constructor(private readonly o: WorkKnowledgeOptions) {}

  /** 레포 안 지식 폴더 (D305) */
  dir(): string {
    return projectKnowledgeDir(this.o.project())
  }

  /** 팀 공유 (D322) */
  share(): boolean {
    return projectKnowledgeShare(this.o.project())
  }

  private get git() {
    return { env: this.o.env }
  }

  /** Work의 기준 커밋에 있는 같은 경로의 파일들 (I74). git 한 번으로 읽는다. 키는 맞춘 경로다 */
  private baseTexts(rels: readonly string[]): Promise<Map<string, string | null>> {
    return showFiles(this.o.worktree, this.o.work().base_commit, rels, this.git)
  }

  /**
   * 고를 수 있는 항목 (D288, I74). worktree의 지식 폴더는 기준 커밋과 같으면 머지된 팀 지식, 다르면 이 Work가 PR에 실은
   * 것이다. 앱 저장소의 공유 대기는 기준 커밋에 같은 내용이 있으면 relay 밖에서 머지된 것으로 보고 지운다(D310 (4)). 낡음은
   * 머지된 팀 지식만 worktree의 HEAD와 견준다(D316). 공유 대기와 나만은 HEAD와 다르면 출처 Work의 코드 기준이라고
   * 표시한다(D327)
   */
  async pool(): Promise<PoolEntry[]> {
    const dir = this.dir()
    const out: PoolEntry[] = []
    const repo = await readRepoKnowledge(this.o.worktree, dir)
    for (const p of repo.problems) this.o.problem(`지식 파일을 읽지 못함: ${p}`)
    const team: PoolEntry[] = []
    const index = await this.o.store.index()
    const pending = await this.o.store.list('pending')
    const pendingRel = (e: KnowledgeEntry) => normalizePath(entryPath(dir, e.kind, e.id))
    // 기준 커밋의 파일은 worktree 항목과 공유 대기 모두를 git 한 번으로 읽는다
    const base = await this.baseTexts([
      ...repo.entries.map((r) => r.rel),
      ...pending.entries.map((r) => pendingRel(r.entry)),
    ])
    for (const r of repo.entries) {
      const scope = worktreeScope(r.text, base.get(normalizePath(r.rel)) ?? null)
      const e: PoolEntry = { entry: r.entry, scope, file: r.file, stale: false }
      out.push(e)
      if (scope === 'team') team.push(e)
    }
    const merged: string[] = []
    for (const p of pending.problems) this.o.problem(`공유 대기를 읽지 못함: ${p}`)
    for (const r of pending.entries) {
      if (pendingMerged(r.text, base.get(pendingRel(r.entry)) ?? null)) {
        merged.push(r.entry.id)
        continue
      }
      out.push({
        entry: r.entry,
        scope: 'pending',
        file: r.file,
        stale: false,
        carriedPr: index.carried[r.entry.id]?.pr ?? null,
      })
    }
    if (merged.length) await this.dropPending(merged)
    const mine = await this.o.store.list('mine')
    for (const p of mine.problems) this.o.problem(`나만 쓰는 지식을 읽지 못함: ${p}`)
    for (const r of mine.entries)
      out.push({ entry: r.entry, scope: 'mine', file: r.file, stale: false })
    // 공유 대기와 나만은 출처 Work의 코드로 적혔다. 그 코드가 기준에 없으면(머지 전, [완료만]) 이 Work의 코드와 다르다 (K6)
    const local = out.filter((e) => e.scope === 'pending' || e.scope === 'mine')
    if (team.length || local.length) {
      try {
        const head = await headCommit(this.o.worktree, this.git)
        const hashes = await pathHashes(
          this.o.worktree,
          head,
          entryPaths([...team, ...local].map((t) => t.entry)),
          dir,
          this.git,
        )
        for (const t of team) t.stale = isStale(t.entry, hashes)
        for (const l of local) l.ahead = isStale(l.entry, hashes)
      } catch (e) {
        this.o.problem(`지식의 낡음을 판정하지 못함: ${message(e)}`)
      }
    }
    return mergePool(out)
  }

  /** 공유 대기 사본과 실린 곳의 기록을 지운다 */
  private dropPending(ids: readonly string[]): Promise<void> {
    return this.o.lock(async () => {
      const index = await this.o.store.index()
      for (const id of ids) {
        await this.o.store.remove('pending', id)
        uncarry(index, id)
      }
      await this.o.store.saveIndex(index)
    })
  }

  /**
   * 단계가 시작할 때 아는 경로 (D315 (1)): implement는 design.md의 `바뀌는 곳`, verify는 기준 커밋과의 diff, PR 대응은 그
   * diff와 이번 라운드의 인라인 코멘트 경로, 나머지는 요청과 intent에 적힌 경로다
   */
  async knownPaths(
    task: TaskRecord,
    text: string,
    extra: { design?: string | null; inline?: readonly string[] },
  ): Promise<string[]> {
    if (task.node === 'implement') {
      return pathsInText(sectionText(extra.design ?? '', '바뀌는 곳') ?? '')
    }
    if (task.node === 'verify' || task.node === 'respond') {
      const diff = await this.changed()
      return [...diff, ...(extra.inline ?? []).map(normalizePath)]
    }
    return pathsInText(text)
  }

  /** 기준 커밋 → 작업 트리에서 바뀐 경로 (D317, D315 (1)) */
  async changed(): Promise<string[]> {
    try {
      const c = await changedPaths(this.o.worktree, this.o.work().base_commit, this.git)
      return c.map((x) => normalizePath(x.path))
    } catch (e) {
      this.o.problem(`바뀐 경로를 읽지 못함: ${message(e)}`)
      return []
    }
  }

  /** context.md의 `참고 지식` 절 (D286, D312, D315) */
  async section(
    task: TaskRecord,
    text: string,
    limit: number,
    extra: { design?: string | null; inline?: readonly string[] },
  ): Promise<KnowledgeSection> {
    const pool = await this.pool()
    const paths = await this.knownPaths(task, text, extra)
    return renderKnowledge({
      node: task.node,
      pool,
      paths,
      text,
      limit,
      dirs: [path.join(this.o.worktree, this.dir()), this.o.store.dir],
    })
  }

  /** Work 완료 화면이나 정리 창의 지식 칸 (I75, I76) */
  async review(
    tasks: readonly CandidateTask[],
  ): Promise<{ review: KnowledgeReview; pool: PoolEntry[] }> {
    const pool = await this.pool()
    const review = reviewKnowledge({
      tasks,
      pool,
      changed: await this.changed(),
      share: this.share(),
      dir: this.dir(),
      offerPending: this.share(),
    })
    return { review, pool }
  }

  /** 채택 결과 (I73) */
  async plan(
    tasks: readonly CandidateTask[],
    choices: KnowledgeChoices | undefined,
    delivery: KnowledgeDelivery,
    taskId: string,
  ): Promise<KnowledgePlan> {
    const { review, pool } = await this.review(tasks)
    return planKnowledge({
      review,
      choices,
      delivery,
      work: this.o.work().work_id,
      task: taskId,
      pool,
      random: random8,
    })
  }

  /** HEAD가 이 Work의 지식 커밋인가 (I73) */
  async headIsKnowledgeCommit(): Promise<boolean> {
    try {
      const info = await commitInfo(this.o.worktree, 'HEAD', this.git)
      return isKnowledgeCommit(this.o.work().work_id, info.subject)
    } catch {
      return false
    }
  }

  /** 해시를 그때의 HEAD로 채운다 (I72). 대체됨 항목은 그대로 둔다 */
  private async hashed(entries: readonly KnowledgeEntry[]): Promise<KnowledgeEntry[]> {
    const active = entries.filter((e) => e.status === 'active')
    if (!active.length) return [...entries]
    const head = await headCommit(this.o.worktree, this.git)
    const hashes = await pathHashes(this.o.worktree, head, entryPaths(active), this.dir(), this.git)
    return entries.map((e) => (e.status === 'active' ? withHashes(e, hashes) : e))
  }

  /**
   * [PR 생성]의 knowledge 단계 (I73): 레포의 지식 폴더에 쓰고 그 폴더만 커밋한다. HEAD가 이 Work의 지식 커밋이고 지식 폴더가
   * 같으면 다시 커밋하지 않는다([다시 시도]). 지식 커밋을 돌려준다. 바뀐 것이 없으면 null이다
   */
  async commitRepo(plan: KnowledgePlan): Promise<string | null> {
    const dir = this.dir()
    const entries = await this.hashed(plan.repo)
    await writeRepoEntries(this.o.worktree, dir, entries)
    if (!(await pathsDirty(this.o.worktree, [dir], this.git))) {
      return (await this.headIsKnowledgeCommit())
        ? await headCommit(this.o.worktree, this.git)
        : null
    }
    return commitPaths(
      this.o.worktree,
      [dir],
      knowledgeCommitMessage(this.o.work().work_id, entries.length),
      this.git,
    )
  }

  /**
   * 채택 결과를 앱 저장소에 쓴다 (I73): 나만과 공유 대기를 쓰고 지울 것을 지운다. [PR 생성]이면 이 PR에 실린 공유 대기를
   * knowledge.json에 적는다(D310 (4)). 해시는 지금 HEAD로 채운다. worktree가 없으면(정리한 Work) 적힌 해시를 그대로 쓴다
   */
  async storePlan(
    plan: KnowledgePlan,
    carried: { pr: number | null; branch: string; commit: string | null } | null,
  ): Promise<void> {
    const hashed = async (xs: readonly KnowledgeEntry[]) => {
      try {
        return await this.hashed(xs)
      } catch {
        return [...xs]
      }
    }
    const pending = await hashed(plan.pending)
    const mine = await hashed(plan.mine)
    await this.o.lock(async () => {
      const index = await this.o.store.index()
      for (const id of plan.removePending) {
        await this.o.store.remove('pending', id)
        uncarry(index, id)
      }
      for (const id of plan.removeMine) await this.o.store.remove('mine', id)
      // 동시에 돈 Work가 그새 같은 규칙을 공유 대기에 썼으면 새로 쓰지 않는다 (지식 탐색 K7, D331). 이미 있던 항목을 다시
      // 쓰는 것([그대로 맞음] 등)은 그대로 쓴다
      // 이번에 대체하거나 지우는 항목과는 견주지 않는다: 새 규칙이 그 옛 규칙을 바꾸는 것이다
      const retired = new Set([
        ...plan.removePending,
        ...pending.filter((e) => e.status !== 'active').map((e) => e.id),
      ])
      const existing = (await this.o.store.list('pending')).entries
        .map((r) => r.entry)
        .filter((e) => !retired.has(e.id))
      const known = new Set(existing.map((x) => x.id))
      for (const e of pending) {
        // 대체된 옛 항목(superseded)은 늘 쓴다: 새 규칙과 글이 비슷해도 같은 규칙이 아니다
        if (e.status === 'active' && !known.has(e.id) && duplicateOf(e, existing)) continue
        await this.o.store.write('pending', e)
        existing.push(e)
        known.add(e.id)
      }
      for (const e of mine) await this.o.store.write('mine', e)
      if (carried) {
        for (const id of plan.carry) {
          index.carried[id] = {
            work: this.o.work().work_id,
            branch: carried.branch,
            pr: carried.pr,
            commit: carried.commit,
            at: this.o.at(),
          }
        }
      }
      await this.o.store.saveIndex(index)
    })
  }

  /**
   * PR 진행이 끝났다 (D288, D310 (4)). 머지면 이 PR에 실린 공유 대기를 지우고, [머지 없이 끝내기]면 실린 곳만 지워 다음
   * PR에 다시 싣는다
   */
  prFinished(merged: boolean): Promise<void> {
    const workId = this.o.work().work_id
    return this.o.lock(async () => {
      const index = await this.o.store.index()
      for (const [id, c] of Object.entries(index.carried)) {
        if (c.work !== workId) continue
        if (merged) await this.o.store.remove('pending', id)
        uncarry(index, id)
      }
      await this.o.store.saveIndex(index)
    })
  }

  /**
   * PR 대응 라운드의 지식 파일 (I79): 라운드 시작 커밋 → 지금 작업 트리에서 바뀌거나 새로 생기거나 지워진 지식 파일. 폴더의
   * README는 빼고, 지운 파일은 검사하지 않는다. 바뀐 파일의 머리글을 knowledge-entry 스키마로 검사한다
   */
  async roundFiles(task: TaskRecord): Promise<RoundKnowledge> {
    const out: RoundKnowledge = { changed: [], deleted: [], errors: [] }
    if (!task.start_commit) return out
    const dir = this.dir()
    const changes = await changedPaths(this.o.worktree, task.start_commit, this.git)
    const untracked = (await statusLines(this.o.worktree, this.git))
      .filter((l) => l.startsWith('?? '))
      .map((l) => ({ status: 'A', path: l.slice(3) }))
    for (const c of [...changes, ...untracked]) {
      const rel = normalizePath(c.path)
      if (!isEntryFile(dir, rel)) continue
      if (c.status.startsWith('D')) {
        out.deleted.push(rel)
        continue
      }
      if (out.changed.includes(rel)) continue
      out.changed.push(rel)
      const text = await readText(path.join(this.o.worktree, rel))
      if (text === null) continue
      out.errors.push(...checkKnowledgeFile(text, rel).errors)
    }
    return out
  }

  /**
   * PR 대응 라운드의 push 전 (D323, I73, I79): 이 PR에 실린 지식 파일(기준 커밋과 다른 것)의 해시를 지금 HEAD로 다시 적어
   * 바뀐 것이 있으면 커밋하고, 이 Work가 실은 공유 대기 사본을 PR 쪽 내용으로 맞춘다. PR에서 지워진 항목은 사본과 기록을
   * 지운다. 해시 갱신 커밋을 돌려준다
   */
  async beforeRespondPush(): Promise<string | null> {
    const dir = this.dir()
    const repo = await readRepoKnowledge(this.o.worktree, dir)
    const carried: KnowledgeEntry[] = []
    const base = await this.baseTexts(repo.entries.map((r) => r.rel))
    for (const r of repo.entries) {
      if (worktreeScope(r.text, base.get(normalizePath(r.rel)) ?? null) === 'carried') {
        carried.push(r.entry)
      }
    }
    let commit: string | null = null
    const active = carried.filter((e) => e.status === 'active')
    if (active.length) {
      const head = await headCommit(this.o.worktree, this.git)
      const hashes = await pathHashes(this.o.worktree, head, entryPaths(active), dir, this.git)
      const changed = refreshHashes(active, hashes)
      if (changed.length) {
        await writeRepoEntries(this.o.worktree, dir, changed)
        if (await pathsDirty(this.o.worktree, [dir], this.git)) {
          commit = await commitPaths(
            this.o.worktree,
            [dir],
            hashCommitMessage(this.o.work().work_id, changed.length),
            this.git,
          )
        }
      }
    }
    const now = await readRepoKnowledge(this.o.worktree, dir)
    const byId = new Map(now.entries.map((r) => [r.entry.id, r.entry]))
    const workId = this.o.work().work_id
    await this.o.lock(async () => {
      const index = await this.o.store.index()
      for (const [id, c] of Object.entries(index.carried)) {
        if (c.work !== workId) continue
        const e = byId.get(id)
        if (e) await this.o.store.write('pending', e)
        else {
          await this.o.store.remove('pending', id)
          uncarry(index, id)
        }
      }
      await this.o.store.saveIndex(index)
    })
    return commit
  }
}

// ---------- 지식 화면 (D307, I77) ----------

export interface ScreenOptions {
  project: ProjectState
  store: KnowledgeStore
  lock: <T>(fn: () => Promise<T>) => Promise<T>
  env: NodeJS.ProcessEnv
  at: () => string
}

/** 화면의 항목 모양 */
function screenEntry(p: PoolEntry): KnowledgeScreenEntry {
  const e = p.entry
  return {
    ...refView(p),
    subkind: e.subkind,
    status: e.status,
    why: e.why,
    not_in_code: e.not_in_code,
    incentive: e.incentive,
    source: e.source,
  }
}

/**
 * 팀 지식을 읽을 커밋 (I77): origin이 있으면 `origin/<기본 브랜치>`를 fetch해 그 커밋, 없거나 fetch하지 못하면 로컬 브랜치다
 */
async function teamCommit(
  o: ScreenOptions,
  warnings: string[],
): Promise<{ commit: string; from: string } | null> {
  const repo = o.project.repo_path
  const branch = o.project.default_branch
  const git = { env: o.env }
  if (o.project.checks.origin) {
    try {
      await fetchBranch(repo, branch, 'origin', git)
    } catch (e) {
      warnings.push(`origin/${branch}를 가져오지 못해 앱이 가진 것을 씀: ${message(e)}`)
    }
    const remote = await refCommit(repo, `refs/remotes/origin/${branch}`, git)
    if (remote) return { commit: remote, from: `origin/${branch}` }
  }
  const local = await refCommit(repo, `refs/heads/${branch}`, git)
  return local ? { commit: local, from: branch } : null
}

/** 팀 지식: 기본 브랜치의 커밋에서 읽고, 그 커밋의 해시와 견줘 낡음을 판정한다 (D316) */
async function teamPool(o: ScreenOptions, warnings: string[]) {
  const dir = projectKnowledgeDir(o.project)
  const at = await teamCommit(o, warnings)
  if (!at) return { at: null, pool: [] as PoolEntry[] }
  const read = await readKnowledgeAt(o.project.repo_path, at.commit, dir, { env: o.env })
  warnings.push(...read.problems.map((p) => `지식 파일을 읽지 못함: ${p}`))
  const entries = read.entries.map((r) => r.entry)
  const hashes = await pathHashes(o.project.repo_path, at.commit, entryPaths(entries), dir, {
    env: o.env,
  })
  const pool = read.entries.map((r) => ({
    entry: r.entry,
    scope: 'team' as const,
    file: path.join(o.project.repo_path, r.rel),
    stale: r.entry.status === 'active' && isStale(r.entry, hashes),
  }))
  return { at, pool, hashes }
}

async function storePool(o: ScreenOptions, warnings: string[]) {
  const index = await o.store.index()
  const pending = await o.store.list('pending')
  const mine = await o.store.list('mine')
  warnings.push(...pending.problems, ...mine.problems)
  return {
    pending: pending.entries.map((r) => ({
      entry: r.entry,
      scope: 'pending' as const,
      file: r.file,
      stale: false,
      carriedPr: index.carried[r.entry.id]?.pr ?? null,
    })),
    mine: mine.entries.map((r) => ({
      entry: r.entry,
      scope: 'mine' as const,
      file: r.file,
      stale: false,
    })),
  }
}

/** 지식 화면 (D307, I77): 팀, 나만, 공유 대기. 같은 id가 팀과 공유 대기에 모두 있으면 공유 대기 쪽을 보인다(I74) */
export async function knowledgeScreen(o: ScreenOptions): Promise<KnowledgeScreen> {
  const warnings: string[] = []
  let team: Awaited<ReturnType<typeof teamPool>> = { at: null, pool: [] }
  try {
    team = await teamPool(o, warnings)
  } catch (e) {
    warnings.push(`팀 지식을 읽지 못함: ${message(e)}`)
  }
  const { pending, mine } = await storePool(o, warnings)
  const shadowed = new Set(pending.map((p) => p.entry.id))
  const order = (a: PoolEntry, b: PoolEntry) =>
    a.entry.kind.localeCompare(b.entry.kind) || a.entry.id.localeCompare(b.entry.id)
  return {
    team: team.pool
      .filter((p) => !shadowed.has(p.entry.id))
      .sort(order)
      .map(screenEntry),
    mine: [...mine].sort(order).map(screenEntry),
    pending: [...pending].sort(order).map(screenEntry),
    share: projectKnowledgeShare(o.project),
    dir: projectKnowledgeDir(o.project),
    teamFrom: team.at ? `${team.at.from} (${team.at.commit.slice(0, 12)})` : null,
    warnings,
  }
}

/** 고친 항목 (D307): 규칙, 경로, 용어, 이유, 종류를 바꾼다 */
function applyEdit(e: KnowledgeEntry, edit: CandidateEdit): KnowledgeEntry {
  const kind = edit.kind ?? e.kind
  const subkind = edit.subkind !== undefined ? edit.subkind : e.subkind
  return {
    ...e,
    kind,
    subkind: subkind && SUBKIND_KIND[subkind] === kind ? subkind : null,
    rule: (edit.rule ?? e.rule).trim() || e.rule,
    paths: (edit.paths ?? e.paths).map(normalizePath).filter(Boolean),
    terms: (edit.terms ?? e.terms).map((t) => t.trim()).filter(Boolean),
    why: (edit.why ?? e.why).trim(),
  }
}

/**
 * 고친 항목을 쓰기 전에 검사한다 (D299, D320): 후보와 같은 필수(규칙, 용어 1~5개, 종류별 경로)와 지식 파일 스키마. 읽지 못하는
 * 파일을 쓰면 규칙이 화면과 넣기에서 사라진다. 문제가 있으면 까닭이다
 */
function editProblem(e: KnowledgeEntry): string | null {
  const why = candidateProblem(e)
  if (why) return `고친 항목을 저장하지 않음: ${why}`
  const parsed = parseEntry(renderEntry(e), `${e.id}.md`)
  if (!parsed.ok) {
    return `고친 항목을 저장하지 않음: ${parsed.errors.map((x) => x.message).join('; ')}`
  }
  return null
}

/**
 * 지식 화면의 조작 (D307, D308, D310 (3), I77). 나만은 그 자리에서 고친다. 팀은 대체 항목(새 id)과 대체됨 사본을 공유 대기에
 * 써 다음 [PR 생성]에 실린다(D302, D308). 열린 PR에 실린 공유 대기는 고치지 않는다. 팀 공유가 꺼져 있으면 팀으로 바꾸기가
 * 없고, 팀 지식의 고침은 나만에 둔다(D322)
 */
export async function editKnowledge(
  o: ScreenOptions,
  input: KnowledgeEditInput,
): Promise<string | null> {
  const warnings: string[] = []
  const share = projectKnowledgeShare(o.project)
  const human = (task: string): KnowledgeEntry['source'] => ({
    work: '(지식 화면)',
    task,
    by: 'human',
  })
  const find = (xs: readonly PoolEntry[], id: string) => xs.find((p) => p.entry.id === id)
  const teamOp = input.op === 'confirm' || ('scope' in input && input.scope === 'team')
  // 팀 지식은 기본 브랜치를 fetch해 읽는다. 네트워크를 기다리는 동안 같은 프로젝트의 다른 Work를 막지 않게 잠금 밖에서 한다
  const team = teamOp ? await teamPool(o, warnings) : null
  return o.lock(async () => {
    const { pending, mine } = await storePool(o, warnings)
    if (team) {
      const t = find(team.pool, input.id)
      if (!t) return '팀 지식에 없는 항목'
      if (find(pending, input.id)?.carriedPr) return '열린 PR에 실린 항목은 그 PR에서 고친다'
      const to = share ? 'pending' : 'mine'
      if (input.op === 'confirm') {
        // [그대로 맞음]: 해시를 새로 적어 공유 대기로 둔다 (D317, D320 (4))
        await o.store.write(to, withHashes(t.entry, team.hashes ?? {}))
        return null
      }
      if (input.op === 'drop') {
        await o.store.write(to, { ...t.entry, status: 'superseded', superseded_by: null })
        return null
      }
      if (input.op === 'edit') {
        const id = newEntryIdFor(t.entry)
        const next = withHashes(
          { ...applyEdit(t.entry, input.edit), id, source: human('edit') },
          team.hashes ?? {},
        )
        const problem = editProblem(next)
        if (problem) return problem
        await o.store.write(to, next)
        await o.store.write(to, { ...t.entry, status: 'superseded', superseded_by: id })
        return null
      }
      return '팀 지식은 옮기지 않는다'
    }
    if (input.op === 'confirm') return '팀 지식에 없는 항목'
    const scope: StoreScope = input.scope === 'mine' ? 'mine' : 'pending'
    const list = scope === 'mine' ? mine : pending
    const p = find(list, input.id)
    if (!p) return '항목이 없음'
    if (p.carriedPr) return `열린 PR #${p.carriedPr}에 실린 항목은 그 PR에서 고친다`
    if (input.op === 'drop') {
      const index = await o.store.index()
      await o.store.remove(scope, input.id)
      uncarry(index, input.id)
      await o.store.saveIndex(index)
      return null
    }
    if (input.op === 'edit') {
      const next = applyEdit(p.entry, input.edit)
      const problem = editProblem(next)
      if (problem) return problem
      await o.store.write(scope, next)
      return null
    }
    // 팀/나만 바꾸기 (D307). 공유 대기에서 나만으로 옮기면 실린 곳의 기록도 지운다: 남으면 그 Work의 다음 대응 push가
    // 공유 대기 사본을 다시 쓴다(I79)
    const to: StoreScope = scope === 'mine' ? 'pending' : 'mine'
    if (to === 'pending' && !share) return '팀 공유가 꺼져 있음'
    await o.store.write(to, p.entry)
    await o.store.remove(scope, input.id)
    if (scope === 'pending') {
      const index = await o.store.index()
      if (index.carried[input.id]) {
        uncarry(index, input.id)
        await o.store.saveIndex(index)
      }
    }
    return null
  })
}

function newEntryIdFor(e: KnowledgeEntry): string {
  return newEntryId(e.kind, random8)
}
