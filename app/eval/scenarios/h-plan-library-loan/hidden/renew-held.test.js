// s3: 예약자가 기다리는 책은 연장할 수 없다 (사람만 아는 규칙, 코드 HELD)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getLoan, renewLoan } from '../src/index.js'
import { book, loan, rejects, setup } from './helpers.js'

test('예약이 있으면 연장할 수 없고 기록은 그대로다', () => {
  setup({ books: [book({ available: 0, holds: 1 })], loans: [loan()] })
  rejects(() => renewLoan('L-0001', '2026-10-15'), 'HELD')
  assert.equal(getLoan('L-0001').renewals, 0)
  assert.equal(getLoan('L-0001').dueOn, '2026-10-20')
})

test('예약이 없으면 연장할 수 있다', () => {
  setup({ books: [book({ available: 0, holds: 0 })], loans: [loan()] })
  assert.equal(renewLoan('L-0001', '2026-10-15').renewals, 1)
})
