import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatWon, sum } from '../src/util/money.js'
import { toCsv } from '../src/util/csv.js'

test('formatWon', () => {
  assert.equal(formatWon(0), '0원')
  assert.equal(formatWon(1234567), '1,234,567원')
  assert.equal(formatWon(-4000), '-4,000원')
})

test('sum', () => {
  assert.equal(sum([]), 0)
  assert.equal(sum([1, 2, 3]), 6)
})

test('toCsv는 쉼표와 따옴표를 감싼다', () => {
  const csv = toCsv([{ a: 'x,y', b: 'say "hi"' }], [{ key: 'a' }, { key: 'b', label: 'B' }])
  assert.equal(csv, 'a,B\n"x,y","say ""hi"""')
})
