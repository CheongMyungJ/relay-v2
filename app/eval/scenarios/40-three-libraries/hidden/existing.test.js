import { test } from 'node:test'
import assert from 'node:assert'
import { toCsv } from '../src/csv.js'
import { isWon } from '../src/money.js'
import { isWeekend } from '../src/workdays.js'

test('쓰기', () => assert.strictEqual(toCsv([['a', 'b,c']]), 'a,"b,c"'))
test('원', () => assert.strictEqual(isWon(3), true))
test('주말', () => assert.strictEqual(isWeekend('2026-11-01'), true))
