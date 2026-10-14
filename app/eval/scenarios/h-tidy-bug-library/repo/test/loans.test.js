import { test } from 'node:test'
import assert from 'node:assert'
import { canBorrow, dueDate } from '../src/loans.js'

test('몇 권 빌린 회원은 더 빌린다', () => {
  assert.equal(canBorrow({ borrowed: 2, overdue: 0 }), true)
})

test('너무 많이 빌린 회원은 못 빌린다', () => {
  assert.equal(canBorrow({ borrowed: 8, overdue: 0 }), false)
})

test('연체가 있으면 못 빌린다', () => {
  assert.equal(canBorrow({ borrowed: 1, overdue: 2 }), false)
})

test('반납 기한: 일반 14일, 신간 7일', () => {
  const d = new Date('2026-10-01T00:00:00Z')
  assert.equal(dueDate(d, { newRelease: false }).toISOString(), '2026-10-15T00:00:00.000Z')
  assert.equal(dueDate(d, { newRelease: true }).toISOString(), '2026-10-08T00:00:00.000Z')
})
