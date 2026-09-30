// 원화 금액 다루기

// 12900 → '12,900원'
export function formatKRW(amount) {
  if (!Number.isFinite(amount)) return '-'
  const sign = amount < 0 ? '-' : ''
  const digits = String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${digits}원`
}

// '12,900원', '₩12900', '3만', '2.5만' → 숫자. 읽을 수 없으면 NaN
export function parseKRW(text) {
  if (typeof text === 'number') return text
  if (text == null) return NaN
  const cleaned = String(text).replace(/[,\s원₩]/g, '')
  if (cleaned === '') return NaN
  const man = /^(\d+(?:\.\d+)?)만$/.exec(cleaned)
  if (man) return Math.round(Number(man[1]) * 10000)
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return NaN
  return Number(cleaned)
}

// 정가 대비 할인율(%) 정수. 할인이 없으면 0
export function discountRate(price, listPrice) {
  if (!(listPrice > 0) || !(price >= 0) || price >= listPrice) return 0
  return Math.floor(((listPrice - price) / listPrice) * 100)
}
