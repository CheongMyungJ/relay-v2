// [흐름] 요구사항 추출 유형 (requirements-extraction-flow.md 결정 92~99, 17.12). 가짜 claude로 intake를 마치면 앱이 extract의
// run 루프를 돈다: survey run이 낸 단위를 trace run이 돌고, 성공한 결과는 불변 revision과 work.json 포인터로 반영되며, 열린
// 단위가 없으면 extraction.md와 handoff.md를 렌더링해 승인 대기가 된다. 사람 결정 필요가 남으면 멈추고, 답한 뒤 [재개]로
// 잇는다. run은 가짜 run(test/support/fake-claude/print-run.mjs)이 계획 파일(FAKE_CLAUDE_RUN의 runs)대로 낸다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadChecklist } from '../../../skills/extract/load.mjs'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import { harness, makeRepo, register, settle, type Harness } from '../support/harness'
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
const code = (p: string, line: number, quote: string) => ({
  kind: 'code',
  path: `{wt}/${p}`,
  start: line,
  end: line,
  quote,
  command: null,
})

function survey(extra: Record<string, unknown> = {}) {
  return {
    outcome: 'done',
    outcome_reason: '빌드 설정과 진입점을 봤다',
    configs: [
      {
        key: 'c1',
        name: 'node',
        status: 'confirmed',
        select: 'npm test',
        build_command: null,
        anchors: [code('package.json', 5, '"test": "node --test"')],
      },
    ],
    inventory: [
      {
        key: 'i1',
        kind: 'other',
        name: 'avg',
        configs: ['all'],
        anchors: [code('src/avg.js', 1, 'export function avg(xs) {')],
        notes: '',
      },
    ],
    boundaries: [],
    units: [
      {
        key: 'k1',
        purpose: 'avg의 빈 배열 처리',
        lens: 'command',
        scope: 'src/avg.js avg',
        priority: 'high',
        depends_on: [],
        reason: '유일한 공개 함수',
      },
    ],
    not_found: [],
    unknowns: [],
    human_decisions: [],
    checkpoint: null,
    ...extra,
  }
}

function trace() {
  return {
    outcome: 'done',
    outcome_reason: '끝까지 따라갔다',
    observations: [
      {
        key: 'o1',
        text: '빈 배열이면 합 0을 길이 0으로 나눈다',
        configs: ['all'],
        anchors: [code('src/avg.js', 2, 'return xs.reduce((a, b) => a + b, 0) / xs.length')],
        inference: false,
      },
    ],
    quantities: [],
    requirements: [],
    constraints: [],
    impl_choices: [],
    unknowns: [],
    conflicts: [],
    absences: [],
    checklist: Object.fromEntries(
      loadChecklist('command', ROOT).map((c) => [
        c.id,
        { status: 'unknown', refs: [], searches: [] },
      ]),
    ),
    followups: [],
    human_decisions: [],
    checkpoint: null,
  }
}

async function setup(runs: object[]) {
  planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-req-plan-'))
  const plan = path.join(planDir, 'plan.json')
  fs.writeFileSync(plan, JSON.stringify({ runs: runs.map((o) => ({ outputs: [o] })) }))
  h = await harness({ scenario: scenario(), env: { FAKE_CLAUDE_RUN: plan } })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
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
    const s = await setup([survey(), trace()])
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
    expect(w.requirements).toMatchObject({ revision: 3, runs_used: 2, failures_in_row: 0 })
    expect(w.requirements?.run).toBeUndefined()
    const req = path.join(s.dir, 'requirements')
    expect(fs.readdirSync(path.join(req, 'revisions'))).toEqual([
      '000001.json',
      '000002.json',
      '000003.json',
    ])
    expect(fs.readdirSync(path.join(req, 'runs'))).toEqual(['r-0001', 'r-0002'])
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
      body: { anchors: [{ evidence: 'e-0003' }] },
    })

    const task = path.join(s.dir, 'tasks', '02-extract')
    const extraction = read(path.join(task, 'extraction.md'))
    expect(extraction).toContain('| u-0002 | trace(command) |')
    expect(extraction).toContain('src/avg.js:2-2')
    expect(read(path.join(task, 'handoff.md'))).toContain('recommended_next:\n  node: verify')
    expect(
      events(s.dir)
        .filter((e) => e.type === 'extract.run')
        .map((e) => e.payload),
    ).toEqual([
      { run: 'r-0001', unit: 'u-0001', result: 'closed', denials: 0 },
      { run: 'r-0002', unit: 'u-0002', result: 'closed', denials: 0 },
    ])

    // 승인하면 verify를 시작한다
    const extract = w.tasks[1]
    const ok = await s.h.relay.approve(s.key, extract?.id ?? '', {})
    expect(ok).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(work(s.dir).tasks.at(-1)?.node).toBe('verify')
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

    const extract = stopped.tasks.at(-1)
    expect(await s.h.relay.resume(s.key, extract?.id ?? '')).toEqual({ ok: true })
    await s.h.ui.until(
      () => (work(s.dir).tasks.at(-1)?.status === 'awaiting_approval' ? true : null),
      'extract 승인 대기',
      30_000,
    )
    await settle(s.h, s.key)
    const done = work(s.dir)
    // 시작, survey, 답, trace
    expect(done.requirements).toMatchObject({ revision: 4, runs_used: 2 })
    expect(done.requirements?.pending_answers).toBeUndefined()
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
})
