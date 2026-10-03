import { test } from 'node:test'
import assert from 'node:assert'
import { weeklyTotals } from '../src/report/weekly.js'

process.env.TZ = 'Asia/Seoul'
// 지키기: 주 한가운데 주문
test('주 한가운데 주문의 주별 합계는 그대로', () => {
  assert.deepStrictEqual(weeklyTotals([{ at: '2026-10-21T03:00:00Z', amount: 1000 }, { at: '2026-10-22T05:00:00Z', amount: 700 }]), { '2026-10-19': 1700 })
})
