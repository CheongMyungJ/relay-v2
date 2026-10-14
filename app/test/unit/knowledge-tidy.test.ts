// 지식 정리의 순수 함수 (core/knowledge-tidy, D393, D394)
import { describe, expect, it } from 'vitest'
import { anchorName, anchorNames, tidyCandidates, tidyRequest } from '../../src/core/knowledge-tidy'

const entry = (path: string, anchor: string | null, extra = '') => ({
  path,
  text: [
    '---',
    'kind: rule',
    'source: human',
    ...(anchor ? [`anchor: ${anchor}`] : []),
    '---',
    `# ${path}`,
    '',
    '## 규칙',
    '- 규칙',
    extra,
  ].join('\n'),
})

const code = (found: string[], files: string[] = []) => ({
  found: new Set(found),
  files: new Set(files),
})

describe('tidyCandidates', () => {
  it('같은 anchor 여럿, 코드에 없는 anchor, 없는 경로, 형식 문제를 찾는다', () => {
    const entries = [
      entry('docs/knowledge/a.md', 'VAT_RATE'),
      entry('docs/knowledge/b.md', 'VAT_RATE'),
      entry('docs/knowledge/c.md', 'Billing.oldRound'),
      entry(
        'docs/knowledge/d.md',
        'roundLine',
        '\n## 아직 규칙을 따르지 않는 곳\n- `src/legacy/round.js` — 아직 반올림\n- `src/a.js` — 아직',
      ),
      { path: 'docs/knowledge/e.md', text: '# 머리글 없음\n' },
      { path: 'docs/knowledge/gone.md', text: '', removed: true },
    ]
    expect(tidyCandidates(entries, code(['VAT_RATE', 'roundLine'], ['src/a.js']))).toEqual([
      {
        kind: 'same_anchor',
        paths: ['docs/knowledge/a.md', 'docs/knowledge/b.md'],
        detail: 'VAT_RATE',
      },
      { kind: 'stale_anchor', paths: ['docs/knowledge/c.md'], detail: 'Billing.oldRound' },
      { kind: 'missing_path', paths: ['docs/knowledge/d.md'], detail: 'src/legacy/round.js' },
      {
        kind: 'format',
        paths: ['docs/knowledge/e.md'],
        detail: expect.stringContaining('머리글') as unknown as string,
      },
    ])
  })

  it('문제가 없으면 빈 목록', () => {
    expect(tidyCandidates([entry('docs/knowledge/a.md', 'VAT_RATE')], code(['VAT_RATE']))).toEqual(
      [],
    )
  })
})

describe('anchorNames', () => {
  it('점으로 이은 anchor는 마지막 이름으로, 겹치지 않게, 차례대로', () => {
    expect(anchorName('Billing.round')).toBe('round')
    expect(
      anchorNames([
        entry('docs/knowledge/a.md', 'b.zeta'),
        entry('docs/knowledge/b.md', 'alpha'),
        entry('docs/knowledge/c.md', 'zeta'),
        entry('docs/knowledge/d.md', null),
      ]),
    ).toEqual(['alpha', 'zeta'])
  })
})

describe('tidyRequest', () => {
  it('후보마다 할 일과, 어긋난 규칙은 사람에게 묻고 멀쩡한 항목과 코드는 바꾸지 않는다고 적는다', () => {
    const text = tidyRequest([
      { kind: 'same_anchor', paths: ['docs/knowledge/a.md', 'docs/knowledge/b.md'], detail: 'X' },
      { kind: 'stale_anchor', paths: ['docs/knowledge/c.md'], detail: 'Y' },
    ])
    expect(text).toContain(
      '같은 anchor `X`를 가진 항목이 여럿: `docs/knowledge/a.md`, `docs/knowledge/b.md`',
    )
    expect(text).toContain('코드에서 찾지 못한 anchor `Y`')
    expect(text).toContain('어느 쪽이 지금 맞는지 사람에게 묻고')
    expect(text).toContain('문제가 없는 항목은 바꾸지 않는다. 코드는 바꾸지 않는다.')
  })
})
