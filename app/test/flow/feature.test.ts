// [흐름] 기능 추가 유형 (docs/implementation.md M14, I61). 가짜 claude로 기능 추가 Work가
// intake → design → implement(마무리, D493) → Work 완료로 가고, 설계와 계획의 기본 수동 승인과 켰을 때의 자동 승인,
// 마무리 단계인 구현은 자동 승인을 켜도 사람이 승인함을 본다. 버그 수정 흐름은 flow.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, settle, sleep, type Harness } from '../support/harness'
import {
  FEATURE_FILES,
  FEATURE_REQUEST,
  FEATURE_TEST_FILES,
  REPO_FILES,
  featureIntentDraft,
  featureScenario,
  steps,
  type Scenario,
  type Step,
} from '../support/scenarios'

const ALL_OFF = {
  fix: false,
  design: false,
  implement: false,
  refactor: false,
  spec: false,
  execute: false,
  respond: false,
}

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

interface Setup {
  h: Harness
  repo: string
  create(type?: WorkType): Promise<string>
  dir(workKey: string): string
  tree(workKey: string): string
}

async function setup(
  s: Scenario,
  config: Partial<AppConfig> = {},
  o: { productDefaults?: boolean } = {},
): Promise<Setup> {
  h = await harness({ scenario: s, config, ...o })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  const id = (key: string) => key.split('/')[1] ?? ''
  return {
    h: hh,
    repo,
    create: async (type = 'feature') => {
      const r = await hh.relay.createWork(projectId, {
        request: FEATURE_REQUEST,
        type,
        baseBranch: 'main',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (key) => path.join(hh.home, 'projects', projectId, 'works', id(key)),
    tree: (key) => path.join(hh.home, 'projects', projectId, 'worktrees', id(key)),
  }
}

function work(dir: string): WorkState {
  return JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
}

function events(dir: string): LifecycleEvent[] {
  return read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

const statuses = (w: WorkState) => w.tasks.map((t) => [t.id, t.node, t.status, t.reason])

describe('[흐름] 기능 추가 유형 (M14)', () => {
  it('intake → design → implement(마무리) → [완료만]. intent 확정본에 type: feature를 붙인다 (D232, D236, D493)', async () => {
    const s = await setup(featureScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.forced])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 설계와 계획', 0, false],
      ['03 구현', 0, false],
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'feature', status: 'completed', intent: { version: 1 } })
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'design', 'approved', 'default'],
      ['t-03', 'implement', 'approved', 'default'],
    ])
    expect(w.tasks[2]?.review).toMatchObject({ code_review: true, resumed_at: expect.any(String) })
    expect(s.h.ui.works.get(key)?.type).toBe('feature')
    expect(events(dir)[0]).toMatchObject({ type: 'work.created', payload: { type: 'feature' } })

    // intent 초안에는 머리글이 없고, 확정본에 앱이 type을 붙인다 (D236, I58)
    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.ok && intent.data).toEqual({ schema_version: 1, version: 1, type: 'feature' })
    expect(intent.body.trim()).toBe(featureIntentDraft().trim())

    // design은 코드를 바꾸지 않는다 (D243). implement는 테스트를 먼저 커밋하고 구현을 커밋한다 (D247)
    const tree = s.tree(key)
    expect(w.tasks.map((t) => t.start_commit?.slice(0, 7))).toEqual([
      base.slice(0, 7),
      base.slice(0, 7),
      base.slice(0, 7),
    ])
    expect(git(tree, 'log', '--format=%s', `${base}..HEAD`).split('\n')).toEqual([
      'feat: median',
      'test: median',
    ])
    expect(read(path.join(tree, 'src/avg.js'))).toBe(FEATURE_FILES['src/avg.js'])
    expect(read(path.join(tree, 'test/median.test.js'))).toBe(
      FEATURE_TEST_FILES['test/median.test.js'],
    )
    for (const [task, file] of [
      ['02-design', 'design.md'],
      ['03-implement', 'implement.md'],
      ['03-implement', 'verification.md'],
      ['03-implement', 'pr.md'],
      ['03-implement', 'independent-review.md'],
    ] as const) {
      expect(fs.existsSync(path.join(dir, 'tasks', task, file)), file).toBe(true)
    }

    // context.md: 업무 유형과 기능 추가의 다음 단계 (D236, 3.2). 마무리 단계인 implement만 마무리 절이 있다 (D493)
    const designCtx = read(path.join(dir, 'tasks', '02-design', 'context.md'))
    expect(designCtx).toContain('- 업무 유형: 기능 추가·변경 (`feature`)')
    expect(designCtx).not.toContain('선택 가능한 다음 단계')
    expect(designCtx).not.toContain('## 마무리\n')
    const implementCtx = read(path.join(dir, 'tasks', '03-implement', 'context.md'))
    expect(implementCtx).toContain(path.join(dir, 'tasks', '02-design', 'design.md'))
    expect(implementCtx).toContain('## 마무리\n')

    // 배포한 스킬: design, implement (5.6.3). implement는 리뷰 결과로 다시 열었을 뿐 새로 시작하지 않았다
    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'design', 'implement'])
  })

  it('앱 기본값: 설계와 계획은 사람이 승인한다. 구현은 마무리 단계라 자동 승인을 켜도 사람이 승인한다. 설계와 계획의 자동 승인은 켤 수 있다 (D234, D249, D493)', async () => {
    const s = await setup(
      featureScenario(),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      { productDefaults: true },
    )
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => [t.label, t.auto])).toEqual([
      ['01 의도 정리', false],
      ['02 설계와 계획', false],
      ['03 구현', false],
    ])
    await settle(s.h, key)
    const by = work(s.dir(key)).tasks.map((t) => [t.node, t.approved_by])
    expect(by).toEqual([
      ['intake', 'human'],
      ['design', 'human'],
      ['implement', 'human'],
    ])
    await h?.close()
    h = undefined

    const on = await setup(featureScenario(), {
      auto_approve: {
        fix: false,
        design: true,
        implement: false,
        refactor: false,
        spec: false,
        execute: false,
        respond: false,
      },
      auto_approve_countdown_sec: 1,
    })
    const key2 = await on.create()
    const r2 = await drive(on.h.relay, on.h.ui, key2, { awaitAuto: true })
    expect(r2, on.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(r2.tasks.map((t) => [t.label, t.auto])).toEqual([
      ['01 의도 정리', false],
      ['02 설계와 계획', true],
      ['03 구현', false],
    ])
  })

  it('Stop 없이 세션이 끝나도 유효한 handoff가 있으면 승인 대기로 알린다. 이 경로는 자동 승인하지 않는다 (3.3, D146)', async () => {
    // 마무리 단계가 아닌 설계와 계획 단계로 본다: 자동 승인을 켰어도 세션 종료로 온 승인 대기는 사람이 승인한다
    const design = steps('design').map((st): Step => (st.do === 'stop' ? { do: 'exit' } : st))
    const s = await setup(featureScenario({ design }), {
      auto_approve: { ...ALL_OFF, design: true },
      auto_approve_countdown_sec: 1,
    })
    const key = await s.create()
    const dir = s.dir(key)
    const ui = s.h.ui
    await drive(s.h.relay, ui, key, { pauseAt: (t) => t.node === 'design' })
    const task = await ui.until(
      () => {
        const t = ui.works.get(key)?.tasks[1]
        return t && !t.live && t.status !== 'working' ? t : null
      },
      '세션 종료',
      60_000,
    )
    expect(task).toMatchObject({ id: 't-02', status: 'awaiting_approval', countdown: null })
    expect(ui.notices.map((n) => n.body)).toEqual([
      '01 의도 정리: 승인 대기',
      '02 설계와 계획: 승인 대기',
    ])
    // 카운트다운 초가 지나도 자동 승인하지 않는다
    await sleep(2_000)
    await settle(s.h, key)
    expect(work(dir).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
    })
    expect(
      events(dir)
        .filter((e) => e.task_id === 't-02')
        .map((e) => [e.type, e.payload]),
    ).toEqual([
      ['task.started', expect.anything()],
      ['task.first_output', expect.anything()],
      ['task.first_hook', expect.anything()],
      ['task.awaiting_approval', { reason: 'session_ended' }],
    ])
    // 사람은 승인하고 다음 단계로 간다
    const result = await drive(s.h.relay, ui, key)
    expect(result, ui.dump()).toMatchObject({ status: 'completed' })
  })
})
