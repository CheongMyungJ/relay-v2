// 금액 도우미. 금액은 원 단위 정수로 다룬다.

/** 원 단위로 맞춘다 */
export function won(n) {
  return Math.round(n)
}

/** amount의 percent% (소수 그대로) */
export function percentOf(amount, percent) {
  return (amount * percent) / 100
}

export function formatWon(n) {
  return `${n.toLocaleString('ko-KR')}원`
}
