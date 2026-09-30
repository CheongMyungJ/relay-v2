import { test } from 'node:test'
import assert from 'node:assert'
import { createInvoice } from '../src/invoice/invoice.js'
import { computeTotals } from '../src/invoice/total.js'
import { INV_2047, INV_2052 } from './examples.js'

// 할인은 부가세 전에 줄마다 적용하고, 할인된 줄 금액으로 부가세를 줄마다 버림해 더한다
const totals = (data) => computeTotals(createInvoice(data))

test('INV-2047: 금액 할인과 비율 할인', () => {
  const t = totals(INV_2047)
  assert.strictEqual(t.subtotal, 60151)
  assert.strictEqual(t.discount, 2145)
  assert.strictEqual(t.supply, 58006)
  assert.strictEqual(t.vat, 5798)
  assert.strictEqual(t.total, 63804)
})

test('INV-2052: 할인 줄이 둘', () => {
  const t = totals(INV_2052)
  assert.strictEqual(t.subtotal, 40356)
  assert.strictEqual(t.discount, 2929)
  assert.strictEqual(t.supply, 37427)
  assert.strictEqual(t.vat, 3740)
  assert.strictEqual(t.total, 41167)
})
