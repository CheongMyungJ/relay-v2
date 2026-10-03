import { test } from 'node:test'
import assert from 'node:assert'
import { weekStart, weeklyTotals } from '../src/report/weekly.js'

// 운영 서버와 CI는 TZ=Asia/Seoul로 돈다. 주는 한국 시간 월요일 00:00부터다
process.env.TZ = 'Asia/Seoul'
test('주 경계는 한국 시간 월요일 자정', () => {
  assert.strictEqual(weekStart('2026-10-25T16:30:00Z'), '2026-10-26')
  assert.strictEqual(weekStart('2026-10-25T14:59:59Z'), '2026-10-19')
  assert.strictEqual(weekStart('2026-10-25T15:00:00Z'), '2026-10-26')
  assert.deepStrictEqual(
    weeklyTotals([
      { at: '2026-10-24T03:00:00Z', amount: 12000 },
      { at: '2026-10-25T16:30:00Z', amount: 21000 },
      { at: '2026-10-26T05:00:00Z', amount: 15000 },
    ]),
    { '2026-10-19': 12000, '2026-10-26': 36000 },
  )
})
