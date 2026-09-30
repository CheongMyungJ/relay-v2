import { test } from 'node:test'
import assert from 'node:assert'
import { createJob, validateJob } from '../src/queue/job.js'
import { JobQueue } from '../src/queue/job-queue.js'

const job = (id, extra = {}) => createJob({ id, type: 'report', ...extra })

test('작업 검사', () => {
  assert.throws(() => validateJob({ id: '', type: 'report', priority: 'normal', payload: {} }), /id/)
  assert.throws(() => createJob({ id: 'x', type: 'Report' }), /작업 종류/)
  assert.throws(() => createJob({ id: 'x', type: 'report', priority: 'urgent' }), /우선순위/)
})

test('id가 없으면 job-N', () => {
  const a = createJob({ type: 'cleanup' })
  assert.match(a.id, /^job-\d+$/)
})

test('우선순위 순서, 같은 우선순위는 넣은 순서', () => {
  const q = new JobQueue()
  q.enqueueAll([job('a', { priority: 'low' }), job('b'), job('c', { priority: 'high' }), job('d')])
  assert.deepStrictEqual(
    q.drain().map((j) => j.id),
    ['c', 'b', 'd', 'a'],
  )
  assert.ok(q.isEmpty())
})

test('같은 dedupeKey는 하나만', () => {
  const q = new JobQueue()
  assert.strictEqual(q.enqueue(job('a', { dedupeKey: 'k' })), true)
  assert.strictEqual(q.enqueue(job('b', { dedupeKey: 'k' })), false)
  q.dequeue()
  assert.strictEqual(q.enqueue(job('c', { dedupeKey: 'k' })), true)
})

test('같은 id는 거절', () => {
  const q = new JobQueue()
  q.enqueue(job('a'))
  assert.throws(() => q.enqueue(job('a')), /같은 id/)
})

test('take, peek, remove, countByType', () => {
  const q = new JobQueue()
  q.enqueueAll([job('a'), job('b'), createJob({ id: 'c', type: 'notify' }), job('d')])
  assert.strictEqual(q.peek().id, 'a')
  assert.deepStrictEqual(q.countByType(), { report: 3, notify: 1 })
  assert.strictEqual(
    q.remove((j) => j.id === 'b'),
    1,
  )
  assert.deepStrictEqual(
    q.take(2).map((j) => j.id),
    ['a', 'c'],
  )
  assert.strictEqual(q.size, 1)
})
