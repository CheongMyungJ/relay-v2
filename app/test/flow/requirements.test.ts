// [흐름] 요구사항 추출 유형 (requirements-extraction-flow.md 결정 92~99, 17.12). 가짜 claude로 intake를 마치면 앱이 extract의
// run 루프를 돈다: survey run이 낸 단위를 trace run이 돌고, 성공한 결과는 불변 revision과 work.json 포인터로 반영되며, 열린
// 단위가 없으면 extraction.md와 handoff.md를 렌더링해 승인 대기가 된다. 사람 결정 필요가 남으면 멈추고, 답한 뒤 [재개]로
// 잇는다. run은 가짜 run(test/support/fake-claude/print-run.mjs)이 계획 파일(FAKE_CLAUDE_RUN의 runs)대로 낸다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadChecklist, loadPerspectives } from '../../../skills/extract/load.mjs'
import type { RequirementsBudget } from '../../src/shared/requirements'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import { harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  BUILD_REPO_FILES,
  code,
  extractIntegrate,
  extractReview,
  extractSummarize,
  extractSurvey as survey,
  extractTrace,
} from '../support/requirements'
import { REPO_FILES, scenario } from '../support/scenarios'

const ROOT = path.resolve(import.meta.dirname, '../../..')
let h: Harness | undefined
let planDir: string | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
  if (planDir) fs.rmSync(planDir, { recursive: true, force: true })
  planDir = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')
const buildTools = ['make', 'cc'].every(
  (b) => spawnSync(b, ['--version'], { encoding: 'utf8' }).status === 0,
)
const trace = () => extractTrace(loadChecklist('command', ROOT).map((c) => c.id))
const integrate = (extra: Record<string, unknown> = {}) =>
  extractIntegrate(
    loadPerspectives(ROOT).map((p) => p.id),
    extra,
  )
/** 마지막 integrate, review(survey 대상 q1, trace 관찰 s1..), summarize: 생산 run 뒤의 끝 (AI 결정 111~113) */
const ending = (statements = 1) => [
  integrate(),
  extractReview(
    ['q1'],
    Array.from({ length: statements }, (_, i) => `s${i + 1}`),
  ),
  extractSummarize(),
]
async function setup(
  runs: object[],
  budget?: Partial<RequirementsBudget>,
  files: Record<string, string> = {},
) {
  planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-req-plan-'))
  const plan = path.join(planDir, 'plan.json')
  // 할 일 그대로(outputs가 있는 것) 또는 구조화 출력 하나
  const asPlan = (o: object) => ('outputs' in o ? o : { outputs: [o] })
  fs.writeFileSync(plan, JSON.stringify({ runs: runs.map(asPlan) }))
  h = await harness({
    scenario: scenario(),
    env: { FAKE_CLAUDE_RUN: plan },
    ...(budget ? { requirementsBudget: budget } : {}),
  })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', { ...REPO_FILES, ...files })
  const projectId = await register(hh, repo)
  const r = await hh.relay.createWork(projectId, {
    request: '이 저장소의 평균 계산 동작을 요구사항으로 정리해 줘',
    type: 'requirements',
    baseBranch: 'main',
    baseLocation: 'local',
  })
  if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
  const key = r.workKey
  const dir = path.join(hh.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
  return { h: hh, key, dir }
}

const work = (dir: string) => JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
const events = (dir: string) =>
  read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)

describe('[흐름] 요구사항 추출 (결정 92~99)', () => {
  it('intake → extract(survey run, trace run) → 승인 대기. 반영은 불변 revision과 포인터, 산출물은 앱이 렌더링한다', async () => {
    // trace run은 실행 출력을 scratch에 쓰고 근거로 든다. 첫 제출은 출력의 줄이 틀려 되돌려진다 (결정 101)
    const ran = (start: number) => {
      const t = trace()
      const o = t.observations[0]
      if (o)
        o.anchors.push({
          kind: 'tool_output',
          path: 'avg-empty.txt',
          start,
          end: start,
          quote: 'NaN',
          command: 'node -e "import(\'./src/avg.js\').then(m => console.log(m.avg([])))"',
        })
      return t
    }
    const traceRun = {
      write: { path: 'avg-empty.txt', text: '$ node avg\nNaN\n' },
      outputs: [ran(1), ran(2)],
    }
    const s = await setup([survey(), traceRun, ...ending()])
    const paused = await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'extract' && t.status === 'awaiting_approval',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, s.key)

    const w = work(s.dir)
    expect(w.type).toBe('requirements')
    expect(w.tasks.map((t) => [t.node, t.status])).toEqual([
      ['intake', 'approved'],
      ['extract', 'awaiting_approval'],
    ])
    // extract는 세션을 띄우지 않는다
    expect(w.tasks[1]?.session).toBeNull()
    // 시작, survey, trace, integrate 만듦, integrate(+ review 단위), review, summarize 만듦, summarize
    expect(w.requirements).toMatchObject({ revision: 8, runs_used: 5, failures_in_row: 0 })
    expect(w.requirements?.run).toBeUndefined()
    const req = path.join(s.dir, 'requirements')
    expect(fs.readdirSync(path.join(req, 'revisions'))).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `00000${n}.json`),
    )
    expect(fs.readdirSync(path.join(req, 'runs'))).toEqual([
      'r-0001',
      'r-0002',
      'r-0003',
      'r-0004',
      'r-0005',
    ])
    const run1 = JSON.parse(read(path.join(req, 'runs', 'r-0001', 'run.json'))) as Record<
      string,
      unknown
    >
    expect(run1).toMatchObject({ unit: 'u-0001', kind: 'survey', failure: null, end: 'closed' })
    const rev3 = JSON.parse(read(path.join(req, 'revisions', '000003.json'))) as {
      cause: unknown
      claims: { section: string; body: Record<string, unknown> }[]
    }
    expect(rev3.cause).toEqual({ kind: 'run', run: 'r-0002', note: '' })
    expect(rev3.claims[0]).toMatchObject({
      section: 'observations',
      body: { anchors: [{ evidence: 'e-0003' }, { evidence: 'e-0004' }] },
    })
    // 실행 출력 근거는 대조한 바이트의 사본을 가리킨다 (결정 42)
    const ev = (
      rev3 as unknown as { evidence: { id: string; kind: string; path: string }[] }
    ).evidence.find((e) => e.kind === 'tool_output')
    expect(ev?.path).toMatch(/^requirements\/outputs\/[0-9a-f]{64}\.txt$/)
    expect(read(path.join(s.dir, ev?.path ?? ''))).toBe('$ node avg\nNaN\n')

    const task = path.join(s.dir, 'tasks', '02-extract')
    const extraction = read(path.join(task, 'extraction.md'))
    expect(extraction).toContain('| u-0002 | trace(command) |')
    expect(extraction).toContain('src/avg.js:2-2')
    // integrate의 coverage, review의 이력, summarize의 개요 (AI 결정 111~113)
    expect(extraction).toContain('| u-0003 | integrate |')
    expect(extraction).toContain('## 관점별 범위')
    expect(extraction).toContain('| u-0004 | review |')
    expect(extraction).toContain('검토에서 반박되지 않음 1회(확인 아님)')
    expect(extraction).toContain('## 개요')
    expect(extraction).toContain('평균 계산 하나를 분석했다 (u-0001)')
    // integrate의 기록 목록은 run 디렉터리의 파일이고 패킷이 가리킨다 (AI 결정 109)
    expect(read(path.join(req, 'runs', 'r-0003', 'record-listing.md'))).toContain(
      'c-0003 | u-0002 | r-0002 | observations',
    )
    expect(read(path.join(req, 'runs', 'r-0003', 'packet.md'))).toContain('# Packet: integrate')
    expect(read(path.join(req, 'runs', 'r-0004', 'packet.md'))).toContain(
      '- q1 (configs): In which configurations is `avg` (other) built and reached?',
    )
    const run3 = JSON.parse(read(path.join(req, 'runs', 'r-0003', 'run.json'))) as Record<
      string,
      unknown
    >
    expect(run3).toMatchObject({ unit: 'u-0003', kind: 'integrate', end: 'closed' })
    expect(read(path.join(task, 'handoff.md'))).toContain('recommended_next:\n  node: verify')
    expect(
      events(s.dir)
        .filter((e) => e.type === 'extract.run')
        .map((e) => e.payload),
    ).toEqual([
      { run: 'r-0001', unit: 'u-0001', result: 'closed', denials: 0 },
      { run: 'r-0002', unit: 'u-0002', result: 'closed', denials: 1 },
      { run: 'r-0003', unit: 'u-0003', result: 'closed', denials: 0 },
      { run: 'r-0004', unit: 'u-0004', result: 'closed', denials: 0 },
      { run: 'r-0005', unit: 'u-0005', result: 'closed', denials: 0 },
    ])

    // 승인하면 verify를 시작한다
    const extract = w.tasks[1]
    const ok = await s.h.relay.approve(s.key, extract?.id ?? '', {})
    expect(ok).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(work(s.dir).tasks.at(-1)?.node).toBe('verify')
    // verify의 context.md는 읽기만 할 기록 폴더와 지금 revision을 알린다 (AI 결정 117)
    const context = read(path.join(s.dir, 'tasks', '03-verify', 'context.md'))
    expect(context).toContain(`## 요구사항 기록`)
    expect(context).toContain(`- 폴더: ${req}`)
    expect(context).toContain(`- 지금 revision: ${String(w.requirements?.revision)}`)
  })

  it('사람 결정 필요가 남으면 멈추고, 답한 뒤 [재개]하면 답을 revision으로 만들고 잇는다 (결정 7, 41)', async () => {
    const s = await setup([
      survey({
        human_decisions: [
          {
            key: 'd1',
            trigger: 'shipping_config',
            question: '어느 구성이 출하되나?',
            options: ['node'],
            refs: ['k1'],
          },
        ],
      }),
      trace(),
      ...ending(),
    ])
    const paused = await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'extract',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    // 루프가 멈출 때까지 기다린다
    await s.h.ui.until(
      () => (work(s.dir).requirements?.halt?.reason === 'decisions' ? true : null),
      '결정 대기로 멈춤',
      30_000,
    )
    await settle(s.h, s.key)
    const stopped = work(s.dir)
    expect(stopped.tasks.at(-1)?.status).toBe('interrupted')
    expect(stopped.requirements?.runs_used).toBe(1)
    // 패널의 진행 상자: 멈춘 까닭과 답할 결정
    expect(s.h.ui.works.get(s.key)?.requirements).toMatchObject({
      runsUsed: 1,
      units: { open: 1, done: 1, stopped: 0 },
      current: null,
      halt: { reason: 'decisions' },
      decisions: [{ id: 'h-0001', options: ['node'], pending: null }],
    })

    expect(
      await s.h.relay.answerRequirements(s.key, [{ decision: 'h-0099', answer: 'x' }]),
    ).toEqual({
      ok: false,
      error: '답할 열린 결정이 없음',
    })
    expect(
      await s.h.relay.answerRequirements(s.key, [{ decision: 'h-0001', answer: 'node만 출하' }]),
    ).toEqual({
      ok: true,
    })
    await settle(s.h, s.key)
    expect(work(s.dir).requirements?.pending_answers).toHaveLength(1)
    expect(s.h.ui.works.get(s.key)?.requirements?.decisions).toMatchObject([
      { id: 'h-0001', pending: 'node만 출하' },
    ])
    // 반영 대기 답이 있는 결정은 다시 받지 않는다
    expect(
      await s.h.relay.answerRequirements(s.key, [{ decision: 'h-0001', answer: '둘 다' }]),
    ).toEqual({ ok: false, error: '답할 열린 결정이 없음' })

    const extract = stopped.tasks.at(-1)
    expect(await s.h.relay.resume(s.key, extract?.id ?? '')).toEqual({ ok: true })
    await s.h.ui.until(
      () => (work(s.dir).tasks.at(-1)?.status === 'awaiting_approval' ? true : null),
      'extract 승인 대기',
      30_000,
    )
    await settle(s.h, s.key)
    const done = work(s.dir)
    // 시작, survey, 답, trace, 그리고 끝(integrate 만듦·반영, review, summarize 만듦·반영)
    expect(done.requirements).toMatchObject({ revision: 9, runs_used: 5 })
    expect(done.requirements?.pending_answers).toBeUndefined()
    expect(s.h.ui.works.get(s.key)?.requirements).toMatchObject({ halt: null, decisions: [] })
    const rev3 = JSON.parse(read(path.join(s.dir, 'requirements', 'revisions', '000003.json'))) as {
      cause: { kind: string }
      answers: { answer: string }[]
    }
    expect(rev3.cause.kind).toBe('human')
    expect(rev3.answers[0]?.answer).toBe('node만 출하')
    // 답은 다음 run의 패킷에 원문으로 들어간다 (결정 96)
    expect(read(path.join(s.dir, 'requirements', 'runs', 'r-0002', 'packet.md'))).toContain(
      'A: node만 출하',
    )
  })

  it('모든 단위가 끝난 뒤 나온 결정에 답하면 결정을 낸 단위를 다시 열어 돌린다 (결정 103)', async () => {
    const asks = {
      ...trace(),
      human_decisions: [
        {
          key: 'd1',
          trigger: 'product_intent',
          question: '빈 배열의 평균은 오류여야 하나?',
          options: ['오류', 'NaN 그대로'],
          refs: ['o1'],
        },
      ],
    }
    const s = await setup([survey(), asks, trace(), ...ending(2)])
    await drive(s.h.relay, s.h.ui, s.key, { pauseAt: (t) => t.node === 'extract' })
    await s.h.ui.until(
      () => (work(s.dir).requirements?.halt?.reason === 'decisions' ? true : null),
      '결정 대기로 멈춤',
      30_000,
    )
    await settle(s.h, s.key)
    // 열린 단위가 없는데 결정이 남아 멈췄다
    expect(s.h.ui.works.get(s.key)?.requirements).toMatchObject({
      runsUsed: 2,
      units: { open: 0, done: 2 },
      decisions: [{ id: 'h-0001', pending: null }],
    })
    expect(
      await s.h.relay.answerRequirements(s.key, [{ decision: 'h-0001', answer: '오류' }]),
    ).toEqual({ ok: true })
    const extract = work(s.dir).tasks.at(-1)
    expect(await s.h.relay.resume(s.key, extract?.id ?? '')).toEqual({ ok: true })
    await s.h.ui.until(
      () => (work(s.dir).tasks.at(-1)?.status === 'awaiting_approval' ? true : null),
      'extract 승인 대기',
      30_000,
    )
    await settle(s.h, s.key)
    // 시작, survey, trace, 답(다시 엶), 다시 돈 trace, 그리고 끝(integrate, review, summarize)
    expect(work(s.dir).requirements).toMatchObject({ revision: 10, runs_used: 6 })
    const rev4 = JSON.parse(read(path.join(s.dir, 'requirements', 'revisions', '000004.json'))) as {
      unit_updates: unknown[]
    }
    expect(rev4.unit_updates).toEqual([
      expect.objectContaining({ id: 'u-0002', status: 'open', decision: 'h-0001' }),
    ])
    const run3 = JSON.parse(
      read(path.join(s.dir, 'requirements', 'runs', 'r-0003', 'run.json')),
    ) as Record<string, unknown>
    expect(run3).toMatchObject({ unit: 'u-0002', end: 'closed' })
    expect(read(path.join(s.dir, 'requirements', 'runs', 'r-0003', 'packet.md'))).toContain(
      '  - A: 오류',
    )
    expect(read(path.join(s.dir, 'tasks', '02-extract', 'extraction.md'))).toContain(
      '끝난 단위 u-0002를 답을 받아 다시 열어 돌렸다',
    )
  })

  it('run 상한에 닿으면 멈추고, [계속 +N]은 상한을 늘려 이어서 돈다 (결정 24, 26, 99). 상한은 앱 설정이다 (결정 31, 102)', async () => {
    const s = await setup([survey(), trace(), ...ending()])
    expect(await s.h.relay.updateConfig({ requirements_budget: { run_limit: 1 } })).toMatchObject({
      ok: true,
    })
    await drive(s.h.relay, s.h.ui, s.key, { pauseAt: (t) => t.node === 'extract' })
    await s.h.ui.until(
      () => (work(s.dir).requirements?.halt?.reason === 'run_limit' ? true : null),
      'run 상한으로 멈춤',
      30_000,
    )
    await settle(s.h, s.key)
    expect(s.h.ui.works.get(s.key)?.requirements).toMatchObject({
      runsUsed: 1,
      runLimit: 1,
      halt: { reason: 'run_limit', label: 'run 상한에 닿음' },
    })
    expect(await s.h.relay.extendRequirements(s.key, 0)).toEqual({
      ok: false,
      error: '늘릴 run 수가 아님',
    })
    expect(await s.h.relay.extendRequirements(s.key, 4)).toEqual({ ok: true })
    await s.h.ui.until(
      () => (work(s.dir).tasks.at(-1)?.status === 'awaiting_approval' ? true : null),
      'extract 승인 대기',
      30_000,
    )
    await settle(s.h, s.key)
    expect(work(s.dir).requirements).toMatchObject({ runs_used: 5, runs_extra: 4 })
    expect(work(s.dir).requirements?.halt).toBeUndefined()
    // 멈추지 않았으면 받지 않는다
    expect(await s.h.relay.extendRequirements(s.key, 2)).toEqual({
      ok: false,
      error: 'run 상한으로 멈춘 요구사항 추출이 아님',
    })
  })

  it('run 상한에서 [범위 줄이고 계속]은 고른 단위를 빼고 메모를 남기고 늘려 잇는다 (결정 26, AI 결정 114)', async () => {
    const s = await setup([
      survey(),
      ...ending(0).map((o, i) => (i === 1 ? extractReview(['q1'], []) : o)),
    ])
    expect(await s.h.relay.updateConfig({ requirements_budget: { run_limit: 1 } })).toMatchObject({
      ok: true,
    })
    await drive(s.h.relay, s.h.ui, s.key, { pauseAt: (t) => t.node === 'extract' })
    await s.h.ui.until(
      () => (work(s.dir).requirements?.halt?.reason === 'run_limit' ? true : null),
      'run 상한으로 멈춤',
      30_000,
    )
    await settle(s.h, s.key)
    expect(s.h.ui.works.get(s.key)?.requirements?.openUnits).toMatchObject([
      { id: 'u-0002', kind: 'trace', lens: 'command' },
    ])
    expect(await s.h.relay.narrowRequirements(s.key, ['u-0099'], '', 20)).toEqual({
      ok: false,
      error: '범위에서 뺄 열린 단위를 고르세요',
    })
    expect(
      await s.h.relay.narrowRequirements(s.key, ['u-0002'], '빈 배열은 이번에 보지 않는다', 20),
    ).toEqual({ ok: true })
    await s.h.ui.until(
      () => (work(s.dir).tasks.at(-1)?.status === 'awaiting_approval' ? true : null),
      'extract 승인 대기',
      30_000,
    )
    await settle(s.h, s.key)
    expect(work(s.dir).requirements).toMatchObject({ runs_used: 4, runs_extra: 20 })
    const rev3 = JSON.parse(read(path.join(s.dir, 'requirements', 'revisions', '000003.json'))) as {
      cause: { kind: string }
      unit_updates: { id: string; status: string; reason: string }[]
      notes: { text: string; units: string[] }[]
    }
    expect(rev3.cause.kind).toBe('human')
    expect(rev3.unit_updates).toMatchObject([
      {
        id: 'u-0002',
        status: 'out_of_scope',
        reason: '사람이 범위에서 뺌: 빈 배열은 이번에 보지 않는다',
      },
    ])
    expect(rev3.notes).toMatchObject([{ text: '빈 배열은 이번에 보지 않는다', units: ['u-0002'] }])
    // 메모는 뒤 패킷에 들어간다
    expect(read(path.join(s.dir, 'requirements', 'runs', 'r-0002', 'packet.md'))).toContain(
      '## Notes from a person\n\n- 빈 배열은 이번에 보지 않는다',
    )
    expect(read(path.join(s.dir, 'tasks', '02-extract', 'extraction.md'))).toContain(
      '| u-0002 | trace(command) | avg의 빈 배열 처리 | 범위 밖 | 사람이 범위에서 뺌',
    )
  })

  it('run 상한에서 [부분 분석으로 넘기기]는 열린 단위를 보류로 닫고 summarize 하나만 상한 밖에서 돌려 끝낸다 (AI 결정 114)', async () => {
    const s = await setup([survey(), extractSummarize()])
    expect(await s.h.relay.updateConfig({ requirements_budget: { run_limit: 1 } })).toMatchObject({
      ok: true,
    })
    await drive(s.h.relay, s.h.ui, s.key, { pauseAt: (t) => t.node === 'extract' })
    await s.h.ui.until(
      () => (work(s.dir).requirements?.halt?.reason === 'run_limit' ? true : null),
      'run 상한으로 멈춤',
      30_000,
    )
    await settle(s.h, s.key)
    expect(await s.h.relay.partialRequirements(s.key)).toEqual({ ok: true })
    await s.h.ui.until(
      () => (work(s.dir).tasks.at(-1)?.status === 'awaiting_approval' ? true : null),
      'extract 승인 대기',
      30_000,
    )
    await settle(s.h, s.key)
    // survey 하나와 상한 밖의 summarize 하나
    expect(work(s.dir).requirements).toMatchObject({ runs_used: 2, runs_extra: 0 })
    expect(s.h.ui.works.get(s.key)?.requirements).toMatchObject({ partial: true, runLimit: 1 })
    const run2 = JSON.parse(
      read(path.join(s.dir, 'requirements', 'runs', 'r-0002', 'run.json')),
    ) as Record<string, unknown>
    expect(run2).toMatchObject({ kind: 'summarize', end: 'closed' })
    const task = path.join(s.dir, 'tasks', '02-extract')
    const md = read(path.join(task, 'extraction.md'))
    expect(md).toContain('**부분 분석**')
    expect(md).toContain('| u-0002 | trace(command) | avg의 빈 배열 처리 | 보류: 예산 상한 |')
    expect(read(path.join(task, 'handoff.md'))).toContain('부분 분석이다')
    expect(await s.h.relay.partialRequirements(s.key)).toEqual({
      ok: false,
      error: 'run 상한으로 멈춘 요구사항 추출이 아님',
    })
  })

  it('verify 승인 대기에서 결과를 저장소의 폴더로 내보내 그 폴더만 커밋한다 (AI 결정 119)', async () => {
    const s = await setup([survey(), trace(), ...ending()])
    await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'extract' && t.status === 'awaiting_approval',
    })
    await settle(s.h, s.key)
    // 아직 verify 전이면 받지 않는다
    expect(await s.h.relay.exportRequirements(s.key, '')).toEqual({
      ok: false,
      error: 'verify 승인 대기나 끝난 Work에서만 내보낸다',
    })
    const extract = work(s.dir).tasks.at(-1)
    expect(await s.h.relay.approve(s.key, extract?.id ?? '', {})).toEqual({ ok: true })
    await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    await settle(s.h, s.key)
    const w = work(s.dir)
    const tree = path.join(path.dirname(path.dirname(s.dir)), 'worktrees', w.work_id)
    expect(await s.h.relay.exportRequirements(s.key, '../out')).toMatchObject({ ok: false })
    expect(await s.h.relay.exportRequirements(s.key, '')).toEqual({ ok: true })
    await settle(s.h, s.key)
    const dir = path.join(tree, 'docs', 'requirements', w.work_id)
    expect(fs.readdirSync(dir).sort()).toEqual([
      'extraction.md',
      'outputs',
      'record.json',
      'schemas',
    ])
    const record = JSON.parse(read(path.join(dir, 'record.json'))) as {
      claims: { adoption: string }[]
      evidence: { kind: string; path: string }[]
    }
    expect(record.claims.every((c) => c.adoption === '미결정')).toBe(true)
    const exported = work(s.dir).requirements?.exported
    expect(exported).toMatchObject({ path: `docs/requirements/${w.work_id}` })
    expect(s.h.ui.works.get(s.key)?.requirements?.exported?.path).toBe(exported?.path)
    // 다시 내보내도 바뀐 것이 없으면 커밋하지 않는다
    expect(await s.h.relay.exportRequirements(s.key, '')).toMatchObject({ ok: false })
  })

  it('verify에서 extract로 되감으면 [현재 기록 위에서 이어서]는 지금 기록 위에 메모와 integrate를, 끄면 parent 없는 새 계보를 연다 (결정 120)', async () => {
    const s = await setup([
      survey(),
      trace(),
      ...ending(),
      // 이어서: 메모를 받은 integrate, 그 뒤 summarize
      integrate(),
      extractSummarize(),
      // 처음부터: survey부터 다시. 새 계보의 survey 단위는 u-0008이다(ID는 이어서 센다)
      survey(),
      trace(),
      integrate(),
      extractReview(['q1'], ['s1']),
      extractSummarize(['u-0008']),
    ])
    const toApproval = (node: string) =>
      drive(s.h.relay, s.h.ui, s.key, {
        pauseAt: (t) => t.node === node && t.status === 'awaiting_approval',
      })
    await toApproval('extract')
    await settle(s.h, s.key)
    const first = work(s.dir)
    expect(await s.h.relay.approve(s.key, first.tasks.at(-1)?.id ?? '', {})).toEqual({ ok: true })
    await toApproval('verify')
    await settle(s.h, s.key)
    const before = work(s.dir).requirements
    expect(before).toMatchObject({ task: 't-02', runs_used: 5 })

    const keep = await s.h.relay.stepPreview(s.key, 'extract', true)
    if (!keep.ok) throw new Error(keep.error)
    expect(keep.preview).toMatchObject({ keepCodeOffered: true, code: { kind: 'keep' } })
    expect(
      await s.h.relay.selectStep(s.key, {
        node: 'extract',
        keepCode: true,
        instruction: 'c-0003은 구성 b에서 다시 본다',
        expect: keep.preview.expect,
      }),
    ).toEqual({ ok: true })
    await toApproval('extract')
    await settle(s.h, s.key)
    const kept = work(s.dir)
    expect(kept.tasks.at(-1)).toMatchObject({ id: 't-04', node: 'extract' })
    expect(kept.requirements).toMatchObject({ task: 't-04', runs_used: 7 })
    const req = path.join(s.dir, 'requirements')
    const rev = (n: number) =>
      JSON.parse(read(path.join(req, 'revisions', `${String(n).padStart(6, '0')}.json`))) as {
        parent: number | null
        cause: { note: string }
        notes?: { text: string }[]
        units: { kind: string }[]
      }
    const rewound = rev((before?.revision ?? 0) + 1)
    expect(rewound).toMatchObject({
      parent: before?.revision,
      cause: { note: '되감기: 현재 기록 위에서 이어서' },
      notes: [{ text: 'c-0003은 구성 b에서 다시 본다' }],
      units: [{ kind: 'integrate' }],
    })
    // 메모는 integrate 패킷에 들어가고, 앞 계보의 주장은 그대로 이어진다
    expect(read(path.join(req, 'runs', 'r-0006', 'packet.md'))).toContain(
      'c-0003은 구성 b에서 다시 본다',
    )
    const doc = read(path.join(s.dir, 'tasks', '04-extract', 'extraction.md'))
    expect(doc).toContain('c-0003')

    // 처음부터: 체크를 풀면 parent 없는 survey 하나에서 다시 돈다. run 수는 이어서 센다
    const fresh = await s.h.relay.stepPreview(s.key, 'extract', false)
    if (!fresh.ok) throw new Error(fresh.error)
    expect(
      await s.h.relay.selectStep(s.key, {
        node: 'extract',
        keepCode: false,
        instruction: '',
        expect: fresh.preview.expect,
      }),
    ).toEqual({ ok: true })
    await toApproval('extract')
    await settle(s.h, s.key)
    const restarted = work(s.dir)
    expect(restarted.tasks.at(-1)).toMatchObject({ id: 't-05', node: 'extract' })
    expect(restarted.requirements).toMatchObject({ task: 't-05', runs_used: 12 })
    const start = rev((kept.requirements?.revision ?? 0) + 1)
    expect(start).toMatchObject({ parent: null, cause: { note: '되감기: 처음부터' } })
    expect(start.units).toMatchObject([{ kind: 'survey' }])
    // 버린 계보의 파일은 지우지 않는다(고아는 다음 번호 이상뿐)
    expect(fs.existsSync(path.join(req, 'revisions', '000001.json'))).toBe(true)
  })

  it.skipIf(!buildTools)(
    'make 구성이면 명령을 보이고 묻고, 허용하면 별도 체크아웃에서 빌드 인덱스를 만들어 맞지 않는 목록이면 survey를 다시 돌리고 그 제출을 config_active로 검사한다 (AI 결정 118)',
    async () => {
      const configs = [
        {
          key: 'c1',
          name: 'lo',
          status: 'confirmed',
          select: 'make lo',
          build_command: 'make lo',
          anchors: [code('Makefile', 2, 'lo:')],
        },
        {
          key: 'c2',
          name: 'hi',
          status: 'confirmed',
          select: 'make hi',
          build_command: 'make hi',
          anchors: [code('Makefile', 5, 'hi:')],
        },
      ]
      const tick = (cfgs: string[]) => ({
        key: 'i2',
        kind: 'isr',
        name: 'tick_isr',
        configs: cfgs,
        anchors: [code('src/tick.c', 4, 'void tick_isr(void) { counter += TICK_HZ; }')],
        notes: '',
      })
      const first = survey({ configs })
      const withTick = (cfgs: string[]) =>
        survey({ configs, inventory: [...(first.inventory as object[]), tick(cfgs)] })
      const s = await setup(
        [
          withTick(['lo', 'hi']),
          // 다시 연 survey: 처음 제출은 config_active에 되돌려지고, 고친 것이 받아진다
          { outputs: [withTick(['lo', 'hi']), withTick(['lo'])] },
          trace(),
          ...ending(),
        ],
        undefined,
        BUILD_REPO_FILES,
      )
      await drive(s.h.relay, s.h.ui, s.key, { pauseAt: (t) => t.node === 'extract' })
      await s.h.ui.until(
        () => (work(s.dir).requirements?.halt?.reason === 'decisions' ? true : null),
        '빌드 인덱스 결정으로 멈춤',
        30_000,
      )
      await settle(s.h, s.key)
      const asked = s.h.ui.works.get(s.key)?.requirements?.decisions ?? []
      expect(asked).toMatchObject([{ id: 'h-0001', options: ['허용', '허용하지 않음'] }])
      expect(asked[0]?.question).toContain('- lo: `make lo`')
      expect(
        await s.h.relay.answerRequirements(s.key, [{ decision: 'h-0001', answer: '허용' }]),
      ).toEqual({ ok: true })
      await settle(s.h, s.key)
      const extract = work(s.dir).tasks.at(-1)
      expect(await s.h.relay.resume(s.key, extract?.id ?? '')).toEqual({ ok: true })
      await s.h.ui.until(
        () => (work(s.dir).tasks.at(-1)?.status === 'awaiting_approval' ? true : null),
        'extract 승인 대기',
        60_000,
      )
      await settle(s.h, s.key)
      const req = path.join(s.dir, 'requirements')
      // 인덱스는 Work 디렉터리의 별도 체크아웃에서 만들고 내용 해시 이름으로 둔다
      expect(fs.existsSync(path.join(s.dir, 'build-index', 'src', 'Makefile'))).toBe(true)
      const indexes = fs.readdirSync(path.join(req, 'build-index'))
      expect(indexes).toHaveLength(1)
      const index = JSON.parse(read(path.join(req, 'build-index', indexes[0] ?? ''))) as {
        configs: Record<string, { symbols: Record<string, string> }>
      }
      expect(index.configs['lo']?.symbols['tick_isr']).toBe('strong')
      // 다시 연 survey의 패킷은 문제를 보이고, 첫 제출은 config_active로 되돌려졌다
      expect(read(path.join(req, 'runs', 'r-0002', 'packet.md'))).toContain(
        'configuration hi does not define it',
      )
      const run2 = JSON.parse(read(path.join(req, 'runs', 'r-0002', 'run.json'))) as {
        submits: { denied: boolean; problems?: string[] }[]
      }
      expect(run2.submits.map((x) => x.denied)).toEqual([true, false])
      const doc = read(path.join(s.dir, 'tasks', '02-extract', 'extraction.md'))
      expect(doc).toContain(
        '빌드 인덱스(구성별 정의된 심볼과 살아 있는 줄, 결정 87·88): 만듦(구성 lo, hi)',
      )
      expect(doc).toMatch(/tick_isr \(isr\) \[lo\]/)
    },
  )

  it('승인할 때 기록이 깨졌으면(해시, 사본 없음) 승인도 [오류 무시하고 승인]도 받지 않는다 (결정 2, AI 결정 124)', async () => {
    const s = await setup([survey(), trace(), ...ending()])
    await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'extract' && t.status === 'awaiting_approval',
    })
    await settle(s.h, s.key)
    const w = work(s.dir)
    const extract = w.tasks.at(-1)
    const last = path.join(
      s.dir,
      'requirements',
      'revisions',
      `${String(w.requirements?.revision).padStart(6, '0')}.json`,
    )
    const original = read(last)
    fs.writeFileSync(last, original.replace('"schema_version": 0', '"schema_version": 0 '))
    const review = await s.h.relay.review(s.key, extract?.id ?? '')
    expect(review?.gate).toMatchObject({ approve: false, force: false })
    expect(review?.gate.blocking.map((e) => e.message)).toEqual([
      expect.stringMatching(/^기록 무결성 오류: /),
    ])
    expect(await s.h.relay.approve(s.key, extract?.id ?? '', {})).toMatchObject({ ok: false })
    expect(await s.h.relay.approve(s.key, extract?.id ?? '', { force: true })).toMatchObject({
      ok: false,
    })
    expect(work(s.dir).tasks.at(-1)?.status).toBe('awaiting_approval')
    // 되돌리면 승인한다
    fs.writeFileSync(last, original)
    expect(await s.h.relay.approve(s.key, extract?.id ?? '', {})).toEqual({ ok: true })
  })
})
