import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/index.js'
import { displayWidth, pad, renderTable } from '../src/reports/format.js'

function service() {
  return createService({ now: '2026-09-30T10:00:00+09:00', env: {}, config: { log: { level: 'silent' } } })
}

test('재고 리포트: 샘플 데이터', () => {
  const report = service().reports.stock()
  assert.equal(report.period.label, '2026-09-28 ~ 2026-10-04')
  assert.equal(report.rows.length, 10)
  assert.deepEqual(report.summary, { skus: 7, onHand: 149, reserved: 0, available: 149, low: 0 })
  const lines = report.text.split('\n')
  assert.equal(lines[0], '주간 재고 리포트 (2026-09-28 ~ 2026-10-04)')
  assert.equal(lines[1], '기준 시각: 2026-09-30 10:00')
  assert.equal(lines[5], 'A-100  무선 마우스    서울      12     0    12')
})

test('재고 리포트: 예약과 부족 표시', () => {
  const svc = service()
  svc.orders.place({ customer: { id: 'c', region: '경남' }, lines: [{ sku: 'A-110', qty: 5 }] })
  const row = svc.reports.stock().rows.find((r) => r.sku === 'A-110' && r.warehouse === 'busan')
  assert.deepEqual(
    { onHand: row.onHand, reserved: row.reserved, available: row.available, low: row.low },
    { onHand: 6, reserved: 5, available: 1, low: true },
  )
  assert.match(svc.reports.stock().text, /부족 1건/)
})

test('매출 요약은 취소 주문을 매출에서 뺀다', () => {
  const svc = service()
  const a = svc.orders.place({ customer: { id: 'c1', region: '서울' }, lines: [{ sku: 'B-210', qty: 2 }] })
  svc.orders.place({ customer: { id: 'c2', region: '서울' }, lines: [{ sku: 'C-310', qty: 1 }] })
  svc.orders.cancel(a.id)
  const s = svc.reports.sales()
  assert.equal(s.orders, 2)
  assert.equal(s.cancelled, 1)
  assert.equal(s.revenue, 13200)
  assert.deepEqual(s.categories, [{ category: '가방', units: 1, amount: 12000 }])
})

test('표 정렬은 한글 폭을 두 칸으로 센다', () => {
  assert.equal(displayWidth('서울'), 4)
  assert.equal(pad('서울', 6), '서울  ')
  assert.equal(pad('12', 4, 'right'), '  12')
  assert.equal(renderTable([{ title: '이름', key: 'n' }, { title: 'x', key: 'x', align: 'right' }], [{ n: 'ab', x: 1 }]), '이름  x\n----  -\nab    1')
})
