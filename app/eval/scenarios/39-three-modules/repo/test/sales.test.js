import { test } from 'node:test'
import assert from 'node:assert'
import { total } from '../src/sales.js'

test('합계', () => {
  assert.strictEqual(total([{ date: '2026-01-02', amount: 100 }, { date: '2026-01-03', amount: -30 }]), 70)
})
