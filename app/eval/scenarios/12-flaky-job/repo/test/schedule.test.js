import { test } from 'node:test'
import assert from 'node:assert'
import { matches, nextRun, parseCron } from '../src/schedule/cron.js'
import { Scheduler } from '../src/schedule/scheduler.js'

const at = (s) => new Date(`${s}Z`)

test('cron 읽기: 목록, 범위, 간격', () => {
  const c = parseCron('*/15 2 1,15 * 1-5')
  assert.deepStrictEqual([...c.minute], [0, 15, 30, 45])
  assert.deepStrictEqual([...c.hour], [2])
  assert.deepStrictEqual([...c.day], [1, 15])
  assert.deepStrictEqual([...c.weekday], [1, 2, 3, 4, 5])
  assert.deepStrictEqual([...parseCron('5/20 * * * *').minute], [5, 25, 45])
})

test('cron 오류', () => {
  assert.throws(() => parseCron('* * * *'), /다섯 칸/)
  assert.throws(() => parseCron('61 * * * *'), /0~59/)
  assert.throws(() => parseCron('* 5-2 * * *'), /거꾸로/)
  assert.throws(() => parseCron('a * * * *'), /숫자가 아닌/)
})

test('시각이 맞는지', () => {
  assert.ok(matches('15 2 * * *', at('2026-09-30T02:15:00')))
  assert.ok(!matches('15 2 * * *', at('2026-09-30T02:16:00')))
  assert.ok(matches('0 9 * * 3', at('2026-09-30T09:00:00')))
})

test('다음 실행 시각', () => {
  assert.deepStrictEqual(nextRun('30 2 * * *', at('2026-09-30T02:30:00')), at('2026-10-01T02:30:00'))
  assert.deepStrictEqual(nextRun('0 0 29 2 *', at('2026-03-01T00:00:00'), 30), null)
})

test('스케줄러: 때가 된 정의만, 같은 분에는 한 번', () => {
  const s = new Scheduler()
  s.define({ name: 'nightly', cron: '0 2 * * *', make: () => [{ type: 'report', payload: { reportId: 'r', tenant: 't' } }] })
  s.define({ name: 'cleanup', cron: '*/10 * * * *', make: () => ({ type: 'cleanup' }) })
  const jobs = s.due(at('2026-09-30T02:00:00'))
  assert.deepStrictEqual(
    jobs.map((j) => j.type),
    ['report', 'cleanup'],
  )
  assert.strictEqual(jobs[0].dedupeKey, `nightly@${Math.floor(at('2026-09-30T02:00:00').getTime() / 60000)}`)
  assert.deepStrictEqual(s.due(at('2026-09-30T02:00:00')), [])
  s.setEnabled('cleanup', false)
  assert.deepStrictEqual(s.due(at('2026-09-30T02:10:00')), [])
})

test('스케줄러: 정의 검사', () => {
  const s = new Scheduler()
  s.define({ name: 'a', cron: '* * * * *', make: () => [] })
  assert.throws(() => s.define({ name: 'a', cron: '* * * * *', make: () => [] }), /이미 있는/)
  assert.throws(() => s.define({ name: 'b', cron: '* * * * *' }), /make/)
  assert.deepStrictEqual(s.list(), [{ name: 'a', cron: '* * * * *', enabled: true }])
})
