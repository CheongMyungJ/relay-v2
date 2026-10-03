// 금액 서식. 서식은 계산하지 않고 받은 숫자를 그대로 보여 준다

// 29082 -> '29,082'
export function formatNumber(n) {
  if (!Number.isSafeInteger(n)) throw new TypeError(`정수가 아니다: ${n}`)
  const sign = n < 0 ? '-' : ''
  const digits = String(Math.abs(n))
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// 29082 -> '29,082원'
export function formatWon(n) {
  return `${formatNumber(n)}원`
}

// 청구서 아래에 적는 한글 금액. 29082 -> '금 이만구천팔십이원정'
const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']
const BIG = ['', '만', '억', '조']

export function wonInWords(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`0 이상의 정수: ${n}`)
  if (n === 0) return '금 영원정'
  let rest = n
  let group = 0
  let words = ''
  while (rest > 0) {
    const chunk = rest % 10000
    if (chunk > 0) {
      let part = ''
      let c = chunk
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10
        if (d > 0) part = (d === 1 && i > 0 ? '' : DIGITS[d]) + SMALL[i] + part
        c = Math.floor(c / 10)
      }
      words = part + BIG[group] + words
    }
    rest = Math.floor(rest / 10000)
    group += 1
  }
  return `금 ${words}원정`
}
