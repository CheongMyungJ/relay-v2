import { test } from 'node:test'
import assert from 'node:assert'
import { resetNow, setNow } from '../src/clock.js'
import { createLogger, fields, memoryLogger, timestamp } from '../src/log/logger.js'

test('시각 형식', () => {
  assert.strictEqual(timestamp(Date.UTC(2026, 8, 30, 2, 5, 4, 7)), '2026-09-30 02:05:04.007')
})

test('필드: 빈칸이 있는 값은 따옴표로', () => {
  assert.strictEqual(fields({ jobId: 'job-1', msg: 'a b', n: 3, skip: undefined }), 'jobId=job-1 msg="a b" n=3')
})

test('단계보다 낮은 로그는 버린다', () => {
  const { logger, lines } = memoryLogger('warn')
  logger.info('안 보임')
  logger.warn('보임', { jobId: 'job-2' })
  assert.strictEqual(lines.length, 1)
  assert.match(lines[0], /WARN {2}보임 jobId=job-2$/)
})

test('child 로거는 scope를 잇는다', () => {
  setNow(() => Date.UTC(2026, 0, 1))
  try {
    const lines = []
    const root = createLogger({ level: 'debug', scope: 'runner', sink: (l) => lines.push(l) })
    root.child('pool').debug('묶음 끝')
    assert.deepStrictEqual(lines, ['2026-01-01 00:00:00.000 DEBUG [runner:pool] 묶음 끝'])
  } finally {
    resetNow()
  }
})
