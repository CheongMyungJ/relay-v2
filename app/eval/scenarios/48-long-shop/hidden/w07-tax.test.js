import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lineVat } from '../src/shared/tax.js'
import { paidOrder, shop } from './shop-setup.js'

test('lineVat: 부가세 포함 금액의 부가세, 면세 0, 원 미만 버림', () => {
  assert.equal(lineVat(11000), 1000)
  assert.equal(lineVat(11000, 'standard'), 1000)
  assert.equal(lineVat(3000, 'standard'), 272)
  assert.equal(lineVat(20000, 'exempt'), 0)
  assert.equal(lineVat(10), 0)
  assert.equal(lineVat(0), 0)
})

test('주문과 송장의 부가세가 같다', () => {
  const s = shop()
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['RICE', 2], ['SOAP', 1]], { coupon: 'SPRING5' })
  const invoice = s.billing.invoiceForOrder(o.id)
  assert.equal(invoice.vat, o.vat)
  for (const l of o.lines) {
    assert.equal(invoice.lines.find((x) => x.name === l.name).vat, lineVat(l.amount, l.taxClass))
  }
  assert.equal(o.vat, lineVat(12000) + lineVat(12345) + lineVat(o.shipping))
})
