import { test } from 'node:test'
import assert from 'node:assert'
import { total } from '../src/sales.js'
import { find } from '../src/inventory.js'
import { byId } from '../src/members.js'

test('기존 함수는 그대로', () => {
  assert.strictEqual(total([{ date: '2026-01-02', amount: 100 }, { date: '2026-01-03', amount: -30 }]), 70)
  assert.strictEqual(find([{ sku: 'A', name: '사과', qty: 3 }], 'B'), null)
  assert.strictEqual(byId([{ id: 1, name: '김', email: 'k@a.com' }], 1)?.email, 'k@a.com')
})
