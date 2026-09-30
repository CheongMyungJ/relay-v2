import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/index.js'

function service() {
  return createService({ now: '2026-09-30T10:00:00+09:00', env: {}, config: { log: { level: 'silent' } } })
}

test('같은 재고를 연달아 읽으면 캐시에서 읽는다', () => {
  const svc = service()
  const hits = svc.cache.stats().hits
  const reads = svc.stockTable.stats().reads
  for (let i = 0; i < 3; i++) svc.inventory.getStock('A-100', 'busan')
  assert.ok(svc.cache.stats().hits - hits >= 2, `캐시 적중 ${svc.cache.stats().hits - hits}`)
  assert.ok(svc.stockTable.stats().reads - reads <= 1, `테이블 읽기 ${svc.stockTable.stats().reads - reads}`)
})

test('주문과 취소 뒤에도 재고 조회는 캐시를 쓴다', () => {
  const svc = service()
  const order = svc.orders.place({ customer: { id: 'c', region: '부산' }, lines: [{ sku: 'C-300', qty: 2 }] })
  svc.orders.cancel(order.id)
  svc.inventory.getStock('C-300', 'busan')
  const hits = svc.cache.stats().hits
  const reads = svc.stockTable.stats().reads
  svc.inventory.getStock('C-300', 'busan')
  svc.inventory.getStock('C-300', 'busan')
  assert.equal(svc.cache.stats().hits - hits, 2)
  assert.equal(svc.stockTable.stats().reads, reads)
})
