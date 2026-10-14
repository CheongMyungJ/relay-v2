import { test } from 'node:test'
import assert from 'node:assert'
import { canStack, couponExpired, discountAmount, refundCoupon } from '../src/coupon.js'

const order = { items: [{ price: 12000, qty: 2 }], shipping: 3000 }

test('정률 할인은 원 단위 버림', () => {
  assert.equal(discountAmount({ items: [{ price: 10001, qty: 1 }] }, { type: 'rate', value: 0.1 }), 1000)
})

test('최소 주문 금액은 배송비를 빼고 본다', () => {
  assert.equal(discountAmount({ items: [{ price: 9000, qty: 1 }], shipping: 3000 }, { type: 'fixed', value: 1000 }), 0)
})

test('상한 50%', () => {
  assert.equal(discountAmount(order, { type: 'fixed', value: 20000 }), 12000)
})

test('쿠폰은 하나만', () => {
  assert.equal(canStack([]), true)
  assert.equal(canStack([{ id: 1 }]), false)
})

test('만료는 KST 자정', () => {
  const c = { expiresOn: '2026-10-31' }
  assert.equal(couponExpired(c, new Date('2026-10-31T14:59:59Z')), false)
  assert.equal(couponExpired(c, new Date('2026-10-31T15:00:00Z')), true)
})

test('환불하면 쿠폰을 되돌려 준다', () => {
  const c = { id: 7, expiresOn: '2026-12-31', used: true }
  assert.deepEqual(refundCoupon(c, new Date('2026-10-01T00:00:00Z')), { ...c, used: false })
})
