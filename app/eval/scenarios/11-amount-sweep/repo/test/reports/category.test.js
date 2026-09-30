import { test } from 'node:test'
import assert from 'node:assert'
import { categoryTrend, spendingByCategory } from '../../src/reports/category.js'
import { row } from '../helpers.js'

const rows = [
  row('2026-01-08', 5110, '120,000', { category: '소모품' }),
  row('2026-02-12', 5110, '₩ 80,000', { category: '소모품' }),
  row('2026-01-15', 5200, '1,500,000', { category: '임차료' }),
  row('2026-01-20', 5120, '100,000', { category: '' }),
  row('2026-01-05', 4010, '3,000,000', { category: '매출' }),
]

test('분류별 합계와 비중', () => {
  const list = spendingByCategory(rows)
  assert.deepStrictEqual(
    list.map((c) => [c.category, c.total]),
    [
      ['임차료', 1500000],
      ['소모품', 200000],
      ['미분류', 100000],
    ],
  )
  assert.strictEqual(list[0].share, 1500000 / 1800000)
  assert.strictEqual(spendingByCategory(rows, { top: 1 }).length, 1)
})

test('기간과 분류의 달별 추이', () => {
  const jan = spendingByCategory(rows, { from: '2026-01-01', to: '2026-01-31' })
  assert.strictEqual(jan.find((c) => c.category === '소모품').total, 120000)
  assert.deepStrictEqual(categoryTrend(rows, '소모품', 2026).slice(0, 3), [120000, 80000, 0])
})
