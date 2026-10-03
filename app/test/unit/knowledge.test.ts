// 지식 관리의 순수 함수 (core/knowledge, K1)
import { describe, expect, it } from 'vitest'
import {
  INJECT_LIMIT,
  candidatesOf,
  injectedText,
  isKnowledgePath,
  knowledgeEnabled,
  knowledgeSection,
  looksSecret,
  mergeEntries,
  selectEntries,
  type KnowledgeInput,
} from '../../src/core/knowledge'
import { checkKnowledgeLine, checkTask } from '../../src/core/validate'

const entry = (name: string, text: string, pendingFrom?: string) => ({
  path: `docs/knowledge/${name}`,
  text,
  ...(pendingFrom ? { pendingFrom } : {}),
})

describe('[단위] 지식', () => {
  it('RELAY_KNOWLEDGE=off면 끈다', () => {
    expect(knowledgeEnabled({})).toBe(true)
    expect(knowledgeEnabled({ RELAY_KNOWLEDGE: 'off' })).toBe(false)
    expect(knowledgeEnabled({ RELAY_KNOWLEDGE: ' OFF ' })).toBe(false)
    expect(knowledgeEnabled({ RELAY_KNOWLEDGE: 'on' })).toBe(true)
  })

  it('지식 파일은 docs/knowledge 바로 아래의 .md이고 README는 뺀다', () => {
    expect(isKnowledgePath('docs/knowledge/vat.md')).toBe(true)
    expect(isKnowledgePath('docs/knowledge/README.md')).toBe(false)
    expect(isKnowledgePath('docs/knowledge/sub/x.md')).toBe(false)
    expect(isKnowledgePath('docs/knowledge/x.txt')).toBe(false)
    expect(isKnowledgePath('docs/other/x.md')).toBe(false)
  })

  it('머지되지 않은 지식은 같은 경로의 레포 지식을 대신하고, 내용이 같으면 레포 쪽으로 본다', () => {
    const merged = mergeEntries(
      [entry('a.md', '# A\nold'), entry('b.md', '# B')],
      [
        entry('a.md', '# A\nnew', 'w-1'),
        entry('b.md', '# B\n', 'w-1'),
        entry('c.md', '# C', 'w-2'),
      ],
    )
    expect(merged.map((e) => [e.path, e.pendingFrom ?? null])).toEqual([
      ['docs/knowledge/a.md', 'w-1'],
      ['docs/knowledge/b.md', null],
      ['docs/knowledge/c.md', 'w-2'],
    ])
  })

  it('비밀로 보이는 항목은 넣지 않는다', () => {
    expect(looksSecret('토큰: ghp_abcdefghijklmnopqrstuvwxyz0123')).toBe(true)
    expect(looksSecret('password = hunter2hunter2')).toBe(true)
    expect(looksSecret('접속: https://admin:pa55word@db.internal')).toBe(true)
    expect(looksSecret('금액은 원 단위로 내림')).toBe(false)
    const s = selectEntries([entry('a.md', '# A'), entry('s.md', 'api_key=abcdef123456')])
    expect(s.full.map((e) => e.path)).toEqual(['docs/knowledge/a.md'])
    expect(s.secret.map((e) => e.path)).toEqual(['docs/knowledge/s.md'])
    expect(injectedText([entry('s.md', 'api_key=abcdef123456')])).toBe('')
  })

  it('상한을 넘는 항목은 제목만 넣는다', () => {
    const big = 'x'.repeat(INJECT_LIMIT - 3)
    const s = selectEntries([entry('a.md', big), entry('b.md', '# 두 번째\n본문')])
    expect(s.full).toHaveLength(1)
    expect(s.titles.map((e) => e.path)).toEqual(['docs/knowledge/b.md'])
    expect(injectedText([entry('a.md', big), entry('b.md', '# 두 번째\n본문')])).toContain(
      '(제목만) 두 번째',
    )
  })

  it('handoff의 지식 후보를 읽는다', () => {
    const handoff = [
      '---',
      'status: awaiting_approval',
      'knowledge_candidates:',
      '  - "금액은 내림 (사람)"',
      '  - ""',
      '---',
      '## 요약',
    ].join('\n')
    expect(candidatesOf(handoff)).toEqual(['금액은 내림 (사람)'])
    expect(candidatesOf('본문만')).toEqual([])
  })

  it('지식 절: verify는 남기는 법과 후보를, 다른 단계는 후보를 남기는 법을 담는다', () => {
    const input: KnowledgeInput = {
      entries: [entry('vat.md', '# 금액은 내림'), entry('p.md', '# 병렬', 'w-9')],
      candidates: [{ taskId: 't-02', node: 'fix', items: ['할인 먼저 (사람)'] }],
      work_id: 'w-1',
      date: '2026-10-03',
    }
    const [title, intake] = knowledgeSection('intake', input)
    expect(title).toBe('팀 지식')
    expect(intake).toContain('# 금액은 내림')
    expect(intake).toContain('Work w-9에서 남김')
    expect(intake).toContain('`제약`')
    expect(intake).toContain('knowledge_candidates')
    expect(intake).not.toContain('할인 먼저')
    const [, verify] = knowledgeSection('verify', input)
    expect(verify).toContain('지식 남기기')
    expect(verify).toContain('t-02 fix: 할인 먼저 (사람)')
    expect(verify).toContain('relay Work w-1, 2026-10-03')
    const [, empty] = knowledgeSection('fix', { ...input, entries: [], candidates: [] })
    expect(empty).toContain('### 항목\n\n없음')
  })

  it('지식을 켠 verify는 handoff 요약에 "남긴 지식:" 줄이 있어야 한다 (D291)', () => {
    const handoff = (summary: string) =>
      [
        '---',
        'status: awaiting_approval',
        'blocked_reason:',
        'decisions: []',
        'assumptions: []',
        'rejected: []',
        'open_questions: []',
        'intent_deviation: null',
        'risks: []',
        'recommended_next: null',
        '---',
        '## 요약',
        summary,
        '## 다음 task가 알아야 할 것',
        '- 없음',
      ].join('\n')
    expect(checkKnowledgeLine(handoff('고쳤다. 남긴 지식: docs/knowledge/a.md'))).toEqual([])
    expect(checkKnowledgeLine(handoff('고쳤다.\n남긴 지식: 없음 (사람이 말한 규칙 없음)'))).toEqual(
      [],
    )
    expect(checkKnowledgeLine(handoff('고쳤다.'))).toHaveLength(1)
    const files = {
      'handoff.md': handoff('고쳤다.'),
      'verification.md': '## 리뷰 지적\n없음\n',
      'pr.md': '# 제목\n',
    }
    const config = { handoff_body_warn_chars: 1500, intent_warn_chars: 1500 }
    const on = checkTask({ node: 'verify', type: 'bugfix', files, config, knowledge: true })
    expect(on.errors.map((e) => e.message).join()).toContain('남긴 지식')
    const off = checkTask({ node: 'verify', type: 'bugfix', files, config })
    expect(off.errors.map((e) => e.message).join()).not.toContain('남긴 지식')
    const fix = checkTask({
      node: 'fix',
      type: 'bugfix',
      files: { ...files, 'fix.md': 'x' },
      config,
      knowledge: true,
    })
    expect(fix.errors.map((e) => e.message).join()).not.toContain('남긴 지식')
  })
})
