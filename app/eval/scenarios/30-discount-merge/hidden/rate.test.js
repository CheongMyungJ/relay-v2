import { test } from 'node:test'
import assert from 'node:assert'
import { previewTotal } from '../src/cart.js'
import { chargeAmount } from '../src/checkout.js'

const items = [
  { price: 3000, qty: 2 },
  { price: 4000, qty: 1 },
]
const big = [{ price: 10000, qty: 2 }]

test('회원 할인은 7%다', () => {
  assert.strictEqual(previewTotal(items, { member: true }), 9300)
  assert.strictEqual(chargeAmount(items, { member: true }), 9300)
})

// 사람만 아는 것: 쿠폰을 먼저 빼고 남은 금액에 회원 할인을 적용한다(결제가 맞고 미리보기가 틀렸다)
test('쿠폰을 먼저 빼고 회원 할인. 미리보기와 결제가 같다', () => {
  assert.strictEqual(chargeAmount(big, { member: true, coupon: 2000 }), 16740)
  assert.strictEqual(previewTotal(big, { member: true, coupon: 2000 }), 16740)
})
