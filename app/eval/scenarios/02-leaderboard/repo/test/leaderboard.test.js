import { test } from 'node:test'
import assert from 'node:assert'
import { leaderboard } from '../src/leaderboard.js'

test('상위 두 명', () => {
  const players = [
    { name: 'a', score: 3 },
    { name: 'b', score: 7 },
    { name: 'c', score: 5 },
  ]
  assert.deepStrictEqual(leaderboard(players, 2), ['b', 'c'])
})
