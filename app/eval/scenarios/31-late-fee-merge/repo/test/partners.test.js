import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { partnerPayout } from '../src/partners/payout.js'
import { resetStore } from '../src/rentals/store.js'
import { rental } from './helpers.js'

beforeEach(() => resetStore([]))

test('파트너 몫은 70%', () => {
  resetStore([
    rental({ id: 'R-1', toolId: 'T-101', toolName: '임팩트 드라이버', dailyRate: 9000, deposit: 60000, returnedOn: '2026-09-04', charges: [{ kind: 'rent', amount: 27000, on: '2026-09-01' }] }),
    rental({ id: 'R-2', toolId: 'T-100', returnedOn: '2026-09-04' }),
  ])
  const p = partnerPayout('P-1', '2026-09')
  assert.deepEqual(p.items, [{ rentalId: 'R-1', tool: '임팩트 드라이버', rent: 18900, late: 0 }])
  assert.equal(p.total, 18900)
})

test('늦게 반납된 파트너 공구는 연체료 몫도 준다', () => {
  resetStore([
    rental({ id: 'R-1', toolId: 'T-300', toolName: '고압 세척기', dailyRate: 15000, deposit: 120000, returnedOn: '2026-09-08', charges: [{ kind: 'rent', amount: 40000, on: '2026-09-01' }] }),
  ])
  const p = partnerPayout('P-1', '2026-09')
  assert.deepEqual(p.items[0], { rentalId: 'R-1', tool: '고압 세척기', rent: 28000, late: 21000 })
  assert.equal(p.total, 49000)
})
