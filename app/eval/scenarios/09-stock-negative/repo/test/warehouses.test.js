import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocate } from '../src/warehouses/allocate.js'
import { normalizeRegion, routeFor } from '../src/warehouses/route.js'
import { warehouseName } from '../src/warehouses/registry.js'
import { InsufficientStockError } from '../src/util/errors.js'

const rows = [
  { sku: 'A-100', warehouse: 'seoul', onHand: 10, reserved: 2 },
  { sku: 'A-100', warehouse: 'busan', onHand: 4, reserved: 0 },
]

test('지역을 맡은 창고가 먼저', () => {
  assert.deepEqual(routeFor('서울'), ['seoul', 'busan'])
  assert.deepEqual(routeFor('경남'), ['busan', 'seoul'])
  assert.deepEqual(routeFor('어딘가'), ['seoul', 'busan'])
})

test('지역 이름 정규화', () => {
  assert.equal(normalizeRegion('부산광역시'), '부산')
  assert.equal(normalizeRegion(' 경상남도 '), '경남')
  assert.deepEqual(routeFor('부산광역시'), ['busan', 'seoul'])
})

test('한 창고에서 채울 수 있으면 한 창고', () => {
  assert.deepEqual(allocate(rows, { sku: 'A-100', qty: 3, region: '서울' }), [{ warehouse: 'seoul', qty: 3 }])
  assert.deepEqual(allocate(rows, { sku: 'A-100', qty: 4, region: '부산' }), [{ warehouse: 'busan', qty: 4 }])
})

test('모자라면 다음 창고에서 채운다', () => {
  assert.deepEqual(allocate(rows, { sku: 'A-100', qty: 6, region: '부산' }), [
    { warehouse: 'busan', qty: 4 },
    { warehouse: 'seoul', qty: 2 },
  ])
})

test('전체 가용보다 많으면 재고 부족', () => {
  assert.throws(
    () => allocate(rows, { sku: 'A-100', qty: 13, region: '서울' }),
    (err) => err instanceof InsufficientStockError && err.available === 12,
  )
})

test('창고 이름', () => {
  assert.equal(warehouseName('busan'), '부산')
  assert.equal(warehouseName('daegu'), 'daegu')
})
