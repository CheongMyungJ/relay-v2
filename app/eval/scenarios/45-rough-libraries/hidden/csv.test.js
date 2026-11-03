import { test } from 'node:test'
import assert from 'node:assert'
import { parseCsv, toCsv } from '../src/csv.js'

test('기본: 쉼표, 줄', () => {
  assert.deepStrictEqual(parseCsv('a,b\nc,d'), [['a', 'b'], ['c', 'd']])
})
test('따옴표 안의 쉼표, 따옴표("" ), 줄바꿈', () => {
  assert.deepStrictEqual(parseCsv('"x,y","he said ""hi""","l1\nl2"'), [['x,y', 'he said "hi"', 'l1\nl2']])
})
test('CRLF와 끝의 줄바꿈', () => {
  assert.deepStrictEqual(parseCsv('a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']])
})
test('빈 칸은 빈 글로 남는다', () => {
  assert.deepStrictEqual(parseCsv('a,,c\n,,'), [['a', '', 'c'], ['', '', '']])
})
test('빈 글은 빈 표', () => {
  assert.deepStrictEqual(parseCsv(''), [])
})
test('쓰고 읽으면 그대로', () => {
  const rows = [['이름', '메모'], ['김', '쉼표, "따옴표"\n줄']]
  assert.deepStrictEqual(parseCsv(toCsv(rows)), rows)
})
