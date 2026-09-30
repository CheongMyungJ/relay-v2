// 부가가치세. 기본 세율 10%, 면세 분류는 0
export const VAT_RATE = 0.1

const TAX_FREE = new Set(['면세', '급여', '보험료', '이자'])

export function isTaxFree(category) {
  return TAX_FREE.has(String(category ?? '').trim())
}

// 공급가액에서 세액. 원 단위 반올림, 음수(환불)도 양수와 대칭
export function vatFor(supply, rate = VAT_RATE) {
  return Math.sign(supply) * Math.round(Math.abs(supply) * rate)
}

// 합계금액(공급가액+세액)에서 공급가액과 세액 나누기
export function splitGross(gross, rate = VAT_RATE) {
  const supply = Math.sign(gross) * Math.round(Math.abs(gross) / (1 + rate))
  return { supply, vat: gross - supply }
}
