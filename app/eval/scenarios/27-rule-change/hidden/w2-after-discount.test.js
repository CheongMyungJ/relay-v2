import { test } from 'node:test'
import assert from 'node:assert'
import { checkoutAmounts } from '../src/checkout.js'

// 바뀐 기준(Work 2): 쿠폰 할인 후 금액이 5만 원 이상이면 무료
test('할인 후 금액으로 무료배송을 정한다', () => {
  const c20 = { items: [{ price: 52000, qty: 1 }], coupon: { type: 'amount', value: 5000 } }
  assert.deepStrictEqual(checkoutAmounts(c20), { items: 52000, discount: 5000, shipping: 3000, pay: 50000 })
  const big = { items: [{ price: 60000, qty: 1 }], coupon: { type: 'amount', value: 5000 } }
  assert.strictEqual(checkoutAmounts(big).shipping, 0)
  const pct = { items: [{ price: 54000, qty: 1 }], coupon: { type: 'percent', value: 10 } }
  assert.strictEqual(checkoutAmounts(pct).shipping, 3000)
})
