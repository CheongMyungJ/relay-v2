// 지식 검토 호출의 순수 함수 (core/knowledge-review, D300)와 정하지 않은 것 절 (D299)
import { describe, expect, it } from 'vitest'
import { checkEntryFormat, knowledgeSection, type KnowledgeInput } from '../../src/core/knowledge'
import {
  REVIEW_RELATED_LIMIT,
  humanDecisionLines,
  relatedEntries,
  reviewEnabled,
  reviewIssues,
  reviewPrompt,
} from '../../src/core/knowledge-review'

const rule = (title: string, body: string, extra = '') =>
  ['---', 'kind: rule', 'source: human', '---', `# ${title}`, '', '## 규칙', body, extra].join('\n')

describe('[단위] 지식 검토 호출과 정하지 않은 것 (D299, D300)', () => {
  it('`## 아직 정하지 않은 것`은 규칙 항목에만 둔다 (D299)', () => {
    const undecided = '\n## 아직 정하지 않은 것\n- 환불 회수율: 정산팀이 정함. 지금 코드는 1%\n'
    expect(
      checkEntryFormat('docs/knowledge/a.md', rule('적립률은 2%', '- 2%다.', undecided)),
    ).toEqual([])
    const fact = [
      '---',
      'kind: fact',
      'source: human',
      '---',
      '# 사실',
      '',
      '## 내용',
      '- x',
      undecided,
    ].join('\n')
    expect(
      checkEntryFormat('docs/knowledge/f.md', fact)
        .map((i) => i.message)
        .join(),
    ).toContain('`## 아직 정하지 않은 것`은 kind: rule에만')
  })

  it('안내: 사람이 말한 미정 사항만 정하지 않은 것이고, 규칙이 덮으면 따르며 그 사항을 정해야 할 때만 묻는다 (D299)', () => {
    const input: KnowledgeInput = {
      entries: [],
      candidates: [],
      work_id: 'w-3',
      date: '2026-10-04',
    }
    const [, fix] = knowledgeSection('fix', input)
    expect(fix).toContain('정하지 않음: <무엇> — 사람이 "<한 말>"이라고 함')
    expect(fix).toContain('에이전트가 스스로 떠올린 열린 질문')
    expect(fix).toContain('`## 아직 정하지 않은 것`은 규칙이 아니다')
    expect(fix).toContain('이번 일은 `## 규칙`이 덮는 대로 하고')
    expect(fix).toContain('정해야 이번 일을 할 수 있을 때만 사람에게 묻는다')
    const [, verify] = knowledgeSection('verify', input)
    expect(verify).toContain(
      '"<무엇>: 사람이 "<한 말>"(Work w-3). <누가 언제 정하나>. 지금 코드는 <상태>"',
    )
    expect(verify).toContain('## 아직 정하지 않은 것\n- <무엇>')
  })

  it('RELAY_KNOWLEDGE_REVIEW=off면 검토를 끈다', () => {
    expect(reviewEnabled({})).toBe(true)
    expect(reviewEnabled({ RELAY_KNOWLEDGE_REVIEW: 'OFF' })).toBe(false)
  })

  it('관련 항목: 바꾼 지식과 같은 코드 이름이나 낱말을 가진 것을, 상한까지 (D300)', () => {
    const current = new Map<string, string>([
      ['docs/knowledge/points/rate.md', rule('적립률은 1%', '- `POINT_RATE_PERCENT`는 1이다.')],
      ['docs/knowledge/shipping/fee.md', rule('배송비는 3,000원', '- 30,000원 이상 무료.')],
      ['docs/knowledge/points/new.md', '바뀐 것 자신'],
    ])
    const changed = [
      {
        path: 'docs/knowledge/points/new.md',
        text: rule('적립률은 2%', '- `POINT_RATE_PERCENT`는 2다.'),
      },
    ]
    expect(relatedEntries(current, changed, '적립률을 올린다').map((r) => r.path)).toEqual([
      'docs/knowledge/points/rate.md',
    ])
    expect(relatedEntries(current, [], 'x')).toEqual([])
    const many = new Map(
      Array.from(
        { length: 20 },
        (_, i) => [`docs/knowledge/p${i}.md`, rule(`적립률 ${i}`, '- 적립률')] as const,
      ),
    )
    expect(relatedEntries(many, changed, '적립률')).toHaveLength(REVIEW_RELATED_LIMIT)
  })

  it('프롬프트: 바꾼 지식, 지운 지식, 관련 항목, 요청, intent, 사람 결정, 후보를 담는다', () => {
    const p = reviewPrompt({
      changed: [{ path: 'docs/knowledge/a.md', text: '# A' }],
      removed: ['docs/knowledge/gone.md'],
      related: [{ path: 'docs/knowledge/b.md', text: '# B' }],
      request: '적립률을 2%로',
      intent: '## 비목표\n- 환불 회수율',
      humanDecisions: '- [사람] 회수율은 따로 정한다',
      candidates: ['정하지 않음: 회수율 (사람)'],
    })
    for (const s of [
      '### docs/knowledge/a.md',
      '- docs/knowledge/gone.md',
      '### docs/knowledge/b.md',
      '적립률을 2%로',
      '환불 회수율',
      '[사람] 회수율은 따로 정한다',
      '정하지 않음: 회수율 (사람)',
      'undecided_in_rule',
      '인용할 말이 없으면 이 kind로 적지 않는다',
      '어느 값을 규칙으로 쓰라고 하지 않는다',
      '"이미 저장된 값은 다시 계산하지 않는다"',
      '에이전트가 떠올린 열린 질문',
    ])
      expect(p).toContain(s)
  })

  it('결과: 알려진 파일의 문제를 형식 오류로, 모르는 파일은 handoff로, 모양이 틀린 것은 버린다', () => {
    const known = new Set(['docs/knowledge/a.md'])
    const issues = reviewIssues(
      {
        issues: [
          {
            file: 'docs/knowledge/a.md',
            kind: 'undecided_in_rule',
            quote: '회수율은 1%',
            fix: '정하지 않은 것 절로 옮긴다',
          },
          {
            file: 'docs/knowledge/a.md',
            kind: 'contradicts_human',
            quote: '할인은 뒤에',
            human: '',
            fix: '고친다',
          },
          {
            file: 'docs/knowledge/a.md',
            kind: 'contradicts_human',
            quote: '할인은 뒤에',
            human: '할인은 부가세 전에',
            fix: '고친다',
          },
          { file: 'docs/knowledge/zzz.md', kind: 'conflict', quote: '', fix: '하나로 합친다' },
          { file: 'docs/knowledge/a.md', kind: 'style', quote: 'x', fix: 'y' },
          { file: 'docs/knowledge/a.md', kind: 'conflict', quote: 'x', fix: '' },
        ],
      },
      known,
    )
    expect(issues.map((i) => [i.file, i.message])).toEqual([
      [
        'docs/knowledge/a.md',
        '[지식 검토: 규칙 절에 정하지 않은 것] "회수율은 1%" → 정하지 않은 것 절로 옮긴다',
      ],
      // 사람 말과 어긋난다는 지적은 사람의 말을 인용해야 남는다
      [
        'docs/knowledge/a.md',
        '[지식 검토: 사람의 이번 말과 어긋남] "할인은 뒤에" (사람: "할인은 부가세 전에") → 고친다',
      ],
      ['handoff.md', '[지식 검토: 다른 항목과 어긋남] → 하나로 합친다'],
    ])
    expect(reviewIssues(null, known)).toEqual([])
    expect(reviewIssues({ issues: 'x' }, known)).toEqual([])
  })

  it('사람 결정 줄만 고른다', () => {
    expect(humanDecisionLines('## t-01\n- [사람] a — b\n- [AI] c — d\n  - [사람] e')).toBe(
      '- [사람] a — b\n  - [사람] e',
    )
  })
})
