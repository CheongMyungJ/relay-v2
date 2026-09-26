import { describe, expect, it } from 'vitest'
import { REVIEWABLE, approvalGate, resolvedBySize } from '../../src/core/approval'
import type { NodeName } from '../../src/shared/contracts'
import type { CheckSummary, FormatIssue, TaskStatus } from '../../src/shared/work'

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
