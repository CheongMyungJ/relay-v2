import { describe, expect, it } from 'vitest'
import { createWork } from '../../src/core/machine'
import {
  TASK_STATUS_LABEL,
  bandText,
  emphasis,
  handoffSummary,
  permissionNotice,
  stopNotice,
  taskLabel,
  verdicts,
} from '../../src/core/review'
import type { Handoff } from '../../src/shared/contracts'
import type { FormatIssue, TaskStatus } from '../../src/shared/work'

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
