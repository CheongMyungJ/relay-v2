import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startRental } from '../src/rentals/checkout.js'
import { extendRental } from '../src/rentals/extend.js'
import { rentalFee } from '../src/rentals/pricing.js'
import { processReturn } from '../src/rentals/return.js'
import { getRental, resetStore } from '../src/rentals/store.js'
import { rental } from './helpers.js'

beforeEach(() => resetStore([]))

test('대여료는 등급 할인을 뺀다', () => {
  assert.equal(rentalFee(8000, 3, 'basic'), 24000)
  assert.equal(rentalFee(8000, 3, 'plus'), 21600)
})

test('대여 시작', () => {
  const r = startRental({ memberId: 'M-2', toolId: 'T-200', startDate: '2026-10-01', days: 2 })
  assert.equal(r.dueDate, '2026-10-03')
  assert.deepEqual(r.charges, [{ kind: 'rent', amount: 9000, on: '2026-10-01' }])
  assert.throws(
    () => startRental({ memberId: 'M-1', toolId: 'T-200', startDate: '2026-10-01', days: 1 }),
    /대여 중/,
  )
  assert.throws(() => startRental({ memberId: 'M-1', toolId: 'T-100', startDate: '2026-10-01', days: 15 }), /14일/)
})

test('제때 반납하면 연체료가 없고 보증금을 다 돌려준다', () => {
  resetStore([rental()])
  const out = processReturn('R-1', '2026-09-04')
  assert.equal(out.lateFee, 0)
  assert.equal(out.refund, 50000)
  assert.equal(getRental('R-1').returnedOn, '2026-09-04')
})

test('하루 늦은 것은 받지 않는다', () => {
  resetStore([rental()])
  assert.equal(processReturn('R-1', '2026-09-05').lateFee, 0)
})

test('사흘 늦으면 일 대여료 절반 × 3', () => {
  resetStore([rental()])
  const out = processReturn('R-1', '2026-09-07')
  assert.equal(out.lateFee, 12000)
  assert.equal(out.refund, 38000)
  assert.deepEqual(out.rental.charges.at(-1), { kind: 'late', amount: 12000, on: '2026-09-07' })
})

test('연체료는 보증금을 넘지 않는다', () => {
  resetStore([rental()])
  const out = processReturn('R-1', '2026-09-24')
  assert.equal(out.lateFee, 50000)
  assert.equal(out.refund, 0)
})

test('두 번 반납할 수 없다', () => {
  resetStore([rental({ returnedOn: '2026-09-04' })])
  assert.throws(() => processReturn('R-1', '2026-09-05'), /이미 반납/)
})

test('늦은 뒤 연장하면 연체료를 먼저 받고 오늘부터 더 빌린다', () => {
  resetStore([rental()])
  const out = extendRental('R-1', '2026-09-06', 2)
  assert.equal(out.lateFee, 8000)
  assert.equal(out.rentalFee, 16000)
  assert.equal(out.rental.dueDate, '2026-09-08')
  assert.equal(out.rental.extensions, 1)
})

test('늦기 전 연장은 반납 예정일에서 늘린다', () => {
  resetStore([rental()])
  const out = extendRental('R-1', '2026-09-03', 3)
  assert.equal(out.lateFee, 0)
  assert.equal(out.rental.dueDate, '2026-09-07')
})

test('연장은 두 번까지', () => {
  resetStore([rental({ extensions: 2 })])
  assert.throws(() => extendRental('R-1', '2026-09-03', 1), /2번까지/)
})
