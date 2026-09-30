import { test } from 'node:test'
import assert from 'node:assert'
import { formatJson, formatLine } from '../src/log/format.js'
import { createLogger } from '../src/log/logger.js'
import { jsonSink, memorySink, teeSink } from '../src/log/sinks.js'

test('수준 아래 기록은 버린다', () => {
  const sink = memorySink()
  const log = createLogger({ scope: 't', level: 'warn', sink, now: () => 0 })
  log.info('안 보임')
  log.warn('보임', { n: 1 })
  assert.deepStrictEqual(sink.lines(), ['[1970-01-01T00:00:00.000Z] WARN t: 보임 n=1'])
  assert.throws(() => createLogger({ level: 'loud' }), RangeError)
})

test('한 줄 형식', () => {
  const line = formatLine({ time: 0, level: 'info', scope: 's', message: 'm', fields: { q: 'a b', ok: true, none: undefined } })
  assert.strictEqual(line, '[1970-01-01T00:00:00.000Z] INFO s: m q="a b" ok=true')
  assert.strictEqual(JSON.parse(formatJson({ time: 0, level: 'error', scope: 's', message: 'm', fields: { err: new Error('x') } })).err.message, 'x')
})

test('child 로거와 여러 곳 내보내기', () => {
  const a = memorySink()
  const out = []
  const log = createLogger({ scope: 'app', level: 'debug', sink: teeSink(a, jsonSink((l) => out.push(l))), now: () => 0 })
  log.child('db').debug('연결')
  assert.strictEqual(a.records[0].scope, 'app.db')
  assert.strictEqual(JSON.parse(out[0]).msg, '연결')
})

test('시간 재기', () => {
  const sink = memorySink()
  let t = 0
  const log = createLogger({ level: 'debug', sink, now: () => (t += 5) })
  assert.strictEqual(log.time('일', () => 42), 42)
  assert.strictEqual(sink.records[0].fields.ms, 5)
})
