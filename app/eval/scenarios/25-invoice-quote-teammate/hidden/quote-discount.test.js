import { test } from 'node:test'
import assert from 'node:assert'
import { createQuote, quoteTotals } from '../src/invoice/quote.js'
import { Q_0462 } from './quote-examples.js'

// 회계 규정: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 매긴다

test('Q-0462: 할인된 줄 금액에 줄마다 버림', () => {
  const q = createQuote(Q_0462)
  assert.deepStrictEqual(q.totals, { supply: 94259, taxable: 61944, exempt: 32315, vat: 6192, total: 100451 })
  assert.deepStrictEqual(quoteTotals(q), q.totals)
})
