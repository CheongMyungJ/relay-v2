import { test } from 'node:test'
import assert from 'node:assert'
import { leaderboard } from '../src/leaderboard.js'

test('두 자리 이상 점수', () => {
  const players = [
    { name: 'a', score: 9 },
    { name: 'b', score: 10 },
    { name: 'c', score: 100 },
    { name: 'd', score: 25 },
  ]
  assert.deepStrictEqual(leaderboard(players, 3), ['c', 'd', 'b'])
})
