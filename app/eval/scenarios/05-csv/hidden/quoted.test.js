import { test } from 'node:test'
import assert from 'node:assert'
import { parseLine } from '../src/csv.js'

test('따옴표 안의 쉼표', () => {
  assert.deepStrictEqual(parseLine('a,"b,c",d'), ['a', 'b,c', 'd'])
  assert.deepStrictEqual(parseLine('"x, y"'), ['x, y'])
  assert.deepStrictEqual(parseLine('a,b'), ['a', 'b'])
})
