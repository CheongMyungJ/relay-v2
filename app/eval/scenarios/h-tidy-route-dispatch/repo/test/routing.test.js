import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignOrders, fitsWindow, loadFactor, priorityOf, redistributeStops, zoneOf } from '../src/index.js'

const courier = (id, zone, stops = []) => ({ id, zone, stops })
const order = (id, over = {}) => ({ id, lat: 37.6, lng: 127, ...over })

test('우선순위: 냉장, 창, 나머지', () => {
  assert.equal(priorityOf(order('O-1', { cold: true })), 0)
  assert.equal(priorityOf(order('O-2', { window: { startMin: 600, endMin: 660 } })), 1)
  assert.equal(priorityOf(order('O-3')), 2)
})

test('도착 창과 구역', () => {
  assert.equal(fitsWindow(665, { startMin: 600, endMin: 660 }), true)
  assert.equal(fitsWindow(666, { startMin: 600, endMin: 660 }), false)
  assert.equal(zoneOf(37.55, 127), 'A')
  assert.equal(zoneOf(37.54, 127), 'B')
})

test('부하는 칸 수 / 12, 냉장은 2칸', () => {
  assert.equal(loadFactor(courier('C-1', 'A', [{}, {}, {}])), 0.25)
  assert.equal(loadFactor(courier('C-1', 'A', [{ cold: true }, {}])), 0.25)
})

test('냉장 주문이 먼저, 부하가 같으면 기사 id가 작은 쪽', () => {
  const r = assignOrders([order('O-2'), order('O-1', { cold: true })], [courier('C-2', 'A'), courier('C-1', 'A')])
  assert.deepEqual(r.couriers.find((c) => c.id === 'C-1').stops.map((s) => s.id), ['O-1'])
  assert.deepEqual(r.couriers.find((c) => c.id === 'C-2').stops.map((s) => s.id), ['O-2'])
})

test('가득 찬 기사는 받지 않는다', () => {
  const full = courier('C-1', 'A', Array.from({ length: 12 }, (_, i) => order(`X-${i}`)))
  const r = assignOrders([order('O-1')], [full])
  assert.deepEqual(r.unassigned.map((o) => o.id), ['O-1'])
})

test('정거장 다시 나누기', () => {
  const busy = courier('C-1', 'A', Array.from({ length: 8 }, (_, i) => order(`X-${i}`)))
  const r = redistributeStops([busy, courier('C-2', 'A')])
  assert.ok(Math.abs(loadFactor(r[0]) - loadFactor(r[1])) < 0.2)
})
