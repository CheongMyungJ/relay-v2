import { test } from 'node:test'
import assert from 'node:assert'
import { toCsv } from '../src/csv.js'
import { exportOrders } from '../src/orders.js'

const COLS = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B' },
]

test('기본은 지금처럼 쉼표다', () => {
  assert.strictEqual(toCsv([{ a: 'x,y', b: 'say "hi"' }], COLS), 'A,B\n"x,y","say ""hi"""')
  assert.strictEqual(toCsv([{ a: null, b: undefined }], COLS), 'A,B\n,')
  assert.strictEqual(
    exportOrders([{ id: 'O-1', customer: '김', amount: 1000, memo: '줄\n바꿈' }]),
    '주문번호,고객,금액,메모\nO-1,김,1000,"줄\n바꿈"',
  )
})
