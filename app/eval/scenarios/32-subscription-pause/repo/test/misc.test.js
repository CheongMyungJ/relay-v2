import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { firstChargeAmount } from '../src/billing/coupons.js'
import { receiptText } from '../src/billing/receipts.js'
import { courierFor, groupByCourier } from '../src/deliveries/couriers.js'
import { menuFor } from '../src/deliveries/menu.js'
import { activeCount, byPlan, churn, revenue } from '../src/reports/monthly.js'
import { clearTickets, closeTicket, openTicket, openTickets } from '../src/support/tickets.js'
import { sub } from './helpers.js'

beforeEach(() => clearTickets())

test('쿠폰과 영수증', () => {
  assert.equal(firstChargeAmount(39000, 'WELCOME'), 31200)
  assert.equal(firstChargeAmount(39000, 'NOPE'), 39000)
  assert.match(receiptText({ memberName: '김하나', planName: '기본', amount: 39000, billedOn: '2026-10-10' }), /부가세 3,545원/)
})

test('택배사와 차림', () => {
  assert.equal(courierFor('서울 마포구').courier, '새벽배송A')
  assert.equal(courierFor('부산 해운대구').courier, '일반택배B')
  assert.deepEqual(groupByCourier([{ subscriptionId: 'S-1', address: '인천 연수구' }]), { 일반택배B: ['S-1'] })
  assert.equal(menuFor('2026-10-01', 2).length, 2)
})

test('리포트', () => {
  const subs = [
    sub(),
    sub({ id: 'S-2', planId: 'family-y' }),
    sub({ id: 'S-3', status: 'cancelled', cancelledOn: '2026-10-03', cancelReason: '가격' }),
  ]
  assert.equal(activeCount(subs, '2026-10-05'), 2)
  assert.deepEqual(byPlan(subs, '2026-10-05'), { '기본 반찬 (월간)': 1, '가족 반찬 (연간)': 1 })
  assert.deepEqual(churn(subs, '2026-10'), { month: '2026-10', count: 1, reasons: { 가격: 1 } })
  assert.equal(revenue([{ ok: true, amount: 39000, memo: '기본 반찬 (월간) 2026-10-10' }, { ok: false, amount: 1, memo: 'x 2026-10-11' }], '2026-10'), 39000)
})

test('문의', () => {
  const t = openTicket({ memberId: 'M-1', category: 'delivery', text: '안 왔어요', today: '2026-10-05' })
  assert.equal(t.team, '배송팀')
  assert.equal(openTickets('배송팀').length, 1)
  closeTicket(t.id, '2026-10-06')
  assert.equal(openTickets().length, 0)
})
