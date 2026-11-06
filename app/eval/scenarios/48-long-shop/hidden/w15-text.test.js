import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paidOrder, shop, won } from './shop-setup.js'

test('월간 매출 글', () => {
  const s = shop('2026-03-10T03:00:00Z')
  s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 55000 }] })
  const o = paidOrder(s, 'c-1', [['MUG', 1], ['TEA', 1]], { coupon: 'SPRING5' })
  s.orders.cancelLines(o.id, [{ sku: 'MUG', qty: 1 }])
  const r = s.billing.monthlyReport('2026-03')
  assert.equal(
    s.billing.monthlyReportText('2026-03'),
    [
      '2026-03 매출',
      `송장 2건 ${won(r.invoiced)}`,
      '전표 1건 -10,572원',
      `순매출 ${won(r.net)}`,
      `부가세 ${won(r.vat)}`,
    ].join('\n'),
  )
})

test('전표가 없는 달', () => {
  const s = shop('2026-03-10T03:00:00Z')
  s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 11000 }] })
  assert.equal(
    s.billing.monthlyReportText('2026-03'),
    ['2026-03 매출', '송장 1건 11,000원', '전표 0건 0원', '순매출 11,000원', '부가세 1,000원'].join('\n'),
  )
})
