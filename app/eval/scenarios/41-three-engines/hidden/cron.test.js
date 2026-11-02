import { test } from 'node:test'
import assert from 'node:assert'
import { nextRun, parseCron } from '../src/cron.js'

const at = (s) => new Date(`${s}:00Z`)
const iso = (d) => d.toISOString().slice(0, 16)

test('파싱: 별, 범위, 간격, 목록, 이름, 요일 7은 일요일', () => {
  const c = parseCron('*/15 9-17/4 1,15 JAN-MAR MON-FRI')
  assert.deepStrictEqual(c.minute, [0, 15, 30, 45])
  assert.deepStrictEqual(c.hour, [9, 13, 17])
  assert.deepStrictEqual(c.dayOfMonth, [1, 15])
  assert.deepStrictEqual(c.month, [1, 2, 3])
  assert.deepStrictEqual(c.dayOfWeek, [1, 2, 3, 4, 5])
  assert.deepStrictEqual(parseCron('0 0 * * 7').dayOfWeek, [0])
  assert.deepStrictEqual(parseCron('0 0 * * SUN,sat').dayOfWeek, [0, 6])
})

test('틀린 식은 그 필드 이름을 담아 던진다', () => {
  assert.throws(() => parseCron('60 * * * *'), /minute/)
  assert.throws(() => parseCron('* 24 * * *'), /hour/)
  assert.throws(() => parseCron('* * * * * *'))
  assert.throws(() => parseCron('* * 0 * *'), /dayOfMonth/)
})

test('다음 실행: from보다 뒤의 첫 분(UTC)', () => {
  assert.strictEqual(iso(nextRun('*/15 * * * *', at('2026-11-02T10:07'))), '2026-11-02T10:15')
  assert.strictEqual(iso(nextRun('*/15 * * * *', at('2026-11-02T10:15'))), '2026-11-02T10:30')
  assert.strictEqual(iso(nextRun('0 9 * * MON', at('2026-11-02T10:00'))), '2026-11-09T09:00')
  assert.strictEqual(iso(nextRun('30 23 31 12 *', at('2026-11-02T00:00'))), '2026-12-31T23:30')
})

test('달이 바뀌고 없는 날은 건너뛴다', () => {
  assert.strictEqual(iso(nextRun('0 0 31 * *', at('2026-11-02T00:00'))), '2026-12-31T00:00')
  assert.strictEqual(iso(nextRun('0 12 29 2 *', at('2026-03-01T00:00'))), '2028-02-29T12:00')
})

test('날짜와 요일을 둘 다 정하면 둘 중 하나만 맞아도 된다', () => {
  // 2026-11-02는 월요일. 15일이거나 금요일
  assert.strictEqual(iso(nextRun('0 8 15 * FRI', at('2026-11-02T00:00'))), '2026-11-06T08:00')
  assert.strictEqual(iso(nextRun('0 8 15 * FRI', at('2026-11-13T09:00'))), '2026-11-15T08:00')
})
