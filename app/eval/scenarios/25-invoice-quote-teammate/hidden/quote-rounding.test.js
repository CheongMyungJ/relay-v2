import { test } from 'node:test'
import assert from 'node:assert'
import { createQuote } from '../src/invoice/quote.js'
import { Q_0457, Q_0460 } from './quote-examples.js'

// 회계 규정: 견적서도 부가세는 과세 품목 줄마다 원 단위 버림으로 계산하고 그 합을 쓴다

test('Q-0460: 할인 없는 견적의 줄마다 버림', () => {
  const t = createQuote(Q_0460).totals
  assert.strictEqual(t.supply, 20518)
  assert.strictEqual(t.vat, 2049)
  assert.strictEqual(t.total, 22567)
})

test('Q-0457: 리포트의 견적서가 경리 계산과 같다', () => {
  const t = createQuote(Q_0457).totals
  assert.strictEqual(t.vat, 3587)
  assert.strictEqual(t.total, 56278)
})
