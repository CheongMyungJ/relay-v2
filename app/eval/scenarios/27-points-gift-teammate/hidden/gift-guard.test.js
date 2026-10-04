import { test } from 'node:test'
import assert from 'node:assert'
import { receiptLines } from '../src/format/receipt.js'
import { createGiftOrder } from '../src/gift/gift-order.js'

// 지키기: 선물 주문의 금액, 메시지 카드, 받는 사람 검사, 영수증 글자는 그대로여야 한다

const base = { customerId: 'U-7', recipient: { name: '오지민', phone: '010-2233-4455' } }

test('선물 주문 금액과 받는 사람', () => {
  const g = createGiftOrder({ ...base, number: 'G-0310', message: '고마워', lines: [{ sku: 'A', unitPrice: 9900, qty: 2 }], coupon: { code: 'C', amount: 1000 } })
  assert.deepStrictEqual(g.amounts, { goods: 19800, coupon: 1000, shipping: 3000, pointsUsed: 0, total: 21800 })
  assert.deepStrictEqual(g.recipient, { name: '오지민', phone: '010-2233-4455' })
  assert.strictEqual(g.message, '고마워')
})

test('메시지 카드와 전화번호 검사', () => {
  assert.doesNotThrow(() => createGiftOrder({ ...base, number: 'G-0311', message: '가'.repeat(60), lines: [{ sku: 'A', unitPrice: 9900 }] }))
  assert.throws(() => createGiftOrder({ ...base, number: 'G-0312', message: '가'.repeat(61), lines: [{ sku: 'A', unitPrice: 9900 }] }), /60자/)
  assert.throws(() => createGiftOrder({ ...base, number: 'G-312', lines: [{ sku: 'A', unitPrice: 9900 }] }), /G-0000/)
})

test('저장된 선물 주문의 영수증', () => {
  const stored = {
    number: 'G-0199',
    amounts: { goods: 24860, coupon: 2000, shipping: 3000, pointsUsed: 1000, total: 24860 },
    points: { used: 1000, earned: 249 },
  }
  assert.strictEqual(receiptLines(stored)[0], '선물 G-0199')
  assert.strictEqual(receiptLines(stored).at(-1), '적립 예정             249P')
})
