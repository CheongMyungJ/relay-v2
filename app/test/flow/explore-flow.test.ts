// [탐색] 저장·공유와 지식 화면의 동작을 가짜 claude로 확인해 test-results/explore/flow.md에 적는다. 합격 판정이 아니라 관찰이다.
// RELAY_EXPLORE_FLOW=1일 때만 돈다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, afterEach, describe, it } from 'vitest'
import { renderEntry } from '../../src/core/knowledge'
import type { KnowledgeCandidateField } from '../../src/shared/contracts'
import type { KnowledgeEntry } from '../../src/shared/knowledge'
import { drive } from './driver'
import { APP, git, harness, makeRepo, register, settle, writeFiles, type Harness } from './harness'
import { REPO_FILES, handoff, scenario, steps, type Step } from './scenarios'

const on = process.env['RELAY_EXPLORE_FLOW'] === '1'
const lines: string[] = []
const note = (s = '') => lines.push(s)
let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})
afterAll(() => {
  if (!on) return
  const out = path.join(APP, 'test-results', 'explore')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'flow.md'), lines.join('\n'))
})

function entry(
  over: Partial<KnowledgeEntry> & Pick<KnowledgeEntry, 'id' | 'kind' | 'rule'>,
): KnowledgeEntry {
  return {
    subkind: null,
    status: 'active',
    superseded_by: null,
    paths: ['src/avg.js'],
    terms: ['평균'],
    hashes: {},
    source: { work: 'w-20260901-001', task: 't-01', by: 'ai' },
    why: '지난 Work',
    not_in_code: '코드에 없음',
    incentive: '없음',
    ...over,
  }
}

const C = (
  over: Partial<KnowledgeCandidateField> & Pick<KnowledgeCandidateField, 'kind' | 'rule'>,
): KnowledgeCandidateField => ({
  paths: ['src/avg.js'],
  terms: ['평균'],
  why: '이번 Work',
  not_in_code: '사람이 정함',
  incentive: '반대로 고친다',
  ...over,
})

const intakeWith = (h: Parameters<typeof handoff>[0]): Step[] =>
  steps('intake').map((s) =>
    s.do === 'write' && s.file === 'handoff.md' ? { ...s, text: handoff(h) } : s,
  )

function store(home: string, projectId: string, scope: string): string[] {
  const dir = path.join(home, 'projects', projectId, 'knowledge', scope)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8').match(/^# (.*)$/m)?.[1] ?? f)
}

describe.runIf(on)('[탐색] 저장·공유와 지식 화면', () => {
  it('틀렸다고 보고된 공유 대기와 그와 모순인 새 후보가 기본 선택의 [PR 생성]에 함께 실린다', async () => {
    h = await harness({
      scenario: scenario({
        'work-start': intakeWith({
          knowledge_candidates: [
            C({ kind: 'domain', rule: '빈 배열의 평균은 0이다', terms: ['빈 배열', '평균'] }),
          ],
          knowledge_feedback: [{ id: 'domain-c0000001', note: '사람이 0으로 정함. 예외가 아니다' }],
        }),
      }),
    })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    const f = path.join(
      h.home,
      'projects',
      projectId,
      'knowledge',
      'pending',
      'domain',
      'domain-c0000001.md',
    )
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(
      f,
      renderEntry(
        entry({
          id: 'domain-c0000001',
          kind: 'domain',
          rule: '빈 배열의 평균은 예외를 던진다',
          terms: ['빈 배열', '평균'],
        }),
      ),
    )
    const r = await h.relay.createWork(projectId, {
      request: '빈 배열의 평균이 NaN이다',
      type: 'bugfix',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const key = r.workKey
    await drive(h.relay, h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    await settle(h, key)
    const deliver = await h.relay.deliver(key, { choice: 'pr', uncommitted: null })
    await settle(h, key)
    const tree = path.join(h.home, 'projects', projectId, 'worktrees', key.split('/')[1] ?? '')
    const files = git(tree, 'show', '--name-only', '--format=%s', 'HEAD')
    const rules = files
      .split('\n')
      .filter((l) => l.endsWith('.md') && l.includes('knowledge/'))
      .map((l) => fs.readFileSync(path.join(tree, l), 'utf8').match(/^# (.*)$/m)?.[1])
    note('## 저장·공유 1: 기본 선택의 [PR 생성]')
    note('')
    note(`- 전달: ${JSON.stringify(deliver)}`)
    note(`- 지식 커밋: ${files.split('\n')[0]}`)
    note(`- PR에 실린 규칙: ${JSON.stringify(rules)}`)
    note('')
  })

  it('동시에 도는 두 Work가 같은 규칙을 올리면 공유 대기에 둘이 쌓이고, 다음 Work에 둘 다 들어간다', async () => {
    h = await harness({
      scenario: scenario({
        'work-start': intakeWith({
          knowledge_candidates: [
            C({ kind: 'domain', rule: '빈 배열의 평균은 0이다', terms: ['빈 배열', '평균'] }),
          ],
        }),
      }),
    })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    const hh = h
    const make = async (request: string) => {
      const r = await hh.relay.createWork(projectId, {
        request,
        type: 'bugfix',
        baseBranch: 'main',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(r.error)
      return r.workKey
    }
    // 두 Work를 함께 만들어 둘 다 verify 승인 대기까지 간다(Work 2가 Work 1의 지식이 생기기 전에 시작)
    const a = await make('빈 배열의 평균이 NaN이다 (대시보드)')
    const b = await make('빈 배열의 평균이 NaN이다 (보고서)')
    const pause = {
      pauseAt: (t: { node: string; status: string }) =>
        t.node === 'verify' && t.status === 'awaiting_approval',
    }
    await Promise.all([drive(h.relay, h.ui, a, pause), drive(h.relay, h.ui, b, pause)])
    for (const k of [a, b]) {
      await settle(h, k)
      const v = h.ui.works.get(k)?.current ?? ''
      await h.relay.approve(k, v, {})
      await settle(h, k)
    }
    const pending = store(h.home, projectId, 'pending')
    note('## 저장·공유 2: 동시에 도는 두 Work')
    note('')
    note(`- 두 Work 뒤 공유 대기: ${JSON.stringify(pending)}`)
    const c = await make('빈 배열의 평균이 NaN이다 (메일)')
    await drive(h.relay, h.ui, c, { pauseAt: (t) => t.node === 'intake' })
    const dir = path.join(h.home, 'projects', projectId, 'works', c.split('/')[1] ?? '', 'tasks')
    const ctx = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0] ?? '', 'context.md'), 'utf8')
    const injected = ctx.split('\n').filter((l) => l.startsWith('- [도메인'))
    note(`- 세 번째 Work intake의 도메인 규칙 줄: ${injected.length}건`)
    note('')
  })

  it('지식 화면의 [그대로 맞음]: 경로가 지워진 팀 항목은 머지 뒤에도 재확인 필요로 남는다', async () => {
    h = await harness({})
    const { repo } = makeRepo(h.root, 'sample', {
      ...REPO_FILES,
      'src/lib/mean.js': 'export const mean = 1\n',
    })
    const blob = git(repo, 'rev-parse', 'HEAD:src/lib/mean.js')
    const e = entry({
      id: 'failure-c0000002',
      kind: 'failure',
      rule: '평균은 src/lib/mean.js 한 곳에서',
      paths: ['src/lib/mean.js'],
      hashes: { 'src/lib/mean.js': blob },
    })
    writeFiles(repo, { [`docs/knowledge/failure/${e.id}.md`]: renderEntry(e) })
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'k')
    fs.rmSync(path.join(repo, 'src/lib/mean.js'))
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'rm')
    git(repo, 'push', '-q', 'origin', 'main')
    const projectId = await register(h, repo)
    const before = await h.relay.knowledgeScreen(projectId)
    const stale0 = before.ok ? before.screen.team.find((x) => x.id === e.id)?.stale : null
    const confirmed = await h.relay.editKnowledge(projectId, { op: 'confirm', id: e.id })
    const pendingText = fs.readFileSync(
      path.join(h.home, 'projects', projectId, 'knowledge', 'pending', 'failure', `${e.id}.md`),
      'utf8',
    )
    // 다음 PR이 머지된 것처럼 공유 대기 사본을 main에 커밋한다
    writeFiles(repo, { [`docs/knowledge/failure/${e.id}.md`]: pendingText })
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'merge')
    git(repo, 'push', '-q', 'origin', 'main')
    fs.rmSync(
      path.join(h.home, 'projects', projectId, 'knowledge', 'pending', 'failure', `${e.id}.md`),
    )
    const after = await h.relay.knowledgeScreen(projectId)
    const stale1 = after.ok ? after.screen.team.find((x) => x.id === e.id)?.stale : null
    note('## 지식 화면: 경로가 지워진 항목의 [그대로 맞음]')
    note('')
    note(`- 처음: 재확인 필요=${stale0}`)
    note(
      `- [그대로 맞음]: ${JSON.stringify(confirmed)}, 공유 대기 사본의 hashes: ${pendingText.match(/hashes:.*$/m)?.[0]}`,
    )
    note(`- 머지 뒤: 재확인 필요=${stale1}`)
    note('')
  })
})
