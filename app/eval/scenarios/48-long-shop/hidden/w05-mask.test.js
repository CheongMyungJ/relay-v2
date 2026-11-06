import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shop } from './shop-setup.js'

test('내보내는 CSV의 전화번호는 가운데를 가리고 뒤 4자리만', () => {
  const s = shop()
  s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 55000 }] })
  s.billing.issueManualInvoice({ customerId: 'c-4', lines: [{ name: '납품', amount: 11000 }] })
  const csv = s.billing.overdueCsv('2026-04-10T02:00:00Z')
  const phones = csv.trim().split('\n').slice(1).map((l) => l.split(',')[2])
  assert.deepEqual(phones.sort(), ['010-****-4040', '010-****-5678'])
  assert.doesNotMatch(csv, /1234-5678|3030-4040/)
})
