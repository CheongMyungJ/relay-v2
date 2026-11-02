// [흐름] 자식 Work (docs/implementation.md M44, docs/design.md D543~D549, D556). 가짜 claude로 자율 Work의 자율 진행이 task용
// relay MCP의 자식 도구로 자식 Work를 만들고, 부모가 자식 브랜치를 합치면 앱이 자식을 닫는지 본다. 자식은 의도 정리 없이 자율
// 진행부터 한다. 상한, 겹침, 닫는 조건은 test/unit/children.test.ts가 본다.
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

/** 부모의 plan.md: 조각 하나를 자식 Work로 맡겨 합쳤다 */
const PARENT_PLAN = autoPlan({ strategy: '- 방식: 자식 하나에 맡김' })

/** 부모 자율 진행과 자식 자율 진행의 시나리오 (D557): 부모는 parent 단계 뒤 계획을 쓰고 턴을 끝낸다. 사람이 [Work 완료]로 끝낸다 */
function childScenario(parent: Step[]): Scenario {
  const base = autoScenario()
  return {
    ...base,
    tasks: {
      ...base.tasks,
      orchestrate: [
        { do: 'prompt' },
        ...parent,
        { do: 'write', file: 'plan.md', text: PARENT_PLAN },
        { do: 'stop' },
      ],
      'orchestrate#child': CHILD_STEPS,
    },
  }
}

/** 부모의 자율 진행이 사람을 기다릴 때까지 몰고, 부모를 [Work 완료]로 끝낸다 */
async function runParent(
  s: Awaited<ReturnType<typeof setup>>,
  key: string,
  before?: () => Promise<unknown>,
) {
  const result = await drive(s.h.relay, s.h.ui, key, {
    pauseAt: (t) => t.label.includes('자율 진행'),
  })
  expect(result, s.h.ui.dump()).toMatchObject({ status: 'paused' })
  await before?.()
  const taskId = s.h.ui.works.get(key)?.current ?? ''
  expect(await s.h.relay.completeSession(key, taskId)).toMatchObject({ ok: true })
  await settle(s.h, key)
  expect(s.h.ui.works.get(key)?.status).toBe('completed')
}

async function setup(s: Scenario) {
  h = await harness({ scenario: s })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  const create = async () => {
    const r = await hh.relay.createWork(projectId, {
      request: AUTO_REQUEST,
      type: 'auto',
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
    return r.workKey
  }
  const dir = (key: string) =>
    path.join(hh.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
  const tree = (key: string) =>
    path.join(hh.home, 'projects', projectId, 'worktrees', key.split('/')[1] ?? '')
  return { h: hh, repo, create, dir, tree }
}

const work = (dir: string) => JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
const events = (dir: string): LifecycleEvent[] =>
  read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)

/**
 * 자식 세션 (D552, D555): 지시대로 시험과 구현을 커밋하고 턴을 끝낸다. handoff는 쓰지 않는다(끝났다는 말은 SendMessage로 부모에게
 * 직접 하므로 가짜 claude는 흉내 내지 않는다)
 */
const CHILD_STEPS: Step[] = [
  { do: 'prompt' },
  { do: 'commit', files: FEATURE_TEST_FILES, message: 'test: median' },
  { do: 'commit', files: FEATURE_FILES, message: 'feat: median' },
  { do: 'stop' },
]

/** 부모의 지시 (D552): 자유 글 */
const BRIEF =
  'src/avg.js에 median(xs)을 더한다. 빈 배열은 0. test/median.test.js에 시험을 더하고 npm test로 확인한다.'

const SPAWN: Step = {
  do: 'mcpCall',
  tool: 'spawn_child',
  args: {
    title: 'median 추가',
    brief: BRIEF,
    files: ['src/avg.js', 'test/median.test.js'],
  },
  save: 'child',
}

describe('[흐름] 자식 Work (M44)', () => {
  it('부모가 spawn_child로 자식을 만들고 턴을 끝낸 자식의 브랜치를 합치면, 부모가 턴을 끝낼 때 앱이 자식을 닫고 기록용 handoff를 남긴다 (D543~D546, D555, D556)', async () => {
    const s = await setup(
      childScenario([
        SPAWN,
        {
          do: 'mcpCall',
          tool: 'list_children',
          until: '"state":"idle"',
          tries: 150,
          pause: 100,
        },
        { do: 'git', args: ['merge', '--no-ff', '-m', 'merge: median', '{childBranch}'] },
      ]),
    )
    const key = await s.create()
    // 부모가 합치고 턴을 끝내면 앱이 자식을 닫는다 (D556)
    await runParent(s, key, () =>
      s.h.ui.until(
        () =>
          s.h.relay.snapshot().works.find((w) => w.parent?.key === key)?.status === 'completed'
            ? true
            : null,
        '자식이 닫힘',
        30_000,
      ),
    )

    // 자식: 부모 링크, 의도 정리 없이 자율 진행 하나, 부모(caller)가 승인해 전달 없이 완료
    const childView = s.h.relay.snapshot().works.find((w) => w.parent?.key === key)
    if (!childView) throw new Error('자식 Work가 없음')
    const childDir = s.dir(childView.key)
    const child = work(childDir)
    expect(child).toMatchObject({
      type: 'auto',
      driver: 'caller',
      status: 'completed',
      parent: {
        work_id: key.split('/')[1],
        task_id: 't-02',
        files: ['src/avg.js', 'test/median.test.js'],
      },
      intent: { version: 1 },
    })
    expect(child.issue).toBeUndefined()
    expect(child.tasks.map((t) => [t.id, t.node, t.status, t.approved_by])).toEqual([
      ['t-01', 'orchestrate', 'approved', 'caller'],
    ])
    const intent = parseFrontMatter(read(path.join(childDir, 'intent.md')))
    expect(intent.ok && intent.data).toMatchObject({ version: 1, type: 'auto' })
    expect(intent.body.trim()).toBe(BRIEF)
    expect(events(childDir).find((e) => e.type === 'work.completed')?.payload).toMatchObject({
      delivery: 'none',
    })
    // 자식은 부모 브랜치에서 뻗고, 부모가 답한다는 안내를 받고, 자식 도구를 받지 않는다 (깊이 1)
    expect(child.base_branch).toBe(work(s.dir(key)).branch ?? `relay/${key.split('/')[1]}`)
    const childTask = path.join(childDir, 'tasks', '01-orchestrate')
    // 자식은 단계 절차 없이 연결 규칙만 받고(D552), context.md는 부모의 지시와 부모 세션의 폴더뿐이다(D553)
    const rules = read(path.join(childTask, 'instructions.md'))
    expect(rules).toContain('# relay: child session')
    expect(rules).toContain('`SendMessage`')
    expect(rules).toContain(s.tree(key))
    expect(rules).not.toContain('# relay: orchestrate')
    expect(rules).not.toContain('## Finishing the Work')
    const ctx = read(path.join(childTask, 'context.md'))
    expect(ctx).toContain(`## 부모의 지시\n\n${BRIEF}`)
    expect(ctx).not.toContain('## 팀 지식')
    // 자식은 handoff를 쓰지 않았고, 앱이 자식을 닫을 때 기록용으로 썼다 (D555, D556)
    expect(read(path.join(childTask, 'handoff.md'))).toContain('자식 브랜치가 부모 브랜치에 합쳐짐')
    for (const f of ['plan.md', 'verification.md', 'pr.md', 'independent-review.md'])
      expect(fs.existsSync(path.join(childTask, f)), f).toBe(false)
    expect(read(path.join(childTask, 'task.mcp.json'))).not.toContain('RELAY_CHILD_TOOLS')

    // 부모: 자식 도구를 받고 질문은 터미널에서 묻는다(AskUserQuestion을 빼지 않음). 자식 브랜치를 합쳤다
    const parentTask = path.join(s.dir(key), 'tasks', '02-orchestrate')
    const mcp = read(path.join(parentTask, 'task.mcp.json'))
    expect(mcp).toContain('"RELAY_CHILD_TOOLS": "1"')
    expect(mcp).toContain('"RELAY_NO_ASK": "1"')
    const starts = s.h.records().filter((r) => r['type'] === 'start' && !r['resume'])
    const parentStart = starts.find((r) => r['taskDir'] === parentTask)
    expect(parentStart?.['args']).toEqual(expect.arrayContaining(['--mcp-config']))
    expect(parentStart?.['args']).not.toEqual(expect.arrayContaining(['--disallowedTools']))
    const tree = s.tree(key)
    expect(git(tree, 'log', '--format=%s', 'main..HEAD').split('\n')).toEqual([
      'merge: median',
      'feat: median',
      'test: median',
    ])
    expect(read(path.join(tree, 'src', 'avg.js'))).toContain('export function median')

    // 도구 결과: spawn은 자식 key와 브랜치, worktree를 알려 준다
    const spawned = s.h.records().find((r) => r['type'] === 'mcp' && r['tool'] === 'spawn_child')
    expect(spawned?.['isError']).toBe(false)
    expect(spawned?.['result']).toMatchObject({
      work: childView.key,
      branch: childView.branch,
      tree: s.tree(childView.key),
    })
  })

  it('부모는 자식을 합치지 않고도 마무리한다. 합치지 않은 자식은 앱이 닫지 않고 열린 채 남는다 (D556)', async () => {
    const s = await setup(
      childScenario([
        SPAWN,
        {
          do: 'mcpCall',
          tool: 'list_children',
          until: '"state":"idle"',
          tries: 150,
          pause: 100,
        },
      ]),
    )
    const key = await s.create()
    await runParent(s, key)
    const childView = s.h.relay.snapshot().works.find((w) => w.parent?.key === key)
    expect(childView?.status).toBe('active')
    expect(
      fs.existsSync(
        path.join(s.dir(childView?.key ?? ''), 'tasks', '01-orchestrate', 'handoff.md'),
      ),
    ).toBe(false)
  })

  it('자식은 자식을 만들지 못하고(깊이 1), 사람이 진행하는 Work의 다른 task는 자식 도구를 받지 않는다 (D545)', async () => {
    const s = await setup(childScenario([SPAWN]))
    const key = await s.create()
    await runParent(s, key)
    const childView = s.h.relay.snapshot().works.find((w) => w.parent?.key === key)
    if (!childView) throw new Error('자식 Work가 없음')
    // 자식의 task에서 부르면 거절한다
    const childTask = childView.tasks[0]?.id ?? ''
    const r = await s.h.relay.children.call(childView.key, childTask, 'spawn_child', {
      title: '손주',
      brief: BRIEF,
    })
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('깊이 1') })
    // 의도 정리 task에는 자식 도구가 없다
    const intakeDir = path.join(s.dir(key), 'tasks', '01-intake')
    expect(fs.existsSync(path.join(intakeDir, 'task.mcp.json'))).toBe(false)
  })
})
