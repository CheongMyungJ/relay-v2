import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estimateDelivery, shipDate } from '../src/orders/delivery.js'
import { kstDate } from '../src/shared/time.js'
import { placePaid, setup } from './helpers.js'

test('오후 2시 전 결제는 그날 보낸다', () => {
  assert.equal(kstDate(shipDate('2026-03-03T04:00:00Z')), '2026-03-03') // 화 13:00
  assert.equal(kstDate(shipDate('2026-03-03T05:00:00Z')), '2026-03-04') // 화 14:00
})

test('일요일과 공휴일은 건너뛴다', () => {
  assert.equal(kstDate(shipDate('2026-03-01T01:00:00Z')), '2026-03-03') // 일요일, 다음 날은 대체 공휴일
  assert.equal(estimateDelivery('seoul', '2026-03-07T01:00:00Z'), '2026-03-09') // 토 → 토 출발, 월 도착
})

test('지역마다 걸리는 날', () => {
  const paid = '2026-03-03T01:00:00Z' // 화 10:00
  assert.equal(estimateDelivery('seoul', paid), '2026-03-04')
  assert.equal(estimateDelivery('local', paid), '2026-03-05')
  assert.equal(estimateDelivery('jeju', paid), '2026-03-06')
  assert.equal(estimateDelivery('island', paid), '2026-03-07')
})

test('결제하면 주문에 도착 예정일을 적는다', () => {
  const shop = setup('2026-03-03T01:00:00Z')
  assert.equal(placePaid(shop, 'u-3', [['MUG', 1]]).eta, '2026-03-06')
})
