import { test } from 'node:test'
import assert from 'node:assert'
import { dailyTotals } from '../src/report/daily.js'

process.env.TZ = 'Asia/Seoul'
// 지키기: 한낮 주문만 있는 날
test('한낮 주문의 일별 합계는 그대로', () => {
  assert.deepStrictEqual(dailyTotals([{ at: '2026-10-21T03:00:00Z', amount: 1000 }, { at: '2026-10-21T05:00:00Z', amount: 500 }]), { '2026-10-21': 1500 })
})
