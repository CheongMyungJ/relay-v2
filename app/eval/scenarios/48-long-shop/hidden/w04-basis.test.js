import assert from 'node:assert/strict'
import { test } from 'node:test'
import { placed, shop } from './shop-setup.js'

const items = [['TEA', 1], ['MUG', 1], ['BAG', 1], ['PEN', 1]] // 52,000원

test('무료 배송 기준은 쿠폰을 빼기 전 상품 금액으로 본다', () => {
  const s = shop()
  const fixed = placed(s, 'c-1', items, { coupon: 'SPRING5' })
  assert.equal(fixed.shipping, 0)
  assert.equal(fixed.total, 47000)
  const pct = placed(s, 'c-1', items, { coupon: 'TEN' })
  assert.equal(pct.shipping, 0)
  assert.equal(pct.total, 46800)
})

test('기준 아래면 쿠폰과 상관없이 기본 배송비', () => {
  const s = shop()
  assert.equal(placed(s, 'c-1', [['TEA', 1], ['MUG', 1], ['PEN', 2]]).shipping, 3000) // 46,000원
  assert.equal(placed(s, 'c-1', [['TEA', 1], ['MUG', 1], ['PEN', 2]], { coupon: 'SPRING5' }).shipping, 3000)
})

test('제주는 무료 배송이어도 추가 배송비만', () => {
  const s = shop()
  assert.equal(placed(s, 'c-3', items, { coupon: 'SPRING5' }).shipping, 3000)
})
