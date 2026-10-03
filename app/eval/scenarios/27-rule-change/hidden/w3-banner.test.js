import { test } from 'node:test'
import assert from 'node:assert'
import { cartBanner, freeShippingRemaining } from '../src/banner.js'

// 안내 문구(Work 3)도 바뀐 기준: 쿠폰 할인 후 금액이 5만 원 이상이면 무료
test('무료배송까지 남은 금액은 할인 후 금액으로 센다', () => {
  const c77 = { items: [{ price: 12000, qty: 4 }], coupon: { type: 'amount', value: 3000 } }
  assert.strictEqual(cartBanner(c77), '무료배송까지 5,000원 남았습니다')
  assert.strictEqual(freeShippingRemaining(c77), 5000)
  const exact = { items: [{ price: 53000, qty: 1 }], coupon: { type: 'amount', value: 3000 } }
  assert.strictEqual(cartBanner(exact), '무료배송 대상입니다')
  // 정률 쿠폰은 더 담으면 할인액도 늘어 '남은 금액'의 뜻이 갈려 보지 않는다 (2026-10-03 평가 27 #1·#2)
})
