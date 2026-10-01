// 표를 CSV 글로 바꾼다. 첫 줄은 머리글이다.
// columns: [{ key, title }], rows: [{ [key]: 값 }]

function cell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => cell(c.title)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))
  return [head, ...body].join('\n')
}
