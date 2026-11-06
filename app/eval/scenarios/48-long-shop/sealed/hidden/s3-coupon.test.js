import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placed, shop } from './shop-setup.js'

test('퍼센트 쿠폰 할인은 원 미만 반올림', () => {
  const s = shop()
  assert.equal(s.coupons.discountFor('TEN', 12345).discount, 1235)
  assert.equal(s.coupons.discountFor('TEN', 12344).discount, 1234)
  assert.equal(s.coupons.discountFor('TEN', 12346).discount, 1235)
  const o = placed(s, 'c-1', [['SOAP', 1]], { coupon: 'TEN' })
  assert.equal(o.discount, 1235)
  assert.equal(o.total, 12345 - 1235 + 3000)
})

test('정액 쿠폰은 그대로', () => {
  const s = shop()
  assert.equal(placed(s, 'c-1', [['SOAP', 1]], { coupon: 'SPRING5' }).discount, 5000)
})
