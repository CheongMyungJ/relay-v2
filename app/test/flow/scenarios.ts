// 가짜 claude의 시나리오 (8.2). 스킬마다 단계 목록을 둔다. 산출물과 handoff는 5.2~5.6의 모양이다.
import type { Handoff, NodeName } from '../../src/shared/contracts'
import type { SkillName } from '../../src/shared/config'

export type Step =
  | { do: 'prompt'; text?: string }
  | { do: 'write'; file: string; text: string }
  | { do: 'remove'; file: string }
  | { do: 'commit'; files: Record<string, string>; message: string }
  /** 커밋하지 않고 worktree의 파일을 고친다 (커밋 안 된 변경, D116) */
  | { do: 'edit'; files: Record<string, string> }
  /** 질문 대기. fail이면 답한 뒤 PostToolUse 대신 PostToolUseFailure를 보낸다 */
  | { do: 'ask'; question?: string; fail?: boolean }
  /**
   * 도구 호출: PreToolUse, ms만큼 실행, PostToolUse (D216). input은 tool_input이다. fail이면 PostToolUse 대신
   * PostToolUseFailure를 보낸다. agent가 있으면 서브에이전트 안의 도구라 훅에 agent_id를 넣는다. inner는 이 도구가
   * 도는 동안 할 단계다(Task 도구 안의 서브에이전트)
   */
  | {
      do: 'tool'
      name: string
      input?: Record<string, unknown>
      ms?: number
      fail?: boolean
      agent?: string
      inner?: Step[]
    }
  | { do: 'notify'; type: string }
  /**
   * Stop을 보낸다. background와 crons는 본문의 background_tasks와 session_crons다: 세션이 백그라운드 작업이나 예약된
   * 깨우기를 기다리며 쉬는 중이다 (D129)
   */
  | { do: 'stop'; onBlock?: Step[]; background?: object[]; crons?: object[] }
  | { do: 'exit'; reason?: string; linger?: number }
  /** /clear: 새 세션 id로 계속 돈다 (D110) */
  | { do: 'clear' }
  /** worktree에서 git을 부른다. 정리 세션이 변경을 되돌리거나 커밋하는 것을 흉내 낸다 (7-5) */
  | { do: 'git'; args: string[] }
  | { do: 'sleep'; ms: number }
  | { do: 'print'; text: string }
  | { do: 'wait' }
  | { do: 'waitEnter' }
  /**
   * PR 대응 (5.6.7): context.md의 이번 라운드 항목으로 response.md와, 코멘트 항목마다 replies.md의 절을 쓴다. skip의
   * 항목은 답글을 뺀다. text와 result의 {id}는 항목 id다. 코멘트 항목이 없으면 always일 때만 replies.md를 쓴다
   */
  | { do: 'respond'; text?: string; result?: string; skip?: string[]; always?: boolean }
  /** 앱이 fetch한 원격 PR 브랜치(remote)나 기준 브랜치(base)를 worktree에서 병합한다 (D181, D193) */
  | { do: 'merge'; from: 'remote' | 'base' }

export interface Scenario {
  /** 스킬 이름이나 task id → 단계 */
  tasks: Partial<Record<SkillName | string, Step[]>>
  /** --resume으로 다시 연 세션의 단계. 스킬 이름이나 task id → 단계. 없으면 입력을 기다리기만 한다 */
  resume?: Partial<Record<SkillName | string, Step[]>>
  /** 정리 세션([AI 세션 열기], 7-5)의 단계. 첫 프롬프트 없이 연 세션이다. 없으면 입력을 기다리기만 한다 */
  cleanup?: Step[]
}

// ---------- 시험 레포 ----------

/** 시험 레포: 빈 배열의 평균이 NaN인 버그 하나와 node:test 시험 */
export const REPO_FILES: Record<string, string> = {
  'package.json': `${JSON.stringify({ name: 'sample', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`,
  'src/avg.js':
    'export function avg(xs) {\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n',
  'test/avg.test.js':
    "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { avg } from '../src/avg.js'\n\ntest('평균', () => assert.strictEqual(avg([1, 2, 3]), 2))\n",
}

export const REQUEST = [
  '빈 배열의 평균이 NaN으로 나온다.',
  '',
  '재현: node -e "import(\'./src/avg.js\').then(m => console.log(m.avg([])))" → NaN',
  '기대: 0',
  '의심: 0으로 나누는 부분 같다.',
  '',
].join('\n')

// ---------- 산출물 ----------

export function intentDraft(opts: { omit?: string[]; note?: string } = {}) {
  const sections: [string, string][] = [
    ['목표', '빈 배열의 평균이 NaN이 되는 문제를 고친다.'],
    ['비목표', '- 없음'],
    ['원하는 결과', '빈 배열의 평균은 0이다.'],
    [
      '완료조건',
      [
        '- [ ] 재현 절차가 더 이상 실패하지 않는다',
        '- [ ] `npm test`가 통과한다',
        '- [ ] 기존 테스트를 약화하거나 삭제하지 않는다',
      ].join('\n'),
    ],
    ['추가 의견', '- (사람 추정, 확인 안 됨) 0으로 나누는 부분'],
  ]
  const body = sections
    .filter(([name]) => !opts.omit?.includes(name))
    .map(([name, text]) => `## ${name}\n${text}\n`)
    .join('\n')
  return `---\ntype: bugfix\n---\n${body}${opts.note ? `\n${opts.note}\n` : ''}`
}

const q = (s: string) => JSON.stringify(s)

/** handoff.md. 템플릿(_common.md)의 필드를 모두 쓴다 */
export function handoff(h: Partial<Handoff> & { summary?: string; omit?: string[] } = {}): string {
  const decisions = h.decisions ?? []
  const list = (items: readonly string[] | undefined) =>
    items && items.length ? `\n${items.map((i) => `  - ${q(i)}`).join('\n')}` : ' []'
  const rec = h.recommended_next
  const header = [
    '---',
    `status: ${h.status ?? 'awaiting_approval'}`,
    `blocked_reason:${h.blocked_reason ? ` ${q(h.blocked_reason)}` : ''}`,
    `decisions:${
      decisions.length
        ? `\n${decisions.map((d) => `  - what: ${q(d.what)}\n    why: ${q(d.why)}\n    by: ${d.by}`).join('\n')}`
        : ' []'
    }`,
    `assumptions:${list(h.assumptions)}`,
    `rejected:${list(h.rejected)}`,
    `open_questions:${list(h.open_questions)}`,
    `intent_deviation:${
      h.intent_deviation
        ? `\n  summary: ${q(h.intent_deviation.summary)}\n  evidence: ${q(h.intent_deviation.evidence)}`
        : ' null'
    }`,
    `risks:${list(h.risks)}`,
    `recommended_next:${rec ? `\n  node: ${rec.node}\n  reason: ${q(rec.reason)}` : ' null'}`,
    'knowledge_candidates: []',
    '---',
  ]
  const sections: [string, string][] = [
    ['요약', h.summary ?? '할 일을 마쳤다.'],
    ['다음 task가 알아야 할 것', '- src/avg.js의 avg()'],
  ]
  const body = sections
    .filter(([name]) => !h.omit?.includes(name))
    .map(([name, text]) => `## ${name}\n${text}\n`)
    .join('\n')
  return `${header.join('\n')}\n${body}`
}

/** fix.md의 `## 원인` 절 본문 (5.6.5). 원인 분석과 수정의 [요약] 맨 위에 보인다 (D223) */
export const FIX_CAUSE = [
  '- 원인: 빈 배열에서 합 0을 길이 0으로 나눈다.',
  '- 근거: src/avg.js:2, 재현 출력 NaN. 빈 배열 검사를 넣으면 0이 나온다',
  '- 사람 추정 판정: 0으로 나누는 부분 — 맞음 — src/avg.js:2',
  '- 기각한 가설: reduce 초기값 누락 — 초기값 0이 있음',
].join('\n')

/** fix.md (5.6.5): 재현, 원인, 변경 요약, 재현 테스트, 테스트 실행 */
export const FIX_DOC = [
  '## 재현',
  '- 재현 절차: node -e "import(\'./src/avg.js\').then(m => console.log(m.avg([])))"',
  '- 결과: 재현됨',
  '- 기대: 0',
  '- 실제: NaN',
  '',
  '## 원인',
  FIX_CAUSE,
  '',
  '## 변경 요약',
  '- src/avg.js — 빈 배열이면 0을 돌려준다',
  '',
  '## 재현 테스트',
  '- 위치: test/avg.test.js',
  '- 수정 전: 실패',
  '- 수정 후: 통과',
  '',
  '## 테스트 실행',
  '- 명령: npm test',
  '- 결과: 통과',
  '- 실패 항목: 없음',
  '',
].join('\n')

export const VERIFICATION = [
  '## 완료조건 판정',
  '| 완료조건 | 판정 | 근거 |',
  '|---|---|---|',
  '| 재현 절차가 더 이상 실패하지 않는다 | 통과 | 0 출력 |',
  '| `npm test`가 통과한다 | 통과 | 2 passed |',
  '| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 시험 추가만 |',
  '',
  '## 테스트 파일 변경',
  '- test/avg.test.js — 약화 아님 — 시험 추가',
  '',
  '## 남은 위험',
  '- 없음',
  '',
].join('\n')

/** review.md의 `## 지적` 절 본문 (5.6.6) */
export const REVIEW_FINDINGS = [
  '1. [권장] src/avg.js:2 — 빈 배열에 0을 돌려주는 까닭을 주석으로 남긴다',
  '2. [사소] test/avg.test.js:6 — 시험 이름을 "빈 배열은 0"으로 바꾼다',
].join('\n')

/** review.md (5.6.6): 지적을 번호로 썼고 사람이 반영할 지적을 고르지 않았다 */
export const REVIEW = [
  '## 지적',
  REVIEW_FINDINGS,
  '',
  '## 반영',
  '없음',
  '',
  '## 반영하지 않은 지적',
  '- 1',
  '- 2',
  '',
].join('\n')

/** 지적이 없는 review.md (5.6.6) */
export const REVIEW_NONE = [
  '## 지적',
  '없음',
  '',
  '## 반영',
  '없음',
  '',
  '## 반영하지 않은 지적',
  '없음',
  '',
].join('\n')

/** review.md의 `## 반영` 절 본문: 사람이 1번만 반영하라고 고른 뒤 (5.6.6) */
export const REVIEW_APPLIED_TEXT = '- 1 — 주석을 더했다, 커밋 "verify: 빈 배열 주석", npm test 통과'

/** 사람이 질문에 답해 1번만 반영한 뒤의 review.md (5.6.6) */
export const REVIEW_APPLIED = [
  '## 지적',
  REVIEW_FINDINGS,
  '',
  '## 반영',
  REVIEW_APPLIED_TEXT,
  '',
  '## 반영하지 않은 지적',
  '- 2',
  '',
].join('\n')

/** 리뷰와 검증이 사람이 고른 지적(1번)을 고친 코드 */
export const REVIEWED_FILES = {
  'src/avg.js':
    'export function avg(xs) {\n  // 빈 배열의 평균은 0으로 정했다\n  if (xs.length === 0) return 0\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n',
}

export const PR = '# 빈 배열의 평균을 0으로\n\n## 요약\n## 원인\n## 변경\n## 테스트\n'

export const FIXED_FILES = {
  'src/avg.js':
    'export function avg(xs) {\n  if (xs.length === 0) return 0\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n',
  'test/avg.test.js':
    "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { avg } from '../src/avg.js'\n\ntest('평균', () => assert.strictEqual(avg([1, 2, 3]), 2))\ntest('빈 배열', () => assert.strictEqual(avg([]), 0))\n",
}

// ---------- 노드마다의 기본 단계 ----------

const decision = (what: string, by: 'ai' | 'human' = 'ai') => ({ what, why: `${what}인 이유`, by })

export function steps(node: NodeName): Step[] {
  switch (node) {
    case 'intake':
      return [
        { do: 'prompt' },
        { do: 'write', file: 'intent.draft.md', text: intentDraft() },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('빈 배열의 평균은 0')],
            summary: '의도 초안을 썼다.',
          }),
        },
        { do: 'stop' },
      ]
    case 'fix':
      // 재현, 원인 분석, 수정을 한 세션에서 한다 (5.6.5, D228). 원인이 분명해 묻지 않는다
      return [
        { do: 'prompt' },
        { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
        { do: 'write', file: 'fix.md', text: FIX_DOC },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('원인은 0으로 나눔'), decision('빈 배열 검사를 앞에 둔다')],
            rejected: ['reduce 초기값 누락: 초기값이 있음'],
            summary: '재현됨. 원인은 0으로 나눔. 빈 배열 검사를 넣어 커밋했다.',
          }),
        },
        { do: 'stop' },
      ]
    case 'verify':
      // 리뷰에 지적이 없어 묻지 않고 판정한다 (5.6.6, D229)
      return [
        { do: 'prompt' },
        { do: 'write', file: 'review.md', text: REVIEW_NONE },
        { do: 'write', file: 'verification.md', text: VERIFICATION },
        { do: 'write', file: 'pr.md', text: PR },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({ decisions: [decision('완료조건을 모두 통과')] }),
        },
        { do: 'stop' },
      ]
  }
}

/**
 * 재현 방법을 사람에게 묻는 원인 분석과 수정 (5.6.5의 사람 결정). 질문 대기에 답하면 나머지는 기본 단계와 같다.
 * 사람의 답은 by: human 결정으로 남긴다
 */
export function fixAsking(): Step[] {
  return [
    { do: 'prompt' },
    { do: 'ask', question: '재현 방법' },
    ...steps('fix')
      .slice(1)
      .map((st) =>
        st.do === 'write' && st.file === 'handoff.md'
          ? {
              ...st,
              text: handoff({
                decisions: [
                  decision('재현 명령은 node -e', 'human'),
                  decision('원인은 0으로 나눔'),
                  decision('빈 배열 검사를 앞에 둔다'),
                ],
                rejected: ['캐시 가설: 캐시가 없음', 'reduce 초기값 누락: 초기값이 있음'],
                summary: '재현됨. 원인은 0으로 나눔. 빈 배열 검사를 넣어 커밋했다.',
              }),
            }
          : st,
      ),
  ]
}

/**
 * 리뷰에 지적 둘을 쓰고 AskUserQuestion으로 반영할 지적을 물은 뒤(5.6.6, D229), 사람이 고른 1번만 고쳐 커밋하고
 * 판정과 PR 초안을 써서 한 번 마무리한다. 사람 역할(driver)은 질문에 첫 선택지로 답한다
 */
export function verifyApplied(): Step[] {
  return [
    { do: 'prompt' },
    { do: 'write', file: 'review.md', text: REVIEW },
    { do: 'ask', question: '반영할 지적' },
    { do: 'commit', files: REVIEWED_FILES, message: 'verify: 빈 배열 주석' },
    { do: 'write', file: 'review.md', text: REVIEW_APPLIED },
    { do: 'write', file: 'verification.md', text: VERIFICATION },
    { do: 'write', file: 'pr.md', text: PR },
    {
      do: 'write',
      file: 'handoff.md',
      text: handoff({
        decisions: [
          { what: '지적 1 반영', why: '사람이 질문에서 고름', by: 'human' },
          { what: '지적 2 반영 안 함', why: '사람이 고르지 않음', by: 'human' },
          decision('완료조건을 모두 통과'),
        ],
        summary: '1번 지적을 반영해 커밋했다. 2번은 반영하지 않았다. 완료조건을 모두 통과했다.',
      }),
    },
    { do: 'stop' },
  ]
}

/** 기본 시나리오 (3.1): intake → fix → verify. 모든 Work가 이 경로를 지난다 (D227) */
export function scenario(override: Partial<Record<SkillName, Step[]>> = {}): Scenario {
  return {
    tasks: {
      'work-start': steps('intake'),
      fix: steps('fix'),
      verify: steps('verify'),
      ...override,
    },
  }
}
