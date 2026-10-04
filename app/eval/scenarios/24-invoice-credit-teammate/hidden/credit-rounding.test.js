import { test } from 'node:test'
import assert from 'node:assert'
import { creditNoteEntries } from '../src/export/ledger.js'
import { creditNoteOf } from './credit-helpers.js'
import { CN_0115, CN_0118 } from './examples.js'

// 회계 규정: 반품 전표의 부가세도 돌려받는 품목 줄마다 원 단위 버림으로 계산하고 그 합을 쓴다

test('CN-0115: 줄마다 버림', () => {
  const t = creditNoteOf(CN_0115).totals
  assert.strictEqual(t.supply, 13228)
  assert.strictEqual(t.vat, 1321)
  assert.strictEqual(t.total, 14549)
})

test('CN-0118: 면세 품목이 섞여도 과세 줄마다 버림', () => {
  const t = creditNoteOf(CN_0118).totals
  assert.strictEqual(t.taxable, 13635)
  assert.strictEqual(t.exempt, 16800)
  assert.strictEqual(t.vat, 1362)
  assert.strictEqual(t.total, 31797)
})

test('CN-0115 분개: 부가세예수금이 회계팀 계산과 같다', () => {
  const entries = creditNoteEntries(creditNoteOf(CN_0115))
  assert.deepStrictEqual(
    entries.map((e) => [e.account, e.debit, e.credit]),
    [
      ['매출환입', 13228, 0],
      ['부가세예수금', 1321, 0],
      ['외상매출금', 0, 14549],
    ],
  )
})
