// 금액 문자열 공통 처리. 원장의 금액은 '1,200', '₩3,000', '12.50'처럼 문자열로 온다

const AMOUNT = /^(-?)\(?(\d+(?:\.\d+)?)\)?$/

export function parseAmount(text) {
  if (typeof text === 'number') return text
  const s = String(text ?? '').replace(/[₩\s,]/g, '')
  if (s === '') return 0
  const m = AMOUNT.exec(s)
  if (!m) throw new Error(`금액 형식이 아님: ${text}`)
  const n = Number(m[2])
  return m[1] ? -n : n
}

export function sumAmounts(list) {
  let total = 0
  for (const item of list) total += parseAmount(item)
  return total
}

// 원 단위 반올림. 음수도 절댓값 기준으로 반올림해 양수와 대칭이 되게 한다
export function roundWon(n) {
  return Math.sign(n) * Math.round(Math.abs(n))
}

export function isZeroAmount(text) {
  return parseAmount(text) === 0
}
