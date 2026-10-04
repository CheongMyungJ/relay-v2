/** 12345 → '12,345' */
export function groupDigits(n) {
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return n < 0 ? `-${s}` : s
}

export const won = (n) => `${groupDigits(n)}원`
export const pt = (n) => `${groupDigits(n)}P`
