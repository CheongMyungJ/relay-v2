import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasCode, isDomainError, paidOrder, shop } from './shop-setup.js'

test('주문에 없는 상품이나 남은 수량보다 많이 취소하면 BAD_QTY', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 2], ['TEA', 1]])
  assert.throws(() => s.orders.cancelLines(o.id, [{ sku: 'PEN', qty: 1 }]), hasCode('BAD_QTY'))
  assert.throws(() => s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 3 }]), hasCode('BAD_QTY'))
  assert.throws(() => s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 0 }]), hasCode('BAD_QTY'))
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  assert.throws(() => s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 2 }]), hasCode('BAD_QTY'))
  // 실패한 요청은 아무것도 바꾸지 않는다
  assert.equal(s.orders.getOrder(o.id).lines.find((l) => l.sku === 'MUG').cancelledQty, 1)
  assert.equal(s.catalog.get('MUG').stock, 49)
})

test('배송이 시작된 주문은 일부 취소할 수 없다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 2], ['TEA', 1]])
  s.orders.ship(o.id)
  assert.throws(() => s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }]), isDomainError)
  assert.equal(s.orders.getOrder(o.id).refunded, 0)
})
