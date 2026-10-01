import { test } from 'node:test'
import assert from 'node:assert'
import { buildReport } from '../src/report.js'

test('분류별 합계', () => {
  const csv = 'date,category,amount\n2026-09-01,food,12000\n2026-09-02,taxi,8000\n2026-09-03,food,3000\n'
  assert.strictEqual(buildReport(csv), 'food 15,000\ntaxi 8,000\n합계   23,000')
})
