// 원 단위 금액 도우미. 이 레포의 금액은 모두 정수 원이다.

export function isWon(value) {
  return Number.isSafeInteger(value)
}

export function assertWon(value, label = '금액') {
  if (!isWon(value)) throw new TypeError(`${label}은(는) 정수 원이어야 한다: ${value}`)
  return value
}

export function sumWon(values) {
  let total = 0
  for (const v of values) total += assertWon(v)
  return total
}

// '29,082원', '₩29,082', ' 1,200 ' 같은 글을 숫자로 바꾼다
export function parseWon(text) {
  if (typeof text === 'number') return assertWon(text)
  if (typeof text !== 'string') throw new TypeError(`금액 글이 아니다: ${text}`)
  const cleaned = text.trim().replace(/^₩/, '').replace(/원$/, '').trim()
  if (!/^-?\d{1,3}(,\d{3})*$|^-?\d+$/.test(cleaned)) throw new Error(`금액 형식이 아니다: ${text}`)
  const value = Number(cleaned.replace(/,/g, ''))
  return assertWon(value)
}

// amount의 percent%를 원 단위로 반올림
export function percentOf(amount, percent) {
  assertWon(amount)
  if (typeof percent !== 'number' || percent < 0 || percent > 100) {
    throw new RangeError(`비율은 0~100이어야 한다: ${percent}`)
  }
  return Math.round((amount * percent) / 100)
}

// 금액을 비율대로 나눈다. 나머지 원은 앞에서부터 1원씩 더한다 (분할 납부용)
export function splitWon(amount, parts) {
  assertWon(amount)
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError(`나눌 수가 잘못됐다: ${parts}`)
  const base = Math.floor(amount / parts)
  const rest = amount - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0))
}
