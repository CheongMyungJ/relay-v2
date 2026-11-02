// [흐름] 자율 유형 (docs/implementation.md M42, docs/design.md D533~D541). 가짜 claude로 자율 Work가
// intake → orchestrate(마무리, D493) → Work 완료로 가고, 관문(D536)이 방식과 커밋이 어긋난 plan.md를 Stop에서 되돌리는지 본다.
// 관문의 판정은 test/unit/autonomy.test.ts가 자세히 보고, 여기서는 앱이 커밋을 읽어 넘기는지만 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFrontMatter } from '../../src/core/validate'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  AUTO_REQUEST,
  FEATURE_FILES,
  FEATURE_TEST_FILES,
  REPO_FILES,
  autoIntentDraft,
  autoPlan,
  autoScenario,
  steps,
  type Scenario,
} from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

async function setup(s: Scenario) {
  h = await harness({ scenario: s })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  const id = (key: string) => key.split('/')[1] ?? ''
  return {
    h: hh,
    repo,
    create: async () => {
      const r = await hh.relay.createWork(projectId, {
        request: AUTO_REQUEST,
        type: 'auto',
        baseBranch: 'main',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (key: string) => path.join(hh.home, 'projects', projectId, 'works', id(key)),
    tree: (key: string) => path.join(hh.home, 'projects', projectId, 'worktrees', id(key)),
  }
}

const work = (dir: string) => JSON.parse(read(path.join(dir, 'work.json'))) as WorkState

const events = (dir: string): LifecycleEvent[] =>
  read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)

describe('[흐름] 자율 유형 (M42)', () => {
  it('intake → orchestrate(마무리) → [완료만]. plan.md, 시험 커밋 뒤 구현 커밋, 사람에게 묻지 않는 마무리 절차 (D533, D534, D538)', async () => {
    const s = await setup(autoScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces])).toEqual([
      ['01 의도 정리', 0],
      ['02 자율 진행', 0],
    ])

    const w = work(dir)
    expect(w).toMatchObject({ type: 'auto', status: 'completed' })
    expect(w.tasks.map((t) => [t.id, t.node, t.status])).toEqual([
      ['t-01', 'intake', 'approved'],
      ['t-02', 'orchestrate', 'approved'],
    ])
    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.ok && intent.data).toMatchObject({ type: 'auto' })
    expect(intent.body.trim()).toBe(autoIntentDraft().trim())

    const tree = s.tree(key)
    expect(git(tree, 'log', '--reverse', '--format=%s', `${base}..HEAD`).split('\n')).toEqual([
      'test: median',
      'feat: median',
    ])
    const task = path.join(dir, 'tasks', '02-orchestrate')
    for (const file of ['plan.md', 'verification.md', 'pr.md', 'independent-review.md']) {
      expect(fs.existsSync(path.join(task, file)), file).toBe(true)
    }
    expect(read(path.join(task, 'plan.md'))).toBe(autoPlan())

    // context.md와 배포한 절차: 자율의 업무 유형과 마무리 절, 사람에게 묻지 않는 마무리 구간(D538)
    expect(read(path.join(task, 'context.md'))).toContain('- 업무 유형: 자율 (`auto`)')
    const deployed = read(path.join(task, 'instructions.md'))
    expect(deployed).toContain('# relay: orchestrate (자율 진행)')
    expect(deployed).toContain('## Finishing the Work')
    expect(deployed).toContain('runs without the human until the completion screen')
    expect(deployed).not.toContain('차단·권장만 반영 / 모두 반영 / 반영하지 않음')
    expect(deployed).not.toContain('`execution.md`')
  })

  it('방식이 TDD인데 구현을 시험보다 먼저 커밋하면 리뷰 요청에서 되돌린다. 방식을 고치면 이어 간다 (D536, D541)', async () => {
    const own = steps('orchestrate')
    const handoff = own.find((st) => st.do === 'write' && st.file === 'handoff.md')
    if (!handoff) throw new Error('orchestrate의 handoff 단계가 없음')
    const honest = autoPlan({
      strategy:
        '- 방식: 바로 고침\n- 본 신호: 함수 하나\n- 고려한 대안: 없음\n- 사람 제안 판정: 없음',
    }).replace('## 바뀐 계획\n- 없음', '## 바뀐 계획\n- TDD → 바로 고침: 구현을 먼저 커밋함')
    const s = await setup(
      autoScenario({
        orchestrate: [
          { do: 'prompt' },
          { do: 'commit', files: FEATURE_FILES, message: 'feat: median' },
          { do: 'commit', files: FEATURE_TEST_FILES, message: 'test: median' },
          { do: 'write', file: 'plan.md', text: autoPlan() },
          handoff,
          { do: 'stop', onBlock: [{ do: 'write', file: 'plan.md', text: honest }] },
        ],
      }),
    )
    const key = await s.create()
    const dir = s.dir(key)
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => [t.label, t.bounces])).toEqual([
      ['01 의도 정리', 0],
      ['02 자율 진행', 1],
    ])
    const bounced = events(dir).filter((e) => e.type === 'task.bounced')
    expect(bounced).toHaveLength(1)
    expect(JSON.stringify(bounced[0])).toContain('시험 파일만 바꾼 커밋')
    expect(read(path.join(dir, 'tasks', '02-orchestrate', 'plan.md'))).toBe(honest)
  })
})
