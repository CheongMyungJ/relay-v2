import { test } from 'node:test'
import assert from 'node:assert'
import { parseCsv } from '../src/csv.js'

test('간단한 표', () => {
  assert.deepStrictEqual(parseCsv('a,b\n1,2\n'), [
    ['a', 'b'],
    ['1', '2'],
  ])
})
