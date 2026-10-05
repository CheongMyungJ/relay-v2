// 리포트를 CSV 글로 바꾼다. 값에 쉼표, 따옴표, 줄바꿈이 있으면 따옴표로 감싼다

function cell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => cell(c.label ?? c.key)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))
  return [head, ...body].join('\n')
}
