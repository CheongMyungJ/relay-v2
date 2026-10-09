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
  /** 곁 세션(시나리오 11, I127)의 단계. --append-system-prompt-file로 연 세션이다. 없으면 입력을 기다리기만 한다 */
  side?: Step[]
  /** --resume으로 다시 연 곁 세션의 단계 */
  sideResume?: Step[]
  /** 가짜 codex의 곁 세션만의 단계 (있으면 side·sideResume 대신). 가짜 codex의 단계는 Step 밖의 것도 있다 */
  sideCodex?: object[]
  sideResumeCodex?: object[]
  /** 지식 검토 호출(claude -p, D300)의 n번째 결과. 없으면 문제 없음 */
  review?: { issues: { file: string; kind: string; quote: string; fix: string }[] }[]
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
  // 머리글은 없다: 유형과 버전은 앱이 의도 승인 때 붙인다 (D236, I58)
  return `${body}${opts.note ? `\n${opts.note}\n` : ''}`
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

/** verification.md의 판정 절들 (5.6.6): 완료조건 판정, 테스트 파일 변경, 남은 위험 */
export const VERDICTS = [
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

/** verification.md의 `## 리뷰 지적` 절 본문 (5.6.6) */
export const REVIEW_FINDINGS = [
  '1. [권장] src/avg.js:2 — 빈 배열에 0을 돌려주는 까닭을 주석으로 남긴다',
  '2. [사소] test/avg.test.js:6 — 시험 이름을 "빈 배열은 0"으로 바꾼다',
].join('\n')

/** verification.md의 리뷰 절들 (5.6.6, D229): 지적을 번호로 썼고 사람이 반영할 지적을 고르지 않았다 */
export const REVIEW = [
  '## 리뷰 지적',
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

/** 지적이 없는 리뷰 절들 (5.6.6) */
export const REVIEW_NONE = [
  '## 리뷰 지적',
  '없음',
  '',
  '## 반영',
  '없음',
  '',
  '## 반영하지 않은 지적',
  '없음',
  '',
].join('\n')

/** verification.md의 `## 반영` 절 본문: 사람이 1번만 반영하라고 고른 뒤 (5.6.6) */
export const REVIEW_APPLIED_TEXT = '- 1 — 주석을 더했다, 커밋 "verify: 빈 배열 주석", npm test 통과'

/** 사람이 질문에 답해 1번만 반영한 뒤의 리뷰 절들 (5.6.6) */
export const REVIEW_APPLIED = [
  '## 리뷰 지적',
  REVIEW_FINDINGS,
  '',
  '## 반영',
  REVIEW_APPLIED_TEXT,
  '',
  '## 반영하지 않은 지적',
  '- 2',
  '',
].join('\n')

/** 지적이 없는 리뷰와 판정을 담은 verification.md (5.6.6, D229) */
export const VERIFICATION = REVIEW_NONE + VERDICTS

/** 리뷰와 검증이 사람이 고른 지적(1번)을 고친 코드 */
export const REVIEWED_FILES = {
  'src/avg.js':
    'export function avg(xs) {\n  // 빈 배열의 평균은 0으로 정했다\n  if (xs.length === 0) return 0\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n',
}

export const PR = '# 빈 배열의 평균을 0으로\n\n## 요약\n## 원인\n## 변경\n## 테스트\n'

// ---------- 기능 추가 (D232) ----------

/** 기능 추가 요청: 중앙값 함수를 더한다 */
export const FEATURE_REQUEST = [
  '배열의 중앙값을 구하는 median(xs)을 src/avg.js에 더해 주세요.',
  '',
  '빈 배열이면 0을 돌려주면 좋겠습니다.',
  '',
].join('\n')

/** 기능 추가 intent 초안 (5.3, D239, D240). 머리글이 없다 */
export function featureIntentDraft(opts: { note?: string } = {}) {
  const sections: [string, string][] = [
    ['목표', '배열의 중앙값을 구하는 median(xs)을 더한다.'],
    ['비목표', '- 없음'],
    ['원하는 결과', '홀수·짝수 길이 배열과 빈 배열의 중앙값을 돌려준다.'],
    [
      '완료조건',
      [
        '- [ ] `npm test`가 통과한다',
        '- [ ] 기존 테스트를 약화하거나 삭제하지 않는다',
        '- [ ] 완료조건의 각 동작을 확인하는 테스트가 있다',
        '- [ ] 홀수 길이 배열이면 가운데 값을 돌려준다',
        '- [ ] 빈 배열이면 0을 돌려준다',
      ].join('\n'),
    ],
  ]
  const body = sections.map(([name, text]) => `## ${name}\n${text}\n`).join('\n')
  return `${body}${opts.note ? `\n${opts.note}\n` : ''}`
}

/** design.md의 `## 유저 시나리오`와 `## 요구사항` 본문 (5.6.8, D244). 설계와 계획의 [요약] 맨 위에 보인다 (D223) */
export const DESIGN_SCENARIO =
  '1. 통계 코드를 쓰는 개발자가 배열의 중앙값을 구하려고 median(xs)을 부른다'
export const DESIGN_REQUIREMENTS = [
  '### 기능',
  '- F1. 홀수 길이 배열이면 가운데 값을 돌려준다 — 출처: 완료조건 4',
  '- F2. 빈 배열이면 0을 돌려준다 — 출처: 완료조건 5',
  '### 비기능',
  '없음',
].join('\n')

/** design.md (5.6.8, D244): 일곱 절 */
export const DESIGN_DOC = [
  '## 유저 시나리오',
  DESIGN_SCENARIO,
  '',
  '## 요구사항',
  DESIGN_REQUIREMENTS,
  '',
  '## 접근',
  '- 방식: 정렬한 사본의 가운데 값',
  '- 고려한 대안: 없음',
  '- 사람 제안 판정: 없음',
  '',
  '## 바뀌는 곳',
  '- src/avg.js — median(xs)를 내보낸다',
  '',
  '## 구현 계획',
  '1. median 더하기 — src/avg.js — F1, F2',
  '',
  '## 테스트 계획',
  '| 요구사항 | 테스트 위치와 방식 |',
  '|---|---|',
  '| F1, F2 | test/avg.test.js, node:test |',
  '',
  '## 위험',
  '- 없음',
  '',
].join('\n')

/** implement.md의 `## 계획과 달라진 점` 본문 (5.6.9, D250). 구현의 [요약] 맨 위에 보인다 (D223) */
export const IMPLEMENT_CHANGES = '- 짝수 길이 배열은 가운데 두 값의 평균으로 했다'

/** implement.md (5.6.9, D250): 네 절 */
export const IMPLEMENT_DOC = [
  '## 변경 요약',
  '- 계획 단계 1 — src/avg.js — median을 더했다, 커밋 "feat: median"',
  '',
  '## 계획과 달라진 점',
  IMPLEMENT_CHANGES,
  '',
  '## 새 동작 테스트',
  '| 완료조건 | 테스트 위치 | 구현 전 | 구현 후 |',
  '|---|---|---|---|',
  '| 홀수 길이 배열이면 가운데 값 | test/avg.test.js | 실패 | 통과 |',
  '| 빈 배열이면 0 | test/avg.test.js | 실패 | 통과 |',
  '',
  '## 테스트 실행',
  '- 명령: npm test',
  '- 결과: 통과',
  '- 실패 항목: 없음',
  '',
].join('\n')

/** 구현이 먼저 커밋하는 새 동작 테스트 (D247). 구현 전에는 실패한다 */
export const FEATURE_TEST_FILES = {
  'test/median.test.js':
    "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { median } from '../src/avg.js'\n\ntest('홀수 길이', () => assert.strictEqual(median([3, 1, 2]), 2))\ntest('빈 배열', () => assert.strictEqual(median([]), 0))\n",
}

/** 구현이 테스트 뒤에 커밋하는 코드 */
export const FEATURE_FILES = {
  'src/avg.js':
    'export function avg(xs) {\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n\nexport function median(xs) {\n  if (xs.length === 0) return 0\n  const s = [...xs].sort((a, b) => a - b)\n  const m = Math.floor(s.length / 2)\n  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2\n}\n',
}

/** 기능 추가 verification.md의 판정 절 (5.6.6, D251) */
export const FEATURE_VERDICTS = [
  '## 완료조건 판정',
  '| 완료조건 | 판정 | 근거 |',
  '|---|---|---|',
  '| `npm test`가 통과한다 | 통과 | 3 passed |',
  '| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 시험 추가만 |',
  '| 완료조건의 각 동작을 확인하는 테스트가 있다 | 통과 | test/median.test.js |',
  '| 홀수 길이 배열이면 가운데 값을 돌려준다 | 통과 | 홀수 길이 시험 |',
  '| 빈 배열이면 0을 돌려준다 | 통과 | 빈 배열 시험 |',
  '',
  '## 테스트 파일 변경',
  '- test/median.test.js — 약화 아님 — 새 파일',
  '',
  '## 남은 위험',
  '- 없음',
  '',
].join('\n')

/** 기능 추가 pr.md (D252) */
export const FEATURE_PR =
  '# 배열의 중앙값 median 추가\n\n## 요약\n## 동작\n## 주요 설계 결정\n## 변경\n## 테스트\n'

export const FIXED_FILES = {
  'src/avg.js':
    'export function avg(xs) {\n  if (xs.length === 0) return 0\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n',
  'test/avg.test.js':
    "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { avg } from '../src/avg.js'\n\ntest('평균', () => assert.strictEqual(avg([1, 2, 3]), 2))\ntest('빈 배열', () => assert.strictEqual(avg([]), 0))\n",
}

export const REFACTOR_REQUEST = [
  'src/avg.js의 합계 계산을 src/sum.js의 sum(xs)으로 빼 주세요.',
  '',
  '동작은 그대로여야 합니다.',
  '',
].join('\n')

/** 리팩터링 intent 초안 (5.3, D264, D266). 머리글이 없다 */
export function refactorIntentDraft() {
  const sections: [string, string][] = [
    ['목표', '합계 계산을 sum 하나로 모은다.'],
    ['비목표', '- 빈 배열의 평균(NaN) 고치기'],
    ['원하는 결과', 'avg의 동작은 그대로이고 합계는 src/sum.js에서만 계산한다.'],
    [
      '완료조건',
      [
        '- [ ] `npm test`가 통과한다',
        '- [ ] 기존 테스트를 약화하거나 삭제하지 않는다',
        '- [ ] 바꾼 곳의 지금 동작을 잡는 안전망 테스트가 있고 기준 코드에서도 통과한다',
        '- [ ] 레포 밖 공개 인터페이스가 바뀌지 않는다',
        '- [ ] 합계는 src/sum.js의 sum 한 곳에서만 계산한다',
      ].join('\n'),
    ],
  ]
  return sections.map(([name, text]) => `## ${name}\n${text}\n`).join('\n')
}

/** 리팩터링 verification.md의 판정 절 (5.6.6, D273) */
export const REFACTOR_VERDICTS = [
  '## 완료조건 판정',
  '| 완료조건 | 판정 | 근거 |',
  '|---|---|---|',
  '| `npm test`가 통과한다 | 통과 | 3 passed |',
  '| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 시험 추가만 |',
  '| 바꾼 곳의 지금 동작을 잡는 안전망 테스트가 있고 기준 코드에서도 통과한다 | 통과 | 안전망 커밋과 마지막 코드에서 통과 |',
  '| 레포 밖 공개 인터페이스가 바뀌지 않는다 | 통과 | avg의 export 그대로 |',
  '| 합계는 src/sum.js의 sum 한 곳에서만 계산한다 | 통과 | reduce는 src/sum.js에만 |',
  '',
  '## 테스트 파일 변경',
  '- test/avg-safety.test.js — 약화 아님 — 새 파일',
  '',
  '## 남은 위험',
  '- 없음',
  '',
].join('\n')

/** refactor.md의 `## 계획` 본문 (5.6.10, D272). 계획과 리팩터링의 [요약] 맨 위에 보인다 (D278) */
export const REFACTOR_PLAN = [
  '- 목표 구조: 합계는 src/sum.js의 sum 하나에서만 계산한다',
  '- 고려한 대안: 없음',
  '- 사람 제안 판정: 없음',
  '- 단계: 1. sum 추출 — 완료조건 5',
].join('\n')

/** refactor.md (5.6.10, D272): 다섯 절. 안전망 커밋 해시 줄은 I64 */
export const REFACTOR_DOC = [
  '## 계획',
  REFACTOR_PLAN,
  '',
  '## 안전망 테스트',
  '- 안전망 커밋: (안전망 커밋)',
  '| 바꾸는 곳 | 테스트 위치(기존 / 새로) | 잡는 동작 | 기준 코드 |',
  '|---|---|---|---|',
  '| avg | test/avg-safety.test.js(새로) | 평균 | 통과 |',
  '',
  '## 변경 요약',
  '- 단계 1 — src/sum.js, src/avg.js — sum 추출, 커밋 "refactor: sum 추출"',
  '',
  '## 찾은 버그와 받아들인 차이',
  '- (찾은 버그) src/avg.js — 빈 배열이면 NaN — 고치지 않음',
  '',
  '## 테스트 실행',
  '- 명령: npm test',
  '- 결과: 커밋마다 통과',
  '- 실패 항목: 없음',
  '',
].join('\n')

/** 계획과 리팩터링이 구조를 바꾸기 전에 커밋하는 안전망 테스트 (D259). 기준 코드에서 통과한다 */
export const REFACTOR_SAFETY_FILES = {
  'test/avg-safety.test.js':
    "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { avg } from '../src/avg.js'\n\ntest('평균 (안전망)', () => assert.strictEqual(avg([2, 4]), 3))\n",
}

/** 안전망 뒤에 커밋하는 구조 변경. 동작은 그대로다 (D260) */
export const REFACTOR_FILES = {
  'src/sum.js': 'export function sum(xs) {\n  return xs.reduce((a, b) => a + b, 0)\n}\n',
  'src/avg.js':
    "import { sum } from './sum.js'\n\nexport function avg(xs) {\n  return sum(xs) / xs.length\n}\n",
}

/** 리팩터링 pr.md (D274) */
export const REFACTOR_PR =
  '# 합계 계산을 sum으로 추출\n\n## 요약\n## 목표 구조\n## 동작 보존\n## 변경\n## 찾은 버그\n## 테스트\n'

export const GENERAL_REQUEST = [
  'README.md에 테스트를 돌리는 명령과 avg 쓰는 법을 적어 주세요.',
  '',
].join('\n')

/** 일반 intent 초안의 확인 방법 줄 (D305). 셋째 줄은 사람이 확인한다 (D306) */
export const GENERAL_CRITERIA = [
  '- [ ] `npm test`가 통과한다 — 확인: `npm test`',
  '- [ ] 기존 테스트를 약화하거나 삭제하지 않는다 — 확인: 기준 커밋과 테스트 파일 diff',
  '- [ ] README.md에 테스트 실행 명령이 있다 — 확인: README.md',
  '- [ ] README의 avg 설명이 처음 보는 사람에게 읽힌다 — 확인: 사람',
]

/**
 * 일반 intent 초안 (5.3, D304, D305). 머리글이 없다. noCheck면 셋째 완료조건의 확인 방법을 빼 형식 오류를 낸다 (I86)
 */
export function generalIntentDraft(opts: { noCheck?: boolean } = {}) {
  const criteria = GENERAL_CRITERIA.map((line, i) =>
    opts.noCheck && i === 2 ? line.replace(/ — 확인: .*$/, '') : line,
  )
  const sections: [string, string][] = [
    ['목표', 'README.md에 테스트 명령과 avg 쓰는 법을 적는다.'],
    ['비목표', '- avg의 동작 바꾸기'],
    ['원하는 결과', '처음 보는 사람이 README만 읽고 테스트를 돌리고 avg를 쓴다.'],
    ['완료조건', criteria.join('\n')],
  ]
  return sections.map(([name, text]) => `## ${name}\n${text}\n`).join('\n')
}

/** 일반 verification.md의 판정 절 (5.6.6, D311, D312). 사람 확인 항목은 근거에 "사람 확인"을 적는다 */
export const GENERAL_VERDICTS = [
  '## 완료조건 판정',
  '| 완료조건 | 판정 | 근거 |',
  '|---|---|---|',
  '| `npm test`가 통과한다 | 통과 | 1 passed |',
  '| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 테스트 파일 변경 없음 |',
  '| README.md에 테스트 실행 명령이 있다 | 통과 | README.md에 npm test |',
  '| README의 avg 설명이 처음 보는 사람에게 읽힌다 | 통과 | 사람 확인: 읽힌다 |',
  '',
  '## 테스트 파일 변경',
  '- 없음',
  '',
  '## 남은 위험',
  '- 없음',
  '',
].join('\n')

/** execution.md의 `## 계획` 본문 (5.6.11, D310). 실행의 [요약] 맨 위에 보인다 (D318) */
export const EXECUTION_PLAN = [
  '- 할 일: README.md를 새로 쓰고 테스트 명령과 avg 예시를 적는다',
  '- 고려한 대안: 없음',
  '- 사람 제안 판정: 없음',
].join('\n')

/** execution.md의 `## 완료조건별 자체 확인` 본문 (D310) */
export const EXECUTION_SELF_CHECK = [
  '| 완료조건 | 한 일 | 확인 결과 |',
  '|---|---|---|',
  '| `npm test`가 통과한다 | — | `npm test` 실행, 통과 |',
  '| 기존 테스트를 약화하거나 삭제하지 않는다 | — | 테스트 파일 변경 없음 |',
  '| README.md에 테스트 실행 명령이 있다 | README.md를 씀 | README.md에 npm test |',
  '| README의 avg 설명이 처음 보는 사람에게 읽힌다 | 예시를 둠 | 사람이 볼 곳: README.md |',
].join('\n')

/** execution.md (5.6.11, D310): 네 절 */
export const EXECUTION_DOC = [
  '## 계획',
  EXECUTION_PLAN,
  '',
  '## 변경 요약',
  '- README.md — 테스트 명령과 avg 예시, 커밋 "docs: README"',
  '',
  '## 완료조건별 자체 확인',
  EXECUTION_SELF_CHECK,
  '',
  '## 테스트 실행',
  '- 명령: npm test',
  '- 결과: 통과',
  '- 실패 항목: 없음',
  '',
].join('\n')

/** 실행이 커밋하는 변경 (D309) */
export const GENERAL_FILES = {
  'README.md': '# sample\n\n테스트: `npm test`\n\n```js\navg([1, 2, 3]) // 2\n```\n',
}

/** 일반 pr.md (D313) */
export const GENERAL_PR =
  '# README에 테스트 명령과 avg 예시\n\n## 요약\n## 주요 결정\n## 변경\n## 테스트\n'

// ---------- 설계 (D350) ----------

export const SPEC_REQUEST = [
  'avg에 가중 평균을 더하려고 한다. 구현 전에 설계만 정해서 docs/design/weighted-avg.md에 남겨 주세요.',
  '정할 것: 가중치를 받는 모양, 가중치 합이 0일 때.',
  '',
].join('\n')

/** 설계 대상 문서 (D351). intake가 `제약`에 적는다 */
export const SPEC_DOC_PATH = 'docs/design/weighted-avg.md'

/** 설계 intent 초안 (5.3, D354, D355, D356): "정한다" 항목, 기본 항목 셋, 확인 방법 없음, 대상 문서는 `제약` */
export function specIntentDraft() {
  const sections: [string, string][] = [
    ['목표', 'avg의 가중 평균 설계를 정해 설계 문서로 남긴다.'],
    ['비목표', '- 구현'],
    ['원하는 결과', '구현 Work가 문서만 읽고 가중 평균을 만든다.'],
    [
      '완료조건',
      [
        '- [ ] 대상 문서와 지식 파일 밖의 파일을 바꾸지 않는다',
        '- [ ] 문서의 서술이 서로, 그리고 지금 코드와 어긋나지 않는다',
        '- [ ] 정하지 않고 남긴 것은 문서의 따로 둔 절에 이유와 함께 있다',
        '- [ ] 가중치를 받는 모양을 정한다',
        '- [ ] 가중치 합이 0일 때를 정한다',
      ].join('\n'),
    ],
    ['제약', `- 설계 문서: \`${SPEC_DOC_PATH}\` (새 문서)`],
  ]
  return sections.map(([name, text]) => `## ${name}\n${text}\n`).join('\n')
}

/** spec이 커밋하는 설계 문서 (D359의 새 문서 템플릿). 코드 파일은 바꾸지 않는다 (D350) */
export const SPEC_DOC_FILES = {
  [SPEC_DOC_PATH]: [
    '# 가중 평균',
    '',
    '## 개요',
    'avg에 가중 평균 weightedAvg를 더한다. 구현은 이 문서를 따르는 Work가 한다.',
    '',
    '## 결정',
    '| # | 결정 | 이유 | 사람 결정 |',
    '|---|---|---|---|',
    '| 1 | 값과 가중치를 따로 받는다: `weightedAvg(xs, ws)` | avg와 같은 모양 | 사람 |',
    '| 2 | 가중치 합이 0이면 0을 돌려준다 | avg([])와 맞춤 | 사람 |',
    '| 3 | 파일은 `src/weighted-avg.js` | 레포 관례 | 사람이 정하지 않음 |',
    '',
    '## 정하지 않은 것',
    '- 없음',
    '',
    '## 변경 이력',
    '- 처음 씀',
    '',
  ].join('\n'),
}

/** spec.md의 `## 주제 목록` 본문 (5.6.12, D357, D366). 설계 문답의 [요약] 맨 위에 보인다 (D374) */
export const SPEC_TOPICS = [
  '1. 가중치를 받는 모양 — 정함',
  '2. 가중치 합이 0일 때 — 정함',
  '3. 구현 나눔 — 사람이 뺌',
].join('\n')

/** spec.md (5.6.12): 네 절 */
export const SPEC_DOC = [
  '## 주제 목록',
  SPEC_TOPICS,
  '',
  '## 문답 기록',
  '### 주제 1. 가중치를 받는 모양',
  `- 값과 가중치를 따로 받나 — 추천과 같음 — ${SPEC_DOC_PATH} 결정 1`,
  '### 주제 2. 가중치 합이 0일 때',
  `- 0을 돌려주나 — 추천과 같음 — ${SPEC_DOC_PATH} 결정 2`,
  '',
  '## 확인한 것',
  '- avg([])의 값 — src/avg.js를 읽음 — 빈 배열은 NaN(이번 설계 밖)',
  '',
  '## 문서 변경',
  `- ${SPEC_DOC_PATH} — 새 문서, 결정 1~3, 커밋 "docs: 가중 평균 설계"`,
  '',
].join('\n')

/** spec handoff의 결정: 주제마다 사람이 고른 것과 문서로 옮기며 정한 세부 (D358) */
export const SPEC_DECISIONS = [
  { what: '값과 가중치를 따로 받는다', why: '주제 1에서 사람이 고름', by: 'human' as const },
  { what: '가중치 합이 0이면 0', why: '주제 2에서 사람이 고름', by: 'human' as const },
  { what: '파일은 src/weighted-avg.js', why: '레포 관례', by: 'ai' as const },
]

/** 설계 verification.md의 `## 다시 볼 결정` 본문 (D362). Work 완료 화면에 보인다 (I106) */
export const SPEC_REVISIT =
  '- 결정 2: 가중치 합이 0이면 오류를 내는 대안도 있다 — 조용히 0이 되면 입력 실수를 놓친다'

/** 설계 verification.md (5.6.6, D362~D364, D374): 일곱 절. 테스트 파일 변경 대신 문서 밖 파일 변경 */
export function specVerification(revisit = SPEC_REVISIT) {
  return [
    REVIEW_NONE,
    '## 완료조건 판정',
    '| 완료조건 | 판정 | 근거 |',
    '|---|---|---|',
    '| 대상 문서와 지식 파일 밖의 파일을 바꾸지 않는다 | 통과 | 기준 커밋과의 diff에 대상 문서만 |',
    '| 문서의 서술이 서로, 그리고 지금 코드와 어긋나지 않는다 | 통과 | src/avg.js와 맞음 |',
    '| 정하지 않고 남긴 것은 문서의 따로 둔 절에 이유와 함께 있다 | 통과 | 정하지 않은 것: 없음 |',
    '| 가중치를 받는 모양을 정한다 | 통과 | 결정 1 |',
    '| 가중치 합이 0일 때를 정한다 | 통과 | 결정 2 |',
    '',
    '## 문서 밖 파일 변경',
    '- 없음',
    '',
    '## 다시 볼 결정',
    revisit,
    '',
    '## 남은 위험',
    '- 없음',
    '',
  ].join('\n')
}

/** 설계 pr.md (D364) */
export const SPEC_PR =
  '# 가중 평균 설계\n\n## 요약\n## 주요 결정\n## 다시 볼 결정\n## 정하지 않은 것\n## 변경\n'

// ---------- 노드마다의 기본 단계 ----------

const decision = (what: string, by: 'ai' | 'human' = 'ai') => ({ what, why: `${what}인 이유`, by })

export function steps(node: NodeName): Step[] {
  switch (node) {
    case 'extract':
      // 요구사항 추출의 extract는 세션을 띄우지 않고 앱이 run을 돌린다 (결정 92)
      return []
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
    case 'design':
      // 사람이 정할 결정이 없어 묻지 않고 design.md를 쓴다 (5.6.8, D242). 코드는 바꾸지 않는다 (D243)
      return [
        { do: 'prompt' },
        { do: 'write', file: 'design.md', text: DESIGN_DOC },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('정렬한 사본의 가운데 값')],
            summary: '설계와 구현 계획을 썼다.',
          }),
        },
        { do: 'stop' },
      ]
    case 'implement':
      // 새 동작 테스트를 먼저 커밋하고 구현을 커밋한다 (5.6.9, D247)
      return [
        { do: 'prompt' },
        { do: 'commit', files: FEATURE_TEST_FILES, message: 'test: median' },
        { do: 'commit', files: FEATURE_FILES, message: 'feat: median' },
        { do: 'write', file: 'implement.md', text: IMPLEMENT_DOC },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('짝수 길이는 가운데 두 값의 평균')],
            summary: '테스트를 먼저 쓰고 median을 구현해 커밋했다.',
          }),
        },
        { do: 'stop' },
      ]
    case 'refactor':
      // 사람이 정할 결정이 없어 묻지 않는다 (5.6.10, D267). 안전망을 먼저 커밋하고 단계마다 커밋한다 (D259, D269)
      return [
        { do: 'prompt' },
        { do: 'commit', files: REFACTOR_SAFETY_FILES, message: 'test: avg 안전망' },
        { do: 'commit', files: REFACTOR_FILES, message: 'refactor: sum 추출' },
        { do: 'write', file: 'refactor.md', text: REFACTOR_DOC },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('합계는 sum 하나에서 계산')],
            summary: '안전망을 커밋하고 sum을 추출해 커밋했다.',
          }),
        },
        { do: 'stop' },
      ]
    case 'spec':
      // 기본 단계는 묻지 않고 설계 문서를 커밋한다. 주제 목록과 질문 묶음을 묻는 것은 specAsking()이다 (5.6.12)
      return [
        { do: 'prompt' },
        { do: 'commit', files: SPEC_DOC_FILES, message: 'docs: 가중 평균 설계' },
        { do: 'write', file: 'spec.md', text: SPEC_DOC },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({ decisions: SPEC_DECISIONS, summary: '설계 문서를 쓰고 커밋했다.' }),
        },
        { do: 'stop' },
      ]
    case 'execute':
      // 사람이 정할 결정이 없어 묻지 않는다 (5.6.11, D308). 커밋 단위는 정하지 않는다 (D309)
      return [
        { do: 'prompt' },
        { do: 'commit', files: GENERAL_FILES, message: 'docs: README' },
        { do: 'write', file: 'execution.md', text: EXECUTION_DOC },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('README에 예시 하나')],
            summary: 'README.md를 쓰고 커밋했다. 완료조건마다 확인 방법을 돌렸다.',
          }),
        },
        { do: 'stop' },
      ]
    case 'verify':
      // 리뷰에 지적이 없어 묻지 않고 판정한다 (5.6.6, D229)
      return [
        { do: 'prompt' },
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
    // 리뷰 절을 먼저 써 두면 사람이 고르는 동안 [산출물]에서 지적을 본다
    { do: 'write', file: 'verification.md', text: REVIEW },
    { do: 'ask', question: '반영할 지적' },
    { do: 'commit', files: REVIEWED_FILES, message: 'verify: 빈 배열 주석' },
    { do: 'write', file: 'verification.md', text: REVIEW_APPLIED + VERDICTS },
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

/**
 * 기능 추가 시나리오 (3.1, D232): intake → design → implement → verify. intent 초안과 verify의 판정, PR 초안을 기능
 * 추가의 모양으로 바꾼다
 */
export function featureScenario(override: Partial<Record<SkillName, Step[]>> = {}): Scenario {
  const intake = steps('intake').map((st) =>
    st.do === 'write' && st.file === 'intent.draft.md' ? { ...st, text: featureIntentDraft() } : st,
  )
  const verify = steps('verify').map((st) =>
    st.do === 'write' && st.file === 'verification.md'
      ? { ...st, text: REVIEW_NONE + FEATURE_VERDICTS }
      : st.do === 'write' && st.file === 'pr.md'
        ? { ...st, text: FEATURE_PR }
        : st,
  )
  return {
    tasks: {
      'work-start': intake,
      design: steps('design'),
      implement: steps('implement'),
      verify,
      ...override,
    },
  }
}

/** 리팩터링 시나리오 (3.1, D258): intake → refactor → verify */
export function refactorScenario(override: Partial<Record<SkillName, Step[]>> = {}): Scenario {
  const intake = steps('intake').map((st) =>
    st.do === 'write' && st.file === 'intent.draft.md'
      ? { ...st, text: refactorIntentDraft() }
      : st,
  )
  const verify = steps('verify').map((st) =>
    st.do === 'write' && st.file === 'verification.md'
      ? { ...st, text: REVIEW_NONE + REFACTOR_VERDICTS }
      : st.do === 'write' && st.file === 'pr.md'
        ? { ...st, text: REFACTOR_PR }
        : st,
  )
  return {
    tasks: {
      'work-start': intake,
      refactor: steps('refactor'),
      verify,
      ...override,
    },
  }
}

/** 일반 시나리오 (3.1, D302): intake → execute → verify */
export function generalScenario(override: Partial<Record<SkillName, Step[]>> = {}): Scenario {
  const intake = steps('intake').map((st) =>
    st.do === 'write' && st.file === 'intent.draft.md' ? { ...st, text: generalIntentDraft() } : st,
  )
  const verify = steps('verify').map((st) =>
    st.do === 'write' && st.file === 'verification.md'
      ? { ...st, text: REVIEW_NONE + GENERAL_VERDICTS }
      : st.do === 'write' && st.file === 'pr.md'
        ? { ...st, text: GENERAL_PR }
        : st,
  )
  return {
    tasks: {
      'work-start': intake,
      execute: steps('execute'),
      verify,
      ...override,
    },
  }
}

/**
 * 설계 시나리오 (3.1, D350): intake → spec → verify. spec은 주제 목록을 묻고 주제마다 질문 묶음 하나씩(둘) 물은 뒤 설계
 * 문서를 커밋하고 spec.md를 쓴다(D357). 사람의 결정은 by: human이다(D358). verify는 다시 볼 결정을 적은 verification.md와
 * 설계 pr.md를 쓴다 (D362, D364). 사람 역할(driver)은 질문에 첫 선택지(추천)로 답한다
 */
export function specScenario(override: Partial<Record<SkillName, Step[]>> = {}): Scenario {
  const intake = steps('intake').map((st) =>
    st.do === 'write' && st.file === 'intent.draft.md' ? { ...st, text: specIntentDraft() } : st,
  )
  const spec: Step[] = [
    { do: 'prompt' },
    { do: 'ask', question: '주제 목록' },
    { do: 'ask', question: '주제 1. 가중치를 받는 모양' },
    { do: 'ask', question: '주제 2. 가중치 합이 0일 때' },
    ...steps('spec').slice(1),
  ]
  const verify = steps('verify').map((st) =>
    st.do === 'write' && st.file === 'verification.md'
      ? { ...st, text: specVerification() }
      : st.do === 'write' && st.file === 'pr.md'
        ? { ...st, text: SPEC_PR }
        : st,
  )
  return { tasks: { 'work-start': intake, spec, verify, ...override } }
}

/** 버그 수정 시나리오 (3.1): intake → fix → verify (D227) */
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
