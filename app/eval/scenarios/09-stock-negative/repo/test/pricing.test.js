import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatWon, priceOrder, roundDown } from '../src/pricing/price.js'
import { activeAt, couponDiscount, lineDiscount, validatePromotion } from '../src/pricing/promotions.js'

const mouse = { sku: 'A-100', name: '무선 마우스', category: '주변기기', price: 25000 }
const pad = { sku: 'A-120', name: '마우스 패드', category: '주변기기', price: 9000 }
const promos = [
  { id: 'p1', kind: 'percent', category: '주변기기', percent: 10, from: '2026-09-01', to: '2026-10-01' },
  { id: 'p2', kind: 'bundle', sku: 'A-120', buy: 2, free: 1, from: '2026-09-01', to: '2026-10-01' },
]

test('프로모션 기간', () => {
  assert.equal(activeAt(promos, '2026-09-15').length, 2)
  assert.equal(activeAt(promos, '2026-10-01').length, 0)
})

test('줄 할인은 가장 큰 것 하나', () => {
  assert.equal(lineDiscount({ product: mouse, qty: 2 }, promos), 5000)
  // 패드 3개: 10%는 2700, 2+1은 9000
  assert.equal(lineDiscount({ product: pad, qty: 3 }, promos), 9000)
  assert.equal(lineDiscount({ product: pad, qty: 2 }, promos), 1800)
})

test('쿠폰은 최소 금액 이상일 때만', () => {
  assert.equal(couponDiscount({ code: 'W5', percent: 5, minSubtotal: 50000 }, 40000), 0)
  assert.equal(couponDiscount({ code: 'W5', percent: 5, minSubtotal: 50000 }, 60000), 3000)
  assert.throws(() => couponDiscount({ code: 'X', percent: 80 }, 1000))
})

test('주문 금액: 할인, 세금, 10원 단위 버림', () => {
  const p = priceOrder([{ product: mouse, qty: 1 }, { product: pad, qty: 3 }], { promotions: promos, at: '2026-09-15' })
  assert.equal(p.subtotal, 52000)
  assert.equal(p.discount, 2500 + 9000)
  assert.equal(p.tax, 4050)
  assert.equal(p.total, 44550)
})

test('프로모션이 없으면 정가', () => {
  const p = priceOrder([{ product: mouse, qty: 2 }], { at: '2026-09-15', taxRate: 0.1 })
  assert.equal(p.total, 55000)
  assert.equal(roundDown(12345, 10), 12340)
  assert.equal(formatWon(12340), '12,340원')
})

test('잘못된 프로모션', () => {
  assert.throws(() => validatePromotion({ id: 'x', kind: 'percent', percent: 0, from: '2026-01-01', to: '2026-02-01' }))
  assert.throws(() => validatePromotion({ id: 'x', kind: 'bundle', buy: 1, free: 1, from: '2026-02-01', to: '2026-01-01' }))
  assert.equal(validatePromotion(promos[0]), promos[0])
})
