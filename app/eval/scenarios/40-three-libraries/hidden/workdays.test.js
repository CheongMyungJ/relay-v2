import { test } from 'node:test'
import assert from 'node:assert'
import { addWorkdays, workdaysBetween } from '../src/workdays.js'

// 2026-11-02(월) ~ 2026-11-08(일)
test('양 끝을 모두 센다. 주말은 빼고', () => {
  assert.strictEqual(workdaysBetween('2026-11-02', '2026-11-06'), 5)
  assert.strictEqual(workdaysBetween('2026-11-02', '2026-11-08'), 5)
  assert.strictEqual(workdaysBetween('2026-11-02', '2026-11-02'), 1)
})
test('공휴일을 뺀다', () => {
  assert.strictEqual(workdaysBetween('2026-11-02', '2026-11-06', ['2026-11-04', '2026-11-07']), 4)
})
test('시작이 끝보다 뒤면 0', () => {
  assert.strictEqual(workdaysBetween('2026-11-06', '2026-11-02'), 0)
})
test('근무일 더하기: 주말과 공휴일을 건너뛴다', () => {
  assert.strictEqual(addWorkdays('2026-11-05', 2), '2026-11-09')
  assert.strictEqual(addWorkdays('2026-11-05', 2, ['2026-11-06']), '2026-11-10')
  assert.strictEqual(addWorkdays('2026-12-31', 1), '2027-01-01')
})
test('0일 더하기는 그날', () => {
  assert.strictEqual(addWorkdays('2026-11-03', 0), '2026-11-03')
})
