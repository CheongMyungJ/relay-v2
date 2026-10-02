// 다섯 칸짜리 cron 식 읽기: "분 시 일 월 요일" (UTC 기준)
// 지원: *, 숫자, 목록(1,15), 범위(1-5), 간격(*/10, 0-30/5)

const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'weekday', min: 0, max: 6 },
]

function parseNumber(text, field) {
  if (!/^\d+$/.test(text)) throw new Error(`${field.name}에 숫자가 아닌 값: ${text}`)
  const n = Number(text)
  if (n < field.min || n > field.max) {
    throw new Error(`${field.name}은(는) ${field.min}~${field.max} 사이여야 합니다: ${n}`)
  }
  return n
}

function parsePart(part, field) {
  const [range, stepText] = part.split('/')
  const step = stepText === undefined ? 1 : parseNumber(stepText, { ...field, min: 1 })
  let from = field.min
  let to = field.max
  if (range !== '*') {
    const [a, b] = range.split('-')
    from = parseNumber(a, field)
    to = b === undefined ? (stepText === undefined ? from : field.max) : parseNumber(b, field)
    if (to < from) throw new Error(`${field.name} 범위가 거꾸로입니다: ${range}`)
  }
  const values = []
  for (let v = from; v <= to; v += step) values.push(v)
  return values
}

/** cron 식을 칸마다 허용 값 집합으로 */
export function parseCron(expr) {
  const parts = String(expr).trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`cron 식은 다섯 칸이어야 합니다: ${expr}`)
  const out = {}
  FIELDS.forEach((field, i) => {
    out[field.name] = new Set(parts[i].split(',').flatMap((p) => parsePart(p, field)))
  })
  out.source = expr
  return out
}

/** date(UTC)가 cron 식에 맞는지 */
export function matches(cron, date) {
  const c = typeof cron === 'string' ? parseCron(cron) : cron
  return (
    c.minute.has(date.getUTCMinutes()) &&
    c.hour.has(date.getUTCHours()) &&
    c.day.has(date.getUTCDate()) &&
    c.month.has(date.getUTCMonth() + 1) &&
    c.weekday.has(date.getUTCDay())
  )
}

/** after 다음으로 맞는 시각(분 단위). limitDays 안에 없으면 null */
export function nextRun(cron, after, limitDays = 366) {
  const c = typeof cron === 'string' ? parseCron(cron) : cron
  const t = new Date(after.getTime())
  t.setUTCSeconds(0, 0)
  t.setUTCMinutes(t.getUTCMinutes() + 1)
  const end = after.getTime() + limitDays * 24 * 60 * 60 * 1000
  while (t.getTime() <= end) {
    if (matches(c, t)) return new Date(t.getTime())
    t.setUTCMinutes(t.getUTCMinutes() + 1)
  }
  return null
}
