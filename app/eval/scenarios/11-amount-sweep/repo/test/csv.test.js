import { test } from 'node:test'
import assert from 'node:assert'
import { detectSeparator, parseCsvLine, splitLines } from '../src/ledger/csv.js'

test('따옴표 안의 쉼표는 칸을 나누지 않는다', () => {
  assert.deepStrictEqual(parseCsvLine('a,"1,200",c'), ['a', '1,200', 'c'])
})

test('"" 는 따옴표 하나', () => {
  assert.deepStrictEqual(parseCsvLine('"그는 ""네"" 했다",x'), ['그는 "네" 했다', 'x'])
})

test('줄 나누기: CRLF, BOM, 따옴표 안의 줄바꿈', () => {
  assert.deepStrictEqual(splitLines('﻿a,b\r\nc,d\n'), ['a,b', 'c,d'])
  assert.deepStrictEqual(splitLines('a,"x\ny"\nb'), ['a,"x\ny"', 'b'])
})

test('구분자 찾기', () => {
  assert.strictEqual(detectSeparator('일자,계정,금액'), ',')
  assert.strictEqual(detectSeparator('일자\t계정\t금액'), '\t')
})
