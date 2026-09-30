// 숫자 도우미

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// '3', 3, 3.0 → 3. 양의 정수가 아니면 fallback
export function toPositiveInt(value, fallback) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return Number.isInteger(n) && n > 0 ? n : fallback
}

// 소수점 자리 반올림. 점수 비교가 부동소수 오차로 흔들리지 않게 쓴다
export function round(value, digits = 4) {
  const f = 10 ** digits
  return Math.round(value * f) / f
}
