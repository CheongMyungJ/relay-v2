import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/index.js'

test('정상 재고의 리포트는 그대로', () => {
  const svc = createService({ now: '2026-10-02T18:30:00+09:00', env: {}, config: { log: { level: 'silent' } } })
  const a = svc.orders.place({ customer: { id: 'c1', region: '서울' }, lines: [{ sku: 'A-100', qty: 4 }, { sku: 'B-200', qty: 2 }] })
  svc.orders.place({ customer: { id: 'c2', region: '경남' }, lines: [{ sku: 'C-300', qty: 6 }, { sku: 'A-110', qty: 7 }] })
  const c = svc.orders.place({ customer: { id: 'c3', region: '인천' }, lines: [{ sku: 'C-310', qty: 5 }] })
  svc.orders.ship(a.id)
  svc.orders.cancel(c.id, '고객 요청')
  svc.inventory.receive({ sku: 'A-120', warehouse: 'seoul', qty: 10 })

  const expected = [
    '주간 재고 리포트 (2026-09-28 ~ 2026-10-04)',
    '기준 시각: 2026-10-02 18:30',
    '',
    'SKU    상품           창고  실재고  예약  가용',
    '-----  -------------  ----  ------  ----  ----  ----',
    'A-100  무선 마우스    서울       8     0     8',
    'A-100  무선 마우스    부산       3     0     3',
    'A-110  기계식 키보드  서울       8     1     7',
    'A-110  기계식 키보드  부산       6     6     0  부족',
    'A-120  마우스 패드    서울      50     0    50',
    'B-200  모니터 받침대  서울      13     0    13',
    'B-210  USB 허브       서울      20     0    20',
    'C-300  노트북 파우치  서울       5     0     5',
    'C-300  노트북 파우치  부산      10     6     4',
    'C-310  케이블 정리함  서울      30     0    30',
    '',
    'SKU 7개, 실재고 153, 예약 13, 가용 140, 부족 1건',
  ].join('\n')
  assert.equal(svc.reports.stock().text, expected)
})
