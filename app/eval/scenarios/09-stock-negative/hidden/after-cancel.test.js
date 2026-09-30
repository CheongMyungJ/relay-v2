import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/index.js'

// 리포트가 아니라 재고 레코드(테이블)와 재고 조회(캐시를 거침)를 직접 본다.
function service() {
  return createService({ now: '2026-09-30T10:00:00+09:00', env: {}, config: { log: { level: 'silent' } } })
}

const busan = { id: 'c-busan', region: '부산' }

function stockOf(svc, sku) {
  const out = {}
  for (const r of svc.stockTable.listBySku(sku)) out[r.warehouse] = { onHand: r.onHand, reserved: r.reserved }
  return out
}

function viewOf(svc, sku, warehouse) {
  const v = svc.inventory.getStock(sku, warehouse)
  return { onHand: v.onHand, reserved: v.reserved, available: v.available }
}

test('두 창고 SKU: 주문, 취소, 다시 주문 뒤 창고별 재고', () => {
  const svc = service()
  const first = svc.orders.place({ customer: busan, lines: [{ sku: 'A-100', qty: 3 }] })
  assert.deepEqual(first.lines[0].allocations, [{ warehouse: 'busan', qty: 3 }])
  svc.orders.cancel(first.id, '단순 변심')

  assert.deepEqual(stockOf(svc, 'A-100'), { seoul: { onHand: 12, reserved: 0 }, busan: { onHand: 3, reserved: 0 } })
  assert.deepEqual(viewOf(svc, 'A-100', 'busan'), { onHand: 3, reserved: 0, available: 3 })

  const second = svc.orders.place({ customer: busan, lines: [{ sku: 'A-100', qty: 3 }] })
  assert.deepEqual(second.lines[0].allocations, [{ warehouse: 'busan', qty: 3 }])
  assert.deepEqual(stockOf(svc, 'A-100'), { seoul: { onHand: 12, reserved: 0 }, busan: { onHand: 3, reserved: 3 } })
  assert.deepEqual(viewOf(svc, 'A-100', 'busan'), { onHand: 3, reserved: 3, available: 0 })

  svc.orders.ship(second.id)
  assert.deepEqual(stockOf(svc, 'A-100'), { seoul: { onHand: 12, reserved: 0 }, busan: { onHand: 0, reserved: 0 } })
})

test('두 창고에 나눠 잡은 주문을 취소하고 다시 주문', () => {
  const svc = service()
  const first = svc.orders.place({ customer: busan, lines: [{ sku: 'A-100', qty: 5 }] })
  svc.orders.cancel(first.id)
  assert.deepEqual(viewOf(svc, 'A-100', 'busan'), { onHand: 3, reserved: 0, available: 3 })
  assert.deepEqual(viewOf(svc, 'A-100', 'seoul'), { onHand: 12, reserved: 0, available: 12 })

  svc.orders.place({ customer: busan, lines: [{ sku: 'A-100', qty: 5 }] })
  assert.deepEqual(stockOf(svc, 'A-100'), { seoul: { onHand: 12, reserved: 2 }, busan: { onHand: 3, reserved: 3 } })

  // 남은 가용 재고를 모두 주문해도 음수가 되지 않는다
  svc.orders.place({ customer: busan, lines: [{ sku: 'A-100', qty: 10 }] })
  assert.deepEqual(stockOf(svc, 'A-100'), { seoul: { onHand: 12, reserved: 12 }, busan: { onHand: 3, reserved: 3 } })
})

test('여러 주문과 취소가 섞여도 창고별 예약이 맞다', () => {
  const svc = service()
  const o1 = svc.orders.place({ customer: busan, lines: [{ sku: 'C-300', qty: 4 }] })
  svc.orders.place({ customer: busan, lines: [{ sku: 'C-300', qty: 2 }] })
  svc.orders.place({ customer: { id: 'c-seoul', region: '서울' }, lines: [{ sku: 'C-300', qty: 1 }] })
  svc.orders.cancel(o1.id)
  svc.orders.place({ customer: busan, lines: [{ sku: 'C-300', qty: 5 }] })

  assert.deepEqual(stockOf(svc, 'C-300'), { seoul: { onHand: 5, reserved: 1 }, busan: { onHand: 10, reserved: 7 } })
  assert.deepEqual(viewOf(svc, 'C-300', 'busan'), { onHand: 10, reserved: 7, available: 3 })
  for (const r of svc.stockTable.all()) assert.ok(r.onHand - r.reserved >= 0, `${r.sku}@${r.warehouse} 가용 ${r.onHand - r.reserved}`)
})
