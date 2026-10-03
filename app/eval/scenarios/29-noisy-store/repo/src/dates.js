/** 시각(Date 또는 ISO 문자열)의 날짜 'YYYY-MM-DD' */
export function dateOf(at) {
  return new Date(at).toISOString().slice(0, 10)
}

/** 날짜 a가 b보다 앞인가 ('YYYY-MM-DD' 비교) */
export function before(a, b) {
  return a < b
}
