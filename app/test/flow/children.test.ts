// [흐름] 자식 Work (docs/implementation.md M44, docs/design.md D543~D549). 가짜 claude로 자율 Work의 자율 진행이 task용 relay
// MCP의 자식 도구로 자식 Work를 만들고, 기다리고, 합치는지 본다. 자식은 의도 정리 없이 자율 진행부터 하고 부모가 승인한다.
// 상한과 겹침 판정은 test/unit/children.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseFrontMatter } from '../../src/core/validate'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import { FakeGitHub } from '../support/github'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  AUTO_PR,
  AUTO_REQUEST,
  AUTO_VERDICTS,
  REPO_FILES,
  REVIEW_NONE,
  autoIntentDraft,
  autoPlan,
  autoScenario,
  finishingSteps,
  handoff,
  steps,
  type Scenario,
  type Step,
} from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 리뷰를 받은 뒤의 단계: 지적 없음, 자율의 판정과 pr.md */
const after: Step[] = steps('verify').map((st) =>
  st.do === 'write' && st.file === 'verification.md'
    ? { ...st, text: REVIEW_NONE + AUTO_VERDICTS }
    : st.do === 'write' && st.file === 'pr.md'
      ? { ...st, text: AUTO_PR }
      : st,
)

/** 부모의 plan.md: 조각 하나를 자식 Work로 맡겨 합쳤다 */
const PARENT_PLAN = autoPlan({
  strategy:
    '- 방식: 바로 고침\n- 본 신호: 조각 하나를 나란히 맡김\n- 고려한 대안: 없음\n- 사람 제안 판정: 없음',
}).replace(
  /## 조각\n[\s\S]*?\n\n## 바뀐 계획/,
  [
    '## 조각',
    '| id | 목표 | 실행 형태 | 맡는 파일 | 끝난 조건 | 결과 |',
    '|---|---|---|---|---|---|',
    '| p1 | median | 자식 Work | `src/avg.js`, `test/median.test.js` | 자식 완료 | 합침 |',
    '',
    '## 바뀐 계획',
  ].join('\n'),
)

const finishParent = (more: Step[] = []): Step[] => [
  ...more,
  { do: 'write', file: 'plan.md', text: PARENT_PLAN },
  {
    do: 'write',
    file: 'handoff.md',
    text: handoff({
      decisions: [{ what: '자식 Work로 맡김', why: '나란히 할 수 있음', by: 'ai' }],
      summary: '자식 Work를 합쳤다.',
    }),
  },
]

/** 부모 자율 진행과 자식 자율 진행의 시나리오. parent는 부모의 단계(마무리 전), child는 자식의 단계(기본은 TDD로 median) */
function childScenario(parent: Step[]): Scenario {
  const base = autoScenario()
  const own = finishingSteps(
    [{ do: 'prompt' }, ...finishParent(parent), { do: 'stop' }],
    AUTO_VERDICTS,
    after,
  )
  const child = finishingSteps(steps('orchestrate'), AUTO_VERDICTS, after)
  return {
    ...base,
    tasks: { ...base.tasks, orchestrate: own.own, 'orchestrate#child': child.own },
    reviewed: { ...base.reviewed, orchestrate: own.reviewed, 'orchestrate#child': child.reviewed },
  }
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

const SPAWN: Step = {
  do: 'mcpCall',
  tool: 'spawn_child',
  args: {
    title: 'median 추가',
    intent: autoIntentDraft(),
    files: ['src/avg.js', 'test/median.test.js'],
  },
  save: 'child',
}

describe('[흐름] 자식 Work (M44)', () => {
  it('부모가 spawn_child로 자식을 만들고 wait_children로 기다려 merge로 합친다. 자식은 자율 진행부터 하고 부모가 승인한다 (D543~D547)', async () => {
    const s = await setup(
      childScenario([
        SPAWN,
        {
          do: 'mcpCall',
          tool: 'wait_children',
          args: { timeout_sec: 2 },
          until: '"state":"awaiting_approval"',
          tries: 150,
          pause: 100,
        },
        { do: 'mcpCall', tool: 'decide_child', args: { work: '{child}', decision: 'merge' } },
        { do: 'git', args: ['merge', '--no-ff', '-m', 'merge: median', '{childBranch}'] },
      ]),
    )
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })

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
    expect(intent.body.trim()).toBe(autoIntentDraft().trim())
    expect(events(childDir).find((e) => e.type === 'work.completed')?.payload).toMatchObject({
      delivery: 'none',
    })
    // 자식은 부모 브랜치에서 뻗고, 부모가 답한다는 안내를 받고, 자식 도구를 받지 않는다 (깊이 1)
    expect(child.base_branch).toBe(work(s.dir(key)).branch ?? `relay/${key.split('/')[1]}`)
    const childTask = path.join(childDir, 'tasks', '01-orchestrate')
    expect(read(path.join(childTask, 'instructions.md'))).toContain('This Work is a child Work')
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

    // 도구 결과: spawn은 자식 key와 브랜치, decide merge는 다음 할 일을 알려 준다
    const calls = s.h
      .records()
      .filter((r) => r['type'] === 'mcp')
      .map((r) => [r['tool'], r['isError']])
    expect(calls[0]).toEqual(['spawn_child', false])
    expect(calls.at(-1)).toEqual(['decide_child', false])
    const decided = s.h
      .records()
      .filter((r) => r['type'] === 'mcp' && r['tool'] === 'decide_child')
      .map((r) => r['result'] as Record<string, unknown>)
    expect(decided[0]).toMatchObject({ ok: true, branch: childView.branch })
  })

  it('정하지 않은 자식이 있으면 부모의 리뷰 요청을 되돌린다. discard로 정하면 이어 간다 (D548)', async () => {
    const base = childScenario([SPAWN])
    // 부모: 자식을 정하지 않고 리뷰를 요청한다 → 되돌림 → 자식을 버리고 다시 마무리한다
    const own = base.tasks?.['orchestrate'] ?? []
    const stopAt = own.findIndex((st) => st.do === 'stop')
    const tasks = {
      ...base.tasks,
      orchestrate: own.map((st, i) =>
        i === stopAt && st.do === 'stop'
          ? {
              ...st,
              onBlock: [
                {
                  do: 'mcpCall' as const,
                  tool: 'decide_child',
                  args: { work: '{child}', decision: 'discard' },
                },
              ],
            }
          : st,
      ),
      // 자식은 일을 시작하고 멈춰 있는다(부모가 버린다)
      'orchestrate#child': [{ do: 'prompt' as const }, { do: 'wait' as const }],
    }
    const s = await setup({ ...base, tasks })
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => [t.label, t.bounces])).toEqual([
      ['01 의도 정리', 0],
      ['02 자율 진행', 1],
    ])
    const bounced = events(s.dir(key)).filter((e) => e.type === 'task.bounced')
    expect(JSON.stringify(bounced[0])).toContain('정하지 않은 자식 Work')
    const childView = s.h.relay.snapshot().works.find((w) => w.parent?.key === key)
    expect(childView?.status).toBe('abandoned')
  })

  it('부모 기준 커밋에서 시작한 자식은 decide_child pr로 따로 PR이 된다. PR 진행인 자식은 정한 것이라 부모가 마무리한다 (D547, D548)', async () => {
    const s = await setup(
      childScenario([
        SPAWN,
        {
          do: 'mcpCall',
          tool: 'wait_children',
          args: { timeout_sec: 2 },
          until: '"state":"awaiting_approval"',
          tries: 150,
          pause: 100,
        },
        { do: 'mcpCall', tool: 'decide_child', args: { work: '{child}', decision: 'pr' } },
      ]),
    )
    const gh = new FakeGitHub(path.join(s.h.root, 'record'), '', path.join(s.h.root, 'outside'))
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const childView = s.h.relay.snapshot().works.find((w) => w.parent?.key === key)
    if (!childView) throw new Error('자식 Work가 없음')
    expect(childView.status).toBe('pr')
    expect(gh.prs()).toEqual([
      expect.objectContaining({ head: childView.branch, base: 'main', state: 'open' }),
    ])
    const decided = s.h.records().find((r) => r['type'] === 'mcp' && r['tool'] === 'decide_child')
    expect(decided?.['isError']).toBe(false)
  })

  it('부모가 커밋한 뒤에 만든 자식은 PR로 따로 내지 못한다 (D547)', async () => {
    const s = await setup(
      childScenario([
        { do: 'commit', files: { 'README.md': '# sample\n' }, message: 'docs: README' },
        SPAWN,
        {
          do: 'mcpCall',
          tool: 'wait_children',
          args: { timeout_sec: 2 },
          until: '"state":"awaiting_approval"',
          tries: 150,
          pause: 100,
        },
        { do: 'mcpCall', tool: 'decide_child', args: { work: '{child}', decision: 'pr' } },
        { do: 'mcpCall', tool: 'decide_child', args: { work: '{child}', decision: 'discard' } },
      ]),
    )
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const decided = s.h
      .records()
      .filter((r) => r['type'] === 'mcp' && r['tool'] === 'decide_child')
      .map((r) => [r['isError'], JSON.stringify(r['result'])])
    expect(decided[0]?.[0]).toBe(true)
    expect(decided[0]?.[1]).toContain('부모 브랜치의 변경 위에서 시작한 자식')
    expect(decided[1]?.[0]).toBe(false)
  })

  it('자식은 자식을 만들지 못하고(깊이 1), 사람이 진행하는 Work의 다른 task는 자식 도구를 받지 않는다 (D545)', async () => {
    const s = await setup(
      childScenario([
        SPAWN,
        { do: 'mcpCall', tool: 'decide_child', args: { work: '{child}', decision: 'discard' } },
      ]),
    )
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key)
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const childView = s.h.relay.snapshot().works.find((w) => w.parent?.key === key)
    if (!childView) throw new Error('자식 Work가 없음')
    // 자식의 task에서 부르면 거절한다
    const childTask = childView.tasks[0]?.id ?? ''
    const r = await s.h.relay.children.call(childView.key, childTask, 'spawn_child', {
      title: '손주',
      intent: autoIntentDraft(),
    })
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('깊이 1') })
    // 의도 정리 task에는 자식 도구가 없다
    const intakeDir = path.join(s.dir(key), 'tasks', '01-intake')
    expect(fs.existsSync(path.join(intakeDir, 'task.mcp.json'))).toBe(false)
  })
})
