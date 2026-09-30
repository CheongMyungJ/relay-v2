import { test } from 'node:test'
import assert from 'node:assert'
import { pageNumbers, paginate } from '../src/search/paginate.js'

const list = Array.from({ length: 23 }, (_, i) => i + 1)

test('첫 쪽', () => {
  const p = paginate(list, { page: 1, pageSize: 10 })
  assert.deepStrictEqual(p.items, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.deepStrictEqual([p.total, p.totalPages, p.hasPrev, p.hasNext], [23, 3, false, true])
})

test('마지막 쪽은 남은 것만', () => {
  const p = paginate(list, { page: 3, pageSize: 10 })
  assert.deepStrictEqual(p.items, [21, 22, 23])
  assert.strictEqual(p.hasNext, false)
})

test('쪽 번호와 크기 기본값', () => {
  const p = paginate(list, { page: 'x' }, { defaultPageSize: 5 })
  assert.deepStrictEqual([p.page, p.pageSize, p.totalPages], [1, 5, 5])
  assert.strictEqual(paginate(list, { pageSize: 500 }, { maxPageSize: 20 }).pageSize, 20)
  assert.strictEqual(paginate(list, { page: '2', pageSize: '4' }).items[0], 5)
})

test('범위 밖 쪽은 비어 있다', () => {
  const p = paginate(list, { page: 9, pageSize: 10 })
  assert.deepStrictEqual(p.items, [])
  assert.strictEqual(p.page, 9)
})

test('빈 목록도 한 쪽', () => {
  const p = paginate([], { page: 1, pageSize: 10 })
  assert.deepStrictEqual([p.items.length, p.totalPages, p.hasNext], [0, 1, false])
})

test('쪽 번호 목록', () => {
  assert.deepStrictEqual(pageNumbers({ page: 1, totalPages: 3 }), [1, 2, 3])
  assert.deepStrictEqual(pageNumbers({ page: 6, totalPages: 10 }), [4, 5, 6, 7, 8])
  assert.deepStrictEqual(pageNumbers({ page: 10, totalPages: 10 }), [6, 7, 8, 9, 10])
})
