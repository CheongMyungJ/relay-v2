import { test } from 'node:test'
import assert from 'node:assert'
import { parseLine } from '../src/csv.js'

test('따옴표 두 번은 따옴표 하나, 빈 칸은 빈 문자열', () => {
  assert.deepStrictEqual(parseLine('"say ""hi""",2'), ['say "hi"', '2'])
  assert.deepStrictEqual(parseLine('a,,b'), ['a', '', 'b'])
  assert.deepStrictEqual(parseLine('a,""'), ['a', ''])
})
