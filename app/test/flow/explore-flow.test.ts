// [탐색] 거르기, 저장·공유, 낡음, 지식 화면, 넣기의 앱 쪽 동작을 가짜 claude와 실제 git으로 확인한다. 시나리오마다 기대하는
// 동작과 본 것을 test-results/explore/flow.json·flow.md에 적는다. 합격 판정이 아니라 관찰이다 (docs/knowledge-explore.md).
// RELAY_EXPLORE_FLOW=1일 때만 돈다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, afterEach, describe, it } from 'vitest'
import { pathHashes } from '../../src/adapters/git'
import { renderEntry } from '../../src/core/knowledge'
import { sectionText } from '../../src/core/validate'
import type { KnowledgeCandidateField } from '../../src/shared/contracts'
import type { KnowledgeChoices, KnowledgeEntry, KnowledgeReview } from '../../src/shared/knowledge'
import { drive } from './driver'
import { APP, git, harness, makeRepo, register, settle, writeFiles, type Harness } from './harness'
import { REPO_FILES, handoff, scenario, steps, type Scenario, type Step } from './scenarios'

const on = process.env['RELAY_EXPLORE_FLOW'] === '1'

interface Row {
  stage: string
  id: string
  title: string
  expect: string
  saw: string
  ok: boolean
}
const rows: Row[] = []
function record(r: Row): void {
  rows.push(r)
}

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})
afterAll(() => {
  if (!on) return
  const out = path.join(APP, 'test-results', 'explore')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'flow.json'), JSON.stringify(rows, null, 2))
  const md = ['| 단계 | # | 시나리오 | 기대 | 본 것 | 판정 |', '|---|---|---|---|---|---|']
  for (const r of rows) {
    md.push(
      `| ${r.stage} | ${r.id} | ${r.title} | ${r.expect} | ${r.saw} | ${r.ok ? '맞음' : '**문제**'} |`,
    )
  }
  fs.writeFileSync(path.join(out, 'flow.md'), md.join('\n'))
})

// ---------- 예시 ----------

function E(
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

function C(
  over: Partial<KnowledgeCandidateField> & Pick<KnowledgeCandidateField, 'kind' | 'rule'>,
): KnowledgeCandidateField {
  return {
    paths: ['src/avg.js'],
    terms: ['평균'],
    why: '이번 Work',
    not_in_code: '사람이 정함',
    incentive: '반대로 고친다',
    ...over,
  }
}

type Node = 'intake' | 'fix' | 'verify'
type Extra = Parameters<typeof handoff>[0]

/** 단계마다 handoff에 지식 필드를 더한 버그 수정 시나리오. verify는 기본 handoff의 결정을 지킨다 */
function claude(extra: Partial<Record<Node, Extra>> = {}): Scenario {
  const skill = { intake: 'work-start', fix: 'fix', verify: 'verify' } as const
  const over: Record<string, Step[]> = {}
  for (const node of ['intake', 'fix', 'verify'] as const) {
    const x = extra[node]
    if (!x) continue
    over[skill[node]] = steps(node).map((st) =>
      st.do === 'write' && st.file === 'handoff.md' ? { ...st, text: handoff(x) } : st,
    )
  }
  return scenario(over)
}

// ---------- 준비 ----------

interface S {
  h: Harness
  repo: string
  remote: string
  projectId: string
  store: string
}

async function setup(
  o: { files?: Record<string, string>; env?: Record<string, string> } = {},
): Promise<S> {
  h = await harness({ scenario: claude(), ...(o.env ? { env: o.env } : {}) })
  const { repo, remote } = makeRepo(h.root, 'sample', { ...REPO_FILES, ...o.files })
  const projectId = await register(h, repo)
  return {
    h,
    repo,
    remote,
    projectId,
    store: path.join(h.home, 'projects', projectId, 'knowledge'),
  }
}

function setClaude(s: S, sc: Scenario): void {
  fs.writeFileSync(path.join(s.h.root, 'scenario.json'), JSON.stringify(sc))
}

const idOf = (key: string) => key.split('/')[1] ?? ''
const workDir = (s: S, key: string) =>
  path.join(s.h.home, 'projects', s.projectId, 'works', idOf(key))
const treeOf = (s: S, key: string) =>
  path.join(s.h.home, 'projects', s.projectId, 'worktrees', idOf(key))

async function newWork(
  s: S,
  request = '빈 배열의 평균이 NaN이다',
  baseLocation: 'local' | 'remote' = 'local',
): Promise<string> {
  const r = await s.h.relay.createWork(s.projectId, {
    request,
    type: 'bugfix',
    baseBranch: 'main',
    baseLocation,
  })
  if (!r.ok) throw new Error(r.error)
  return r.workKey
}

/** verify 승인 대기까지 가서 지식 칸을 돌려준다 */
async function toVerify(s: S, key: string): Promise<KnowledgeReview> {
  const r = await drive(s.h.relay, s.h.ui, key, {
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  if (r.status !== 'paused') throw new Error(`멈추지 못함: ${r.status} ${r.reason}`)
  await settle(s.h, key)
  const v = await s.h.relay.review(key, s.h.ui.works.get(key)?.current ?? '')
  const k = v?.completion?.knowledge
  if (!k) throw new Error('지식 칸 없음')
  return k
}

/** [완료만] (verify 승인) */
async function finish(s: S, key: string, knowledge?: KnowledgeChoices): Promise<void> {
  const r = await s.h.relay.approve(
    key,
    s.h.ui.works.get(key)?.current ?? '',
    knowledge ? { knowledge } : {},
  )
  if (!r.ok) throw new Error(JSON.stringify(r))
  await settle(s.h, key)
}

async function deliver(s: S, key: string, choice: 'push' | 'pr'): Promise<string> {
  const r = await s.h.relay.deliver(key, { choice, uncommitted: null })
  await settle(s.h, key)
  return JSON.stringify(r)
}

function storeRules(
  s: S,
  scope: 'pending' | 'mine',
): { id: string; rule: string; status: string }[] {
  const dir = path.join(s.store, scope)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const t = fs.readFileSync(path.join(dir, f), 'utf8')
      return {
        id: path.basename(f, '.md'),
        rule: t.match(/^# (.*)$/m)?.[1] ?? '',
        status: t.match(/^status: (\w+)/m)?.[1] ?? '',
      }
    })
}

function putStore(s: S, scope: 'pending' | 'mine', e: KnowledgeEntry): void {
  const f = path.join(s.store, scope, e.kind, `${e.id}.md`)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, renderEntry(e))
}

/** 팀 지식을 main에 커밋하고 push한다. 해시는 앱과 같은 방법(pathHashes)으로 지금 HEAD에서 구한다 */
async function putTeam(s: S, entries: KnowledgeEntry[], dir = 'docs/knowledge/'): Promise<void> {
  const head = git(s.repo, 'rev-parse', 'HEAD')
  const all = await pathHashes(
    s.repo,
    head,
    entries.flatMap((e) => e.paths),
    dir,
    { env: s.h.env },
  )
  const withHash = entries.map((e) => {
    const hashes: Record<string, string> = { ...e.hashes }
    for (const p of e.paths) {
      const v = all[p]
      if (!hashes[p] && v) hashes[p] = v
    }
    return { ...e, hashes }
  })
  writeFiles(
    s.repo,
    Object.fromEntries(withHash.map((e) => [`${dir}${e.kind}/${e.id}.md`, renderEntry(e)])),
  )
  commitPush(s, 'team knowledge')
}

function commitPush(s: S, msg: string): void {
  git(s.repo, 'add', '-A')
  git(s.repo, 'commit', '-q', '-m', msg)
  git(s.repo, 'push', '-q', 'origin', 'main')
}

/** Work의 n번째 task의 `참고 지식` */
function knowledgeOf(s: S, key: string, n: number): string {
  const dir = path.join(workDir(s, key), 'tasks')
  const name = fs.readdirSync(dir).sort()[n] ?? ''
  return sectionText(fs.readFileSync(path.join(dir, name, 'context.md'), 'utf8'), '참고 지식') ?? ''
}

const lines = (k: string) => k.split('\n').filter((l) => l.startsWith('- ['))

async function screen(s: S) {
  const r = await s.h.relay.knowledgeScreen(s.projectId)
  if (!r.ok) throw new Error(r.error)
  return r.screen
}

const WRONG = E({
  id: 'domain-f0000001',
  kind: 'domain',
  rule: '빈 배열의 평균은 예외를 던진다',
  terms: ['빈 배열', '평균'],
})
const ZERO = C({ kind: 'domain', rule: '빈 배열의 평균은 0이다', terms: ['빈 배열', '평균'] })

// ---------- 거르기 ----------

describe.runIf(on)('[탐색] 거르기', () => {
  it('F1 같은 사람 결정을 두 task가 다듬으면 뒤 것은 채택 안 함 (D324)', async () => {
    const s = await setup()
    const d = { what: '빈 배열의 평균은 0', why: '사람이 답함', by: 'human' as const }
    setClaude(
      s,
      claude({
        intake: { decisions: [d], knowledge_candidates: [{ ...ZERO, decision: d.what }] },
        verify: {
          decisions: [d],
          knowledge_candidates: [{ ...ZERO, rule: '빈 배열 평균은 0', decision: d.what }],
        },
      }),
    )
    const k = await toVerify(s, await newWork(s))
    const second = k.candidates.find((c) => c.taskId !== 't-01' && !c.unrefined)
    record({
      stage: '거르기',
      id: 'F1',
      title: '같은 결정을 두 task가 다듬음',
      expect: '뒤 후보는 같은 결정의 후보',
      saw: `뒤 후보 sameDecisionAs=${second?.sameDecisionAs}`,
      ok: !!second?.sameDecisionAs,
    })
  })

  it('F2 다른 task의 비슷한 후보 (D326)', async () => {
    const s = await setup()
    setClaude(
      s,
      claude({
        intake: {
          knowledge_candidates: [
            C({
              kind: 'recipe',
              rule: '시험은 npm test',
              paths: ['package.json'],
              terms: ['npm test'],
            }),
          ],
        },
        fix: {
          knowledge_candidates: [
            C({
              kind: 'recipe',
              rule: '재현은 node -e 뒤 npm test',
              paths: ['package.json'],
              terms: ['npm test', '재현'],
            }),
          ],
        },
      }),
    )
    const k = await toVerify(s, await newWork(s))
    const fix = k.candidates.find((c) => c.taskId === 't-02')
    record({
      stage: '거르기',
      id: 'F2',
      title: '다른 task가 같은 파일·용어의 레시피',
      expect: '뒤 후보는 비슷한 후보로 채택 안 함',
      saw: `similarTo=${fix?.similarTo}`,
      ok: !!fix?.similarTo,
    })
  })

  it('F3 보고받은 공유 대기와 비슷한 후보는 대체가 기본 (K1)', async () => {
    const s = await setup()
    putStore(s, 'pending', WRONG)
    setClaude(
      s,
      claude({
        intake: {
          knowledge_candidates: [ZERO],
          knowledge_feedback: [{ id: WRONG.id, note: '사람이 0으로 정함' }],
        },
      }),
    )
    const key = await newWork(s)
    const k = await toVerify(s, key)
    await finish(s, key)
    const left = storeRules(s, 'pending').map((x) => x.rule)
    record({
      stage: '거르기',
      id: 'F3',
      title: '보고받은 항목과 같은 파일·용어의 새 후보',
      expect: '대체가 기본이고 [완료만] 뒤 옛 규칙이 없음',
      saw: `supersedes=${k.candidates[0]?.supersedes?.id}, 공유 대기 ${JSON.stringify(left)}`,
      ok: left.length === 1 && left[0] === ZERO.rule,
    })
  })

  it('F4 보고받은 항목과 다른 파일의 후보는 새로 더함', async () => {
    const s = await setup()
    putStore(s, 'pending', WRONG)
    setClaude(
      s,
      claude({
        intake: {
          knowledge_candidates: [{ ...ZERO, paths: ['src/other.js'] }],
          knowledge_feedback: [{ id: WRONG.id, note: '틀림' }],
        },
      }),
    )
    const k = await toVerify(s, await newWork(s))
    record({
      stage: '거르기',
      id: 'F4',
      title: '보고받은 항목과 다른 파일의 후보',
      expect: '대체로 묶지 않음(보고 칸에 남음)',
      saw: `supersedes=${k.candidates[0]?.supersedes?.id ?? null}, 보고 칸 ${k.feedback.map((f) => f.id).join(',')}`,
      ok: !k.candidates[0]?.supersedes && k.feedback.length === 1,
    })
  })

  it('F5 모르는 id를 supersedes로 적음', async () => {
    const s = await setup()
    setClaude(
      s,
      claude({ intake: { knowledge_candidates: [{ ...ZERO, supersedes: 'domain-zzzzzzzz' }] } }),
    )
    const k = await toVerify(s, await newWork(s))
    record({
      stage: '거르기',
      id: 'F5',
      title: '없는 항목을 supersedes로',
      expect: '찾지 못함을 보이고 새로 더함',
      saw: `unknownSupersedes=${k.candidates[0]?.unknownSupersedes}`,
      ok: k.candidates[0]?.unknownSupersedes === 'domain-zzzzzzzz',
    })
  })

  it('F6 다듬지 않은 사람 결정을 종류 없이 채택', async () => {
    const s = await setup()
    setClaude(
      s,
      claude({ intake: { decisions: [{ what: '빈 배열은 0', why: '답함', by: 'human' }] } }),
    )
    const key = await newWork(s)
    const k = await toVerify(s, key)
    const c = k.candidates.find((x) => x.unrefined)
    await finish(s, key, {
      candidates: { [c?.key ?? '']: { adopt: true, share: 'team', replace: null } },
    })
    const n = storeRules(s, 'pending').length
    record({
      stage: '거르기',
      id: 'F6',
      title: '다듬지 않은 사람 결정을 종류·용어 없이 채택',
      expect: '쓰지 않음(화면에 까닭)',
      saw: `공유 대기 ${n}건, 경고 없이 조용히 빠짐`,
      ok: n === 0,
    })
  })

  it('F7 다듬지 않은 사람 결정을 종류·용어를 정해 채택', async () => {
    const s = await setup()
    setClaude(
      s,
      claude({ intake: { decisions: [{ what: '빈 배열은 0', why: '답함', by: 'human' }] } }),
    )
    const key = await newWork(s)
    const k = await toVerify(s, key)
    const c = k.candidates.find((x) => x.unrefined)
    await finish(s, key, {
      candidates: {
        [c?.key ?? '']: {
          adopt: true,
          share: 'team',
          replace: null,
          edit: { kind: 'domain', terms: ['빈 배열'] },
        },
      },
    })
    const got = storeRules(s, 'pending')
    record({
      stage: '거르기',
      id: 'F7',
      title: '다듬지 않은 사람 결정을 종류·용어를 정해 채택',
      expect: '사람 출처로 공유 대기',
      saw: JSON.stringify(got.map((g) => g.rule)),
      ok: got.length === 1,
    })
  })

  it('F8 팀 공유를 끈 프로젝트', async () => {
    const s = await setup()
    await s.h.relay.updateProjectSettings(s.projectId, {
      allowed_bots: [],
      merge_method: null,
      knowledge_share: false,
    })
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const key = await newWork(s)
    await toVerify(s, key)
    await finish(s, key)
    record({
      stage: '거르기',
      id: 'F8',
      title: '팀 공유 끔',
      expect: '채택은 나만',
      saw: `나만 ${storeRules(s, 'mine').length}, 공유 대기 ${storeRules(s, 'pending').length}`,
      ok: storeRules(s, 'mine').length === 1 && storeRules(s, 'pending').length === 0,
    })
  })

  it('F9 넣어 준 규칙과 같은 규칙을 다시 올림 (K7)', async () => {
    const s = await setup()
    putStore(
      s,
      'pending',
      E({
        id: 'domain-f0000002',
        kind: 'domain',
        rule: '빈 배열의 평균은 0이다',
        terms: ['빈 배열', '평균'],
      }),
    )
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const key = await newWork(s)
    const k = await toVerify(s, key)
    await finish(s, key)
    const n = storeRules(s, 'pending').length
    record({
      stage: '거르기',
      id: 'F9',
      title: '공유 대기와 같은 규칙을 다시 올림',
      expect: '같은 규칙은 한 건',
      saw: `겹침 표시 ${k.candidates[0]?.overlaps.length}건, 기본 선택 뒤 공유 대기 ${n}건`,
      ok: n === 1,
    })
  })

  it('F10 보고 칸에서 [대체]로 새 규칙을 적음', async () => {
    const s = await setup()
    putStore(s, 'pending', WRONG)
    setClaude(
      s,
      claude({ intake: { knowledge_feedback: [{ id: WRONG.id, note: '사람이 0으로 정함' }] } }),
    )
    const key = await newWork(s)
    await toVerify(s, key)
    await finish(s, key, {
      feedback: { [WRONG.id]: { action: 'replace', rule: '빈 배열의 평균은 0이다' } },
    })
    const got = storeRules(s, 'pending').map((x) => x.rule)
    record({
      stage: '거르기',
      id: 'F10',
      title: '보고 칸 [대체]',
      expect: '옛 규칙이 지워지고 새 규칙 한 건',
      saw: JSON.stringify(got),
      ok: got.length === 1 && got[0] === '빈 배열의 평균은 0이다',
    })
  })

  it('F11 보고 칸의 기본(그대로 둠)', async () => {
    const s = await setup()
    putStore(s, 'pending', WRONG)
    setClaude(
      s,
      claude({ intake: { knowledge_feedback: [{ id: WRONG.id, note: '사람이 0으로 정함' }] } }),
    )
    const key = await newWork(s)
    await toVerify(s, key)
    await finish(s, key)
    const got = storeRules(s, 'pending').map((x) => x.rule)
    record({
      stage: '거르기',
      id: 'F11',
      title: '보고만 있고 사람이 손대지 않음',
      expect: '(제안) 다음 Work에 "보고됨" 표시',
      saw: `틀린 규칙이 표시 없이 남음 ${JSON.stringify(got)}`,
      ok: false,
    })
  })

  it('F12 이 Work가 경로를 바꾸지 않은 재확인 필요 항목', async () => {
    const s = await setup({ files: { 'src/other.js': 'export const x = 1\n' } })
    await putTeam(s, [
      E({
        id: 'failure-f0000003',
        kind: 'failure',
        rule: 'other의 x를 바꾸면 평균도 바뀐다',
        paths: ['src/other.js'],
        terms: ['평균'],
      }),
    ])
    fs.writeFileSync(path.join(s.repo, 'src/other.js'), '// 주석\nexport const x = 1\n')
    commitPush(s, 'comment')
    const key = await newWork(s)
    const k = await toVerify(s, key)
    const injected = knowledgeOf(s, key, 1).includes('재확인 필요')
    record({
      stage: '거르기',
      id: 'F12',
      title: '넣었고 재확인 필요인데 이 Work는 그 경로를 안 바꿈 (K10)',
      expect: '완료 화면에서 확인할 수 있음',
      saw: `fix에 재확인 필요로 넣음=${injected}, 완료 화면 재확인 칸 ${k.stale.length}건`,
      ok: k.stale.length > 0,
    })
  })
})

// ---------- 저장·공유 ----------

describe.runIf(on)('[탐색] 저장·공유', () => {
  it('S1 [완료만]', async () => {
    const s = await setup()
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const key = await newWork(s)
    await toVerify(s, key)
    await finish(s, key)
    record({
      stage: '저장·공유',
      id: 'S1',
      title: '[완료만]',
      expect: '공유 대기 1, 레포 커밋 없음',
      saw: `공유 대기 ${storeRules(s, 'pending').length}, 지식 폴더 ${fs.existsSync(path.join(treeOf(s, key), 'docs/knowledge'))}`,
      ok:
        storeRules(s, 'pending').length === 1 &&
        !fs.existsSync(path.join(treeOf(s, key), 'docs/knowledge')),
    })
  })

  it('S2 [push]', async () => {
    const s = await setup()
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const key = await newWork(s)
    await toVerify(s, key)
    const r = await deliver(s, key, 'push')
    record({
      stage: '저장·공유',
      id: 'S2',
      title: '[push]',
      expect: '공유 대기 1, 지식 커밋 없음',
      saw: `${r}, 공유 대기 ${storeRules(s, 'pending').length}, 마지막 커밋 "${git(treeOf(s, key), 'log', '-1', '--format=%s')}"`,
      ok: storeRules(s, 'pending').length === 1,
    })
  })

  it('S3 [PR 생성]', async () => {
    const s = await setup()
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const key = await newWork(s)
    await toVerify(s, key)
    const r = await deliver(s, key, 'pr')
    const subject = git(treeOf(s, key), 'log', '-1', '--format=%s')
    const index = JSON.parse(fs.readFileSync(path.join(s.store, 'knowledge.json'), 'utf8')) as {
      carried: Record<string, unknown>
    }
    record({
      stage: '저장·공유',
      id: 'S3',
      title: '[PR 생성]',
      expect: '지식 커밋 + 공유 대기 사본 + 실린 곳 기록',
      saw: `${r}, "${subject}", 사본 ${storeRules(s, 'pending').length}, 실린 곳 ${Object.keys(index.carried).length}`,
      ok: /지식 1건/.test(subject) && Object.keys(index.carried).length === 1,
    })
  })

  it('S4 동시에 도는 두 Work가 같은 규칙 (K7)', async () => {
    const s = await setup()
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const a = await newWork(s, '대시보드 평균 NaN')
    const b = await newWork(s, '보고서 평균 NaN')
    await Promise.all([toVerify(s, a), toVerify(s, b)])
    await finish(s, a)
    await finish(s, b)
    const n = storeRules(s, 'pending').length
    record({
      stage: '저장·공유',
      id: 'S4',
      title: '동시에 도는 두 Work의 같은 규칙',
      expect: '한 건',
      saw: `공유 대기 ${n}건`,
      ok: n === 1,
    })
  })

  it('S5 나만은 PR에 안 실림', async () => {
    const s = await setup()
    putStore(
      s,
      'mine',
      E({ id: 'failure-f0000004', kind: 'failure', rule: '내 PC에서만', terms: ['평균'] }),
    )
    const key = await newWork(s)
    await toVerify(s, key)
    await deliver(s, key, 'pr')
    const files = fs.existsSync(path.join(treeOf(s, key), 'docs/knowledge'))
      ? fs
          .readdirSync(path.join(treeOf(s, key), 'docs/knowledge'), { recursive: true })
          .map(String)
          .filter((f) => f.endsWith('.md') && f.includes('/'))
      : []
    record({
      stage: '저장·공유',
      id: 'S5',
      title: '나만 항목과 [PR 생성]',
      expect: 'PR에 안 실림',
      saw: `지식 폴더 항목 ${files.length}`,
      ok: files.length === 0,
    })
  })

  it('S6 relay 밖에서 머지된 공유 대기', async () => {
    const s = await setup()
    const e = E({
      id: 'domain-f0000005',
      kind: 'domain',
      rule: '빈 배열의 평균은 0이다',
      terms: ['평균'],
    })
    putStore(s, 'pending', e)
    writeFiles(s.repo, { [`docs/knowledge/domain/${e.id}.md`]: renderEntry(e) })
    commitPush(s, 'manual merge')
    const key = await newWork(s)
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    record({
      stage: '저장·공유',
      id: 'S6',
      title: '사본과 같은 내용이 기준 커밋에 있음',
      expect: '공유 대기 사본을 지움',
      saw: `공유 대기 ${storeRules(s, 'pending').length}`,
      ok: storeRules(s, 'pending').length === 0,
    })
  })

  it('S7 해시만 다른 채로 머지된 공유 대기', async () => {
    const s = await setup()
    const e = E({
      id: 'domain-f0000006',
      kind: 'domain',
      rule: '빈 배열의 평균은 0이다',
      terms: ['평균'],
      hashes: { 'src/avg.js': 'aaaa' },
    })
    putStore(s, 'pending', e)
    writeFiles(s.repo, {
      [`docs/knowledge/domain/${e.id}.md`]: renderEntry({ ...e, hashes: { 'src/avg.js': 'bbbb' } }),
    })
    commitPush(s, 'merge with refreshed hash')
    const key = await newWork(s)
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const k = lines(knowledgeOf(s, key, 0)).filter((l) => l.includes(e.id))
    record({
      stage: '저장·공유',
      id: 'S7',
      title: 'PR 대응 push가 해시를 고친 채 머지됨 (내용이 사본과 다름)',
      expect: '사본을 지움',
      saw: `공유 대기 ${storeRules(s, 'pending').length}, intake 줄 ${k.length}(어느 쪽인지: ${k[0]?.includes('pending') ? '공유 대기' : '팀'})`,
      ok: storeRules(s, 'pending').length === 0,
    })
  })

  it('S8 지식 폴더 설정을 바꿈', async () => {
    const s = await setup()
    await putTeam(s, [
      E({ id: 'domain-f0000007', kind: 'domain', rule: '옛 폴더의 규칙', terms: ['평균'] }),
    ])
    await s.h.relay.updateProjectSettings(s.projectId, {
      allowed_bots: [],
      merge_method: null,
      knowledge_dir: 'kb/',
    })
    const key = await newWork(s)
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const has = knowledgeOf(s, key, 0).includes('옛 폴더의 규칙')
    const sc = await screen(s)
    record({
      stage: '저장·공유',
      id: 'S8',
      title: '지식 폴더를 docs/knowledge/에서 kb/로 바꿈',
      expect: '옛 폴더 항목을 옮기라는 안내나 계속 읽음',
      saw: `intake에 옛 규칙=${has}, 화면 팀 ${sc.team.length}건, 경고 ${sc.warnings.length}`,
      ok: has || sc.warnings.length > 0,
    })
  })

  it('S9 앞 Work가 끝나기 전에 시작한 Work', async () => {
    const s = await setup()
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const a = await newWork(s, '대시보드 평균')
    await toVerify(s, a)
    const b = await newWork(s, '보고서 평균')
    await drive(s.h.relay, s.h.ui, b, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    await finish(s, a)
    await toVerify(s, b)
    const intake = knowledgeOf(s, b, 0).includes(ZERO.rule)
    const verify = knowledgeOf(s, b, 2)
    record({
      stage: '저장·공유',
      id: 'S9',
      title: 'Work 2 진행 중에 Work 1이 [완료만]',
      expect: 'Work 2의 다음 task부터 들어감(도메인은 intake 종류라 verify에는 없음)',
      saw: `intake=${intake}, verify 줄 ${lines(verify).length}`,
      ok: !intake,
    })
  })

  it('S10 RELAY_KNOWLEDGE=off', async () => {
    const s = await setup({ env: { RELAY_KNOWLEDGE: 'off' } })
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const key = await newWork(s)
    await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    await settle(s.h, key)
    const v = await s.h.relay.review(key, s.h.ui.works.get(key)?.current ?? '')
    await finish(s, key)
    record({
      stage: '저장·공유',
      id: 'S10',
      title: '지식 끔',
      expect: '지식 칸 없음, 저장 없음',
      saw: `지식 칸 ${v?.completion?.knowledge ? '있음' : '없음'}, 공유 대기 ${storeRules(s, 'pending').length}`,
      ok: !v?.completion?.knowledge && storeRules(s, 'pending').length === 0,
    })
  })

  it('S11 [PR 생성]에 공유 대기 함께 싣기와 이번에는 빼기', async () => {
    const s = await setup()
    putStore(
      s,
      'pending',
      E({ id: 'domain-f0000008', kind: 'domain', rule: '실을 것', terms: ['평균'] }),
    )
    putStore(
      s,
      'pending',
      E({ id: 'domain-f0000009', kind: 'domain', rule: '뺄 것', terms: ['평균'] }),
    )
    const key = await newWork(s)
    await toVerify(s, key)
    const r = await s.h.relay.deliver(key, {
      choice: 'pr',
      uncommitted: null,
      knowledge: { pending: { 'domain-f0000009': 'hold' } },
    } as never)
    await settle(s.h, key)
    const files = git(treeOf(s, key), 'show', '--name-only', '--format=', 'HEAD')
    record({
      stage: '저장·공유',
      id: 'S11',
      title: '공유 대기 둘 중 하나를 "이번에는 빼기"',
      expect: '하나만 실림',
      saw: `${JSON.stringify(r)} ${files.replace(/\n/g, ' ')}`,
      ok: files.includes('f0000008') && !files.includes('f0000009'),
    })
  })
})

// ---------- 낡음·피드백 ----------

describe.runIf(on)('[탐색] 낡음·피드백', () => {
  async function staleAfter(
    change: (s: S) => void,
    e: KnowledgeEntry,
    files?: Record<string, string>,
  ) {
    const s = await setup({ files })
    await putTeam(s, [e])
    change(s)
    commitPush(s, 'change')
    const sc = await screen(s)
    const key = await newWork(s, '평균 문제')
    await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    const line =
      lines(knowledgeOf(s, key, 1))
        .concat(lines(knowledgeOf(s, key, 0)))
        .find((l) => l.includes(e.id)) ?? '(안 들어감)'
    return { s, stale: sc.team.find((x) => x.id === e.id)?.stale ?? null, line }
  }

  it('N1 파일 내용이 바뀜', async () => {
    const r = await staleAfter(
      (s) => fs.appendFileSync(path.join(s.repo, 'src/avg.js'), '// x\n'),
      E({ id: 'failure-f0000010', kind: 'failure', rule: '0으로 나눔', terms: ['평균'] }),
    )
    record({
      stage: '낡음·피드백',
      id: 'N1',
      title: '묶인 파일이 바뀜',
      expect: '재확인 필요',
      saw: `화면 ${r.stale}, 넣은 줄 재확인=${r.line.includes('재확인')}`,
      ok: r.stale === true,
    })
  })

  it('N2 파일이 지워짐 → 화면 [그대로 맞음] (K5)', async () => {
    const r = await staleAfter(
      (s) => fs.rmSync(path.join(s.repo, 'src/old.js')),
      E({
        id: 'failure-f0000011',
        kind: 'failure',
        rule: 'old.js 한 곳에서',
        paths: ['src/old.js'],
        terms: ['평균'],
      }),
      { 'src/old.js': 'export const o = 1\n' },
    )
    const c = await r.s.h.relay.editKnowledge(r.s.projectId, {
      op: 'confirm',
      id: 'failure-f0000011',
    })
    const sc = await screen(r.s)
    const p = sc.pending.find((x) => x.id === 'failure-f0000011')
    record({
      stage: '낡음·피드백',
      id: 'N2',
      title: '지워진 파일의 항목을 [그대로 맞음]',
      expect: '재확인이 풀림',
      saw: `처음 ${r.stale}, 확인 ${JSON.stringify(c)}, 공유 대기 사본의 경로 ${JSON.stringify(p?.paths)}`,
      ok: r.stale === true && c.ok,
    })
  })

  it('N3 파일 이름이 바뀜', async () => {
    const r = await staleAfter(
      (s) => git(s.repo, 'mv', 'src/avg.js', 'src/mean.js'),
      E({ id: 'failure-f0000012', kind: 'failure', rule: '0으로 나눔', terms: ['평균'] }),
    )
    record({
      stage: '낡음·피드백',
      id: 'N3',
      title: '묶인 파일의 이름이 바뀜(내용 같음)',
      expect: '재확인 필요 + 새 경로를 알려 줌',
      saw: `화면 ${r.stale}, 새 경로 안내 없음`,
      ok: false,
    })
  })

  it('N4 디렉터리 경로', async () => {
    const r = await staleAfter(
      (s) => writeFiles(s.repo, { 'src/new.js': 'export const n = 1\n' }),
      E({
        id: 'structure-f0000013',
        kind: 'structure',
        rule: 'src 아래 모듈은 avg를 거침',
        paths: ['src', 'test'],
        terms: ['평균'],
      }),
    )
    record({
      stage: '낡음·피드백',
      id: 'N4',
      title: '디렉터리 경로 항목에 관계없는 새 파일',
      expect: '(설계대로) 재확인 필요',
      saw: `화면 ${r.stale}`,
      ok: r.stale === true,
    })
  })

  it('N5 파일:심볼 경로, 다른 함수가 바뀜', async () => {
    const r = await staleAfter(
      (s) => fs.appendFileSync(path.join(s.repo, 'src/avg.js'), 'export const other = 1\n'),
      E({
        id: 'failure-f0000014',
        kind: 'failure',
        rule: 'avg의 0 나눔',
        paths: ['src/avg.js:avg'],
        terms: ['평균'],
      }),
    )
    record({
      stage: '낡음·피드백',
      id: 'N5',
      title: '심볼 항목, 같은 파일의 다른 함수만 바뀜',
      expect: '(설계대로) 재확인 필요',
      saw: `화면 ${r.stale}`,
      ok: r.stale === true,
    })
  })

  it('N6 지식 폴더를 품은 디렉터리', async () => {
    const r = await staleAfter(
      (s) =>
        writeFiles(s.repo, {
          'docs/knowledge/domain/domain-f0000099.md': renderEntry(
            E({ id: 'domain-f0000099', kind: 'domain', rule: '다른 지식', terms: ['x'] }),
          ),
        }),
      E({
        id: 'decision-f0000015',
        kind: 'decision',
        rule: 'docs는 한국어',
        paths: ['docs'],
        terms: ['문서'],
      }),
      { 'docs/guide.md': '# 안내\n' },
    )
    record({
      stage: '낡음·피드백',
      id: 'N6',
      title: 'docs/ 항목, 지식 폴더에만 새 항목',
      expect: '재확인 아님(지식 폴더는 빼고 해시)',
      saw: `화면 ${r.stale}`,
      ok: r.stale === false,
    })
  })

  it('N7 squash 머지(내용 같음)', async () => {
    const r = await staleAfter(
      (s) => {
        git(s.repo, 'checkout', '-q', '-b', 'tmp')
        fs.appendFileSync(path.join(s.repo, 'README.md'), 'a\n')
        git(s.repo, 'add', '-A')
        git(s.repo, 'commit', '-q', '-m', 'a')
        git(s.repo, 'checkout', '-q', 'main')
        git(s.repo, 'merge', '-q', '--squash', 'tmp')
      },
      E({ id: 'failure-f0000016', kind: 'failure', rule: '0으로 나눔', terms: ['평균'] }),
    )
    record({
      stage: '낡음·피드백',
      id: 'N7',
      title: '관계없는 파일의 squash 머지',
      expect: '재확인 아님',
      saw: `화면 ${r.stale}`,
      ok: r.stale === false,
    })
  })

  it('N8 공유 대기는 코드가 바뀌어도 표시 없음 (D316, K6)', async () => {
    const s = await setup()
    const blob = git(s.repo, 'rev-parse', 'HEAD:src/avg.js')
    putStore(
      s,
      'pending',
      E({
        id: 'failure-f0000017',
        kind: 'failure',
        rule: '0으로 나눔',
        terms: ['평균'],
        hashes: { 'src/avg.js': blob },
      }),
    )
    fs.appendFileSync(path.join(s.repo, 'src/avg.js'), '// 바뀜\n')
    commitPush(s, 'change')
    const key = await newWork(s, '평균 문제')
    await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    const line = lines(knowledgeOf(s, key, 1)).find((l) => l.includes('f0000017')) ?? ''
    record({
      stage: '낡음·피드백',
      id: 'N8',
      title: '공유 대기 항목의 파일이 바뀜',
      expect: '(제안) "이 Work의 코드와 다름" 표시',
      saw: `fix 줄 표시=${line.includes('재확인') || line.includes('다름')}`,
      ok: false,
    })
  })

  it('N9 두 task가 같은 항목을 보고', async () => {
    const s = await setup()
    putStore(s, 'pending', WRONG)
    setClaude(
      s,
      claude({
        intake: { knowledge_feedback: [{ id: WRONG.id, note: '하나' }] },
        fix: { knowledge_feedback: [{ id: WRONG.id, note: '둘' }] },
      }),
    )
    const k = await toVerify(s, await newWork(s))
    record({
      stage: '낡음·피드백',
      id: 'N9',
      title: '두 task가 같은 항목을 보고',
      expect: '한 줄에 보고 둘',
      saw: `보고 칸 ${k.feedback.length}줄, 보고 ${JSON.stringify(k.feedback[0]?.notes)}`,
      ok: k.feedback.length === 1 && k.feedback[0]?.notes.length === 2,
    })
  })

  it('N10 없는 id를 보고', async () => {
    const s = await setup()
    setClaude(s, claude({ intake: { knowledge_feedback: [{ id: 'domain-zzzzzzzz', note: '?' }] } }))
    const k = await toVerify(s, await newWork(s))
    record({
      stage: '낡음·피드백',
      id: 'N10',
      title: '없는 id를 보고',
      expect: '모르는 항목으로 보임',
      saw: `entry=${JSON.stringify(k.feedback[0]?.entry)}`,
      ok: k.feedback[0]?.entry === null,
    })
  })

  it('N11 팀 지식 [그대로 맞음] 뒤 다음 Work', async () => {
    const s = await setup()
    await putTeam(s, [
      E({ id: 'failure-f0000018', kind: 'failure', rule: '0으로 나눔', terms: ['평균'] }),
    ])
    fs.appendFileSync(path.join(s.repo, 'src/avg.js'), '// x\n')
    commitPush(s, 'c')
    await s.h.relay.editKnowledge(s.projectId, { op: 'confirm', id: 'failure-f0000018' })
    const key = await newWork(s, '평균 문제')
    await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    const line = lines(knowledgeOf(s, key, 1)).find((l) => l.includes('f0000018')) ?? ''
    record({
      stage: '낡음·피드백',
      id: 'N11',
      title: '화면에서 [그대로 맞음] 뒤 머지 전의 다음 Work',
      expect: '재확인 표시 없음(공유 대기가 앞)',
      saw: line.includes('재확인') ? '재확인 필요로 들어감' : '표시 없이 들어감',
      ok: !line.includes('재확인'),
    })
  })
})

// ---------- 지식 화면 ----------

describe.runIf(on)('[탐색] 지식 화면', () => {
  const T = E({
    id: 'domain-f0000020',
    kind: 'domain',
    rule: '빈 배열의 평균은 0이다',
    terms: ['평균'],
  })

  it('V1 세 묶음과 출처', async () => {
    const s = await setup()
    await putTeam(s, [T])
    putStore(
      s,
      'pending',
      E({ id: 'recipe-f0000021', kind: 'recipe', rule: 'npm test', terms: ['test'] }),
    )
    putStore(
      s,
      'mine',
      E({ id: 'failure-f0000022', kind: 'failure', rule: '내 PC', terms: ['pc'] }),
    )
    const sc = await screen(s)
    record({
      stage: '지식 화면',
      id: 'V1',
      title: '팀·공유 대기·나만',
      expect: '각 1건',
      saw: `${sc.team.length}/${sc.pending.length}/${sc.mine.length}, ${sc.teamFrom}`,
      ok: sc.team.length === 1 && sc.pending.length === 1 && sc.mine.length === 1,
    })
  })

  it('V2 팀 고침', async () => {
    const s = await setup()
    await putTeam(s, [T])
    const r = await s.h.relay.editKnowledge(s.projectId, {
      op: 'edit',
      scope: 'team',
      id: T.id,
      edit: { rule: '빈 배열의 평균은 0이고 화면에 "-"로 보인다' },
    })
    const p = storeRules(s, 'pending')
    record({
      stage: '지식 화면',
      id: 'V2',
      title: '팀 항목 고침',
      expect: '새 항목 + 대체됨 사본이 공유 대기',
      saw: `${JSON.stringify(r)} ${JSON.stringify(p.map((x) => x.status))}`,
      ok: r.ok && p.length === 2,
    })
  })

  it('V3 팀 버림', async () => {
    const s = await setup()
    await putTeam(s, [T])
    await s.h.relay.editKnowledge(s.projectId, { op: 'drop', scope: 'team', id: T.id })
    const key = await newWork(s)
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const has = knowledgeOf(s, key, 0).includes(T.rule)
    const sc = await screen(s)
    record({
      stage: '지식 화면',
      id: 'V3',
      title: '팀 항목 버림 뒤 다음 Work',
      expect: '넣지 않음, 화면에서 버릴 예정으로 보임',
      saw: `넣음=${has}, 화면 팀 ${sc.team.length}·공유 대기 ${sc.pending.length}(${sc.pending[0]?.status})`,
      ok: !has,
    })
  })

  it('V4 공유 대기 ↔ 나만', async () => {
    const s = await setup()
    putStore(s, 'pending', T)
    const a = await s.h.relay.editKnowledge(s.projectId, { op: 'move', scope: 'pending', id: T.id })
    const b = await s.h.relay.editKnowledge(s.projectId, { op: 'move', scope: 'mine', id: T.id })
    record({
      stage: '지식 화면',
      id: 'V4',
      title: '공유 대기 → 나만 → 공유 대기',
      expect: '둘 다 됨',
      saw: `${JSON.stringify(a)} ${JSON.stringify(b)}`,
      ok: a.ok && b.ok,
    })
  })

  it('V5 팀 공유 끔에서 나만 → 팀', async () => {
    const s = await setup()
    await s.h.relay.updateProjectSettings(s.projectId, {
      allowed_bots: [],
      merge_method: null,
      knowledge_share: false,
    })
    putStore(s, 'mine', T)
    const r = await s.h.relay.editKnowledge(s.projectId, { op: 'move', scope: 'mine', id: T.id })
    record({
      stage: '지식 화면',
      id: 'V5',
      title: '팀 공유 끔에서 팀으로 옮김',
      expect: '거절',
      saw: JSON.stringify(r),
      ok: !r.ok,
    })
  })

  it('V6 고침 검사', async () => {
    const s = await setup()
    putStore(s, 'pending', T)
    const a = await s.h.relay.editKnowledge(s.projectId, {
      op: 'edit',
      scope: 'pending',
      id: T.id,
      edit: { terms: [] },
    })
    const b = await s.h.relay.editKnowledge(s.projectId, {
      op: 'edit',
      scope: 'pending',
      id: T.id,
      edit: { kind: 'constraint', paths: [] },
    })
    record({
      stage: '지식 화면',
      id: 'V6',
      title: '용어 0개, 경로 없는 제약으로 고침',
      expect: '둘 다 거절',
      saw: `${JSON.stringify(a)} / ${JSON.stringify(b)}`,
      ok: !a.ok && !b.ok,
    })
  })

  it('V7 열린 PR에 실린 항목', async () => {
    const s = await setup()
    setClaude(s, claude({ intake: { knowledge_candidates: [ZERO] } }))
    const key = await newWork(s)
    await toVerify(s, key)
    await deliver(s, key, 'pr')
    const id = storeRules(s, 'pending')[0]?.id ?? ''
    const r = await s.h.relay.editKnowledge(s.projectId, {
      op: 'edit',
      scope: 'pending',
      id,
      edit: { rule: '고침' },
    })
    record({
      stage: '지식 화면',
      id: 'V7',
      title: '열린 PR에 실린 공유 대기 고침',
      expect: '거절(그 PR에서 고침)',
      saw: JSON.stringify(r),
      ok: !r.ok,
    })
  })

  it('V8 origin 없는 레포', async () => {
    const s = await setup()
    git(s.repo, 'remote', 'remove', 'origin')
    writeFiles(s.repo, { [`docs/knowledge/domain/${T.id}.md`]: renderEntry(T) })
    git(s.repo, 'add', '-A')
    git(s.repo, 'commit', '-q', '-m', 'k')
    const sc = await screen(s)
    record({
      stage: '지식 화면',
      id: 'V8',
      title: 'origin이 없어진 레포',
      expect: '로컬 브랜치로 팀 지식',
      saw: `팀 ${sc.team.length}, ${sc.teamFrom}, 경고 ${sc.warnings.join(' / ')}`,
      ok: sc.team.length === 1,
    })
  })

  it('V9 깨진 지식 파일', async () => {
    const s = await setup()
    writeFiles(s.repo, { 'docs/knowledge/domain/domain-broken01.md': '---\nid: x\n---\n# 깨짐\n' })
    await putTeam(s, [T])
    const sc = await screen(s)
    record({
      stage: '지식 화면',
      id: 'V9',
      title: '머리글이 깨진 파일 하나',
      expect: '나머지는 보이고 경고',
      saw: `팀 ${sc.team.length}, 경고 ${sc.warnings.length}: ${sc.warnings[0]?.slice(0, 80)}`,
      ok: sc.team.length === 1 && sc.warnings.length > 0,
    })
  })

  it('V10 로컬에만 커밋한 팀 지식 (K9)', async () => {
    const s = await setup()
    writeFiles(s.repo, { [`docs/knowledge/domain/${T.id}.md`]: renderEntry(T) })
    git(s.repo, 'add', '-A')
    git(s.repo, 'commit', '-q', '-m', 'k')
    const sc = await screen(s)
    const key = await newWork(s)
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const has = knowledgeOf(s, key, 0).includes(T.rule)
    record({
      stage: '지식 화면',
      id: 'V10',
      title: '팀 지식을 로컬 main에만 커밋',
      expect: '화면과 Work가 같은 것을 봄',
      saw: `화면 팀 ${sc.team.length}(${sc.teamFrom}), Work intake에 넣음=${has}`,
      ok: (sc.team.length === 1) === has,
    })
  })

  it('V11 팀 공유 끔에서 팀 항목 [그대로 맞음]', async () => {
    const s = await setup()
    await putTeam(s, [T])
    await s.h.relay.updateProjectSettings(s.projectId, {
      allowed_bots: [],
      merge_method: null,
      knowledge_share: false,
    })
    const r = await s.h.relay.editKnowledge(s.projectId, { op: 'confirm', id: T.id })
    record({
      stage: '지식 화면',
      id: 'V11',
      title: '팀 공유 끔에서 팀 항목 확인',
      expect: '나만 사본',
      saw: `${JSON.stringify(r)}, 나만 ${storeRules(s, 'mine').length}`,
      ok: r.ok && storeRules(s, 'mine').length === 1,
    })
  })

  it('V12 지식 끔', async () => {
    const s = await setup({ env: { RELAY_KNOWLEDGE: 'off' } })
    const r = await s.h.relay.knowledgeScreen(s.projectId)
    record({
      stage: '지식 화면',
      id: 'V12',
      title: 'RELAY_KNOWLEDGE=off',
      expect: '화면 거절',
      saw: JSON.stringify(r).slice(0, 80),
      ok: !r.ok,
    })
  })
})

// ---------- 넣기 (앱 쪽) ----------

describe.runIf(on)('[탐색] 넣기', () => {
  it('I1 verify는 이 Work의 diff 경로로 고름', async () => {
    const s = await setup({ files: { 'src/other.js': 'export const o = 1\n' } })
    await putTeam(s, [
      E({
        id: 'failure-f0000030',
        kind: 'failure',
        rule: 'avg를 바꾸면 보고서도 본다',
        terms: ['zz'],
      }),
      E({
        id: 'failure-f0000031',
        kind: 'failure',
        rule: 'other는 관계없음',
        paths: ['src/other.js'],
        terms: ['zz'],
      }),
    ])
    const key = await newWork(s, '무언가 이상하다')
    await toVerify(s, key)
    const v = knowledgeOf(s, key, 2)
    record({
      stage: '넣기',
      id: 'I1',
      title: 'verify는 diff(src/avg.js) 경로',
      expect: 'avg 항목만',
      saw: `${lines(v).length}줄, avg=${v.includes('f0000030')}, other=${v.includes('f0000031')}`,
      ok: v.includes('f0000030') && !v.includes('f0000031'),
    })
  })

  it('I2 분량 기준을 넘음', async () => {
    const s = await setup()
    await putTeam(
      s,
      Array.from({ length: 30 }, (_, i) =>
        E({
          id: `domain-f10000${String(i).padStart(2, '0')}`,
          kind: 'domain',
          rule: `평균 화면 규칙 ${i}: 소수 한 자리로 보이고 빈 날은 0으로 보인다`,
          terms: ['평균'],
        }),
      ),
    )
    const key = await newWork(s, '평균이 이상하다')
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const k = knowledgeOf(s, key, 0)
    record({
      stage: '넣기',
      id: 'I2',
      title: '용어가 겹치는 도메인 규칙 30건',
      expect: '분량 안에서 자르고 안내',
      saw: `${lines(k).length}줄 ${[...k].length}자, 안내=${k.includes('분량 기준')}`,
      ok: k.includes('분량 기준'),
    })
  })

  it('I3 같은 id가 팀과 공유 대기에 있음', async () => {
    const s = await setup()
    await putTeam(s, [
      E({ id: 'domain-f0000032', kind: 'domain', rule: '옛 내용', terms: ['평균'] }),
    ])
    putStore(
      s,
      'pending',
      E({ id: 'domain-f0000032', kind: 'domain', rule: '새 내용', terms: ['평균'] }),
    )
    const key = await newWork(s, '평균')
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const k = knowledgeOf(s, key, 0)
    record({
      stage: '넣기',
      id: 'I3',
      title: '같은 id의 팀과 공유 대기',
      expect: '공유 대기(새 내용)',
      saw: `새=${k.includes('새 내용')}, 옛=${k.includes('옛 내용')}`,
      ok: k.includes('새 내용') && !k.includes('옛 내용'),
    })
  })

  it('I4 대체됨 항목', async () => {
    const s = await setup()
    await putTeam(s, [
      E({
        id: 'domain-f0000033',
        kind: 'domain',
        rule: '대체된 규칙',
        terms: ['평균'],
        status: 'superseded',
        superseded_by: 'domain-f0000034',
      }),
      E({ id: 'domain-f0000034', kind: 'domain', rule: '지금 규칙', terms: ['평균'] }),
    ])
    const key = await newWork(s, '평균')
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const k = knowledgeOf(s, key, 0)
    record({
      stage: '넣기',
      id: 'I4',
      title: '대체됨 항목',
      expect: '넣지 않음',
      saw: `대체됨=${k.includes('대체된 규칙')}, 지금=${k.includes('지금 규칙')}`,
      ok: !k.includes('대체된 규칙') && k.includes('지금 규칙'),
    })
  })

  it('I5 다른 말의 요청과 도메인 규칙 (K3)', async () => {
    const s = await setup()
    await putTeam(s, [
      E({ id: 'domain-f0000035', kind: 'domain', rule: '부가세는 줄마다 버림', terms: ['부가세'] }),
      E({
        id: 'failure-f0000036',
        kind: 'failure',
        rule: '합계 반올림은 어긋남',
        terms: ['부가세'],
      }),
    ])
    const key = await newWork(s, 'Refund API의 tax가 크다')
    await toVerify(s, key)
    record({
      stage: '넣기',
      id: 'I5',
      title: '용어가 안 겹치는 요청(tax ↔ 부가세)',
      expect: 'intake에 도메인 규칙(끝), fix에 실패 부류는 없음',
      saw: `intake ${knowledgeOf(s, key, 0).includes('f0000035')}, fix ${knowledgeOf(s, key, 1).includes('f0000036')}`,
      ok: knowledgeOf(s, key, 0).includes('f0000035'),
    })
  })

  it('I6 나만 지식도 넣음', async () => {
    const s = await setup()
    putStore(
      s,
      'mine',
      E({ id: 'failure-f0000037', kind: 'failure', rule: '내 지식', terms: ['평균'] }),
    )
    const key = await newWork(s, '평균')
    await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    record({
      stage: '넣기',
      id: 'I6',
      title: '나만 지식',
      expect: 'fix에 넣음',
      saw: `${knowledgeOf(s, key, 1).includes('f0000037')}`,
      ok: knowledgeOf(s, key, 1).includes('f0000037'),
    })
  })

  it('I7 한 줄의 길이', async () => {
    const s = await setup()
    putStore(
      s,
      'pending',
      E({ id: 'domain-f0000038', kind: 'domain', rule: '빈 배열의 평균은 0이다', terms: ['평균'] }),
    )
    const key = await newWork(s, '평균')
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'intake' })
    const l = lines(knowledgeOf(s, key, 0))[0] ?? ''
    const file = l.split(' — ')[1] ?? ''
    record({
      stage: '넣기',
      id: 'I7',
      title: '한 줄에서 파일 경로가 차지하는 몫 (K11)',
      expect: '규칙이 대부분',
      saw: `${[...l].length}자 중 경로 ${[...file].length}자`,
      ok: [...file].length < [...l].length / 2,
    })
  })
})
