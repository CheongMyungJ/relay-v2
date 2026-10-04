import { test } from 'node:test'
import assert from 'node:assert'
import { createQuote, isQuoteExpired, quoteValidUntil } from '../src/invoice/quote.js'

// 지키기: 영세율과 면세, 끝자리가 0인 견적, 견적 번호와 유효 기간은 그대로여야 한다

const base = { customerId: 'C-0412', issueDate: '2026-10-01' }

test('영세율 견적: 부가세 0', () => {
  const q = createQuote({
    ...base,
    number: 'Q-0470',
    zeroRated: true,
    lines: [
      { sku: 'OF-1675', name: '수정테이프', unitPrice: 1675, qty: 9 },
      { sku: 'OF-7365', name: 'A4 라벨지', unitPrice: 7365, qty: 3, discount: { percent: 20 } },
    ],
  })
  assert.deepStrictEqual(q.totals, { supply: 32751, taxable: 32751, exempt: 0, vat: 0, total: 32751 })
})

test('면세 품목만: 부가세 0', () => {
  const q = createQuote({
    ...base,
    number: 'Q-0471',
    lines: [{ sku: 'BK-1680', name: '세무 실무 가이드', unitPrice: 16800, qty: 3, discount: { amount: 1285 }, taxType: 'exempt' }],
  })
  assert.deepStrictEqual(q.totals, { supply: 49115, taxable: 0, exempt: 49115, vat: 0, total: 49115 })
})

test('줄 금액 끝자리가 0이면 계산 방식과 상관없이 같은 금액', () => {
  const q = createQuote({
    ...base,
    number: 'Q-0472',
    lines: [
      { sku: 'OF-2763', name: 'A4 복사용지 박스', unitPrice: 27630, qty: 3 },
      { sku: 'FD-1347', name: '커피믹스 100입', unitPrice: 13470, qty: 4, discount: { amount: 1940 } },
      { sku: 'OF-1450', name: '포스트잇', unitPrice: 1450, qty: 10, discount: { percent: 10 } },
    ],
  })
  assert.deepStrictEqual(q.totals, { supply: 147880, taxable: 147880, exempt: 0, vat: 14788, total: 162668 })
})

test('견적 번호와 유효 기간', () => {
  const q = createQuote({ ...base, number: 'Q-0473', validDays: 30, lines: [{ name: '토너', unitPrice: 48000, qty: 1 }] })
  assert.strictEqual(quoteValidUntil(q), '2026-10-30')
  assert.strictEqual(isQuoteExpired(q, '2026-10-31'), true)
  assert.throws(() => createQuote({ ...base, number: 'Q-47', lines: [{ name: '토너', unitPrice: 48000 }] }), /Q-0000/)
  assert.throws(() => createQuote({ ...base, number: 'Q-0474', validDays: 0, lines: [{ name: '토너', unitPrice: 48000 }] }), /유효 기간/)
})
