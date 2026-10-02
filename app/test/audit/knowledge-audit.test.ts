// Exploratory regression scenarios: assertions describe the desired user outcome.
// Failed assertions are intentionally retained as reproducible audit findings.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { KnowledgeStore, readRepoKnowledge, writeRepoEntries } from '../../src/adapters/knowledge'
import { pathHashes } from '../../src/adapters/git'
import {
  WorkKnowledge,
  editKnowledge,
  knowledgeScreen,
  type ScreenOptions,
} from '../../src/main/knowledge'
import {
  parseEntry,
  pathsInText,
  planKnowledge,
  renderEntry,
  renderKnowledge,
  reviewKnowledge,
  type PoolEntry,
} from '../../src/core/knowledge'
import type { AnyHandoff } from '../../src/shared/contracts'
import type { KnowledgeEntry, KnowledgeChoices } from '../../src/shared/knowledge'
import type { ProjectState } from '../../src/shared/project'
import type { WorkState } from '../../src/shared/work'
import { git, makeRepo, writeFiles } from '../flow/repo'

function must<T>(value: T | undefined | null): T {
  if (value == null) throw new Error('Missing fixture value')
  return value
}
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})
const DIR = 'docs/knowledge/'
const entry = (over: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  id: 'domain-00000001',
  kind: 'domain',
  subkind: null,
  status: 'active',
  superseded_by: null,
  paths: ['src/billing.ts'],
  terms: ['반올림'],
  hashes: {},
  source: { work: 'w-audit', task: 't-01', by: 'human' },
  rule: '청구 금액은 반올림한다',
  why: '회계팀 결정',
  not_in_code: '사람이 정함',
  incentive: '은행가 반올림을 적용한다',
  ...over,
})
async function setup(share = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-audit-'))
  roots.push(root)
  const { repo, remote } = makeRepo(root, 'sample', {
    'src/billing.ts': 'export const round = Math.round\n',
    'src/other.ts': 'export const x = 1\n',
  })
  const project: ProjectState = {
    schema_version: 1,
    project_id: 'audit',
    repo_path: repo,
    default_branch: 'main',
    created_at: 'audit',
    checks: { origin: false, gh: false, checked_at: 'audit' },
    knowledge_share: share,
  }
  const store = new KnowledgeStore(path.join(root, 'knowledge'))
  let queue = Promise.resolve()
  const lock = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn)
    queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
  const options: ScreenOptions = { project, store, lock, env: process.env, at: () => 'audit' }
  const problems: string[] = []
  const work = () =>
    ({ work_id: 'w-audit', base_commit: git(repo, 'rev-parse', 'HEAD') }) as WorkState
  const knowledge = new WorkKnowledge({
    ...options,
    project: () => project,
    work,
    worktree: repo,
    problem: (p) => problems.push(p),
  })
  const seedTeam = async (e = entry()) => {
    const hashes = await pathHashes(repo, 'HEAD', e.paths, DIR)
    await writeRepoEntries(repo, DIR, [
      {
        ...e,
        hashes: Object.fromEntries(Object.entries(hashes).filter(([, v]) => v !== null)) as Record<
          string,
          string
        >,
      },
    ])
    git(repo, 'add', '-A')
    git(repo, 'commit', '-qm', 'seed knowledge')
  }
  const edit = (input: Parameters<typeof editKnowledge>[1]) => editKnowledge(options, input)
  const screen = () => knowledgeScreen(options)
  return {
    root,
    repo,
    remote,
    project,
    store,
    options,
    knowledge,
    problems,
    seedTeam,
    edit,
    screen,
  }
}
function plan(pool: PoolEntry[], choices: KnowledgeChoices, feedback = false) {
  const review = reviewKnowledge({
    tasks: feedback
      ? [
          {
            taskId: 't-03',
            node: 'verify',
            version: 2,
            header: {
              status: 'awaiting_approval',
              decisions: [],
              assumptions: [],
              rejected: [],
              open_questions: [],
              risks: [],
              blocked_reason: null,
              intent_deviation: null,
              recommended_next: null,
              knowledge_candidates: [],
              knowledge_feedback: [{ id: must(pool[0]).entry.id, note: '잘못된 규칙' }],
            } as AnyHandoff,
          },
        ]
      : [],
    pool,
    changed: [],
    share: true,
    dir: DIR,
    offerPending: true,
  })
  return planKnowledge({
    review,
    choices,
    delivery: 'pr',
    work: 'w-audit',
    task: 't-03',
    pool,
    random: () => 'abcdefgh',
  })
}

describe('knowledge exploratory audit', () => {
  it('A01 empty project: all groups empty with no warning', async () => {
    const s = await setup()
    expect(await s.screen()).toMatchObject({ team: [], mine: [], pending: [], warnings: [] })
  })
  it('A02 Korean and emoji survive persistent store and reload', async () => {
    const s = await setup()
    const e = entry({ rule: '환불 💳: 0원도 허용한다', terms: ['환불', '０원'] })
    await s.store.write('mine', e)
    expect((await new KnowledgeStore(s.store.dir).list('mine')).entries[0]?.entry).toEqual(e)
  })
  it('A03 valid personal edit survives reopening', async () => {
    const s = await setup()
    await s.store.write('mine', entry())
    expect(
      await s.edit({
        op: 'edit',
        scope: 'mine',
        id: entry().id,
        edit: { rule: '새 규칙', terms: ['결제'] },
      }),
    ).toBeNull()
    expect((await s.screen()).mine[0]).toMatchObject({ rule: '새 규칙', terms: ['결제'] })
  })
  it('A04 empty terms are rejected without changing file', async () => {
    const s = await setup()
    await s.store.write('mine', entry())
    const before = fs.readFileSync(s.store.file('mine', 'domain', entry().id), 'utf8')
    expect(
      await s.edit({ op: 'edit', scope: 'mine', id: entry().id, edit: { terms: [] } }),
    ).toContain('용어는 1~5개')
    expect(fs.readFileSync(s.store.file('mine', 'domain', entry().id), 'utf8')).toBe(before)
  })
  it('A05 six terms are rejected', async () => {
    const s = await setup()
    await s.store.write('mine', entry())
    expect(
      await s.edit({
        op: 'edit',
        scope: 'mine',
        id: entry().id,
        edit: { terms: ['1', '2', '3', '4', '5', '6'] },
      }),
    ).toContain('용어는 1~5개')
  })
  it('A06 blank rule reports a validation error instead of success', async () => {
    const s = await setup()
    await s.store.write('mine', entry())
    expect(
      await s.edit({ op: 'edit', scope: 'mine', id: entry().id, edit: { rule: '   ' } }),
    ).not.toBeNull()
  })
  it('A07 personal to pending to personal round trip has one copy', async () => {
    const s = await setup()
    await s.store.write('mine', entry())
    await s.edit({ op: 'move', scope: 'mine', id: entry().id })
    expect((await s.screen()).pending).toHaveLength(1)
    await s.edit({ op: 'move', scope: 'pending', id: entry().id })
    expect(await s.screen()).toMatchObject({
      pending: [],
      mine: [expect.objectContaining({ id: entry().id })],
    })
  })
  it('A08 share disabled rejects moving personal knowledge to team', async () => {
    const s = await setup(false)
    await s.store.write('mine', entry())
    expect(await s.edit({ op: 'move', scope: 'mine', id: entry().id })).toBe('팀 공유가 꺼져 있음')
  })
  it('A09 open PR locks pending edit, move and drop', async () => {
    const s = await setup()
    await s.store.write('pending', entry())
    await s.store.saveIndex({
      schema_version: 1,
      carried: {
        [entry().id]: {
          work: 'w-audit',
          branch: 'relay/audit',
          pr: 42,
          commit: 'abc',
          at: 'audit',
        },
      },
    })
    for (const op of ['edit', 'move', 'drop'] as const)
      expect(
        await s.edit({ op, scope: 'pending', id: entry().id, edit: { rule: '새 규칙' } }),
      ).toContain('PR #42')
    expect((await s.screen()).pending[0]?.rule).toBe(entry().rule)
  })
  it('A10 corrupt PR index must not silently unlock carried entries', async () => {
    const s = await setup()
    await s.store.write('pending', entry())
    await s.store.saveIndex({
      schema_version: 1,
      carried: {
        [entry().id]: {
          work: 'w-audit',
          branch: 'relay/audit',
          pr: 42,
          commit: 'abc',
          at: 'audit',
        },
      },
    })
    fs.writeFileSync(path.join(s.store.dir, 'knowledge.json'), '{broken')
    const screen = await s.screen()
    const editResult = await s.edit({
      op: 'edit',
      scope: 'pending',
      id: entry().id,
      edit: { rule: '잠긴 항목이 바뀜' },
    })
    fs.writeFileSync(
      path.resolve('audit-artifacts/A10-corrupt-index.json'),
      JSON.stringify(
        {
          warnings: screen.warnings,
          carriedPr: screen.pending[0]?.carriedPr,
          editResult,
          stored: (await s.store.list('pending')).entries.map((e) => e.entry),
        },
        null,
        2,
      ),
    )
    expect(screen.warnings.length).toBeGreaterThan(0)
    expect(editResult).not.toBeNull()
  })
  it('A11 team edit creates replacement and tombstone without modifying main', async () => {
    const s = await setup()
    await s.seedTeam()
    const head = git(s.repo, 'rev-parse', 'HEAD')
    await s.edit({ op: 'edit', scope: 'team', id: entry().id, edit: { rule: '팀의 새 규칙' } })
    const screen = await s.screen()
    expect(screen.pending).toHaveLength(2)
    expect(screen.team).toHaveLength(0)
    expect(git(s.repo, 'rev-parse', 'HEAD')).toBe(head)
    expect(
      (await s.knowledge.pool())
        .filter((p) => p.entry.status === 'active')
        .map((p) => p.entry.rule),
    ).toEqual(['팀의 새 규칙'])
  })
  it('A12 changing replacement to personal cannot leave a team tombstone pointing to private data', async () => {
    const s = await setup()
    await s.seedTeam()
    await s.edit({ op: 'edit', scope: 'team', id: entry().id, edit: { rule: '내 규칙' } })
    const replacement = must((await s.screen()).pending.find((e) => e.status === 'active'))
    await s.edit({ op: 'move', scope: 'pending', id: replacement.id })
    const pending = (await s.store.list('pending')).entries.map((e) => e.entry)
    expect(pending.filter((e) => e.superseded_by === replacement.id)).toEqual([])
  })
  it('A13 dropping pending replacement must not retire original with a dangling target', async () => {
    const s = await setup()
    await s.seedTeam()
    await s.edit({ op: 'edit', scope: 'team', id: entry().id, edit: { rule: '새 규칙' } })
    const replacement = must((await s.screen()).pending.find((e) => e.status === 'active'))
    await s.edit({ op: 'drop', scope: 'pending', id: replacement.id })
    expect((await s.knowledge.pool()).filter((p) => p.entry.status === 'active')).toHaveLength(1)
  })
  it('A14 share-off team edit is private and original team files are preserved', async () => {
    const s = await setup(false)
    await s.seedTeam()
    await s.edit({ op: 'edit', scope: 'team', id: entry().id, edit: { rule: '내 규칙' } })
    expect((await s.screen()).pending).toHaveLength(0)
    expect(
      (await s.knowledge.pool())
        .filter((p) => p.entry.status === 'active')
        .map((p) => p.entry.rule),
    ).toEqual(['내 규칙'])
    expect((await readRepoKnowledge(s.repo, DIR)).entries[0]?.entry.rule).toBe(entry().rule)
  })
  it('A15 code change marks team knowledge stale and confirm clears it in injection pool', async () => {
    const s = await setup()
    await s.seedTeam()
    writeFiles(s.repo, { 'src/billing.ts': 'export const round = Math.floor\n' })
    git(s.repo, 'add', '-A')
    git(s.repo, 'commit', '-qm', 'code change')
    expect((await s.screen()).team[0]?.stale).toBe(true)
    await s.edit({ op: 'confirm', id: entry().id })
    expect((await s.knowledge.pool())[0]?.stale).toBe(false)
  })
  it('A16 unrelated file change does not mark team rule stale', async () => {
    const s = await setup()
    await s.seedTeam()
    writeFiles(s.repo, { 'src/other.ts': 'export const x = 2\n' })
    git(s.repo, 'add', '-A')
    git(s.repo, 'commit', '-qm', 'unrelated')
    expect((await s.screen()).team[0]?.stale).toBe(false)
  })
  it('A17 feedback drop overrides default pending share before PR creation', async () => {
    const s = await setup()
    await s.store.write('pending', entry())
    const pool = await s.knowledge.pool()
    const p = plan(pool, { feedback: { [entry().id]: { action: 'drop' } } }, true)
    await s.knowledge.commitRepo(p)
    await s.knowledge.storePlan(p, null)
    expect((await readRepoKnowledge(s.repo, DIR)).entries).toHaveLength(0)
    expect((await s.store.list('pending')).entries).toHaveLength(0)
  })
  it('A18 feedback replacement must not ship both old and new active rules', async () => {
    const s = await setup()
    await s.store.write('pending', entry())
    const pool = await s.knowledge.pool()
    const p = plan(
      pool,
      { feedback: { [entry().id]: { action: 'replace', rule: '금액은 올림한다' } } },
      true,
    )
    await s.knowledge.commitRepo(p)
    await s.knowledge.storePlan(p, null)
    expect(
      (await readRepoKnowledge(s.repo, DIR)).entries
        .filter((e) => e.entry.status === 'active')
        .map((e) => e.entry.rule),
    ).toEqual(['금액은 올림한다'])
  })
  it('A19 pending hold keeps item local and out of PR', async () => {
    const s = await setup()
    await s.store.write('pending', entry())
    const p = plan(await s.knowledge.pool(), { pending: { [entry().id]: 'hold' } })
    expect(await s.knowledge.commitRepo(p)).toBeNull()
    await s.knowledge.storePlan(p, null)
    expect((await s.store.list('pending')).entries).toHaveLength(1)
  })
  it('A20 repeated knowledge commit is idempotent', async () => {
    const s = await setup()
    await s.store.write('pending', entry())
    const p = plan(await s.knowledge.pool(), {})
    const first = await s.knowledge.commitRepo(p)
    expect(await s.knowledge.commitRepo(p)).toBe(first)
  })
  it('A21 matching merged pending copy is cleaned on next pool read', async () => {
    const s = await setup()
    await s.seedTeam()
    await s.store.write('pending', must((await readRepoKnowledge(s.repo, DIR)).entries[0]).entry)
    expect((await s.knowledge.pool())[0]?.scope).toBe('team')
    expect((await s.store.list('pending')).entries).toHaveLength(0)
  })
  it('A22 corrupt entry is reported while valid entries still load', async () => {
    const s = await setup()
    await s.store.write('mine', entry())
    writeFiles(s.store.dir, { 'mine/domain/broken.md': 'not a knowledge entry' })
    const screen = await s.screen()
    expect(screen.mine).toHaveLength(1)
    expect(screen.warnings.join()).toContain('broken.md')
  })
  it('A23 missing required body sections are surfaced as warnings', async () => {
    const s = await setup()
    const text = must(renderEntry(entry()).split('## 코드불가')[0])
    writeFiles(s.store.dir, { 'mine/domain/domain-00000001.md': text })
    expect((await s.screen()).warnings.length).toBeGreaterThan(0)
  })
  it('A24 Korean path in request matches the complete actual file name', () => {
    expect(pathsInText('src/결제/정산.ts를 수정해 주세요')).toContain('src/결제/정산.ts')
  })
  it('A25 space-containing path in backticks remains one path', () => {
    expect(pathsInText('Fix `src/billing rules.ts` please')).toContain('src/billing rules.ts')
  })
  it('A26 long first entry respects configured context budget', async () => {
    const s = await setup()
    await s.store.write('mine', entry({ rule: '긴 규칙 '.repeat(4000) }))
    const rendered = renderKnowledge({
      node: 'intake',
      pool: await s.knowledge.pool(),
      paths: [],
      text: '반올림',
      limit: 1500,
      dirs: [s.store.dir],
    })
    expect([...rendered.text].length).toBeLessThanOrEqual(1800)
  })
  it('A27 personal delete persists after reopening', async () => {
    const s = await setup()
    await s.store.write('mine', entry())
    await s.edit({ op: 'drop', scope: 'mine', id: entry().id })
    expect((await new KnowledgeStore(s.store.dir).list('mine')).entries).toHaveLength(0)
  })
  it('A28 editing a superseded team entry must reject or create an active replacement', async () => {
    const s = await setup()
    await s.seedTeam(entry({ status: 'superseded', superseded_by: null }))
    const result = await s.edit({
      op: 'edit',
      scope: 'team',
      id: entry().id,
      edit: { rule: '되살린 규칙' },
    })
    const active = (await s.knowledge.pool()).filter((p) => p.entry.status === 'active')
    expect(result !== null || active.some((p) => p.entry.rule === '되살린 규칙')).toBe(true)
  })
  it('A29 offline origin falls back to cached remote knowledge with warning', async () => {
    const s = await setup()
    await s.seedTeam()
    git(s.repo, 'push', '-q', 'origin', 'main')
    git(s.repo, 'remote', 'set-url', 'origin', path.join(s.root, 'missing.git'))
    s.project.checks.origin = true
    const screen = await s.screen()
    expect(screen.team).toHaveLength(1)
    expect(screen.warnings.join()).toContain('가져오지 못해')
  })
  it('A30 rule and reason Markdown round trip preserves ordinary fenced content', async () => {
    const e = entry({ why: '다음 명령으로 확인\n\n```ts\n// ## 이유\nconsole.log(1)\n```' })
    const parsed = parseEntry(renderEntry(e), 'domain-00000001.md')
    expect(parsed.ok && parsed.entry.why).toBe(e.why)
  })
  it('A31 next Work cleanup must not delete a concurrent human edit of a merged pending copy', async () => {
    const s = await setup()
    await s.seedTeam()
    await s.store.write('pending', must((await readRepoKnowledge(s.repo, DIR)).entries[0]).entry)
    // Pause immediately after reading the old snapshot, then exercise the actual edit operation.
    // This controls scheduling only; git, files, locks and cleanup are real.
    const originalList = s.store.list.bind(s.store)
    let readSnapshot!: () => void
    let resumeRead!: () => void
    const snapshotReady = new Promise<void>((resolve) => {
      readSnapshot = resolve
    })
    const resume = new Promise<void>((resolve) => {
      resumeRead = resolve
    })
    let first = true
    s.store.list = async (scope) => {
      const result = await originalList(scope)
      if (scope === 'pending' && first) {
        first = false
        readSnapshot()
        await resume
      }
      return result
    }
    const loading = s.knowledge.pool()
    await snapshotReady
    expect(
      await s.edit({
        op: 'edit',
        scope: 'pending',
        id: entry().id,
        edit: { rule: '동시 편집한 새 규칙' },
      }),
    ).toBeNull()
    resumeRead()
    await loading
    expect((await s.store.list('pending')).entries.map((e) => e.entry.rule)).toEqual([
      '동시 편집한 새 규칙',
    ])
  })
})
