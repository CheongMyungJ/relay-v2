// 원 단위 금액 도우미

export function assertWon(value, name = '금액') {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name}은 0 이상의 정수 원이어야 한다: ${value}`)
  return value
}

export function sumWon(values) {
  return values.reduce((a, b) => a + b, 0)
}

/** 금액의 percent%. 원 단위로 반올림한다 */
export function percentOf(amount, percent) {
  return Math.round((amount * percent) / 100)
}

/** 10원 단위 버림 */
export function floorTen(amount) {
  return Math.floor(amount / 10) * 10
}
