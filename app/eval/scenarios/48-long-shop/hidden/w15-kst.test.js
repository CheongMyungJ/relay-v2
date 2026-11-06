import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shop } from './shop-setup.js'

const issue = (s, amount) => s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount }] })

test('월은 한국 시간으로 가른다', () => {
  const s = shop('2026-02-28T16:30:00Z') // 3월 1일 01:30
  issue(s, 11000)
  s.clock.set('2026-02-28T14:30:00Z') // 2월 28일 23:30
  issue(s, 22000)
  s.clock.set('2026-03-31T15:30:00Z') // 4월 1일 00:30
  issue(s, 33000)
  assert.equal(s.billing.monthlyReport('2026-02').invoiced, 22000)
  assert.equal(s.billing.monthlyReport('2026-03').invoiced, 11000)
  assert.equal(s.billing.monthlyReport('2026-04').invoiced, 33000)
})
