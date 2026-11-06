import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatWon, quote, quoteText, shippingFee } from '../src/orders/pricing.js'
import { cartOf, setup } from './helpers.js'

test('금액 표시', () => {
  assert.equal(formatWon(0), '0원')
  assert.equal(formatWon(1234567), '1,234,567원')
  assert.equal(formatWon(-5000), '-5,000원')
})

test('기본 배송비와 무료 배송', () => {
  const lines = [{ sku: 'A', price: 10000, qty: 1, weightG: 100 }]
  assert.equal(shippingFee({ itemsTotal: 10000, region: 'seoul', lines }), 3000)
  assert.equal(shippingFee({ itemsTotal: 60000, region: 'seoul', lines }), 0)
  assert.equal(shippingFee({ itemsTotal: 0, region: 'seoul', lines: [] }), 0)
})

test('제주는 추가 배송비가 붙는다', () => {
  const lines = [{ sku: 'A', price: 60000, qty: 1, weightG: 100 }]
  assert.equal(shippingFee({ itemsTotal: 60000, region: 'jeju', lines }), 3000)
  assert.equal(shippingFee({ itemsTotal: 60000, region: 'island', lines }), 5000)
})

test('무거운 짐은 추가 요금', () => {
  const lines = [{ sku: 'R', price: 33000, qty: 3, weightG: 10000 }]
  assert.equal(shippingFee({ itemsTotal: 99000, region: 'seoul', lines }), 2000)
})

test('주문 금액과 부가세(면세 상품은 부가세 없음)', () => {
  const shop = setup()
  const q = quote(cartOf(shop, [['MUG', 1], ['RICE', 1]]).lines(), { region: 'seoul' })
  assert.equal(q.itemsTotal, 45000)
  assert.equal(q.shipping, 3000)
  assert.equal(q.total, 48000)
  // 머그컵 12,000원의 부가세 1,090원 + 배송비 3,000원의 부가세 272원
  assert.equal(q.vat, 1090 + 272)
  assert.deepEqual(q.lines.map((l) => l.vat), [1090, 0])
})

test('쿠폰 할인', () => {
  const shop = setup()
  const q = quote(cartOf(shop, [['TEA', 2]]).lines(), { coupon: { code: 'PCT10', discount: 6000 } })
  assert.equal(q.discount, 6000)
  assert.equal(q.total, 54000)
  assert.equal(q.couponCode, 'PCT10')
})

test('금액 요약 글', () => {
  const shop = setup()
  const q = quote(cartOf(shop, [['MUG', 2]]).lines(), { coupon: { code: 'WELCOME', discount: 3000 } })
  assert.equal(
    quoteText(q),
    [
      '머그컵 x2  24,000원',
      '상품 합계  24,000원',
      '할인(WELCOME)  -3,000원',
      '배송비  3,000원',
      '합계  24,000원',
      '(부가세 2,453원 포함)',
    ].join('\n'),
  )
})
