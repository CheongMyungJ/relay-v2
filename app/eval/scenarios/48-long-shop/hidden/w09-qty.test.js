import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, placed, shop } from './shop-setup.js'

const lines = (cart) => cart.lines().map((l) => [l.sku, l.qty])

test('취소한 수량은 다시 담지 않는다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 3], ['PEN', 2], ['TEA', 1]])
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }, { sku: 'PEN', qty: 2 }])
  const { cart, skipped } = s.orders.reorder(o.id)
  assert.deepEqual(lines(cart), [['MUG', 2], ['TEA', 1]])
  assert.deepEqual(skipped, [])
})

test('재고가 모자라면 있는 만큼만 담고 skipped로 알린다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['BAG', 3], ['MUG', 1]]) // 에코백 재고 5 → 2
  placed(s, 'c-3', [['BAG', 1]]) // → 1
  const { cart, skipped } = s.orders.reorder(o.id)
  assert.deepEqual(lines(cart), [['BAG', 1], ['MUG', 1]])
  assert.deepEqual(skipped.map((x) => x.sku), ['BAG'])
})

test('재고가 없으면 담지 않고 skipped로', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['BAG', 5], ['PEN', 1]])
  const { cart, skipped } = s.orders.reorder(o.id)
  assert.deepEqual(lines(cart), [['PEN', 1]])
  assert.deepEqual(skipped.map((x) => x.sku), ['BAG'])
})
