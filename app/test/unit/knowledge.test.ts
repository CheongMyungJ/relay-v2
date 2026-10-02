// 지식 관리의 [단위] 시험 (M17 완료 기준). core/knowledge, handoff v2 검사, context.md의 `참고 지식`, deny 규칙,
// 전달의 knowledge 단계, 저장된 파일에 새 키가 없을 때의 기본값.
import { describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import {
  checkProjectSettings,
  normalizeConfig,
  projectKnowledgeDir,
  projectKnowledgeShare,
} from '../../src/core/config'
import { buildContext } from '../../src/core/context'
import { codexToolDenial } from '../../src/core/codex'
import {
  DEFAULT_KNOWLEDGE_DIR,
  candidateChoice,
  candidateProblem,
  editedCandidate,
  entryPath,
  inCodeReason,
  isEntryFile,
  isKnowledgeCommit,
  isStale,
  knowledgeCommitMessage,
  knowledgeOff,
  mergePool,
  newEntryId,
  normalizeKnowledgeDir,
  overlappingEntries,
  parseEntry,
  pathsInText,
  pathsOverlap,
  pendingMerged,
  planKnowledge,
  planLine,
  refreshHashes,
  renderEntry,
  renderKnowledge,
  reviewKnowledge,
  reviewTaskIds,
  selectKnowledge,
  termsMatch,
  withHashes,
  worktreeScope,
  type CandidateTask,
  type PoolEntry,
} from '../../src/core/knowledge'
import { createWork, knowledgeStage, transition } from '../../src/core/machine'
import { denyRules } from '../../src/core/settings'
import { checkHandoff, checkKnowledgeFile, checkTask, handoffV2 } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { AnyHandoff } from '../../src/shared/contracts'
import type { KnowledgeEntry, KnowledgePlan } from '../../src/shared/knowledge'
import type { TaskRecord, WorkState } from '../../src/shared/work'

// ---------- 예시 ----------

function entry(over: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'domain-a1b2c3d4',
    kind: 'domain',
    subkind: null,
    status: 'active',
    superseded_by: null,
    paths: [],
    terms: ['반올림'],
    hashes: {},
    source: { work: 'w-20261001-001', task: 't-01', by: 'human' },
    rule: '금액은 0.5에서 올린다',
    why: '회계팀이 정함',
    not_in_code: '사람이 정함',
    incentive: '은행가 반올림으로 바꾼다',
    ...over,
  }
}

function pool(e: KnowledgeEntry, scope: PoolEntry['scope'] = 'team', stale = false): PoolEntry {
  return { entry: e, scope, file: `/k/${e.kind}/${e.id}.md`, stale }
}

const BASE_HANDOFF = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

const CANDIDATE = {
  kind: 'domain',
  rule: '금액은 0.5에서 올린다',
  paths: [],
  terms: ['반올림'],
  why: '회계팀이 정함',
  not_in_code: '사람이 정함',
  incentive: '은행가 반올림으로 바꾼다',
}

function handoffText(fields: Record<string, unknown>): string {
  return `---\n${stringify({ ...BASE_HANDOFF, ...fields })}---\n## 요약\n요약\n\n## 다음 task가 알아야 할 것\n- 없음\n`
}

function check(fields: Record<string, unknown>, formatVersion?: number) {
  return checkHandoff(handoffText(fields), {
    node: 'fix',
    type: 'bugfix',
    warnChars: 1500,
    ...(formatVersion ? { formatVersion } : {}),
  })
}

function first<T>(xs: readonly T[]): T {
  const x = xs[0]
  if (x === undefined) throw new Error('빈 목록')
  return x
}

function second<T>(xs: readonly T[]): T {
  return first(xs.slice(1))
}

function header(fields: Record<string, unknown>): AnyHandoff {
  return { ...BASE_HANDOFF, ...fields } as AnyHandoff
}

// ---------- handoff v2 (I70) ----------

describe('handoff v2 검사 (I70, D295, D299, D318)', () => {
  it('객체 후보와 knowledge_feedback을 받는다', () => {
    const r = check({
      knowledge_candidates: [CANDIDATE],
      knowledge_feedback: [{ id: 'domain-a1b2c3d4', note: '지금은 내림이다' }],
    })
    expect(r.errors).toEqual([])
    expect(r.version).toBe(2)
    expect(handoffV2(r.header, r.version)?.knowledge_candidates?.[0]?.kind).toBe('domain')
  })

  it('필수 필드, 용어 1~5개, 종류별 경로, 갈래와 종류, supersedes의 모양', () => {
    const missing = check({ knowledge_candidates: [{ ...CANDIDATE, not_in_code: undefined }] })
    expect(missing.errors.map((e) => e.message)).toContain(
      '`knowledge_candidates[0].not_in_code` 없음: 필수 필드',
    )
    const noTerms = check({ knowledge_candidates: [{ ...CANDIDATE, terms: [] }] })
    expect(noTerms.errors[0]?.message).toBe(
      '`knowledge_candidates[0].terms` 항목이 모자람 (기대: 1개 이상, 지금: 0개)',
    )
    const many = check({
      knowledge_candidates: [{ ...CANDIDATE, terms: ['a', 'b', 'c', 'd', 'e', 'f'] }],
    })
    expect(many.errors[0]?.message).toContain('항목이 너무 많음 (기대: 5개 이하, 지금: 6개)')
    const constraint = check({ knowledge_candidates: [{ ...CANDIDATE, kind: 'constraint' }] })
    expect(constraint.errors[0]?.message).toBe(
      '`knowledge_candidates[0].paths` 항목이 모자람 (기대: `kind: constraint`일 때 1개 이상, 지금: 0개)',
    )
    const structure = check({
      knowledge_candidates: [{ ...CANDIDATE, kind: 'structure', paths: ['a.ts'] }],
    })
    expect(structure.errors[0]?.message).toContain('`kind: structure`일 때 2개 이상')
    const sub = check({ knowledge_candidates: [{ ...CANDIDATE, subkind: 'compat' }] })
    expect(sub.errors[0]?.message).toContain('`subkind: compat`일 때 constraint')
    const sup = check({ knowledge_candidates: [{ ...CANDIDATE, supersedes: 'D-12' }] })
    expect(sup.errors[0]?.message).toContain('지식 id')
    const fb = check({ knowledge_feedback: [{ id: 'x' }] })
    expect(fb.errors[0]?.message).toBe('`knowledge_feedback[0].note` 없음: 필수 필드')
  })

  it('후보가 많으면 경고만 한다 (D295)', () => {
    const r = check({ knowledge_candidates: Array.from({ length: 6 }, () => CANDIDATE) })
    expect(r.errors).toEqual([])
    expect(r.warnings.map((w) => w.field)).toContain('knowledge_candidates')
  })

  it('v1 task는 v1로 검사하고, 문자열 후보를 읽지 않는다', () => {
    const r = check({ knowledge_candidates: ['예전 문자열 후보'] }, 1)
    expect(r.errors).toEqual([])
    expect(r.version).toBe(1)
    expect(handoffV2(r.header, r.version)).toBeNull()
    // 같은 머리글을 v2로 검사하면 형식 오류다
    expect(check({ knowledge_candidates: ['예전 문자열 후보'] }).errors.length).toBeGreaterThan(0)
    const t = checkTask({
      node: 'fix',
      type: 'bugfix',
      files: { 'handoff.md': handoffText({ knowledge_candidates: ['x'] }), 'fix.md': '# x' },
      config: DEFAULT_CONFIG,
      formatVersion: 1,
    })
    expect(t.formatVersion).toBe(1)
    expect(t.errors).toEqual([])
  })
})

// ---------- 항목 파일 (D320) ----------

describe('항목 파일 (D306, D320)', () => {
  it('쓰고 다시 읽으면 같다', () => {
    const e = entry({ paths: ['src/money.ts:round'], hashes: { 'src/money.ts:round': 'abc' } })
    const parsed = parseEntry(renderEntry(e), 'domain/domain-a1b2c3d4.md')
    expect(parsed).toEqual({ ok: true, entry: e, warnings: [] })
  })

  it('형식 오류: 머리글 필드, id 모양, 규칙 제목', () => {
    const bad = renderEntry(entry()).replace('id: domain-a1b2c3d4', 'id: D-1')
    const r = parseEntry(bad, 'x.md')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]?.message).toContain('지식 id')
    const noRule = renderEntry(entry()).replace(/^# .*$/m, '')
    expect(checkKnowledgeFile(noRule, 'x.md').errors.map((e) => e.message)).toContain(
      '`# <규칙>` 제목 없음: 지식 파일 본문의 첫 제목',
    )
    const noStatus = renderEntry(entry()).replace('status: active\n', '')
    expect(checkKnowledgeFile(noStatus, 'x.md').errors[0]?.message).toBe('`status` 없음: 필수 필드')
  })

  it('id와 경로, 지식 폴더 설정 (D305, D320)', () => {
    expect(newEntryId('failure', () => 'AB12cd34ef')).toBe('failure-ab12cd34')
    expect(entryPath('docs/knowledge/', 'domain', 'domain-a1b2c3d4')).toBe(
      'docs/knowledge/domain/domain-a1b2c3d4.md',
    )
    expect(normalizeKnowledgeDir('./docs/kb')).toEqual({ ok: true, dir: 'docs/kb/' })
    expect(normalizeKnowledgeDir('.relay/kb').ok).toBe(false)
    expect(normalizeKnowledgeDir('.git/kb').ok).toBe(false)
    expect(normalizeKnowledgeDir('/abs').ok).toBe(false)
    expect(normalizeKnowledgeDir('a/../b').ok).toBe(false)
    expect(isEntryFile('docs/knowledge/', 'docs/knowledge/domain/domain-a1b2c3d4.md')).toBe(true)
    expect(isEntryFile('docs/knowledge/', 'docs/knowledge/README.md')).toBe(false)
  })
})

// ---------- 겹침 (D311, I74) ----------

describe('경로와 용어의 겹침 (D311, I74)', () => {
  it('같은 경로, 디렉터리와 그 아래, 심볼과 그 파일', () => {
    expect(pathsOverlap('src/a.ts', './src/a.ts')).toBe(true)
    expect(pathsOverlap('src', 'src/billing/a.ts')).toBe(true)
    expect(pathsOverlap('src/billing/', 'src/billing/a.ts')).toBe(true)
    expect(pathsOverlap('src/a.ts:round', 'src/a.ts')).toBe(true)
    expect(pathsOverlap('src/a.ts:round', 'src/a.ts:floor')).toBe(false)
    expect(pathsOverlap('src/ab', 'src/a')).toBe(false)
  })

  it('용어는 NFKC·소문자·공백 정리 뒤 글에 들어 있으면 겹친다', () => {
    expect(termsMatch(['Invoice  Total'], '청구서의 invoice total이 틀림')).toBe(true)
    expect(termsMatch(['ＡＢＣ'], 'abc')).toBe(true)
    expect(termsMatch(['환불'], '반올림')).toBe(false)
  })

  it('글에 적힌 경로를 뽑는다 (D315 (1))', () => {
    expect(pathsInText('`src/money.ts`의 round와 lib/x/ 폴더, https://a.com/b, 1.2.3')).toEqual([
      'src/money.ts',
      'lib/x',
    ])
  })
})

// ---------- 넣기 (D311, D312, D315, I74) ----------

describe('넣을 지식 고르기 (D311, D315, I74)', () => {
  const team = (id: string, over: Partial<KnowledgeEntry>) => pool(entry({ id, ...over }))

  it('경로가 겹친 항목이 용어로만 겹친 항목보다 앞이고, 도메인 규칙과 외부 호환이 먼저다', () => {
    const p = [
      team('failure-00000001', { kind: 'failure', terms: ['재시도'], paths: ['lib'] }),
      team('failure-00000002', { kind: 'failure', terms: ['반올림'], paths: ['other/x.ts'] }),
      team('failure-00000003', { kind: 'failure', terms: ['zz'], paths: ['lib/retry/job.ts'] }),
      team('structure-00000004', {
        kind: 'structure',
        terms: ['zz'],
        paths: ['lib/retry', 'b.ts'],
      }),
    ]
    const got = selectKnowledge({
      node: 'fix',
      pool: p,
      paths: ['lib/retry/job.ts'],
      text: '반올림',
    })
    expect(got.map((s) => s.entry.entry.id)).toEqual([
      'failure-00000003',
      'structure-00000004',
      'failure-00000001',
      'failure-00000002',
    ])
    const intake = selectKnowledge({
      node: 'intake',
      pool: [
        team('recipe-00000001', { kind: 'recipe', paths: ['lib'], terms: ['zz'] }),
        team('domain-00000002', { kind: 'domain', terms: ['반올림'] }),
        team('constraint-0000003', { kind: 'constraint', paths: ['lib'], terms: ['zz'] }),
        team('constraint-00000004', {
          kind: 'constraint',
          subkind: 'compat',
          paths: ['x'],
          terms: ['반올림'],
        }),
      ],
      paths: ['lib'],
      text: '반올림',
    })
    // 외부 호환이 아닌 제약은 intake에 넣지 않는다 (B.4)
    expect(intake.map((s) => s.entry.entry.id)).toEqual([
      'constraint-00000004',
      'domain-00000002',
      'recipe-00000001',
    ])
  })

  it('경로가 있는 항목도 용어로 들어간다 (D311)', () => {
    const p = [
      team('failure-00000001', { kind: 'failure', paths: ['src/x.ts'], terms: ['반올림'] }),
    ]
    expect(selectKnowledge({ node: 'fix', pool: p, paths: [], text: '반올림 버그' })).toHaveLength(
      1,
    )
  })

  it('intake는 경로·용어가 겹치지 않은 도메인 규칙도 맨 뒤에 넣는다 (지식 탐색 K3)', () => {
    const p = [
      team('domain-00000001', { terms: ['부가세'], rule: '부가세는 줄마다 버린다' }),
      team('domain-00000002', { terms: ['반올림'] }),
      team('recipe-00000003', { kind: 'recipe', terms: ['zz'] }),
      team('failure-00000004', { kind: 'failure', terms: ['zz'] }),
    ]
    const text = 'Refund API의 tax가 반올림 때문에 크다'
    expect(
      selectKnowledge({ node: 'intake', pool: p, paths: [], text }).map((s) => s.entry.entry.id),
    ).toEqual(['domain-00000002', 'domain-00000001'])
    expect(selectKnowledge({ node: 'fix', pool: p, paths: [], text })).toEqual([])
  })

  it('intake의 겹치지 않은 도메인 규칙은 용어의 한 낱말이 글에 있는 것이 먼저다 (지식 탐색 K3)', () => {
    const p = [
      team('domain-00000001', { terms: ['쿠폰'] }),
      team('domain-00000002', { terms: ['환불'] }),
      team('domain-00000009', {
        terms: ['오류 문구'],
        rule: '오류 문구에 원인 코드를 보이지 않는다',
      }),
    ]
    const text = '로그인 화면에서 아무 문구도 안 보인다'
    expect(
      selectKnowledge({ node: 'intake', pool: p, paths: [], text }).map((s) => s.entry.entry.id),
    ).toEqual(['domain-00000009', 'domain-00000001', 'domain-00000002'])
  })

  it('대체됨 항목과 다른 단계의 종류는 넣지 않는다', () => {
    const p = [
      team('domain-00000001', { status: 'superseded', superseded_by: 'domain-00000002' }),
      team('domain-00000003', {}),
    ]
    expect(selectKnowledge({ node: 'verify', pool: p, paths: [], text: '반올림' })).toEqual([])
    expect(selectKnowledge({ node: 'intake', pool: p, paths: [], text: '반올림' })).toHaveLength(1)
  })

  it('같은 id는 이 Work가 실은 것, 공유 대기, 머지된 팀 지식 순이고 낡음은 팀 지식만 판정한다', () => {
    const merged = mergePool([
      pool(entry({ rule: '팀' }), 'team', true),
      pool(entry({ rule: '대기' }), 'pending', true),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.entry.rule).toBe('대기')
    expect(merged[0]?.stale).toBe(false)
    const carried = mergePool([
      pool(entry({ rule: '대기' }), 'pending'),
      pool(entry({ rule: 'PR' }), 'carried'),
      pool(entry({ rule: '팀' }), 'team'),
    ])
    expect(carried[0]?.entry.rule).toBe('PR')
  })

  it('자르기는 항목 가운데서 자르지 않고 지식 폴더를 안내한다 (D312)', () => {
    const p = Array.from({ length: 10 }, (_, i) =>
      team(`domain-0000000${i}`, { rule: `규칙 ${'가'.repeat(80)} ${i}` }),
    )
    const r = renderKnowledge({
      node: 'intake',
      pool: p,
      paths: [],
      text: '반올림',
      limit: 400,
      dirs: ['docs/knowledge/'],
    })
    const lines = r.text.split('\n').filter((l) => l.startsWith('- '))
    expect(lines.length).toBe(r.ids.length)
    expect(lines.length).toBeLessThan(10)
    expect(lines.every((l) => l.endsWith('.md'))).toBe(true)
    expect(r.text).toContain(`${10 - lines.length}건을 뺐다`)
    expect(r.text).toContain('docs/knowledge/')
    expect(
      renderKnowledge({ node: 'intake', pool: [], paths: [], text: '', limit: 400, dirs: [] }).text,
    ).toBe('없음')
  })

  it('재확인 필요를 줄 끝에 붙인다', () => {
    const r = renderKnowledge({
      node: 'fix',
      pool: [
        pool(entry({ kind: 'failure', id: 'failure-00000001', paths: ['a.ts'] }), 'team', true),
      ],
      paths: ['a.ts'],
      text: '',
      limit: 1500,
      dirs: [],
    })
    expect(r.text).toContain(
      '[실패 부류] 금액은 0.5에서 올린다 (a.ts) — /k/failure/failure-00000001.md (재확인 필요)',
    )
  })
})

// ---------- 낡음 (D316) ----------

describe('낡음 (D316, D320, I72)', () => {
  const e = entry({ paths: ['src/a.ts', 'src/b'], hashes: { 'src/a.ts': 'h1', 'src/b': 't1' } })
  it('해시가 같으면 아니고, 다르거나 없으면 재확인이다', () => {
    expect(isStale(e, { 'src/a.ts': 'h1', 'src/b': 't1' })).toBe(false)
    expect(isStale(e, { 'src/a.ts': 'h2', 'src/b': 't1' })).toBe(true)
    expect(isStale(e, { 'src/a.ts': null, 'src/b': 't1' })).toBe(true)
    expect(isStale(entry(), {})).toBe(false)
  })

  it('해시를 새로 적고, 바뀐 항목만 돌려준다 (D323)', () => {
    expect(withHashes(e, { 'src/a.ts': 'h9', 'src/b': null }).hashes).toEqual({ 'src/a.ts': 'h9' })
    expect(refreshHashes([e], { 'src/a.ts': 'h1', 'src/b': 't1' })).toEqual([])
    expect(refreshHashes([e], { 'src/a.ts': 'h2', 'src/b': 't1' })[0]?.hashes['src/a.ts']).toBe(
      'h2',
    )
  })

  it('적을 때 없던 경로는 지금도 없으면 재확인이 아니고, 다시 생기면 재확인이다 (지식 탐색 K5)', () => {
    const gone = entry({ paths: ['src/old.ts'], hashes: { 'src/old.ts': 'h1' } })
    expect(isStale(gone, { 'src/old.ts': null })).toBe(true)
    // [그대로 맞음]은 지금 해시로 다시 적는다. 없는 경로는 적지 못한다
    const confirmed = withHashes(gone, { 'src/old.ts': null })
    expect(confirmed.hashes).toEqual({})
    expect(isStale(confirmed, { 'src/old.ts': null })).toBe(false)
    expect(isStale(confirmed, { 'src/old.ts': 'h2' })).toBe(true)
  })

  it('공유 대기와 나만은 판정하지 않는다', () => {
    const merged = mergePool([pool(entry({ id: 'domain-00000009' }), 'mine', true)])
    expect(merged[0]?.stale).toBe(false)
  })
})

describe('공유 대기 판단 (D310 (4), I74)', () => {
  it('기준 커밋에 같은 내용이 있으면 머지된 것이고, worktree에만 있으면 아니다', () => {
    const text = renderEntry(entry())
    expect(pendingMerged(text, text.replace(/\n/g, '\r\n'))).toBe(true)
    expect(pendingMerged(text, null)).toBe(false)
    expect(pendingMerged(text, renderEntry(entry({ rule: '다름' })))).toBe(false)
    expect(worktreeScope(text, text)).toBe('team')
    expect(worktreeScope(text, null)).toBe('carried')
  })
})

// ---------- 후보 모으기 (D283, D296, D299, D304, D313, D318) ----------

function task(id: string, over: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    seq: Number(id.slice(2)),
    node: 'fix',
    status: 'approved',
    reason: 'default',
    format_version: 2,
    created_at: '',
    session: null,
    bounce_count: 0,
    check: null,
    ...over,
  }
}

describe('후보 모으기 (D283, D296, D299, D304, D318)', () => {
  const human = { what: '금액은 0.5에서 올린다', why: '회계팀', by: 'human' }

  it('폐기한 task의 후보는 빠진다', () => {
    const work = {
      tasks: [
        task('t-01', { node: 'intake' }),
        task('t-02', { status: 'discarded' }),
        task('t-03'),
        task('t-04', { node: 'respond' }),
      ],
    }
    expect(reviewTaskIds(work, 'pipeline').map((t) => t.id)).toEqual(['t-01', 't-03'])
    expect(reviewTaskIds(work, 'respond').map((t) => t.id)).toEqual(['t-04'])
  })

  it('v1 task는 사람 결정만 올린다', () => {
    const tasks: CandidateTask[] = [
      {
        taskId: 't-01',
        node: 'intake',
        version: 1,
        header: header({ decisions: [human], knowledge_candidates: ['문자열'] }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates).toHaveLength(1)
    expect(r.candidates[0]).toMatchObject({ unrefined: true, rule: human.what, by: 'human' })
  })

  it('decision으로 묶이고, 묶이지 않은 사람 결정은 다듬지 않은 것이며 채택 안 함이 기본이다', () => {
    const tasks: CandidateTask[] = [
      {
        taskId: 't-01',
        node: 'intake',
        version: 2,
        header: header({
          decisions: [human, { what: '이번 수정 범위는 a만', why: 'x', by: 'human' }],
          knowledge_candidates: [{ ...CANDIDATE, decision: human.what }],
        }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates.map((c) => [c.unrefined, c.by, c.rule])).toEqual([
      [false, 'human', CANDIDATE.rule],
      [true, 'human', '이번 수정 범위는 a만'],
    ])
    expect(candidateChoice(first(r.candidates), undefined, true)).toEqual({
      adopt: true,
      share: 'team',
      replace: null,
    })
    expect(candidateChoice(second(r.candidates), undefined, true).adopt).toBe(false)
    // 팀 공유가 꺼져 있으면 나만이다 (D322)
    expect(candidateChoice(first(r.candidates), undefined, false).share).toBe('mine')
  })

  it('같은 사람 결정에서 뒤 task가 올린 후보는 앞 후보를 가리키고 채택 안 함이 기본이다 (D324)', () => {
    // [실제] knowledge에서 본 꼴: intake가 결정하고 다듬었고, verify가 같은 결정을 다시 다듬어 올렸다(자기 decisions는 비었음)
    const tasks: CandidateTask[] = [
      {
        taskId: 't-01',
        node: 'intake',
        version: 2,
        header: header({
          decisions: [human],
          knowledge_candidates: [{ ...CANDIDATE, decision: human.what }],
        }),
      },
      {
        taskId: 't-03',
        node: 'verify',
        version: 2,
        header: header({
          decisions: [],
          knowledge_candidates: [{ ...CANDIDATE, rule: '같은 규칙 다른 말', decision: human.what }],
        }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates.map((c) => [c.key, c.by, c.sameDecisionAs])).toEqual([
      ['t-01#k1', 'human', null],
      ['t-03#k1', 'human', 't-01#k1'],
    ])
    expect(candidateChoice(first(r.candidates), undefined, true).adopt).toBe(true)
    expect(candidateChoice(second(r.candidates), undefined, true).adopt).toBe(false)
    // 사람이 고르면 뒤 후보도 채택된다
    expect(
      candidateChoice(
        second(r.candidates),
        { candidates: { 't-03#k1': { adopt: true, share: 'team', replace: null } } },
        true,
      ).adopt,
    ).toBe(true)
  })

  it('다른 task가 올린 같은 종류·갈래, 같은 파일, 겹치는 용어의 후보는 비슷한 후보로 채택 안 함이 기본이다 (D326)', () => {
    // 평가 21~23에서 본 꼴: fix와 verify가 decision 없이 같은 규칙을 따로 올렸다
    const rule = { ...CANDIDATE, paths: ['src/invoice/total.js'], terms: ['부가세', '버림'] }
    const recipe = { ...rule, kind: 'recipe', terms: ['npm test'] }
    const tasks: CandidateTask[] = [
      {
        taskId: 't-01',
        node: 'intake',
        version: 2,
        header: header({ knowledge_candidates: [rule] }),
      },
      {
        taskId: 't-02',
        node: 'fix',
        version: 2,
        header: header({
          knowledge_candidates: [
            // 디렉터리만 겹치는 레시피는 따로다 (넓은 경로가 뒤 후보를 모두 삼키지 않게)
            {
              ...recipe,
              rule: '빈 배열과 할인 합계를 npm test로 재현한다',
              paths: ['src/invoice'],
            },
            { ...recipe, rule: 'INV-2031로 본다' },
            // 같은 task의 비슷한 후보끼리는 묶지 않는다
            { ...recipe, rule: 'npm test를 두 번 돌려 합계 경계 실패를 재현한다' },
          ],
        }),
      },
      {
        taskId: 't-03',
        node: 'verify',
        version: 2,
        header: header({
          knowledge_candidates: [
            // 앞 task의 도메인 규칙과 같은 규칙 → 비슷한 후보 (파일과 그 파일의 심볼은 같은 파일)
            { ...rule, rule: '같은 규칙 다른 말', paths: ['./src/invoice/total.js:computeTotals'] },
            // 같은 파일이어도 용어가 겹치지 않으면 다른 규칙이다
            { ...rule, rule: '할인은 줄마다 나눈다', terms: ['할인'] },
            // 같은 파일의 같은 종류 레시피 → 앞 task의 처음 후보를 가리킨다
            { ...recipe, rule: 'npm test로 할인 합계 재현을 확인한다' },
            // 기존 항목을 고치는 후보는 비슷해도 묶지 않는다
            { ...recipe, rule: 'npm run test:unit으로 본다', supersedes: 'recipe-a1b2c3d4' },
          ],
        }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates.map((c) => [c.key, c.similarTo])).toEqual([
      ['t-01#k1', null],
      ['t-02#k1', null],
      ['t-02#k2', null],
      ['t-02#k3', null],
      ['t-03#k1', 't-01#k1'],
      ['t-03#k2', null],
      ['t-03#k3', 't-02#k2'],
      ['t-03#k4', null],
    ])
    const byKey = (k: string) => first(r.candidates.filter((c) => c.key === k))
    const adopt = (k: string) => candidateChoice(byKey(k), undefined, true).adopt
    expect(r.candidates.map((c) => adopt(c.key))).toEqual([
      true,
      true,
      true,
      true,
      false,
      true,
      false,
      true,
    ])
    // 사람이 고르면 비슷한 후보도 채택된다
    expect(
      candidateChoice(
        byKey('t-03#k1'),
        { candidates: { 't-03#k1': { adopt: true, share: 'team', replace: null } } },
        true,
      ).adopt,
    ).toBe(true)
  })

  it('사람 결정에서 다듬은 후보는 비슷한 후보가 되지 않고, 앞선 AI 후보가 그 후보를 가리킨다 (D326)', () => {
    const rule = { ...CANDIDATE, paths: ['src/invoice/total.js'], terms: ['부가세'] }
    const tasks: CandidateTask[] = [
      {
        taskId: 't-01',
        node: 'intake',
        version: 2,
        header: header({ knowledge_candidates: [rule] }),
      },
      {
        taskId: 't-02',
        node: 'fix',
        version: 2,
        header: header({
          decisions: [human],
          knowledge_candidates: [{ ...rule, rule: '사람이 정한 규칙', decision: human.what }],
        }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates.map((c) => [c.key, c.by, c.similarTo])).toEqual([
      ['t-01#k1', 'ai', 't-02#k1'],
      ['t-02#k1', 'human', null],
    ])
    expect(r.candidates.map((c) => candidateChoice(c, undefined, true).adopt)).toEqual([
      false,
      true,
    ])
  })

  it('갈래가 다르면 비슷한 후보가 아니다 (D326)', () => {
    const c = { ...CANDIDATE, kind: 'constraint', paths: ['src/api/v1.js'], terms: ['응답 형식'] }
    const tasks: CandidateTask[] = [
      { taskId: 't-01', node: 'intake', version: 2, header: header({ knowledge_candidates: [c] }) },
      {
        taskId: 't-03',
        node: 'verify',
        version: 2,
        header: header({ knowledge_candidates: [{ ...c, subkind: 'compat' }] }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates.map((x) => x.similarTo)).toEqual([null, null])
  })

  it('같은 결정으로 묶인 후보는 비슷한 후보로 다시 묶지 않는다 (D324, D326)', () => {
    const rule = { ...CANDIDATE, paths: ['src/a.js'], decision: human.what }
    const tasks: CandidateTask[] = [
      {
        taskId: 't-01',
        node: 'intake',
        version: 2,
        header: header({ decisions: [human], knowledge_candidates: [rule] }),
      },
      {
        taskId: 't-03',
        node: 'verify',
        version: 2,
        header: header({ knowledge_candidates: [rule] }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates.map((c) => [c.key, c.sameDecisionAs, c.similarTo])).toEqual([
      ['t-01#k1', null, null],
      ['t-03#k1', 't-01#k1', null],
    ])
  })

  it('뒤 task가 다듬은 앞 task의 사람 결정은 다듬지 않은 것으로 남지 않고, 같은 결정은 한 번만 보인다', () => {
    const scope = { what: '이번 수정 범위는 a만', why: 'x', by: 'human' }
    const tasks: CandidateTask[] = [
      { taskId: 't-01', node: 'intake', version: 2, header: header({ decisions: [human, scope] }) },
      {
        taskId: 't-02',
        node: 'fix',
        version: 2,
        header: header({
          decisions: [scope],
          knowledge_candidates: [{ ...CANDIDATE, decision: human.what }],
        }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates.map((c) => [c.key, c.unrefined, c.by])).toEqual([
      ['t-02#k1', false, 'human'],
      ['t-01#d2', true, 'human'],
    ])
  })

  it('supersedes는 대체가 기본이고, 같은 id의 틀렸다는 보고가 짝에 붙는다', () => {
    const old = entry({ id: 'domain-0000000a' })
    const tasks: CandidateTask[] = [
      {
        taskId: 't-01',
        node: 'intake',
        version: 2,
        header: header({
          knowledge_candidates: [{ ...CANDIDATE, rule: '0.5에서 내린다', supersedes: old.id }],
          knowledge_feedback: [
            { id: old.id, note: '지금은 내림' },
            { id: 'domain-0000000b', note: '모르는 항목' },
          ],
        }),
      },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [pool(old)],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    const c = first(r.candidates)
    expect(c.supersedes?.id).toBe(old.id)
    expect(c.feedback).toEqual(['지금은 내림'])
    expect(c.overlaps).toEqual([])
    expect(candidateChoice(c, undefined, true).replace).toBe(old.id)
    expect(r.feedback.map((f) => [f.id, f.entry])).toEqual([['domain-0000000b', null]])
  })

  it('틀렸다는 보고를 받은 항목과 같은 파일·겹치는 용어의 후보는 대체가 기본이고, 그 공유 대기는 함께 싣지 않는다 (지식 탐색 K1)', () => {
    const wrong = entry({
      id: 'domain-0000000a',
      paths: ['src/avg.js'],
      terms: ['빈 배열', '평균'],
    })
    const other = entry({ id: 'domain-0000000b', paths: ['src/avg.js'], terms: ['중앙값'] })
    const r = reviewKnowledge({
      tasks: [
        {
          taskId: 't-01',
          node: 'intake',
          version: 2,
          header: header({
            knowledge_candidates: [
              { ...CANDIDATE, rule: '빈 배열의 평균은 0', paths: ['src/avg.js'], terms: ['평균'] },
              { ...CANDIDATE, rule: '다른 파일', paths: ['src/x.js'], terms: ['평균'] },
            ],
            knowledge_feedback: [{ id: wrong.id, note: '사람이 0으로 정함' }],
          }),
        },
      ],
      pool: [pool(wrong, 'pending'), pool(other, 'pending')],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    const [fixes, unrelated] = [first(r.candidates), second(r.candidates)]
    expect(fixes.supersedes?.id).toBe(wrong.id)
    expect(fixes.feedback).toEqual(['사람이 0으로 정함'])
    expect(candidateChoice(fixes, undefined, true).replace).toBe(wrong.id)
    expect(unrelated.supersedes).toBeNull()
    expect(r.feedback).toEqual([])
    expect(r.pending.map((p) => p.id)).toEqual(['domain-0000000b'])
  })

  it('틀렸다는 보고만 있는 공유 대기는 함께 실릴 목록에 없고 보고 칸에만 있다 (지식 탐색 K1)', () => {
    const wrong = entry({ id: 'domain-0000000a' })
    const r = reviewKnowledge({
      tasks: [
        {
          taskId: 't-01',
          node: 'intake',
          version: 2,
          header: header({ knowledge_feedback: [{ id: wrong.id, note: '틀림' }] }),
        },
      ],
      pool: [pool(wrong, 'pending')],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.pending).toEqual([])
    expect(r.feedback.map((f) => f.id)).toEqual([wrong.id])
  })

  it('코드로 알 수 있는 후보는 까닭을 보이고 채택 안 함이 기본이다 (D297, 지식 탐색 K22)', () => {
    const recipe = (rule: string, nic: string) => ({
      kind: 'recipe' as const,
      rule,
      not_in_code: nic,
    })
    // 시험 명령만 말하는 레시피, 코드에 있다고 적은 코드불가, package.json을 가리키는 코드불가
    expect(inCodeReason(recipe('테스트는 npm test(node --test)로 실행한다', '사람이 정함'))).toBe(
      '시험 명령만 말하는 레시피',
    )
    expect(
      inCodeReason({ kind: 'structure', rule: 'a와 b', not_in_code: '이미 있는 내용이라 참고용' }),
    ).toBe('코드불가 칸이 코드에 있다고 적음')
    expect(
      inCodeReason({ kind: 'domain', rule: '빌드는 make', not_in_code: 'Makefile을 보면 안다' }),
    ).toBe('코드불가 칸이 Makefile를 가리킴')
    // 재현 입력·기대 실패, 실행 환경, 적힌 것과 다름은 남긴다
    expect(
      inCodeReason(
        recipe('기준 커밋으로 되돌려 npm test를 돌리면 쉼표 시험이 실패한다', '실행해 봐야 안다'),
      ),
    ).toBeNull()
    expect(
      inCodeReason(
        recipe('Node 22에서 node --test test/는 실패한다', '스크립트는 있으나 버전에 따라 실패'),
      ),
    ).toBeNull()
    expect(
      inCodeReason(
        recipe('통합 시험은 npm run test:integration', '지식이 test:int로 잘못 적고 있었다'),
      ),
    ).toBeNull()
    expect(
      inCodeReason({ kind: 'domain', rule: '부가세는 줄마다 버림', not_in_code: '사람이 정함' }),
    ).toBeNull()
    expect(
      inCodeReason(
        recipe(
          '빈 배열 재현은 node -e로 median([])를 찍는다',
          '재현 명령은 코드나 package.json에 없음',
        ),
      ),
    ).toBeNull()
    expect(
      inCodeReason(
        recipe(
          '시험은 node --test로 돌리고 불안정 여부는 반복 실행해 확인한다',
          '이 Work에서 정함',
        ),
      ),
    ).toBeNull()
    expect(
      inCodeReason(
        recipe(
          '순서 의존 확인은 시험 블록 순서를 뒤집은 사본을 node --test로 돌려 본다',
          '이 Work에서 정함',
        ),
      ),
    ).toBeNull()
    expect(
      inCodeReason(
        recipe(
          '테스트는 node --test로 돌린다. 현재 test/에는 paid-mail.test.js만 있다',
          '코드만으로 알기 어렵다',
        ),
      ),
    ).toBe('시험 명령만 말하는 레시피')

    const old = entry({ id: 'recipe-0000000a', kind: 'recipe', terms: ['npm test'] })
    const r = reviewKnowledge({
      tasks: [
        {
          taskId: 't-01',
          node: 'intake',
          version: 2,
          header: header({
            decisions: [{ what: '시험은 npm test로 돌린다', why: '사람이 정함', by: 'human' }],
            knowledge_candidates: [
              {
                ...CANDIDATE,
                kind: 'recipe',
                rule: '테스트는 npm test로 돌린다',
                terms: ['npm test'],
              },
              {
                ...CANDIDATE,
                kind: 'recipe',
                rule: '시험은 npm test로 돌린다',
                terms: ['npm test'],
                decision: '시험은 npm test로 돌린다',
              },
              {
                ...CANDIDATE,
                kind: 'recipe',
                rule: '시험은 npm test',
                terms: ['npm test'],
                supersedes: old.id,
              },
            ],
          }),
        },
      ],
      pool: [pool(old)],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    // 거른 후보는 다른 task의 쓸모 있는 비슷한 후보의 앞 후보가 되지 않는다
    const two = reviewKnowledge({
      tasks: [
        {
          taskId: 't-01',
          node: 'intake',
          version: 2,
          header: header({
            knowledge_candidates: [
              {
                ...CANDIDATE,
                kind: 'recipe',
                rule: '테스트는 npm test로 돌린다',
                paths: ['package.json'],
                terms: ['npm test'],
              },
            ],
          }),
        },
        {
          taskId: 't-03',
          node: 'verify',
          version: 2,
          header: header({
            knowledge_candidates: [
              {
                ...CANDIDATE,
                kind: 'recipe',
                rule: '기준 커밋으로 되돌려 npm test를 돌리면 쉼표 시험이 실패한다',
                paths: ['package.json'],
                terms: ['npm test', '재현'],
              },
            ],
          }),
        },
      ],
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(
      two.candidates.map((c) => [
        c.inCode !== null,
        c.similarTo,
        candidateChoice(c, undefined, true).adopt,
      ]),
    ).toEqual([
      [true, null, false],
      [false, null, true],
    ])
    // 에이전트 후보만 거른다. 사람 결정에서 다듬은 것과 기존 항목을 고치는 것은 남긴다
    expect(r.candidates.map((c) => [c.inCode, candidateChoice(c, undefined, true).adopt])).toEqual([
      ['시험 명령만 말하는 레시피', false],
      [null, true],
      [null, true],
    ])
  })

  it('겹치는 기존 항목과 재확인 항목 (D302, D317)', () => {
    const near = entry({ id: 'domain-0000000c', terms: ['반올림', '금액'] })
    const stale = entry({ id: 'failure-0000000d', kind: 'failure', paths: ['src/a.ts'] })
    const elsewhere = entry({ id: 'failure-0000000e', kind: 'failure', paths: ['src/z.ts'] })
    expect(
      overlappingEntries({ kind: 'domain', paths: [], terms: ['금액'] }, [pool(near)]),
    ).toHaveLength(1)
    expect(
      overlappingEntries({ kind: 'recipe', paths: [], terms: ['금액'] }, [pool(near)]),
    ).toHaveLength(0)
    const r = reviewKnowledge({
      tasks: [
        {
          taskId: 't-01',
          node: 'intake',
          version: 2,
          header: header({ knowledge_candidates: [CANDIDATE] }),
        },
      ],
      pool: [pool(near), pool(stale, 'team', true), pool(elsewhere, 'team', true)],
      changed: ['src/a.ts'],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.candidates[0]?.overlaps.map((o) => o.id)).toEqual(['domain-0000000c'])
    expect(r.stale.map((s) => s.id)).toEqual(['failure-0000000d'])
  })

  it('열린 PR에 실린 공유 대기는 함께 실릴 목록에 없다 (D310)', () => {
    const a = { ...pool(entry({ id: 'domain-00000011' }), 'pending'), carriedPr: 7 }
    const b = pool(entry({ id: 'domain-00000012' }), 'pending')
    const r = reviewKnowledge({
      tasks: [],
      pool: [a, b],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(r.pending.map((p) => p.id)).toEqual(['domain-00000012'])
  })

  it('다듬지 않은 사람 결정은 종류, 용어, 경로를 정해야 채택된다 (D304, D299)', () => {
    const tasks: CandidateTask[] = [
      { taskId: 't-02', node: 'fix', version: 2, header: header({ decisions: [human] }) },
    ]
    const r = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: false,
    })
    const c = first(r.candidates)
    expect(candidateProblem(editedCandidate(c, undefined))).toBe('종류를 정해야 함')
    expect(candidateProblem(editedCandidate(c, { kind: 'constraint', terms: ['금액'] }))).toBe(
      '제약은 경로가 하나 이상 필요함',
    )
    expect(candidateProblem(editedCandidate(c, { kind: 'domain', terms: ['금액'] }))).toBeNull()
  })
})

// ---------- 채택 결과 (D287~D289, D302, D308, D310, D322) ----------

describe('채택 결과 (I73)', () => {
  const ids = () => {
    let n = 0
    return () => `${++n}`.padStart(8, '0')
  }
  const tasks: CandidateTask[] = [
    {
      taskId: 't-01',
      node: 'intake',
      version: 2,
      header: header({ knowledge_candidates: [CANDIDATE, { ...CANDIDATE, rule: '두 번째' }] }),
    },
  ]
  function plan(
    delivery: 'none' | 'push' | 'pr',
    opts: {
      share?: boolean
      extra?: PoolEntry[]
      choices?: Parameters<typeof planKnowledge>[0]['choices']
    } = {},
  ): KnowledgePlan {
    const p = opts.extra ?? []
    const review = reviewKnowledge({
      tasks,
      pool: p,
      changed: [],
      share: opts.share ?? true,
      dir: 'd/',
      offerPending: true,
    })
    return planKnowledge({
      review,
      choices: opts.choices,
      delivery,
      work: 'w-1',
      task: 't-03',
      pool: p,
      random: ids(),
    })
  }

  it('[PR 생성]이면 팀 지식을 레포에 쓰고 공유 대기 사본도 둔다 (D287, D310 (4))', () => {
    const r = plan('pr')
    expect(r.repo.map((e) => e.id)).toEqual(['domain-00000001', 'domain-00000002'])
    expect(r.pending.map((e) => e.id)).toEqual(r.repo.map((e) => e.id))
    expect(r.carry).toEqual(r.repo.map((e) => e.id))
    expect(r.counts).toEqual({ team: 2, mine: 0, pending: 0 })
    expect(r.repo[0]?.source).toEqual({ work: 'w-1', task: 't-01', by: 'ai' })
  })

  it('[완료만]·[push]면 팀 지식은 공유 대기다 (D287)', () => {
    for (const d of ['none', 'push'] as const) {
      const r = plan(d)
      expect(r.repo).toEqual([])
      expect(r.carry).toEqual([])
      expect(r.pending).toHaveLength(2)
      expect(r.counts).toEqual({ team: 2, mine: 0, pending: 2 })
    }
  })

  it('나만, 버림, 팀 공유 꺼짐 (D289, D322)', () => {
    const r = plan('pr', {
      choices: {
        candidates: {
          't-01#k1': { adopt: true, share: 'mine', replace: null },
          't-01#k2': { adopt: false, share: 'team', replace: null },
        },
      },
    })
    expect(r.repo).toEqual([])
    expect(r.mine.map((e) => e.rule)).toEqual([CANDIDATE.rule])
    const off = plan('pr', { share: false })
    expect(off.repo).toEqual([])
    expect(off.pending).toEqual([])
    expect(off.mine).toHaveLength(2)
  })

  it('머지된 팀 지식의 대체는 옛 항목을 대체됨으로 함께 싣는다 (D302)', () => {
    const old = entry({ id: 'domain-0000000a', terms: ['반올림'] })
    const r = plan('pr', {
      extra: [pool(old)],
      choices: { candidates: { 't-01#k1': { adopt: true, share: 'team', replace: old.id } } },
    })
    const superseded = r.repo.find((e) => e.id === old.id)
    expect(superseded).toMatchObject({ status: 'superseded', superseded_by: 'domain-00000001' })
  })

  it('공유 대기를 함께 싣고, 나만으로 돌리고, 버린다 (D308)', () => {
    const a = pool(entry({ id: 'recipe-00000021', kind: 'recipe', terms: ['zz'] }), 'pending')
    const b = pool(entry({ id: 'recipe-00000022', kind: 'recipe', terms: ['zz'] }), 'pending')
    const c = pool(entry({ id: 'recipe-00000023', kind: 'recipe', terms: ['zz'] }), 'pending')
    const carried = {
      ...pool(entry({ id: 'recipe-00000024', kind: 'recipe', terms: ['zz'] }), 'pending'),
      carriedPr: 3,
    }
    const r = plan('pr', {
      extra: [a, b, c, carried],
      choices: { pending: { [b.entry.id]: 'mine', [c.entry.id]: 'drop' } },
    })
    expect(r.repo.map((e) => e.id)).toContain(a.entry.id)
    expect(r.repo.map((e) => e.id)).not.toContain(carried.entry.id)
    expect(r.mine.map((e) => e.id)).toEqual([b.entry.id])
    expect(r.removePending.sort()).toEqual([b.entry.id, c.entry.id].sort())
    // [push]면 공유 대기는 그대로 남는다
    expect(plan('push', { extra: [a] }).removePending).toEqual([])
  })

  it('후보가 대체하기로 한 공유 대기는 함께 싣지 않고 지운다 (D302, D308)', () => {
    // 겹치는 기존 항목(D302)으로 보인 공유 대기를 후보가 대체로 고르고, 공유 대기 줄은 기본(함께 실음) 그대로다
    const old = pool(entry({ id: 'domain-0000000c', terms: ['반올림'] }), 'pending')
    const r = plan('pr', {
      extra: [old],
      choices: { candidates: { 't-01#k1': { adopt: true, share: 'team', replace: old.entry.id } } },
    })
    expect(r.repo.map((e) => e.id)).not.toContain(old.entry.id)
    expect(r.pending.map((e) => e.id)).not.toContain(old.entry.id)
    expect(r.carry).not.toContain(old.entry.id)
    expect(r.removePending).toEqual([old.entry.id])
  })

  it('재확인의 [그대로 맞음]은 팀 지식처럼 싣고, 틀렸다는 보고의 대체는 새 항목이다 (D317, D318, D320 (4))', () => {
    const stale = entry({
      id: 'failure-0000000d',
      kind: 'failure',
      paths: ['src/a.ts'],
      terms: ['zz'],
    })
    const p = [pool(stale, 'team', true)]
    const review = reviewKnowledge({
      tasks: [],
      pool: p,
      changed: ['src/a.ts'],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    const r = planKnowledge({
      review,
      choices: { stale: { [stale.id]: { action: 'confirm' } } },
      delivery: 'pr',
      work: 'w-1',
      task: 't-03',
      pool: p,
      random: ids(),
    })
    expect(r.repo.map((e) => e.id)).toEqual([stale.id])
    const replaced = planKnowledge({
      review,
      choices: { stale: { [stale.id]: { action: 'replace', rule: '새 규칙' } } },
      delivery: 'none',
      work: 'w-1',
      task: 't-03',
      pool: p,
      random: ids(),
    })
    expect(replaced.pending.map((e) => [e.id, e.status, e.rule])).toEqual([
      ['failure-00000001', 'active', '새 규칙'],
      [stale.id, 'superseded', stale.rule],
    ])
  })

  it('전달 버튼 줄의 한 줄 (I75)', () => {
    const review = reviewKnowledge({
      tasks,
      pool: [],
      changed: [],
      share: true,
      dir: 'd/',
      offerPending: true,
    })
    expect(planLine(review, undefined)).toBe(
      '팀 지식 2건은 [PR 생성]이면 PR에 함께 실리고, [완료만]·[push]면 공유 대기로 남음',
    )
    expect(planLine({ ...review, candidates: [] }, undefined)).toBeNull()
  })

  it('지식 커밋 메시지 (I73)', () => {
    expect(knowledgeCommitMessage('w-1', 3)).toBe('relay(w-1): 지식 3건')
    expect(isKnowledgeCommit('w-1', 'relay(w-1): 지식 3건')).toBe(true)
    expect(isKnowledgeCommit('w-1', 'relay(w-2): 지식 3건')).toBe(false)
  })
})

// ---------- context.md, deny 규칙, 전달, 설정 ----------

describe('context.md의 `참고 지식` (D286)', () => {
  const work = createWork({
    type: 'bugfix',
    workId: 'w-1',
    baseBranch: 'main',
    baseCommit: 'abc',
    at: '2026-10-02T10:00:00+09:00',
  }).work
  const input = {
    work,
    task: work.tasks[0] as TaskRecord,
    config: DEFAULT_CONFIG,
    taskDir: '/w/tasks/01-intake',
    request: { path: '/w/request.md', text: '요청' },
    intent: null,
    decisionLog: '',
    rejected: [],
    previousHandoff: null,
    artifacts: [],
  }
  it('고른 것이 없으면 "없음"이고, 꺼져 있으면 절이 없다', () => {
    expect(buildContext({ ...input, knowledge: '없음' })).toContain('## 참고 지식\n\n없음')
    expect(buildContext({ ...input, knowledge: null })).not.toContain('참고 지식')
    expect(buildContext(input)).not.toContain('참고 지식')
    expect(knowledgeOff({ RELAY_KNOWLEDGE: 'off' })).toBe(true)
    expect(knowledgeOff({})).toBe(false)
  })
})

describe('deny 규칙 (I78, D309, D310)', () => {
  const knowledge = {
    worktree: '/wt',
    dir: 'docs/knowledge/',
    store: '/home/.relay/projects/p/knowledge',
  }
  it('파이프라인 task는 지식 폴더와 앱 저장소를, PR 대응 task는 앱 저장소만 막는다', () => {
    const pipeline = denyRules({
      workDir: '/w',
      previousTaskDirs: [],
      knowledge: { ...knowledge, respond: false },
    })
    expect(pipeline).toContain('Edit(//wt/docs/knowledge/**)')
    expect(pipeline).toContain('Edit(//home/.relay/projects/p/knowledge/**)')
    const respond = denyRules({
      workDir: '/w',
      previousTaskDirs: [],
      knowledge: { ...knowledge, respond: true },
    })
    expect(respond).not.toContain('Edit(//wt/docs/knowledge/**)')
    expect(respond).toContain('Edit(//home/.relay/projects/p/knowledge/**)')
    expect(
      denyRules({ workDir: '/w', previousTaskDirs: [] }).some((r) => r.includes('knowledge')),
    ).toBe(false)
  })

  it('Codex의 도구 보호도 같은 경로를 막는다', () => {
    const base = { workDir: '/w', previousTaskDirs: [], worktree: '/wt' }
    const edit = { file_path: '/wt/docs/knowledge/domain/x.md' }
    expect(
      codexToolDenial({ ...base, knowledge: { ...knowledge, respond: false } }, 'Write', edit),
    ).not.toBeNull()
    expect(
      codexToolDenial({ ...base, knowledge: { ...knowledge, respond: true } }, 'Write', edit),
    ).toBeNull()
  })
})

describe('전달의 knowledge 단계 (I73)', () => {
  const p = (repo: number): KnowledgePlan => ({
    repo: Array.from({ length: repo }, () => entry()),
    pending: [],
    mine: [],
    removePending: [],
    removeMine: [],
    carry: [],
    counts: { team: repo, mine: 0, pending: 0 },
  })
  it('[PR 생성]에서 레포에 쓸 것이 있을 때만 지난다', () => {
    expect(knowledgeStage('pr', p(1))).toBe(true)
    expect(knowledgeStage('pr', p(0))).toBe(false)
    expect(knowledgeStage('push', p(1))).toBe(false)
    expect(knowledgeStage('pr', null)).toBe(false)
  })

  it('[완료만]은 승인과 함께 앱 저장소에 쓴다', () => {
    const created = createWork({
      type: 'bugfix',
      workId: 'w-1',
      baseBranch: 'main',
      baseCommit: 'a',
      at: 't',
    }).work
    const verify: TaskRecord = {
      ...(created.tasks[0] as TaskRecord),
      id: 't-03',
      seq: 3,
      node: 'verify',
      status: 'awaiting_approval',
    }
    const work: WorkState = { ...created, intent: { version: 1 }, tasks: [verify] }
    const okCheck = {
      handoff_present: true,
      status: 'awaiting_approval' as const,
      errors: [],
      warnings: [],
      formatVersion: 2,
      handoff: header({}),
      handoffHeader: header({}),
    }
    const r = transition(
      work,
      { type: 'approve', taskId: 't-03', at: 't2', check: okCheck, knowledge: p(1) },
      DEFAULT_CONFIG,
    )
    expect(r.work.status).toBe('completed')
    expect(r.effects.find((e) => e.type === 'storeKnowledge')).toMatchObject({ carried: null })
    const approved = r.effects.find((e) => e.type === 'log' && e.event.type === 'task.approved')
    expect(approved).toMatchObject({
      event: { payload: { knowledge: { team: 1, mine: 0, pending: 0 } } },
    })
  })
})

describe('저장된 파일에 새 키가 없을 때의 기본값', () => {
  it('config.json의 knowledge_inject_chars', () => {
    expect(normalizeConfig({}).config.knowledge_inject_chars).toBe(1500)
    expect(normalizeConfig({ knowledge_inject_chars: 5 }).warnings).toHaveLength(1)
  })
  it('project.json의 knowledge_dir와 knowledge_share', () => {
    expect(projectKnowledgeDir({})).toBe(DEFAULT_KNOWLEDGE_DIR)
    expect(projectKnowledgeDir({ knowledge_dir: '.git/x' })).toBe(DEFAULT_KNOWLEDGE_DIR)
    expect(projectKnowledgeShare({})).toBe(true)
    expect(projectKnowledgeShare({ knowledge_share: false })).toBe(false)
    expect(checkProjectSettings({ allowed_bots: [], merge_method: null })).toEqual({
      ok: true,
      value: { allowed_bots: [], merge_method: null },
    })
    expect(
      checkProjectSettings({ allowed_bots: [], merge_method: null, knowledge_dir: '.relay/' }).ok,
    ).toBe(false)
  })
})
