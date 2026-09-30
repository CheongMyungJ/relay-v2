import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLru } from '../src/cache/lru.js'

test('넣은 값을 꺼낸다', () => {
  const lru = createLru({ maxEntries: 3 })
  lru.set('a', 1)
  assert.equal(lru.get('a'), 1)
  assert.equal(lru.get('b'), undefined)
})

test('가장 오래 안 쓴 것부터 밀어낸다', () => {
  const lru = createLru({ maxEntries: 2 })
  lru.set('a', 1)
  lru.set('b', 2)
  lru.get('a')
  lru.set('c', 3)
  assert.equal(lru.has('a'), true)
  assert.equal(lru.has('b'), false)
  assert.equal(lru.has('c'), true)
  assert.equal(lru.stats().evictions, 1)
})

test('수명이 지나면 없는 것으로 본다', () => {
  let t = 0
  const lru = createLru({ maxEntries: 10, ttlMs: 1000, now: () => t })
  lru.set('a', 1)
  t = 999
  assert.equal(lru.get('a'), 1)
  t = 2000
  assert.equal(lru.get('a'), undefined)
  assert.equal(lru.stats().expired, 1)
})

test('적중과 실패를 센다', () => {
  const lru = createLru()
  lru.get('x')
  lru.set('x', 1)
  lru.get('x')
  lru.get('x')
  const s = lru.stats()
  assert.equal(s.hits, 2)
  assert.equal(s.misses, 1)
  assert.equal(s.hitRate, 2 / 3)
})

test('delete와 clear', () => {
  const lru = createLru()
  lru.set('a', 1)
  lru.set('b', 2)
  assert.equal(lru.delete('a'), true)
  assert.equal(lru.delete('a'), false)
  assert.equal(lru.stats().deletes, 1)
  lru.clear()
  assert.equal(lru.stats().size, 0)
})

test('같은 키를 다시 넣으면 값이 바뀌고 크기는 그대로', () => {
  const lru = createLru({ maxEntries: 2 })
  lru.set('a', 1)
  lru.set('a', 2)
  assert.equal(lru.get('a'), 2)
  assert.equal(lru.stats().size, 1)
})

test('maxEntries는 양의 정수', () => {
  assert.throws(() => createLru({ maxEntries: 0 }))
})
