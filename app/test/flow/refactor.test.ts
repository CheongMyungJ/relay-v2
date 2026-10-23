// [흐름] 리팩터링 유형 (docs/implementation.md M15, I66). 가짜 claude로 리팩터링 Work가
// intake → refactor → verify → Work 완료로 가고, 계획과 리팩터링의 기본 자동 승인을 본다.
// 버그 수정 흐름은 flow.test.ts, 기능 추가 흐름은 feature.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { skillText } from '../../src/adapters/claude'
import { sha256 } from '../../src/adapters/store'
import { parseFrontMatter } from '../../src/core/validate'
import type { AppConfig } from '../../src/shared/config'
import type { LifecycleEvent, WorkState, WorkType } from '../../src/shared/work'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  REFACTOR_FILES,
  REFACTOR_REQUEST,
  REFACTOR_SAFETY_FILES,
  REPO_FILES,
  refactorIntentDraft,
  refactorScenario,
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
    create: async (type = 'refactor') => {
      const r = await hh.relay.createWork(projectId, {
        request: REFACTOR_REQUEST,
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

describe('[흐름] 리팩터링 유형 (M15)', () => {
  it('intake → refactor → verify → [완료만]. 안전망 커밋 뒤 단계 커밋, 확정본에 type: refactor (D258, D259, D261)', async () => {
    const s = await setup(refactorScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.forced])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 계획과 리팩터링', 0, false],
      ['03 리뷰와 검증', 0, false],
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'refactor', status: 'completed', intent: { version: 1 } })
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'refactor', 'approved', 'default'],
      ['t-03', 'verify', 'approved', 'default'],
    ])
    expect(s.h.ui.works.get(key)?.type).toBe('refactor')
    expect(events(dir)[0]).toMatchObject({ type: 'work.created', payload: { type: 'refactor' } })

    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.ok && intent.data).toEqual({ schema_version: 1, version: 1, type: 'refactor' })
    expect(intent.body.trim()).toBe(refactorIntentDraft().trim())

    // 안전망을 먼저 커밋하고 구조를 바꾼 커밋이 뒤따른다 (D259, D269)
    const tree = s.tree(key)
    expect(git(tree, 'log', '--format=%s', `${base}..HEAD`).split('\n')).toEqual([
      'refactor: sum 추출',
      'test: avg 안전망',
    ])
    expect(read(path.join(tree, 'src/sum.js'))).toBe(REFACTOR_FILES['src/sum.js'])
    expect(read(path.join(tree, 'test/avg-safety.test.js'))).toBe(
      REFACTOR_SAFETY_FILES['test/avg-safety.test.js'],
    )
    expect(fs.existsSync(path.join(dir, 'tasks', '02-refactor', 'refactor.md'))).toBe(true)

    // context.md: 업무 유형과 리팩터링의 다음 단계 (D261, 3.2). verify는 refactor.md 경로를 받는다 (D275)
    const refactorCtx = read(path.join(dir, 'tasks', '02-refactor', 'context.md'))
    expect(refactorCtx).toContain('- 업무 유형: 리팩터링 (`refactor`)')
    expect(refactorCtx).not.toContain('선택 가능한 다음 단계')
    const verifyCtx = read(path.join(dir, 'tasks', '03-verify', 'context.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '02-refactor', 'refactor.md'))

    const skills = s.h
      .records()
      .filter((r) => r['type'] === 'start' && !r['resume'])
      .map((r) => r['skill'])
    expect(skills).toEqual(['work-start', 'refactor', 'verify'])

    // 공용 스킬은 리팩터링의 구간만 배포한다 (D279): verify에 refactor.md는 있고 다른 유형의 산출물은 없다
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    const deployed = read(path.join(dir, 'tasks', '03-verify', 'instructions.md'))
    expect(deployed).toContain('`refactor.md`')
    expect(deployed).not.toContain('`fix.md`')
    expect(deployed).not.toContain('`design.md`')
    expect(w.tasks.map((t) => t.skill_hash)).toEqual(
      await Promise.all(
        (['work-start', 'refactor', 'verify'] as const).map(
          async (sk) => `sha256:${sha256(await skillText(skillsSrc, sk, 'refactor'))}`,
        ),
      ),
    )
  })
})
