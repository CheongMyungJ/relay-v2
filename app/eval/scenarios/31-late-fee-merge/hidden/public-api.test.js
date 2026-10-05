// 회계팀 스크립트가 직접 불러 쓰는 함수: 경로, 이름, 인자가 그대로여야 한다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as invoice from '../src/billing/invoice.js'
import * as overdue from '../src/reports/overdue.js'

const r = {
  id: 'R-1',
  memberId: 'M-1',
  toolId: 'T-100',
  toolName: '전동 드릴',
  dailyRate: 8000,
  deposit: 50000,
  startDate: '2026-09-01',
  dueDate: '2026-09-04',
  returnedOn: null,
  extensions: 0,
  charges: [],
}

test('billing/invoice.js의 lateFeeLine(rental, returnedOn)', () => {
  assert.equal(typeof invoice.lateFeeLine, 'function')
  assert.equal(invoice.lateFeeLine(r, '2026-09-05'), null)
  assert.deepEqual(invoice.lateFeeLine(r, '2026-09-07'), { label: '연체료 (3일)', amount: 12000 })
})

test('reports/overdue.js의 overdueReport(rentals, asOf)', () => {
  assert.equal(typeof overdue.overdueReport, 'function')
  assert.deepEqual(overdue.overdueReport([r], '2026-09-07'), {
    asOf: '2026-09-07',
    rows: [{ id: 'R-1', memberId: 'M-1', tool: '전동 드릴', days: 3, fee: 12000 }],
    total: 12000,
  })
})
