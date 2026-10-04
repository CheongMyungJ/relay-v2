// 관련 지식 고르기 (core/knowledge rankEntries, selectEntries, D295)와 좁히기의 놓침률 (followup.md 5절)
import { describe, expect, it } from 'vitest'
import {
  INJECT_LIMIT,
  PICK_LIMIT,
  identifiersIn,
  knowledgeSection,
  pathsIn,
  rankEntries,
  selectEntries,
  termsOf,
  type KnowledgeEntry,
  type KnowledgeQuery,
} from '../../src/core/knowledge'

const rule = (title: string, body: string, anchor?: string) =>
  [
    '---',
    'kind: rule',
    'source: human',
    ...(anchor ? [`anchor: ${anchor}`] : []),
    '---',
    `# ${title}`,
    '',
    '## 규칙',
    body,
  ].join('\n')

const q = (text: string, paths: string[] = [], ids: string[] = []): KnowledgeQuery => ({
  text,
  paths,
  identifiers: new Set(ids),
})

describe('[단위] 관련 지식 고르기 (D295)', () => {
  it('낱말, 경로, 코드 이름을 뽑는다', () => {
    expect([...termsOf('무료배송은 기준')]).toEqual(['무료', '료배', '배송', '송은', '기준'])
    expect([...termsOf('Free shipping is ok')]).toEqual(['free', 'shipping'])
    expect(pathsIn('`src/fee/ship.js`와 docs/a.md, 그리고 v1.2')).toEqual([
      'src/fee/ship.js',
      'docs/a.md',
    ])
    expect([...identifiersIn('const FREE_SHIPPING = calcFee(x)')]).toEqual([
      'const',
      'FREE_SHIPPING',
      'calcFee',
    ])
  })

  it('같은 anchor, 같은 파일, 영역, 낱말이 점수를 올린다', () => {
    const entries: KnowledgeEntry[] = [
      { path: 'docs/knowledge/a.md', text: rule('무관한 규칙', '- 로그는 남긴다.') },
      {
        path: 'docs/knowledge/b.md',
        text: rule('배송비 상수', '- 기준을 바꾼다.', 'FREE_SHIPPING_THRESHOLD'),
      },
      {
        path: 'docs/knowledge/c.md',
        text: rule('반품 계산', '- `src/returns/fee.js`에서 계산한다.'),
      },
      { path: 'docs/knowledge/shipping/d.md', text: rule('묶음', '- 묶는다.') },
      { path: 'docs/knowledge/e.md', text: rule('무료배송 기준 금액', '- 쿠폰 뺀 금액으로 본다.') },
    ]
    const top = (query: KnowledgeQuery) => rankEntries(entries, query)[0]?.entry.path
    expect(top(q('', [], ['FREE_SHIPPING_THRESHOLD']))).toBe('docs/knowledge/b.md')
    expect(top(q('', ['src/returns/fee.js']))).toBe('docs/knowledge/c.md')
    expect(top(q('', ['src/shipping/pack.js']))).toBe('docs/knowledge/shipping/d.md')
    expect(top(q('무료배송 기준이 40,000원으로 바뀜'))).toBe('docs/knowledge/e.md')
  })

  it('지식이 상한 안이면 전부, 넘으면 관련 항목만 본문으로 넣고 나머지는 제목이나 빼며 그렇다고 적는다', () => {
    const small = [{ path: 'docs/knowledge/a.md', text: rule('작음', '- 하나') }]
    expect(selectEntries(small, q('아무것')).narrowed).toBe(false)
    const many: KnowledgeEntry[] = Array.from({ length: 60 }, (_, k) => ({
      path: `docs/knowledge/item-${String(k).padStart(2, '0')}.md`,
      text: rule(`항목 ${k} 규칙`, `- ${'긴 설명 '.repeat(40)} 번호${k}`),
    }))
    many.push({
      path: 'docs/knowledge/zz-target.md',
      text: rule('객실 취소 수수료', '- 10원 단위로 버린다.'),
    })
    expect(many.reduce((n, e) => n + e.text.length, 0)).toBeGreaterThan(INJECT_LIMIT)
    const sel = selectEntries(many, q('객실 취소 수수료가 1원 단위로 반올림됨'))
    expect(sel.narrowed).toBe(true)
    expect(sel.full[0]?.path).toBe('docs/knowledge/zz-target.md')
    expect(sel.full.length).toBeLessThanOrEqual(PICK_LIMIT)
    expect(sel.full.length + sel.titles.length + sel.rest).toBe(sel.total)
    const [, text] = knowledgeSection('verify', {
      entries: many,
      candidates: [],
      work_id: 'w-1',
      date: '2026-10-04',
      query: q('객실 취소 수수료'),
    })
    expect(text).toContain('관련 있어 보이는 항목만 넣었다')
    expect(text).toContain('객실 취소 수수료')
  })

  it('놓침률: 어긋나는 쌍 20개를 심은 지식 200개에서 새 지식으로 찾으면 옛 짝이 후보 안에 든다', () => {
    const subjects = [
      '무료배송',
      '반품 회수비',
      '도서산간비',
      '청구서 부가세',
      '반품 전표',
      '견적서 합계',
      '쿠폰 할인',
      '포인트 적립',
      '정산 주기',
      '환불 금액',
      '재고 차감',
      '주문 취소',
      '결제 재시도',
      '회원 등급',
      '알림 발송',
      '요약 메일',
      '밤 배치',
      '보관소 저장',
      '예약 변경',
      '객실 취소',
    ]
    const aspects = [
      '기준 금액',
      '반올림 단위',
      '계산 순서',
      '적용 대상',
      '처리 기한',
      '재시도 횟수',
      '수수료율',
      '표시 형식',
      '저장 방식',
      '예외 처리',
    ]
    const fillers = [
      '팀이 정한 방식이다',
      '회계팀과 맞춘 값이다',
      '운영에서 확인했다',
      '고객 문의로 바뀌었다',
    ]
    const entries: KnowledgeEntry[] = []
    subjects.forEach((s, i) =>
      aspects.forEach((a, j) =>
        entries.push({
          path: `docs/knowledge/s${i}-a${j}.md`,
          text: rule(
            `${s} ${a}`,
            `- ${s}의 ${a}는 값 ${i * 10 + j}으로 한다. ${fillers[(i + j) % fillers.length]}.`,
          ),
        }),
      ),
    )
    // 심은 쌍: 주제마다 하나씩, 새 지식은 다른 이름과 다른 말투로 같은 대상을 말한다
    let hit = 0
    subjects.forEach((s, i) => {
      const j = (i * 3) % aspects.length
      const newText = rule(
        `이제 ${s} ${aspects[j]} 바뀜`,
        `- ${s} ${aspects[j]}: 새 값 ${i * 10 + j + 1000} (사람)`,
      )
      const sel = selectEntries(entries, q(`요청: ${s} 문의\n${newText}`))
      if (sel.full.some((e) => e.path === `docs/knowledge/s${i}-a${j}.md`)) hit++
    })
    // 낱말이 겹치는 합성 자료라 쉬운 편이다. 실제 놓침률은 실제 지식으로 따로 잰다
    expect(hit / subjects.length).toBeGreaterThanOrEqual(0.9)
  })
})
