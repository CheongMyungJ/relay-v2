// 지식 관리의 순수 함수 (core/knowledge, K1)
import { describe, expect, it } from 'vitest'
import {
  INJECT_LIMIT,
  anchorOf,
  candidatesOf,
  checkEntryFormat,
  injectedText,
  knowledgeIssues,
  knowledgeLineIssues,
  knowledgeLines,
  isKnowledgePath,
  knowledgeChanges,
  knowledgeEnabled,
  knowledgeSection,
  kindOf,
  notYetPaths,
  looksSecret,
  rankEntries,
  mergeEntries,
  selectEntries,
  type KnowledgeInput,
} from '../../src/core/knowledge'
import { checkTask } from '../../src/core/validate'

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

  it('지식 파일은 docs/knowledge 아래나 영역 폴더 한 단계 아래의 .md이고 README는 뺀다 (D293)', () => {
    expect(isKnowledgePath('docs/knowledge/vat.md')).toBe(true)
    expect(isKnowledgePath('docs/knowledge/shipping/free-threshold.md')).toBe(true)
    expect(isKnowledgePath('docs/knowledge/README.md')).toBe(false)
    expect(isKnowledgePath('docs/knowledge/shipping/README.md')).toBe(false)
    expect(isKnowledgePath('docs/knowledge/a/b/x.md')).toBe(false)
    expect(isKnowledgePath('docs/knowledge/Shipping_Area/x.md')).toBe(false)
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
    expect(intake).toContain('머지를 기다리는 앞 Work')
    const [, mergedOnly] = knowledgeSection('intake', {
      ...input,
      entries: input.entries.slice(0, 1),
    })
    expect(mergedOnly).not.toContain('머지를 기다리는 앞 Work')
    const [, verify] = knowledgeSection('verify', input)
    expect(verify).toContain('지식 남기기')
    expect(verify).toContain('t-02 fix: 할인 먼저 (사람)')
    expect(verify).toContain('2026-10-03 처음 남김 (Work w-1)')
    expect(verify).toContain('고친 지식: <경로>')
    const [, empty] = knowledgeSection('fix', { ...input, entries: [], candidates: [] })
    expect(empty).toContain('### 항목\n\n없음')
  })

  it('지식 파일의 형식: 머리글, 제목, 종류에 맞는 본문 절, 알려진 절만 (D293)', () => {
    expect(checkEntryFormat('docs/knowledge/a.md', RULE)).toEqual([])
    expect(checkEntryFormat('docs/knowledge/f.md', FACT)).toEqual([])
    const msgs = (text: string) =>
      checkEntryFormat('docs/knowledge/x.md', text)
        .map((i) => i.message)
        .join('\n')
    expect(msgs('# 제목\n본문')).toContain('머리글')
    expect(msgs(RULE.replace('kind: rule', 'kind: law'))).toContain('`kind`')
    expect(msgs(RULE.replace('source: human', 'source: guess'))).toContain('`source`')
    expect(msgs(RULE.replace('anchor: FREE_SHIPPING_THRESHOLD', 'anchor: 무료 배송'))).toContain(
      '`anchor`',
    )
    expect(msgs(RULE.replace('## 규칙', '## 내용'))).toContain('`## 규칙` 절이 없거나')
    expect(msgs(RULE.replace('## 바뀐 이력', '## 메모'))).toContain('모르는 절')
    expect(msgs(FACT + '\n## 아직 규칙을 따르지 않는 곳\n- x\n')).toContain('kind: rule에만')
    expect(anchorOf(RULE)).toBe('FREE_SHIPPING_THRESHOLD')
    expect(anchorOf(FACT)).toBeNull()
  })

  it('handoff의 새·고친 지식 줄을 읽는다 (D294)', () => {
    const l = knowledgeLines(
      handoff(
        [
          '고쳤다.',
          '- 새 지식: `docs/knowledge/a.md` — 맞는 항목 없음',
          '고친 지식: docs/knowledge/b.md — 30,000 → 40,000원',
        ].join('\n'),
      ),
    )
    expect([...l.added]).toEqual([['docs/knowledge/a.md', '맞는 항목 없음']])
    expect([...l.updated]).toEqual([['docs/knowledge/b.md', '30,000 → 40,000원']])
    expect(l.none).toBe(false)
    expect(knowledgeLines(handoff('남긴 지식: 없음 (규칙 없음)')).none).toBe(true)
    // 경로 뒤의 구분자(띄어쓰기 없는 대시, 콜론)는 경로에 붙지 않는다
    const tight = knowledgeLines(
      handoff('새 지식: docs/knowledge/c.md: 까닭\n고친 지식: docs/knowledge/d.md—1% → 2%'),
    )
    expect([...tight.added]).toEqual([['docs/knowledge/c.md', '까닭']])
    expect([...tight.updated]).toEqual([['docs/knowledge/d.md', '1% → 2%']])
  })

  it('verify의 지식 확인: 줄과 새·고침 구분, 형식, 같은 anchor (D293, D294)', () => {
    const base = {
      existing: new Set(['docs/knowledge/old.md']),
      current: new Map([['docs/knowledge/old.md', FACT]]),
    }
    const msgs = (h: string, changed: { path: string; text: string }[], current = base.current) =>
      knowledgeIssues({ ...base, handoff: handoff(h), changed, current })
        .map((i) => `${i.file}: ${i.message}`)
        .join('\n')
    // 바꾼 것이 없으면 "남긴 지식: 없음" 줄
    expect(msgs('고쳤다.', [])).toContain('남긴 지식: 없음')
    expect(msgs('남긴 지식: 없음 (없음)', [])).toBe('')
    // 새 파일은 "새 지식", 있던 파일은 "고친 지식"
    const added = { path: 'docs/knowledge/new.md', text: RULE }
    const updated = { path: 'docs/knowledge/old.md', text: FACT.replace('사실', '고친 사실') }
    expect(msgs('새 지식: docs/knowledge/new.md — 맞는 것 없음', [added])).toBe('')
    expect(msgs('고친 지식: docs/knowledge/new.md — x', [added])).toContain('"새 지식')
    expect(msgs('새 지식: docs/knowledge/old.md — x', [updated])).toContain('"고친 지식')
    expect(msgs('고쳤다.', [updated])).toContain('줄이 없음')
    expect(msgs('새 지식: docs/knowledge/new.md', [added])).toContain('비었음')
    expect(msgs('고친 지식: docs/knowledge/old.md — x', [])).toContain('고치지 않았다')
    // 형식
    expect(msgs('새 지식: docs/knowledge/new.md — x', [{ ...added, text: '# 제목' }])).toContain(
      'docs/knowledge/new.md: 머리글',
    )
    // 같은 anchor: 이번에 바꾼 파일이 끼어 있을 때만
    const twin = new Map([
      ['docs/knowledge/old.md', RULE],
      ['docs/knowledge/new.md', RULE],
    ])
    expect(msgs('새 지식: docs/knowledge/new.md — x', [added], twin)).toContain('같은 anchor')
    expect(msgs('남긴 지식: 없음 (x)', [], twin)).toBe('')
  })

  it('지식 확인 결과는 verify가 승인 대기일 때만 형식 오류가 된다', () => {
    const files = {
      'handoff.md': handoff('고쳤다.'),
      'verification.md': '## 리뷰 지적\n없음\n',
      'pr.md': '# 제목\n',
    }
    const config = { handoff_body_warn_chars: 1500, intent_warn_chars: 1500 }
    const knowledge = [{ file: 'handoff.md', part: 'body' as const, message: '남긴 지식 줄 없음' }]
    const on = checkTask({
      node: 'verify',
      type: 'bugfix',
      files,
      config,
      knowledgeIssues: knowledge,
    })
    expect(on.errors.map((e) => e.message)).toContain('남긴 지식 줄 없음')
    const off = checkTask({ node: 'verify', type: 'bugfix', files, config })
    expect(off.errors.map((e) => e.message).join()).not.toContain('남긴 지식')
    const fix = checkTask({
      node: 'fix',
      type: 'bugfix',
      files: { ...files, 'fix.md': 'x' },
      config,
      knowledgeIssues: knowledge,
    })
    expect(fix.errors.map((e) => e.message).join()).not.toContain('남긴 지식')
  })
})

const RULE = [
  '---',
  'kind: rule',
  'source: human',
  'anchor: FREE_SHIPPING_THRESHOLD',
  '---',
  '# 무료배송 기준은 쿠폰 뺀 금액 40,000원',
  '',
  '## 규칙',
  '- 쿠폰을 뺀 금액이 40,000원 이상이면 무료다.',
  '',
  '## 아직 규칙을 따르지 않는 곳',
  '- `src/returns/return-fee.js`: 할인 전 금액으로 판단한다.',
  '',
  '## 바뀐 이력',
  '- 2026-10-04 처음 남김 (Work w-1)',
].join('\n')

const FACT = [
  '---',
  'kind: fact',
  'source: investigation',
  '---',
  '# 사실',
  '',
  '## 내용',
  '- 사실이다.',
].join('\n')

function handoff(summary: string): string {
  return [
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
}

describe('[단위] 지식 지우기, 범위 지시, 이 Work의 지식 (D296, D297, D298)', () => {
  it('handoff의 지운·확인한 지식 줄을 읽는다', () => {
    const l = knowledgeLines(
      handoff(
        [
          '지운 지식: docs/knowledge/old.md — 규칙이 없어짐',
          '- 확인한 지식: `docs/knowledge/a.md` — 이번엔 일부만 고침',
        ].join('\n'),
      ),
    )
    expect([...l.removed]).toEqual([['docs/knowledge/old.md', '규칙이 없어짐']])
    expect([...l.checked]).toEqual([['docs/knowledge/a.md', '이번엔 일부만 고침']])
  })

  it('지운 지식은 줄이 있어야 하고, 지우지 않은 파일을 지운 지식으로 적지 않는다 (D297)', () => {
    const base = {
      existing: new Set(['docs/knowledge/old.md']),
      current: new Map<string, string>(),
    }
    const msgs = (h: string, removed: string[]) =>
      knowledgeIssues({ ...base, handoff: handoff(h), changed: [], removed })
        .map((i) => i.message)
        .join('\n')
    expect(msgs('고쳤다.', ['docs/knowledge/old.md'])).toContain(
      '"지운 지식: docs/knowledge/old.md',
    )
    expect(msgs('고쳤다.', ['docs/knowledge/old.md'])).not.toContain('남긴 지식: 없음')
    expect(msgs('지운 지식: docs/knowledge/old.md — 합침', ['docs/knowledge/old.md'])).toBe('')
    expect(msgs('지운 지식: docs/knowledge/old.md', ['docs/knowledge/old.md'])).toContain('비었음')
    expect(msgs('지운 지식: docs/knowledge/p.md — x', [])).toContain('지우지 않았다')
  })

  it('바꾼 코드가 아직 따르지 않는 곳에 남아 있으면 항목을 고치거나 확인한 지식을 적어야 한다 (D296)', () => {
    expect(notYetPaths(RULE)).toEqual(['src/returns/return-fee.js'])
    expect(notYetPaths(FACT)).toEqual([])
    const current = new Map([
      ['docs/knowledge/rule.md', RULE],
      ['docs/knowledge/fact.md', FACT],
    ])
    const run = (
      h: string,
      codeChanged: string[],
      changed: { path: string; text: string }[] = [],
    ) =>
      knowledgeIssues({
        handoff: handoff(h),
        changed,
        existing: new Set(current.keys()),
        current,
        codeChanged,
      })
    const hit = run('남긴 지식: 없음 (x)', ['src/returns/return-fee.js', 'test/a.test.js'])
    expect(hit.map((i) => i.file)).toEqual(['docs/knowledge/rule.md'])
    expect(hit[0]?.message).toContain('`src/returns/return-fee.js`')
    expect(hit[0]?.message).toContain('확인한 지식: docs/knowledge/rule.md')
    // 다른 코드만 바꿨으면 없다
    expect(run('남긴 지식: 없음 (x)', ['src/other.js'])).toEqual([])
    // 그대로 두는 까닭을 적으면 된다
    expect(
      run('확인한 지식: docs/knowledge/rule.md — 일부만 고침', ['src/returns/return-fee.js']),
    ).toEqual([])
    expect(
      run('확인한 지식: docs/knowledge/rule.md', ['src/returns/return-fee.js'])
        .map((i) => i.message)
        .join(),
    ).toContain('비었음')
    expect(
      run('확인한 지식: docs/knowledge/none.md — x', [])
        .map((i) => i.message)
        .join(),
    ).toContain('없는 지식 항목')
    // 항목을 고쳤으면 된다
    const fixed = RULE.replace(/## 아직 규칙을 따르지 않는 곳\n- [^\n]+\n\n/, '')
    expect(
      run(
        '고친 지식: docs/knowledge/rule.md — 반품도 고침',
        ['src/returns/return-fee.js'],
        [{ path: 'docs/knowledge/rule.md', text: fixed }],
      ),
    ).toEqual([])
  })

  it('머지 전 앞 Work가 지운 항목은 합친 지식에서 빠지고, 뒤 Work가 다시 쓰면 돌아온다 (D297)', () => {
    const removed = { path: 'docs/knowledge/a.md', text: '', pendingFrom: 'w-2', removed: true }
    expect(
      mergeEntries([entry('a.md', '# A'), entry('b.md', '# B')], [removed]).map((e) => e.path),
    ).toEqual(['docs/knowledge/b.md'])
    expect(
      mergeEntries([entry('a.md', '# A')], [removed, entry('a.md', '# A 다시', 'w-3')]).map((e) => [
        e.path,
        e.pendingFrom,
      ]),
    ).toEqual([['docs/knowledge/a.md', 'w-3']])
  })

  it('지식 절: 범위 지시는 규칙이 아니라는 안내와 앞 Work가 지운 항목 (D296, D297)', () => {
    const input: KnowledgeInput = {
      entries: [entry('vat.md', '# 금액은 내림')],
      candidates: [],
      work_id: 'w-1',
      date: '2026-10-04',
      removed: [{ path: 'docs/knowledge/gone.md', from: 'w-0' }],
    }
    const [, fix] = knowledgeSection('fix', input)
    expect(fix).toContain('이번 범위에서 뺌 (사람)')
    expect(fix).toContain('금지가 아니라')
    expect(fix).toContain('`docs/knowledge/gone.md`(Work w-0)')
    const [, verify] = knowledgeSection('verify', input)
    expect(verify).toContain('사람이 Work w-1의 범위에서 뺌(2026-10-04)')
    expect(verify).toContain('지운 지식: <경로>')
    expect(verify).toContain('확인한 지식: <경로>')
    expect(verify).toContain('git rm')
  })

  it('이 Work의 지식: 새로 만듦·고침·지움과 handoff 줄의 까닭 (D298)', () => {
    const h = handoff(
      [
        '새 지식: docs/knowledge/new.md — 맞는 항목 없음',
        '고친 지식: docs/knowledge/old.md — 1% → 2%',
        '고친 지식: docs/knowledge/pend.md — 이어 씀',
        '지운 지식: docs/knowledge/gone.md — 합침',
      ].join('\n'),
    )
    const list = knowledgeChanges(
      [
        { path: 'docs/knowledge/gone.md', status: 'D', text: null, before: '# 옛것\n' },
        { path: 'docs/knowledge/new.md', status: 'A', text: RULE, before: null },
        {
          path: 'docs/knowledge/old.md',
          status: 'M',
          text: FACT,
          before: FACT.replace('사실이다', '옛 사실'),
        },
        { path: 'docs/knowledge/pend.md', status: 'A', text: FACT, before: FACT },
        { path: 'src/x.js', status: 'M', text: 'x', before: 'y' },
      ],
      new Map([['docs/knowledge/pend.md', 'w-7']]),
      h,
    )
    expect(list.map((k) => [k.path, k.change, k.kind, k.note, k.pendingFrom])).toEqual([
      ['docs/knowledge/new.md', 'added', 'rule', '맞는 항목 없음', null],
      ['docs/knowledge/old.md', 'updated', 'fact', '1% → 2%', null],
      ['docs/knowledge/pend.md', 'updated', 'fact', '이어 씀', 'w-7'],
      ['docs/knowledge/gone.md', 'removed', null, '합침', null],
    ])
    expect(list[0]?.title).toBe('무료배송 기준은 쿠폰 뺀 금액 40,000원')
    expect(list[0]?.diff.split('\n').slice(0, 3)).toEqual([
      '--- /dev/null',
      '+++ b/docs/knowledge/new.md',
      '+---',
    ])
    expect(list[1]?.diff).toContain('-- 옛 사실.')
    expect(list[1]?.diff).toContain('+- 사실이다.')
    expect(list[1]?.diff).toContain(' ## 내용')
    expect(list[3]?.diff).toBe('--- a/docs/knowledge/gone.md\n+++ /dev/null\n-# 옛것')
    expect(kindOf('# 옛 형식')).toBeNull()
  })
})

describe('[단위] 지식 파일 읽기의 가장자리 (2026-10 정리)', () => {
  const fenced = [
    '---',
    'kind: pitfall',
    'source: investigation',
    '---',
    '# 설정을 두 번 읽으면 캐시가 깨진다',
    '',
    '## 내용',
    '- 예:',
    '',
    '```sh',
    '## 설정 읽기',
    '# 주석',
    '```',
  ].join('\n')

  it('코드 펜스 안의 # 줄은 절이나 제목으로 보지 않는다', () => {
    expect(checkEntryFormat('docs/knowledge/a.md', fenced)).toEqual([])
    const noTitle = fenced.replace('# 설정을 두 번 읽으면 캐시가 깨진다\n', '')
    expect(checkEntryFormat('docs/knowledge/a.md', noTitle).map((i) => i.message)).toEqual([
      '첫 `# ` 제목 줄 없음',
    ])
  })

  it('제목은 머리글의 YAML 주석이나 펜스 안이 아닌 본문의 첫 `# ` 줄이다', () => {
    const text = FACT.replace('kind: fact', 'kind: fact\n# 메모').replace(
      '# 사실',
      '```\n# 아님\n```\n# 사실',
    )
    const [c] = knowledgeChanges(
      [{ path: 'docs/knowledge/a.md', status: 'A', text, before: null }],
      new Map(),
      handoff('새 지식: docs/knowledge/a.md — 새것'),
    )
    expect(c?.title).toBe('사실')
  })

  it('작업 트리가 CRLF여도 바뀐 줄만 차이로 보인다', () => {
    const before = FACT
    const after = `${FACT.replace('사실이다', '바뀐 사실')}\n`.replace(/\n/g, '\r\n')
    const [c] = knowledgeChanges(
      [{ path: 'docs/knowledge/a.md', status: 'M', text: after, before }],
      new Map(),
      handoff('고친 지식: docs/knowledge/a.md — 고침'),
    )
    const changed = (c?.diff ?? '')
      .split('\n')
      .filter((l) => /^[+-]/.test(l) && !/^(---|\+\+\+) [ab/]/.test(l))
    expect(changed.sort()).toEqual(['+- 바뀐 사실.', '-- 사실이다.'])
  })

  it('handoff의 지식 줄은 역슬래시 경로도 읽는다', () => {
    const l = knowledgeLines(handoff('새 지식: docs\\knowledge\\a.md — 새것'))
    expect([...l.added.keys()]).toEqual(['docs/knowledge/a.md'])
  })

  it('항목의 ./ 경로도 질의의 파일과 맞춘다 (D295)', () => {
    const e = entry('a.md', FACT.replace('- 사실이다.', '- `./src/a.ts`의 사실이다.'))
    const [r] = rankEntries([e], { text: '', paths: ['src/a.ts'], identifiers: new Set() })
    expect(r?.score).toBeGreaterThanOrEqual(4)
  })

  it('아직 따르지 않는 곳의 레포 맨 위 파일도 읽는다 (D296)', () => {
    const text = RULE.replace('`src/returns/return-fee.js`', '`pricing.py`')
    expect(notYetPaths(text)).toEqual(['pricing.py'])
  })

  it('형식에 맞지 않는 경로의 지식 줄은 경로 규칙으로 되돌린다 (D293)', () => {
    const messages = knowledgeIssues({
      handoff: handoff('새 지식: docs/knowledge/Shipping/rate.md — 새것'),
      changed: [],
      existing: new Set(),
      current: new Map(),
    }).map((i) => i.message)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('경로')
    expect(messages[0]).not.toContain('고치지 않았다')
  })

  it('바꾼 지식 파일을 읽지 못하면 지식 줄이 있는지만 본다', () => {
    expect(knowledgeLineIssues(handoff('새 지식: docs/knowledge/a.md — 새것'))).toEqual([])
    expect(knowledgeLineIssues(handoff('남긴 지식: 없음 (규칙 없음)'))).toEqual([])
    expect(knowledgeLineIssues(handoff('요약만')).map((i) => i.message)).toEqual([
      '`## 요약`에 지식 줄 없음: 바꾼 지식이 없으면 "남긴 지식: 없음 (까닭)"을 적는다',
    ])
  })
})
