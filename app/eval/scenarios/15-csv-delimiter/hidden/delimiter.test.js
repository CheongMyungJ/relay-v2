import { test } from 'node:test'
import assert from 'node:assert'
import { toCsv } from '../src/csv.js'
import { exportOrders } from '../src/orders.js'

const COLS = [
  { key: 'a', title: 'A' },
  { key: 'b', title: 'B' },
]

test('세미콜론 구분자', () => {
  assert.strictEqual(toCsv([{ a: 1, b: 'x' }], COLS, { delimiter: ';' }), 'A;B\n1;x')
})

test('구분자가 든 값은 따옴표로 감싼다', () => {
  assert.strictEqual(toCsv([{ a: 'x;y', b: 2 }], COLS, { delimiter: ';' }), 'A;B\n"x;y";2')
})

test('탭 구분자', () => {
  assert.strictEqual(toCsv([{ a: 'a\tb', b: 2 }], COLS, { delimiter: '\t' }), 'A\tB\n"a\tb"\t2')
})

test('주문 내보내기에서 구분자를 넘긴다', () => {
  const csv = exportOrders([{ id: 'O-1', customer: '김', amount: 1000, memo: '' }], {
    delimiter: ';',
  })
  assert.strictEqual(csv, '주문번호;고객;금액;메모\nO-1;김;1000;')
})
