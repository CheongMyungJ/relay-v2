// [탐색] 지식 관리의 결정적 동작을 잰다. 합격 판정 없이 관찰을 test-results/explore/probe.md에 남긴다.
// RELAY_EXPLORE_PROBE=1일 때만 돈다 (docs/knowledge-explore.md).
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, it } from 'vitest'
import {
  isStale,
  pathsInText,
  planKnowledge,
  renderKnowledge,
  reviewKnowledge,
  selectKnowledge,
  termsMatch,
  withHashes,
  type PoolEntry,
} from '../../src/core/knowledge'
import type { KnowledgeEntry, KnowledgeKind } from '../../src/shared/knowledge'

const on = process.env['RELAY_EXPLORE_PROBE'] === '1'
const lines: string[] = []
const note = (s = '') => lines.push(s)

afterAll(() => {
  if (!on) return
  const out = path.resolve(__dirname, '../../test-results/explore')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'probe.md'), lines.join('\n'))
})

let n = 0
function e(
  kind: KnowledgeKind,
  rule: string,
  terms: string[],
  paths: string[] = [],
  over: Partial<KnowledgeEntry> = {},
): KnowledgeEntry {
  n++
  return {
    id: `${kind}-${String(n).padStart(8, '0')}`,
    kind,
    subkind: null,
    status: 'active',
    superseded_by: null,
    paths,
    terms,
    hashes: {},
    source: { work: 'w-1', task: 't-01', by: 'ai' },
    rule,
    why: '',
    not_in_code: '',
    incentive: '',
    ...over,
  }
}

// 실제 사용자 폴더를 흉내 낸 경로 (Windows 앱 저장소, worktree)
const STORE =
  'C:\\Users\\kimdeveloper\\AppData\\Roaming\\relay\\projects\\p-3f9a2c1b\\knowledge\\pending'
const pool = (entries: KnowledgeEntry[], scope: PoolEntry['scope'] = 'pending'): PoolEntry[] =>
  entries.map((x) => ({ entry: x, scope, file: `${STORE}\\${x.kind}\\${x.id}.md`, stale: false }))

describe.runIf(on)('[탐색] 넣기: 용어 매칭', () => {
  it('부분 문자열 매칭의 잘못 걸림', () => {
    note('## 넣기: 용어 매칭 (termsMatch는 정규화 뒤 부분 문자열)')
    note('')
    note('| 용어 | 요청 글 | 걸림 | 뜻이 맞나 |')
    note('|---|---|---|---|')
    const cases: [string, string, boolean][] = [
      ['로그', '로그인 화면에서 비밀번호 오류 문구가 안 보인다', false],
      ['시간', '시간대가 LA인 사용자의 예약 날짜가 하루 밀린다', false],
      ['id', '이메일 valid 검사가 너무 느슨하다', false],
      ['api', 'rapid 클릭으로 주문이 두 번 생긴다', false],
      ['환불', '환불 버튼이 안 눌린다', true],
      ['세금', '세금계산서 PDF의 글꼴이 깨진다', false],
      ['재시도', '재시도 버튼 문구를 바꿔 달라', false],
      ['부가세', 'Refund API 응답의 tax 값이 POS 영수증보다 크다', true],
      ['반품', '환불 금액이 몇 원 크다', true],
      ['빈 배열', '요청이 0건인 날의 평균이 NaN이다', true],
      ['반올림', '금액을 버림해야 하는데 올림이 된다', true],
    ]
    for (const [term, text, related] of cases) {
      const hit = termsMatch([term], text)
      note(
        `| ${term} | ${text} | ${hit ? '걸림' : '안 걸림'} | ${hit === related ? '맞음' : hit ? '**잘못 걸림**' : '**놓침**'} |`,
      )
    }
    note('')
  })
})

describe.runIf(on)('[탐색] 넣기: 글에서 경로 뽑기', () => {
  it('pathsInText', () => {
    note('## 넣기: 요청 글에서 경로 뽑기 (pathsInText)')
    note('')
    const texts = [
      'Node.js 20에서 e.g. 결제 모듈이 깨진다',
      'README.md와 package.json의 버전을 1.2.3으로',
      'src/billing/ 밑의 금액 계산이 이상하다',
      '결제 화면(checkout)에서 금액이 0원으로 보인다',
      'invoiceTotal 함수가 틀린 값을 준다',
      'https://example.com/api/v1/orders 응답이 느리다',
      'app/models/user.rb:full_name 이 nil을 돌려준다',
    ]
    for (const t of texts) note(`- \`${t}\` → ${JSON.stringify(pathsInText(t))}`)
    note('')
  })
})

describe.runIf(on)('[탐색] 넣기: 분량과 차례', () => {
  it('1,500자 안에 몇 건이 드는가', () => {
    note('## 넣기: 분량 기준 1,500자와 한 줄 길이')
    note('')
    const entries = [
      e(
        'domain',
        '부가세는 품목 줄마다 계산해 원 단위 미만을 버리고 합산한다',
        ['부가세', '청구서'],
        ['src/invoice.js'],
      ),
      e(
        'domain',
        '할인은 부가세를 매기기 전에 그 줄에서 뺀다',
        ['할인', '부가세'],
        ['src/invoice.js'],
      ),
      e(
        'domain',
        '반품 전표의 부가세도 줄마다 원 단위 버림이다',
        ['반품', '부가세'],
        ['src/refund.js'],
      ),
      e(
        'domain',
        '청구서 금액은 원 단위 정수이고 소수점 금액을 화면에 보이지 않는다',
        ['청구서', '금액'],
        [],
      ),
      e(
        'recipe',
        '금액 계산은 npm test -- test/invoice.test.js로 확인하고, 회계 대조는 scripts/reconcile.js 2026-09 로 돌린다',
        ['부가세', '대조'],
        ['test/invoice.test.js'],
      ),
      e(
        'failure',
        '총액에 한 번 반올림하면 줄이 많을 때 1~2원 어긋난다',
        ['부가세', '반올림'],
        ['src/invoice.js'],
      ),
      e(
        'constraint',
        '회계 시스템 CSV 열 순서는 고정이다(외부 파서)',
        ['CSV', '회계 시스템'],
        ['src/export/csv.js'],
        { subkind: 'compat' },
      ),
      e(
        'structure',
        '청구서 화면 금액은 src/invoice.js가 아니라 src/view/format.js에서 다시 반올림된다',
        ['청구서', '화면 금액'],
        ['src/invoice.js', 'src/view/format.js'],
      ),
      e(
        'domain',
        '면세 품목은 부가세 0원이고 줄에 면세 표시를 남긴다',
        ['면세', '부가세'],
        ['src/invoice.js'],
      ),
    ]
    const text =
      '청구서 부가세가 회계 시스템과 1~2원 다르다. 할인 품목이 있으면 더 다르다. CSV 대조에서 발견. 반품도 확인.'
    for (const node of ['intake', 'fix', 'verify'] as const) {
      const r = renderKnowledge({
        node,
        pool: pool(entries),
        paths: node === 'verify' ? ['src/invoice.js'] : [],
        text,
        limit: 1500,
        dirs: ['docs/knowledge', STORE],
      })
      const sel = selectKnowledge({
        node,
        pool: pool(entries),
        paths: node === 'verify' ? ['src/invoice.js'] : [],
        text,
      })
      note(
        `- ${node}: 고른 것 ${sel.length}건, 넣은 것 ${r.ids.length}건, 절 ${[...r.text].length}자`,
      )
    }
    const one = renderKnowledge({
      node: 'intake',
      pool: pool(entries.slice(0, 1)),
      paths: [],
      text,
      limit: 1500,
      dirs: [],
    })
    const line = one.text.split('\n').find((l) => l.startsWith('- ')) ?? ''
    note(`- 한 줄 예 (${[...line].length}자): \`${line}\``)
    note(`- 머리글(KNOWLEDGE_NOTE)만 ${[...(one.text.split('\n')[0] ?? '')].length}자`)
    note('')
  })
})

describe.runIf(on)('[탐색] 낡음', () => {
  it('지운 경로와 [그대로 맞음]', () => {
    note('## 낡음: 경로가 지워지거나 옮겨진 항목')
    note('')
    const x = e('failure', '재시도는 src/retry.js 한 곳에서 정한다', ['재시도'], ['src/retry.js'], {
      hashes: { 'src/retry.js': 'aaa' },
    })
    const now = { 'src/retry.js': null }
    note(`- 경로가 없어진 항목: isStale=${isStale(x, now)}`)
    const confirmed = withHashes(x, now)
    note(
      `- [그대로 맞음]으로 해시를 다시 적은 뒤: hashes=${JSON.stringify(confirmed.hashes)}, isStale=${isStale(confirmed, now)}`,
    )
    const dir = e(
      'structure',
      'src/notify/ 밑의 발송은 큐를 거친다',
      ['발송'],
      ['src/notify', 'src/queue.js'],
      { hashes: { 'src/notify': 't1', 'src/queue.js': 'b1' } },
    )
    note(
      `- 디렉터리 경로 항목: 그 밑 아무 파일이 바뀌어도 isStale=${isStale(dir, { 'src/notify': 't2', 'src/queue.js': 'b1' })}`,
    )
    note('')
  })
})

describe.runIf(on)('[탐색] 거르기: 다음 Work가 같은 규칙을 다시 올림', () => {
  it('겹치는 기존 항목이 있어도 기본은 새로 더함', () => {
    note('## 거르기: 넣어 준 규칙을 다음 Work가 다시 올릴 때')
    note('')
    const old = e(
      'domain',
      '부가세는 품목 줄마다 원 단위 버림',
      ['부가세', '버림'],
      ['src/invoice.js'],
    )
    const p = pool([old])
    const review = reviewKnowledge({
      tasks: [
        {
          taskId: 't-01',
          node: 'intake',
          version: 2,
          header: {
            decisions: [],
            knowledge_candidates: [
              {
                kind: 'domain',
                rule: '부가세는 줄마다 계산해 원 단위 미만을 버린다',
                paths: ['src/refund.js'],
                terms: ['부가세', '반품'],
                why: '회계팀 규칙',
                not_in_code: '사람이 정함',
                incentive: '총액 반올림',
              },
            ],
            knowledge_feedback: [],
          } as never,
        },
      ],
      pool: p,
      changed: [],
      share: true,
      dir: 'docs/knowledge/',
      offerPending: true,
    })
    const c = review.candidates[0]
    if (!c) throw new Error('후보 없음')
    note(`- 후보의 겹치는 기존 항목: ${c.overlaps.map((o) => o.id).join(', ') || '없음'}`)
    const plan = planKnowledge({
      review,
      choices: undefined,
      delivery: 'none',
      work: 'w-2',
      task: 't-03',
      pool: p,
      random: () => 'zzzzzzzz',
    })
    note(
      `- 기본 선택으로 [완료만]: 공유 대기에 쓸 것 ${plan.pending.length}건, 지울 것 ${plan.removePending.length}건 → 같은 규칙이 둘이 된다`,
    )
    note('')
  })
})
