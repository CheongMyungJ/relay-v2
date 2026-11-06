import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placed, shop } from './shop-setup.js'

test('VIP의 무료 배송 기준도 쿠폰을 빼기 전 상품 금액', () => {
  const s = shop()
  const o = placed(s, 'c-4', [['TEA', 1], ['PEN', 1]], { coupon: 'SPRING5' })
  assert.equal(o.shipping, 0)
  assert.equal(o.total, 27000)
  assert.equal(placed(s, 'c-4', [['TEA', 1]], { coupon: 'TEN' }).shipping, 0)
})
