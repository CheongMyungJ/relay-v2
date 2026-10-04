import { test } from 'node:test'
import assert from 'node:assert'
import { balanceOn, expiryOf } from '../src/points/ledger.js'

const entries = [
  { type: 'earn', points: 300, at: '2025-10-10T10:00:00+09:00', ref: 'O-0711' },
  { type: 'earn', points: 120, at: '2026-03-02T10:00:00+09:00', ref: 'O-0890' },
  { type: 'use', points: 200, at: '2026-04-01T10:00:00+09:00', ref: 'O-0921' },
]

test('적립일부터 365일 뒤에 사라진다', () => {
  assert.strictEqual(expiryOf(entries[0]), '2026-10-10')
})

test('쓴 포인트는 먼저 적립한 것부터 깎는다', () => {
  assert.strictEqual(balanceOn(entries, '2026-05-01'), 220)
  assert.strictEqual(balanceOn(entries, '2026-10-10'), 120)
})
