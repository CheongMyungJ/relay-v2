// 근무일 도구. 날짜는 'YYYY-MM-DD' 글로 주고받는다. 지금은 주말인지 보는 것만 있다.

export function isWeekend(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}
