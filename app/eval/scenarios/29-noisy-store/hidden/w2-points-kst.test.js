import { test } from 'node:test'
import assert from 'node:assert'
import { usablePoints } from '../src/points.js'

// 팀 규칙: 날짜 경계는 KST 자정. 유효기간은 그날 KST 23:59:59까지
const ledger = [
  { type: 'earn', remaining: 1200, expiresOn: '2026-10-31' },
  { type: 'earn', remaining: 300, expiresOn: '2027-03-02' },
]
test('포인트 유효기간은 KST 날짜로 센다', () => {
  assert.strictEqual(usablePoints(ledger, '2026-10-31T14:59:59Z'), 1500)
  assert.strictEqual(usablePoints(ledger, '2026-10-31T15:00:00Z'), 300)
  assert.strictEqual(usablePoints(ledger, '2026-10-31T22:10:00Z'), 300)
  assert.strictEqual(usablePoints(ledger, '2026-10-31T01:00:00Z'), 1500)
})
