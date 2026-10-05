// 고객에게 받는 연체료는 어디서 계산해도 같다: 반올림, 하루 유예, 보증금 상한
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { runCommand } from '../src/admin/cli.js'
import { monthlyInvoice } from '../src/billing/invoice.js'
import { reminderText } from '../src/notify/reminder.js'
import { partnerPayout } from '../src/partners/payout.js'
import { extendRental } from '../src/rentals/extend.js'
import { processReturn } from '../src/rentals/return.js'
import { resetStore } from '../src/rentals/store.js'
import { overdueReport } from '../src/reports/index.js'

function rental(over = {}) {
  return {
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
    charges: [{ kind: 'rent', amount: 24000, on: '2026-09-01' }],
    ...over,
  }
}
// 일 대여료 3,333원 × 3일 × 절반 = 4,999.5원
const odd = (over = {}) =>
  rental({ toolId: 'T-201', toolName: '접이식 사다리 2m', dailyRate: 3333, deposit: 20000, ...over })

beforeEach(() => resetStore([]))

test('반납: 유예, 반올림, 상한', () => {
  resetStore([rental({ id: 'R-1' }), odd({ id: 'R-2' }), rental({ id: 'R-3' }), rental({ id: 'R-4' })])
  assert.equal(processReturn('R-1', '2026-09-05').lateFee, 0)
  assert.equal(processReturn('R-2', '2026-09-07').lateFee, 5000)
  assert.equal(processReturn('R-3', '2026-09-09').lateFee, 20000)
  const capped = processReturn('R-4', '2026-09-30')
  assert.equal(capped.lateFee, 50000)
  assert.equal(capped.refund, 0)
})

test('연장: 늦은 만큼의 연체료를 먼저 받는다', () => {
  resetStore([rental({ id: 'R-1' }), odd({ id: 'R-2' }), rental({ id: 'R-3' })])
  assert.equal(extendRental('R-1', '2026-09-05', 1).lateFee, 0)
  assert.equal(extendRental('R-2', '2026-09-07', 1).lateFee, 5000)
  assert.equal(extendRental('R-3', '2026-09-08', 1).lateFee, 16000)
})

test('청구서의 연체료 줄', () => {
  resetStore([odd({ id: 'R-1', returnedOn: '2026-09-07', charges: [{ kind: 'rent', amount: 9999 }] })])
  const inv = monthlyInvoice('M-1', '2026-09')
  assert.deepEqual(inv.lines.at(-1), { label: '연체료 (3일)', amount: 5000 })
  assert.equal(inv.supply, 14999)
})

test('연체 안내 문자의 연체료', () => {
  assert.match(reminderText(odd(), '2026-09-07'), /3일 늦었습니다\. 현재 연체료 5,000원\./)
  assert.match(reminderText(rental(), '2026-09-30'), /현재 연체료 50,000원\./)
})

test('연체 리포트', () => {
  const rep = overdueReport([odd({ id: 'R-1' }), rental({ id: 'R-2' }), rental({ id: 'R-3', dueDate: '2026-09-06' })], '2026-09-07')
  assert.deepEqual(
    rep.rows.map((r) => [r.id, r.days, r.fee]),
    [
      ['R-1', 3, 5000],
      ['R-2', 3, 12000],
      ['R-3', 1, 0],
    ],
  )
  assert.equal(rep.total, 17000)
})

test('관리 명령 fee', () => {
  resetStore([odd({ id: 'R-9' })])
  const lines = []
  runCommand(['fee', 'R-9', '2026-09-07'], (l) => lines.push(l))
  assert.deepEqual(lines, ['R-9 접이식 사다리 2m: 3일 늦음, 연체료 5,000원'])
})

test('파트너 정산: 나누어떨어지는 연체료', () => {
  resetStore([
    rental({
      id: 'R-1',
      toolId: 'T-300',
      toolName: '고압 세척기',
      dailyRate: 15000,
      deposit: 120000,
      returnedOn: '2026-09-08',
      charges: [{ kind: 'rent', amount: 40000 }],
    }),
  ])
  assert.deepEqual(partnerPayout('P-1', '2026-09').items[0], {
    rentalId: 'R-1',
    tool: '고압 세척기',
    rent: 28000,
    late: 21000,
  })
})
