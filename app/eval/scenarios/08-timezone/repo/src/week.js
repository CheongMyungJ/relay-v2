// 'YYYY-MM-DD' 날짜가 주말인지
export function isWeekend(dateString) {
  const d = new Date(dateString)
  const day = d.getDay()
  return day === 0 || day === 6
}
