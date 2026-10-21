// [흐름] 기능 추가 유형 (docs/implementation.md M14, I61). 가짜 claude로 기능 추가 Work가
// intake → design → implement → verify → Work 완료로 가고, 설계와 계획의 기본 수동 승인과 켰을 때의 자동 승인,
// 구현의 기본 자동 승인을 본다. 버그 수정 흐름은 flow.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  FEATURE_FILES,
  FEATURE_REQUEST,
  FEATURE_TEST_FILES,
  REPO_FILES,
  featureIntentDraft,
  featureScenario,
  type Scenario,
} from '../support/scenarios'

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
    expect(designCtx).not.toContain('선택 가능한 다음 단계')
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
      ['04 리뷰와 검증', false],
    ])
  })
})
