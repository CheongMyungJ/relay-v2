// 가짜 claude의 시나리오 (8.2). 스킬마다 단계 목록을 둔다. 산출물과 handoff는 5.2~5.6의 모양이다.
import type { Handoff, NodeName } from '../../src/shared/contracts'
import type { SkillName } from '../../src/shared/config'

export type Step =
  | { do: 'prompt'; text?: string }
  | { do: 'write'; file: string; text: string }
  | { do: 'remove'; file: string }
  | { do: 'commit'; files: Record<string, string>; message: string }
  | { do: 'ask'; question?: string }
  | { do: 'tool'; name: string }
  | { do: 'notify'; type: string }
  | { do: 'stop'; onBlock?: Step[] }
  | { do: 'exit'; reason?: string; linger?: number }
  /** /clear: 새 세션 id로 계속 돈다 (D110) */
  | { do: 'clear' }
  | { do: 'sleep'; ms: number }
  | { do: 'print'; text: string }
  | { do: 'wait' }
  | { do: 'waitEnter' }

export interface Scenario {
  /** 스킬 이름이나 task id → 단계 */
  tasks: Partial<Record<SkillName | string, Step[]>>
  /** --resume으로 다시 연 세션의 단계. 스킬 이름이나 task id → 단계. 없으면 입력을 기다리기만 한다 */
  resume?: Partial<Record<SkillName | string, Step[]>>
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

export function intentDraft(size: 'S' | 'M' | 'L', opts: { omit?: string[]; note?: string } = {}) {
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
  return `---\ntype: bugfix\nsize: ${size}\n---\n${body}${opts.note ? `\n${opts.note}\n` : ''}`
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
    'intent_deviation: null',
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

export const EVIDENCE = [
  '## 환경',
  '- main, Node 22',
  '',
  '## 재현 절차',
  '1. node -e "import(\'./src/avg.js\').then(m => console.log(m.avg([])))"',
  '- 결과: 재현됨',
  '',
  '## 기대와 실제',
  '- 기대: 0',
  '- 실제: NaN',
  '',
  '## 관찰 사실',
  '- 빈 배열이면 0 / 0이 된다 — src/avg.js:2',
  '',
].join('\n')

export const RCA = [
  '## 원인',
  '빈 배열에서 합 0을 길이 0으로 나눈다.',
  '',
  '## 근거',
  '- evidence의 관찰 사실과 같다',
  '',
  '## 사람 추정 판정',
  '- 0으로 나누는 부분 — 맞음 — src/avg.js:2',
  '',
  '## 기각한 가설',
  '- reduce 초기값 누락 — 초기값 0이 있음',
  '',
  '## 수정 방향',
  '- 수정 지점: src/avg.js:avg',
  '- 방향: 빈 배열이면 0',
  '- 영향 범위: avg를 쓰는 곳',
  '',
].join('\n')

export function fixDoc(s: boolean) {
  return [
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
    '',
    s ? '## 원인과 재현\n- 원인: 0으로 나눔' : '## rca와 달라진 점\n없음',
    '',
  ].join('\n')
}

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

export const PR = '# 빈 배열의 평균을 0으로\n\n## 요약\n## 원인\n## 변경\n## 테스트\n'

export const FIXED_FILES = {
  'src/avg.js':
    'export function avg(xs) {\n  if (xs.length === 0) return 0\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n',
  'test/avg.test.js':
    "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { avg } from '../src/avg.js'\n\ntest('평균', () => assert.strictEqual(avg([1, 2, 3]), 2))\ntest('빈 배열', () => assert.strictEqual(avg([]), 0))\n",
}

// ---------- 노드마다의 기본 단계 ----------

const decision = (what: string, by: 'ai' | 'human' = 'ai') => ({ what, why: `${what}인 이유`, by })

export function steps(node: NodeName, size: 'S' | 'M' = 'M'): Step[] {
  switch (node) {
    case 'intake':
      return [
        { do: 'prompt' },
        { do: 'write', file: 'intent.draft.md', text: intentDraft(size) },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({ decisions: [decision(`크기는 ${size}`)], summary: '의도 초안을 썼다.' }),
        },
        { do: 'stop' },
      ]
    case 'evidence':
      return [
        { do: 'prompt' },
        { do: 'ask', question: '재현 방법' },
        { do: 'write', file: 'evidence.md', text: EVIDENCE },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('재현 명령은 node -e', 'human')],
            rejected: ['캐시 가설: 캐시가 없음'],
            summary: '재현됨.',
          }),
        },
        { do: 'stop' },
      ]
    case 'rca':
      return [
        { do: 'prompt' },
        { do: 'write', file: 'rca.md', text: RCA },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({
            decisions: [decision('원인은 0으로 나눔')],
            rejected: ['reduce 초기값 누락: 초기값이 있음'],
          }),
        },
        { do: 'stop' },
      ]
    case 'fix':
      return [
        { do: 'prompt' },
        { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
        { do: 'write', file: 'fix.md', text: fixDoc(size === 'S') },
        {
          do: 'write',
          file: 'handoff.md',
          text: handoff({ decisions: [decision('빈 배열 검사를 앞에 둔다')] }),
        },
        { do: 'stop' },
      ]
    case 'verify':
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

/** M 경로(intake → evidence → rca → fix → verify)나 S 경로(intake → fix → verify)의 기본 시나리오 */
export function scenario(
  size: 'S' | 'M',
  override: Partial<Record<SkillName, Step[]>> = {},
): Scenario {
  return {
    tasks: {
      'work-start': steps('intake', size),
      evidence: steps('evidence', size),
      'root-cause': steps('rca', size),
      fix: steps('fix', size),
      'final-verify': steps('verify', size),
      ...override,
    },
  }
}
