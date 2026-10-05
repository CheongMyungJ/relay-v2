// [단위] 이슈 기록 (docs/implementation.md M19, 설계 3.7, D336~D349, I97).
import { describe, expect, it } from 'vitest'
import { checkProjectSettings } from '../../src/core/config'
import {
  CUT_NOTE,
  ISSUE_TEXT_LIMIT,
  commentIdOf,
  commentShowsIntent,
  endComment,
  endOf,
  issueBody,
  issueEntries,
  issueKey,
  issueNumberOf,
  issueTitle,
  issueUrlOf,
  stepComment,
  taskComment,
  withCloses,
} from '../../src/core/issue'
import {
  createWork,
  currentTask,
  transition,
  type MachineEvent,
  type Transition,
} from '../../src/core/machine'
import type { TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff } from '../../src/shared/contracts'
import type { IssueRecord, LifecycleEvent, TaskRecord, WorkState } from '../../src/shared/work'

let clock = 0
const at = () => `2026-10-05T10:${String(clock++ % 60).padStart(2, '0')}:00+09:00`

const MANUAL: AppConfig = {
  ...DEFAULT_CONFIG,
  auto_approve: {
    fix: false,
    design: false,
    implement: false,
    refactor: false,
    execute: false,
    respond: false,
  },
}

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [{ what: '원인은 타임존 불일치', why: 'UTC/KST 9시간 차이', by: 'ai' }],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

const VALID: TaskCheck = {
  handoff_present: true,
  status: 'awaiting_approval',
  errors: [],
  warnings: [],
  handoff: HANDOFF,
  handoffHeader: HANDOFF,
}

const apply = (work: WorkState, event: MachineEvent): Transition => transition(work, event, MANUAL)

function newWork(issue: { linked: number | null } | null = { linked: null }): WorkState {
  return createWork({
    type: 'bugfix',
    workId: 'w-20261005-001',
    baseBranch: 'main',
    baseCommit: 'base0001',
    ...(issue ? { issue } : {}),
    at: at(),
  }).work
}

/** 지금 task를 띄우고 Stop을 받아 승인 대기로 둔 뒤 승인한다 */
function approveCurrent(work: WorkState): Transition {
  const task = currentTask(work)
  if (!task) throw new Error('task 없음')
  const started = apply(work, {
    type: 'session.started',
    taskId: task.id,
    at: at(),
    sessionId: `session-${task.id}`,
    pid: 1000 + task.seq,
    startCommit: `start-${task.id}`,
    skillHash: 'skillhash',
    claudeVersion: '2.1.283 (Claude Code)',
  }).work
  const stopped = apply(started, {
    type: 'Stop',
    taskId: task.id,
    at: at(),
    stopHookActive: false,
    handoffChanged: true,
    check: VALID,
  }).work
  return apply(stopped, { type: 'approve', taskId: task.id, at: at(), check: VALID })
}

const ev = (
  type: LifecycleEvent['type'],
  payload: Record<string, unknown> = {},
  taskId?: string,
): LifecycleEvent => ({
  ts: at(),
  work_id: 'w-20261005-001',
  ...(taskId ? { task_id: taskId } : {}),
  type,
  payload,
})

const withIssue = (work: WorkState, patch: Partial<IssueRecord>): WorkState => ({
  ...work,
  issue: { linked: false, number: 1, url: null, pending: [], posted: [], ...patch },
})

describe('이슈 기록의 대기열 (I97)', () => {
  it('이슈 기록이 없는 Work는 아무것도 더하지 않는다', () => {
    const r = approveCurrent(newWork(null))
    expect(r.work.issue).toBeUndefined()
    expect(r.effects.some((e) => e.type === 'publishIssue')).toBe(false)
  })

  it('의도 승인은 새 이슈 만들기와 intake 코멘트를 더하고 게시를 맡긴다 (D336)', () => {
    const r = approveCurrent(newWork())
    expect(r.work.issue?.pending).toEqual([
      { kind: 'issue', intent_version: 1 },
      { kind: 'task', task_id: 't-01', intent_version: 1 },
    ])
    expect(r.effects.at(-1)).toEqual({ type: 'publishIssue' })
  })

  it('기존 이슈는 만들지 않고 intake 코멘트부터 단다 (D338)', () => {
    const r = approveCurrent(newWork({ linked: 7 }))
    expect(r.work.issue).toMatchObject({ linked: true, number: 7 })
    expect(r.work.issue?.pending).toEqual([{ kind: 'task', task_id: 't-01', intent_version: 1 }])
  })

  it('다음 task의 승인은 코멘트를 하나 더한다. 의도 승인을 다시 해도 이슈는 한 번만 만든다', () => {
    const intake = approveCurrent(newWork()).work
    const fix = approveCurrent(intake)
    expect(fix.work.issue?.pending.map(issueKey)).toEqual(['body', 't-01', 't-02'])
    const events = [ev('task.approved', { by: 'human' }, 't-01')]
    const again = issueEntries({ ...fix.work, intent: { version: 2 } }, events)
    expect(again).toEqual([{ kind: 'task', task_id: 't-01', intent_version: 2 }])
  })

  it('PR 대응 task의 승인은 올리지 않는다 (D340)', () => {
    const base = withIssue(newWork(), { posted: [{ key: 'body', at: at() }] })
    const respond: TaskRecord = { ...(base.tasks[0] as TaskRecord), id: 't-04', node: 'respond' }
    const work = { ...base, tasks: [...base.tasks, respond] }
    expect(issueEntries(work, [ev('task.approved', { by: 'human' }, 't-04')])).toEqual([])
  })

  it('되감기와 건너뛰기는 올렸거나 올릴 task를 폐기했을 때만 코멘트를 더한다 (D341)', () => {
    const work = withIssue(newWork(), {
      posted: [
        { key: 'body', at: at() },
        { key: 't-01', at: at() },
      ],
      pending: [{ kind: 'task', task_id: 't-02' }],
    })
    const rewound = (discarded: string[]) =>
      issueEntries(work, [ev('task.rewound', { node: 'fix', discarded }, 't-05')])
    expect(rewound(['t-02', 't-03'])).toEqual([{ kind: 'step', task_id: 't-05' }])
    expect(rewound(['t-01'])).toEqual([{ kind: 'step', task_id: 't-05' }])
    expect(rewound(['t-03'])).toEqual([])
    expect(
      issueEntries(work, [ev('task.skipped_to', { node: 'verify', discarded: ['t-02'] }, 't-05')]),
    ).toEqual([{ kind: 'step', task_id: 't-05' }])
  })

  it('Work가 끝나면 끝 코멘트와, 새 이슈면 닫기를 더한다. 의도 승인 전에는 없다 (D346, D347)', () => {
    const started = withIssue(newWork(), { posted: [{ key: 'body', at: at() }] })
    expect(issueEntries(started, [ev('work.abandoned')])).toEqual([
      { kind: 'end', text: 'Work 포기' },
      { kind: 'close', reason: 'not_planned' },
    ])
    const linked = withIssue(newWork(), {
      linked: true,
      number: 7,
      posted: [{ key: 't-01', at: at() }],
    })
    expect(issueEntries(linked, [ev('work.completed', { delivery: 'none' })])).toEqual([
      { kind: 'end', text: 'Work 완료' },
    ])
    expect(apply(newWork(), { type: 'abandon', at: at() }).work.issue?.pending).toEqual([])
    expect(
      apply(newWork({ linked: 7 }), { type: 'abandon', at: at() }).work.issue?.pending,
    ).toEqual([])
  })

  it('끝 문구와 닫는 까닭은 전달로 정한다 (D346, D347)', () => {
    const work = newWork()
    const pr = { ...work, pr: { number: 12 } as WorkState['pr'] }
    expect(endOf(work, ev('work.completed', { delivery: 'none' }))).toEqual({
      text: 'Work 완료',
      reason: 'completed',
    })
    expect(endOf(work, ev('work.completed', { delivery: 'push' }))).toEqual({
      text: 'Work 완료(push): 브랜치 `relay/w-20261005-001`',
      reason: 'completed',
    })
    expect(endOf(pr, ev('work.completed', { delivery: 'pr', merged: true }))).toEqual({
      text: 'Work 완료: PR #12 머지',
      reason: 'completed',
    })
    expect(endOf(pr, ev('work.completed', { delivery: 'pr', merged: false }))).toEqual({
      text: 'Work 완료(머지 없이 끝냄): PR #12',
      reason: 'not_planned',
    })
    expect(endOf(work, ev('work.abandoned'))).toEqual({ text: 'Work 포기', reason: 'not_planned' })
    expect(endOf(work, ev('task.approved'))).toBeNull()
  })
})

describe('게시의 결과 (I98, D344, D349)', () => {
  const queued = () => approveCurrent(newWork()).work

  it('시도를 적고, 만들거나 게시하면 맨 앞을 빼서 게시한 것에 적는다', () => {
    let w = apply(queued(), {
      type: 'issue.attempted',
      at: '2026-10-05T11:00:00+09:00',
      key: 'body',
    }).work
    expect(w.issue?.attempted_at).toBe('2026-10-05T11:00:00+09:00')
    const created = apply(w, {
      type: 'issue.created',
      at: '2026-10-05T11:00:01+09:00',
      number: 3,
      url: 'https://github.com/o/r/issues/3',
      labeled: true,
    })
    w = created.work
    expect(w.issue).toMatchObject({ number: 3, url: 'https://github.com/o/r/issues/3' })
    expect(w.issue?.attempted_at).toBeUndefined()
    expect(w.issue?.pending.map(issueKey)).toEqual(['t-01'])
    expect(created.effects).toEqual([
      {
        type: 'log',
        event: {
          ts: '2026-10-05T11:00:01+09:00',
          work_id: 'w-20261005-001',
          type: 'issue.created',
          payload: { number: 3, url: 'https://github.com/o/r/issues/3', labeled: true },
        },
      },
    ])
    w = apply(w, {
      type: 'issue.posted',
      at: at(),
      key: 't-01',
      commentId: 55,
      url: 'https://github.com/o/r/issues/3#issuecomment-55',
    }).work
    expect(w.issue?.pending).toEqual([])
    expect(w.issue?.posted.map((p) => [p.key, p.comment_id ?? null])).toEqual([
      ['body', null],
      ['t-01', 55],
    ])
  })

  it('맨 앞과 키가 맞지 않는 늦은 결과는 무시한다', () => {
    const w = queued()
    expect(
      apply(w, { type: 'issue.posted', at: at(), key: 't-01', commentId: 1, url: 'u' }).work,
    ).toBe(w)
    expect(apply(w, { type: 'issue.failed', at: at(), key: 't-09', error: 'x' }).work).toBe(w)
    expect(apply(w, { type: 'issue.closed', at: at() }).work).toBe(w)
  })

  it('실패를 적고 맨 앞은 그대로 둔다. 다음에 게시하면 실패 기록을 지운다', () => {
    const failed = apply(queued(), { type: 'issue.failed', at: at(), key: 'body', error: '502' })
    expect(failed.work.issue?.failure).toMatchObject({ key: 'body', error: '502' })
    expect(failed.work.issue?.pending).toHaveLength(2)
    expect(failed.effects).toMatchObject([
      { type: 'log', event: { type: 'issue.post_failed', payload: { key: 'body', pending: 2 } } },
    ])
    const ok = apply(failed.work, {
      type: 'issue.created',
      at: at(),
      number: 1,
      url: 'https://github.com/o/r/issues/1',
      labeled: false,
    })
    expect(ok.work.issue?.failure).toBeUndefined()
  })

  it('기존 이슈의 주소는 첫 코멘트의 주소에서 읽고, 닫기는 항목의 까닭을 적는다', () => {
    const linked = approveCurrent(newWork({ linked: 7 })).work
    const posted = apply(linked, {
      type: 'issue.posted',
      at: at(),
      key: 't-01',
      commentId: 9,
      url: 'https://github.com/o/r/issues/7#issuecomment-9',
    }).work
    expect(posted.issue?.url).toBe('https://github.com/o/r/issues/7')
    const closing = withIssue(newWork(), { pending: [{ kind: 'close', reason: 'not_planned' }] })
    const closed = apply(closing, { type: 'issue.closed', at: '2026-10-05T12:00:00+09:00' })
    expect(closed.work.issue?.closed).toEqual({
      at: '2026-10-05T12:00:00+09:00',
      reason: 'not_planned',
    })
  })
})

describe('이슈의 글 (D336, D339, D341, D347, D348, D349)', () => {
  const INTENT = [
    '---',
    'schema_version: 1',
    'version: 1',
    'type: bugfix',
    '---',
    '## 목표',
    '- KST 서버에서 토큰이 바로 만료되는 문제를 고친다.',
    '',
    '## 완료조건',
    '- [ ] `npm test`가 통과한다',
    '',
  ].join('\n')

  it('제목은 목표의 첫 줄이고, 256자에서 자른다. 목표가 없으면 Work id다 (D348, D349)', () => {
    expect(issueTitle(INTENT, 'w-1')).toBe('KST 서버에서 토큰이 바로 만료되는 문제를 고친다.')
    expect(issueTitle(`## 목표\n${'가'.repeat(300)}\n`, 'w-1')).toHaveLength(256)
    expect(issueTitle('## 완료조건\n- [ ] x\n', 'w-1')).toBe('relay Work w-1')
  })

  it('본문은 안내 한 줄, 머리글을 뺀 intent, 표시다 (D336)', () => {
    const body = issueBody({ workId: 'w-1', type: 'bugfix', intent: INTENT })
    expect(body).toBe(
      [
        '> relay Work `w-1`(버그 수정)의 기록이다. 단계가 승인될 때마다 코멘트를 덧붙인다.',
        '',
        '## 목표',
        '- KST 서버에서 토큰이 바로 만료되는 문제를 고친다.',
        '',
        '## 완료조건',
        '- [ ] `npm test`가 통과한다',
        '',
        '<!-- relay:w-1/issue/body -->',
        '',
      ].join('\n'),
    )
  })

  const HANDOFF_MD = [
    '---',
    'status: awaiting_approval',
    'decisions:',
    '  - what: "원인은 타임존 불일치"',
    '    why: "재현 로그의 차이가 9시간"',
    '    by: ai',
    '  - what: "refresh 경로도 고친다"',
    '    why: "같은 함수를 씀"',
    '    by: human',
    '---',
    '## 요약',
    '만료 판정이 로컬 시각 비교라 9시간 일찍 만료된다.',
    '',
    '## 다음 task가 알아야 할 것',
    '- `src/auth/token.ts`',
    '',
  ].join('\n')

  it('task 코멘트는 머리 줄, 요약, 결정, 접은 산출물, 표시다 (D339, D342)', () => {
    const text = taskComment({
      workId: 'w-1',
      task: { id: 't-02', node: 'fix', approved_by: 'auto' },
      handoff: HANDOFF_MD,
      artifacts: [{ name: 'fix.md', text: '## 재현\n로그\n' }],
    })
    expect(text).toBe(
      [
        '### t-02 원인 분석과 수정 · 승인(자동)',
        '',
        '**요약**',
        '',
        '만료 판정이 로컬 시각 비교라 9시간 일찍 만료된다.',
        '',
        '**결정**',
        '',
        '- 원인은 타임존 불일치 — 재현 로그의 차이가 9시간 (AI)',
        '- refresh 경로도 고친다 — 같은 함수를 씀 (사람)',
        '',
        '<details><summary>fix.md</summary>',
        '',
        '## 재현',
        '로그',
        '',
        '</details>',
        '',
        '<!-- relay:w-1/issue/t-02 -->',
        '',
      ].join('\n'),
    )
  })

  it('intake 코멘트는 산출물 대신 intent를 펼친다. 새 이슈의 v1은 빼고 기존 이슈와 v2부터 넣는다 (D339)', () => {
    expect(commentShowsIntent({ linked: false }, 1)).toBe(false)
    expect(commentShowsIntent({ linked: false }, 2)).toBe(true)
    expect(commentShowsIntent({ linked: true }, 1)).toBe(true)
    const text = taskComment({
      workId: 'w-1',
      task: { id: 't-04', node: 'intake', approved_by: 'human' },
      handoff: HANDOFF_MD,
      artifacts: [{ name: 'intent.draft.md', text: '초안' }],
      intent: { version: 2, text: INTENT },
    })
    expect(text).toContain('### t-04 의도 정리 · 승인(사람)\n\n**intent v2**\n\n## 목표\n')
    expect(text).not.toContain('schema_version')
    expect(text).not.toContain('<details>')
  })

  it('handoff를 읽지 못하면 요약 자리에 그렇게 적는다', () => {
    const text = taskComment({
      workId: 'w-1',
      task: { id: 't-02', node: 'fix', approved_by: 'human' },
      handoff: null,
      artifacts: [],
    })
    expect(text).toContain('**요약**\n\n(handoff에서 요약을 읽지 못함)')
    expect(text).not.toContain('**결정**')
  })

  it('상한을 넘으면 접은 산출물을 잘라 잘린 말을 붙이고, 표시는 늘 끝에 둔다 (D349)', () => {
    const text = taskComment({
      workId: 'w-1',
      task: { id: 't-02', node: 'fix', approved_by: 'human' },
      handoff: HANDOFF_MD,
      artifacts: [
        { name: 'fix.md', text: 'a'.repeat(70_000) },
        { name: 'more.md', text: 'b' },
      ],
    })
    expect(text.length).toBeLessThanOrEqual(ISSUE_TEXT_LIMIT)
    expect(text).toContain(`${CUT_NOTE}\n\n</details>`)
    expect(text).not.toContain('more.md')
    expect(text.endsWith('<!-- relay:w-1/issue/t-02 -->\n')).toBe(true)
    const huge = issueBody({
      workId: 'w-1',
      type: 'bugfix',
      intent: `## 목표\n${'x'.repeat(70_000)}`,
    })
    expect(huge.length).toBeLessThanOrEqual(ISSUE_TEXT_LIMIT)
    expect(huge).toContain(CUT_NOTE)
    expect(huge.endsWith('<!-- relay:w-1/issue/body -->\n')).toBe(true)
  })

  it('단계 선택 코멘트는 폐기한 task, 다시 하는 task, 추가 지시다 (D341)', () => {
    const text = stepComment({
      workId: 'w-1',
      task: {
        id: 't-04',
        node: 'fix',
        reason: 'rewind',
        selection: {
          from_task: 't-03',
          instruction: '경계값도 본다',
          discarded: ['t-02', 't-03'],
          skipped: [],
          keep_code: false,
          reset: null,
        },
      },
      discarded: ['t-02 원인 분석과 수정', 't-03 리뷰와 검증'],
    })
    expect(text).toBe(
      [
        '### 되감기: t-02 원인 분석과 수정, t-03 리뷰와 검증 폐기',
        '',
        '앞에 단 이 task들의 코멘트는 더는 유효하지 않다. t-04 원인 분석과 수정부터 다시 한다.',
        '',
        '**추가 지시**',
        '',
        '경계값도 본다',
        '',
        '<!-- relay:w-1/issue/rewind-t-04 -->',
        '',
      ].join('\n'),
    )
    expect(
      stepComment({
        workId: 'w-1',
        task: { id: 't-04', node: 'verify', reason: 'skip' },
        discarded: ['t-03 리뷰와 검증'],
      }),
    ).toContain('### 건너뛰기: t-03 리뷰와 검증 폐기')
  })

  it('끝 코멘트, Closes 줄, 주소 읽기', () => {
    expect(endComment('w-1', 'Work 포기')).toBe('Work 포기\n\n<!-- relay:w-1/issue/end -->\n')
    expect(withCloses('# 제목\n\n## 요약\n\n', 3)).toBe('# 제목\n\n## 요약\n\nCloses #3\n')
    expect(issueNumberOf('https://github.com/o/r/issues/12')).toBe(12)
    expect(issueNumberOf('https://github.com/o/r/issues/12#issuecomment-5')).toBe(12)
    expect(issueNumberOf('https://github.com/o/r/pull/12')).toBeNull()
    expect(commentIdOf('https://github.com/o/r/issues/12#issuecomment-501')).toBe(501)
    expect(commentIdOf('https://github.com/o/r/issues/12')).toBeNull()
    expect(issueUrlOf('https://github.com/o/r/issues/12#issuecomment-501')).toBe(
      'https://github.com/o/r/issues/12',
    )
  })
})

describe('프로젝트 설정의 이슈 기록 (D337)', () => {
  it('issue_log는 true/false이고, 없으면 바꾸지 않는다', () => {
    const base = { allowed_bots: [], merge_method: null }
    expect(checkProjectSettings({ ...base, issue_log: false })).toEqual({
      ok: true,
      value: { ...base, issue_log: false },
    })
    expect(checkProjectSettings(base)).toEqual({ ok: true, value: base })
    expect(checkProjectSettings({ ...base, issue_log: 'yes' })).toEqual({
      ok: false,
      error: '이슈 기록: true/false여야 함',
    })
  })
})
