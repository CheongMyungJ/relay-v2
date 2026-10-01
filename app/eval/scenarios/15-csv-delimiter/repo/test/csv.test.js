import { test } from 'node:test'
import assert from 'node:assert'
import { toCsv } from '../src/csv.js'
import { exportOrders } from '../src/orders.js'

const COLS = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B' },
]

test('머리글과 줄', () => {
  assert.strictEqual(toCsv([{ a: 1, b: 'x' }], COLS), 'A,B\n1,x')
})

test('쉼표와 따옴표가 든 값은 따옴표로 감싼다', () => {
  assert.strictEqual(toCsv([{ a: 'x,y', b: 'say "hi"' }], COLS), 'A,B\n"x,y","say ""hi"""')
})

test('주문 내보내기', () => {
  const csv = exportOrders([{ id: 'O-1', customer: '김', amount: 1000, memo: '' }])
  assert.strictEqual(csv, '주문번호,고객,금액,메모\nO-1,김,1000,')
})
