// 금액 표시
const group = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** 옛 표시. formatMoney로 옮기는 중이다 */
export function formatPrice(n) {
  return `${group(n)}원`
}

/** 새 표시. 단위를 고를 수 있다 */
export function formatMoney(n, { unit = '원' } = {}) {
  return `${group(n)}${unit}`
}
