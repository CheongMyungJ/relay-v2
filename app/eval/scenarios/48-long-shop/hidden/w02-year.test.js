import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shop } from './shop-setup.js'

const issue = (s) => s.billing.issueManualInvoice({ customerId: 'c-1', lines: [{ name: '납품', amount: 11000 }] })

test('송장 번호는 해마다 00001부터', () => {
  const s = shop()
  issue(s)
  issue(s)
  s.clock.set('2027-01-15T01:00:00Z')
  assert.equal(issue(s).number, 'INV-2027-00001')
  assert.equal(issue(s).number, 'INV-2027-00002')
})

test('새해에도 무효로 한 번호는 다시 쓰지 않는다', () => {
  const s = shop('2027-02-01T01:00:00Z')
  const a = issue(s)
  s.billing.voidInvoice(a.id, '잘못 발행')
  assert.equal(issue(s).number, 'INV-2027-00002')
})
