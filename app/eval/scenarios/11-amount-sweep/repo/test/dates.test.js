import { test } from 'node:test'
import assert from 'node:assert'
import {
  addMonths,
  fiscalYear,
  inRange,
  monthKey,
  monthsBetween,
  parseDate,
  quarterOf,
  quarterRange,
  toIso,
} from '../src/lib/dates.js'

test('날짜 형식 세 가지', () => {
  assert.deepStrictEqual(parseDate('2026-03-02'), { y: 2026, m: 3, d: 2 })
  assert.deepStrictEqual(parseDate('2026.03.02'), { y: 2026, m: 3, d: 2 })
  assert.strictEqual(toIso('2026/3/2'), '2026-03-02')
  assert.strictEqual(parseDate('2026-02-30'), null)
  assert.strictEqual(parseDate(''), null)
})

test('달, 분기, 회계연도', () => {
  assert.strictEqual(monthKey('2026-11-30'), '2026-11')
  assert.strictEqual(quarterOf('2026-04-01'), 2)
  assert.strictEqual(fiscalYear('2026-03-31', 4), 2025)
  assert.strictEqual(fiscalYear('2026-04-01', 4), 2026)
})

test('기간 안에 드는지 (양 끝 포함)', () => {
  assert.ok(inRange('2026-01-01', '2026-01-01', '2026-01-31'))
  assert.ok(inRange('2026-01-31', '2026-01-01', '2026-01-31'))
  assert.ok(!inRange('2026-02-01', '2026-01-01', '2026-01-31'))
  assert.ok(inRange('2026-02-01'))
})

test('분기 범위', () => {
  assert.deepStrictEqual(quarterRange(2024, 1), { from: '2024-01-01', to: '2024-03-31' })
  assert.deepStrictEqual(quarterRange(2026, 2), { from: '2026-04-01', to: '2026-06-30' })
})

test('달 더하기와 달 차이', () => {
  assert.deepStrictEqual(addMonths('2026-01-31', 1), { y: 2026, m: 2, d: 28 })
  assert.deepStrictEqual(addMonths('2026-11-15', 3), { y: 2027, m: 2, d: 15 })
  assert.strictEqual(monthsBetween('2025-11-01', '2026-02-01'), 3)
})
