// 점수 목록에서 높은 순으로 n개
export function topScores(scores, n) {
  return [...scores].sort().reverse().slice(0, n)
}
