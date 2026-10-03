import { test } from 'node:test'
import assert from 'node:assert'
import { balance, usablePoints } from '../src/points.js'

const ledger = [
  { type: 'earn', remaining: 1000, expiresOn: '2026-10-31' },
  { type: 'earn', remaining: 500, expiresOn: '2027-01-31' },
]

test('유효기간이 지난 포인트는 쓸 수 없다', () => {
  assert.strictEqual(usablePoints(ledger, '2026-10-15T03:00:00Z'), 1500)
  assert.strictEqual(usablePoints(ledger, '2026-11-15T03:00:00Z'), 500)
  assert.strictEqual(balance(ledger), 1500)
})
