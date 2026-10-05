// 파트너 정산의 연체료는 원 단위 내림이다(파트너 계약). 고객 쪽(반올림)과 다르다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partnerPayout } from '../src/partners/payout.js'
import { resetStore } from '../src/rentals/store.js'

const base = {
  memberId: 'M-1',
  toolId: 'T-201',
  toolName: '접이식 사다리 2m',
  dailyRate: 3333,
  deposit: 20000,
  startDate: '2026-09-01',
  dueDate: '2026-09-04',
  extensions: 0,
  charges: [{ kind: 'rent', amount: 10000 }],
}

test('파트너 몫의 연체료는 내림으로 계산한다', () => {
  resetStore([
    { ...base, id: 'R-1', returnedOn: '2026-09-07' }, // 3,333 × 3 ÷ 2 = 4,999.5 → 4,999 → × 0.7 = 3,499
    { ...base, id: 'R-2', returnedOn: '2026-09-09' }, // 3,333 × 5 ÷ 2 = 8,332.5 → 8,332 → × 0.7 = 5,832
  ])
  const p = partnerPayout('P-2', '2026-09')
  assert.deepEqual(
    p.items.map((i) => [i.rentalId, i.late]),
    [
      ['R-1', 3499],
      ['R-2', 5832],
    ],
  )
  assert.equal(p.total, 7000 + 3499 + 7000 + 5832)
})
