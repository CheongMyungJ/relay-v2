// [흐름] 자율 유형: 세션이 하고 앱은 보는 Work (docs/implementation.md M42, M50, docs/design.md D557~D561). 가짜 claude로
// 자율 Work가 intake → orchestrate로 가고, 세션이 Work 브랜치를 push하면 앱이 독립 리뷰를 돌리며, 위험한 git 명령을 훅이 막고,
// 사람의 [Work 완료]로 전달 없이 끝나는지 본다. git 명령 판정은 test/unit/git-guard.test.ts가 자세히 본다.
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
  type Scenario,
  type Step,
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

/** 세션의 자율 진행: 계획을 쓰고, 시험과 구현을 커밋하고, Work 브랜치를 push하고(뒤의 Bash 훅이 push를 알림), main에 push하려다 막힌다 */
const SESSION_STEPS: Step[] = [
  { do: 'prompt' },
  { do: 'write', file: 'plan.md', text: autoPlan() },
  { do: 'commit', files: FEATURE_TEST_FILES, message: 'test: median' },
  { do: 'commit', files: FEATURE_FILES, message: 'feat: median' },
  { do: 'git', args: ['push', '-q', '-u', 'origin', 'HEAD'] },
  { do: 'tool', name: 'Bash', input: { command: 'git push -u origin HEAD' }, ms: 50 },
  { do: 'tool', name: 'Bash', input: { command: 'git push origin HEAD:main' }, ms: 50 },
  { do: 'stop' },
]

function sessionScenario(): Scenario {
  const base = autoScenario()
  return { ...base, tasks: { ...base.tasks, orchestrate: SESSION_STEPS } }
}

describe('[흐름] 자율 유형: 세션이 하는 Work (M42, M50)', () => {
  it('intake → orchestrate. push하면 앱이 독립 리뷰를 돌리고, main push는 훅이 막고, [Work 완료]로 전달 없이 끝난다 (D557~D561)', async () => {
    const s = await setup(sessionScenario())
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.label.includes('자율 진행'),
    })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    const task = path.join(dir, 'tasks', '02-orchestrate')
    const taskId = work(dir).tasks[1]?.id ?? ''

    // 앱이 독립 리뷰를 한 번 돌리고 기록을 남겼다 (D559)
    await s.h.ui.until(
      () => (fs.existsSync(path.join(task, 'session-reviews.json')) ? true : null),
      '독립 리뷰 기록',
      60_000,
    )
    const reviews = JSON.parse(read(path.join(task, 'session-reviews.json'))) as {
      commit: string
      auto: boolean
    }[]
    const tree = s.tree(key)
    expect(reviews).toEqual([
      expect.objectContaining({ commit: git(tree, 'rev-parse', 'HEAD'), auto: true }),
    ])
    expect(fs.existsSync(path.join(task, 'independent-review.md'))).toBe(true)

    // 승인 화면: 내보낸 것(push한 Work 브랜치), 리뷰, [Work 완료]를 누를 수 있음, 계획
    const view = await s.h.relay.review(key, taskId)
    const branch = work(dir).branch ?? ''
    expect(view?.session).toMatchObject({
      branches: [{ name: branch, commit: git(tree, 'rev-parse', 'HEAD'), pr: null }],
      reviewing: false,
      autoLeft: 1,
      canComplete: true,
      openChildren: [],
    })
    expect(view?.plan?.pieces.length).toBe(2)

    // main push는 PreToolUse에서 거절했다 (D558). 원격 main은 그대로다
    const denied = s.h
      .records()
      .filter((r) => r['type'] === 'hook' && r['event'] === 'PreToolUse')
      .map((r) => JSON.stringify(r['reply'] ?? r['response'] ?? ''))
    expect(denied.some((r) => r.includes('deny') && r.includes('D558'))).toBe(true)
    expect(git(s.repo, 'rev-parse', 'origin/main')).toBe(base)

    // 배포한 절차: 공용 규칙과 마무리 절 없이 orchestrate.md 그대로. task 설정은 git push를 막지 않는다
    const deployed = read(path.join(task, 'instructions.md'))
    expect(deployed).toContain('# relay: orchestrate (자율 진행)')
    expect(deployed).not.toContain('## Finishing the Work')
    expect(deployed).not.toContain('# Common rules')
    expect(read(path.join(task, 'task.settings.json'))).not.toContain('git push')

    // [Work 완료]: 기록용 handoff를 쓰고 사람의 승인으로 전달 없이 끝낸다 (D561)
    const done = await s.h.relay.completeSession(key, taskId)
    expect(done).toMatchObject({ ok: true })
    await settle(s.h, key)
    const w = work(dir)
    expect(w).toMatchObject({ type: 'auto', status: 'completed' })
    expect(w.tasks.map((t) => [t.node, t.status, t.approved_by])).toEqual([
      ['intake', 'approved', 'human'],
      ['orchestrate', 'approved', 'human'],
    ])
    expect(read(path.join(task, 'handoff.md'))).toContain('사람이 Work를 끝냄')
    expect(events(dir).find((e) => e.type === 'work.completed')?.payload).toMatchObject({
      delivery: 'none',
    })
    for (const file of ['verification.md', 'pr.md'])
      expect(fs.existsSync(path.join(task, file)), file).toBe(false)
    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.body.trim()).toBe(autoIntentDraft().trim())
    expect(git(tree, 'log', '--reverse', '--format=%s', `${base}..HEAD`).split('\n')).toEqual([
      'test: median',
      'feat: median',
    ])
  })

  it('세션이 일하는 중에는 [Work 완료]를 거절한다 (D561)', async () => {
    const base = autoScenario()
    const s = await setup({
      ...base,
      tasks: { ...base.tasks, orchestrate: [{ do: 'prompt' }, { do: 'wait' }] },
    })
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key, {
      pauseAt: (t) => t.label.includes('자율 진행'),
      stepTimeoutMs: 5_000,
    }).catch((e: unknown) => ({ status: 'timeout', reason: String(e) }))
    expect(result.status).not.toBe('completed')
    const taskId = work(s.dir(key)).tasks[1]?.id ?? ''
    const r = await s.h.relay.completeSession(key, taskId)
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('일하는 중') })
  })
})
