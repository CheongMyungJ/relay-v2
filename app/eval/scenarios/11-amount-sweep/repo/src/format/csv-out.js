// 리포트 결과를 CSV로 내보낸다. 쉼표, 따옴표, 줄바꿈이 든 칸은 따옴표로 감싼다
function quote(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, columns) {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : [])
  const keys = cols.map((c) => (typeof c === 'string' ? c : c.key))
  const titles = cols.map((c) => (typeof c === 'string' ? c : c.title ?? c.key))
  const lines = [titles.map(quote).join(',')]
  for (const row of rows) lines.push(keys.map((k) => quote(row[k])).join(','))
  return lines.join('\n') + '\n'
}
