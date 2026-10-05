// 보증금이 없는 옛 계약(deposit null)은 반납할 때 상한 없이 연체료를 받는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processReturn } from '../src/rentals/return.js'
import { resetStore } from '../src/rentals/store.js'

const legacy = (id) => ({
  id,
  memberId: 'M-2',
  toolId: 'T-200',
  toolName: '사다리 3m',
  dailyRate: 5000,
  deposit: null,
  startDate: '2026-09-01',
  dueDate: '2026-09-04',
  returnedOn: null,
  extensions: 0,
  charges: [{ kind: 'rent', amount: 15000 }],
})

test('보증금이 없는 대여의 반납 연체료', () => {
  resetStore([legacy('R-1'), legacy('R-2'), legacy('R-3')])
  assert.equal(processReturn('R-1', '2026-09-05').lateFee, 0)
  const out = processReturn('R-2', '2026-09-14')
  assert.equal(out.lateFee, 25000)
  assert.equal(out.refund, 0)
  assert.deepEqual(out.rental.charges.at(-1), { kind: 'late', amount: 25000, on: '2026-09-14' })
  assert.equal(processReturn('R-3', '2026-10-04').lateFee, 75000)
})
