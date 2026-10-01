// [흐름] 기능 추가 유형 (docs/implementation.md M14, I61). 가짜 claude로 기능 추가 Work가
// intake → design → implement → verify → Work 완료로 가고, 설계와 계획의 기본 수동 승인과 켰을 때의 자동 승인,
// 구현의 기본 자동 승인, 구현이 설계를 추천하면 멈춤, 설계로 [현재 코드 위에서 이어서] 되감기,
// 의도 승인 전 [intake 다시]의 유형 바꾸기를 본다. 버그 수정 흐름은 flow.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, type Harness } from './harness'
import {
  FEATURE_FILES,
  FEATURE_REQUEST,
  FEATURE_TEST_FILES,
  REPO_FILES,
  featureIntentDraft,
  featureScenario,
  handoff,
  scenario,
  steps,
  type Scenario,
  type Step,
} from './scenarios'

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

function untilTask(
  s: Setup,
  key: string,
  pred: (t: WorkView['tasks'][number], w: WorkView) => boolean,
  label: string,
) {
  return s.h.ui.until(
    () => {
      const w = s.h.ui.works.get(key)
      const t = w?.tasks.find((x) => x.id === w.current)
      return w && t && pred(t, w) ? t : null
    },
    label,
    60_000,
  )
}

const statuses = (w: WorkState) => w.tasks.map((t) => [t.id, t.node, t.status, t.reason])

const EVEN_TEST =
  "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { median } from '../src/avg.js'\n\ntest('짝수 길이', () => assert.strictEqual(median([4, 1, 3, 2]), 2.5))\n"

/** handoff가 이전 단계를 추천하는 단계 */
function recommending(node: 'implement' | 'verify', to: 'design', reason: string): Step[] {
  const base = node === 'verify' ? (featureScenario().tasks.verify ?? []) : steps(node)
  return base.map((st) =>
    st.do === 'write' && st.file === 'handoff.md'
      ? { ...st, text: handoff({ recommended_next: { node: to, reason } }) }
      : st,
  )
}

describe('[흐름] 기능 추가 유형 (M14)', () => {
  it('intake → design → implement → verify → [완료만]. intent 확정본에 type: feature를 붙인다 (D232, D236)', async () => {
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
      ['04 리뷰와 검증', 0, false],
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'feature', status: 'completed', intent: { version: 1 } })
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'design', 'approved', 'default'],
      ['t-03', 'implement', 'approved', 'default'],
      ['t-04', 'verify', 'approved', 'default'],
    ])
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
      git(tree, 'rev-parse', 'HEAD').slice(0, 7),
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
      ['04-verify', 'verification.md'],
    ] as const) {
      expect(fs.existsSync(path.join(dir, 'tasks', task, file)), file).toBe(true)
    }

    // context.md: 업무 유형과 기능 추가의 다음 단계 (D236, 3.2). verify는 design.md와 implement.md 경로를 받는다
    const designCtx = read(path.join(dir, 'tasks', '02-design', 'context.md'))
    expect(designCtx).toContain('- 업무 유형: 기능 추가 (`feature`)')
    expect(designCtx).toContain('- 기본 다음 단계: implement (구현)')
    const verifyCtx = read(path.join(dir, 'tasks', '04-verify', 'context.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '02-design', 'design.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '03-implement', 'implement.md'))

    // 배포한 스킬: design, implement (5.6.3)
    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'design', 'implement', 'verify'])
  })

  it('앱 기본값: 설계와 계획은 사람이 승인하고 구현은 자동 승인한다. 설계와 계획의 자동 승인은 켤 수 있다 (D234, D249)', async () => {
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
      ['03 구현', true],
      ['04 리뷰와 검증', false],
    ])
    await settle(s.h, key)
    const by = work(s.dir(key)).tasks.map((t) => [t.node, t.approved_by])
    expect(by).toEqual([
      ['intake', 'human'],
      ['design', 'human'],
      ['implement', 'auto'],
      ['verify', 'human'],
    ])
    await h?.close()
    h = undefined

    const on = await setup(featureScenario(), {
      auto_approve: { fix: false, design: true, implement: false, respond: false },
      auto_approve_countdown_sec: 1,
    })
    const key2 = await on.create()
    const r2 = await drive(on.h.relay, on.h.ui, key2, { awaitAuto: true })
    expect(r2, on.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(r2.tasks.map((t) => [t.label, t.auto])).toEqual([
      ['01 의도 정리', false],
      ['02 설계와 계획', true],
      ['03 구현', false],
      ['04 리뷰와 검증', false],
    ])
  })

  it('구현이 설계를 추천하면 자동 승인하지 않고, 승인하면 멈춘다 (D23, D248)', async () => {
    const s = await setup(
      featureScenario({
        implement: recommending('implement', 'design', '설계의 정렬 방식이 틀림'),
      }),
      { auto_approve_countdown_sec: 1 } as Partial<AppConfig>,
      { productDefaults: true },
    )
    const key = await s.create()
    const stopped = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(stopped, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 설계와 계획(design)로 — 설계의 정렬 방식이 틀림',
    })
    expect(stopped.tasks.find((t) => t.label === '03 구현')?.auto).toBe(false)
    await settle(s.h, key)
    const w = work(s.dir(key))
    expect(w.status).toBe('stopped')
    expect(w.stop).toMatchObject({ kind: 'recommended_back', node: 'design' })
    const view = s.h.ui.works.get(key)
    expect(view?.steps.map((c) => [c.node, c.recommended, c.keepCode])).toEqual([
      ['intake', false, false],
      ['design', true, true],
      ['implement', false, true],
      ['verify', false, false],
    ])
  })

  it('verify의 추천대로 design으로 [현재 코드 위에서 이어서] 되감으면 구현의 커밋이 남는다 (D254)', async () => {
    const s = await setup({
      tasks: {
        ...featureScenario().tasks,
        't-04': recommending('verify', 'design', '요구사항 F2가 설계에 빠짐'),
        // 이어서 하는 구현은 남은 커밋 위에 짝수 길이 시험을 더한다
        't-06': steps('implement')
          .map((st) =>
            st.do === 'commit' && st.message === 'test: median'
              ? {
                  ...st,
                  files: { 'test/median-even.test.js': EVEN_TEST },
                  message: 'test: median 짝수 길이',
                }
              : st,
          )
          .filter((st) => !(st.do === 'commit' && st.message === 'feat: median')),
      },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const stopped = await drive(s.h.relay, s.h.ui, key)
    expect(stopped, s.h.ui.dump()).toMatchObject({ status: 'stopped' })
    await settle(s.h, key)
    const head = git(s.tree(key), 'rev-parse', 'HEAD')

    const r = await s.h.relay.stepPreview(key, 'design', true)
    if (!r.ok) throw new Error(r.error)
    expect(r.preview).toMatchObject({
      node: 'design',
      kind: 'rewind',
      keepCodeOffered: true,
      code: { kind: 'keep' },
      discard: [{ taskId: 't-02' }, { taskId: 't-03' }, { taskId: 't-04' }],
    })
    expect(
      await s.h.relay.selectStep(key, {
        node: 'design',
        keepCode: true,
        instruction: '',
        expect: r.preview.expect,
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-05' && t.live, '되감은 design')
    await settle(s.h, key)
    // 코드와 커밋은 그대로다
    expect(git(s.tree(key), 'rev-parse', 'HEAD')).toBe(head)
    const w = work(dir)
    expect(statuses(w).slice(-1)).toEqual([['t-05', 'design', 'working', 'rewind']])
    expect(w.tasks.at(-1)?.selection?.keep_code).toBe(true)
    const ctx = read(path.join(dir, 'tasks', '05-design', 'context.md'))
    expect(ctx).toContain('지금 코드를 읽고 `design.md`를 고친다. 코드는 바꾸지 않는다.')

    // 이어지는 구현도 그 코드 위에서 한다
    const done = await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'verify' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(git(s.tree(key), 'log', '--format=%s', `${head}~2..HEAD`).split('\n')).toEqual([
      'test: median 짝수 길이',
      'feat: median',
      'test: median',
    ])
  })

  it('의도 승인 전 [intake 다시]에서 유형을 바꾸면 intake만 다시 돌고 다음 단계가 바뀐다 (D237, I59)', async () => {
    const s = await setup({
      tasks: {
        ...scenario().tasks,
        design: featureScenario().tasks.design ?? [],
        implement: featureScenario().tasks.implement ?? [],
      },
    })
    const key = await s.create('bugfix')
    const dir = s.dir(key)
    await untilTask(s, key, (t) => t.id === 't-01' && t.status === 'awaiting_approval', '의도 정리')
    const view = s.h.ui.works.get(key)
    expect(view?.type).toBe('bugfix')
    expect(view?.steps.map((c) => [c.node, c.typeChange])).toEqual([
      ['intake', true],
      ['fix', false],
      ['verify', false],
    ])

    const r = await s.h.relay.stepPreview(key, 'intake', false, 'feature')
    if (!r.ok) throw new Error(r.error)
    expect(r.preview.typeChange).toBe(
      '유형을 버그 수정에서 기능 추가(으)로 바꿉니다. 의도 승인 뒤에는 바꿀 수 없습니다 (D237)',
    )
    expect(
      await s.h.relay.selectStep(key, {
        node: 'intake',
        keepCode: false,
        instruction: '',
        expect: r.preview.expect,
        type: 'feature',
      }),
    ).toEqual({ ok: true })
    await untilTask(s, key, (t, w) => t.id === 't-02' && w.type === 'feature', '다시 돈 intake')
    await settle(s.h, key)
    expect(work(dir).type).toBe('feature')
    const rewound = events(dir).find((e) => e.type === 'task.rewound')
    expect(rewound?.payload).toMatchObject({ type_from: 'bugfix', type_to: 'feature' })
    expect(read(path.join(dir, 'tasks', '02-intake', 'context.md'))).toContain(
      '- 업무 유형: 기능 추가 (`feature`)',
    )

    // 의도 승인 뒤에는 기능 추가의 단계로 간다
    const paused = await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'implement' })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(statuses(work(dir)).map(([, node]) => node)).toEqual([
      'intake',
      'intake',
      'design',
      'implement',
    ])
    const after = await s.h.relay.stepPreview(key, 'intake', false, 'bugfix')
    expect(after).toEqual({
      ok: false,
      error: '유형은 의도 승인 전 [intake 다시]에서만 바꿀 수 있음 (D237)',
    })
  })
})
