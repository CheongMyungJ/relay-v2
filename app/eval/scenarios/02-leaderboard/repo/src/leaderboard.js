import { topScores } from './rank.js'

// 선수 목록에서 점수가 높은 n명의 이름
export function leaderboard(players, n) {
  const top = topScores(
    players.map((p) => p.score),
    n,
  )
  return top.map((score) => players.find((p) => p.score === score).name)
}
