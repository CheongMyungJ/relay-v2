import { describe, expect, it } from 'vitest'
import {
  BADGE_ORDER,
  HUMAN_BADGES,
  REVIEWABLE,
  approvalGate,
  badge,
  resolvedBySize,
} from '../../src/core/approval'
import { createWork } from '../../src/core/machine'
import type { NodeName } from '../../src/shared/contracts'
import type {
  CheckSummary,
  FormatIssue,
  TaskStatus,
  WorkState,
  WorkStatus,
} from '../../src/shared/work'

const BODY: FormatIssue = { file: 'handoff.md', part: 'body', field: '요약', message: '요약 없음' }
const HEADER: FormatIssue = { file: 'handoff.md', part: 'header', field: 'risks', message: '형식' }
const ARTIFACT: FormatIssue = { file: 'rca.md', part: 'file', message: '`rca.md` 없음' }
const SIZE: FormatIssue = {
  file: 'intent.draft.md',
  part: 'header',
  field: 'size',
  message: 'size',
}
const DRAFT_TYPE: FormatIssue = { ...SIZE, field: 'type', message: 'type' }
const DRAFT_BODY: FormatIssue = { file: 'intent.draft.md', part: 'body', message: '비목표 없음' }

function check(errors: FormatIssue[], status: CheckSummary['status'] = 'awaiting_approval') {
  return { handoff_present: true, status, errors, warnings: [] }
}

const gate = (node: NodeName, s: TaskStatus, c: CheckSummary, size?: 'S' | 'M' | 'L') =>
  approvalGate({ node, status: s }, c, size)

describe('승인 버튼의 판정 (4.1, D90, D112)', () => {
  it('에이전트가 턴을 끝낸 뒤(승인 대기, 대기, 세션 종료)에만 누를 수 있다', () => {
    expect(REVIEWABLE).toEqual(['awaiting_approval', 'idle', 'session_ended'])
    for (const s of ['working', 'asking', 'input_needed', 'blocked', 'approved'] as const) {
      expect(gate('rca', s, check([]))).toMatchObject({ approve: false, force: false })
      expect(gate('rca', s, check([BODY]))).toMatchObject({ approve: false, force: false })
    }
    for (const s of REVIEWABLE) {
      expect(gate('rca', s, check([]))).toMatchObject({ approve: true, force: false })
      expect(gate('rca', s, check([BODY]))).toMatchObject({ approve: false, force: true })
    }
  })

  it('노드마다 넘길 수 있는 오류: intake의 intent 초안 머리글과 초안 없음만 막는다', () => {
    for (const e of [BODY, HEADER, ARTIFACT]) {
      expect(gate('rca', 'idle', check([e])).force).toBe(true)
      expect(gate('intake', 'idle', check([e])).force).toBe(true)
    }
    expect(gate('intake', 'idle', check([DRAFT_BODY])).force).toBe(true)
    const noDraft: FormatIssue = { file: 'intent.draft.md', part: 'file', message: '없음' }
    for (const e of [SIZE, DRAFT_TYPE, noDraft]) {
      const g = gate('intake', 'idle', check([e, BODY]))
      expect(g).toMatchObject({ approve: false, force: false, blocking: [e] })
    }
  })

  it('size 오류는 intake에서 사람이 size를 고를 때만 풀린다', () => {
    expect(resolvedBySize(SIZE)).toBe(true)
    expect(resolvedBySize(DRAFT_TYPE)).toBe(false)
    expect(gate('intake', 'idle', check([SIZE]), 'M')).toMatchObject({
      approve: true,
      errors: [],
    })
    expect(gate('intake', 'idle', check([SIZE, BODY]), 'M')).toMatchObject({
      approve: false,
      force: true,
      errors: [BODY],
    })
    expect(gate('rca', 'idle', check([SIZE]), 'M').errors).toEqual([SIZE])
  })

  it('handoff가 없거나 blocked면 승인하지 않는다. 머리글을 읽지 못한 handoff는 무시하고 승인할 수 있다', () => {
    const none = { handoff_present: false, status: null, errors: [], warnings: [] }
    expect(gate('rca', 'idle', none)).toMatchObject({ approve: false, force: false })
    expect(gate('rca', 'idle', check([BODY], 'blocked'))).toMatchObject({ force: false })
    expect(gate('rca', 'awaiting_approval', check([], 'blocked')).approve).toBe(false)
    expect(gate('rca', 'idle', check([HEADER], null))).toMatchObject({
      approve: false,
      force: true,
    })
  })
})

describe('사이드바 배지 (D80)', () => {
  const base = createWork({ workId: 'w', baseBranch: 'main', baseCommit: 'c', at: 'x' }).work

  function work(status: WorkStatus, task: TaskStatus): WorkState {
    return {
      ...base,
      status,
      tasks: base.tasks.map((t) => ({ ...t, status: task })),
    }
  }

  it('우선순위는 질문 대기·입력 필요 > 승인 대기 > 막힘 > 멈춤 > 세션 종료 > 작업 중 > 대기 > 대기열 > 중단됨 > 완료·포기', () => {
    expect(BADGE_ORDER).toEqual([
      'asking',
      'awaiting_approval',
      'blocked',
      'stopped',
      'session_ended',
      'working',
      'idle',
      'queued',
      'interrupted',
      'done',
    ])
    // 사람이 필요한 상태(앞의 다섯)만 강조한다
    expect(HUMAN_BADGES).toEqual([
      'asking',
      'awaiting_approval',
      'blocked',
      'stopped',
      'session_ended',
    ])
  })

  it('진행 중인 Work는 지금 task의 표시를 보인다', () => {
    const rows: [TaskStatus, string, string, boolean][] = [
      ['asking', 'asking', '질문 대기', true],
      ['input_needed', 'asking', '입력 필요', true],
      ['awaiting_approval', 'awaiting_approval', '승인 대기', true],
      ['blocked', 'blocked', '막힘', true],
      ['session_ended', 'session_ended', '세션 종료', true],
      ['working', 'working', '작업 중', false],
      ['idle', 'idle', '대기', false],
      ['queued', 'queued', '대기열', false],
      ['interrupted', 'interrupted', '중단됨', false],
    ]
    for (const [status, kind, label, hot] of rows) {
      expect(badge(work('active', status))).toEqual({ kind, label, hot })
    }
  })

  it('멈춘 Work는 멈춤이다. 완료와 포기는 지금 task와 상관없이 끝난 상태를 보인다', () => {
    expect(badge(work('stopped', 'approved'))).toEqual({
      kind: 'stopped',
      label: '멈춤',
      hot: true,
    })
    expect(badge(work('completed', 'approved'))).toEqual({
      kind: 'done',
      label: '완료',
      hot: false,
    })
    expect(badge(work('abandoned', 'interrupted'))).toEqual({
      kind: 'done',
      label: '포기',
      hot: false,
    })
  })

  it('상태가 겹치면 앞의 것을 보인다', () => {
    // 멈춘 Work에 사람이 필요한 task가 있으면 그 task가 앞선다
    expect(badge(work('stopped', 'awaiting_approval')).kind).toBe('awaiting_approval')
    expect(badge(work('stopped', 'interrupted')).kind).toBe('stopped')
  })
})
