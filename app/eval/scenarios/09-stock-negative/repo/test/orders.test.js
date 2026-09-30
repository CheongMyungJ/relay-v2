import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/index.js'
import { InsufficientStockError, InvalidStateError } from '../src/util/errors.js'
import { mergeLines } from '../src/orders/place.js'

function service() {
  return createService({ now: '2026-09-30T10:00:00+09:00', env: {}, config: { log: { level: 'silent' } } })
}

const seoulCustomer = { id: 'c-1', region: '서울' }
const busanCustomer = { id: 'c-2', region: '부산광역시' }

function reservedOf(svc, sku) {
  return Object.fromEntries(svc.inventory.records(sku).map((r) => [r.warehouse, r.reserved]))
}

test('주문을 받으면 가까운 창고에서 예약한다', () => {
  const svc = service()
  const order = svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'A-110', qty: 2 }] })
  assert.equal(order.id, 'ORD-00001')
  assert.equal(order.status, 'placed')
  assert.deepEqual(order.lines[0].allocations, [{ warehouse: 'seoul', qty: 2 }])
  assert.deepEqual(reservedOf(svc, 'A-110'), { seoul: 2, busan: 0 })
  assert.equal(order.total, 195800)
})

test('한 창고로 모자라면 나눠서 예약한다', () => {
  const svc = service()
  const order = svc.orders.place({ customer: busanCustomer, lines: [{ sku: 'A-100', qty: 5 }] })
  assert.deepEqual(order.lines[0].allocations, [
    { warehouse: 'busan', qty: 3 },
    { warehouse: 'seoul', qty: 2 },
  ])
  assert.deepEqual(reservedOf(svc, 'A-100'), { seoul: 2, busan: 3 })
})

test('같은 SKU 줄은 합친다', () => {
  assert.deepEqual(mergeLines([{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }, { sku: 'A', qty: 3 }]), [
    { sku: 'A', qty: 4 },
    { sku: 'B', qty: 2 },
  ])
  assert.throws(() => mergeLines([{ sku: 'A', qty: 0 }]))
})

test('재고가 모자라면 아무것도 예약하지 않는다', () => {
  const svc = service()
  assert.throws(
    () => svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'B-200', qty: 1 }, { sku: 'C-300', qty: 16 }] }),
    InsufficientStockError,
  )
  assert.deepEqual(reservedOf(svc, 'B-200'), { seoul: 0 })
  assert.deepEqual(reservedOf(svc, 'C-300'), { seoul: 0, busan: 0 })
  assert.equal(svc.orders.list().length, 0)
})

test('취소하면 예약이 풀린다', () => {
  const svc = service()
  const order = svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'B-200', qty: 4 }] })
  svc.orders.cancel(order.id, '고객 요청')
  assert.deepEqual(reservedOf(svc, 'B-200'), { seoul: 0 })
  assert.equal(svc.inventory.getStock('B-200', 'seoul').available, 15)
  assert.equal(svc.orders.get(order.id).status, 'cancelled')
})

test('나눠 잡은 주문을 취소하면 두 창고 모두 풀린다', () => {
  const svc = service()
  const order = svc.orders.place({ customer: busanCustomer, lines: [{ sku: 'A-100', qty: 5 }] })
  svc.orders.cancel(order.id)
  assert.deepEqual(reservedOf(svc, 'A-100'), { seoul: 0, busan: 0 })
})

test('취소한 뒤 같은 상품을 다시 주문할 수 있다', () => {
  const svc = service()
  const first = svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'C-310', qty: 10 }] })
  svc.orders.cancel(first.id)
  svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'C-310', qty: 10 }] })
  assert.deepEqual(reservedOf(svc, 'C-310'), { seoul: 10 })
})

test('출고하면 실재고와 예약이 함께 준다', () => {
  const svc = service()
  const order = svc.orders.place({ customer: busanCustomer, lines: [{ sku: 'C-300', qty: 4 }] })
  svc.orders.ship(order.id)
  assert.deepEqual(svc.inventory.getStock('C-300', 'busan'), { sku: 'C-300', warehouse: 'busan', onHand: 6, reserved: 0, available: 6 })
  assert.equal(svc.orders.get(order.id).status, 'shipped')
})

test('출고한 주문은 취소할 수 없고, 취소한 주문은 출고할 수 없다', () => {
  const svc = service()
  const a = svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'A-120', qty: 1 }] })
  svc.orders.ship(a.id)
  assert.throws(() => svc.orders.cancel(a.id), InvalidStateError)
  const b = svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'A-120', qty: 1 }] })
  svc.orders.cancel(b.id)
  assert.throws(() => svc.orders.ship(b.id), InvalidStateError)
  assert.throws(() => svc.orders.cancel(b.id), InvalidStateError)
})

test('가용 재고가 기준 이하로 내려가면 운영팀에 알린다', () => {
  const svc = service()
  svc.orders.place({ customer: seoulCustomer, lines: [{ sku: 'C-300', qty: 3 }] })
  const low = svc.notifier.pending().filter((m) => m.event === 'stock.low')
  assert.equal(low.length, 1)
  assert.equal(low[0].to, 'ops@stock.local')
  assert.match(low[0].body, /서울 창고 가용 재고가 2개/)
})
