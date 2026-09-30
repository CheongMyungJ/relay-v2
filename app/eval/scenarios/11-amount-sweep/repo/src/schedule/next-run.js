// 정기 리포트 일정. 'monthly:1 09:00'(매달 1일), 'weekly:mon 08:30'(매주 월요일), 'daily 07:00'
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function parseSchedule(spec) {
  const m = /^(daily|weekly:(\w{3})|monthly:(\d{1,2}))\s+(\d{2}):(\d{2})$/.exec(String(spec).trim())
  if (!m) throw new Error(`일정 형식이 아님: ${spec}`)
  const time = { hour: Number(m[4]), minute: Number(m[5]) }
  if (time.hour > 23 || time.minute > 59) throw new Error(`시각이 이상함: ${spec}`)
  if (m[1] === 'daily') return { kind: 'daily', ...time }
  if (m[2]) {
    const day = DAYS.indexOf(m[2].toLowerCase())
    if (day < 0) throw new Error(`요일이 이상함: ${m[2]}`)
    return { kind: 'weekly', day, ...time }
  }
  const date = Number(m[3])
  if (date < 1 || date > 28) throw new Error(`매달 날짜는 1~28: ${m[3]}`)
  return { kind: 'monthly', date, ...time }
}

// from 뒤의 다음 실행 시각(UTC 기준으로 센다)
export function nextRun(spec, from = new Date()) {
  const s = typeof spec === 'string' ? parseSchedule(spec) : spec
  const t = new Date(from.getTime())
  t.setUTCSeconds(0, 0)
  t.setUTCHours(s.hour, s.minute)
  const after = (d) => d.getTime() > from.getTime()
  if (s.kind === 'daily') {
    if (!after(t)) t.setUTCDate(t.getUTCDate() + 1)
    return t
  }
  if (s.kind === 'weekly') {
    const add = (s.day - t.getUTCDay() + 7) % 7
    t.setUTCDate(t.getUTCDate() + add)
    if (!after(t)) t.setUTCDate(t.getUTCDate() + 7)
    return t
  }
  t.setUTCDate(s.date)
  if (!after(t)) t.setUTCMonth(t.getUTCMonth() + 1, s.date)
  return t
}
