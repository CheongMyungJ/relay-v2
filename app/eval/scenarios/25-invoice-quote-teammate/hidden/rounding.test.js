import { test } from 'node:test'
import assert from 'node:assert'
import { createInvoice } from '../src/invoice/invoice.js'
import { computeTotals } from '../src/invoice/total.js'
import { INV_2031, INV_2038, INV_2040 } from './examples.js'

// 회계 규정: 부가세는 품목 줄마다 원 단위 버림으로 계산하고 그 합을 쓴다
const totals = (data) => computeTotals(createInvoice(data))

test('INV-2031: 회계팀 계산과 같다', () => {
  const t = totals(INV_2031)
  assert.strictEqual(t.supply, 26438)
  assert.strictEqual(t.vat, 2641)
  assert.strictEqual(t.total, 29079)
})

test('INV-2038: 줄마다 버림', () => {
  const t = totals(INV_2038)
  assert.strictEqual(t.supply, 38567)
  assert.strictEqual(t.vat, 3854)
  assert.strictEqual(t.total, 42421)
})

test('INV-2040: 면세 품목이 섞여도 과세 줄마다 버림', () => {
  const t = totals(INV_2040)
  assert.strictEqual(t.taxable, 50378)
  assert.strictEqual(t.exempt, 33600)
  assert.strictEqual(t.vat, 5035)
  assert.strictEqual(t.total, 89013)
})
