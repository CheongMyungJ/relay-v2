import { test } from 'node:test'
import assert from 'node:assert'
import { invoiceLines, vat } from '../src/invoice.js'

test('부가세는 공급가액의 10%', () => assert.strictEqual(vat(12000), 1200))
test('청구서 줄', () =>
  assert.deepStrictEqual(invoiceLines(12340), [
    '공급가액 12,340원',
    '부가세 1,234원',
    '합계 13,574원',
  ]))
