import { test } from 'node:test'
import assert from 'node:assert'
import { invoiceLines, vat } from '../src/invoice.js'

// 사람만 아는 것: 부가세는 원 단위 사사오입(0.5는 올림)이 회계 규정이다
test('부가세의 0.5원은 올린다 (사사오입)', () => {
  assert.strictEqual(vat(12345), 1235)
  assert.strictEqual(vat(12365), 1237)
  assert.deepStrictEqual(invoiceLines(12345), ['공급가액 12,345원', '부가세 1,235원', '합계 13,580원'])
})
