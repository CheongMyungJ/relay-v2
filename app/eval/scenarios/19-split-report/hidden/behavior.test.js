import { test } from 'node:test'
import assert from 'node:assert'
import { buildReport } from '../src/report.js'

test('보고서는 지금과 같다', () => {
  const csv = [
    'date, category, amount',
    '2026-09-01, food, 12000',
    '2026-09-02, transport, 8000',
    '',
    '2026-09-03, food, 3000',
    '2026-09-04, books, 8000',
  ].join('\n')
  assert.strictEqual(
    buildReport(csv),
    ['food      15,000', 'books     8,000', 'transport 8,000', '합계        31,000'].join('\n'),
  )
})

test('0원 행만 있는 분류는 지금처럼 보고서에 없다', () => {
  const csv = 'date,category,amount\n2026-09-01,food,1000\n2026-09-02,gift,0\n'
  assert.strictEqual(buildReport(csv), 'food 1,000\n합계   1,000')
})
