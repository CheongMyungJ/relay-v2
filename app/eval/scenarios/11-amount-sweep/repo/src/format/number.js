// 숫자를 사람이 읽는 글자로. 금액 읽기는 하지 않는다

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatWon(n, { sign = 'minus' } = {}) {
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  const [int, frac] = String(Math.round(abs * 100) / 100).split('.')
  const body = '₩' + groupThousands(int) + (frac ? '.' + frac.padEnd(2, '0') : '')
  if (n >= 0 || abs === 0) return body
  return sign === 'paren' ? `(${body})` : `-${body}`
}

export function formatNumber(n) {
  if (!Number.isFinite(n)) return '-'
  const neg = n < 0
  const [int, frac] = String(Math.abs(n)).split('.')
  return (neg ? '-' : '') + groupThousands(int) + (frac ? '.' + frac : '')
}

export function formatPercent(ratio, digits = 1) {
  if (!Number.isFinite(ratio)) return '-'
  return (ratio * 100).toFixed(digits) + '%'
}

export function formatSigned(n) {
  if (!Number.isFinite(n)) return '-'
  return (n > 0 ? '+' : '') + formatNumber(n)
}
