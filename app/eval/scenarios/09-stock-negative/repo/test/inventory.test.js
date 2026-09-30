import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/index.js'

function service() {
  return createService({ now: '2026-09-30T10:00:00+09:00', env: {}, config: { log: { level: 'silent' } } })
}

test('재고 조회는 캐시를 거친다', () => {
  const svc = service()
  const reads = svc.stockTable.stats().reads
  assert.deepEqual(svc.inventory.getStock('B-200', 'seoul'), { sku: 'B-200', warehouse: 'seoul', onHand: 15, reserved: 0, available: 15 })
  svc.inventory.getStock('B-200', 'seoul')
  assert.equal(svc.stockTable.stats().reads, reads + 1)
  assert.equal(svc.cache.stats().hits, 1)
})

test('창고를 주지 않으면 서울', () => {
  const svc = service()
  assert.equal(svc.inventory.getStock('C-300').warehouse, 'seoul')
  assert.equal(svc.inventory.getStock('B-200', 'busan'), null)
})

test('입고: 없는 창고 레코드는 새로 만든다', () => {
  const svc = service()
  svc.inventory.receive({ sku: 'B-200', warehouse: 'busan', qty: 4 })
  assert.equal(svc.inventory.getStock('B-200', 'busan').onHand, 4)
  assert.deepEqual(svc.inventory.warehousesOf('B-200'), ['seoul', 'busan'])
  assert.throws(() => svc.inventory.receive({ sku: 'B-200', warehouse: 'daegu', qty: 1 }), /없는 창고/)
})

test('실사 조정은 실재고만 바꾼다', () => {
  const svc = service()
  svc.inventory.reserveLine({ sku: 'C-310', allocations: [{ warehouse: 'seoul', qty: 2 }] })
  svc.inventory.adjust({ sku: 'C-310', warehouse: 'seoul', counted: 27, reason: '파손' })
  assert.deepEqual(svc.inventory.getStock('C-310', 'seoul'), { sku: 'C-310', warehouse: 'seoul', onHand: 27, reserved: 2, available: 25 })
})

test('창고 간 이동', () => {
  const svc = service()
  svc.inventory.transfer({ sku: 'C-300', from: 'busan', to: 'seoul', qty: 4 })
  assert.equal(svc.inventory.getStock('C-300', 'busan').onHand, 6)
  assert.equal(svc.inventory.getStock('C-300', 'seoul').onHand, 9)
  assert.throws(() => svc.inventory.transfer({ sku: 'C-300', from: 'busan', to: 'seoul', qty: 7 }), /가용 재고 부족/)
})

test('예약은 테이블과 조회 결과에 함께 반영된다', () => {
  const svc = service()
  svc.inventory.reserveLine({ sku: 'A-110', allocations: [{ warehouse: 'busan', qty: 2 }] })
  assert.equal(svc.inventory.getStock('A-110', 'busan').reserved, 2)
  assert.equal(svc.stockTable.get('A-110', 'busan').reserved, 2)
  assert.equal(svc.inventory.totalAvailable('A-110'), 12)
})

test('해제는 예약보다 많이 풀 수 없다', () => {
  const svc = service()
  svc.inventory.reserveLine({ sku: 'B-210', allocations: [{ warehouse: 'seoul', qty: 3 }] })
  assert.throws(() => svc.inventory.releaseLine({ sku: 'B-210', allocations: [{ warehouse: 'seoul', qty: 4 }] }), /예약보다 많이/)
  svc.inventory.releaseLine({ sku: 'B-210', allocations: [{ warehouse: 'seoul', qty: 3 }] })
  assert.equal(svc.inventory.getStock('B-210', 'seoul').reserved, 0)
})
