// CSV 도구. 지금은 쓰기만 있다.

function cell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows) {
  return rows.map((r) => r.map(cell).join(',')).join('\n')
}
