import { describe, expect, it } from 'vitest'
import {
  AUTO_HOLD_LABEL,
  BADGE_ORDER,
  HUMAN_BADGES,
  REVIEWABLE,
  approvalGate,
  approvalMode,
  autoApprovable,
  autoApproveHolds,
  autoApproveNote,
  badge,
  holdNeedsNotice,
  holdText,
  pendingBackground,
} from '../../src/core/approval'
import { createWork } from '../../src/core/machine'
import { checkTask } from '../../src/core/validate'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { Handoff, NodeName } from '../../src/shared/contracts'
import type {
  AutoHoldReason,
  CheckSummary,
  FormatIssue,
  TaskStatus,
  WorkState,
  WorkStatus,
} from '../../src/shared/work'

const BODY: FormatIssue = { file: 'handoff.md', part: 'body', field: '요약', message: '요약 없음' }
const HEADER: FormatIssue = { file: 'handoff.md', part: 'header', field: 'risks', message: '형식' }
const ARTIFACT: FormatIssue = { file: 'fix.md', part: 'file', message: '`fix.md` 없음' }
const DRAFT_TYPE: FormatIssue = {
  file: 'intent.draft.md',
  part: 'header',
  field: 'type',
  message: 'type',
}
const DRAFT_HEADER: FormatIssue = {
  file: 'intent.draft.md',
  part: 'header',
  message: '머리글 없음',
}
const DRAFT_BODY: FormatIssue = { file: 'intent.draft.md', part: 'body', message: '비목표 없음' }

function check(errors: FormatIssue[], status: CheckSummary['status'] = 'awaiting_approval') {
  return { handoff_present: true, status, errors, warnings: [] }
}

const gate = (node: NodeName, s: TaskStatus, c: CheckSummary) =>
  approvalGate({ node, status: s }, c)

describe('승인 버튼의 판정 (4.1, D90, D112)', () => {
  it('에이전트가 턴을 끝낸 뒤(승인 대기, 대기, 세션 종료)에만 누를 수 있다', () => {
    expect(REVIEWABLE).toEqual(['awaiting_approval', 'idle', 'session_ended'])
    for (const s of ['working', 'asking', 'input_needed', 'blocked', 'approved'] as const) {
      expect(gate('fix', s, check([]))).toMatchObject({ approve: false, force: false })
      expect(gate('fix', s, check([BODY]))).toMatchObject({ approve: false, force: false })
    }
    for (const s of REVIEWABLE) {
      expect(gate('fix', s, check([]))).toMatchObject({ approve: true, force: false })
      expect(gate('fix', s, check([BODY]))).toMatchObject({ approve: false, force: true })
    }
  })

  it('노드마다 넘길 수 있는 오류: intake의 intent 초안 머리글과 초안 없음만 막는다', () => {
    for (const e of [BODY, HEADER, ARTIFACT]) {
      expect(gate('fix', 'idle', check([e])).force).toBe(true)
      expect(gate('intake', 'idle', check([e])).force).toBe(true)
    }
    expect(gate('intake', 'idle', check([DRAFT_BODY])).force).toBe(true)
    const noDraft: FormatIssue = { file: 'intent.draft.md', part: 'file', message: '없음' }
    for (const e of [DRAFT_TYPE, DRAFT_HEADER, noDraft]) {
      const g = gate('intake', 'idle', check([e, BODY]))
      expect(g).toMatchObject({ approve: false, force: false, blocking: [e] })
    }
  })

  it('형식 오류는 노드와 상관없이 모두 남는다. verify의 산출물 오류도 넘길 수 있다', () => {
    expect(gate('intake', 'idle', check([DRAFT_BODY, BODY])).errors).toEqual([DRAFT_BODY, BODY])
    const pr: FormatIssue = { file: 'pr.md', part: 'file', message: '`pr.md` 없음' }
    expect(gate('verify', 'idle', check([pr]))).toMatchObject({
      approve: false,
      force: true,
      errors: [pr],
      blocking: [],
    })
  })

  it('handoff가 없거나 blocked면 승인하지 않는다. 머리글을 읽지 못한 handoff는 무시하고 승인할 수 있다', () => {
    const none = { handoff_present: false, status: null, errors: [], warnings: [] }
    expect(gate('fix', 'idle', none)).toMatchObject({ approve: false, force: false })
    expect(gate('fix', 'idle', check([BODY], 'blocked'))).toMatchObject({ force: false })
    expect(gate('fix', 'awaiting_approval', check([], 'blocked')).approve).toBe(false)
    expect(gate('fix', 'idle', check([HEADER], null))).toMatchObject({
      approve: false,
      force: true,
    })
  })

  it('intake에서 handoff 머리글을 읽지 못하고 초안도 없으면 넘길 수 없다 (D134)', () => {
    const broken = '---\nstatus: [\n---\n## 요약\n'
    const config = { handoff_body_warn_chars: 5000, intent_warn_chars: 5000 }
    const c = checkTask({ node: 'intake', files: { 'handoff.md': broken }, config })
    expect(c.status).toBeNull()
    const g = gate('intake', 'idle', c)
    expect(g).toMatchObject({ approve: false, force: false })
    expect(g.blocking.map((e) => e.message)).toEqual([
      '`intent.draft.md` 없음: handoff의 `status`를 읽지 못해도 의도 승인에 필요',
    ])
    // blocked로 읽히면 초안을 요구하지 않는다 (D30)
    const blocked = '---\nstatus: blocked\nblocked_reason: 없음\n---\n'
    const b = checkTask({ node: 'intake', files: { 'handoff.md': blocked }, config })
    expect(b.errors.filter((e) => e.file === 'intent.draft.md')).toEqual([])
  })
})

const HANDOFF: Handoff = {
  status: 'awaiting_approval',
  blocked_reason: null,
  decisions: [],
  assumptions: [],
  rejected: [],
  open_questions: [],
  intent_deviation: null,
  risks: [],
  recommended_next: null,
}

/** 유효한 handoff의 검사 결과 */
function valid(h: Partial<Handoff> = {}) {
  const header = { ...HANDOFF, ...h }
  return { ...check([], header.status), handoffHeader: header }
}

describe('자동 승인의 방식 (4.2, D72)', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    auto_approve: {
      fix: false,
      respond: true,
    },
  }

  it('Work 설정이 있으면 앱 설정보다 우선하고, 없는 단계는 앱 설정을 따른다', () => {
    const settings = { auto_approve: { respond: false, fix: true } }
    expect(approvalMode(config, settings, 'respond')).toBe('manual')
    expect(approvalMode(config, settings, 'fix')).toBe('auto')
    expect(approvalMode(config, { auto_approve: { fix: true } }, 'respond')).toBe('auto')
    expect(approvalMode(config, {}, 'fix')).toBe('manual')
  })

  it('Codex는 Work에서 켜도 수동이며, 기본 엔진 변경은 기존 Claude 승인 방식에 영향을 주지 않는다', () => {
    const switched = { ...config, agent_engine: 'codex' as const }
    for (const node of ['fix', 'respond'] as const) {
      const settings = { auto_approve: { [node]: true } }
      expect(approvalMode(config, settings, node, 'codex')).toBe('manual')
      expect(approvalMode(switched, settings, node, 'claude')).toBe('auto')
    }
  })

  it('앱의 기본값은 원인 분석과 수정만 자동 승인이다 (D214)', () => {
    expect(DEFAULT_CONFIG.auto_approve).toEqual({ fix: true, respond: false })
    expect(approvalMode(DEFAULT_CONFIG, {}, 'fix')).toBe('auto')
    expect(approvalMode(DEFAULT_CONFIG, {}, 'respond')).toBe('manual')
  })

  it('intake와 verify는 설정과 상관없이 늘 수동이다. fix와 PR 대응은 켤 수 있다 (4.2, D169)', () => {
    for (const node of ['intake', 'verify'] as const) {
      expect(approvalMode(DEFAULT_CONFIG, {}, node)).toBe('manual')
      expect(autoApprovable(node)).toBe(false)
    }
    expect(autoApprovable('fix')).toBe(true)
    expect(autoApprovable('respond')).toBe(true)
  })
})

describe('자동 승인 조건 (4.3, D129)', () => {
  const holds = (c: CheckSummary & { handoffHeader?: Handoff | null }, background = false) =>
    autoApproveHolds({ node: 'fix', check: c, background })

  it('조건을 모두 만족하면 어긴 것이 없다', () => {
    expect(holds(valid())).toEqual([])
    // 기본 다음 단계(fix 다음은 verify)를 추천해도 된다
    expect(holds(valid({ recommended_next: { node: 'verify', reason: '기본' } }))).toEqual([])
  })

  it('조건을 하나씩 어기면 자동 승인하지 않는다', () => {
    const rows: [
      string,
      CheckSummary & { handoffHeader?: Handoff | null },
      boolean,
      AutoHoldReason,
    ][] = [
      ['형식 오류', { ...valid(), errors: [BODY] }, false, 'invalid'],
      [
        'handoff 없음',
        { handoff_present: false, status: null, errors: [], warnings: [] },
        false,
        'invalid',
      ],
      ['막힘 (4.4)', valid({ status: 'blocked', blocked_reason: '없음' }), false, 'invalid'],
      ['머리글을 읽지 못함', { ...check([]), handoffHeader: null }, false, 'invalid'],
      ['열린 질문', valid({ open_questions: ['기대 동작?'] }), false, 'open_questions'],
      [
        '의도와 어긋남',
        valid({ intent_deviation: { summary: '범위 밖', evidence: '로그' } }),
        false,
        'intent_deviation',
      ],
      [
        '이전 단계 추천 (D23)',
        valid({ recommended_next: { node: 'intake', reason: '의도 다시' } }),
        false,
        'recommended_next',
      ],
      ['백그라운드 작업 (D129)', valid(), true, 'background'],
    ]
    for (const [label, c, background, reason] of rows) {
      expect(holds(c, background), label).toEqual([reason])
    }
  })

  it('fix의 기본 다음 단계는 verify다. 자기 단계나 intake를 추천하면 자동 승인하지 않는다 (3.2)', () => {
    const fix = (h: Partial<Handoff>) =>
      autoApproveHolds({ node: 'fix', check: valid(h), background: false })
    expect(fix({ recommended_next: { node: 'verify', reason: '기본' } })).toEqual([])
    for (const node of ['intake', 'fix'] as const) {
      expect(fix({ recommended_next: { node, reason: '다시' } }), node).toEqual([
        'recommended_next',
      ])
    }
  })

  it('PR 대응은 선택 가능한 다음 단계가 없어 어떤 추천이든 자동 승인하지 않는다 (D188)', () => {
    const respond = (h: Partial<Handoff>) =>
      autoApproveHolds({ node: 'respond', check: valid(h), background: false })
    expect(respond({})).toEqual([])
    expect(respond({ recommended_next: { node: 'verify', reason: '다시' } })).toEqual([
      'recommended_next',
    ])
  })

  it('여럿을 어기면 모두 적는다', () => {
    expect(
      holds(
        valid({
          open_questions: ['?'],
          intent_deviation: { summary: 's', evidence: 'e' },
          recommended_next: { node: 'intake', reason: 'r' },
        }),
        true,
      ),
    ).toEqual(['open_questions', 'intent_deviation', 'recommended_next', 'background'])
  })

  it('Stop 본문의 background_tasks나 session_crons가 비어 있지 않으면 쉬는 중이다. 없으면 비어 있는 것으로 본다 (D129)', () => {
    expect(pendingBackground({})).toBe(false)
    expect(pendingBackground({ background_tasks: [], session_crons: [] })).toBe(false)
    expect(pendingBackground({ background_tasks: [{ id: 't', type: 'subagent' }] })).toBe(true)
    expect(pendingBackground({ session_crons: [{ id: 'c', schedule: '* * * * *' }] })).toBe(true)
    expect(pendingBackground({ background_tasks: 'x' })).toBe(false)
  })
})

describe('자동 승인하지 않은 까닭 (D128~D131)', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    auto_approve: {
      fix: true,
      respond: false,
    },
  }
  const task = (patch: object = {}) => ({
    node: 'fix' as const,
    status: 'awaiting_approval' as const,
    ...patch,
  })

  it('켜진 단계의 승인 대기에서 카운트다운하지 않으면 까닭과 다음 판정을 보인다', () => {
    expect(
      autoApproveNote(
        { settings: {} },
        task({ auto_hold: { at: 'x', reasons: ['open_questions', 'cancel'] } }),
        config,
      ),
    ).toEqual({
      on: true,
      hold: '자동 승인하지 않음: 열린 질문이 있음, [취소]를 누름. 다음 턴이 끝날 때 다시 판정합니다.',
    })
    // 까닭이 적혀 있지 않으면 자동 승인을 켜기 전에 턴이 끝났다 (D128)
    expect(autoApproveNote({ settings: {} }, task(), config).hold).toBe(
      '자동 승인은 턴이 끝날 때 판정합니다. 이 결과는 사람이 승인합니다. 다음 턴이 끝날 때 다시 판정합니다.',
    )
  })

  it('카운트다운 중이거나, 꺼진 단계이거나, 승인 대기가 아니면 까닭을 보이지 않는다', () => {
    const counting = task({ countdown: { started_at: 'x', seconds: 15 } })
    expect(autoApproveNote({ settings: {} }, counting, config)).toEqual({ on: true, hold: null })
    expect(autoApproveNote({ settings: { auto_approve: { fix: false } } }, task(), config)).toEqual(
      {
        on: false,
        hold: null,
      },
    )
    expect(autoApproveNote({ settings: {} }, task({ status: 'working' }), config).hold).toBeNull()
    expect(autoApproveNote({ settings: {} }, { ...task(), node: 'verify' }, config)).toEqual({
      on: false,
      hold: null,
    })
  })

  it('Codex 승인 대기는 다음 턴의 자동 승인 약속 대신 수동 승인 정책을 보인다', () => {
    const codex = { ...task(), engine: 'codex' as const }
    expect(autoApproveNote({ settings: { auto_approve: { fix: true } } }, codex, config)).toEqual({
      on: false,
      hold: 'Codex 작업은 사람이 승인합니다. 자동 승인 설정은 Claude Code 작업에 적용됩니다.',
    })
    expect(autoApproveNote({ settings: {} }, { ...codex, status: 'working' }, config)).toEqual({
      on: false,
      hold: null,
    })
  })

  it('사람이 앱에서 한 일([취소], [즉시 중단], 앱 종료, [단계 선택], 설정)과 재시작 조정은 알리지 않는다 (D130, D121, D145)', () => {
    for (const r of ['cancel', 'interrupt', 'quit', 'step', 'settings', 'restart'] as const) {
      expect(holdNeedsNotice([r]), r).toBe(false)
    }
    expect(holdText(['quit'])).toBe('카운트다운 중에 앱을 끔')
    expect(holdText(['step'])).toBe('[단계 선택]을 누름')
    for (const r of [
      'session',
      'invalid',
      'open_questions',
      'intent_deviation',
      'recommended_next',
      'background',
      'operation',
      'completion_unknown',
      // 대응 task의 Stop 때 PR이 닫혀 있었다: 사람이 다시 열거나 끝내야 한다 (D179)
      'pr_closed',
    ] as const) {
      expect(holdNeedsNotice([r]), r).toBe(true)
    }
    expect(holdNeedsNotice(['cancel', 'session'])).toBe(true)
    expect(holdText(['pr_closed'])).toContain('PR이 닫혀 있음')
    expect(Object.keys(AUTO_HOLD_LABEL)).toHaveLength(15)
    expect(AUTO_HOLD_LABEL).not.toHaveProperty('review_findings')
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

  it('우선순위는 끊긴 작업 > 질문 대기·입력 필요 > 승인 대기 > 막힘 > 멈춤 > 자동 대응 멈춤 > 대응 거리 있음 > PR 닫힘 > 머지 가능 > 세션 종료 > 작업 중 > 대기 > 대기열 > 리뷰·CI 대기 > 중단됨 > 완료·포기 (D121, D183)', () => {
    expect(BADGE_ORDER).toEqual([
      'recovery',
      'asking',
      'awaiting_approval',
      'blocked',
      'stopped',
      'auto_paused',
      'pr_items',
      'pr_closed',
      'mergeable',
      'session_ended',
      'working',
      'idle',
      'queued',
      'pr_waiting',
      'interrupted',
      'done',
    ])
    // 사람이 필요한 상태(앞의 열)만 강조한다. 리뷰·CI 대기는 남을 기다리는 것이라 강조하지 않는다 (D183)
    expect(HUMAN_BADGES).toEqual([
      'recovery',
      'asking',
      'awaiting_approval',
      'blocked',
      'stopped',
      'auto_paused',
      'pr_items',
      'pr_closed',
      'mergeable',
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

  it('멈춘 Work는 멈춤이다. 완료, 포기, 보관됨은 지금 task와 상관없이 끝난 상태를 보인다', () => {
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
    expect(badge(work('archived', 'approved'))).toEqual({
      kind: 'done',
      label: '보관됨',
      hot: false,
    })
  })

  it('상태가 겹치면 앞의 것을 보인다', () => {
    // 멈춘 Work에 사람이 필요한 task가 있으면 그 task가 앞선다
    expect(badge(work('stopped', 'awaiting_approval')).kind).toBe('awaiting_approval')
    expect(badge(work('stopped', 'interrupted')).kind).toBe('stopped')
  })

  it('끊긴 작업이 있으면 끝난 Work라도 끊긴 작업이다. 진행 중인 작업 기록은 배지를 바꾸지 않는다 (D121)', () => {
    const clean = {
      kind: 'clean' as const,
      stage: 'worktree' as const,
      started_at: 'x',
      force: false,
      delete_branches: [],
      head: null,
    }
    const recovery = { kind: 'recovery', label: '끊긴 작업', hot: true }
    expect(badge({ ...work('completed', 'approved'), operation: clean })).toEqual({
      kind: 'done',
      label: '완료',
      hot: false,
    })
    const cut = { ...clean, interrupted_at: 'y' }
    expect(badge({ ...work('completed', 'approved'), operation: cut })).toEqual(recovery)
    expect(badge({ ...work('active', 'awaiting_approval'), operation: cut })).toEqual(recovery)
  })
})
