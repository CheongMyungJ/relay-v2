/** 리포트 화면의 날짜 'YYYY-MM-DD' (서버 시간대) */
export function localDay(at) {
  const d = new Date(at)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
