// 금액은 원 단위 정수로 다룬다

export function formatWon(n) {
  const s = String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${s}원`
}

export function sum(xs) {
  return xs.reduce((a, b) => a + b, 0)
}
