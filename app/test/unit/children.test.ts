// [단위] 자식 Work의 판정 (docs/design.md D543~D549): 상한, 정하지 않은 자식, 맡는 파일의 겹침, 자식 Work 만들기의 전이,
// 부모 마무리의 관문, 사이드바의 자리
import { describe, expect, it } from 'vitest'
import {
  MAX_CHILDREN,
  childContext,
  childOverlap,
  childRules,
  isOpenChild,
  openChildrenIssue,
} from '../../src/core/children'
import { finishesWork } from '../../src/core/pipeline'
import { createWork } from '../../src/core/machine'
import { checkTask } from '../../src/core/validate'
import { nestChildren } from '../../src/renderer/src/sidebar'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { WorkView } from '../../src/shared/views'
import { autoIntentDraft, autoPlan } from '../support/scenarios'

describe('[단위] 자식 Work의 상한과 상태 (D545, D548)', () => {
  it('한 Work의 자식은 다섯까지다', () => {
    expect(MAX_CHILDREN).toBe(5)
  })

  it('진행 중이거나 멈춘 자식만 정하지 않은 것이다. 완료(merge), PR 진행(pr), 포기(discard), 보관은 정한 것이다', () => {
    expect(isOpenChild('active')).toBe(true)
    expect(isOpenChild('stopped')).toBe(true)
    for (const s of ['completed', 'pr', 'abandoned', 'archived'] as const)
      expect(isOpenChild(s)).toBe(false)
    expect(openChildrenIssue(['p/w-2'])).toContain('p/w-2')
  })

  it('맡는 파일의 겹침: 같은 파일, 폴더와 그 안의 파일. 경로 모양(./, \\, 끝의 /)은 맞춰 본다', () => {
    expect(
      childOverlap(
        ['./src/avg.js', 'docs/'],
        [
          { work: 'a', files: ['src\\avg.js'] },
          { work: 'b', files: ['docs/guide.md', 'test/x.js'] },
          { work: 'c', files: ['src/other.js'] },
        ],
      ),
    ).toEqual([
      { work: 'a', files: ['src/avg.js'] },
      { work: 'b', files: ['docs/guide.md'] },
    ])
    expect(childOverlap([], [{ work: 'a', files: ['src'] }])).toEqual([])
  })
})

describe('[단위] 자식 Work 만들기 (D543)', () => {
  const base = {
    workId: 'w-20261102-002',
    type: 'auto' as const,
    baseBranch: 'relay/w-20261102-001',
    baseCommit: 'abc',
    at: '2026-11-02T10:00:00+09:00',
  }

  it('부모가 쓴 의도를 확정하고 의도 정리 없이 자율 진행부터 시작한다. 진행하는 쪽은 부모(caller)다', () => {
    const t = createWork({
      ...base,
      parent: {
        workId: 'w-20261102-001',
        taskId: 't-02',
        intent: autoIntentDraft(),
        files: ['src/avg.js'],
      },
    })
    expect(t.work).toMatchObject({
      driver: 'caller',
      intent: { version: 1 },
      parent: { work_id: 'w-20261102-001', task_id: 't-02', files: ['src/avg.js'] },
    })
    expect(t.work.tasks.map((x) => [x.id, x.node])).toEqual([['t-01', 'orchestrate']])
    expect(t.effects.map((e) => e.type)).toEqual(['log', 'writeIntent', 'startTask'])
    expect(t.effects[1]).toMatchObject({ type: 'writeIntent', version: 1, text: autoIntentDraft() })
  })

  it('부모가 없으면 지금처럼 의도 정리부터다', () => {
    const t = createWork(base)
    expect(t.work.parent).toBeUndefined()
    expect(t.work.intent).toBeNull()
    expect(t.work.tasks.map((x) => x.node)).toEqual(['intake'])
  })
})

describe('[단위] 부모 마무리의 관문 (D548)', () => {
  const handoff = [
    '---',
    'status: review_requested',
    'blocked_reason:',
    'decisions: []',
    'assumptions: []',
    'rejected: []',
    'open_questions: []',
    'intent_deviation: null',
    'risks: []',
    '---',
    '## 요약',
    '요약',
    '## 다음 task가 알아야 할 것',
    '- 없음',
    '',
  ].join('\n')
  const run = (openChildren?: string[]) =>
    checkTask({
      node: 'orchestrate',
      type: 'auto',
      files: {
        'handoff.md': handoff,
        'plan.md': autoPlan(),
        'verification.md': '## 완료조건 판정\n| a | 통과 | b |\n',
      },
      config: DEFAULT_CONFIG,
      finishing: { requested: false },
      ...(openChildren ? { openChildren } : {}),
    }).errors

  it('정하지 않은 자식이 있으면 리뷰 요청을 되돌린다', () => {
    expect(run(['p/w-2'])).toEqual([
      expect.objectContaining({
        file: 'plan.md',
        field: '조각',
        message: expect.stringContaining('p/w-2'),
      }),
    ])
    expect(run([])).toEqual([])
    expect(run()).toEqual([])
  })
})

describe('[단위] 사이드바의 자식 Work 자리 (D549)', () => {
  const view = (key: string, parent?: string) =>
    ({
      key,
      workId: key.split('/')[1] ?? key,
      ...(parent ? { parent: { key: parent, taskId: 't-02', files: [] } } : {}),
    }) as unknown as WorkView

  it('자식은 부모 바로 아래에 만든 차례로 온다. 부모가 목록에 없으면 제자리다', () => {
    const list = [
      view('p/w-004'),
      view('p/w-003', 'p/w-001'),
      view('p/w-002', 'p/w-001'),
      view('p/w-001'),
      view('p/w-000', 'p/w-gone'),
    ]
    expect(nestChildren(list).map((w) => w.key)).toEqual([
      'p/w-004',
      'p/w-001',
      'p/w-002',
      'p/w-003',
      'p/w-000',
    ])
  })
})

describe('[단위] 자식 세션의 연결 규칙과 컨텍스트 (D552, D553)', () => {
  const link = {
    parentWorkId: 'w-1',
    parentTitle: '세 모듈',
    parentTree: '/wt/w-1',
    tree: '/wt/w-2',
    branch: 'relay/w-2',
    taskDir: '/works/w-2/tasks/01-orchestrate',
    files: ['src/csv.js'],
  }

  it('연결 규칙: 어디서 일하는지, push 금지, 부모 세션의 폴더와 SendMessage, 막히면 ask_human, handoff로 끝남. 단계 절차는 없다', () => {
    const rules = childRules(link)
    expect(rules).toMatch(/^# relay: child session$/m)
    for (const s of [
      '/wt/w-2',
      'relay/w-2',
      '`src/csv.js`',
      'Do not push',
      '/wt/w-1',
      '`SendMessage`',
      '`ListAgents`',
      'mcp__relay_task__ask_human',
      'status: awaiting_approval',
      '/works/w-2/tasks/01-orchestrate',
    ])
      expect(rules, s).toContain(s)
    expect(rules).not.toContain('plan.md')
    expect(rules).not.toContain('독립 리뷰')
  })

  it('컨텍스트는 부모의 지시와 연결 정보뿐이다', () => {
    const ctx = childContext({ ...link, brief: '  parseCsv를 만든다  ' })
    expect(ctx).toContain('## 부모의 지시\n\nparseCsv를 만든다\n')
    expect(ctx).toContain('부모 세션의 폴더: `/wt/w-1`')
    expect(ctx).not.toContain('팀 지식')
  })

  it('자식 Work의 자율 진행은 마무리 단계가 아니고, 형식 검사는 handoff만 본다', () => {
    const work = { type: 'auto' as const, pipeline: 2 as const }
    const task = { node: 'orchestrate' as const }
    expect(finishesWork(work, task)).toBe(true)
    expect(finishesWork({ ...work, parent: { work_id: 'w-1', task_id: 't-02' } }, task)).toBe(false)
    const handoff = [
      '---',
      'status: awaiting_approval',
      'blocked_reason:',
      'decisions: []',
      'assumptions: []',
      'rejected: []',
      'open_questions: []',
      'intent_deviation: null',
      'risks: []',
      '---',
      '## 요약',
      '요약',
      '## 다음 task가 알아야 할 것',
      '- 없음',
      '',
    ].join('\n')
    const errors = checkTask({
      node: 'orchestrate',
      type: 'auto',
      files: { 'handoff.md': handoff },
      config: DEFAULT_CONFIG,
      child: true,
    }).errors
    expect(errors).toEqual([])
  })
})
