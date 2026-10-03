import { test } from 'node:test'
import assert from 'node:assert'
import { balance, usablePoints } from '../src/points.js'

// 지키기: 잔액과 기간 한가운데
test('잔액과 한낮의 사용 가능 포인트는 그대로', () => {
  const ledger = [
    { type: 'earn', remaining: 1000, expiresOn: '2026-10-31' },
    { type: 'use', remaining: 0, expiresOn: '2026-10-31' },
    { type: 'earn', remaining: 500, expiresOn: '2027-01-31' },
  ]
  assert.strictEqual(usablePoints(ledger, '2026-10-15T03:00:00Z'), 1500)
  assert.strictEqual(usablePoints(ledger, '2026-11-15T03:00:00Z'), 500)
  assert.strictEqual(balance(ledger), 1500)
})
