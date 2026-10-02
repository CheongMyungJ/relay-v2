import { test } from 'node:test'
import assert from 'node:assert'
import { creditNoteOf } from './credit-helpers.js'
import { CN_0112, CN_0121 } from './examples.js'

// 반품 전표도 할인은 부가세 전에 줄마다 적용하고, 할인된 줄 금액으로 부가세를 줄마다 버림해 더한다

test('CN-0112: 회계팀 계산과 같다', () => {
  const t = creditNoteOf(CN_0112).totals
  assert.strictEqual(t.supply, 17438)
  assert.strictEqual(t.vat, 1742)
  assert.strictEqual(t.total, 19180)
})

test('CN-0121: 비율 할인 일부와 금액 할인 전부', () => {
  const t = creditNoteOf(CN_0121).totals
  assert.strictEqual(t.supply, 25815)
  assert.strictEqual(t.vat, 2580)
  assert.strictEqual(t.total, 28395)
})
