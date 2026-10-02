import { test } from 'node:test'
import assert from 'node:assert'
import { lineDiscount } from '../src/invoice/discount.js'
import { lineGross, mergeSameLines, normalizeLine } from '../src/invoice/line.js'

test('품목 줄 기본값', () => {
  const line = normalizeLine({ name: ' 볼펜 ', unitPrice: 300 })
  assert.deepStrictEqual(line, { sku: null, name: '볼펜', unitPrice: 300, qty: 1, taxType: 'taxable' })
})

test('잘못된 품목 줄', () => {
  assert.throws(() => normalizeLine({ name: '', unitPrice: 100 }), /이름/)
  assert.throws(() => normalizeLine({ name: 'x', unitPrice: 10.5 }), /정수/)
  assert.throws(() => normalizeLine({ name: 'x', unitPrice: 100, qty: 0 }), /수량/)
  assert.throws(() => normalizeLine({ name: 'x', unitPrice: 100, taxType: 'zero' }), /과세 구분/)
  assert.throws(() => normalizeLine({ name: 'x', unitPrice: 100, discount: { rate: 3 } }), /할인/)
})

test('할인 금액', () => {
  const pct = normalizeLine({ name: '복사용지', unitPrice: 5000, qty: 4, discount: { percent: 10 } })
  const amt = normalizeLine({ name: '토너', unitPrice: 48000, discount: { amount: 3000 } })
  assert.strictEqual(lineGross(pct), 20000)
  assert.strictEqual(lineDiscount(pct), 2000)
  assert.strictEqual(lineDiscount(amt), 3000)
  assert.strictEqual(lineDiscount(normalizeLine({ name: '가위', unitPrice: 2780 })), 0)
})

test('할인이 품목 금액보다 크면 오류', () => {
  const line = normalizeLine({ name: '지우개', unitPrice: 400, discount: { amount: 500 } })
  assert.throws(() => lineDiscount(line), /할인/)
})

test('같은 품목 합치기', () => {
  const lines = [
    { sku: 'A', name: '볼펜', unitPrice: 300, qty: 2, taxType: 'taxable' },
    { sku: 'B', name: '지우개', unitPrice: 400, qty: 1, taxType: 'taxable' },
    { sku: 'A', name: '볼펜', unitPrice: 300, qty: 3, taxType: 'taxable' },
    { sku: null, name: '배송비', unitPrice: 3000, qty: 1, taxType: 'taxable' },
  ]
  const merged = mergeSameLines(lines)
  assert.deepStrictEqual(
    merged.map((l) => [l.sku, l.qty]),
    [['A', 5], ['B', 1], [null, 1]],
  )
  assert.strictEqual(lines[0].qty, 2)
})
