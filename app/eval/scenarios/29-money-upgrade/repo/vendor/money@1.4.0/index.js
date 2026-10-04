// money 1.4.0 — 원 단위 금액 도우미 (vendored)

/** 원 단위로 반올림한다. 0.5는 올린다 */
export function roundWon(n) {
  return Math.floor(n + 0.5)
}

/** 12345 → "12,345원" */
export function formatWon(n) {
  return `${String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}
