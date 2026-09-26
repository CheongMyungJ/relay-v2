import { describe, expect, it } from 'vitest'
import { createWork } from '../../src/core/machine'
import {
  TASK_STATUS_LABEL,
  WORK_STATUS_LABEL,
  bandText,
  emphasis,
  handoffSummary,
  humanNotice,
  permissionNotice,
  resumeHint,
  stopNotice,
  taskLabel,
  verdicts,
} from '../../src/core/review'
import type { Handoff } from '../../src/shared/contracts'
import type { FormatIssue, TaskStatus, WorkState } from '../../src/shared/work'

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

describe('task 이름과 머리 띠 (D109, 시나리오 2-5)', () => {
  it('탭 이름은 순번과 화면 이름이다', () => {
    expect(taskLabel({ seq: 3, node: 'rca' })).toBe('03 원인 분석')
    expect(taskLabel({ seq: 1, node: 'intake' })).toBe('01 의도 정리')
    expect(taskLabel({ seq: 12, node: 'verify' })).toBe('12 최종 검증')
  })

  it('머리 띠는 이름 · 새 세션 · 이유다', () => {
    expect(bandText({ seq: 4, node: 'rca', reason: 'default' })).toBe(
      '04 원인 분석 · 새 세션 · 이유: 기본 진행',
    )
    // [이 단계 새 세션으로 다시]로 만든 task (D114)
    expect(bandText({ seq: 5, node: 'rca', reason: 'resume' })).toBe(
      '05 원인 분석 · 새 세션 · 이유: 재개',
    )
  })

  it('--resume으로 다시 연 세션은 세션 재개다 (시나리오 3-4)', () => {
    const session = { id: 's', pid: 1, started_at: 'x', alive: true }
    expect(bandText({ seq: 4, node: 'rca', reason: 'default', session })).toBe(
      '04 원인 분석 · 새 세션 · 이유: 기본 진행',
    )
    expect(
      bandText({
        seq: 4,
        node: 'rca',
        reason: 'default',
        session: { ...session, resumed_at: 'y' },
      }),
    ).toBe('04 원인 분석 · 세션 재개 · 이유: 기본 진행')
  })

  it('권한 확인 끈 모드가 아니면 경고한다 (D94)', () => {
    expect(permissionNotice({})).toBeNull()
    expect(permissionNotice({ permission_mode: 'bypassPermissions' })).toBeNull()
    expect(permissionNotice({ permission_mode: 'auto' })).toBe(
      '권한 확인 끈 모드가 아님(auto 모드): 일부 동작이 막힐 수 있음',
    )
  })

  it('상태마다 이름이 있다 (3.3, 시나리오 3)', () => {
    const all: TaskStatus[] = [
      'queued',
      'working',
      'asking',
      'input_needed',
      'idle',
      'awaiting_approval',
      'blocked',
      'session_ended',
      'interrupted',
      'approved',
    ]
    expect(Object.keys(TASK_STATUS_LABEL).sort()).toEqual([...all].sort())
    expect(TASK_STATUS_LABEL.queued).toBe('대기열')
    expect(WORK_STATUS_LABEL.abandoned).toBe('포기')
  })

  it('이전 단계 추천으로 멈추면 알린다 (D23)', () => {
    const work = createWork({ workId: 'w', baseBranch: 'main', baseCommit: 'c', at: 'x' }).work
    expect(stopNotice(work)).toBeNull()
    const stopped = {
      ...work,
      status: 'stopped' as const,
      stop: {
        kind: 'recommended_back' as const,
        task_id: 't-05',
        node: 'fix' as const,
        reason: '완료조건 2 실패',
      },
    }
    expect(stopNotice(stopped)).toBe('이전 단계 추천으로 멈춤: 수정(fix)로 — 완료조건 2 실패')
  })

  it('[이 단계 끝나면 멈춤]으로 멈추면 승인한 task를 알린다 (시나리오 3-4)', () => {
    const work = createWork({ workId: 'w', baseBranch: 'main', baseCommit: 'c', at: 'x' }).work
    const stopped = {
      ...work,
      status: 'stopped' as const,
      stop: { kind: 'after_step' as const, task_id: 't-01' },
    }
    expect(stopNotice(stopped)).toBe('이 단계 끝나면 멈춤: 01 의도 정리 승인 뒤 멈춤')
  })

  it('[재개]가 할 일을 알린다: 기본 다음 단계, verify에서 멈췄으면 Work 완료 (3.3)', () => {
    const work = createWork({ workId: 'w', baseBranch: 'main', baseCommit: 'c', at: 'x' }).work
    expect(resumeHint(work)).toBeNull()
    const at = (node: 'intake' | 'evidence' | 'verify', stop: WorkState['stop']): WorkState => ({
      ...work,
      status: 'stopped',
      intent: { version: 1, size: 'M' },
      tasks: work.tasks.map((t) => ({ ...t, node })),
      stop,
    })
    const afterStep = { kind: 'after_step' as const, task_id: 't-01' }
    expect(resumeHint(at('intake', afterStep))).toBe(
      '[재개]하면 다음 단계(재현과 관찰)를 시작합니다.',
    )
    expect(resumeHint(at('verify', afterStep))).toBe('[재개]하면 Work를 완료합니다.')
    const back = (node: 'intake' | 'fix') => ({
      kind: 'recommended_back' as const,
      task_id: 't-01',
      node,
      reason: '다시',
    })
    expect(resumeHint(at('evidence', back('intake')))).toBe(
      '[재개]하면 추천을 따르지 않고 다음 단계(원인 분석)를 시작합니다. 추천대로 되돌아가는 단계 선택은 M4에서 넣습니다.',
    )
    expect(resumeHint(at('verify', back('fix')))).toBe(
      '[재개]하면 추천을 따르지 않고 Work를 완료합니다. 추천대로 되돌아가는 단계 선택은 M4에서 넣습니다.',
    )
  })
})

describe('OS 알림 문구 (D81)', () => {
  const base = createWork({ workId: 'w', baseBranch: 'main', baseCommit: 'c', at: 'x' }).work
  const at = (status: TaskStatus, work: WorkState = base): WorkState => ({
    ...work,
    tasks: work.tasks.map((t) => ({ ...t, status })),
  })

  it('사람이 필요한 상태로 바뀌면 알린다', () => {
    expect(humanNotice(at('working'), at('asking'))).toBe('01 의도 정리: 질문 대기')
    expect(humanNotice(at('working'), at('input_needed'))).toBe('01 의도 정리: 입력 필요')
    expect(humanNotice(at('working'), at('awaiting_approval'))).toBe('01 의도 정리: 승인 대기')
    expect(humanNotice(at('working'), at('blocked'))).toBe('01 의도 정리: 막힘')
    expect(humanNotice(at('idle'), at('session_ended'))).toBe(
      '01 의도 정리: handoff 없이 세션 종료',
    )
    const stopped: WorkState = {
      ...at('approved'),
      status: 'stopped',
      stop: { kind: 'after_step', task_id: 't-01' },
    }
    expect(humanNotice(at('awaiting_approval'), stopped)).toBe(
      '이 단계 끝나면 멈춤: 01 의도 정리 승인 뒤 멈춤',
    )
  })

  it('같은 상태가 이어지거나 사람이 필요 없는 상태로 바뀌면 알리지 않는다', () => {
    expect(humanNotice(at('asking'), at('input_needed'))).toBeNull()
    expect(humanNotice(at('awaiting_approval'), at('working'))).toBeNull()
    expect(humanNotice(at('working'), at('idle'))).toBeNull()
    expect(humanNotice(at('working'), at('interrupted'))).toBeNull()
    expect(humanNotice(at('queued'), at('working'))).toBeNull()
  })
})

describe('강조 영역 (D83, 시나리오 4-2)', () => {
  const ERR: FormatIssue = { file: 'handoff.md', part: 'body', message: '`## 요약` 절 없음' }

  it('사람이 봐야 할 것이 없으면 비어 있다', () => {
    expect(emphasis({ node: 'rca', handoff: HANDOFF, errors: [], uncommitted: [] })).toEqual([])
  })

  it('intent_deviation, 열린 질문, 이전 단계 추천, 커밋 안 된 변경, 형식 오류를 순서대로 모은다', () => {
    const items = emphasis({
      node: 'verify',
      handoff: {
        ...HANDOFF,
        intent_deviation: { summary: '범위를 넘음', evidence: 'refresh.ts도 바뀜' },
        open_questions: ['운영 TZ는?'],
        recommended_next: { node: 'fix', reason: '완료조건 2 실패' },
      },
      errors: [ERR],
      uncommitted: [' M src/a.ts'],
    })
    expect(items.map((i) => i.kind)).toEqual([
      'intent_deviation',
      'open_questions',
      'recommended_back',
      'uncommitted',
      'format_errors',
    ])
    expect(items[0]?.lines).toEqual(['범위를 넘음', '근거: refresh.ts도 바뀜'])
    expect(items[2]?.lines[0]).toBe('수정(fix)로 — 완료조건 2 실패')
    expect(items[4]?.lines).toEqual(['handoff.md: `## 요약` 절 없음'])
  })

  it('기본 다음 단계 추천은 강조하지 않는다. 막힘은 blocked_reason을 맨 앞에 둔다 (4.4)', () => {
    expect(
      emphasis({
        node: 'evidence',
        handoff: { ...HANDOFF, recommended_next: { node: 'rca', reason: '다음' } },
        errors: [],
        uncommitted: [],
      }),
    ).toEqual([])
    const blocked = emphasis({
      node: 'rca',
      handoff: { ...HANDOFF, status: 'blocked', blocked_reason: '운영 로그가 없음' },
      errors: [],
      uncommitted: [],
    })
    expect(blocked).toEqual([{ kind: 'blocked', title: '막힘', lines: ['운영 로그가 없음'] }])
  })

  it('handoff의 요약 절을 읽는다. 머리글을 읽지 못해도 본문에서 찾는다', () => {
    const text =
      '---\nstatus: awaiting_approval\n---\n## 요약\n재현됨.\n둘째 줄\n\n## 다음 task가 알아야 할 것\n- x\n'
    expect(handoffSummary(text)).toBe('재현됨.\n둘째 줄')
    expect(handoffSummary('## 요약\n머리글 없음\n')).toBe('머리글 없음')
    expect(handoffSummary('---\nstatus: x\n---\n본문만\n')).toBeNull()
  })
})

describe('판정표 (시나리오 7-3, D59)', () => {
  const text = [
    '## 완료조건 판정',
    '| 완료조건 | 판정 | 근거 |',
    '|---|---|---|',
    '| 재현 절차가 더 이상 실패하지 않는다 | 통과 | `node repro.js` 출력 OK |',
    '| `npm test`가 통과한다 | **통과** | 12 passed |',
    '| 기존 테스트를 약화하거나 삭제하지 않는다 | 실패 | a.test.js의 단언 삭제 \\| 사람 판단: 약화 |',
    '| 운영에서도 맞다 | 판정 불가 | 운영 환경 없음 |',
    '',
    '## 테스트 파일 변경',
    '| 이건 | 다른 | 표 |',
  ].join('\n')

  it('완료조건 판정 절의 행을 읽고 통과가 아니면 경고한다', () => {
    expect(verdicts(text)).toEqual([
      {
        criterion: '재현 절차가 더 이상 실패하지 않는다',
        verdict: '통과',
        basis: '`node repro.js` 출력 OK',
        warn: false,
      },
      { criterion: '`npm test`가 통과한다', verdict: '**통과**', basis: '12 passed', warn: false },
      {
        criterion: '기존 테스트를 약화하거나 삭제하지 않는다',
        verdict: '실패',
        basis: 'a.test.js의 단언 삭제 | 사람 판단: 약화',
        warn: true,
      },
      { criterion: '운영에서도 맞다', verdict: '판정 불가', basis: '운영 환경 없음', warn: true },
    ])
  })

  it('절이나 표가 없으면 빈 목록이다', () => {
    expect(verdicts('## 남은 위험\n- 없음\n')).toEqual([])
    expect(verdicts('## 완료조건 판정\n표 대신 글\n')).toEqual([])
  })
})
