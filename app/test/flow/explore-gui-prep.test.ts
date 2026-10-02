// [탐색] GUI 확인용 RELAY_HOME을 만든다 (test/smoke/explore-knowledge.spec.ts가 띄운다). 가짜 claude가 실제 실행에서
// 본 모양의 후보(사람 결정과 묶이지 않은 도메인 규칙, 뻔한 레시피, 비슷한 후보, 피드백 셋)를 남기고, 레포에는 팀 지식(경로가
// 지워진 항목, import 줄만 바뀐 항목)을, 앱 저장소에는 공유 대기와 나만을 미리 둔다. verify의 승인 대기에서 멈추고 앱을 닫는다.
// RELAY_EXPLORE_GUI=1일 때만 돈다. 만든 곳은 test-results/explore/gui-home.txt에 적는다.
import fs from 'node:fs'
import path from 'node:path'
import { it } from 'vitest'
import { renderEntry } from '../../src/core/knowledge'
import type { KnowledgeCandidateField } from '../../src/shared/contracts'
import type { KnowledgeEntry } from '../../src/shared/knowledge'
import { drive } from './driver'
import { APP, git, harness, makeRepo, register, settle, writeFiles } from './harness'
import { REPO_FILES, handoff, scenario, steps, verifyApplied, type Step } from './scenarios'

const on = process.env['RELAY_EXPLORE_GUI'] === '1'

function entry(
  over: Partial<KnowledgeEntry> & Pick<KnowledgeEntry, 'id' | 'kind' | 'rule'>,
): KnowledgeEntry {
  return {
    subkind: null,
    status: 'active',
    superseded_by: null,
    paths: [],
    terms: ['평균'],
    hashes: {},
    source: { work: 'w-20260901-001', task: 't-01', by: 'ai' },
    why: '지난 Work에서 확인',
    not_in_code: '코드에 드러나지 않음',
    incentive: '없음',
    ...over,
  }
}

const RULE = '빈 배열의 평균은 0이다(대시보드에 NaN 대신 0)'
const C = (
  over: Partial<KnowledgeCandidateField> & Pick<KnowledgeCandidateField, 'kind' | 'rule'>,
): KnowledgeCandidateField => ({
  paths: ['src/avg.js'],
  terms: ['평균'],
  why: '이번 Work에서 확인',
  not_in_code: '코드에 드러나지 않음',
  incentive: '모르면 반대로 고친다',
  ...over,
})

const withHandoff = (st: Step[], h: Parameters<typeof handoff>[0]): Step[] =>
  st.map((s) => (s.do === 'write' && s.file === 'handoff.md' ? { ...s, text: handoff(h) } : s))

it.runIf(on)('[탐색] GUI용 RELAY_HOME 준비', async () => {
  const s = scenario({
    'work-start': withHandoff(steps('intake'), {
      decisions: [{ what: '빈 배열의 평균은 0으로 한다', why: '사람이 질문에 답함', by: 'human' }],
      knowledge_candidates: [
        C({
          kind: 'domain',
          rule: RULE,
          terms: ['빈 배열', '평균', 'NaN'],
          not_in_code: '사람이 정함',
        }),
        C({
          kind: 'recipe',
          rule: '테스트는 npm test(node --test)로 돌린다',
          paths: ['package.json'],
          terms: ['npm test', '테스트'],
        }),
      ],
      knowledge_feedback: [
        { id: 'domain-b0000004', note: '빈 배열이면 예외라고 했지만 사람이 0으로 정함' },
        { id: 'recipe-b0000003', note: 'scripts에 test:int가 없고 test:integration이다' },
      ],
    }),
    fix: withHandoff(steps('fix'), {
      knowledge_candidates: [
        C({
          kind: 'failure',
          rule: 'reduce 뒤 length로 나누는 곳은 빈 배열에서 NaN이다',
          terms: ['NaN', '나눗셈'],
        }),
        C({
          kind: 'structure',
          rule: '대시보드 평균은 src/avg.js가 계산하고 src/view/card.js가 소수 한 자리로 다시 반올림한다',
          paths: ['src/avg.js', 'src/view/card.js'],
          terms: ['대시보드', '반올림'],
        }),
      ],
      knowledge_feedback: [
        { id: 'failure-b0000002', note: 'src/lib/mean.js는 없다. 지금은 src/avg.js' },
      ],
    }),
    verify: withHandoff(verifyApplied(), {
      decisions: [
        { what: '지적 1 반영', why: '사람이 질문에서 고름', by: 'human' },
        { what: '지적 2 반영 안 함', why: '사람이 고르지 않음', by: 'human' },
      ],
      knowledge_candidates: [
        C({
          kind: 'domain',
          rule: '요청이 없는 날(빈 배열)의 평균 응답 시간은 0이다',
          terms: ['빈 배열', '평균'],
          not_in_code: '사람이 정함',
        }),
        C({
          kind: 'recipe',
          rule: '재현은 node -e로 avg([])를 찍고 npm test로 확인한다',
          paths: ['package.json'],
          terms: ['npm test', '재현'],
        }),
      ],
    }),
  })
  const h = await harness({ scenario: s })
  const { repo } = makeRepo(h.root, 'sample', {
    ...REPO_FILES,
    'src/lib/mean.js': 'export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length\n',
  })
  // 팀 지식: 해시는 지금 HEAD의 blob
  const blob = (p: string) => git(repo, 'rev-parse', `HEAD:${p}`)
  const team = [
    entry({
      id: 'constraint-b0000001',
      kind: 'constraint',
      subkind: 'compat',
      rule: '평균 API 응답의 avg 필드는 숫자다(null 금지, 앱 클라이언트가 파싱)',
      paths: ['src/avg.js'],
      terms: ['평균', '응답'],
      hashes: { 'src/avg.js': blob('src/avg.js') },
    }),
    entry({
      id: 'failure-b0000002',
      kind: 'failure',
      rule: '평균 계산은 src/lib/mean.js 한 곳에서 한다',
      paths: ['src/lib/mean.js'],
      terms: ['평균'],
      hashes: { 'src/lib/mean.js': blob('src/lib/mean.js') },
    }),
    entry({
      id: 'recipe-b0000003',
      kind: 'recipe',
      rule: '통합 시험은 npm run test:int로 돌린다',
      paths: ['package.json'],
      terms: ['통합 시험'],
      hashes: { 'package.json': blob('package.json') },
    }),
    ...Array.from({ length: 9 }, (_, i) =>
      entry({
        id: `decision-b10000${String(i).padStart(2, '0')}`,
        kind: 'decision',
        subkind: 'non_goal',
        rule: `보고서 ${i + 1}번 화면의 정렬은 바꾸지 않는다`,
        paths: [`src/report/r${i}.js`],
        terms: ['보고서'],
      }),
    ),
  ]
  writeFiles(
    repo,
    Object.fromEntries(team.map((e) => [`docs/knowledge/${e.kind}/${e.id}.md`, renderEntry(e)])),
  )
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'team knowledge')
  // 코드 변경: mean.js를 지우고, avg.js는 주석만 바뀐다
  fs.rmSync(path.join(repo, 'src/lib/mean.js'))
  fs.writeFileSync(path.join(repo, 'src/avg.js'), `// 평균\n${REPO_FILES['src/avg.js']}`)
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'move mean')
  const projectId = await register(h, repo)
  const store = path.join(h.home, 'projects', projectId, 'knowledge')
  const put = (scope: string, e: KnowledgeEntry) => {
    const f = path.join(store, scope, e.kind, `${e.id}.md`)
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, renderEntry(e))
  }
  put(
    'pending',
    entry({
      id: 'domain-b0000004',
      kind: 'domain',
      rule: '빈 배열의 평균은 예외를 던진다',
      paths: ['src/avg.js'],
      terms: ['빈 배열', '평균'],
    }),
  )
  put(
    'pending',
    entry({
      id: 'recipe-b0000005',
      kind: 'recipe',
      rule: '시험은 npm test로 돌린다',
      paths: ['package.json'],
      terms: ['npm test'],
    }),
  )
  put(
    'mine',
    entry({
      id: 'failure-b0000006',
      kind: 'failure',
      rule: 'Windows에서 시험 경로의 역슬래시가 깨진다',
      terms: ['Windows'],
    }),
  )
  const created = await h.relay.createWork(projectId, {
    request: '대시보드에서 요청이 없던 날의 평균이 NaN으로 보인다. (src/avg.js)',
    type: 'bugfix',
    baseBranch: 'main',
    baseLocation: 'local',
  })
  if (!created.ok) throw new Error(created.error)
  const key = created.workKey
  const r = await drive(h.relay, h.ui, key, {
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  if (r.status !== 'paused') throw new Error(`멈추지 못함: ${r.status} ${r.reason}`)
  await settle(h, key)
  await h.relay.close()
  await h.relay.settled()
  const out = path.join(APP, 'test-results', 'explore')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(
    path.join(out, 'gui-home.txt'),
    JSON.stringify({ root: h.root, home: h.home, repo }),
  )
})
