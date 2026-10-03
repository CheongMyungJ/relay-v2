import { test } from 'node:test'
import assert from 'node:assert'
import { dailyTotals, salesOn } from '../src/report/daily.js'

// 운영 서버와 CI는 TZ=Asia/Seoul로 돈다. 리포트의 날짜는 한국 날짜다
process.env.TZ = 'Asia/Seoul'
const orders = [
  { at: '2026-10-24T03:00:00Z', amount: 12000 },
  { at: '2026-10-25T01:00:00Z', amount: 8000 },
  { at: '2026-10-25T16:30:00Z', amount: 21000 },
  { at: '2026-10-26T05:00:00Z', amount: 15000 },
]
test('일별 매출은 한국 날짜로 묶는다', () => {
  assert.deepStrictEqual(dailyTotals(orders), { '2026-10-24': 12000, '2026-10-25': 8000, '2026-10-26': 36000 })
  assert.strictEqual(salesOn(orders, '2026-10-26'), 36000)
})
