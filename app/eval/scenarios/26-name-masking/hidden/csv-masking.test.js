import { test } from 'node:test'
import assert from 'node:assert'
import { customers, orders } from '../src/data.js'
import { ordersCsv } from '../src/export/orders-csv.js'

// 개인정보팀 규칙: 이름은 첫 글자만 남기고 나머지 글자 수만큼 *, 이메일은 @ 앞 첫 두 글자만 남기고 *** 세 개
test('주문 내역 CSV의 이름과 이메일을 가린다', () => {
  assert.strictEqual(
    ordersCsv(orders, customers),
    [
      '주문번호,날짜,고객,이메일,금액',
      'O-501,2026-09-28,홍**,ho***@example.com,36000',
      'O-502,2026-09-29,남***,na***@example.co.kr,9000',
      'O-503,2026-09-30,이*,ls***@example.com,12500',
    ].join('\n'),
  )
})
