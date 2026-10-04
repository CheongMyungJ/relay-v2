import { test } from 'node:test'
import assert from 'node:assert'
import { receiptLines } from '../src/format/receipt.js'
import { balanceOn } from '../src/points/ledger.js'

// 지키기: 이미 적립된 포인트(저장된 값)는 다시 계산하지 않는다

test('포인트 내역의 잔액은 저장된 값 그대로', () => {
  const entries = [
    { type: 'earn', points: 237, at: '2026-10-02T14:31:00+09:00', ref: 'O-1042' },
    { type: 'earn', points: 403, at: '2026-09-21T09:12:00+09:00', ref: 'O-1077' },
    { type: 'recover', points: 132, at: '2026-09-28T09:12:00+09:00', ref: 'R-0311' },
  ]
  assert.strictEqual(balanceOn(entries, '2026-10-20'), 508)
})

test('저장된 주문의 영수증은 저장된 적립 포인트를 그대로 보인다', () => {
  const order = {
    number: 'O-1042',
    amounts: { goods: 28270, coupon: 3000, shipping: 3000, pointsUsed: 1500, total: 26770 },
    points: { used: 1500, earned: 237 },
  }
  assert.strictEqual(receiptLines(order).at(-1), '적립 예정             237P')
})
