import { test } from 'node:test'
import assert from 'node:assert'
import { orderAmounts } from '../src/order.js'

test('5만 원 미만은 배송비 3,000원', () => {
  const o = { items: [{ unitPrice: 10000, qty: 2 }], address: { zip: '06236' } }
  assert.deepStrictEqual(orderAmounts(o), { items: 20000, shipping: 3000, paid: 23000 })
})

test('5만 원 이상은 무료, 도서산간은 3,000원 더', () => {
  const o = { items: [{ unitPrice: 25000, qty: 2 }], address: { zip: '63100' } }
  assert.deepStrictEqual(orderAmounts(o), { items: 50000, shipping: 3000, paid: 53000 })
})
