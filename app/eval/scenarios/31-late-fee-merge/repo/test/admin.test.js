import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { runCommand } from '../src/admin/cli.js'
import { resetStore } from '../src/rentals/store.js'
import { seedRentals } from '../src/seed.js'

beforeEach(() => resetStore(seedRentals))

function capture(args) {
  const lines = []
  const code = runCommand(args, (l) => lines.push(l))
  return { code, lines }
}

test('fee 명령', () => {
  assert.deepEqual(capture(['fee', 'R-1001', '2026-09-26']).lines, ['R-1001 전동 드릴: 3일 늦음, 연체료 12,000원'])
  assert.deepEqual(capture(['fee', 'R-1001', '2026-09-22']).lines, ['R-1001 전동 드릴: 늦지 않음, 연체료 0원'])
})

test('모르는 명령은 도움말', () => {
  const out = capture(['nope'])
  assert.equal(out.code, 1)
  assert.match(out.lines[0], /명령:/)
})
