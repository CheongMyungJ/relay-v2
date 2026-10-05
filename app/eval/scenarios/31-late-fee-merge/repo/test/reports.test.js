import { test } from 'node:test'
import assert from 'node:assert/strict'
import { memberStats } from '../src/reports/members.js'
import { overdueReport } from '../src/reports/overdue.js'
import { utilization } from '../src/reports/utilization.js'
import { rental } from './helpers.js'

test('연체 리포트는 많이 늦은 차례', () => {
  const rows = [
    rental({ id: 'R-1', dueDate: '2026-09-04' }),
    rental({ id: 'R-2', dueDate: '2026-09-08', dailyRate: 5000, deposit: 30000, toolName: '사다리 3m' }),
    rental({ id: 'R-3', dueDate: '2026-09-09' }),
    rental({ id: 'R-4', dueDate: '2026-09-01', returnedOn: '2026-09-02' }),
  ]
  const rep = overdueReport(rows, '2026-09-10')
  assert.deepEqual(
    rep.rows.map((r) => [r.id, r.days, r.fee]),
    [
      ['R-1', 6, 24000],
      ['R-2', 2, 5000],
      ['R-3', 1, 0],
    ],
  )
  assert.equal(rep.total, 29000)
})

test('가동률', () => {
  const u = utilization([rental({ startDate: '2026-09-01', returnedOn: '2026-09-15' })], '2026-09')
  assert.equal(u['T-100'], 0.5)
  assert.equal(u['T-200'], 0)
})

test('회원 통계', () => {
  const s = memberStats([
    rental({ charges: [{ kind: 'rent', amount: 24000 }, { kind: 'late', amount: 4000 }] }),
  ])
  assert.deepEqual(s[0], { memberId: 'M-1', name: '김하나', rentals: 1, rent: 24000, late: 4000 })
})
