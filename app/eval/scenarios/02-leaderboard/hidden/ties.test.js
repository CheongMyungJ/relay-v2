import { test } from 'node:test'
import assert from 'node:assert'
import { leaderboard } from '../src/leaderboard.js'

test('동점자는 각자 이름이 나오고 들어온 순서를 지키며 n명에서 자른다', () => {
  const players = [
    { name: 'a', score: 5 },
    { name: 'b', score: 9 },
    { name: 'c', score: 5 },
    { name: 'd', score: 1 },
  ]
  assert.deepStrictEqual(leaderboard(players, 3), ['b', 'a', 'c'])
  assert.deepStrictEqual(leaderboard(players, 2), ['b', 'a'])
})
