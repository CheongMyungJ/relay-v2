// 로그 한 줄 만들기
// [2026-09-30T01:02:03.000Z] WARN search: 느린 검색 ms=120 query="텀블러"

export function formatValue(value) {
  if (value == null) return String(value)
  if (typeof value === 'string') return /[\s="]/.test(value) || value === '' ? JSON.stringify(value) : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Error) return JSON.stringify(value.message)
  return JSON.stringify(value)
}

export function formatFields(fields = {}) {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${formatValue(v)}`)
    .join(' ')
}

export function formatLine(record) {
  const time = new Date(record.time).toISOString()
  const head = `[${time}] ${record.level.toUpperCase()} ${record.scope}: ${record.message}`
  const tail = formatFields(record.fields)
  return tail ? `${head} ${tail}` : head
}

// 로그 수집기로 보낼 때 쓰는 JSON 한 줄
export function formatJson(record) {
  const fields = {}
  for (const [k, v] of Object.entries(record.fields ?? {})) {
    if (v === undefined) continue
    fields[k] = v instanceof Error ? { message: v.message, name: v.name } : v
  }
  return JSON.stringify({ time: new Date(record.time).toISOString(), level: record.level, scope: record.scope, msg: record.message, ...fields })
}
